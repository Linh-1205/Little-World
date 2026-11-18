# Our Little World 🌸

Website lưu giữ kỷ niệm cho hai người — phong cách Romantic · Minimalist · Soft & Dreamy.
Chạy hoàn toàn trên **Cloudflare** (miễn phí cho nhu cầu cá nhân):

| Thành phần | Dùng để |
|---|---|
| **Pages** | Host giao diện (`public/`) |
| **Pages Functions** | API (`functions/api/[[path]].js`) |
| **D1** | Database (ảnh bìa, cột mốc, thư, bài hát, ngày đặc biệt…) |
| **R2** | Lưu ảnh, video, nhạc |

## 9 khu vực
Home (đếm thời gian bên nhau, câu nói đổi mỗi lần vào) · Our Story · Memories (Polaroid, lightbox, tìm theo ngày) · Love Letters (phong bì, thư riêng tư, thư hẹn ngày) · Our Playlist (Spotify/YouTube + nhạc nền) · Special Days (countdown, nhắc nhở) · Bucket List · Little Things · Surprise (hộp quà, thư tương lai, ảnh ẩn, trang kỷ niệm).

**Trình trang trí ảnh:** khung (Polaroid, vòm, trái tim, phim…), bộ lọc, nhãn dán, washi tape, chữ, vẽ tay (bút / bút dạ / tẩy) hoặc vẽ trên giấy trắng.

## Cài đặt (khoảng 5 phút)

```bash
npm install            # cài wrangler
npx wrangler login

# 1. Tạo database và bucket
npx wrangler d1 create our-little-world        # copy database_id dán vào wrangler.toml
npx wrangler r2 bucket create our-little-world-media
npx wrangler d1 execute our-little-world --remote --file=schema.sql

# 2. Tạo project Pages và deploy
npx wrangler pages project create our-little-world --production-branch main
npx wrangler pages deploy public --project-name our-little-world

# 3. Đặt mật mã (mỗi người một mật mã; đặt giống nhau nếu muốn dùng chung)
npx wrangler pages secret put PASS_A --project-name our-little-world
npx wrangler pages secret put PASS_B --project-name our-little-world
npx wrangler pages secret put SESSION_SECRET --project-name our-little-world   # chuỗi ngẫu nhiên dài
```

Sau đó deploy lại một lần (`npm run deploy`) để secret có hiệu lực. Binding `DB` và `BUCKET` đã khai báo trong `wrangler.toml`.

> Có thể kết nối repo này với Cloudflare Pages để tự deploy khi push. Khi đó nhớ thêm binding D1 (`DB`), R2 (`BUCKET`) và secret trong Settings → Functions của project.

## Chạy thử trên máy

```bash
cp .dev.vars.example .dev.vars
npm run db:local      # tạo bảng trong D1 cục bộ
npm run dev           # http://localhost:8788
```

## Bảo mật
- Đăng nhập bằng mật mã, cookie `HttpOnly`, chặn dò mật mã (8 lần sai / 15 phút).
- Thư riêng tư chỉ người viết thấy; thư/lời nhắn hẹn ngày được **ẩn nội dung từ phía máy chủ** đến đúng ngày.
- Ảnh/video chỉ truy cập được khi đã đăng nhập.
- Giới hạn: ảnh 15MB (tự thu nhỏ trước khi tải), video 60MB, nhạc 25MB.
