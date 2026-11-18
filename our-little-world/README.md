# Our Little World 🌸

Website lưu giữ kỷ niệm cho hai người — phong cách Romantic · Minimalist · Soft & Dreamy.
Chạy hoàn toàn trên **Cloudflare** (miễn phí cho nhu cầu cá nhân):

| Thành phần | Dùng để |
|---|---|
| **Pages** | Host giao diện (`public/`) |
| **Pages Functions** | API (`functions/api/[[path]].js`) |
| **D1** | Database (ảnh bìa, cột mốc, thư, bài hát, ngày đặc biệt…) |
| **R2** *(tuỳ chọn)* | Lưu video, nhạc và ảnh chất lượng cao. Không có R2 thì ảnh được lưu trong D1 (tự nén ≤ ~1,2MB, chưa hỗ trợ video/nhạc tải lên) |

## 9 khu vực
Home (đếm thời gian bên nhau, câu nói đổi mỗi lần vào) · Our Story · Memories (Polaroid, lightbox, tìm theo ngày) · Love Letters (phong bì, thư riêng tư, thư hẹn ngày) · Our Playlist (Spotify/YouTube + nhạc nền) · Special Days (countdown, nhắc nhở) · Bucket List · Little Things · Surprise (hộp quà, thư tương lai, ảnh ẩn, trang kỷ niệm).

**Trình trang trí ảnh:** khung (Polaroid, vòm, trái tim, phim…), bộ lọc, nhãn dán, washi tape, chữ, vẽ tay (bút / bút dạ / tẩy) hoặc vẽ trên giấy trắng.

## Cài đặt trên Cloudflare (không cần thẻ, không cần R2)

> ⚠️ Phải tạo **Pages** (đuôi `.pages.dev`), **không phải Worker**. Nếu log build có dòng `npx wrangler deploy` nghĩa là đã tạo nhầm Worker.

1. **D1:** Storage & Databases → D1 → Create database `our-little-world` → tab **Console** → dán toàn bộ `schema.sql` → Run.
2. **Pages:** Workers & Pages → Create application → dòng nhỏ **"Looking to deploy Pages? Get started"** → Import an existing Git repository → chọn repo này.
   - Root directory: `our-little-world` (bỏ trống nếu code nằm ở thư mục gốc)
   - Build command: *(để trống)* · Build output directory: `public`
3. **Settings → Bindings → Add → D1 database:** Variable name `DB`, chọn database ở bước 1.
4. **Settings → Variables and secrets:** thêm `PASS_A`, `PASS_B` (mật mã của mỗi người; đặt giống nhau nếu dùng chung) và `SESSION_SECRET` (chuỗi ngẫu nhiên dài). Chọn kiểu *Secret*.
5. **Deployments → Retry deployment.**

*(Tuỳ chọn)* Bật R2, tạo bucket, rồi thêm binding **R2 bucket** tên `BUCKET` để tải được video/nhạc và ảnh chất lượng cao.

Deploy bằng CLI thay vì Git: xem `wrangler.toml.example`, đổi tên thành `wrangler.toml`, điền `database_id`, rồi `npm run deploy`.

## Chạy thử trên máy

```bash
cp .dev.vars.example .dev.vars
cp wrangler.toml.example wrangler.toml   # điền database_id bất kỳ khi chạy cục bộ
npm run db:local      # tạo bảng trong D1 cục bộ
npm run dev           # http://localhost:8788
```

## Bảo mật
- Đăng nhập bằng mật mã, cookie `HttpOnly`, chặn dò mật mã (8 lần sai / 15 phút).
- Thư riêng tư chỉ người viết thấy; thư/lời nhắn hẹn ngày được **ẩn nội dung từ phía máy chủ** đến đúng ngày.
- Ảnh/video chỉ truy cập được khi đã đăng nhập.
- Giới hạn: không có R2 → ảnh ≤ ~1,5MB (tự nén). Có R2 → ảnh 15MB, video 60MB, nhạc 25MB.
