# Facebook Page API Backend

## 1) Chuẩn bị (Phần 1)

### 1.1 Tạo Facebook Page
1. Vào Facebook > tạo Page mới.
2. Đặt tên Page theo đề bài (ví dụ: `TranThanhNgan Demo Page`).
3. Sau khi tạo, vào `About` hoặc `Page transparency` để lấy `Page ID`.

Screenshot cần nộp:
- Ảnh hiển thị tên Page + Page ID.

### 1.2 Tạo Facebook App (Meta for Developers)
1. Vào https://developers.facebook.com/
2. Chọn `My Apps` > `Create App`.
3. Chọn loại app phù hợp (thông thường: `Business`).
4. Thêm sản phẩm `Facebook Login` và `Graph API` (nếu cần).

Screenshot cần nộp:
- Ảnh Dashboard của app (có App Name + App ID).

### 1.3 Lấy Page Access Token
1. Dùng Graph API Explorer hoặc Facebook Login flow để lấy User Token.
2. Exchange sang long-lived user token (nếu cần).
3. Lấy Page token từ endpoint `/{pageId}?fields=access_token` hoặc qua công cụ quản lý token.
4. Đảm bảo token có các quyền:
- `pages_manage_posts`
- `pages_read_engagement`
- `pages_read_user_content`
- `read_insights`

Screenshot cần nộp:
- Ảnh token (có thể che bớt token cho an toàn) + danh sách permissions.

## 2) API Backend (Phan 2)

Project đã triển khai đủ các endpoint:
- `GET /api/page/{pageId}`
- `GET /api/page/{pageId}/posts`
- `POST /api/page/{pageId}/posts`
- `DELETE /api/page/post/{postId}`
- `GET /api/page/post/{postId}/comments`
- `GET /api/page/post/{postId}/likes`
- `GET /api/page/{pageId}/insights`

## 3) Cài đặt và chạy

### 3.1 Cài dependency
```bash
npm install
```

### 3.2 Tạo file `.env`
Tạo file `.env` từ `.env.example`:
```env
PORT=3000
GRAPH_API_VERSION=v23.0
PAGE_ACCESS_TOKEN=YOUR_PAGE_ACCESS_TOKEN
```

### 3.3 Chạy server
```bash
npm start
```

Server mặc định chạy tại: `http://localhost:3000`

Swagger UI: `http://localhost:3000/docs`

## 4) Test nhanh bằng curl

### GET page info
```bash
curl http://localhost:3000/api/page/{pageId}
```

### GET page posts
```bash
curl "http://localhost:3000/api/page/{pageId}/posts?limit=5"
```

### POST tạo bài viết
```bash
curl -X POST http://localhost:3000/api/page/{pageId}/posts \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from API"}'
```

### DELETE bài viết
```bash
curl -X DELETE http://localhost:3000/api/page/post/{postId}
```

### GET comments của bài viết
```bash
curl "http://localhost:3000/api/page/post/{postId}/comments?limit=10"
```

### GET likes của bài viết
```bash
curl "http://localhost:3000/api/page/post/{postId}/likes?limit=25"
```

### GET page insights
```bash
curl "http://localhost:3000/api/page/{pageId}/insights"
```

## 5) Cấu trúc project

- `src/server.js`: Khởi tạo Express app.
- `src/routes/pageRoutes.js`: Định nghĩa các API route.
- `src/services/facebookService.js`: Gọi Facebook Graph API.
