// Điểm vào của Cloudflare Worker: phục vụ file tĩnh (public/) và API (/api/*)
import { onRequest } from '../functions/api/[[path]].js';
import { SCHEMA } from './schema.js';

let ready = null;

// Tạo bảng nếu chưa có. Thử cả lô trước; nếu lỗi thì chạy từng lệnh để biết lệnh nào hỏng.
async function initSchema(env) {
  try {
    await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
    return;
  } catch (first) {
    const failed = [];
    for (const s of SCHEMA) {
      try {
        await env.DB.prepare(s).run();
      } catch (e) {
        failed.push(`${s.slice(0, 40)}… → ${e.message || e}`);
      }
    }
    if (failed.length) throw new Error(`${first.message || first} | ${failed.join(' ; ')}`);
  }
}
const ensureSchema = (env) => (ready ||= initSchema(env).catch((e) => ((ready = null), Promise.reject(e))));

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      if (env.DB) {
        try {
          await ensureSchema(env); // tự tạo bảng, không cần chạy schema.sql thủ công
        } catch (e) {
          console.error('schema', e);
          return Response.json({ error: 'Không khởi tạo được database.', detail: String(e.message || e).slice(0, 600) }, { status: 500 });
        }
      }
      return onRequest({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
