---
name: taivideonhanh
description: Dùng khi người dùng muốn tải video từ TikTok/Bilibili/Xiaohongshu/Douyin..., xử lý video (dịch, viết lại kịch bản, lồng tiếng Việt bằng TTS), dịch ảnh, chuyển link Shopee affiliate, hoặc chạy/phát triển/triển khai dự án web taivideonhanh (backend FastAPI + frontend React/Vite).
---

# Hướng dẫn sử dụng taivideonhanh

## 1. Cài đặt & kiểm tra môi trường
- Kiểm tra thư mục `~/taivideonhanh` (hoặc `C:\tools\taivideonhanh`) đã tồn tại chưa.
- Nếu chưa có: `git clone https://github.com/inoryyyyyyyy/taivideonhanh.git`
- Backend (Python 3.10+): `cd backend && pip install fastapi uvicorn requests yt-dlp python-dotenv` (cài thêm các thư viện mà `import` trong `main.py`, `scraper.py`, `video_processor.py` yêu cầu). Cần `ffmpeg` trong PATH.
- Frontend (Node 18+): `cd frontend && npm install`
- Biến môi trường: tạo `backend/.env` và `frontend/.env` (file `.env` KHÔNG có trong repo). Thiếu khóa API (Supabase, Vbee TTS, Gemini/LLM, SePay, Resend...) thì hỏi người dùng, tuyệt đối không tự bịa.

## 2. Chức năng & cách chạy
### A. Chạy backend
- Khi dùng: cần API tải/xử lý video.
- Lệnh: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
- API chính: `POST /api/info` (lấy thông tin video từ URL), `POST /api/process` (xử lý video: dịch/lồng tiếng), `GET /api/status/{job_id}`, `GET /api/download_video/{job_id}`, `GET /api/voices`, `POST /api/preview_script`, `POST /api/rewrite-script`.

### B. Dịch ảnh
- `POST /api/translate_image`, `POST /api/translate_images_batch`, `POST /api/download_images_zip`.

### C. Chuyển link Shopee
- `POST /api/convert_shopee_links` (logic ở `backend/shopee_converter.py`).

### D. Chạy / build frontend
- Dev: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build` (output `frontend/dist`).

## 3. Cấu trúc
- `backend/main.py`: các route FastAPI; `scraper.py`: lấy dữ liệu từng nền tảng; `video_processor.py`: xử lý video/TTS; `fb_capi.py`: Facebook CAPI; `vi_voices.json`: danh sách giọng.
- `frontend/src`: giao diện React + Vite + Tailwind + Supabase.

## 4. Lưu ý & xử lý lỗi
- Lỗi tải Bilibili HTTP 412 hoặc TikTok bị chặn vùng: cần header/cookie hợp lệ hoặc chạy trên máy chủ ở khu vực phù hợp; xem `scraper.py`.
- Không commit `.env`, `node_modules`, mật khẩu/SSH key.
- Không chạy lệnh trên VPS production (restart, xóa dữ liệu, đổi cấu hình) khi chưa hỏi xác nhận người dùng.
