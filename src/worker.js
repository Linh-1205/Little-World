// Điểm vào của Cloudflare Worker: phục vụ file tĩnh (public/) và API (/api/*)
import { onRequest } from '../functions/api/[[path]].js';
import { SCHEMA } from './schema.js';

let ready = null;
const ensureSchema = (env) => (ready ||= env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => ((ready = null), Promise.reject(e))));

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      if (env.DB) {
        try {
          await ensureSchema(env); // tự tạo bảng, không cần chạy schema.sql thủ công
        } catch (e) {
          console.error('schema', e);
          return Response.json({ error: 'Không khởi tạo được database.' }, { status: 500 });
        }
      }
      return onRequest({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
