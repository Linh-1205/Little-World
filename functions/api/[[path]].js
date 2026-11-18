// Our Little World — API
// Cloudflare Pages Functions + D1 (database) + R2 (ảnh/video/nhạc)

const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
const fail = (msg, status = 400) => json({ error: msg }, status);

/* ───────── cấu hình các bảng (chỉ cột trong danh sách này mới được ghi) ───────── */
const FLAGS = new Set(['is_private', 'yearly', 'done']);
const INTS = new Set(['w', 'h']);
const LONG = new Set(['body', 'story', 'content']);
const MEDIA_COLS = ['photo_key', 'media_key'];

const TABLES = {
  timeline: { cols: ['date', 'title', 'story', 'photo_key'], req: ['date', 'title'], order: 'date ASC, id ASC' },
  memories: {
    cols: ['date', 'caption', 'tag', 'media_key', 'media_type', 'w', 'h'],
    req: ['date', 'media_key'],
    order: 'date DESC, id DESC',
    stamp: true,
    enums: { media_type: ['image', 'video'] },
  },
  letters: { cols: ['title', 'body', 'is_private', 'unlock_at'], req: ['body'], order: 'id DESC', stamp: true, own: true },
  songs: { cols: ['title', 'artist', 'url', 'reason', 'memory'], req: ['title'], order: 'id DESC', urls: ['url'] },
  special_days: {
    cols: ['kind', 'title', 'date', 'yearly', 'note'],
    req: ['title', 'date'],
    order: 'date ASC, id ASC',
    enums: { kind: ['birthday', 'anniversary', 'valentine', 'other'] },
  },
  bucket: { cols: ['title', 'note', 'done', 'done_at'], req: ['title'], order: 'done ASC, id ASC' },
  little: {
    cols: ['kind', 'body'],
    req: ['body'],
    order: 'id DESC',
    stamp: true,
    enums: { kind: ['funny', 'nickname', 'moment', 'silly', 'like', 'secret'] },
  },
  surprises: {
    cols: ['kind', 'title', 'content', 'photo_key', 'unlock_at'],
    req: ['kind'],
    order: 'id DESC',
    stamp: true,
    own: true,
    enums: { kind: ['gift', 'timed', 'future', 'hidden_photo'] },
  },
};

const SETTING_KEYS = ['name_a', 'name_b', 'start_date', 'hero_key', 'bgm_url', 'bgm_key', 'anniv_title', 'anniv_message'];
const SETTING_MEDIA = ['hero_key', 'bgm_key'];

const MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'weba',
};
const MB = 1024 * 1024;
const LIMITS = { image: 15 * MB, video: 60 * MB, audio: 25 * MB };
const D1_IMAGE_MAX = 1500 * 1024; // khi không có R2: ảnh lưu trong D1, mỗi dòng tối đa ~2MB
const KEY_RE = /^\d{4}\/[a-f0-9-]{36}\.[a-z0-9]{2,5}$/;

const other = (w) => (w === 'A' ? 'B' : 'A');

/* ───────── mật mã & phiên đăng nhập ───────── */
const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

// so sánh chuỗi không để lộ thời gian
async function safeEq(a, b) {
  const [x, y] = await Promise.all([hmac('cmp', String(a ?? '')), hmac('cmp', String(b ?? ''))]);
  let d = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ (y.charCodeAt(i) || 0);
  return d === 0;
}

const secretOf = (env) => env.SESSION_SECRET || `${env.PASS_A}|${env.PASS_B}`;
const SESSION_DAYS = 60;

async function makeSession(env, who) {
  const p = `${who}.${Date.now() + SESSION_DAYS * 864e5}`;
  return `${p}.${await hmac(secretOf(env), p)}`;
}

async function readSession(request, env) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)lw=([^;]+)/);
  if (!m) return null;
  const [who, exp, sig] = m[1].split('.');
  if (!['A', 'B'].includes(who) || !(Number(exp) > Date.now()) || !sig) return null;
  return (await safeEq(sig, await hmac(secretOf(env), `${who}.${exp}`))) ? who : null;
}

