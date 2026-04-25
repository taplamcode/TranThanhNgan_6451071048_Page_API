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

## 5) Bài 2: Webhook và Kafka (Real-time Processing)

### 5.1 Cài đặt biến môi trường
Mở file `.env` và cấu hình các thông số sau:
```env
FACEBOOK_VERIFY_TOKEN=thanhngan
FACEBOOK_APP_SECRET=your_app_secret
KAFKA_CLIENT_ID=page-api-webhook
KAFKA_BROKERS=localhost:9092
```

### 5.2 Chạy hệ thống bằng Docker
Khởi động Kafka và Webhook Service:
```bash
docker compose up --build -d
```
Server Webhook sẽ chạy ở cổng `3001`.

### 5.3 Expose Webhook bằng Ngrok
Dùng Ngrok để cung cấp đường dẫn HTTPS cho Facebook:
```bash
ngrok http 3001
```
Copy đường dẫn ngrok (ví dụ: `https://your-ngrok-url.ngrok-free.dev/webhook`).

### 5.4 Cấu hình Facebook Webhooks
1. Vào Developer Dashboard > **Webhooks**.
2. Chọn **Page** trong menu xổ xuống.
3. Nhấn **Subscribe to this object**.
4. Điền Callback URL: `https://your-ngrok-url.ngrok-free.dev/webhook`
5. Verify Token: `thanhngan`
6. Nhấn **Verify and Save**.
7. Tìm event `feed` (để nhận bình luận, bài viết) và `messages` (để nhận tin nhắn) > Bấm **Subscribe**.

### 5.5 Kiểm tra luồng dữ liệu
1. Lên trang Facebook Page của bạn, thử **bình luận (comment)** vào một bài viết bất kỳ.
2. Kiểm tra log của Webhook service:
```bash
docker logs -f page-api-webhook-service
```
*(Bạn sẽ thấy log in ra payload đã được chuẩn hóa (normalize) và dòng "Published event to Kafka topic raw_events")*

3. Đọc dữ liệu từ topic `raw_events` trong Kafka:
```bash
docker exec -it page-api-kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic raw_events --from-beginning
```
*(Bạn sẽ thấy JSON chuẩn hóa chứa thông tin comment vừa tạo)*
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

## 6) Bài 2 - Webhook + Kafka (Realtime)

Đã bổ sung `webhook-service` chạy riêng ở port `3001` để:
- Nhận webhook từ Facebook tại endpoint `/webhook`
- Verify request bằng `x-hub-signature-256`
- Normalize payload về schema chuẩn
- Publish sự kiện vào Kafka topic `raw_events`

### 6.1 Biến môi trường cần thêm

```env
WEBHOOK_PORT=3001
FACEBOOK_VERIFY_TOKEN=my_verify_token
FACEBOOK_APP_SECRET=YOUR_FACEBOOK_APP_SECRET
WEBHOOK_SKIP_SIGNATURE=false

KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=raw_events
KAFKA_CLIENT_ID=webhook-service
KAFKA_CONNECT_RETRIES=10
KAFKA_CONNECT_RETRY_DELAY_MS=2000
```

### 6.2 Chạy nhanh bằng Docker Compose

```bash
docker compose up --build -d
```

Service sau khi chạy:
- Webhook service: `http://localhost:3001`
- Health check: `GET http://localhost:3001/health`

### 6.3 Verify webhook endpoint (GET)

```bash
curl "http://localhost:3001/webhook?hub.mode=subscribe&hub.verify_token=my_verify_token&hub.challenge=123456"
```

Nếu token đúng, response trả về `123456`.

### 6.4 Test webhook POST local (không cần chữ ký)

Trong `.env`, tạm đặt:

```env
WEBHOOK_SKIP_SIGNATURE=true
```

Sau đó gửi thử payload:

```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [
      {
        "id": "123456789",
        "time": 1714046400,
        "changes": [
          {
            "field": "feed",
            "value": {
              "item": "comment",
              "verb": "add",
              "post_id": "123_456",
              "comment_id": "789",
              "message": "Xin chao"
            }
          }
        ]
      }
    ]
  }'
```

Kết quả mong đợi: API trả `accepted`, và event đã được đẩy vào topic `raw_events`.

### 6.5 Đọc dữ liệu trong topic `raw_events`

```bash
docker exec -it page-api-kafka kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic raw_events \
  --from-beginning
```

### 6.6 Chạy webhook service không dùng Docker

1) Chạy Kafka local (hoặc vẫn dùng `docker compose up -d kafka`)

2) Chạy service:

```bash
npm run start:webhook
```
