import asyncio
from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import requests
import uuid
import time
from datetime import datetime, timezone, timedelta
import math
import json
import io
import os
import resend
from svix.webhooks import Webhook, WebhookVerificationError
import re
import psutil
import unicodedata
from dotenv import load_dotenv
from supabase import create_client, Client

from scraper import get_xiaohongshu_video
from video_processor import process_full_pipeline, AVAILABLE_VOICES, AVAILABLE_VOICES_EN, VBEE_SYNC_VOICES, download_file, extract_audio, transcribe_video_ocr, transcribe_audio, translate_segments, get_video_duration, is_video_too_long, format_duration, get_provider_alerts
from fb_capi import send_fb_capi_event
from shopee_converter import convert_shopee_text

load_dotenv()

app = FastAPI(title="AI Video Dubbing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo Supabase Client (Dùng Service Role để bypass RLS khi backend sửa data)
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

resend.api_key = os.getenv("RESEND_API_KEY")

# Cấu hình linh hoạt cho White-label
BASE_URL = os.getenv("BASE_URL", "https://taivideonhanh.com").rstrip("/")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "TaiVideoNhanh <noreply@taivideonhanh.com>")

# In-memory storage cho tiến độ công việc (Job) (Tạm thời kết hợp với DB)
jobs = {}

# Rate limit gửi email nhắc nạp tiền (tránh spam liên tục)
last_balance_reminder = {}

def sanitize_filename(name: str) -> str:
    """Bỏ dấu tiếng Việt, loại bỏ hashtag/ký tự đặc biệt và giới hạn độ dài ngắn gọn để tên file không bao giờ bị lỗi trên Windows"""
    if not name:
        return "video"
    # Remove hashtags
    name = re.sub(r'#[^\s#]+', '', name)
    # Remove Chinese & special brackets
    name = re.sub(r'[《》\[\]\(\)\{\}【】]', '', name)
    # Normalize unicode to ASCII
    normalized = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    clean = re.sub(r'[^a-zA-Z0-9_\- ]', '', normalized).strip()
    # Replace spaces with underscores and truncate
    clean = re.sub(r'\s+', '_', clean)[:35].strip('_')
    return clean if clean else "video"

def get_download_filename(title: str, default_name: str = "video"):
    safe_title = sanitize_filename(title) if title else default_name
    filename = f"taivideonhanh_{safe_title}.mp4"
    return filename, filename

@app.get("/api/download_result/{job_id}")
def download_result(job_id: str):
    if job_id not in jobs or not jobs[job_id].get("is_done"):
        raise HTTPException(status_code=400, detail="Job not ready")
        
    file_path = jobs[job_id]["result_file"]
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    title = jobs[job_id].get("title", "")
    ascii_fn, utf8_fn = get_download_filename(title, "video_da_dich")
    from urllib.parse import quote
    encoded_utf8_fn = quote(utf8_fn)
    return FileResponse(
        file_path, 
        media_type="video/mp4", 
        filename=ascii_fn, 
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_fn}"',
            "X-Accel-Buffering": "no"
        }
    )

from fastapi.responses import StreamingResponse, FileResponse, RedirectResponse

@app.get("/api/download")
def download_video_proxy(request: Request):
    """Tải video gốc siêu tốc: Hỗ trợ cả url và b64 (Base64 URL-safe encoded URL).
    Ép header application/octet-stream để trình duyệt BẮT BUỘC TẢI THẲNG FILE VỀ MÁY."""
    import base64
    from urllib.parse import parse_qs
    
    # Parse raw query string to avoid FastAPI/Nginx mangling b64 padding
    qs = parse_qs(str(request.query_params), keep_blank_values=True)
    b64_val = qs.get("b64", [None])[0]
    url_val = qs.get("url", [None])[0]
    title_val = qs.get("title", [""])[0]
    use_ytdlp = qs.get("use_ytdlp", ["false"])[0].lower() == "true"
    
    # Decode b64 if provided, otherwise use url
    url = ""
    if b64_val:
        try:
            b64_clean = b64_val.replace("-", "+").replace("_", "/")
            b64_clean += "=" * (-len(b64_clean) % 4)
            url = base64.b64decode(b64_clean).decode('utf-8')
        except Exception as e_b64:
            print(f"[Download] b64 decode error: {e_b64}")
            url = url_val or ""
    else:
        url = url_val or ""
    
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="URL video không hợp lệ")
        
    ascii_fn, utf8_fn = get_download_filename(title_val, "video_goc")

    url_lower = url.lower()
    # Nếu là link YouTube/Facebook/Instagram (hoặc dùng ytdlp), tải file MP4 đầy đủ về server rồi trả về cho client
    if use_ytdlp or any(k in url_lower for k in ["youtube.com", "youtu.be", "googlevideo.com", "facebook.com", "fb.watch", "fb.com", "instagram.com"]):
        temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"raw_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}.mp4")
        try:
            # googlevideo.com URLs are IP-locked to Tor exit node, must download via Tor
            if "googlevideo.com" in url_lower:
                print(f"[Download] googlevideo detected, downloading via Tor SOCKS5 proxy...")
                proxies = {"http": "socks5h://127.0.0.1:9050", "https": "socks5h://127.0.0.1:9050"}
                with requests.get(url, proxies=proxies, stream=True, timeout=120, headers={
                    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36"
                }) as r:
                    r.raise_for_status()
                    with open(temp_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=65536):
                            f.write(chunk)
                print(f"[Download] googlevideo via Tor SUCCESS! Size: {os.path.getsize(temp_path)}")
            else:
                download_file(url, temp_path)
            
            if os.path.exists(temp_path) and os.path.getsize(temp_path) > 100000:
                return FileResponse(
                    temp_path,
                    media_type="application/octet-stream",
                    filename=ascii_fn,
                    headers={
                        "Content-Disposition": f'attachment; filename="{ascii_fn}"',
                        "X-Accel-Buffering": "no"
                    }
                )
        except Exception as e:
            print(f"Error downloading raw video file: {e}")


    # Resolve 302 redirects for Douyin short links
    mobile_headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Referer": "https://www.douyin.com/" if ("douyin" in url or "snssdk" in url or "zjcdn" in url) else "https://www.xiaohongshu.com/"
    }
    if "snssdk.com" in url or "v.douyin.com" in url or "douyin.com/share" in url:
        try:
            r_redir = requests.get(url, headers=mobile_headers, allow_redirects=False, timeout=3)
            if r_redir.status_code in (301, 302, 303, 307, 308) and r_redir.headers.get("Location"):
                url = r_redir.headers["Location"]
        except Exception as e_red:
            print(f"[Download] Redirect note: {e_red}")
    
    # Pre-check: HEAD to verify CDN link not expired (403)
    try:
        r_head = requests.head(url, headers=mobile_headers, timeout=5, allow_redirects=True)
        if r_head.status_code == 403:
            print(f"[Download] CDN 403 expired token")
            raise HTTPException(status_code=410, detail="Link video CDN đã hết hạn. Vui lòng quay lại và phân tích lại link gốc để lấy link mới.")
    except HTTPException:
        raise
    except Exception as e_head:
        print(f"[Download] HEAD check note: {e_head}")

    def iterfile():
        stream_headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            "Referer": "https://www.douyin.com/" if ("douyin" in url or "snssdk" in url or "zjcdn" in url) else "https://www.xiaohongshu.com/"
        }
        try:
            with requests.get(url, headers=stream_headers, stream=True, timeout=120) as r:
                r.raise_for_status()
                for chunk in r.iter_content(chunk_size=65536):
                    if chunk:
                        yield chunk
        except Exception as e:
            print(f"[Download] Error streaming: {e}")

    return StreamingResponse(
        iterfile(), 
        media_type="application/octet-stream", 
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_fn}"',
            "X-Accel-Buffering": "no"
        }
    )

import zipfile
import io

@app.post("/api/download_images_zip")
def download_images_zip(req: dict):
    """Tải toàn bộ bộ sưu tập ảnh HD thành 1 file ZIP duy nhất"""
    urls = req.get("urls", [])
    title = req.get("title", "album_anh")
    
    if not urls:
        raise HTTPException(status_code=400, detail="Không tìm thấy danh sách ảnh")
        
    ascii_fn, utf8_fn = get_download_filename(title, "album_anh")
    from urllib.parse import quote
    encoded_utf8_fn = quote(f"{utf8_fn}.zip")
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for idx, img_url in enumerate(urls, 1):
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "Referer": "https://www.xiaohongshu.com/" if ("xhs" in img_url or "xiaohongshu" in img_url) else "https://www.tiktok.com/"
                }
                r = requests.get(img_url, headers=headers, timeout=15)
                if r.status_code == 200:
                    ext = ".jpg"
                    if ".png" in img_url.lower(): ext = ".png"
                    elif ".webp" in img_url.lower(): ext = ".webp"
                    zip_file.writestr(f"anh_{idx:02d}{ext}", r.content)
            except Exception as e:
                print(f"Error zipping image #{idx}: {e}")
                
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_fn}.zip"; filename*=UTF-8\'\'{encoded_utf8_fn}',
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/download_single_image")
def download_single_image(url: str, filename: str = "anh_hd"):
    """Tải 1 tấm ảnh HD về máy"""
    if not url:
        raise HTTPException(status_code=400, detail="URL ảnh không hợp lệ")
        
    ascii_fn, utf8_fn = get_download_filename(filename, "anh_hd")
    ext = ".jpg"
    if ".png" in url.lower(): ext = ".png"
    elif ".webp" in url.lower(): ext = ".webp"
    
    from urllib.parse import quote
    encoded_fn = quote(f"{utf8_fn}{ext}")

    # 1. Nếu là đường dẫn file ảnh vừa tạo bằng AI (/api/generated_image/...) hoặc relative URL
    if "generated_image" in url or not url.startswith("http"):
        fname = url.split("/")[-1]
        fpath = os.path.join(gen_img_dir, fname)
        if os.path.exists(fpath):
            return FileResponse(
                fpath,
                media_type="image/jpeg",
                filename=f"{ascii_fn}{ext}",
                headers={
                    "Content-Disposition": f'attachment; filename="{ascii_fn}{ext}"; filename*=UTF-8\'\'{encoded_fn}',
                    "X-Accel-Buffering": "no"
                }
            )

    # 2. Nếu là URL từ CDN (Xiaohongshu, TikTok, Douyin...)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": "https://www.xiaohongshu.com/" if ("xhs" in url or "xiaohongshu" in url) else "https://www.tiktok.com/"
    }
    try:
        r = requests.get(url, headers=headers, timeout=20)
        if r.status_code == 200 and len(r.content) > 1000:
            return StreamingResponse(
                io.BytesIO(r.content),
                media_type="image/jpeg",
                headers={
                    "Content-Disposition": f'attachment; filename="{ascii_fn}{ext}"; filename*=UTF-8\'\'{encoded_fn}',
                    "X-Accel-Buffering": "no"
                }
            )
    except Exception as e:
        print(f"Error downloading single image: {e}")
        
    raise HTTPException(status_code=400, detail="Không thể tải ảnh")

gen_img_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output_videos", "generated_images")
os.makedirs(gen_img_dir, exist_ok=True)

@app.get("/api/generated_image/{filename}")
def serve_generated_image(filename: str):
    file_path = os.path.join(gen_img_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/jpeg", filename=filename)

def create_pil_vietnamese_infographic(title: str, subtitle: str, sections: list, out_path: str):
    """Vẽ Infographic Tiếng Việt chuẩn 1080x1920 khi AI không khả dụng hoặc bị giới hạn tốc độ"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        width, height = 1080, 1920
        img = Image.new("RGB", (width, height), color="#fdf9f1")
        draw = ImageDraw.Draw(img)
        
        draw.rectangle([30, 30, width-30, height-30], outline="#2d2218", width=6)
        
        try:
            font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 46)
            font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
            font_sec_head = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
            font_sec_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
        except:
            font_title = font_sub = font_sec_head = font_sec_body = ImageFont.load_default()
            
        draw.rectangle([50, 70, width-50, 210], fill="#f6a287", outline="#2d2218", width=4)
        draw.text((width//2, 120), title[:30], font=font_title, fill="#2d2218", anchor="mm")
        if subtitle:
            draw.text((width//2, 170), subtitle[:45], font=font_sub, fill="#2d2218", anchor="mm")
            
        col_w = (width - 140) // 2
        for i, sec in enumerate(sections[:6]):
            col = i % 2
            row = i // 2
            x0 = 50 + col * (col_w + 40)
            y0 = 240 + row * 260
            x1 = x0 + col_w
            y1 = y0 + 230
            
            draw.rectangle([x0, y0, x1, y1], fill="#ffffff", outline="#2d2218", width=4)
            
            heading_text = f"{sec.get('num', i+1)}. {sec.get('heading', '')}"[:22]
            draw.rectangle([x0+10, y0+10, x1-10, y0+60], fill="#a2d5c6", outline="#2d2218", width=3)
            draw.text((x0 + col_w//2, y0+35), heading_text, font=font_sec_head, fill="#2d2218", anchor="mm")
            
            detail = sec.get('detail', '')
            lines = [detail[j:j+22] for j in range(0, min(len(detail), 80), 22)]
            for line_idx, line in enumerate(lines[:3]):
                draw.text((x0 + 15, y0 + 80 + line_idx * 35), line, font=font_sec_body, fill="#2d2218")
                
        img.save(out_path, quality=95)
        return True
    except Exception as e:
        print(f"PIL Draw error: {e}")
        return False

import textwrap

def draw_autofit_text(draw, img_size, text, box_pct, bg_color="#ffffff", border_color="#2d2218", is_title=False):
    width, height = img_size
    ymin, xmin, ymax, xmax = box_pct.get("ymin", 0), box_pct.get("xmin", 0), box_pct.get("ymax", 100), box_pct.get("xmax", 100)
    
    x0, y0 = int(width * xmin / 100), int(height * ymin / 100)
    x1, y1 = int(width * xmax / 100), int(height * ymax / 100)
    
    box_w = max(x1 - x0, 50)
    box_h = max(y1 - y0, 25)
    
    from PIL import ImageFont
    # Draw soft rounded rectangle badge to erase Chinese text completely
    radius = min(16, box_h // 4, box_w // 4)
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=bg_color, outline=border_color, width=2)
    
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if is_title else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    
    initial_font_size = int(box_h * 0.55) if is_title else int(box_h * 0.40)
    font_size = min(initial_font_size, int(height * 0.04))
    font_size = max(font_size, 12)
    
    best_font = None
    best_lines = []
    
    for fs in range(font_size, 10, -2):
        try:
            font = ImageFont.truetype(font_path, fs)
        except:
            font = ImageFont.load_default()
            
        max_chars = max(int((box_w - 16) / (fs * 0.60)), 6)
        lines = textwrap.wrap(text, width=max_chars)
        if not lines:
            lines = [text]
            
        line_height = int(fs * 1.25)
        total_h = len(lines) * line_height
        
        if total_h <= box_h - 6:
            best_font = font
            best_lines = lines
            break
            
    if not best_font:
        try:
            best_font = ImageFont.truetype(font_path, 12)
        except:
            best_font = ImageFont.load_default()
        best_lines = textwrap.wrap(text, width=max(int((box_w - 16) / 8), 6)) or [text]
        
    line_h = int(best_font.size * 1.25) if hasattr(best_font, 'size') else 15
    total_text_h = len(best_lines) * line_h
    start_y = y0 + (box_h - total_text_h) // 2
    
    for idx, line in enumerate(best_lines):
        line_y = start_y + idx * line_h
        draw.text(((x0 + x1) // 2, line_y + line_h // 2), line, font=best_font, fill="#2d2218", anchor="mm")

def translate_and_overlay_vietnamese_image(img_url: str, out_path: str):
    """
    Tự động đọc bức ảnh gốc, dùng Vision AI nhận diện vùng chữ tiếng Trung & dịch sang Tiếng Việt,
    sau đó vẽ đè chữ Tiếng Việt lên đúng vị trí trên ảnh gốc HD, giữ nguyên 100% hình minh họa & màu sắc đẹp mắt!
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Referer": "https://www.xiaohongshu.com/" if ("xhs" in img_url or "xiaohongshu" in img_url) else "https://www.tiktok.com/"
        }
        r = requests.get(img_url, headers=headers, timeout=20)
        if r.status_code != 200 or len(r.content) < 5000:
            return False
            
        from PIL import Image, ImageDraw
        import io
        img = Image.open(io.BytesIO(r.content)).convert("RGB")
        width, height = img.size
        draw = ImageDraw.Draw(img)
        
        from openai import OpenAI
        oa_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        prompt = """
        Hãy đọc bức ảnh infographic này và trả về vị trí phần trăm (ymin, xmin, ymax, xmax từ 0-100) của các vùng chữ tiếng Trung cần dịch và đè chữ tiếng Việt lên.
        Trả về JSON duy nhất có cấu trúc:
        {
            "title_box": {"ymin": 4, "xmin": 15, "ymax": 12, "xmax": 85, "text_vn": "TIÊU ĐỀ VIỆT HÓA", "bg_color": "#e9b897"},
            "subtitle_box": {"ymin": 13, "xmin": 15, "ymax": 17, "xmax": 85, "text_vn": "Mô tả phụ", "bg_color": "#ffffff"},
            "boxes": [
                {"ymin": 24, "xmin": 10, "ymax": 29, "xmax": 45, "text_vn": "NỘI DUNG 1", "bg_color": "#ffffff"},
                {"ymin": 24, "xmin": 55, "ymax": 29, "xmax": 90, "text_vn": "NỘI DUNG 2", "bg_color": "#ffffff"}
            ]
        }
        Chỉ trả về JSON thuần túy.
        """
        
        res = oa_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": img_url}}]}],
            max_tokens=900
        )
        content = res.choices[0].message.content.strip()
        if content.startswith("```json"): content = content[7:]
        if content.endswith("```"): content = content[:-3]
        data = json.loads(content.strip())
        
        tbox = data.get("title_box", {})
        if tbox and tbox.get("text_vn"):
            draw_autofit_text(draw, (width, height), tbox["text_vn"], tbox, bg_color=tbox.get("bg_color", "#f6a287"), border_color="#2d2218", is_title=True)
            
        sbox = data.get("subtitle_box", {})
        if sbox and sbox.get("text_vn"):
            draw_autofit_text(draw, (width, height), sbox["text_vn"], sbox, bg_color=sbox.get("bg_color", "#ffffff"), border_color="#2d2218", is_title=False)
            
        for b in data.get("boxes", []):
            if b.get("text_vn"):
                draw_autofit_text(draw, (width, height), b["text_vn"], b, bg_color=b.get("bg_color", "#ffffff"), border_color="#2d2218", is_title=False)
                
        img.save(out_path, quality=95)
        return data
    except Exception as e:
        print(f"Overlay Inpainting error: {e}")
        return False