const cookie = (value, url, maxAge) =>
  `lw=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${url.protocol === 'https:' ? '; Secure' : ''}`;

/* ───────── tiện ích dữ liệu ───────── */
function clean(cfg, body) {
  const out = {};
  for (const c of cfg.cols) {
    if (!(c in body)) continue;
    let v = body[c];
    if (FLAGS.has(c)) v = v ? 1 : 0;
    else if (INTS.has(c)) v = Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Math.round(Number(v))) : null;
    else {
      v = v == null ? null : String(v).trim().slice(0, LONG.has(c) ? 20000 : 2000);
      if (v === '') v = null;
      if (v && c === 'unlock_at' && Number.isNaN(Date.parse(v))) v = null;
      if (v && cfg.urls?.includes(c) && !/^https?:\/\//i.test(v)) v = null;
      if (v && MEDIA_COLS.includes(c) && !KEY_RE.test(v)) v = null;
      if (v && cfg.enums?.[c] && !cfg.enums[c].includes(v)) v = null;
    }
    out[c] = v;
  }
  return out;
}

function lockRow(r, me, t) {
  const until = r.unlock_at ? Date.parse(r.unlock_at) : 0;
  const locked = until > Date.now() && (r.from_who !== me || r.kind === 'future');
  if (!locked) return r;
  return { ...r, locked: 1, body: null, content: null, photo_key: null };
}

