# Our Little World 🌸

Website lưu giữ kỷ niệm cho hai người — phong cách Romantic · Minimalist · Soft & Dreamy.
Chạy hoàn toàn trên **Cloudflare** (miễn phí cho nhu cầu cá nhân):

| Thành phần | Dùng để |
|---|---|
| **Workers** (+ static assets) | Host giao diện (`public/`) và API (`functions/api/[[path]].js`, điểm vào `src/worker.js`) |
| **D1** | Database (ảnh bìa, cột mốc, thư, bài hát, ngày đặc biệt…) |
| **R2** *(tuỳ chọn)* | Lưu video, nhạc và ảnh chất lượng cao. Không có R2 thì ảnh được lưu trong D1 (tự nén ≤ ~1,2MB, chưa hỗ trợ video/nhạc tải lên) |

## 9 khu vực
Home (đếm thời gian bên nhau, câu nói đổi mỗi lần vào) · Our Story · Memories (Polaroid, lightbox, tìm theo ngày) · Love Letters (phong bì, thư riêng tư, thư hẹn ngày) · Our Playlist (Spotify/YouTube + nhạc nền) · Special Days (countdown, nhắc nhở) · Bucket List · Little Things · Surprise (hộp quà, thư tương lai, ảnh ẩn, trang kỷ niệm).

**Trình trang trí ảnh:** khung (Polaroid, vòm, trái tim, phim…), bộ lọc, nhãn dán, washi tape, chữ, vẽ tay (bút / bút dạ / tẩy) hoặc vẽ trên giấy trắng.

## Cài đặt trên Cloudflare (không cần thẻ, không cần R2)

Project chạy như một **Worker** (giao diện tĩnh + API trong cùng một Worker), deploy tự động từ GitHub.

1. *(Bỏ qua)* Không cần tạo D1 thủ công: lần deploy đầu wrangler tự tạo database `little-world-db` và gắn vào biến `DB`; bảng tự được tạo ở lần truy cập đầu tiên.
2. **Worker:** Workers & Pages → Create application → Import a repository → chọn repo này.
   - Root directory: để mặc định (`/`)
   - Build command: *(để trống)* · Deploy command: `npx wrangler deploy`
3. Sau khi deploy xong, vào Worker → **Settings → Variables and secrets** → thêm 3 **Secret**: `PASS_A`, `PASS_B` (mật mã mỗi người; đặt giống nhau nếu dùng chung) và `SESSION_SECRET` (chuỗi ngẫu nhiên dài). Lưu rồi deploy lại (Deployments → Retry) nếu cần.
4. Mở địa chỉ `xxx.workers.dev`, đăng nhập, vào ⚙ để đặt tên hai người và ngày yêu nhau.

*(Tuỳ chọn)* Bật R2, tạo bucket `our-little-world-media`, bỏ comment khối `[[r2_buckets]]` trong `wrangler.toml` để tải được video/nhạc và ảnh chất lượng cao.

## Chạy thử trên máy

```bash
cp .dev.vars.example .dev.vars
# (đặt tạm database_id bất kỳ trong wrangler.toml khi chạy cục bộ)
npm run dev           # http://localhost:8788 — bảng D1 cục bộ tự được tạo
```

## Bảo mật
- Đăng nhập bằng mật mã, cookie `HttpOnly`, chặn dò mật mã (8 lần sai / 15 phút).
- Thư riêng tư chỉ người viết thấy; thư/lời nhắn hẹn ngày được **ẩn nội dung từ phía máy chủ** đến đúng ngày.
- Ảnh/video chỉ truy cập được khi đã đăng nhập.
- Giới hạn: không có R2 → ảnh ≤ ~1,5MB (tự nén). Có R2 → ảnh 15MB, video 60MB, nhạc 25MB.