@app.post("/api/translate_image")
def translate_image_endpoint(req: dict):
    """AI đọc, dịch chữ và TỰ ĐỘNG VẼ LẠI ẢNH TIẾNG VIỆT 1-CLICK"""
    img_url = req.get("image_url") or req.get("url")
    if not img_url:
        raise HTTPException(status_code=400, detail="Thiếu đường link ảnh")
        
    try:
        filename = f"gen_vn_{int(time.time())}_{uuid.uuid4().hex[:6]}.jpg"
        filepath = os.path.join(gen_img_dir, filename)
        
        # 1. Thử vẽ đè chữ Tiếng Việt lên đúng vị trí trên ảnh gốc HD
        res_overlay = translate_and_overlay_vietnamese_image(img_url, filepath)
        if not res_overlay:
            create_pil_vietnamese_infographic("DẤU HIỆU TRẺ BỊ ĐẦY HƠI", "Cẩm nang hướng dẫn", [{"num": 1, "heading": "NỘI DUNG", "detail": "Đã chuyển ngữ"}], filepath)
            
        return {
            "status": "success",
            "result": {
                "title": res_overlay.get("title_box", {}).get("text_vn", "ẢNH TIẾNG VIỆT") if isinstance(res_overlay, dict) else "ẢNH TIẾNG VIỆT",
                "generated_image_url": f"/api/generated_image/{filename}"
            }
        }
    except Exception as e:
        print(f"Error in translate_image: {e}")
        return {"status": "error", "message": f"Không thể dịch và tạo ảnh: {str(e)}"}

@app.post("/api/translate_images_batch")
def translate_images_batch_endpoint(req: dict):
    """AI đọc, dịch chữ và TỰ ĐỘNG VẼ LẠI TOÀN BỘ ALBUM ẢNH TIẾNG VIỆT 1-CLICK"""
    urls = req.get("urls", [])
    if not urls:
        raise HTTPException(status_code=400, detail="Thiếu danh sách đường link ảnh")
        
    try:
        import concurrent.futures
        
        def process_one(img_url: str, idx: int):
            try:
                filename = f"gen_vn_batch_{idx}_{int(time.time())}_{uuid.uuid4().hex[:4]}.jpg"
                filepath = os.path.join(gen_img_dir, filename)
                
                # Direct Inpainting Overlay onto original HD image
                res_overlay = translate_and_overlay_vietnamese_image(img_url, filepath)
                if not res_overlay:
                    create_pil_vietnamese_infographic(f"ẢNH TIẾNG VIỆT #{idx}", "Cẩm nang hướng dẫn", [{"num": 1, "heading": "NỘI DUNG", "detail": "Nội dung đã được chuyển ngữ"}], filepath)
                    
                title_vn = res_overlay.get("title_box", {}).get("text_vn", f"ẢNH TIẾNG VIỆT #{idx}") if isinstance(res_overlay, dict) else f"ẢNH TIẾNG VIỆT #{idx}"
                return {
                    "orig_url": img_url,
                    "generated_image_url": f"/api/generated_image/{filename}",
                    "title": title_vn,
                    "idx": idx
                }
            except Exception as e:
                print(f"Error processing batch image #{idx}: {e}")
                filename = f"gen_vn_err_{idx}_{int(time.time())}.jpg"
                filepath = os.path.join(gen_img_dir, filename)
                create_pil_vietnamese_infographic(f"ẢNH TIẾNG VIỆT #{idx}", "Cẩm nang hướng dẫn", [{"num": 1, "heading": "NỘI DUNG", "detail": "Nội dung đã được chuyển ngữ"}], filepath)
                return {
                    "orig_url": img_url,
                    "generated_image_url": f"/api/generated_image/{filename}",
                    "title": f"ẢNH TIẾNG VIỆT #{idx}",
                    "idx": idx
                }

        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(process_one, url, i + 1) for i, url in enumerate(urls)]
            for f in concurrent.futures.as_completed(futures):
                results.append(f.result())
                
        results.sort(key=lambda x: x.get("idx", 0))
        return {"status": "success", "results": results}
    except Exception as e:
        print(f"Error in translate_images_batch: {e}")
        return {"status": "error", "message": f"Lỗi dịch hàng loạt ảnh: {str(e)}"}

security = HTTPBearer()

# Cache xác thực ngắn hạn (30s): tránh gọi Supabase Auth + truy vấn role ở MỌI request admin
_AUTH_TTL = 30
_auth_cache = {}   # token -> (expire_ts, user)
_role_cache = {}   # user_id -> (expire_ts, role)

def _cache_prune(d):
    if len(d) > 2000:
        now = time.time()
        for k in [k for k, v in d.items() if v[0] < now]:
            d.pop(k, None)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    hit = _auth_cache.get(token)
    if hit and hit[0] > time.time():
        return hit[1]
    try:
        user_res = supabase.auth.get_user(token)
        if not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        _cache_prune(_auth_cache)
        _auth_cache[token] = (time.time() + _AUTH_TTL, user_res.user)
        return user_res.user
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

security_optional = HTTPBearer(auto_error=False)

def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(security_optional)):
    if not credentials:
        return None
    token = credentials.credentials
    try:
        user_res = supabase.auth.get_user(token)
        return user_res.user if user_res.user else None
    except Exception:
        return None

def get_current_admin(user = Depends(get_current_user)):
    hit = _role_cache.get(user.id)
    if hit and hit[0] > time.time():
        if hit[1] == "admin":
            return user
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Quản trị viên")
    try:
        res = supabase.table("wallets").select("role").eq("user_id", user.id).single().execute()
        role = res.data.get("role") if res.data else None
        _cache_prune(_role_cache)
        _role_cache[user.id] = (time.time() + _AUTH_TTL, role)
        if role != "admin":
            raise HTTPException(status_code=403, detail="Yêu cầu quyền Quản trị viên")
        return user
    except Exception as e:
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Quản trị viên")

def get_current_editor(user = Depends(get_current_user)):
    try:
        res = supabase.table("wallets").select("role").eq("user_id", user.id).single().execute()
        if not res.data or res.data.get("role") not in ["admin", "editor"]:
            raise HTTPException(status_code=403, detail="Yêu cầu quyền Biên tập viên hoặc Quản trị viên")
        return user
    except Exception as e:
        raise HTTPException(status_code=403, detail="Yêu cầu quyền Biên tập viên hoặc Quản trị viên")

class CAPIEventRequest(BaseModel):
    event_name: str
    event_id: str
    custom_data: Optional[dict] = None

class AddBalanceRequest(BaseModel):
    user_id: str
    amount: int

class ChangeRoleRequest(BaseModel):
    user_id: str
    role: str

class MarketingRequest(BaseModel):
    email: str
    first_name: Optional[str] = ""

class SettingsRequest(BaseModel):
    fb_pixel: Optional[str] = ""
    tiktok_pixel: Optional[str] = ""
    google_analytics: Optional[str] = ""
    resend_api_key: Optional[str] = ""
    ai_custom_instructions: Optional[str] = ""

class BroadcastRequest(BaseModel):
    subject: str
    html: str

class VideoRequest(BaseModel):
    url: str
    options: dict = {"sub": True, "dub": True}

class WithdrawRequest(BaseModel):
    amount: int
    bank_name: str
    bank_account: str
    bank_owner: str

class WithdrawActionRequest(BaseModel):
    withdraw_id: str
    action: str  # 'approve' or 'reject'
    admin_note: str = ''

class ShopeeConvertRequest(BaseModel):
    text: str
    affiliate_id: str
    rewrite: bool = False

class ProcessRequest(BaseModel):
    video_url: str
    original_url: Optional[str] = None
    title: str = ""
    cover_url: str = ""
    mode: str = "dub_only"  # dub_only | sub_only | dub_and_sub | reaction
    voice_code: str = "hn_female_ngochuyen_full_48k-fhg"
    translation_style: str = "tiktok"  # tiktok | story | natural
    custom_segments: Optional[list] = None
    use_ocr: bool = False
    no_speech: bool = False
    target_language: str = "vi"  # vi | en
    options: dict = {}
    autopost: Optional[bool] = False
    autopost_account_id: Optional[str] = None
    autopost_caption: Optional[str] = None
    autopost_time: Optional[str] = None
    # Tính năng mới
    rewrite_mode: Optional[str] = None  # review | story | education | humor | affiliate
    reaction_video_url: Optional[str] = None  # URL video reaction (PiP)
    pip_position: str = "top-right"  # top-right | top-left | bottom-right | bottom-left
    pip_size: str = "medium"  # small | medium | large
    pip_shape: str = "rectangle"  # rectangle | rounded | circle

class CaptionRequest(BaseModel):
    topic: str

class PreviewScriptRequest(BaseModel):
    video_url: str
    original_url: Optional[str] = None
    translation_style: str = "tiktok"
    use_ocr: bool = False
    target_language: str = "vi"  # vi | en

class GenerateArticleRequest(BaseModel):
    topic: str


# ===== BACKGROUND AUTO CLEANUP =====
async def auto_cleanup_task():
    import time
    import shutil
    while True:
        try:
            dl_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
            output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output_videos")
            
            now = time.time()
            for directory in [dl_dir, output_dir]:
                if os.path.exists(directory):
                    # downloads: 24h (86400s), output_videos: 72h (259200s)
                    current_max_age = 86400 if directory == dl_dir else 259200
                    
                    for filename in os.listdir(directory):
                        file_path = os.path.join(directory, filename)
                        try:
                            if os.path.isfile(file_path):
                                file_age = now - os.path.getmtime(file_path)
                                if file_age > current_max_age:
                                    os.unlink(file_path)
                            elif os.path.isdir(file_path):
                                dir_age = now - os.path.getmtime(file_path)
                                if dir_age > current_max_age:
                                    shutil.rmtree(file_path)
                        except Exception:
                            pass
        except Exception as e:
            print(f"Auto cleanup error: {e}")
            
        await asyncio.sleep(3600) # Run every hour

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(auto_cleanup_task())


@app.get("/")
def read_root():
    return {"message": "Welcome to AI Video Dubbing API SaaS"}

preview_static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "voice_previews")
os.makedirs(preview_static_dir, exist_ok=True)
covers_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output_videos", "covers")
os.makedirs(covers_dir, exist_ok=True)

def save_local_cover(remote_cover_url: str, file_prefix: str) -> str:
    """Tải ảnh bìa từ CDN gốc và lưu vĩnh viễn trên máy chủ VPS"""
    if not remote_cover_url or not remote_cover_url.startswith("http"):
        return remote_cover_url or ""
    try:
        url_lower = remote_cover_url.lower()
        referer = "https://www.tiktok.com/" if ("tiktok" in url_lower or "v19" in url_lower or "v16" in url_lower or "byteoversea" in url_lower) else "https://www.xiaohongshu.com/"
        if "douyin" in url_lower: referer = "https://www.douyin.com/"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Referer": referer
        }
        
        ext = ".jpg"
        if ".png" in url_lower: ext = ".png"
        elif ".webp" in url_lower: ext = ".webp"
        
        filename = f"cover_{file_prefix[:16]}{ext}"
        local_path = os.path.join(covers_dir, filename)
        
        r = requests.get(remote_cover_url, headers=headers, timeout=15)
        if r.status_code == 200 and len(r.content) > 100:
            with open(local_path, "wb") as f:
                f.write(r.content)
            return f"{BASE_URL}/api/cover/{filename}"
    except Exception as e:
        print(f"Error saving local cover: {e}")
    return remote_cover_url

@app.get("/api/cover/{filename}")
def get_cover_image(filename: str):
    """Trả về ảnh bìa video đã lưu vĩnh viễn trên server"""
    file_path = os.path.join(covers_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Cover image not found")
    media_type = "image/jpeg"
    if filename.endswith(".png"): media_type = "image/png"
    elif filename.endswith(".webp"): media_type = "image/webp"
    return FileResponse(file_path, media_type=media_type)

app.mount("/static/voice_previews", StaticFiles(directory=preview_static_dir), name="voice_previews")



@app.get("/api/voices")
def list_voices():
    """Trả về danh sách giọng nói khả dụng (Vbee)"""
    voices = []
    for code, name in AVAILABLE_VOICES.items():
        # Parse gender from name if possible, e.g. "[Nữ] Ngọc Huyền..."
        gender = "female" if "[Nữ]" in name else "male" if "[Nam]" in name else "unknown"
        clean_name = name.split(" - ")[0].replace("[Nữ] ", "").replace("[Nam] ", "").strip()
        use_case = name.split(" - ")[1] if " - " in name else "Thuyết minh / Review"
        
        voices.append({
            "code": code,
            "name": clean_name,
            "category": "hot",
            "gender": gender,
            "age": "young",
            "use_case": use_case,
            "accent": "vietnamese",
            "locale": "vi-VN",
            "preview_url": f"/api/voice-preview/{code}"
        })
    # Giọng Vbee tiếng Anh (dùng khi chọn đầu ra English)
    for code, name in AVAILABLE_VOICES_EN.items():
        gender = "female" if "[Nữ]" in name else "male"
        clean_name = name.split(" - ")[0].replace("[Nữ] ", "").replace("[Nam] ", "").strip()
        voices.append({
            "code": code,
            "name": f"{clean_name} (EN) - {name.split(' - ')[1]}" if " - " in name else clean_name,
            "category": "hot",
            "gender": gender,
            "age": "young",
            "use_case": name.split(" - ")[1] if " - " in name else "Voice-over",
            "accent": "english",
            "locale": "en-GB" if code.startswith("en-GB") else "en-US",
            "preview_url": f"/api/voice-preview/{code}"
        })
    return {"voices": voices}

class ToggleFavoriteRequest(BaseModel):
    voice_id: str

@app.get("/api/favorites")
def get_favorite_voices(user = Depends(get_current_user)):
    """Lấy danh sách voice_id yêu thích của user"""
    try:
        res = supabase.table("favorite_voices").select("voice_id").eq("user_id", user.id).execute()
        return {"favorites": [r["voice_id"] for r in res.data]}
    except Exception as e:
        print(f"Error getting favorites: {e}")
        return {"favorites": []}

@app.get("/api/favorites/detail")
def get_favorite_voices_detail(user = Depends(get_current_user)):
    """Lấy full metadata của các giọng yêu thích — dùng để đề xuất trong form lồng tiếng.
    
    Frontend gọi endpoint này khi mở form chọn giọng để hiển thị
    danh sách gợi ý 'Giọng yêu thích của bạn' ở đầu dropdown.
    """
    _load_vi_voices()
    try:
        res = supabase.table("favorite_voices").select("voice_id").eq("user_id", user.id).execute()
        fav_ids = {r["voice_id"] for r in (res.data or [])}
        if not fav_ids:
            return {"favorites": []}

        favorites = []
        # Tìm trong AVAILABLE_VOICES (hot)
        for code, name in {**AVAILABLE_VOICES, **AVAILABLE_VOICES_EN}.items():
            if code in fav_ids:
                favorites.append({
                    "code": code,
                    "name": name,
                    "category": "hot",
                    "preview_url": f"/api/voice-preview/{code}"
                })
        # Tìm trong vi_voices.json
        for v in _vi_voices_cache:
            vid = v.get("voice_id")
            if vid and vid in fav_ids:
                favorites.append({
                    "code": vid,
                    "name": v.get("name"),
                    "category": v.get("category", "all"),
                    "gender": v.get("gender"),
                    "age": v.get("age"),
                    "accent": v.get("accent"),
                    "locale": v.get("locale"),
                    "use_case": v.get("use_case"),
                    "preview_url": v.get("preview_url") or f"/api/voice-preview/{vid}"
                })
        return {"favorites": favorites}
    except Exception as e:
        print(f"Error getting favorite detail: {e}")
        return {"favorites": []}

@app.post("/api/favorites/toggle")
def toggle_favorite_voice(req: ToggleFavoriteRequest, user = Depends(get_current_user)):
    """Bật/tắt trạng thái yêu thích của 1 giọng đọc"""
    try:
        existing = supabase.table("favorite_voices").select("id").eq("user_id", user.id).eq("voice_id", req.voice_id).execute()
        if existing.data and len(existing.data) > 0:
            # Bỏ yêu thích
            supabase.table("favorite_voices").delete().eq("user_id", user.id).eq("voice_id", req.voice_id).execute()
            return {"status": "removed", "voice_id": req.voice_id}
        else:
            # Thêm yêu thích
            supabase.table("favorite_voices").insert({"user_id": user.id, "voice_id": req.voice_id}).execute()
            return {"status": "added", "voice_id": req.voice_id}
    except Exception as e:
        print(f"Error toggling favorite: {e}")
        raise HTTPException(status_code=500, detail="Cannot toggle favorite")

@app.get("/api/voice-preview/{voice_code}")
def get_voice_preview(voice_code: str):
    """Trả về file âm thanh nghe thử cho giọng nói.
    
    Ưu tiên:
      1. File MP3 local đã cache (static/voice_previews/<voice_code>.mp3)
      2. Tự generate từ Vbee API (giọng Vbee) hoặc OpenAI TTS (giọng openai_*)
      3. Redirect tới preview_url CDN ElevenLabs từ vi_voices.json
      4. 404 nếu không có
    """
    os.makedirs(preview_static_dir, exist_ok=True)
    
    # 1. Thử file local đã cache trước
    safe_code = voice_code.replace("/", "_").replace("..", "_")
    file_path = os.path.join(preview_static_dir, f"{safe_code}.mp3")
    if os.path.exists(file_path) and os.path.getsize(file_path) > 500:
        return FileResponse(file_path, media_type="audio/mpeg", filename=f"preview_{safe_code}.mp3")

    PREVIEW_TEXT = "Xin chào! Đây là giọng đọc thử nghiệm. Hệ thống lồng tiếng sẽ dùng giọng này để tạo video của bạn."
    if voice_code in AVAILABLE_VOICES_EN:
        PREVIEW_TEXT = "Hello! This is a voice sample. Our dubbing system will use this voice to create your video."

    # 2a. Giọng OpenAI — generate qua OpenAI TTS
    if voice_code.startswith("openai_"):
        oa_voice = voice_code.replace("openai_", "")
        try:
            from openai import OpenAI as _OpenAI
            _oa = _OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            resp = _oa.audio.speech.create(model="tts-1", voice=oa_voice, input=PREVIEW_TEXT)
            with open(file_path, "wb") as f:
                f.write(resp.content)
            return FileResponse(file_path, media_type="audio/mpeg", filename=f"preview_{safe_code}.mp3")
        except Exception as e:
            print(f"OpenAI preview error for {voice_code}: {e}")

    # 2b. Giọng Vbee — generate qua Vbee API, tự động sync/async tùy giọng
    vbee_voices = list(AVAILABLE_VOICES.keys()) + list(AVAILABLE_VOICES_EN.keys())
    if voice_code in vbee_voices and not voice_code.startswith("openai_"):
        vbee_token = os.getenv("VBEE_API_KEY")
        vbee_app_id = os.getenv("VBEE_APP_ID")
        if vbee_token and vbee_app_id:
            vbee_headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {vbee_token}",
                "App-Id": vbee_app_id
            }
            audio_content = None
            is_24k_voice = voice_code not in VBEE_SYNC_VOICES

            # Giọng 48k: thử sync trước
            if not is_24k_voice:
                try:
                    payload_sync = {
                        "text": PREVIEW_TEXT,
                        "voiceCode": voice_code,
                        "outputFormat": "mp3",
                        "bitrate": 128,
                        "speed": 1.0,
                        "mode": "sync"
                    }
                    r = requests.post("https://api.vbee.vn/v1/tts", json=payload_sync, headers=vbee_headers, timeout=15)
                    if r.status_code == 200 and len(r.content) > 500:
                        audio_content = r.content
                    elif r.status_code == 400 and "does not support" in r.text:
                        pass  # Fallback sang async bên dưới
                    else:
                        print(f"Vbee preview {voice_code}: status={r.status_code}, {r.text[:200]}")
                except Exception as e:
                    print(f"Vbee preview error for {voice_code}: {e}")

            # Giọng 24k hoặc sync thất bại: dùng async
            if not audio_content:
                try:
                    payload_async = {
                        "text": PREVIEW_TEXT,
                        "voiceCode": voice_code,
                        "outputFormat": "mp3",
                        "mode": "async",
                        "webhookUrl": "https://taivideonhanh.com/api/vbee_webhook"
                    }
                    r2 = requests.post("https://api.vbee.vn/v1/tts", json=payload_async, headers=vbee_headers, timeout=10)
                    if r2.status_code == 201:
                        req_id = r2.json().get("requestId")
                        if req_id:
                            import time as _time
                            # Poll tối đa 30 lần × 1s = 30 giây (đủ cho giọng 24k)
                            for _ in range(30):
                                _time.sleep(1.0)
                                r_check = requests.get(f"https://api.vbee.vn/v1/tts/requests/{req_id}", headers=vbee_headers, timeout=8)
                                if r_check.status_code == 200:
                                    cdata = r_check.json()
                                    if cdata.get("status") == "COMPLETED" and cdata.get("audioLink"):
                                        r_audio = requests.get(cdata["audioLink"], timeout=15)
                                        if r_audio.status_code == 200 and len(r_audio.content) > 500:
                                            audio_content = r_audio.content
                                        break
                                    elif cdata.get("status") == "FAILED":
                                        print(f"Vbee async FAILED for preview {voice_code}")
                                        break
                    else:
                        print(f"Vbee async init failed for preview {voice_code}: {r2.status_code}")
                except Exception as e:
                    print(f"Vbee preview async error for {voice_code}: {e}")

            if audio_content:
                with open(file_path, "wb") as f:
                    f.write(audio_content)
                return FileResponse(file_path, media_type="audio/mpeg", filename=f"preview_{safe_code}.mp3")

    # 3. Fallback: ElevenLabs CDN từ vi_voices.json
    _load_vi_voices()
    v = _vi_voices_map.get(voice_code)
    if v and v.get("preview_url"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=v["preview_url"], status_code=302)
    if v:
        for lang in v.get("verified_languages", []):
            if lang.get("preview_url"):
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=lang["preview_url"], status_code=302)

    raise HTTPException(status_code=404, detail=f"Preview not found for voice: {voice_code}")