async function listTable(env, t, me) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${t} ORDER BY ${TABLES[t].order}`).all();
  if (t === 'letters') return results.filter((r) => !(r.is_private && r.from_who !== me)).map((r) => lockRow(r, me, t));
  if (t === 'surprises') return results.map((r) => lockRow(r, me, t));
  return results;
}

async function dropMedia(env, ...keys) {
  const ks = keys.filter((k) => k && KEY_RE.test(k));
  if (!ks.length) return;
  if (env.BUCKET) await Promise.all(ks.map((k) => env.BUCKET.delete(k).catch(() => {})));
  await env.DB.batch(ks.map((k) => env.DB.prepare('DELETE FROM media WHERE key = ?').bind(k))).catch(() => {});
}

const q = (name) => `"${name}"`;

/* ───────── router ───────── */
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  let parts;
  try {
    parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return fail('Đường dẫn không hợp lệ');
  }
  try {
    return await handle(request, env, url, parts);
  } catch (e) {
    console.error(e);
    return fail('Có lỗi ở máy chủ, thử lại sau nhé.', 500);
  }
}

async function handle(request, env, url, parts) {
  const method = request.method;
  const [a, b, c] = parts;
  const configured = !!(env.PASS_A && env.PASS_B && env.DB); // BUCKET (R2) là tuỳ chọn

  // chống CSRF: mọi yêu cầu ghi phải có header tự đặt (form chéo trang không gửi được)
  if (method !== 'GET' && method !== 'HEAD' && request.headers.get('x-lw') !== '1') return fail('Yêu cầu không hợp lệ', 403);

  if (a === 'me' && method === 'GET') {
    const who = configured ? await readSession(request, env) : null;
    return json({ ready: configured, shared: configured && env.PASS_A === env.PASS_B, auth: !!who, who });
  }
  if (!configured) return fail('Website chưa được cấu hình (thiếu PASS_A, PASS_B hoặc binding DB).', 503);

  if (a === 'login' && method === 'POST') return login(request, env, url);
  if (a === 'logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookie('', url, 0) });

  const me = await readSession(request, env);
  if (!me) return fail('Bạn cần đăng nhập', 401);

  /* --- toàn bộ dữ liệu --- */
  if (a === 'data' && method === 'GET') {
    const out = { me, caps: { r2: !!env.BUCKET } };
    const s = await env.DB.prepare('SELECT k, v FROM settings').all();
    out.settings = Object.fromEntries(s.results.map((r) => [r.k, r.v]));
    for (const t of Object.keys(TABLES)) out[t] = await listTable(env, t, me);
    return json(out);
  }

  /* --- cài đặt chung --- */
  if (a === 'settings' && method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    const old = Object.fromEntries((await env.DB.prepare('SELECT k, v FROM settings').all()).results.map((r) => [r.k, r.v]));
    const stmts = [];
    const stale = [];
    for (const k of SETTING_KEYS) {
      if (!(k in body)) continue;
      let v = body[k] == null ? '' : String(body[k]).trim().slice(0, 3000);
      if (k === 'start_date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) v = '';
      if (k === 'bgm_url' && v && !/^https?:\/\//i.test(v)) v = '';
      if (SETTING_MEDIA.includes(k) && v && !KEY_RE.test(v)) v = '';
      if (SETTING_MEDIA.includes(k) && old[k] && old[k] !== v) stale.push(old[k]);
      stmts.push(
        v
          ? env.DB.prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v)
          : env.DB.prepare('DELETE FROM settings WHERE k = ?').bind(k),
      );
    }
    if (stmts.length) await env.DB.batch(stmts);
    await dropMedia(env, ...stale);
    return json({ ok: true });
  }

  /* --- tải tệp lên R2 --- */
  if (a === 'upload' && method === 'POST') {
    const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = MIME[type];
    if (!ext) return fail('Định dạng tệp chưa được hỗ trợ', 415);
    const kind = type.split('/')[0];
    const key = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;
    if (env.BUCKET) {
      const len = Number(request.headers.get('content-length') || 0);
      if (!len) return fail('Thiếu kích thước tệp', 411);
      if (len > LIMITS[kind]) return fail('Tệp quá lớn', 413);
      await env.BUCKET.put(key, request.body, { httpMetadata: { contentType: type } });
      return json({ key });
    }
    // chế độ không R2: lưu ảnh trực tiếp trong D1
    if (kind !== 'image') return fail('Video và nhạc cần bật R2. Hiện chỉ lưu được ảnh.', 415);
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) return fail('Tệp rỗng', 400);
    if (buf.byteLength > D1_IMAGE_MAX) return fail('Ảnh quá lớn (tối đa ~1,5MB), hãy chọn ảnh nhỏ hơn.', 413);
    await env.DB.prepare('INSERT INTO media (key, type, size, data) VALUES (?, ?, ?, ?)').bind(key, type, buf.byteLength, buf).run();
    return json({ key });
  }

  /* --- phát ảnh/video/nhạc (hỗ trợ Range cho video) --- */
  if (a === 'media' && (method === 'GET' || method === 'HEAD')) {
    const key = parts.slice(1).join('/');
    if (!KEY_RE.test(key)) return fail('Không tìm thấy', 404);
    const hasRange = request.headers.has('range');
    const obj = env.BUCKET ? await env.BUCKET.get(key, hasRange ? { range: request.headers } : undefined) : null;
    if (obj) {
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      headers.set('accept-ranges', 'bytes');
      headers.set('cache-control', 'private, max-age=31536000, immutable');
      headers.set('x-content-type-options', 'nosniff');
      let status = 200;
      if (hasRange && obj.range) {
        const off = obj.range.offset ?? 0;
        const len = obj.range.length ?? obj.size - off;
        headers.set('content-range', `bytes ${off}-${off + len - 1}/${obj.size}`);
        status = 206;
      }
      return new Response(method === 'HEAD' ? null : obj.body, { status, headers });
    }
    // ảnh lưu trong D1
    const row = await env.DB.prepare('SELECT type, data FROM media WHERE key = ?').bind(key).first();
    if (!row) return fail('Không tìm thấy', 404);
    const d = row.data;
    const body = d instanceof ArrayBuffer ? d : new Uint8Array(d).buffer;
    return new Response(method === 'HEAD' ? null : body, {
      headers: { 'content-type': row.type, 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
    });
  }

  /* --- các bảng dữ liệu --- */
  const cfg = TABLES[a];
  if (!cfg) return fail('Không tìm thấy', 404);
  const id = b && /^\d+$/.test(b) ? Number(b) : null;

  if (method === 'POST' && id === null) {
    const body = await request.json().catch(() => ({}));
    const f = clean(cfg, body);
    for (const r of cfg.req) if (f[r] == null || f[r] === '') return fail('Thiếu thông tin cần thiết');
    if (cfg.stamp) f.from_who = me;
    if (a === 'letters') f.to_who = f.is_private ? me : other(me);
    const names = Object.keys(f);
    const res = await env.DB.prepare(`INSERT INTO ${a} (${names.map(q).join(',')}) VALUES (${names.map(() => '?').join(',')})`)
      .bind(...names.map((n) => f[n]))
      .run();
    return json({ id: res.meta.last_row_id });
  }

  if (id === null) return fail('Không tìm thấy', 404);
  const row = await env.DB.prepare(`SELECT * FROM ${a} WHERE id = ?`).bind(id).first();
  if (!row) return fail('Không tìm thấy', 404);

  // đánh dấu đã mở thư / hộp quà
  if (method === 'POST' && c === 'open' && (a === 'letters' || a === 'surprises')) {
    if (lockRow(row, me, a).locked) return fail('Chưa đến lúc mở nhé', 403);
    if (row.from_who !== me && !(a === 'letters' && row.to_who !== me)) {
      const now = new Date().toISOString();
      if (a === 'letters' && !row.opened_at) await env.DB.prepare('UPDATE letters SET opened_at = ? WHERE id = ?').bind(now, id).run();
      if (a === 'surprises' && !row.opened) await env.DB.prepare('UPDATE surprises SET opened = 1, opened_at = ? WHERE id = ?').bind(now, id).run();
    }
    return json({ ok: true });
  }

  if (cfg.own && row.from_who !== me) return fail('Chỉ người viết mới sửa hoặc xoá được', 403);

  if (method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    const f = clean(cfg, body);
    for (const r of cfg.req) if (r in f && (f[r] == null || f[r] === '')) return fail('Thiếu thông tin cần thiết');
    if (a === 'letters' && 'is_private' in f) f.to_who = f.is_private ? row.from_who : other(row.from_who);
    const names = Object.keys(f);
    if (!names.length) return json({ ok: true });
    await env.DB.prepare(`UPDATE ${a} SET ${names.map((n) => `${q(n)} = ?`).join(', ')} WHERE id = ?`)
      .bind(...names.map((n) => f[n]), id)
      .run();
    await dropMedia(env, ...MEDIA_COLS.filter((m) => m in f && row[m] && row[m] !== f[m]).map((m) => row[m]));
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    await env.DB.prepare(`DELETE FROM ${a} WHERE id = ?`).bind(id).run();
    await dropMedia(env, ...MEDIA_COLS.map((m) => row[m]));
    return json({ ok: true });
  }

  return fail('Phương thức không được hỗ trợ', 405);
}

async function login(request, env, url) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const since = Date.now() - 15 * 60e3;
  const n = (await env.DB.prepare('SELECT COUNT(*) AS c FROM login_fails WHERE ip = ? AND ts > ?').bind(ip, since).first()).c;
  if (n >= 8) return fail('Thử quá nhiều lần rồi, đợi 15 phút rồi quay lại nhé.', 429);

  const { password = '', who } = await request.json().catch(() => ({}));
  const okA = await safeEq(password, env.PASS_A);
  const okB = await safeEq(password, env.PASS_B);
  if (!password || (!okA && !okB)) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO login_fails (ip, ts) VALUES (?, ?)').bind(ip, Date.now()),
      env.DB.prepare('DELETE FROM login_fails WHERE ts < ?').bind(Date.now() - 864e5),
    ]);
    return fail('Mật mã chưa đúng, thử lại nhé.', 401);
  }
  // PASS_A trùng PASS_B = dùng chung một mật mã, người dùng tự chọn mình là ai
  const me = okA && okB ? (who === 'B' ? 'B' : 'A') : okA ? 'A' : 'B';
  return json({ ok: true, who: me }, 200, { 'set-cookie': cookie(await makeSession(env, me), url, SESSION_DAYS * 86400) });
}
