'use strict';
/* Cuốn sổ: chia trang, dán ảnh tự do, chữ tự né ảnh */

const NB = (() => {
  const LINE = 32; // chiều cao một dòng kẻ
  const FONT = '500 21px "Cormorant Garamond","Playfair Display",Georgia,serif';
  const MIN_SEG = 56; // khoảng trống hẹp hơn mức này thì bỏ qua
  const PAD = 12; // khoảng cách giữa chữ và ảnh
  const MAX_PAGES = 40;
  const mctx = document.createElement('canvas').getContext('2d');
  const W = (t) => ((mctx.font = FONT), mctx.measureText(t).width);

  const st = {}; // trạng thái từng chương
  const docs = {}; // dữ liệu trang tự do từng chương
  let order = [];
  let active = null;
  let M = {};
  let frame, view, rings, indic, prevB, nextB, area, saveNote, bar, photoBar;
  let raf = 0;

  let tapAt = null;
  const uid = () => Math.random().toString(36).slice(2, 10);

  /* ───── dựng khung sổ ───── */
  function build(host, chapters) {
    order = chapters.map((c) => c[0]);
    frame = h('div', { class: 'nb-frame', id: 'nbFrame' });
    rings = h('div', { class: 'nb-rings', 'aria-hidden': 'true' });
    view = h('div', { class: 'nb-view' });
    prevB = h('button', { class: 'nb-arrow l', type: 'button', 'aria-label': 'Trang trước', onclick: () => turn(-1) }, '‹');
    nextB = h('button', { class: 'nb-arrow r', type: 'button', 'aria-label': 'Trang sau', onclick: () => turn(1) }, '›');
    const paper = h('div', { class: 'nb-paper' });
    ['tl', 'tr', 'bl', 'br'].forEach((c) => paper.append(Deco.html(Deco.corner(c))));
    frame.append(paper, rings, view, prevB, nextB);
    chapters.forEach(([id, no, title, sub]) => {
      const flow = h('div', { class: 'nb-flow' },
        h('header', { class: 'sec-head' }, h('span', { class: 'no' }, no), h('h2', null, title), Deco.divider(), h('p', null, sub)),
        h('div', { class: 'tools', id: id + '-tools' }),
        h('div', { id: id + '-body' }),
      );
      const track = h('div', { class: 'nb-track' }, flow);
      const el = h('div', { class: 'nb-chap', 'data-ch': id }, track);
      view.append(el);
      st[id] = { id, el, track, flow, N: 1, cur: 0, pages: [], pe: new Map(), sel: null, timer: 0, dirty: false };
      new MutationObserver(() => schedule()).observe(flow, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
      flow.addEventListener('load', schedule, true);
    });

    indic = h('span', { class: 'nb-ind' }, '');
    saveNote = h('span', { class: 'nb-save muted' }, '');
    bar = h('div', { class: 'nb-bar' },
      h('div', { class: 'nb-bar-l' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: pickPhoto }, '＋ Dán ảnh'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: addPage }, '＋ Thêm trang'),
      ),
      h('div', { class: 'nb-bar-r' }, saveNote, indic),
    );
    // ô nhập vô hình: gõ trực tiếp lên trang, con trỏ vẽ ngay trên dòng kẻ
    area = h('textarea', { class: 'nb-area', rows: 1, maxlength: 30000, 'aria-label': 'Viết vào trang sổ', autocapitalize: 'sentences' });
    area.addEventListener('input', onType);
    area.addEventListener('focus', () => st[active] && paintCaret(st[active]));
    area.addEventListener('blur', () => { trimTail(); st[active] && paintCaret(st[active]); });
    document.addEventListener('selectionchange', () => document.activeElement === area && st[active] && paintCaret(st[active]));
    frame.append(area);
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, id: 'nbFile' });
    file.addEventListener('change', async () => { const l = [...file.files]; file.value = ''; for (const f of l) await addPhoto(f); });
    const btn = (label, fn, cls = '') => h('button', { class: 'btn ghost sm ' + cls, type: 'button', onclick: fn }, label);
    photoBar = h('div', { class: 'nb-photobar', hidden: true },
      h('span', { class: 'nb-pb-t' }, 'Ảnh đang chọn:'),
      btn('✎ Trang trí', () => { const [s, ph] = selPhoto(); ph && editPhoto(s, ph); }),
      btn('⟲', () => tweak((ph) => (ph.r = Math.max(-180, ph.r - 8))), 'sq'),
      btn('⟳', () => tweak((ph) => (ph.r = Math.min(180, ph.r + 8))), 'sq'),
      btn('−', () => tweak((ph) => (ph.w = Math.max(0.12, ph.w - 0.06))), 'sq'),
      btn('＋', () => tweak((ph) => (ph.w = Math.min(1, ph.w + 0.06))), 'sq'),
      btn('▲ Lên', () => { const [s, ph] = selPhoto(); ph && front(s, ph); }),
      btn('✕ Xoá', () => { const [s, ph] = selPhoto(); ph && removePhoto(s, ph.id); }, 'danger'),
    );
    host.append(h('div', { class: 'nb-wrap' }, frame, bar, photoBar, file));

    // lật trang bằng vuốt ngang / bàn phím
    let sx = 0, sy = 0, tracking = false;
    view.addEventListener('pointerdown', (e) => { tracking = e.pointerType === 'touch' && !e.target.closest('.nb-pi,a,button,input,textarea,select,.nb-fp-x'); sx = e.clientX; sy = e.clientY; });
    view.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
    });
    document.addEventListener('keydown', (e) => {
      if ($('#book')?.hidden || !active || document.querySelector('.overlay')) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      if (!typing && e.key === 'ArrowLeft') turn(-1);
      else if (!typing && e.key === 'ArrowRight') turn(1);
      else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && st[active]?.sel) removePhoto(st[active], st[active].sel);
    });
    window.addEventListener('resize', () => schedule(true));
    document.addEventListener('visibilitychange', () => document.hidden && flush());
    document.fonts?.ready.then(() => schedule(true));
  }

  /* ───── kích thước & chia trang ───── */
  function metrics() {
    frame.style.height = Math.max(470, Math.min(800, innerHeight - 214)) + 'px';
    const Wd = frame.clientWidth, H = frame.clientHeight;
    const spread = Wd >= 860;
    const pw = spread ? Wd / 2 : Wd;
    const px = Math.round(Math.min(36, Math.max(18, pw * 0.07)));
    const py = 30;
    M = { W: Wd, H, spread, pw, px, py, cw: pw - 2 * px, ch: H - 2 * py, per: spread ? 2 : 1 };
    frame.classList.toggle('spread', spread);
    const n = Math.floor((H - 40) / 26);
    if (rings.childElementCount !== n) rings.replaceChildren(...Array.from({ length: n }, () => h('i')));
  }

  function schedule(full) {
    if (full === true) schedule.full = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!frame || !frame.clientWidth) return;
      metrics();
      Object.values(st).forEach((s) => relayout(s, schedule.full));
      if (active) refresh(st[active]);
      schedule.full = false;
    });
  }

  function relayout(s, force) {
    const { px, py, cw, ch, pw } = M;
    s.flow.style.cssText = `left:${px}px;top:${py}px;width:${cw}px;height:${ch}px;column-width:${cw}px;column-gap:${2 * px}px`;
    s.N = Math.max(1, Math.round((s.flow.scrollWidth + 2 * px) / pw));
    // chỉ dựng lại trang tự do khi kích thước hoặc số trang thật sự đổi (tránh làm mất cú bấm chuột)
    const sig = [M.W, M.H, M.pw, M.px, s.N].join('|');
    if (!force && sig === s.sig && s.pages.length) return;
    s.sig = sig;
    buildFree(s);
  }

  const total = (s) => s.N + (docOf(s.id).pages.length || 0);
  const spreads = (s) => Math.max(1, Math.ceil(total(s) / M.per));

  function refresh(s) {
    s.cur = Math.min(s.cur, spreads(s) - 1);
    s.track.style.transform = `translateX(${-s.cur * M.per * M.pw}px)`;
    const T = total(s), a = s.cur * M.per + 1, b = Math.min(T, a + M.per - 1);
    indic.textContent = M.per === 2 && b > a ? `Trang ${a}–${b} / ${T}` : `Trang ${a} / ${T}`;
    prevB.disabled = s.cur <= 0;
    nextB.disabled = s.cur >= spreads(s) - 1;
  }

  function turn(d) {
    const s = st[active];
    if (!s || s.busy) return;
    const n = Math.min(spreads(s) - 1, Math.max(0, s.cur + d));
    if (n !== s.cur) showSpread(s, n);
  }

  function showSpread(s, n) {
    if (s.busy) return;
    const calm = !frame.animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (Math.abs(n - s.cur) !== 1 || calm || !s.el.classList.contains('on')) return fade(s, n);
    flip(s, n);
  }

  // chuyển nhanh (nhảy nhiều trang)
  function fade(s, n) {
    s.track.classList.add('out');
    setTimeout(() => {
      s.cur = n;
      refresh(s);
      s.track.classList.remove('out');
    }, 140);
  }

  /* ───── hiệu ứng lật trang 3D ───── */
  // một mặt giấy chứa bản sao của một trang (L = trang trái, R = trang phải, P = trang đơn)
  function face(s, spreadIdx, side, back) {
    const c = s.el.cloneNode(true);
    c.removeAttribute('data-ch');
    c.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
    const tk = c.querySelector('.nb-track');
    tk.classList.remove('out');
    tk.style.transform = `translateX(${-spreadIdx * M.per * M.pw}px)`;
    Object.assign(c.style, { position: 'absolute', top: 0, left: (side === 'R' ? -M.pw : 0) + 'px', width: M.W + 'px', height: '100%', visibility: 'visible', pointerEvents: 'none' });
    const corners = side === 'L' ? ['tl', 'bl'] : side === 'R' ? ['tr', 'br'] : ['tl', 'br'];
    const el = h('div', { class: 'nb-face' + (back ? ' back' : '') }, ...corners.map((k) => Deco.html(Deco.corner(k))), c);
    el.append(h('div', { class: 'nb-shade' }));
    return el;
  }

  function flip(s, n) {
    const fwd = n > s.cur;
    const pw = M.pw, spread = M.per === 2;
    s.busy = true;
    const half = (cls, left, ...kids) => h('div', { class: cls, style: { left: left + 'px', width: pw + 'px' } }, ...kids);
    let under, flipper, frames;
    if (spread) {
      under = half('nb-under', fwd ? pw : 0, face(s, n, fwd ? 'R' : 'L'));
      const front = face(s, s.cur, fwd ? 'R' : 'L');
      const back = face(s, n, fwd ? 'L' : 'R', true);
      flipper = half('nb-flip', fwd ? pw : 0, front, back);
      flipper.style.transformOrigin = fwd ? 'left center' : 'right center';
      frames = [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${fwd ? -180 : 180}deg)` }];
    } else {
      const blank = h('div', { class: 'nb-face back' }, h('div', { class: 'nb-shade' }));
      under = half('nb-under', 0, face(s, fwd ? n : s.cur, 'P'));
      flipper = half('nb-flip', 0, face(s, fwd ? s.cur : n, 'P'), blank);
      flipper.style.transformOrigin = 'left center';
      frames = fwd ? [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }] : [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }];
    }
    const wrap = h('div', { class: 'nb-flipwrap' }, under, flipper);
    frame.append(wrap);
    // bóng đổ khi giấy cong lên
    const shades = $$('.nb-shade', flipper);
    const front = shades[0], back = shades[1];
    const T = { duration: 820, easing: 'cubic-bezier(.55,.08,.25,1)', fill: 'forwards' };
    front?.animate([{ opacity: 0 }, { opacity: 0.22, offset: 0.5 }, { opacity: 0.22 }], T);
    back?.animate([{ opacity: 0.22 }, { opacity: 0.22, offset: 0.5 }, { opacity: 0 }], T);
    const a = flipper.animate(frames, T);
    const done = () => {
      s.cur = n;
      refresh(s);
      requestAnimationFrame(() => { wrap.remove(); s.busy = false; });
    };
    a.finished.then(done, done);
  }

  /* ───── trang tự do ───── */
  const docOf = (id) => (docs[id] ||= { text: '', pages: [] });

  function buildFree(s) {
    const doc = docOf(s.id);
    if (!doc.pages.length) doc.pages.push({ photos: [] });
    layoutText(s, doc); // có thể tự thêm trang khi chữ dài
    s.pages.forEach((p) => p.el.remove());
    s.pages = doc.pages.map((pg, i) => {
      const el = h('div', { class: 'nb-fp', style: { left: (s.N + i) * M.pw + 'px', width: M.pw + 'px', height: M.H + 'px' } },
        h('div', { class: 'nb-rule', style: { left: M.px + 'px', right: M.px + 'px', top: M.py + 'px', height: Math.floor(M.ch / LINE) * LINE + 'px' } }),
        h('div', { class: 'nb-txt' }),
        h('button', { class: 'nb-fp-x', type: 'button', title: 'Xoá trang này', 'aria-label': 'Xoá trang này', onclick: () => delPage(s, i) }, '✕'),
        h('span', { class: 'nb-fp-n' }, String(s.N + i + 1)),
      );
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.nb-pi,.nb-fp-x')) return;
        select(s, null);
        tapAt = { x: e.clientX, y: e.clientY };
      });
      el.addEventListener('pointerup', (e) => {
        const t = tapAt;
        tapAt = null;
        if (!t || e.target.closest('.nb-pi,.nb-fp-x')) return;
        if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 9) clickPage(s, i, e);
      });
      s.track.append(el);
      return { el, pg };
    });
    const live = new Set();
    s.pages.forEach(({ el, pg }, i) => pg.photos.forEach((ph) => {
      live.add(ph.id);
      let pe = s.pe.get(ph.id);
      if (!pe) s.pe.set(ph.id, (pe = makePhoto(s, ph)));
      el.append(pe);
      placePhoto(pe, ph);
    }));
    [...s.pe.keys()].forEach((k) => !live.has(k) && (s.pe.get(k).remove(), s.pe.delete(k)));
    paintText(s);
    if (s.sel && !live.has(s.sel)) s.sel = null;
    [...s.pe].forEach(([k, pe]) => pe.classList.toggle('sel', k === s.sel));
  }

  function rectOf(ph) {
    const w = ph.w * M.pw, hh = w * ph.ar, r = (ph.r * Math.PI) / 180;
    const bw = Math.abs(w * Math.cos(r)) + Math.abs(hh * Math.sin(r));
    const bh = Math.abs(w * Math.sin(r)) + Math.abs(hh * Math.cos(r));
    const cx = ph.x * M.pw + w / 2, cy = ph.y * M.H + hh / 2;
    return { x: cx - bw / 2 - M.px, y: cy - bh / 2 - M.py, w: bw, h: bh };
  }

  /* chia chữ thành các dòng, né các vùng có ảnh */
  function layoutText(s, doc) {
    const { cw, ch } = M;
    const L = Math.max(1, Math.floor(ch / LINE));
    const obs = doc.pages.map((pg) => pg.photos.map(rectOf));
    const out = doc.pages.map(() => []);
    s.over = false;
    const segs = (p, line) => {
      const top = line * LINE, bot = top + LINE;
      const bl = (obs[p] || []).filter((r) => r.y < bot && r.y + r.h > top).map((r) => [r.x - PAD, r.x + r.w + PAD]).sort((a, b) => a[0] - b[0]);
      const res = [];
      let cur = 0;
      for (const [a, b] of bl) {
        if (a > cur) res.push([cur, Math.min(a, cw)]);
        cur = Math.max(cur, b);
      }
      if (cur < cw) res.push([cur, cw]);
      return res.filter(([a, b]) => b - a >= MIN_SEG);
    };
    let p = 0, line = 0, si = 0, list = null;
    const runs = new Map();
    const ensure = () => {
      while (p >= doc.pages.length) {
        if (doc.pages.length >= MAX_PAGES) return false;
        doc.pages.push({ photos: [] });
        obs.push([]);
        out.push([]);
        s.grew = true;
      }
      list ||= segs(p, line);
      return true;
    };
    const nextLine = () => {
      line++;
      if (line >= L) { p++; line = 0; }
      list = null;
      si = 0;
    };
    const text = doc.text || '';
    if (text.trim()) {
      let off = 0, first = true, stop = false;
      for (const para of text.split('\n')) {
        if (stop) break;
        if (!first) nextLine();
        first = false;
        const re = /\S+/g;
        let m;
        while ((m = re.exec(para))) {
          let word = m[0], wo = off + m.index;
          for (;;) {
            if (!ensure()) { stop = true; s.over = true; break; }
            const seg = list[si];
            if (!seg) { nextLine(); continue; }
            const segW = seg[1] - seg[0];
            const key = p + ':' + line + ':' + si;
            const run = runs.get(key);
            const joined = run ? run.text + ' ' + word : word;
            if (W(joined) <= segW) {
              if (run) run.text = joined;
              else { const r = { x: seg[0], line, text: word, off: wo }; runs.set(key, r); out[p].push(r); }
              break;
            }
            if (!run && W(word) > segW) { // từ quá dài: cắt theo ký tự
              let k = 1;
              while (k < word.length && W(word.slice(0, k + 1)) <= segW) k++;
              const r = { x: seg[0], line, text: word.slice(0, k), off: wo };
              runs.set(key, r);
              out[p].push(r);
              word = word.slice(k);
              wo += k;
              si++;
              if (!word) break;
              continue;
            }
            si++;
          }
        }
        off += para.length + 1;
      }
    }
    s.lines = out;
  }

  function paintText(s) {
    const doc = docOf(s.id);
    s.pages.forEach(({ el, pg }, i) => {
      const layer = $('.nb-txt', el);
      const kids = (s.lines[i] || []).map((r) => h('div', { class: 'nb-ln', style: { left: M.px + r.x + 'px', top: M.py + r.line * LINE + 'px' } }, r.text));
      if (i === 0 && !doc.text.trim() && !pg.photos.length) kids.push(h('div', { class: 'nb-ln nb-hintln', style: { left: M.px + 'px', top: M.py + 'px' } }, 'Viết một điều nhỏ xinh của hai mình vào đây nhé ♡'));
      layer.replaceChildren(...kids);
    });
    paintCaret(s);
  }

  /* ───── con trỏ & gõ chữ ngay trên trang ───── */
  const linesPerPage = () => Math.max(1, Math.floor(M.ch / LINE));

  function caretSpot(s) {
    if (document.activeElement !== area || s.id !== active) return null;
    const doc = docOf(s.id), c = area.selectionStart, L = linesPerPage();
    const runs = [];
    (s.lines || []).forEach((ls, i) => ls.forEach((r) => runs.push({ r, gl: i * L + r.line })));
    let last = null;
    for (const q of runs) if (q.r.off <= c) last = q;
    let gl, x = 0;
    if (last && c <= last.r.off + last.r.text.length) {
      gl = last.gl;
      x = last.r.x + W(last.r.text.slice(0, c - last.r.off));
    } else if (last) {
      const between = doc.text.slice(last.r.off + last.r.text.length, c);
      const nl = (between.match(/\n/g) || []).length;
      if (!nl) { gl = last.gl; x = last.r.x + W(last.r.text) + W(' ') * between.length; }
      else gl = last.gl + nl;
    } else gl = (doc.text.slice(0, c).match(/\n/g) || []).length;
    const pi = Math.floor(gl / L);
    if (pi >= s.pages.length) return null;
    return { pi, line: gl % L, x: Math.min(x, M.cw) };
  }

  function paintCaret(s) {
    $$('.nb-caret', frame).forEach((e) => e.remove());
    const sp = caretSpot(s);
    if (!sp) return;
    s.pages[sp.pi].el.append(h('div', { class: 'nb-caret', style: { left: M.px + sp.x + 'px', top: M.py + sp.line * LINE + 4 + 'px' } }));
    // ô nhập vô hình đi theo con trỏ (để bộ gõ tiếng Việt hiện đúng chỗ)
    area.style.left = (s.N + sp.pi) * M.pw + M.px + sp.x - s.cur * M.per * M.pw + 'px';
    area.style.top = M.py + sp.line * LINE + 'px';
  }

  // bấm lên trang: tìm vị trí chữ gần nhất rồi cho gõ luôn
  function clickPage(s, pi, e) {
    const doc = docOf(s.id), L = linesPerPage();
    const r = s.pages[pi].el.getBoundingClientRect();
    const x = e.clientX - r.left - M.px;
    const line = Math.min(L - 1, Math.max(0, Math.floor((e.clientY - r.top - M.py) / LINE)));
    const g = pi * L + line;
    const runs = [];
    (s.lines || []).forEach((ls, i) => ls.forEach((q) => runs.push({ r: q, gl: i * L + q.line })));
    let caret, pad = 0;
    const here = runs.filter((q) => q.gl === g);
    if (here.length) {
      let best = here[0], bd = Infinity;
      here.forEach((q) => {
        const w = W(q.r.text), d = x < q.r.x ? q.r.x - x : x > q.r.x + w ? x - q.r.x - w : 0;
        if (d < bd) (bd = d), (best = q);
      });
      const q = best.r;
      let k = 0;
      while (k < q.text.length && q.x + W(q.text.slice(0, k + 1)) - W(q.text.charAt(k)) / 2 < x) k++;
      caret = q.off + k;
    } else {
      const prev = [...runs].reverse().find((q) => q.gl < g);
      const next = runs.find((q) => q.gl > g);
      // đi qua các dòng trống (mỗi dòng trống là một ký tự xuống hàng) tới đúng dòng đã bấm
      const through = (from, fromGl, toOff) => {
        const nl = (doc.text.slice(from, toOff).match(/\n/g) || []).length;
        let pos = from;
        for (let n = Math.min(g - fromGl, nl); n > 0; n--) pos = doc.text.indexOf('\n', pos) + 1;
        return pos;
      };
      if (prev && next) caret = through(prev.r.off + prev.r.text.length, prev.gl, next.r.off);
      else if (prev) { caret = doc.text.length; pad = g - prev.gl; }
      else if (next) caret = through(0, 0, next.r.off);
      else { caret = 0; pad = g; }
    }
    if (pad > 0) { doc.text += '\n'.repeat(pad); caret = doc.text.length; }
    area.value = doc.text;
    area.focus({ preventScroll: true });
    area.setSelectionRange(caret, caret);
    if (pad > 0) relayoutText(s);
    paintCaret(s);
  }

  function trimTail() {
    const s = st[active];
    if (!s) return;
    const doc = docOf(s.id), t = doc.text.replace(/\n+$/, '');
    if (t !== doc.text) { doc.text = t; area.value = t; relayoutText(s); save(s); }
  }

  function relayoutText(s) {
    const doc = docOf(s.id);
    s.grew = false;
    layoutText(s, doc);
    if (s.grew) return buildFree(s), refresh(s);
    paintText(s);
  }

  /* ───── ảnh dán ───── */
  function makePhoto(s, ph) {
    const img = h('img', { src: mu(ph.key), alt: '', draggable: false });
    const el = h('div', { class: 'nb-pi' }, h('span', { class: 'nb-tape' }), img, Deco.tiny([...ph.id].reduce((a, c) => a + c.charCodeAt(0), 0)));
    el.addEventListener('pointerdown', (e) => drag(e, s, ph, el));
    return el;
  }

  function placePhoto(el, ph) {
    const w = ph.w * M.pw;
    Object.assign(el.style, { left: ph.x * M.pw + 'px', top: ph.y * M.H + 'px', width: w + 'px', height: w * ph.ar + 'px', transform: `rotate(${ph.r}deg)`, zIndex: 2 + (ph.z || 0) });
  }

  const findPhoto = (s, id) => { for (const p of docOf(s.id).pages) { const ph = p.photos.find((x) => x.id === id); if (ph) return [ph, p]; } return [null, null]; };

  function select(s, id) {
    if (s.sel !== id) {
      s.sel = id;
      s.pe.forEach((pe, k) => pe.classList.toggle('sel', k === id));
    }
    if (photoBar) photoBar.hidden = !(s.id === active && s.sel);
  }
  const selPhoto = () => { const s = st[active]; if (!s || !s.sel) return []; const [ph] = findPhoto(s, s.sel); return [s, ph]; };
  // thay đổi ảnh đang chọn từ thanh nút dưới sổ
  function tweak(fn) {
    const [s, ph] = selPhoto();
    if (!ph) return;
    fn(ph);
    placePhoto(s.pe.get(ph.id), ph);
    relayoutText(s);
    save(s);
  }

  function front(s, ph) {
    ph.z = Math.max(0, ...docOf(s.id).pages.flatMap((p) => p.photos.map((x) => x.z || 0))) + 1;
    placePhoto(s.pe.get(ph.id), ph);
    save(s);
  }

  function drag(e, s, ph, el) {
    e.preventDefault();
    select(s, ph.id);
    const doc = docOf(s.id);
    let pgIdx = doc.pages.findIndex((p) => p.photos.includes(ph));
    const rect0 = s.pages[pgIdx].el.getBoundingClientRect();
    const gx = (e.clientX - rect0.left) / M.pw - ph.x, gy = (e.clientY - rect0.top) / M.H - ph.y;
    let moved = false;
    const onMove = (ev) => {
      moved = true;
      let target = pgIdx;
      s.pages.forEach((p, i) => {
        const r = p.el.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) target = i;
      });
      if (target !== pgIdx) {
        doc.pages[pgIdx].photos.splice(doc.pages[pgIdx].photos.indexOf(ph), 1);
        doc.pages[target].photos.push(ph);
        s.pages[target].el.append(el);
        pgIdx = target;
      }
      const r = s.pages[pgIdx].el.getBoundingClientRect();
      ph.x = Math.min(0.95 - ph.w * 0.3, Math.max(-ph.w * 0.7, (ev.clientX - r.left) / M.pw - gx));
      ph.y = Math.min(0.97, Math.max(-0.1, (ev.clientY - r.top) / M.H - gy));
      placePhoto(el, ph);
      cancelAnimationFrame(drag.raf);
      drag.raf = requestAnimationFrame(() => relayoutText(s));
    };
    const onUp = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      if (moved) { relayoutText(s); save(s); }
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
  }

  async function removePhoto(s, id) {
    const [ph, pg] = findPhoto(s, id);
    if (!ph) return;
    pg.photos.splice(pg.photos.indexOf(ph), 1);
    s.sel = null;
    select(s, null);
    buildFree(s);
    refresh(s);
    save(s);
  }

  function editPhoto(s, ph) {
    openEditor({
      src: mu(ph.key),
      onDone: async (blob, w, hh) => {
        try {
          ph.key = await uploadBlob(blob);
          ph.ar = hh / w;
          s.pe.get(ph.id)?.querySelector('img')?.setAttribute('src', mu(ph.key));
          placePhoto(s.pe.get(ph.id), ph);
          relayoutText(s);
          save(s);
        } catch (e) { toast(e.message); }
      },
    });
  }

  function pickPhoto() { document.getElementById('nbFile').click(); }

  async function addPhoto(file) {
    const s = st[active];
    if (!s || !file.type.startsWith('image/')) return;
    const note = toast('Đang dán ảnh…', 60000);
    try {
      const p = await prepImage(file, 1600);
      const key = await uploadBlob(p.blob);
      const doc = docOf(s.id);
      if (!doc.pages.length) doc.pages.push({ photos: [] });
      // ưu tiên trang tự do đang hiện trên màn hình
      const first = s.cur * M.per;
      let idx = doc.pages.findIndex((_, i) => s.N + i >= first && s.N + i < first + M.per);
      if (idx < 0) idx = 0;
      const ph = { id: uid(), key, x: 0.22 + Math.random() * 0.12, y: 0.12 + Math.random() * 0.15, w: M.spread ? 0.42 : 0.5, ar: p.h / p.w, r: Math.round(rnd(-5, 5)), z: 0 };
      doc.pages[idx].photos.push(ph);
      buildFree(s);
      front(s, ph);
      select(s, ph.id);
      const target = Math.floor((s.N + idx) / M.per);
      refresh(s);
      if (target !== s.cur) showSpread(s, target);
      save(s);
    } catch (e) { toast(e.message); } finally { note.remove(); }
  }

  function addPage() {
    const s = st[active];
    if (!s) return;
    const doc = docOf(s.id);
    if (doc.pages.length >= MAX_PAGES) return toast('Đã đủ số trang tối đa của chương này');
    doc.pages.push({ photos: [] });
    buildFree(s);
    refresh(s);
    showSpread(s, Math.floor((s.N + doc.pages.length - 1) / M.per));
    save(s);
  }

  async function delPage(s, i) {
    const doc = docOf(s.id);
    const has = doc.pages[i].photos.length;
    if (!(await confirmBox(has ? 'Xoá trang này cùng những ảnh đã dán?' : 'Xoá trang trống này?'))) return;
    doc.pages.splice(i, 1);
    s.sel = null;
    buildFree(s);
    refresh(s);
    save(s);
  }

  /* ───── nhập chữ ───── */
  function onType() {
    const s = st[active];
    const doc = docOf(s.id);
    doc.text = area.value;
    s.grew = false;
    cancelAnimationFrame(onType.raf);
    onType.raf = requestAnimationFrame(() => {
      relayoutText(s);
      // đi theo con trỏ: lật tới trang đang viết
      const pos = area.selectionStart;
      let pageIdx = -1;
      (s.lines || []).forEach((ls, i) => ls.forEach((r) => r.off <= pos && (pageIdx = i)));
      if (pageIdx >= 0) {
        const target = Math.floor((s.N + pageIdx) / M.per);
        if (target !== s.cur) showSpread(s, target);
      }
      refresh(s);
      paintCaret(s);
    });
    save(s);
  }

  /* ───── lưu ───── */
  function save(s) {
    s.dirty = true;
    saveNote.textContent = 'Đang lưu…';
    clearTimeout(s.timer);
    s.timer = setTimeout(() => flushOne(s), 900);
  }
  async function flushOne(s) {
    if (!s.dirty) return;
    s.dirty = false;
    clearTimeout(s.timer);
    try {
      await api('notebook/' + s.id, { method: 'PUT', body: { data: docOf(s.id) } });
      saveNote.textContent = 'Đã lưu';
      setTimeout(() => saveNote.textContent === 'Đã lưu' && (saveNote.textContent = ''), 1800);
    } catch (e) {
      s.dirty = true;
      saveNote.textContent = 'Chưa lưu được';
      toast(e.message);
    }
  }
  function flush() { Object.values(st).forEach((s) => s.dirty && flushOne(s)); }

  /* ───── API ngoài ───── */
  return {
    build,
    // nạp dữ liệu từ máy chủ (không ghi đè phần đang sửa dở)
    load(nb) {
      order.forEach((id) => {
        if (st[id]?.dirty) return;
        const d = nb?.[id];
        docs[id] = d && Array.isArray(d.pages) ? { text: d.text || '', pages: d.pages.map((p) => ({ photos: p.photos || [] })) } : docs[id] || { text: '', pages: [] };
        if (!docs[id].pages.length) docs[id].pages = [{ photos: [] }, { photos: [] }];
      });
      schedule(true);
    },
    open(id) {
      if (!st[id]) return;
      flush();
      active = id;
      if (photoBar) photoBar.hidden = true;
      Object.values(st).forEach((s) => s.el.classList.toggle('on', s.id === id));
      area.blur();
      requestAnimationFrame(() => {
        metrics();
        Object.values(st).forEach((x) => relayout(x, true));
        refresh(st[id]);
        select(st[id], st[id].sel);
      });
    },
    schedule,
    flush,
  };
})();