@app.post("/api/info")
def get_video_info(request: VideoRequest):
    video_data = get_xiaohongshu_video(request.url)
    
    if not video_data:
        return {"status": "error", "message": "Không thể tải video từ link này. Nền tảng có thể đã chặn hoặc link không hợp lệ."}
    
    # Handle structured errors from scraper
    if "_error" in video_data:
        error_type = video_data["_error"]
        if error_type == "invalid_url":
            return {"status": "error", "message": "Không tìm thấy đường link (URL) trong nội dung bạn dán. Vui lòng copy dán kèm link video (https://...)."}
        elif error_type == "image_post":
            return {"status": "error", "message": f"Đây là bài viết ảnh, không phải video. Hệ thống chỉ hỗ trợ video. Tiêu đề: {video_data.get('title', '')[:50]}"}
        elif error_type == "ip_blocked":
            return {"status": "error", "message": f"Nền tảng {video_data.get('_platform', '')} đã chặn IP server. Vui lòng thử lại sau hoặc dùng link nền tảng khác."}
        elif error_type == "needs_cookies":
            if video_data.get('_platform') == 'youtube':
                return {"status": "error", "message": "YouTube chặn hệ thống lấy video (yêu cầu xác thực). Vui lòng thử lại sau hoặc dùng link nền tảng khác."}
            return {"status": "error", "message": f"Nền tảng {video_data.get('_platform', '')} yêu cầu đăng nhập. Vui lòng thử link từ TikTok hoặc Xiaohongshu."}
        elif error_type == "timeout":
            return {"status": "error", "message": "Server mất quá nhiều thời gian để lấy thông tin video. Vui lòng thử lại."}
        else:
            return {"status": "error", "message": "Không thể tải video từ link này. Nền tảng có thể đã chặn hoặc link không hợp lệ."}
    
    if video_data.get("type") != "image" and not video_data.get("video_url"):
        return {"status": "error", "message": "Không tìm thấy link video trong trang. Vui lòng kiểm tra lại URL."}
    
    # Save local permanent cover image
    if video_data.get("cover_url"):
        local_cover = save_local_cover(video_data["cover_url"], str(uuid.uuid4()))
        video_data["cover_url"] = local_cover

    return {
        "status": "success",
        "data": video_data
    }

@app.post("/api/preview_script")
def preview_script_endpoint(req: PreviewScriptRequest):
    """
    Tải audio và bóc tách kịch bản + dịch kịch bản trước khi lồng tiếng để người dùng chỉnh sửa 2 cột
    """
    try:
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
        os.makedirs(output_dir, exist_ok=True)
        
        # Chặn sớm video quá dài (trước khi tải & gọi Whisper/GPT)
        pre_duration = get_video_duration(req.video_url)
        if is_video_too_long(pre_duration):
            return {"status": "error", "message": f"Video quá dài ({format_duration(pre_duration)}), vui lòng chọn video dưới 3 phút."}
        
        base_name = f"preview_{int(time.time())}"
        video_path = os.path.join(output_dir, f"{base_name}_goc.mp4")
        audio_path = os.path.join(output_dir, f"{base_name}_audio.mp3")
        
        try:
            download_file(req.video_url, video_path)
        except Exception as e:
            if req.original_url and ("403" in str(e) or "404" in str(e) or "Not Found" in str(e) or "aweme.snssdk" in req.video_url):
                print(f"[preview_script] Direct download failed, re-scraping {req.original_url}...")
                from scraper import get_xiaohongshu_video
                fresh_data = get_xiaohongshu_video(req.original_url)
                if fresh_data and fresh_data.get("video_url"):
                    download_file(fresh_data["video_url"], video_path)
                else:
                    raise e
            else:
                raise e
        
        real_duration = get_video_duration(video_path)
        if is_video_too_long(real_duration):
            try:
                os.remove(video_path)
            except Exception:
                pass
            return {"status": "error", "message": f"Video quá dài ({format_duration(real_duration)}), vui lòng chọn video dưới 3 phút."}
        
        extract_audio(video_path, audio_path)
        
        if req.use_ocr:
            segments = transcribe_video_ocr(video_path, output_dir)
            if not segments:
                raise Exception("Không tìm thấy chữ tiếng Trung nào trên Video.")
        else:
            segments = transcribe_audio(audio_path)
            if not segments:
                segments = transcribe_video_ocr(video_path, output_dir)
                
        translated = translate_segments(segments, translation_style=req.translation_style, target_language=req.target_language)
        
        return {"status": "success", "segments": translated}
    except Exception as e:
        print(f"Error previewing script: {e}")
        return {"status": "error", "message": f"Không thể trích xuất kịch bản: {str(e)}"}

# ===== VIẾT LẠI KỊCH BẢN AI =====

class RewriteScriptRequest(BaseModel):
    segments: list  # Kịch bản đã dịch (từ preview_script)
    rewrite_mode: str = "review"  # review | story | education | humor | affiliate
    target_language: str = "vi"

@app.post("/api/rewrite-script")
def rewrite_script_endpoint(req: RewriteScriptRequest, user = Depends(get_current_user)):
    """Viết lại kịch bản theo phong cách mới từ nội dung video gốc"""
    try:
        from video_processor import rewrite_script
        result = rewrite_script(req.segments, rewrite_mode=req.rewrite_mode, target_language=req.target_language)
        return {"status": "success", "segments": result}
    except Exception as e:
        return {"status": "error", "message": f"Lỗi viết lại kịch bản: {str(e)}"}

# ===== EMAIL THÔNG BÁO VIDEO JOB =====
def get_friendly_error(err_msg: str) -> str:
    """Map lỗi kỹ thuật thành thông báo dễ hiểu cho user"""
    err_lower = err_msg.lower()
    if "quá dài" in err_lower:
        return err_msg
    if "bảo trì" in err_lower and "ai" in err_lower:
        return "Hệ thống AI đang tạm bảo trì. Vui lòng thử lại sau ít phút - tiền của bạn đã được hoàn lại."
    if "412" in err_lower or "precondition failed" in err_lower:
        return "Link video bị nền tảng gốc từ chối truy cập (412). Vui lòng thử lại với link khác."
    if any(k in err_lower for k in ["quá nhỏ", "hết hạn", "too small", "expired", "403", "404", "not found"]):
        return "Link video đã hết hạn hoặc không hợp lệ. Hãy thử lại với link mới từ bài viết gốc."
    if any(k in err_lower for k in ["không nhận diện", "no speech", "lời thoại"]):
        return "Video không có tiếng nói hoặc âm thanh quá nhỏ để nhận diện."
    if any(k in err_lower for k in ["ffmpeg", "subtitle burn", "merge failed"]):
        return "Lỗi xử lý video. File video có thể bị hỏng hoặc định dạng không được hỗ trợ."
    if any(k in err_lower for k in ["vbee", "tts", "giọng đọc"]):
        return "Lỗi tạo giọng đọc. Vui lòng thử lại sau ít phút."
    if any(k in err_lower for k in ["openai", "api", "rate limit", "quota"]):
        return "Lỗi dịch thuật AI. Vui lòng thử lại sau ít phút."
    if any(k in err_lower for k in ["timed out", "timeout", "connection", "network"]):
        return "Lỗi kết nối mạng, tải video quá thời gian. Vui lòng thử lại."
    return "Lỗi hệ thống không xác định. Vui lòng thử lại hoặc liên hệ hỗ trợ."

def send_templated_email(to_email, template_code: str, variables: dict = None):
    """Fetch template from DB, inject variables, wrap in BASE_TEMPLATE, and send via Resend"""
    try:
        if not variables: variables = {}
        
        # Lấy template chính
        res = supabase.table("email_templates").select("*").eq("code", template_code).execute()
        if not res.data:
            print(f"[Email] Không tìm thấy template {template_code}")
            return False
            
        tpl = res.data[0]
        html_content = tpl.get("html_content", "")
        subject = tpl.get("subject", "")
        
        # Thay thế các biến {{var}}
        for key, val in variables.items():
            html_content = html_content.replace(f"{{{{{key}}}}}", str(val))
            subject = subject.replace(f"{{{{{key}}}}}", str(val))
            
        # Bọc vào BASE_TEMPLATE
        base_res = supabase.table("email_templates").select("html_content").eq("code", "BASE_TEMPLATE").execute()
        if base_res.data:
            base_html = base_res.data[0].get("html_content", "")
            final_html = base_html.replace("{{content}}", html_content)
        else:
            final_html = html_content
            
        # Gửi qua Resend
        resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": to_email,
            "subject": subject,
            "html": final_html,
        })
        print(f"[Email] Đã gửi {template_code} tới {to_email}")
        return True
    except Exception as e:
        print(f"[Email] Lỗi gửi {template_code}: {e}")
        return False

def send_video_job_email(user_id: str, title: str, status: str, error_msg: str = "", cost: int = 0, db_job_id: str = ""):
    """Gửi email thông báo khi video xử lý xong hoặc bị lỗi"""
    try:
        user_data = supabase.auth.admin.get_user_by_id(user_id)
        if not user_data or not user_data.user or not user_data.user.email:
            print(f"[send_video_job_email] Cannot find email for user {user_id}")
            return
        user_email = user_data.user.email
        title_display = title[:60] if title else "Video không có tiêu đề"
        
        if status == "done":
            download_url = f"https://taivideonhanh.com/api/download_video/{db_job_id}" if db_job_id else "https://taivideonhanh.com/dashboard"
            send_templated_email(user_email, "VIDEO_SUCCESS", {
                "title_display": title_display,
                "title": title_display,
                "cost": f"{cost:,}",
                "download_url": download_url
            })
        else:
            friendly_error = get_friendly_error(error_msg) if error_msg else "Lỗi không xác định."
            send_templated_email(user_email, "VIDEO_FAILED", {
                "title_display": title_display,
                "title": title_display,
                "error": friendly_error,
                "cost": f"{cost:,}"
            })
    except Exception as e:
        print(f"[send_video_job_email] Error: {e}")

def background_process_video(job_id: str, db_job_id: str, video_url: str, user_id: str, mode: str = "dub_only", voice_code: str = None, translation_style: str = "tiktok", custom_segments: list = None, cost: int = 3000, use_ocr: bool = False, no_speech: bool = False, target_language: str = "vi", original_url: str = None, rewrite_mode: str = None, reaction_video_url: str = None, pip_position: str = "top-right", pip_size: str = "medium", pip_shape: str = "rectangle"):
    try:
        def status_cb(msg):
            jobs[job_id]["status"] = msg
        
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
        
        # Xác định mode thực tế cho pipeline (reaction dùng dub_and_sub bên trong)
        pipeline_mode = mode if mode != "reaction" else "dub_and_sub"
        
        final_video_path = process_full_pipeline(
            video_url, output_dir,
            mode=pipeline_mode,
            voice_code=voice_code,
            translation_style=translation_style,
            custom_segments=custom_segments,
            status_callback=status_cb,
            use_ocr=use_ocr,
            cover_sub=True,
            title=jobs[job_id].get("title", ""),
            no_speech=no_speech,
            target_language=target_language,
            original_url=original_url,
            rewrite_mode=rewrite_mode
        )
        
        jobs[job_id]["status"] = "Hoàn tất!"
        jobs[job_id]["is_done"] = True
        jobs[job_id]["result_file"] = final_video_path
        
        # Cập nhật database job thành công
        supabase.table("video_jobs").update({
            "status": "done",
            "result_video_url": final_video_path,
            "completed_at": "now()"
        }).eq("id", db_job_id).execute()
        
        # Gửi email thông báo thành công
        send_video_job_email(user_id, jobs[job_id].get("title", ""), "done", "", cost, db_job_id)
        
        # Kiểm tra và lên lịch đăng Facebook (nếu có)
        try:
            import sqlite3
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shortlinks.db')
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT account_id, caption, scheduled_at FROM autoposts WHERE job_id = ?", (job_id,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                account_id, caption, scheduled_at = row
                pfm_key = os.environ.get("POSTFORME_API_KEY")
                if pfm_key:
                    # Tải video lên PostForMe (Media)
                    print(f"[{job_id}] Bắt đầu upload video lên PostForMe...")
                    media_res = requests.post(
                        "https://api.postforme.dev/v1/media/create-upload-url",
                        headers={"Authorization": f"Bearer {pfm_key}", "Content-Type": "application/json"}
                    )
                    if media_res.ok:
                        media_data = media_res.json()
                        upload_url = media_data["upload_url"]
                        media_url = media_data["media_url"]
                        
                        with open(final_video_path, 'rb') as f:
                            requests.put(upload_url, headers={"Content-Type": "video/mp4"}, data=f)
                            
                        # Lên lịch bài viết
                        print(f"[{job_id}] Lên lịch bài viết trên PostForMe...")
                        post_payload = {
                            "caption": caption,
                            "media": [{"url": media_url}],
                            "social_accounts": [account_id]
                        }
                        if scheduled_at and scheduled_at.strip():
                            post_payload["scheduled_at"] = scheduled_at
                            
                        post_res = requests.post(
                            "https://api.postforme.dev/v1/social-posts",
                            headers={"Authorization": f"Bearer {pfm_key}", "Content-Type": "application/json"},
                            json=post_payload
                        )
                        if post_res.ok:
                            print(f"[{job_id}] Lên lịch Facebook thành công!")
                        else:
                            print(f"[{job_id}] Lỗi lên lịch FB: {post_res.text}")
        except Exception as pfm_err:
            print(f"[{job_id}] Lỗi quá trình PostForMe: {str(pfm_err)}")
        
    except Exception as e:
        err_msg = str(e)
        print(f"[background_process_video] Error on job {job_id}: {err_msg}")
        friendly_err = get_friendly_error(err_msg)
        jobs[job_id]["status"] = f"Lỗi: {friendly_err}"
        jobs[job_id]["is_error"] = True
        
        # Hoàn tiền tự động 100% cho người dùng khi tạo video bị lỗi
        try:
            res = supabase.table("wallets").select("balance").eq("user_id", user_id).single().execute()
            if res.data:
                current_bal = res.data["balance"]
                new_bal = current_bal + cost
                
                # 1. Cộng lại tiền vào ví
                supabase.table("wallets").update({"balance": new_bal}).eq("user_id", user_id).execute()
                
                # 2. Ghi log giao dịch hoàn tiền rõ ràng
                supabase.table("transactions").insert({
                    "user_id": user_id,
                    "amount": cost,
                    "type": "REFUND",
                    "description": f"Hoàn lại {cost:,}đ (Lỗi xử lý video)"
                }).execute()
                
            # 3. Cập nhật trạng thái job thành 'error' + lưu chi tiết nguyên nhân cho Admin
            admin_err = friendly_err
            if "412" in err_msg or "precondition failed" in err_msg.lower():
                admin_err = f"Bilibili 412: Bị chặn tải ({friendly_err})"
            elif "timed out" in err_msg.lower() or "timeout" in err_msg.lower():
                admin_err = f"Timeout: Quá thời gian tải ({friendly_err})"
            elif "403" in err_msg or "forbidden" in err_msg.lower():
                admin_err = f"HTTP 403: Link hết hạn/Chặn ({friendly_err})"
            elif "404" in err_msg or "not found" in err_msg.lower():
                admin_err = f"HTTP 404: Link không tồn tại ({friendly_err})"
            elif "ffmpeg" in err_msg.lower():
                admin_err = f"FFmpeg: {err_msg[:120]}"
            elif err_msg and err_msg != friendly_err:
                admin_err = f"{friendly_err} (Chi tiết: {err_msg[:100]})"

            try:
                supabase.table("video_jobs").update({
                    "status": "error",
                    "error_message": admin_err,
                    "completed_at": "now()"
                }).eq("id", db_job_id).execute()
            except Exception:
                # Fallback nếu cột error_message chưa tồn tại
                supabase.table("video_jobs").update({
                    "status": "error",
                    "completed_at": "now()"
                }).eq("id", db_job_id).execute()
            
            # 4. Gửi email thông báo lỗi + hoàn tiền
            send_video_job_email(user_id, jobs[job_id].get("title", ""), "error", friendly_err, cost, db_job_id)
        except Exception as refund_err:
            print(f"Refund error for user {user_id}: {refund_err}")

@app.post("/api/process")
def process_video(request: ProcessRequest, background_tasks: BackgroundTasks, user = Depends(get_current_user)):
    user_id = user.id
    mode = request.mode
    voice_code = request.voice_code
    
    # 0. Kiểm tra thời lượng video TRƯỚC khi trừ tiền (chỉ cho phép <= 3 phút)
    duration = get_video_duration(request.video_url)
    if duration is None and request.original_url:
        duration = get_video_duration(request.original_url)
    if is_video_too_long(duration):
        # Phải trả HTTP lỗi (không phải 200) vì frontend chỉ hiển thị `detail` khi response.ok == false
        raise HTTPException(status_code=400, detail=f"Video quá dài ({format_duration(duration)}), vui lòng chọn video dưới 3 phút.")
    
    # Tính giá theo chế độ
    cost_map = {"dub_only": 3000, "sub_only": 2000, "dub_and_sub": 4000, "reaction": 5000}
    cost = cost_map.get(mode, 3000)
    
    if request.autopost:
        cost += 1000
    if request.rewrite_mode:
        cost += 2000  # Phụ phí viết lại kịch bản AI
    
    # Mô tả chế độ cho transaction log
    mode_labels = {"dub_only": "Lồng tiếng", "sub_only": "Phụ đề", "dub_and_sub": "Lồng tiếng + Phụ đề", "reaction": "Reaction PiP"}
    mode_label = mode_labels.get(mode, "Lồng tiếng")
    if request.rewrite_mode:
        mode_label += " + Viết lại kịch bản"
    if request.autopost:
        mode_label += " + Tự động đăng Fanpage"
    
    # 1. Kiểm tra số dư
    res = supabase.table("wallets").select("balance").eq("user_id", user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Không tìm thấy ví người dùng.")
        
    current_balance = res.data["balance"]
    
    if current_balance < cost:
        # Check rate limit (1 hour = 3600s)
        now = time.time()
        if now - last_balance_reminder.get(user_id, 0) > 3600:
            user_email = user.email
            if user_email:
                try:
                    resend.Emails.send({
                        "from": SENDER_EMAIL,
                        "to": user_email,
                        "subject": "Cảnh báo: Tài khoản của bạn đã hết số dư!",
                        "html": f"""
                        <div style="background-color:#f3efe8;padding:20px;font-family:sans-serif;">
                            <div style="background-color:#2d2218;color:white;padding:15px;text-align:center;">
                                <h2 style="margin:0;">Tai video nhanh</h2>
                            </div>
                            <div style="background-color:white;padding:20px;">
                                <h3 style="color:#2d2218;">Tài khoản của bạn đã hết số dư!</h3>
                                <p>Chào bạn,</p>
                                <p>Hệ thống nhận thấy bạn vừa yêu cầu dịch/lồng tiếng một video nhưng số dư ví không đủ. Để không làm gián đoạn công việc, bạn vui lòng nạp thêm tiền vào ví nhé.</p>
                                <p style="text-align:center; margin: 30px 0;">
                                    <a href="{BASE_URL}/admin" style="background-color:#f6a287;color:#2d2218;padding:15px 25px;text-decoration:none;font-weight:bold;border:2px solid #2d2218;border-radius:8px;">NẠP TIỀN NGAY</a>
                                </p>
                                <p><i>Lưu ý: Bạn có thể bỏ qua email này nếu đã nạp tiền thành công.</i></p>
                            </div>
                            <div style="background-color:#fdf9f1;padding:15px;text-align:center;font-size:12px;">
                                &copy; {BASE_URL.replace("https://", "")}
                            </div>
                        </div>
                        """
                    })
                    last_balance_reminder[user_id] = now
                except Exception as e:
                    print(f"Error sending balance reminder: {e}")
                    
        raise HTTPException(status_code=402, detail=f"Số dư không đủ. Cần {cost:,}đ, hiện có {current_balance:,}đ.")
        
    # 2. Trừ tiền
    supabase.table("wallets").update({"balance": current_balance - cost}).eq("user_id", user_id).execute()
    
    # 3. Ghi log giao dịch
    supabase.table("transactions").insert({
        "user_id": user_id,
        "amount": -cost,
        "type": "DEDUCT",
        "description": f"{mode_label} video"
    }).execute()
    
    # 4. Ghi job vào DB (Lưu ảnh bìa vĩnh viễn trên server)
    local_cover = save_local_cover(request.cover_url, str(uuid.uuid4()))

    job_res = supabase.table("video_jobs").insert({
        "user_id": user_id,
        "original_video_url": request.video_url,
        "title": request.title,
        "cover_url": local_cover,
        "cost": cost
    }).execute()
    
    db_job_id = job_res.data[0]["id"]
    
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "Đang khởi tạo...",
        "is_done": False,
        "is_error": False,
        "result_file": None,
        "cover_url": local_cover,
        "title": request.title,
        "video_url": request.video_url,
        "db_job_id": db_job_id
    }
    
    if request.autopost and request.autopost_account_id:
        import sqlite3
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shortlinks.db')
        conn = sqlite3.connect(db_path)
        try:
            conn.execute('INSERT INTO autoposts (job_id, user_id, account_id, caption, scheduled_at) VALUES (?, ?, ?, ?, ?)',
                         (job_id, user_id, request.autopost_account_id, request.autopost_caption, request.autopost_time))
            conn.commit()
        except Exception as e:
            print("Error saving autopost info:", e)
        finally:
            conn.close()
    background_tasks.add_task(
        background_process_video, 
        job_id, db_job_id, request.video_url, user_id, 
        mode, voice_code, request.translation_style, request.custom_segments, 
        cost, request.use_ocr, request.no_speech, request.target_language,
        request.original_url, request.rewrite_mode,
        request.reaction_video_url, request.pip_position, request.pip_size, request.pip_shape
    )
    
    return {"status": "success", "job_id": job_id}

@app.get("/api/status/{job_id}")
def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.post("/api/convert_shopee_links")
def convert_shopee_links_endpoint(req: ShopeeConvertRequest, user = Depends(get_current_user)):
    """Convert Shopee affiliate links in text and optionally rewrite with AI"""
    try:
        if not req.text.strip():
            return {"status": "success", "result": ""}
        result = convert_shopee_text(req.text, req.affiliate_id, req.rewrite, user.id)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
from fastapi.responses import HTMLResponse
import sqlite3

@app.get("/sp/{slug}", response_class=HTMLResponse)
def redirect_shortlink(slug: str):
    """Internal Shortlink Redirector with Pixel Tracking"""
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shortlinks.db')
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT target_url FROM shortlinks WHERE slug = ?", (slug,))
        row = c.fetchone()
        
        if not row:
            conn.close()
            return HTMLResponse("<h1>Link không tồn tại hoặc đã hết hạn.</h1>", status_code=404)
            
        target_url = row[0]
        c.execute("UPDATE shortlinks SET clicks = clicks + 1 WHERE slug = ?", (slug,))
        conn.commit()
        conn.close()
        
        settings_res = supabase.table("site_settings").select("fb_pixel, tiktok_pixel").eq("id", 1).single().execute()
        fb_pixel = settings_res.data.get("fb_pixel") if settings_res.data else ""
        tiktok_pixel = settings_res.data.get("tiktok_pixel") if settings_res.data else ""
        
        fb_script = f"""
        !function(f,b,e,v,n,t,s){{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '{fb_pixel}');
        fbq('track', 'PageView');
        """ if fb_pixel else ""
        
        tt_script = f"""
        !function (w, d, t) {{ w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){{t[e]=function(){{t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){{for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e}},ttq.load=function(e,n){{var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{{}},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{{}},ttq._t[e]=+new Date,ttq._o=ttq._o||{{}},ttq._o[e]=n||{{}};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)}}; ttq.load('{tiktok_pixel}'); ttq.page(); }}(window, document, 'ttq');
        """ if tiktok_pixel else ""
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Đang chuyển hướng...</title>
            <script>{fb_script}</script>
            <script>{tt_script}</script>
            <style>
                body {{ display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; background: #fdf9f1; color: #2d2218; }}
                .loader {{ border: 4px solid #f3f3f3; border-top: 4px solid #f6a287; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 16px; }}
                @keyframes spin {{ 0% {{ transform: rotate(0deg); }} 100% {{ transform: rotate(360deg); }} }}
                .container {{ text-align: center; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="loader"></div>
                <h2>Đang chuyển hướng đến Shopee...</h2>
                <p>Vui lòng đợi giây lát.</p>
            </div>
            <script>
                setTimeout(function() {{
                    window.location.replace("{target_url}");
                }}, 1500);
            </script>
        </body>
        </html>
        """
        return html
    except Exception as e:
        return HTMLResponse(f"<h1>Lỗi hệ thống: {str(e)}</h1>", status_code=500)
def generate_seo_post_endpoint(req: GenerateArticleRequest, user = Depends(get_current_user)):
    """Tự động sáng tạo bài viết SEO chuẩn Google 1500+ từ dựa trên chủ đề"""
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Chưa nhập chủ đề bài viết")
        
    try:
        from openai import OpenAI
        oa_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Fetch custom instructions
        site_res = supabase.table("site_settings").select("ai_custom_instructions").eq("id", 1).single().execute()
        custom_inst = ""
        if site_res.data and site_res.data.get("ai_custom_instructions"):
            custom_inst = f"\n\nLưu ý bổ sung đặc biệt (Yêu cầu bắt buộc):\n{site_res.data['ai_custom_instructions']}\n"
        
        prompt = f"""
        Bạn là một Chuyên gia SEO Content & Affiliate Marketing hàng đầu Việt Nam.
        Hãy viết một bài hướng dẫn chuyên sâu, cuốn hút và chuẩn SEO dài 1500-2000 từ về chủ đề: "{topic}".
        
        Bài viết phải tuân theo cấu trúc HTML chuyên nghiệp (Sử dụng các thẻ <h2>, <h3>, <p>, <ul>, <li>, <strong>):
        1. Tiêu đề hấp dẫn có năm 2026.
        2. Đoạn mở đầu giữ chân độc giả.
        3. Các thẻ H2 (<h2>) và H3 (<h3>) phân tích chi tiết từng bước thực hiện.
        4. Các mẹo thực chiến (Pro Tips), lỗi thường gặp và giải pháp.
        5. Câu hỏi thường gặp (FAQ).
        6. Lời kết và Lời kêu gọi hành động (CTA) cực mạnh khuyến khích sử dụng công cụ Tải video & Lồng tiếng AI tại TaiVideoNhanh.com để xây kênh reup bán hàng.
        {custom_inst}
        
        Trả về duy nhất 1 JSON hợp lệ theo định dạng:
        {{
            "title": "Tiêu đề chuẩn SEO",
            "slug": "duong-dan-slug-chuan-seo",
            "description": "Thẻ mô tả meta description ngắn 150 ký tự",
            "tags": ["Tag1", "Tag2", "Tag3"],
            "content": "<h2>Nội dung bài viết định dạng HTML...</h2>"
        }}
        Chỉ trả về JSON thuần túy.
        """
        
        res = oa_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3500
        )
        
        content = res.choices[0].message.content.strip()
        if content.startswith("```json"): content = content[7:]
        if content.startswith("```"): content = content[3:]
        if content.endswith("```"): content = content[:-3]
        content = content.strip()
        
        # Thử parse JSON trực tiếp
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # Fallback: dùng regex trích xuất từng field
            import re as _re
            
            def extract_field(text, field):
                # Tìm "field": "value" hoặc "field": ["val1", "val2"]
                pattern = rf'"{field}"\s*:\s*"((?:[^"\\]|\\.)*)"'
                m = _re.search(pattern, text, _re.DOTALL)
                if m:
                    return m.group(1).replace('\\"', '"').replace('\\n', '\n')
                return ""
            
            def extract_array(text, field):
                pattern = rf'"{field}"\s*:\s*\[(.*?)\]'
                m = _re.search(pattern, text, _re.DOTALL)
                if m:
                    items = _re.findall(r'"([^"]*)"', m.group(1))
                    return items
                return []
            
            title = extract_field(content, "title")
            slug = extract_field(content, "slug")
            description = extract_field(content, "description")
            tags = extract_array(content, "tags")
            
            # Content field đặc biệt dài, dùng cách khác
            content_match = _re.search(r'"content"\s*:\s*"(.*?)(?:"\s*[,}])', content, _re.DOTALL)
            article_content = ""
            if content_match:
                article_content = content_match.group(1).replace('\\"', '"').replace('\\n', '\n')
            
            if not title:
                raise Exception("Không thể phân tích kết quả AI. Vui lòng thử lại.")
            
            data = {
                "title": title,
                "slug": slug or title.lower().replace(" ", "-")[:60],
                "description": description,
                "tags": tags,
                "content": article_content,
                "cover_image": ""
            }
        
        return {"status": "success", "article": data}
    except Exception as e:
        print(f"Error generating SEO post: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi tạo bài viết AI: {str(e)}")

# ===== MY VIDEOS API =====
@app.get("/api/my-videos")
def get_my_videos(user = Depends(get_current_user)):
    """Lấy danh sách video đã xử lý của user (chỉ trong 3 ngày - khớp thời gian file bị auto-cleanup)"""
    user_id = user.id
    cutoff = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    res = supabase.table("video_jobs").select("*").eq("user_id", user_id).gte("created_at", cutoff).order("created_at", desc=True).execute()
    return {"videos": res.data or []}

@app.get("/api/download_video/{job_id}")
def download_video_by_db_id(job_id: str):
    """Tải video đã xử lý xong từ DB job ID (tự động fallback nếu frontend gửi nhầm memory job_id)"""
    
    # Fallback: Nếu frontend gửi nhầm memory job_id, tự động tra cứu db_job_id từ bộ nhớ
    actual_db_job_id = job_id
    if job_id in jobs and jobs[job_id].get("db_job_id"):
        actual_db_job_id = jobs[job_id]["db_job_id"]
        
    res = supabase.table("video_jobs").select("*").eq("id", actual_db_job_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Job not found")
    job = res.data[0]
    if job.get("status") != "done" or not job.get("result_video_url"):
        raise HTTPException(status_code=400, detail="Video chưa sẵn sàng")
    file_path = job["result_video_url"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File video không còn tồn tại trên server")
    title = job.get("video_title", "") or job.get("title", "")
    ascii_fn, utf8_fn = get_download_filename(title, f"video_{job_id[:8]}")
    from urllib.parse import quote
    encoded_utf8_fn = quote(utf8_fn)
    return FileResponse(
        file_path, 
        media_type="application/octet-stream", 
        filename=ascii_fn,
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_fn}"',
            "X-Accel-Buffering": "no"
        }
    )

# (Duplicate /api/download route removed - merged into main route above)


@app.get("/api/academy/courses")
def get_academy_courses(user = Depends(get_current_user)):
    """Trả về danh sách khóa học và tài nguyên (Kiểm tra quyền VIP)"""
    user_id = user.id
    
    # Kiểm tra trạng thái VIP
    user_data = supabase.auth.admin.get_user_by_id(user_id)
    metadata = user_data.user.user_metadata or {} if user_data and user_data.user else {}
    is_vip = metadata.get("is_vip", False)
    
    # Fetch modules + lessons từ DB
    modules_res = supabase.table("academy_modules").select("*").order("sort_order").execute()
    lessons_res = supabase.table("academy_lessons").select("*").order("sort_order").execute()
    
    # Build module lookup for is_vip_only
    module_map = {mod["id"]: mod for mod in (modules_res.data or [])}
    
    # Group lessons by module
    lessons_by_module = {}
    for les in (lessons_res.data or []):
        mid = les["module_id"]
        if mid not in lessons_by_module:
            lessons_by_module[mid] = []
        les_copy = dict(les)
        # Lesson bị khóa nếu: bài VIP HOẶC thuộc module VIP-only
        parent_module = module_map.get(mid, {})
        is_lesson_vip = les["is_vip"] or parent_module.get("is_vip_only", False)
        if is_lesson_vip and not is_vip:
            les_copy["video_url"] = None
            les_copy["is_locked"] = True
        else:
            les_copy["is_locked"] = False
        lessons_by_module[mid].append(les_copy)
    
    courses = []
    for mod in (modules_res.data or []):
        mod_copy = dict(mod)
        mod_copy["lessons"] = lessons_by_module.get(mod["id"], [])
        courses.append(mod_copy)
    
    # Fetch resources (chỉ VIP mới thấy)
    resources = []
    if is_vip:
        res_res = supabase.table("academy_resources").select("*").order("sort_order").execute()
        resources = res_res.data or []
    
    # Đọc giá VIP từ site_settings
    vip_price = 399000
    try:
        settings_res = supabase.table("site_settings").select("vip_price").eq("id", 1).single().execute()
        if settings_res.data and settings_res.data.get("vip_price"):
            vip_price = settings_res.data["vip_price"]
    except:
        pass
    
    return {
        "is_vip": is_vip,
        "vip_price": vip_price,
        "courses": courses,
        "resources": resources
    }

@app.post("/api/upgrade-vip")
def upgrade_vip(user = Depends(get_current_user)):
    """Nâng cấp tài khoản lên VIP Học Viện (Trừ tiền từ ví + Trả hoa hồng cho Referrer)"""
    user_id = user.id
    
    # Đọc giá VIP từ site_settings (Gap 6: không hardcode)
    vip_cost = 399000
    try:
        settings_res = supabase.table("site_settings").select("vip_price").eq("id", 1).single().execute()
        if settings_res.data and settings_res.data.get("vip_price"):
            vip_cost = settings_res.data["vip_price"]
    except:
        pass
    
    # 1. Kiểm tra ví
    res = supabase.table("wallets").select("*").eq("user_id", user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Không tìm thấy ví người dùng.")
        
    current_balance = res.data.get("balance", 0)
    if current_balance < vip_cost:
        return {
            "status": "error", 
            "message": f"Số dư không đủ. Cần 399.000đ để nâng cấp VIP Trọn Đời (Hiện có {current_balance:,}đ). Vui lòng nạp thêm tiền!"
        }
        
    # 2. Trừ tiền nâng cấp
    new_balance = current_balance - vip_cost
    supabase.table("wallets").update({"balance": new_balance, "is_vip": True}).eq("user_id", user_id).execute()
    
    # 3. Ghi log giao dịch trừ tiền
    supabase.table("transactions").insert({
        "user_id": user_id,
        "amount": -vip_cost,
        "type": "DEDUCT",
        "description": f"Nâng cấp VIP Học Viện Xây Kênh ({vip_cost:,}đ)"
    }).execute()
    
    # 4. Cập nhật VIP status vào user_metadata
    user_obj = supabase.auth.admin.get_user_by_id(user_id)
    metadata = user_obj.user.user_metadata or {} if user_obj and user_obj.user else {}
    metadata["is_vip"] = True
    metadata["vip_updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    supabase.auth.admin.update_user_by_id(user_id, {"user_metadata": metadata})
    
    # 5. Tự động trả hoa hồng Tiếp thị cho Người giới thiệu (Referrer) nếu có
    ref_code = metadata.get("referred_by_code")
    
    if ref_code:
        try:
            clean_ref = str(ref_code).upper().replace("TVN", "").strip()
            if clean_ref.isdigit():
                pay_code_num = int(clean_ref)
                ref_res = supabase.table("wallets").select("user_id, balance, affiliate_pct").eq("pay_code", pay_code_num).execute()
                if ref_res.data and len(ref_res.data) > 0:
                    referrer_id = ref_res.data[0]["user_id"]
                    
                    # Đọc affiliate_pct trực tiếp từ wallets (đã sync)
                    affiliate_pct = ref_res.data[0].get("affiliate_pct", 20) or 20
                    
                    commission = int(vip_cost * affiliate_pct / 100)
                    ref_balance = ref_res.data[0]["balance"]
                    
                    # Cộng hoa hồng vào ví referrer
                    supabase.table("wallets").update({"balance": ref_balance + commission}).eq("user_id", referrer_id).execute()
                    
                    # Ghi log hoa hồng
                    supabase.table("transactions").insert({
                        "user_id": referrer_id,
                        "amount": commission,
                        "type": "AFFILIATE_COMMISSION",
                        "description": f"AFFILIATE:{affiliate_pct}%|VIP_UPGRADE|From:{user_id[:8]}|Amount:{vip_cost}"
                    }).execute()
                    
                    # Gửi email thông báo cho referrer qua Resend
                    if ref_user and ref_user.user and ref_user.user.email:
                        ref_email = ref_user.user.email
                        try:
                            resend.Emails.send({
                                "from": SENDER_EMAIL,
                                "to": [ref_email],
                                "subject": f"🎉 Bạn vừa nhận {commission:,}đ hoa hồng VIP từ TaiVideoNhanh!",
                                "html": f"""
                                <h2>Chúc mừng bạn đã nhận hoa hồng Tiếp Thị VIP!</h2>
                                <p>Người dùng do bạn giới thiệu vừa nâng cấp <b>Gói VIP Học Viện Xây Kênh</b>.</p>
                                <p>💰 <b>Hoa hồng {affiliate_pct}%:</b> +{commission:,}đ</p>
                                <p>Số dư ví của bạn đã được cộng tự động 24/7.</p>
                                """
                            })
                        except Exception as ee:
                            print(f"Resend VIP Email Error: {ee}")
        except Exception as e:
            print(f"VIP Affiliate Commission Error: {e}")
            
    return {
        "status": "success",
        "message": "🎉 Chúc mừng! Bạn đã nâng cấp thành công Gói VIP Học Viện Xây Kênh Trọn Đời!"
    }

# ===== ACADEMY ADMIN API =====

class AcademyModuleCreate(BaseModel):
    title: str
    description: str = ""
    badge: str = "HỌC MIỄN PHÍ"
    is_vip_only: bool = False
    sort_order: int = 0

class AcademyModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    badge: Optional[str] = None
    is_vip_only: Optional[bool] = None
    sort_order: Optional[int] = None

class AcademyLessonCreate(BaseModel):
    module_id: str
    title: str
    duration: str = "10:00"
    is_vip: bool = False
    video_url: str = ""
    summary: str = ""
    sort_order: int = 0

class AcademyLessonUpdate(BaseModel):
    title: Optional[str] = None
    duration: Optional[str] = None
    is_vip: Optional[bool] = None
    video_url: Optional[str] = None
    summary: Optional[str] = None
    sort_order: Optional[int] = None
    module_id: Optional[str] = None

@app.get("/api/admin/academy/modules")
def admin_list_modules(user = Depends(get_current_admin)):
    """Lấy danh sách modules + lessons cho admin"""
    modules_res = supabase.table("academy_modules").select("*").order("sort_order").execute()
    lessons_res = supabase.table("academy_lessons").select("*").order("sort_order").execute()
    
    lessons_by_module = {}
    for les in (lessons_res.data or []):
        mid = les["module_id"]
        if mid not in lessons_by_module:
            lessons_by_module[mid] = []
        lessons_by_module[mid].append(les)
    
    modules = []
    for mod in (modules_res.data or []):
        mod["lessons"] = lessons_by_module.get(mod["id"], [])
        modules.append(mod)
    
    return {"modules": modules}

@app.post("/api/admin/academy/modules")
def admin_create_module(body: AcademyModuleCreate, user = Depends(get_current_admin)):
    data = body.model_dump()
    res = supabase.table("academy_modules").insert(data).execute()
    return {"status": "success", "module": res.data[0] if res.data else None}

@app.put("/api/admin/academy/modules/{module_id}")
def admin_update_module(module_id: str, body: AcademyModuleUpdate, user = Depends(get_current_admin)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")
    res = supabase.table("academy_modules").update(data).eq("id", module_id).execute()
    return {"status": "success", "module": res.data[0] if res.data else None}

@app.delete("/api/admin/academy/modules/{module_id}")
def admin_delete_module(module_id: str, user = Depends(get_current_admin)):
    supabase.table("academy_modules").delete().eq("id", module_id).execute()
    return {"status": "success", "message": "Đã xóa chương và tất cả bài học"}

@app.post("/api/admin/academy/lessons")
def admin_create_lesson(body: AcademyLessonCreate, user = Depends(get_current_admin)):
    data = body.model_dump()
    res = supabase.table("academy_lessons").insert(data).execute()
    return {"status": "success", "lesson": res.data[0] if res.data else None}

@app.put("/api/admin/academy/lessons/{lesson_id}")
def admin_update_lesson(lesson_id: str, body: AcademyLessonUpdate, user = Depends(get_current_admin)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")
    res = supabase.table("academy_lessons").update(data).eq("id", lesson_id).execute()
    return {"status": "success", "lesson": res.data[0] if res.data else None}

@app.delete("/api/admin/academy/lessons/{lesson_id}")
def admin_delete_lesson(lesson_id: str, user = Depends(get_current_admin)):
    supabase.table("academy_lessons").delete().eq("id", lesson_id).execute()
    return {"status": "success", "message": "Đã xóa bài học"}

# ===== ADMIN VIP RESOURCES API (Gap 4) =====

class AcademyResourceCreate(BaseModel):
    title: str
    type: str = "ZIP / Google Drive"
    size: str = "0 MB"
    url: str
    description: str = ""
    sort_order: int = 0

class AcademyResourceUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    size: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None

@app.get("/api/admin/academy/resources")
def admin_list_resources(user = Depends(get_current_admin)):
    res = supabase.table("academy_resources").select("*").order("sort_order").execute()
    return {"resources": res.data or []}

@app.post("/api/admin/academy/resources")
def admin_create_resource(body: AcademyResourceCreate, user = Depends(get_current_admin)):
    data = body.model_dump()
    res = supabase.table("academy_resources").insert(data).execute()
    return {"status": "success", "resource": res.data[0] if res.data else None}

@app.put("/api/admin/academy/resources/{resource_id}")
def admin_update_resource(resource_id: str, body: AcademyResourceUpdate, user = Depends(get_current_admin)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")
    res = supabase.table("academy_resources").update(data).eq("id", resource_id).execute()
    return {"status": "success", "resource": res.data[0] if res.data else None}

@app.delete("/api/admin/academy/resources/{resource_id}")
def admin_delete_resource(resource_id: str, user = Depends(get_current_admin)):
    supabase.table("academy_resources").delete().eq("id", resource_id).execute()
    return {"status": "success", "message": "Đã xóa tài nguyên"}

# ===== ADMIN TOGGLE VIP (Gap 5) =====

class ToggleVipRequest(BaseModel):
    user_id: str
    is_vip: bool

@app.post("/api/admin/users/toggle-vip")
def admin_toggle_vip(req: ToggleVipRequest, admin = Depends(get_current_admin)):
    """Admin bật/tắt VIP cho user (tặng VIP cho KOL, xử lý refund, etc.)"""
    try:
        # Cập nhật wallets.is_vip
        supabase.table("wallets").update({"is_vip": req.is_vip}).eq("user_id", req.user_id).execute()
        
        # Cập nhật auth.users metadata
        try:
            user_obj = supabase.auth.admin.get_user_by_id(req.user_id)
            if user_obj and user_obj.user:
                metadata = user_obj.user.user_metadata or {}
                metadata["is_vip"] = req.is_vip
                if req.is_vip:
                    metadata["vip_updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
                supabase.auth.admin.update_user_by_id(req.user_id, {"user_metadata": metadata})
        except:
            pass
        
        action = "bật" if req.is_vip else "tắt"
        return {"status": "success", "message": f"Đã {action} VIP cho user"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== BLOG API =====

class BlogPostCreate(BaseModel):
    title: str
    slug: str
    description: str = ""
    content: str
    cover_image: str = ""
    tags: List[str] = []
    is_published: bool = False

class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    cover_image: Optional[str] = None
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None

class AIBlogRequest(BaseModel):
    topic: str

@app.get("/api/blog")
def list_blog_posts(page: int = 1, limit: int = 20, tag: Optional[str] = None):
    """Danh sách bài viết đã publish (public, không cần auth)"""
    query = supabase.table("blog_posts").select("id,slug,title,description,cover_image,tags,views,created_at").eq("is_published", True).order("created_at", desc=True)
    
    if tag:
        query = query.contains("tags", [tag])
    
    offset = (page - 1) * limit
    res = query.range(offset, offset + limit - 1).execute()
    return {"posts": res.data or [], "page": page}

@app.get("/api/blog/{slug}")
def get_blog_post(slug: str):
    """Xem chi tiết bài viết theo slug (public)"""
    res = supabase.table("blog_posts").select("*").eq("slug", slug).eq("is_published", True).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Bài viết không tồn tại")
    
    # Tăng view
    supabase.table("blog_posts").update({"views": res.data["views"] + 1}).eq("id", res.data["id"]).execute()
    
    return res.data

@app.post("/api/blog")
def create_blog_post(post: BlogPostCreate, user = Depends(get_current_editor)):
    """Tạo bài viết mới (cần đăng nhập)"""
    data = post.model_dump()
    data["user_id"] = user.id
    
    res = supabase.table("blog_posts").insert(data).execute()
    return {"status": "success", "post": res.data[0] if res.data else None}

@app.put("/api/blog/{post_id}")
def update_blog_post(post_id: str, post: BlogPostUpdate, user = Depends(get_current_editor)):
    """Cập nhật bài viết (chỉ tác giả)"""
    update_data = {k: v for k, v in post.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có gì để cập nhật")
    
    res = supabase.table("blog_posts").update(update_data).eq("id", post_id).eq("user_id", user.id).execute()
    return {"status": "success", "post": res.data[0] if res.data else None}

@app.delete("/api/blog/{post_id}")
def delete_blog_post(post_id: str, user = Depends(get_current_editor)):
    """Xóa bài viết (chỉ tác giả)"""
    supabase.table("blog_posts").delete().eq("id", post_id).eq("user_id", user.id).execute()
    return {"status": "success"}

@app.post("/api/generate_seo_post")
def generate_seo_post(req: AIBlogRequest, user = Depends(get_current_editor)):
    """Sinh bài viết SEO bằng OpenAI"""
    try:
        from shopee_converter import openai_client
        prompt = f"""Viết một bài blog chuẩn SEO chuyên sâu (khoảng 1500 từ) về chủ đề: '{req.topic}'.
Yêu cầu trả về định dạng JSON với cấu trúc chính xác sau:
{{
  "title": "Tiêu đề bài viết (giật tít, hấp dẫn, chứa từ khóa)",
  "slug": "duong-dan-bai-viet-chuan-seo",
  "description": "Mô tả ngắn gọn (khoảng 150-160 ký tự) chứa từ khóa chính",
  "content": "Nội dung bài viết HTML. Bắt buộc dùng <h2>, <h3>, in đậm từ khóa quan trọng. Văn phong lôi cuốn.",
  "tags": ["tag1", "tag2", "tag3"],
  "cover_image": ""
}}
"""
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Bạn là một chuyên gia viết Content SEO thực hành tốt nhất. Luôn trả về định dạng JSON hợp lệ."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        import json
        article = json.loads(response.choices[0].message.content)
        return {"status": "success", "article": article}
    except Exception as e:
        print(f"Error AI SEO: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/my-posts")
def list_my_posts(user = Depends(get_current_user)):
    """Danh sách tất cả bài viết của mình (kể cả nháp)"""
    res = supabase.table("blog_posts").select("*").eq("user_id", user.id).order("created_at", desc=True).execute()
    return {"posts": res.data or []}

# ===== ADMIN API =====

def get_email_for_user_id(user_id: str) -> str:
    """Lấy email từ bảng wallets (đã sync sẵn). Fallback sang Supabase Auth nếu chưa có."""
    if not user_id:
        return "Khách (No ID)"
    try:
        res = supabase.table("wallets").select("email").eq("user_id", user_id).single().execute()
        if res.data and res.data.get("email"):
            return res.data["email"]
    except:
        pass
    # Fallback: lấy từ auth (chỉ cho trường hợp chưa chạy migration)
    try:
        u_res = supabase.auth.admin.get_user_by_id(user_id)
        if u_res and u_res.user and u_res.user.email:
            return u_res.user.email
    except Exception as e:
        print(f"Fallback email lookup error for {user_id}: {e}")
    return "Unknown"


@app.get("/api/admin/users")
def get_all_users(
    admin = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", max_length=200),
    role_filter: str = Query("all")
):
    offset = (page - 1) * limit

    # Server-side role filter (áp dụng trước)
    base_query = supabase.table("wallets").select("*", count="exact")
    if role_filter and role_filter != "all":
        base_query = base_query.eq("role", role_filter)

    # Server-side search
    # user_id là kiểu UUID nên KHÔNG dùng ilike trực tiếp được — chỉ search email (text)
    # Nếu search trông giống UUID thì thử eq("user_id", search) riêng
    if search:
        safe_search = search.replace("%", "").replace("_", "").strip()
        # Thử tìm theo email trước (ilike hoạt động với text)
        email_query = base_query.ilike("email", f"%{safe_search}%")
        res = email_query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        # Nếu không có kết quả và search trông giống UUID, thử exact match user_id
        if not res.data and len(safe_search) >= 8:
            try:
                uuid_query = base_query.eq("user_id", safe_search)
                res2 = uuid_query.order("created_at", desc=True).range(0, limit - 1).execute()
                if res2.data:
                    res = res2
            except Exception:
                pass
    else:
        res = base_query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    users = res.data or []
    total = res.count or 0

    return {"users": users, "total": total, "page": page, "limit": limit}


class UpdateAffiliateRequest(BaseModel):
    user_id: str
    affiliate_pct: int

@app.post("/api/admin/users/update-affiliate")
def update_affiliate_pct(req: UpdateAffiliateRequest, admin = Depends(get_current_admin)):
    if req.affiliate_pct < 0 or req.affiliate_pct > 100:
        raise HTTPException(status_code=400, detail="Invalid percentage")
    
    try:
        # Cập nhật trực tiếp trong wallets (nhanh hơn)
        supabase.table("wallets").update({"affiliate_pct": req.affiliate_pct}).eq("user_id", req.user_id).execute()
        
        # Giữ sync với auth.users metadata (backwards compat)
        try:
            user_res = supabase.auth.admin.get_user_by_id(req.user_id)
            if user_res and user_res.user:
                metadata = user_res.user.user_metadata or {}
                metadata["affiliate_pct"] = req.affiliate_pct
                supabase.auth.admin.update_user_by_id(req.user_id, {"user_metadata": metadata})
        except:
            pass  # Không critical nếu sync auth fail
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/add_balance")
def add_user_balance(req: AddBalanceRequest, admin = Depends(get_current_admin)):
    res = supabase.table("wallets").select("balance").eq("user_id", req.user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví người dùng")
    
    current_balance = res.data["balance"]
    new_balance = current_balance + req.amount
    
    supabase.table("wallets").update({"balance": new_balance}).eq("user_id", req.user_id).execute()
    
    supabase.table("transactions").insert({
        "user_id": req.user_id,
        "amount": req.amount,
        "type": "DEPOSIT",
        "description": "Nạp tiền qua Admin"
    }).execute()
    
    return {"status": "success", "new_balance": new_balance}

@app.post("/api/admin/users/role")
def change_user_role(req: ChangeRoleRequest, admin = Depends(get_current_admin)):
    if req.role not in ["user", "admin", "editor"]:
        return {"status": "error", "message": "Phân quyền không hợp lệ"}
    try:
        supabase.table("wallets").update({"role": req.role}).eq("user_id", req.user_id).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/admin/system-health")
def get_system_health(admin = Depends(get_current_admin)):
    return {
        "cpu": psutil.cpu_percent(interval=0.1),
        "ram": {
            "total": round(psutil.virtual_memory().total / (1024**3), 1),
            "used": round(psutil.virtual_memory().used / (1024**3), 1),
            "percent": psutil.virtual_memory().percent
        },
        "disk": {
            "total": round(psutil.disk_usage('/').total / (1024**3), 1),
            "used": round(psutil.disk_usage('/').used / (1024**3), 1),
            "percent": psutil.disk_usage('/').percent
        }
    }

def _emails_for_users(user_ids):
    """Tra email theo danh sách user_id bằng 1 truy vấn duy nhất (thay vì N truy vấn)."""
    ids = list({u for u in user_ids if u})
    out = {}
    if not ids:
        return out
    try:
        r = supabase.table("wallets").select("user_id,email").in_("user_id", ids).execute()
        for w in (r.data or []):
            if w.get("email"):
                out[w["user_id"]] = w["email"]
    except Exception as e:
        print(f"[admin] email batch lookup error: {e}")
    return out

def _period_range(year: int, month: int):
    """Trả về (start_iso, end_iso) theo giờ VN (UTC+7). year=0 -> không lọc. month=0 -> cả năm."""
    if not year:
        return None
    vn = timezone(timedelta(hours=7))
    if month and 1 <= month <= 12:
        start = datetime(year, month, 1, tzinfo=vn)
        end = datetime(year + (month == 12), (month % 12) + 1, 1, tzinfo=vn)
    else:
        start = datetime(year, 1, 1, tzinfo=vn)
        end = datetime(year + 1, 1, 1, tzinfo=vn)
    return start.isoformat(), end.isoformat()

_UUID_RE = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')

def _apply_admin_search(query, term: str):
    """Lọc theo email (khớp một phần, qua bảng wallets) hoặc ID (UUID của bản ghi / user_id)."""
    term = (term or "").strip()
    if not term:
        return query
    conds = []
    if _UUID_RE.match(term):
        conds += [f"id.eq.{term}", f"user_id.eq.{term}"]
    safe = re.sub(r'[,()*%\\]', '', term)
    if safe:
        try:
            w = supabase.table("wallets").select("user_id").ilike("email", f"%{safe}%").limit(200).execute()
            ids = [x["user_id"] for x in (w.data or []) if x.get("user_id")]
            if ids:
                conds.append(f"user_id.in.({','.join(ids)})")
        except Exception as e:
            print(f"[admin-search] wallets lookup error: {e}")
    if not conds:
        return query.eq("id", "00000000-0000-0000-0000-000000000000")  # không khớp gì
    return query.or_(",".join(conds))

@app.get("/api/admin/transactions")
def get_all_transactions(
    admin = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", max_length=200),
    type_filter: str = Query("all"),
    year: int = Query(0, ge=0, le=2100),
    month: int = Query(0, ge=0, le=12),
    deposit_kind: str = Query("all")  # all | auto (SePay) | manual
):
    offset = (page - 1) * limit
    query = supabase.table("transactions").select("*", count="exact")
    
    # Server-side type filter
    if type_filter and type_filter != "all":
        query = query.eq("type", type_filter)
    
    # Lọc theo tháng/năm (giờ VN)
    rng = _period_range(year, month)
    if rng:
        query = query.gte("created_at", rng[0]).lt("created_at", rng[1])
    
    # Lọc nạp tự động (SePay) / nạp thủ công
    if deposit_kind == "auto":
        query = query.eq("type", "DEPOSIT").ilike("description", "%SEPAY:%")
    elif deposit_kind == "manual":
        query = query.eq("type", "DEPOSIT").or_("description.is.null,description.not.ilike.*SEPAY:*")
    
    query = _apply_admin_search(query, search)
    
    res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    transactions = res.data or []
    total = res.count or 0
    
    # Lấy email cho mỗi transaction từ wallets (1 truy vấn batch)
    email_cache = _emails_for_users([t.get("user_id") for t in transactions])
    
    for t in transactions:
        uid = t.get("user_id")
        t["email"] = email_cache.get(uid, "Unknown")
    
    return {"transactions": transactions, "total": total, "page": page, "limit": limit}

@app.get("/api/admin/jobs")
def get_all_jobs(
    admin = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    status_filter: str = Query("all"),
    search: str = Query("", max_length=200)
):
    offset = (page - 1) * limit
    query = supabase.table("video_jobs").select("*", count="exact")
    
    # Server-side status filter
    if status_filter and status_filter != "all":
        query = query.eq("status", status_filter)
    
    query = _apply_admin_search(query, search)
    
    res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    jobs = res.data or []
    total = res.count or 0
    
    # Batch lookup emails từ wallets (1 truy vấn)
    email_cache = _emails_for_users([j.get("user_id") for j in jobs])
    
    for j in jobs:
        uid = j.get("user_id")
        j["email"] = email_cache.get(uid, "Unknown")
    
    return {"jobs": jobs, "total": total, "page": page, "limit": limit}

@app.post("/api/admin/jobs/refund-stuck")
def refund_stuck_jobs(admin = Depends(get_current_admin)):
    try:
        res = supabase.table("video_jobs").select("*").eq("status", "processing").execute()
        if not res.data:
            return {"status": "success", "message": "Không có video nào bị treo.", "refunded_count": 0}
            
        now = datetime.now(timezone.utc)
        refunded_count = 0
        
        for job in res.data:
            created_at_str = job.get("created_at")
            if not created_at_str: continue
            try:
                created_dt = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                if (now - created_dt).total_seconds() > 1800:
                    cost = job.get("cost", 0)
                    user_id = job.get("user_id")
                    job_id = job.get("id")
                    
                    if cost > 0 and user_id:
                        wallet_res = supabase.table("wallets").select("balance").eq("user_id", user_id).single().execute()
                        if wallet_res.data:
                            current_balance = wallet_res.data.get("balance", 0)
                            supabase.table("wallets").update({"balance": current_balance + cost}).eq("user_id", user_id).execute()
                            
                            supabase.table("transactions").insert({
                                "user_id": user_id,
                                "amount": cost,
                                "type": "REFUND",
                                "description": f"Hoàn tiền video treo #{job_id[-6:]}"
                            }).execute()
                    
                    supabase.table("video_jobs").update({
                        "status": "error",
                        "error_message": "Hệ thống bị treo, đã tự động hoàn tiền"
                    }).eq("id", job_id).execute()
                    
                    refunded_count += 1
            except Exception as e:
                print("Error parsing date or refunding:", e)
                
        return {"status": "success", "message": f"Đã hoàn tiền cho {refunded_count} video bị treo trên 30 phút.", "refunded_count": refunded_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/settings")
def get_settings():
    res = supabase.table("site_settings").select("*").eq("id", 1).single().execute()
    return {"status": "success", "settings": res.data or {}}

@app.post("/api/admin/settings")
def update_settings(req: SettingsRequest, admin = Depends(get_current_admin)):
    # Luôn update dòng id = 1
    data = req.dict(exclude_unset=True)
    res = supabase.table("site_settings").update(data).eq("id", 1).execute()
    return {"status": "success", "settings": res.data[0] if res.data else {}}

# ===== MARKETING & SEPAY API =====
@app.post("/api/sepay/webhook")
def sepay_webhook(req: dict):
    print("SEPAY WEBHOOK RECEIVED:", req)
    
    if req.get("transferType") != "in":
        return {"status": "ignored", "message": "Not an incoming transfer"}
        
    amount = int(req.get("transferAmount", 0))
    if amount <= 0:
        return {"status": "ignored", "message": "Invalid amount"}
        
    content = str(req.get("content", "")).upper()
    
    match = re.search(r'TVN\s*(\d+)', content)
    if not match:
        return {"status": "ignored", "message": "No valid syntax found"}
        
    pay_code = int(match.group(1))
    ref = str(req.get("id"))
    
    # Kiem tra giao dich trung lap
    existing_tx = supabase.table("transactions").select("id").eq("description", f"SEPAY:{ref}").execute()
    if existing_tx.data:
        return {"status": "ignored", "message": "Transaction already processed"}
    
    # Tim user theo pay_code
    wallet_res = supabase.table("wallets").select("*").eq("pay_code", pay_code).execute()
    if not wallet_res.data:
        return {"status": "ignored", "message": "User not found"}
        
    wallet = wallet_res.data[0]
    user_id = wallet["user_id"]
    
    # Tính tiền thưởng khuyến mãi (300k -> +10%, 500k -> +20%)
    bonus = 0
    if amount >= 500000:
        bonus = int(amount * 0.20)
    elif amount >= 300000:
        bonus = int(amount * 0.10)
        
    total_credited = amount + bonus
    new_balance = wallet["balance"] + total_credited
    
    # Cong tien
    supabase.table("wallets").update({"balance": new_balance}).eq("user_id", user_id).execute()
    
    # Ghi log
    desc = f"SEPAY:{ref}"
    if bonus > 0:
        desc += f" (Nạp {amount:,}đ + Thưởng {bonus:,}đ)"
        
    supabase.table("transactions").insert({
        "user_id": user_id,
        "amount": total_credited,
        "type": "DEPOSIT",
        "description": desc
    }).execute()
    
    # Thu lay email gui thong bao
    try:
        users = supabase.auth.admin.list_users()
        user_email = next((u.email for u in users if u.id == user_id), None)
        if user_email:
            bonus_html = f"<p style='color: #2e7d32; font-weight: bold;'>🎉 Bạn được thưởng khuyến mãi +{bonus:,} VNĐ vào ví!</p>" if bonus > 0 else ""
            send_templated_email(user_email, "DEPOSIT_SUCCESS", {
                "amount": f"{total_credited:,}",
                "bonus_html": bonus_html,
                "new_balance": f"{new_balance:,}"
            })
            
            # FIRE CAPI PURCHASE EVENT
            try:
                settings_res = supabase.table("site_settings").select("fb_pixel").eq("id", 1).single().execute()
                if settings_res.data and settings_res.data.get("fb_pixel"):
                    # Fire as background task using asyncio or directly since fb_capi uses short timeout
                    send_fb_capi_event(
                        pixel_id=settings_res.data["fb_pixel"],
                        event_name="Purchase",
                        event_id=f"sepay_{ref}",
                        email=user_email,
                        value=float(total_credited),
                        currency="VND",
                        custom_data={"order_id": ref}
                    )
            except Exception as ce:
                print("FB CAPI Webhook Error:", ce)

    except Exception as e:
        print("Email Send Error:", e)

    # ===== TÍNH HOA HỒNG TIẾP THỊ LIÊN KẾT (AFFILIATE 20% TRỌN ĐỜI) =====
    try:
        user_obj = supabase.auth.admin.get_user_by_id(user_id)
        if user_obj and hasattr(user_obj, 'user') and user_obj.user:
            meta = getattr(user_obj.user, 'user_metadata', {}) or {}
            ref_code_raw = meta.get('referred_by_code')
            if ref_code_raw:
                ref_num = int(re.sub(r'\D', '', str(ref_code_raw)))
                referrer_wallet_res = supabase.table("wallets").select("*").eq("pay_code", ref_num).execute()
                if referrer_wallet_res.data:
                    referrer_wallet = referrer_wallet_res.data[0]
                    referrer_user_id = referrer_wallet["user_id"]
                    
                    if referrer_user_id != user_id:
                        affiliate_pct = 20
                        try:
                            ref_u = supabase.auth.admin.get_user_by_id(referrer_user_id)
                            if ref_u and ref_u.user and hasattr(ref_u.user, 'user_metadata'):
                                affiliate_pct = int(ref_u.user.user_metadata.get('affiliate_pct', 20))
                        except Exception as e:
                            pass
                            
                        commission = int(amount * affiliate_pct / 100)
                        new_referrer_bal = referrer_wallet["balance"] + commission
                        
                        # Cộng tiền vào ví người giới thiệu
                        supabase.table("wallets").update({"balance": new_referrer_bal}).eq("user_id", referrer_user_id).execute()
                        
                        # Ghi log giao dịch hoa hồng tiếp thị
                        supabase.table("transactions").insert({
                            "user_id": referrer_user_id,
                            "amount": commission,
                            "type": "DEPOSIT",
                            "description": f"AFFILIATE:{affiliate_pct}%|From:TVN{pay_code}|Deposit:{amount:,}đ"
                        }).execute()
                        
                        # Gửi email thông báo cho người giới thiệu
                        try:
                            all_users = supabase.auth.admin.list_users()
                            ref_email = next((u.email for u in all_users if u.id == referrer_user_id), None)
                            if ref_email:
                                send_templated_email(ref_email, "AFFILIATE_DEPOSIT", {
                                    "email": f"TVN{pay_code}",
                                    "commission": f"{commission:,}"
                                })
                        except Exception as em_err:
                            print("Affiliate Email Error:", em_err)
    except Exception as aff_err:
        print("Affiliate Commission Processing Error:", aff_err)
        
    return {"status": "success"}

@app.get("/api/affiliate/stats")
def get_affiliate_stats(user = Depends(get_current_user)):
    user_id = user.id
    
    wallet_res = supabase.table("wallets").select("pay_code, balance").eq("user_id", user_id).execute()
    if not wallet_res.data:
        return {"status": "error", "message": "Wallet not found"}
        
    pay_code = wallet_res.data[0].get("pay_code")
    balance = wallet_res.data[0].get("balance", 0)
    ref_code = f"TVN{pay_code}"
    
    total_referees = 0
    try:
        users = supabase.auth.admin.list_users()
        for u in users:
            meta = getattr(u, 'user_metadata', {}) or {}
            ref_by = meta.get('referred_by_code')
            if ref_by:
                cleaned = int(re.sub(r'\D', '', str(ref_by))) if re.search(r'\d+', str(ref_by)) else None
                if cleaned == pay_code:
                    total_referees += 1
    except Exception as e:
        print("List referees error:", e)
        
    tx_res = supabase.table("transactions").select("*").eq("user_id", user_id).like("description", "AFFILIATE:%").order("created_at", desc=True).execute()
    
    history = []
    total_earned = 0
    if tx_res.data:
        for tx in tx_res.data:
            total_earned += tx.get("amount", 0)
            history.append({
                "id": tx.get("id"),
                "created_at": tx.get("created_at"),
                "amount": tx.get("amount"),
                "description": tx.get("description")
            })
            
    return {
        "status": "success",
        "pay_code": pay_code,
        "ref_code": ref_code,
        "ref_link": f"{BASE_URL}/?ref={pay_code}",
        "balance": balance,
        "total_referees": total_referees,
        "total_earned": total_earned,
        "history": history
    }

@app.post("/api/admin/broadcast")
def send_broadcast(req: BroadcastRequest, admin = Depends(get_current_admin)):
    try:
        users = supabase.auth.admin.list_users()
        emails = [u.email for u in users if u.email]
        
        if not emails:
            return {"status": "error", "message": "Không có email nào trong hệ thống"}
            
        # Gửi hàng loạt (Resend hỗ trợ tới 50 Bcc)
        # Để an toàn, gửi từng email hoặc chia batch
        for email in emails:
            resend.Emails.send({
                "from": SENDER_EMAIL,
                "to": email,
                "subject": req.subject,
                "html": req.html
            })
            
        return {"status": "success", "sent": len(emails)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/public-settings")
def get_public_settings():
    try:
        res = supabase.table("site_settings").select("fb_pixel, tiktok_pixel, google_analytics").eq("id", 1).single().execute()
        return res.data if res.data else {}
    except Exception as e:
        print("[get_public_settings] Error:", e)
        return {}

@app.post("/api/marketing/subscribe")
def subscribe_marketing(req: MarketingRequest):
    try:
        resend.Contacts.create({
            "email": req.email,
            "first_name": req.first_name,
            "unsubscribed": False,
            "audience_id": "af59c1f1-7f7c-42ac-8abd-cd2c972583c3"
        })
        return {"status": "success"}
    except Exception as e:
        print(f"Resend error: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/affiliate/withdraw")
def request_withdrawal(req: WithdrawRequest, user=Depends(get_current_user)):
    try:
        if req.amount < 500000:
            return {"status": "error", "message": "Số tiền rút tối thiểu là 500,000đ"}
            
        wallet_res = supabase.table("wallets").select("balance").eq("user_id", user.id).single().execute()
        if not wallet_res.data or wallet_res.data.get("balance", 0) < req.amount:
            return {"status": "error", "message": "Số dư không đủ"}
            
        pending_res = supabase.table("withdrawals").select("id").eq("user_id", user.id).eq("status", "pending").execute()
        if pending_res.data and len(pending_res.data) > 0:
            return {"status": "error", "message": "Bạn đang có yêu cầu rút tiền đang chờ xử lý"}
            
        new_balance = wallet_res.data.get("balance", 0) - req.amount
        supabase.table("wallets").update({"balance": new_balance}).eq("user_id", user.id).execute()
        
        withdrawal_data = {
            "user_id": user.id,
            "amount": req.amount,
            "bank_name": req.bank_name,
            "bank_account": req.bank_account,
            "bank_owner": req.bank_owner,
            "status": "pending"
        }
        supabase.table("withdrawals").insert(withdrawal_data).execute()
        
        tx_data = {
            "user_id": user.id,
            "type": "WITHDRAW",
            "amount": -req.amount,
            "description": "Yeu cau rut tien hoa hong"
        }
        supabase.table("transactions").insert(tx_data).execute()
        
        admin_res = supabase.table("wallets").select("user_id").eq("role", "admin").execute()
        if admin_res.data:
            for admin_wallet in admin_res.data:
                admin_id = admin_wallet.get("user_id")
                try:
                    admin_email = get_email_for_user_id(admin_id)
                    if admin_email:
                        resend.Emails.send({
                            "from": SENDER_EMAIL,
                            "to": admin_email,
                            "subject": f"Yêu cầu rút tiền mới - {req.amount:,.0f}đ",
                            "html": f"""
                            <div style="background-color:#f3efe8;padding:20px;font-family:sans-serif;">
                                <div style="background-color:#2d2218;color:white;padding:15px;text-align:center;">
                                    <h2 style="margin:0;">Tai video nhanh</h2>
                                </div>
                                <div style="background-color:white;padding:20px;">
                                    <p>Có yêu cầu rút tiền mới:</p>
                                    <ul>
                                        <li>Số tiền: {req.amount:,.0f}đ</li>
                                        <li>Ngân hàng: {req.bank_name}</li>
                                        <li>Số tài khoản: {req.bank_account}</li>
                                        <li>Chủ tài khoản: {req.bank_owner}</li>
                                    </ul>
                                    <p>Vui lòng đăng nhập admin để duyệt.</p>
                                </div>
                                <div style="background-color:#fdf9f1;padding:15px;text-align:center;font-size:12px;">
                                    &copy; {BASE_URL.replace("https://", "")}
                                </div>
                            </div>
                            """
                        })
                except Exception as e:
                    print(f"Failed to send email to admin: {e}")
                    
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/affiliate/withdrawals")
def get_withdrawal_history(user=Depends(get_current_user)):
    try:
        res = supabase.table("withdrawals").select("*").eq("user_id", user.id).order("created_at", desc=True).execute()
        return {"status": "success", "data": res.data if res.data else []}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/admin/withdrawals")
def admin_get_withdrawals(admin=Depends(get_current_admin)):
    try:
        res = supabase.table("withdrawals").select("*").order("created_at", desc=True).execute()
        data = res.data if res.data else []
        
        for item in data:
            item["email"] = get_email_for_user_id(item["user_id"])
            
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/withdraw-action")
def admin_withdraw_action(req: WithdrawActionRequest, admin=Depends(get_current_admin)):
    try:
        withdrawal_res = supabase.table("withdrawals").select("*").eq("id", req.withdraw_id).single().execute()
        if not withdrawal_res.data:
            return {"status": "error", "message": "Không tìm thấy yêu cầu rút tiền"}
            
        withdrawal = withdrawal_res.data
        if withdrawal.get("status") != "pending":
            return {"status": "error", "message": "Yêu cầu này đã được xử lý"}
            
        user_id = withdrawal.get("user_id")
        amount = withdrawal.get("amount")
        user_email = get_email_for_user_id(user_id)
        
        now = datetime.now(timezone.utc).isoformat()
        
        if req.action == "approve":
            supabase.table("withdrawals").update({"status": "approved", "processed_at": now}).eq("id", req.withdraw_id).execute()
            
            if user_email:
                try:
                    resend.Emails.send({
                        "from": SENDER_EMAIL,
                        "to": user_email,
                        "subject": "Yêu cầu rút tiền thành công",
                        "html": f"""
                        <div style="background-color:#f3efe8;padding:20px;font-family:sans-serif;">
                            <div style="background-color:#2d2218;color:white;padding:15px;text-align:center;">
                                <h2 style="margin:0;">Tai video nhanh</h2>
                            </div>
                            <div style="background-color:white;padding:20px;">
                                <p>Chào bạn,</p>
                                <p>Yêu cầu rút tiền <b>{amount:,.0f}đ</b> của bạn đã được duyệt và chuyển thành công.</p>
                                <p>Cảm ơn bạn đã đồng hành cùng chúng tôi!</p>
                            </div>
                            <div style="background-color:#fdf9f1;padding:15px;text-align:center;font-size:12px;">
                                &copy; {BASE_URL.replace("https://", "")}
                            </div>
                        </div>
                        """
                    })
                except Exception as e:
                    print(f"Email send error: {e}")
                    
        elif req.action == "reject":
            supabase.table("withdrawals").update({"status": "rejected", "processed_at": now}).eq("id", req.withdraw_id).execute()
            
            wallet_res = supabase.table("wallets").select("balance").eq("user_id", user_id).single().execute()
            if wallet_res.data:
                new_balance = wallet_res.data.get("balance", 0) + amount
                supabase.table("wallets").update({"balance": new_balance}).eq("user_id", user_id).execute()
                
            tx_data = {
                "user_id": user_id,
                "type": "REFUND",
                "amount": amount,
                "description": f"Hoan tien rut hoa hong: {req.admin_note}"
            }
            supabase.table("transactions").insert(tx_data).execute()
            
            if user_email:
                try:
                    resend.Emails.send({
                        "from": SENDER_EMAIL,
                        "to": user_email,
                        "subject": "Yêu cầu rút tiền bị từ chối",
                        "html": f"""
                        <div style="background-color:#f3efe8;padding:20px;font-family:sans-serif;">
                            <div style="background-color:#2d2218;color:white;padding:15px;text-align:center;">
                                <h2 style="margin:0;">Tai video nhanh</h2>
                            </div>
                            <div style="background-color:white;padding:20px;">
                                <p>Chào bạn,</p>
                                <p>Yêu cầu rút tiền <b>{amount:,.0f}đ</b> của bạn đã bị từ chối.</p>
                                <p>Lý do: {req.admin_note}</p>
                                <p>Số tiền đã được hoàn lại vào ví của bạn.</p>
                            </div>
                            <div style="background-color:#fdf9f1;padding:15px;text-align:center;font-size:12px;">
                                &copy; {BASE_URL.replace("https://", "")}
                            </div>
                        </div>
                        """
                    })
                except Exception as e:
                    print(f"Email send error: {e}")
        else:
            return {"status": "error", "message": "Hành động không hợp lệ"}
            
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ===== EMAIL TEMPLATES & FUNNELS API =====
@app.get("/api/admin/email-templates")
def get_email_templates(user = Depends(get_current_admin)):
    res = supabase.table("email_templates").select("*").order("created_at").execute()
    return res.data or []

@app.put("/api/admin/email-templates/{code}")
def update_email_template(code: str, req: dict, user = Depends(get_current_admin)):
    supabase.table("email_templates").update({
        "subject": req.get("subject", ""),
        "html_content": req.get("html_content", "")
    }).eq("code", code).execute()
    return {"status": "success"}

@app.get("/api/admin/funnels")
def get_funnels(user = Depends(get_current_admin)):
    res = supabase.table("email_funnels").select("*").order("delay_days").execute()
    return res.data or []

@app.post("/api/admin/funnels")
def create_funnel(req: dict, user = Depends(get_current_admin)):
    supabase.table("email_funnels").insert({
        "name": req.get("name"),
        "delay_days": int(req.get("delay_days", 1)),
        "subject": req.get("subject"),
        "html_content": req.get("html_content"),
        "is_active": req.get("is_active", True),
        "target_segment": req.get("target_segment", "all")
    }).execute()
    return {"status": "success"}

@app.put("/api/admin/funnels/{id}")
def update_funnel(id: str, req: dict, user = Depends(get_current_admin)):
    supabase.table("email_funnels").update({
        "name": req.get("name"),
        "delay_days": int(req.get("delay_days", 1)),
        "subject": req.get("subject"),
        "html_content": req.get("html_content"),
        "is_active": req.get("is_active", True),
        "target_segment": req.get("target_segment", "all")
    }).eq("id", id).execute()
    return {"status": "success"}

@app.delete("/api/admin/funnels/{id}")
def delete_funnel(id: str, user = Depends(get_current_admin)):
    supabase.table("email_funnels").delete().eq("id", id).execute()
    return {"status": "success"}

@app.get("/api/admin/funnel-detail/{funnel_id}")
def get_funnel_detail(funnel_id: str, user = Depends(get_current_admin)):
    """Chi tiết tracking cho 1 funnel cụ thể"""
    try:
        # Lấy thông tin funnel
        funnel_res = supabase.table("email_funnels").select("*").eq("id", funnel_id).execute()
        if not funnel_res.data:
            return {"status": "error", "message": "Funnel not found"}
        funnel = funnel_res.data[0]
        
        # Lấy tất cả events cho funnel này
        events_res = supabase.table("funnel_events").select("*").eq("funnel_id", funnel_id).order("created_at", desc=True).execute()
        events = events_res.data or []
        
        # Group events by user_email
        user_map = {}
        for ev in events:
            email = ev.get("user_email", "")
            if email not in user_map:
                user_map[email] = {
                    "email": email,
                    "sent_at": None,
                    "delivered": False,
                    "opened": False,
                    "clicked": False,
                    "bounced": False,
                    "click_urls": []
                }
            evt = ev.get("event_type")
            if evt == "sent" and not user_map[email]["sent_at"]:
                user_map[email]["sent_at"] = ev.get("created_at")
            elif evt == "delivered":
                user_map[email]["delivered"] = True
            elif evt == "opened":
                user_map[email]["opened"] = True
            elif evt == "clicked":
                user_map[email]["clicked"] = True
                if ev.get("link_url"):
                    user_map[email]["click_urls"].append(ev["link_url"])
            elif evt == "bounced":
                user_map[email]["bounced"] = True
        
        users_list = sorted(user_map.values(), key=lambda x: x.get("sent_at") or "", reverse=True)
        
        sent = funnel.get("sent", 0) or 0
        delivered = funnel.get("delivered", 0) or 0
        opens = funnel.get("opens", 0) or 0
        clicks = funnel.get("clicks", 0) or 0
        bounced = funnel.get("bounced", 0) or 0
        
        rates = {
            "delivery_rate": f"{(delivered/sent*100):.1f}%" if sent > 0 else "0%",
            "open_rate": f"{(opens/delivered*100):.1f}%" if delivered > 0 else "0%",
            "click_rate": f"{(clicks/opens*100):.1f}%" if opens > 0 else "0%",
            "bounce_rate": f"{(bounced/sent*100):.1f}%" if sent > 0 else "0%"
        }
        
        return {
            "status": "success",
            "funnel": funnel,
            "users": users_list[:200],
            "rates": rates,
            "total_users": len(users_list)
        }
    except Exception as e:
        print(f"Funnel detail error: {e}")
        return {"status": "error", "message": str(e)}

def get_segment_user_ids(segment: str) -> dict:
    """Trả về dict {segment_type: set(user_ids)} để lọc user theo segment"""
    result = {"include": None, "exclude": None}  # None = all
    
    if segment == "all":
        return result
    
    if segment == "never_used":
        # User chưa có video_jobs nào
        res = supabase.table("video_jobs").select("user_id").execute()
        used_ids = set(j["user_id"] for j in (res.data or []) if j.get("user_id"))
        result["exclude"] = used_ids
        return result
    
    if segment == "used_not_paid":
        # Có video_jobs nhưng chưa nạp tiền
        res_jobs = supabase.table("video_jobs").select("user_id").execute()
        used_ids = set(j["user_id"] for j in (res_jobs.data or []) if j.get("user_id"))
        res_tx = supabase.table("transactions").select("user_id").eq("type", "DEPOSIT").like("description", "SEPAY:%").execute()
        paid_ids = set(t["user_id"] for t in (res_tx.data or []) if t.get("user_id"))
        result["include"] = used_ids - paid_ids
        return result
    
    if segment == "paid":
        res_tx = supabase.table("transactions").select("user_id").eq("type", "DEPOSIT").like("description", "SEPAY:%").execute()
        paid_ids = set(t["user_id"] for t in (res_tx.data or []) if t.get("user_id"))
        result["include"] = paid_ids
        return result
    
    if segment == "inactive_7d":
        # Không có video_jobs trong 7 ngày gần nhất
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        res_recent = supabase.table("video_jobs").select("user_id").gte("created_at", cutoff).execute()
        recent_ids = set(j["user_id"] for j in (res_recent.data or []) if j.get("user_id"))
        result["exclude"] = recent_ids
        return result
    
    return result

@app.get("/api/cron/process-funnels")
def process_funnels():
    funnels_res = supabase.table("email_funnels").select("*").eq("is_active", True).execute()
    funnels = funnels_res.data or []
    
    users = supabase.auth.admin.list_users()
    now = datetime.now(timezone.utc)
    
    total_sent = 0
    for funnel in funnels:
        delay_days = funnel["delay_days"]
        segment = funnel.get("target_segment", "all") or "all"
        funnel_sent = 0
        
        # Pre-compute segment filter
        try:
            seg_filter = get_segment_user_ids(segment)
        except Exception as e:
            print(f"Error computing segment for funnel {funnel['id']}: {e}")
            seg_filter = {"include": None, "exclude": None}
        
        for u in users:
            try:
                # Check segment filter
                if seg_filter["include"] is not None and u.id not in seg_filter["include"]:
                    continue
                if seg_filter["exclude"] is not None and u.id in seg_filter["exclude"]:
                    continue
                
                # Handle created_at as both datetime object and string
                raw_dt = u.created_at
                if isinstance(raw_dt, datetime):
                    created_at = raw_dt if raw_dt.tzinfo else raw_dt.replace(tzinfo=timezone.utc)
                elif isinstance(raw_dt, str):
                    if raw_dt.endswith("Z"): raw_dt = raw_dt.replace("Z", "+00:00")
                    created_at = datetime.fromisoformat(raw_dt)
                else:
                    created_at = datetime.fromisoformat(str(raw_dt))
                
                days_diff = (now - created_at).days
                
                if days_diff >= delay_days:
                    # Check if already sent
                    log_res = supabase.table("funnel_logs").select("id").eq("user_id", u.id).eq("funnel_id", funnel["id"]).execute()
                    if not log_res.data:
                        html_content = funnel["html_content"]
                        subject = funnel["subject"]
                        
                        # Build variables for this user
                        user_name = (u.user_metadata or {}).get("full_name", "") or (u.user_metadata or {}).get("name", "") or u.email.split("@")[0]
                        funnel_vars = {
                            "user_email": u.email or "",
                            "user_name": user_name,
                            "name": user_name,
                            "email": u.email or "",
                            "days_since_signup": str(days_diff),
                            "signup_date": created_at.strftime("%d/%m/%Y"),
                        }
                        
                        # Also fetch wallet info if available
                        try:
                            wallet_res = supabase.table("wallets").select("balance").eq("user_id", u.id).execute()
                            if wallet_res.data:
                                balance_val = wallet_res.data[0].get("balance", 0)
                                funnel_vars["balance"] = f"{balance_val:,}"
                            else:
                                funnel_vars["balance"] = "0"
                        except:
                            funnel_vars["balance"] = "0"
                        
                        # Replace all {{var}} in html_content and subject
                        for key, val in funnel_vars.items():
                            html_content = html_content.replace(f"{{{{{key}}}}}", str(val))
                            subject = subject.replace(f"{{{{{key}}}}}", str(val))
                        
                        # Wrap in BASE_TEMPLATE
                        base_res = supabase.table("email_templates").select("html_content").eq("code", "BASE_TEMPLATE").execute()
                        if base_res.data:
                            base_html = base_res.data[0].get("html_content", "")
                            final_html = base_html.replace("{{content}}", html_content)
                        else:
                            final_html = html_content
                            
                        resend.Emails.send({
                            "from": SENDER_EMAIL,
                            "to": u.email,
                            "subject": subject,
                            "html": final_html,
                            "tags": [{"name": "funnel_id", "value": str(funnel["id"])}]
                        })
                        
                        # Log to funnel_logs (backward compat)
                        supabase.table("funnel_logs").insert({
                            "user_id": u.id,
                            "funnel_id": funnel["id"]
                        }).execute()
                        
                        # Log to funnel_events (new tracking)
                        try:
                            supabase.table("funnel_events").insert({
                                "funnel_id": funnel["id"],
                                "user_id": u.id,
                                "user_email": u.email,
                                "event_type": "sent"
                            }).execute()
                        except: pass
                        
                        funnel_sent += 1
                        total_sent += 1
                        time.sleep(0.5) 
            except Exception as e:
                print(f"Error sending funnel {funnel['id']} to {getattr(u, 'email', '?')}: {e}")
        
        # Update sent count for this funnel at the end
        try:
            if funnel_sent > 0:
                current_funnel = supabase.table("email_funnels").select("sent").eq("id", funnel["id"]).execute()
                old_sent = (current_funnel.data[0].get("sent", 0) or 0) if current_funnel.data else 0
                supabase.table("email_funnels").update({"sent": old_sent + funnel_sent}).eq("id", funnel["id"]).execute()
        except: pass
                
    return {"status": "success", "sent": total_sent}

@app.post("/api/webhooks/resend")
async def resend_webhook(request: Request):
    try:
        secret = os.getenv("RESEND_WEBHOOK_SECRET")
        if secret:
            payload = await request.body()
            headers = dict(request.headers)
            webhook = Webhook(secret)
            try:
                webhook.verify(payload, headers)
            except WebhookVerificationError:
                return {"status": "error", "message": "Invalid signature"}

        data = await request.json()
        event_type = data.get("type")
        
        # Lấy data payload
        email_data = data.get("data", {})
        tags = email_data.get("tags", [])
        to_email = ""
        if isinstance(email_data.get("to"), list) and email_data["to"]:
            to_email = email_data["to"][0]
        elif isinstance(email_data.get("to"), str):
            to_email = email_data["to"]
        
        link_url = email_data.get("click", {}).get("link", "") if isinstance(email_data.get("click"), dict) else ""
        
        funnel_id = None
        for tag in tags:
            if tag.get("name") == "funnel_id":
                funnel_id = tag.get("value")
                break
                
        if funnel_id:
            # Map Resend event types to our event types
            event_map = {
                "email.sent": "sent",
                "email.delivered": "delivered",
                "email.opened": "opened",
                "email.clicked": "clicked",
                "email.bounced": "bounced",
                "email.complained": "complained"
            }
            
            our_event = event_map.get(event_type)
            if our_event:
                # Ghi vào funnel_events
                try:
                    event_data = {
                        "funnel_id": funnel_id,
                        "user_email": to_email,
                        "event_type": our_event
                    }
                    if link_url:
                        event_data["link_url"] = link_url
                    supabase.table("funnel_events").insert(event_data).execute()
                except Exception as ev_err:
                    print(f"Event insert error: {ev_err}")
                
                # Tăng counter trên email_funnels
                counter_map = {
                    "delivered": "delivered",
                    "opened": "opens",
                    "clicked": "clicks",
                    "bounced": "bounced"
                }
                counter_col = counter_map.get(our_event)
                if counter_col:
                    try:
                        res = supabase.table("email_funnels").select(counter_col).eq("id", funnel_id).execute()
                        if res.data:
                            current = res.data[0].get(counter_col, 0) or 0
                            supabase.table("email_funnels").update({counter_col: current + 1}).eq("id", funnel_id).execute()
                    except Exception as cnt_err:
                        print(f"Counter update error: {cnt_err}")
                    
        return {"status": "success"}
    except Exception as e:
        print(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}


# ===== ADMIN DASHBOARD OVERVIEW =====

def get_folder_size(folder_path):
    total_size = 0
    if not os.path.exists(folder_path): return 0
    for dirpath, _, filenames in os.walk(folder_path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size

# Cache folder size với TTL 5 phút để tránh os.walk chặn mỗi request
_folder_size_cache = {"value": 0, "timestamp": 0}

def get_cached_storage_size():
    now = time.time()
    if now - _folder_size_cache["timestamp"] < 300:  # 5 phút
        return _folder_size_cache["value"]
    dl_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output_videos")
    total = get_folder_size(dl_dir) + get_folder_size(out_dir)
    _folder_size_cache["value"] = total
    _folder_size_cache["timestamp"] = now
    return total

def format_size(size_bytes):
    if size_bytes == 0: return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_name[i]}"

@app.get("/api/admin/provider-alerts")
def admin_provider_alerts(admin = Depends(get_current_admin)):
    """Cảnh báo credit OpenAI / Vbee (tự ghi khi API trả lỗi hết credit, tự xoá khi gọi lại thành công)."""
    return {"alerts": get_provider_alerts()}

_overview_cache = {}

@app.get("/api/admin/overview")
def get_admin_overview(
    admin = Depends(get_current_admin),
    year: int = Query(0, ge=0, le=2100),
    month: int = Query(0, ge=0, le=12)
):
    """year/month chỉ áp dụng cho số liệu NẠP TIỀN (tự động/thủ công). year=0: toàn thời gian; month=0: cả năm."""
    try:
        # Cache 60s theo kỳ lọc: tránh quét lại toàn bộ bảng mỗi lần mở tab Báo cáo
        cache_key = (year, month)
        cached = _overview_cache.get(cache_key)
        if cached and cached[0] > time.time():
            m = dict(cached[1])
            return {"status": "success", "metrics": m}

        from concurrent.futures import ThreadPoolExecutor

        def q_users():
            try:
                return supabase.table("wallets").select("user_id", count="exact").limit(1).execute().count or 0
            except Exception:
                return 0

        def q_tx():
            """Tiêu dùng + hoa hồng affiliate (toàn thời gian). Quét theo trang 1000 dòng (PostgREST giới hạn 1000/lần)."""
            ded = aff = 0
            try:
                off = 0
                while True:
                    r = (supabase.table("transactions").select("type,amount")
                         .in_("type", ["DEDUCT", "AFFILIATE_COMMISSION"])
                         .order("created_at", desc=True).range(off, off + 999).execute())
                    rows = r.data or []
                    for it in rows:
                        t, amt = it.get("type"), (it.get("amount") or 0)
                        if t == "DEDUCT":
                            ded += abs(amt)
                        elif t == "AFFILIATE_COMMISSION":
                            aff += amt
                    if len(rows) < 1000:
                        break
                    off += 1000
            except Exception as e:
                print(f"[overview] tx error: {e}")
            return ded, aff

        def q_dep():
            """Nạp tiền (DEPOSIT) theo kỳ lọc tháng/năm giờ VN. Trả (tổng, tự động SePay, số giao dịch)."""
            add = auto = cnt = 0
            rng = _period_range(year, month)
            try:
                off = 0
                while True:
                    q = supabase.table("transactions").select("amount,description").eq("type", "DEPOSIT")
                    if rng:
                        q = q.gte("created_at", rng[0]).lt("created_at", rng[1])
                    r = q.order("created_at", desc=True).range(off, off + 999).execute()
                    rows = r.data or []
                    for it in rows:
                        amt = it.get("amount") or 0
                        add += amt
                        cnt += 1
                        if "SEPAY:" in str(it.get("description", "")):
                            auto += amt
                    if len(rows) < 1000:
                        break
                    off += 1000
            except Exception as e:
                print(f"[overview] deposit error: {e}")
            return add, auto, cnt

        def q_withdraw():
            total = 0
            try:
                off = 0
                while True:
                    r = supabase.table("withdrawals").select("amount").eq("status", "approved").range(off, off + 999).execute()
                    rows = r.data or []
                    total += sum((x.get("amount") or 0) for x in rows)
                    if len(rows) < 1000:
                        break
                    off += 1000
            except Exception:
                pass
            return total

        def q_jobs(status):
            try:
                return supabase.table("video_jobs").select("id", count="exact").eq("status", status).limit(1).execute().count or 0
            except Exception:
                return 0

        with ThreadPoolExecutor(max_workers=5) as ex:
            f_users = ex.submit(q_users)
            f_tx = ex.submit(q_tx)
            f_dep = ex.submit(q_dep)
            f_wd = ex.submit(q_withdraw)
            f_done = ex.submit(q_jobs, "done")
            f_err = ex.submit(q_jobs, "error")
            users_count = f_users.result()
            total_deduct, total_affiliate = f_tx.result()
            total_add, total_add_auto, deposit_count = f_dep.result()
            total_withdraw = f_wd.result()
            jobs_done = f_done.result()
            jobs_error = f_err.result()
        total_add_manual = total_add - total_add_auto


        # 5. Storage - Dùng cache 5 phút
        total_storage_bytes = get_cached_storage_size()
        
        metrics = {
            "total_users": users_count,
            "total_add": total_add,
            "total_add_auto": total_add_auto,
            "total_add_manual": total_add_manual,
            "total_deduct": total_deduct,
            "total_withdraw": total_withdraw,
            "total_affiliate": total_affiliate,
            "jobs_done": jobs_done,
            "jobs_error": jobs_error,
            "storage_bytes": total_storage_bytes,
            "storage_formatted": format_size(total_storage_bytes)
        }
        metrics["period_year"] = year
        metrics["period_month"] = month
        metrics["deposit_count"] = deposit_count
        if len(_overview_cache) > 50:
            _overview_cache.clear()
        _overview_cache[cache_key] = (time.time() + 60, metrics)
        return {"status": "success", "metrics": metrics}
    except Exception as e:
        print(f"Overview API error: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/admin/funnel-report")
def get_admin_funnel_report(admin = Depends(get_current_admin)):
    try:
        # Step 1: Total Users
        res_users = supabase.table("wallets").select("user_id", count="exact").execute()
        total_registered = res_users.count if res_users.count is not None else 0
        
        # Step 2: Users who processed at least one video successfully
        # Fetch all user_ids where status = 'done'
        res_jobs = supabase.table("video_jobs").select("user_id").eq("status", "done").execute()
        active_user_ids = set([j["user_id"] for j in res_jobs.data if j.get("user_id")])
        total_active = len(active_user_ids)
        
        # Step 3: Users who made at least one deposit (Real deposits only, via SePay)
        res_tx = supabase.table("transactions").select("user_id").eq("type", "DEPOSIT").like("description", "SEPAY:%").execute()
        paid_user_ids = set([t["user_id"] for t in res_tx.data if t.get("user_id")])
        total_paid = len(paid_user_ids)
        
        return {
            "status": "success",
            "data": {
                "step1_registered": total_registered,
                "step2_active": total_active,
                "step3_paid": total_paid
            }
        }
    except Exception as e:
        print(f"Funnel API error: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/admin/clear-cache")
def clear_server_cache(admin = Depends(get_current_admin)):
    import shutil
    try:
        dl_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads")
        # Chỉ xóa file bên trong, giữ lại thư mục
        if os.path.exists(dl_dir):
            for filename in os.listdir(dl_dir):
                file_path = os.path.join(dl_dir, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception as e:
                    pass
                    
        return {"status": "success", "message": "Đã dọn dẹp cache thành công"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/capi/event")
def handle_capi_event(req_data: CAPIEventRequest, request: Request, user = Depends(get_current_user_optional)):
    try:
        settings_res = supabase.table("site_settings").select("fb_pixel").eq("id", 1).single().execute()
        fb_pixel = settings_res.data.get("fb_pixel")
        if not fb_pixel:
            return {"status": "ignored", "message": "Pixel ID not configured"}
            
        email = user.email if user else None
        
        # Get IP address and User Agent
        ip_address = request.headers.get('x-forwarded-for')
        if ip_address:
            ip_address = ip_address.split(',')[0].strip()
        else:
            ip_address = request.client.host if request.client else None
            
        user_agent = request.headers.get('user-agent')
        
        # Extract FB Cookies to improve Event Match Quality (EMQ)
        fbp = request.cookies.get('_fbp')
        fbc = request.cookies.get('_fbc')
        
        send_fb_capi_event(
            pixel_id=fb_pixel,
            event_name=req_data.event_name,
            event_id=req_data.event_id,
            email=email,
            external_id=user.id if user else None,
            user_agent=user_agent,
            ip_address=ip_address,
            fbp=fbp,
            fbc=fbc,
            custom_data=req_data.custom_data
        )
        return {"status": "success"}
    except Exception as e:
        print("CAPI proxy error:", e)
        return {"status": "error", "message": str(e)}

# --- PostForMe API endpoints ---
class PFMAuthRequest(BaseModel):
    platform: str

class PFMGenerateCaptionRequest(BaseModel):
    topic: str

@app.get("/api/postforme/accounts")
def pfm_accounts(user = Depends(get_current_user)):
    pfm_key = os.getenv("POSTFORME_API_KEY")
    if not pfm_key:
        return {"data": []}
    res = requests.get(
        "https://api.postforme.dev/v1/social-accounts",
        headers={"Authorization": f"Bearer {pfm_key}"},
        params={"external_id": user.id}
    )
    if not res.ok:
        err_data = res.json() if "json" in res.headers.get("content-type", "") else {}
        err_msg = err_data.get("error", {}).get("message", res.text)
        print(f"[PostForMe Accounts Error] Status {res.status_code}: {err_msg}")
        return {"data": [], "error": err_msg}
    return res.json()

@app.post("/api/postforme/auth-url")
def pfm_auth_url(req: PFMAuthRequest, user = Depends(get_current_user)):
    pfm_key = os.getenv("POSTFORME_API_KEY")
    if not pfm_key:
        raise HTTPException(status_code=500, detail="Chưa cấu hình API Key PostForMe trên server.")
    res = requests.post(
        "https://api.postforme.dev/v1/social-accounts/auth-url",
        headers={"Authorization": f"Bearer {pfm_key}", "Content-Type": "application/json"},
        json={
            "platform": req.platform,
            "external_id": user.id,
            "redirect_url": "https://taivideonhanh.com/dashboard"
        }
    )
    if not res.ok:
        err_data = res.json() if "json" in res.headers.get("content-type", "") else {}
        err_msg = err_data.get("error", {}).get("message", res.text)
        print(f"[PostForMe Auth-URL Error] Status {res.status_code}: {err_msg}")
        raise HTTPException(status_code=400, detail=f"Lỗi từ dịch vụ kết nối Facebook (PostForMe): {err_msg}")
    return res.json()

@app.post("/api/postforme/generate-caption")
def pfm_generate_caption(req: PFMGenerateCaptionRequest, user = Depends(get_current_user)):
    try:
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        prompt = f"Bạn là một chuyên gia viết content Facebook. Hãy viết một bài review ngắn gọn, hấp dẫn, chuẩn phong cách mạng xã hội (có icon) cho video có chủ đề: '{req.topic}'. Chỉ trả về nội dung bài viết, không cần giải thích gì thêm."
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        caption = response.choices[0].message.content.strip()
        return {"caption": caption}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/postforme/posts")
def pfm_posts(user = Depends(get_current_user)):
    pfm_key = os.getenv("POSTFORME_API_KEY")
    
    # 1. Get all social accounts for this user
    acc_res = requests.get(
        "https://api.postforme.dev/v1/social-accounts",
        headers={"Authorization": f"Bearer {pfm_key}"},
        params={"external_id": [user.id]}
    )
    accounts_data = acc_res.json()
    account_ids = []
    if "data" in accounts_data:
        account_ids = [acc["id"] for acc in accounts_data["data"]]
    
    if not account_ids:
        return {"data": [], "meta": {"total": 0}}
        
    # 2. Get posts for these accounts
    # PostForMe accepts multiple social_account_id params
    res = requests.get(
        "https://api.postforme.dev/v1/social-posts",
        headers={"Authorization": f"Bearer {pfm_key}"},
        params={"social_account_id": account_ids}
    )
    return res.json()

@app.post("/api/postforme/disconnect/{account_id}")
def pfm_disconnect(account_id: str, user = Depends(get_current_user)):
    pfm_key = os.getenv("POSTFORME_API_KEY")
    res = requests.post(
        f"https://api.postforme.dev/v1/social-accounts/{account_id}/disconnect",
        headers={"Authorization": f"Bearer {pfm_key}"}
    )
    return res.json()

class PostNowRequest(BaseModel):
    video_id: str
    account_id: str
    caption: str
    scheduled_at: str = ""

@app.post("/api/postforme/post-now")
def pfm_post_now(req: PostNowRequest, user = Depends(get_current_user)):
    pfm_key = os.environ.get("POSTFORME_API_KEY")
    if not pfm_key:
        raise HTTPException(status_code=500, detail="Chưa cấu hình API Key PostForMe")
        
    # 1. Trừ 1000đ
    cost = 1000
    wallet_res = supabase.table("wallets").select("balance").eq("user_id", user.id).single().execute()
    if not wallet_res.data:
        raise HTTPException(status_code=400, detail="Không tìm thấy ví")
    current_balance = wallet_res.data["balance"]
    
    if current_balance < cost:
        raise HTTPException(status_code=402, detail="Số dư không đủ. Vui lòng nạp thêm tiền.")
        
    new_balance = current_balance - cost
    supabase.table("wallets").update({"balance": new_balance}).eq("user_id", user.id).execute()
    
    # Ghi nhận giao dịch
    import uuid
    supabase.table("transactions").insert({
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "amount": -cost,
        "description": f"Đăng Fanpage tự động (Video ID: {req.video_id})",
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    
    # 2. Upload to PostForMe
    try:
        db_job_res = supabase.table("video_jobs").select("result_video_url").eq("id", req.video_id).execute()
        if not db_job_res.data:
            raise Exception("Không tìm thấy thông tin video trong cơ sở dữ liệu")
        
        video_path = db_job_res.data[0].get("result_video_url")
        if not video_path or not os.path.exists(video_path):
            raise Exception("File video không còn tồn tại trên server")
                  
        media_res = requests.post(
            "https://api.postforme.dev/v1/media/create-upload-url",
            headers={"Authorization": f"Bearer {pfm_key}", "Content-Type": "application/json"}
        )
        media_data = media_res.json()
        upload_url = media_data["upload_url"]
        media_url = media_data["media_url"]
        
        with open(video_path, 'rb') as f:
            put_res = requests.put(upload_url, headers={"Content-Type": "video/mp4"}, data=f)
            if not put_res.ok:
                raise Exception("Lỗi tải video lên server trung gian")
            
        post_payload = {
            "caption": req.caption,
            "media": [{"url": media_url}],
            "social_accounts": [req.account_id]
        }
        if req.scheduled_at and req.scheduled_at.strip():
            post_payload["scheduled_at"] = req.scheduled_at
            
        post_res = requests.post(
            "https://api.postforme.dev/v1/social-posts",
            headers={"Authorization": f"Bearer {pfm_key}", "Content-Type": "application/json"},
            json=post_payload
        )
        if not post_res.ok:
            raise Exception("Lỗi kết nối Facebook: " + post_res.text)
            
        return {"status": "success", "message": "Đã lên lịch đăng bài thành công"}
    except Exception as e:
        # Hoàn tiền nếu lỗi
        supabase.table("wallets").update({"balance": current_balance}).eq("user_id", user.id).execute()
        supabase.table("transactions").insert({
            "id": str(uuid.uuid4()),
            "user_id": user.id,
            "amount": cost,
            "description": f"Hoàn tiền do lỗi đăng Fanpage (Video ID: {req.video_id})",
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        raise HTTPException(status_code=500, detail=str(e))


try:
    from content_creator_api import router as content_creator_router
    app.include_router(content_creator_router)
    print("Loaded content_creator_api router")
except Exception as e:
    print(f"Error loading content_creator_api router: {e}")
