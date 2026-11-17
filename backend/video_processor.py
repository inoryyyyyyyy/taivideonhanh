import os
import re
import json
import time
import uuid
import subprocess
import requests
import ffmpeg
from concurrent.futures import ThreadPoolExecutor
from pydub import AudioSegment
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Cấu hình biến môi trường FFmpeg nếu chạy Local
LOCAL_FFMPEG_BIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ffmpeg', 'bin')
if os.path.exists(LOCAL_FFMPEG_BIN):
    os.environ['PATH'] = LOCAL_FFMPEG_BIN + os.pathsep + os.environ.get('PATH', '')

# Khởi tạo API Clients
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

OPENAI_QUOTA_MSG = "Hệ thống AI đang tạm bảo trì, tiền của bạn sẽ được hoàn về tài khoản. Vui lòng thử lại sau."
OPENAI_QUOTA_ALERT = "OpenAI đã HẾT CREDIT / vượt hạn mức (429 insufficient_quota). Tạo video, dịch và giọng OpenAI sẽ lỗi cho tới khi nạp thêm tại platform.openai.com/settings/organization/billing."

def _is_openai_quota_error(e) -> bool:
    """Nhận diện lỗi hết credit / quá hạn mức của OpenAI (429 insufficient_quota)."""
    s = str(e).lower()
    return any(k in s for k in ["insufficient_quota", "credit_balance_exhausted", "no credits remaining"])

# ===== CẢNH BÁO CREDIT NHÀ CUNG CẤP (hiển thị trong trang Admin) =====
import threading
_ALERTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "provider_alerts.json")
_alerts_lock = threading.Lock()

def _load_alerts() -> dict:
    try:
        with open(_ALERTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def _save_alerts(data: dict):
    try:
        with open(_ALERTS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:
        print(f"[alerts] save error: {e}")

def record_provider_alert(provider: str, level: str, message: str):
    """Ghi/cập nhật cảnh báo cho provider ('openai' | 'vbee'). Lưu file để sống sót qua restart."""
    with _alerts_lock:
        data = _load_alerts()
        old = data.get(provider)
        now = time.time()
        data[provider] = {
            "provider": provider, "level": level, "message": message,
            "first_seen": old.get("first_seen", now) if old else now,
            "last_seen": now,
            "count": (old.get("count", 0) + 1) if old else 1,
        }
        _save_alerts(data)

def clear_provider_alert(provider: str):
    """Xoá cảnh báo khi provider đã hoạt động lại (gọi thành công)."""
    with _alerts_lock:
        data = _load_alerts()
        if provider in data:
            data.pop(provider, None)
            _save_alerts(data)

def get_provider_alerts() -> list:
    with _alerts_lock:
        return list(_load_alerts().values())

_VBEE_CREDIT_HINTS = ["balance", "credit", "insufficient", "quota", "not enough", "không đủ", "payment"]

def _vbee_check_error(status: int, text: str):
    """Nếu phản hồi Vbee cho thấy hết ký tự/credit hoặc key bị từ chối thì ghi cảnh báo."""
    low = (text or "").lower()
    if status in (401, 402, 403) or (status in (400, 429) and any(k in low for k in _VBEE_CREDIT_HINTS) and "does not support" not in low and "rate" not in low):
        record_provider_alert("vbee", "critical", f"Vbee từ chối yêu cầu (HTTP {status}) - có thể đã HẾT KÝ TỰ/CREDIT hoặc API key không hợp lệ. Chi tiết: {(text or '')[:160]}")

AVAILABLE_VOICES = {
    # Chỉ dùng giọng Vbee (đã bỏ giọng OpenAI). Danh sách lấy từ Vbee API /v1/voices (vi-VN).
    # Gồm toàn bộ giọng tiết kiệm (credit x1) + 3 giọng cao cấp đã có sẵn từ trước.
    "hn_female_ngochuyen_full_48k-fhg": "[Nữ] Ngọc Huyền - Voice Review Phim/Sp #1 TikTok (48k)",
    "hn_female_maiphuong_vdts_48k-fhg": "[Nữ] Mai Phương - Hà Nội Trẻ Trung, Ngọt Ngào",
    "sg_female_thaotrinh_full_48k-fhg": "[Nữ] Thảo Trinh - Sài Gòn Sôi Nổi, Bán Hàng",
    "sg_female_lantrinh_vdts_48k-fhg": "[Nữ] Lan Trinh - Sài Gòn Thuyết Minh",
    "hn_female_ngochuyen_full_24k-st": "[Nữ] Ngọc Huyền - Hà Nội Tiêu Chuẩn 2.0 (Cao cấp)",
    "hn_male_minhquan_yt_24k-pre": "[Nam] Minh Quân - Hà Nội YouTube / Tin Tức (Cao cấp)",
    "hn_male_manhdung_full_24k-st": "[Nam] Mạnh Dũng - Hà Nội Thuyết Minh Truyền Cảm (Cao cấp)",
    "hn_female_hachi_book_22k-vc": "[Nữ] Hà Chi - Hà Nội, Kể chuyện",
    "hn_female_hermer_stor_48k-fhg": "[Nữ] Ngọc Lan - Hà Nội, Kể chuyện",
    "hn_female_lenka_stor_48k-phg": "[Nữ] Nguyệt Dương - Hà Nội, Kể chuyện",
    "hn_female_nganha_child_22k-vc": "[Nữ] Ngân Hà - Hà Nội, Giọng trẻ em",
    "hue_female_huonggiang_full_48k-fhg": "[Nữ] Hương Giang - Huế, Tư vấn",
    "sg_female_thaotrinh_full_44k-phg": "[Nữ] Thảo Trinh - Sài Gòn, Tư vấn",
    "sg_female_tuongvy_call_44k-fhg": "[Nữ] Tường Vy - Sài Gòn, Tư vấn",
    "hn_male_manhdung_news_48k-fhg": "[Nam] Mạnh Dũng - Hà Nội, Tin tức",
    "hn_male_manhdung_news_48k-phg": "[Nam] Mạnh Dũng - Hà Nội, Quảng cáo",
    "hn_male_minhquan_yt-stable": "[Nam] Minh Quân - Hà Nội, Quảng cáo",
    "hn_male_phuthang_news65dt_44k-fhg": "[Nam] Anh Khôi - Hà Nội, Tin tức",
    "hn_male_phuthang_stor80dt_48k-fhg": "[Nam] Anh Khôi - Hà Nội, Kể chuyện",
    "hn_male_thanhlong_talk_48k-fhg": "[Nam] Thanh Long - Hà Nội, Sách nói",
    "hn_male_vietbach_child_22k-vc": "[Nam] Việt Bách - Hà Nội, Giọng trẻ em",
    "hue_male_duyphuong_full_48k-fhg": "[Nam] Duy Phương - Huế, Sách nói",
    "sg_male_chidat_ebook_48k-phg": "[Nam] Chí Đạt - Sài Gòn, Sách nói",
    "sg_male_minhhoang_full_48k-fhg": "[Nam] Minh Hoàng - Sài Gòn, Giáo dục",
    "sg_male_trungkien_vdts_48k-fhg": "[Nam] Trung Kiên - Sài Gòn, Tư vấn",
}

# Giọng Vbee tiếng Anh: TOÀN BỘ giọng tiết kiệm (credit x1, en-US/GB/AU/IN). Chỉ hỗ trợ async.
AVAILABLE_VOICES_EN = {
    "Ivy": "[Nữ] Maddie - English US, tiết kiệm",
    "en-US-Standard-C": "[Nữ] Belinda - English US, tiết kiệm",
    "en-US-Standard-E": "[Nữ] Harper - English US, tiết kiệm",
    "en-US-Standard-F": "[Nữ] Megan - English US, tiết kiệm",
    "en-US-Standard-G": "[Nữ] Madison - English US, tiết kiệm",
    "en-US-Standard-H": "[Nữ] Melissa - English US, tiết kiệm",
    "en-US-Standard-A": "[Nam] Scott - English US, tiết kiệm",
    "en-US-Standard-B": "[Nam] Theodore - English US, tiết kiệm",
    "en-US-Standard-D": "[Nam] Cole - English US, tiết kiệm",
    "en-US-Standard-I": "[Nam] Joshua - English US, tiết kiệm",
    "en-US-Standard-J": "[Nam] Luis - English US, tiết kiệm",
    "en-AU-Standard-A": "[Nữ] Antony - English AU, tiết kiệm",
    "en-AU-Standard-C": "[Nữ] Martin - English AU, tiết kiệm",
    "en-AU-Standard-B": "[Nam] Taylor - English AU, tiết kiệm",
    "en-AU-Standard-D": "[Nam] Williams - English AU, tiết kiệm",
    "Emma": "[Nữ] Anna - English UK, tiết kiệm",
    "en-GB-Standard-A": "[Nữ] Laura - English UK, tiết kiệm",
    "en-GB-Standard-C": "[Nữ] Rebecca - English UK, tiết kiệm",
    "en-GB-Standard-F": "[Nữ] Sarah - English UK, tiết kiệm",
    "en-GB-Standard-N": "[Nữ] Clementine - English UK, tiết kiệm",
    "Brian": "[Nam] John - English UK, tiết kiệm",
    "en-GB-Standard-B": "[Nam] Brian - English UK, tiết kiệm",
    "en-GB-Standard-D": "[Nam] Christopher - English UK, tiết kiệm",
    "en-GB-Standard-O": "[Nam] Daniel - English UK, tiết kiệm",
    "en-IN-Standard-A": "[Nữ] Rahul - English India, tiết kiệm",
    "en-IN-Standard-D": "[Nữ] Nisha - English India, tiết kiệm",
    "en-IN-Standard-E": "[Nữ] Mihira - English India, tiết kiệm",
    "en-IN-Standard-B": "[Nam] Rohan - English India, tiết kiệm",
    "en-IN-Standard-C": "[Nam] Anita - English India, tiết kiệm",
    "en-IN-Standard-F": "[Nam] Kenneth - English India, tiết kiệm",
}
ALL_VOICES = {**AVAILABLE_VOICES, **AVAILABLE_VOICES_EN}

# Giọng Vbee hỗ trợ TTS sync (nhanh). Các giọng còn lại chạy thẳng async để khỏi tốn 1 lượt gọi lỗi.
VBEE_SYNC_VOICES = set(["hn_female_ngochuyen_full_48k-fhg", "sg_female_tuongvy_call_44k-fhg", "sg_female_thaotrinh_full_48k-fhg", "hn_female_maiphuong_vdts_48k-fhg", "sg_female_lantrinh_vdts_48k-fhg"])

DEFAULT_VOICE = "hn_female_ngochuyen_full_48k-fhg"

# Giới hạn thời lượng video được phép xử lý (giây) - tránh video dài tốn API Vbee/OpenAI
MAX_VIDEO_DURATION_SEC = 180
VIDEO_TOO_LONG_MSG = "Video quá dài, vui lòng chọn video dưới 3 phút."


def format_duration(seconds: float) -> str:
    seconds = int(seconds or 0)
    return f"{seconds // 60}:{seconds % 60:02d}"


def is_video_too_long(duration) -> bool:
    # Dung sai 1 giây để video đúng 3:00 không bị chặn nhầm do làm tròn
    return bool(duration) and duration > MAX_VIDEO_DURATION_SEC + 1


def _referer_for_url(url: str) -> str:
    u = url.lower()
    if "tiktok" in u or "byteoversea" in u:
        return "https://www.tiktok.com/"
    if "douyin" in u or "aweme.snssdk.com" in u or "iesdouyin.com" in u or "zjcdn.com" in u or "douyinvod" in u:
        return "https://www.douyin.com/"
    if "facebook.com" in u or "fbcdn" in u or "fb.watch" in u or "fb.com" in u:
        return "https://www.facebook.com/"
    return "https://www.xiaohongshu.com/"


def get_video_duration(path_or_url: str, timeout: int = 20):
    """Lấy thời lượng video (giây) từ file local hoặc URL. Trả về None nếu không xác định được."""
    if not path_or_url:
        return None
    try:
        is_url = path_or_url.lower().startswith(("http://", "https://"))
        page_platforms = ["youtube.com", "youtu.be", "facebook.com", "fb.watch", "fb.com", "instagram.com"]
        if is_url and any(k in path_or_url.lower() for k in page_platforms):
            # Link trang (không phải file CDN) -> dùng yt-dlp đọc metadata, không tải video
            r = subprocess.run(['yt-dlp', '--skip-download', '--no-warnings', '--print', 'duration', path_or_url],
                               capture_output=True, text=True, timeout=timeout, encoding='utf-8', errors='replace')
            val = (r.stdout or "").strip().splitlines()
            if val and val[0] not in ("NA", "None", ""):
                return float(val[0])
            return None

        base_cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1']
        attempts = [[]]
        if is_url:
            ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            attempts.append(['-user_agent', ua, '-headers', f"Referer: {_referer_for_url(path_or_url)}\r\n"])
        for extra in attempts:
            r = subprocess.run(base_cmd + extra + [path_or_url], capture_output=True, text=True, timeout=timeout, encoding='utf-8', errors='replace')
            val = (r.stdout or "").strip().splitlines()
            if val and val[0] not in ("N/A", ""):
                return float(val[0])
    except Exception as e:
        print(f"[get_video_duration] cannot read duration: {repr(e)[:200]}")
    return None

def download_file(url: str, dest_path: str):
    """Tải file từ URL về máy chủ với Referer phù hợp nền tảng & fallback yt-dlp nếu file < 100KB"""
    import re as _re
    url_lower = url.lower()

    # ── Chuẩn hóa URL Bilibili ──────────────────────────────────────────────
    # Bilibili dùng prefix ngôn ngữ cho một số quốc gia (VD: /vi/, /en/)
    # mà yt-dlp extractor KHÔNG nhận dạng được -> Phải strip về dạng chuẩn /video/BVxxxx
    if "bilibili.com" in url_lower:
        bv_match = _re.search(r'(BV[A-Za-z0-9]+)', url)
        av_match = _re.search(r'/av(\d+)', url)
        if bv_match:
            url = f"https://www.bilibili.com/video/{bv_match.group(1)}"
            url_lower = url.lower()
            print(f"[download_file] Bilibili URL normalized to: {url}")
        elif av_match:
            url = f"https://www.bilibili.com/video/av{av_match.group(1)}"
            url_lower = url.lower()
            print(f"[download_file] Bilibili URL normalized to: {url}")

    if "tiktok" in url_lower or "v19" in url_lower or "v16" in url_lower or "byteoversea" in url_lower or "tiktokcdn" in url_lower:
        referer = "https://www.tiktok.com/"
    elif "douyin" in url_lower or "aweme.snssdk.com" in url_lower or "iesdouyin.com" in url_lower:
        referer = "https://www.douyin.com/"
    elif "facebook.com" in url_lower or "fbcdn" in url_lower or "fb.watch" in url_lower or "fb.com" in url_lower:
        referer = "https://www.facebook.com/"
    elif "bilibili.com" in url_lower or "b23.tv" in url_lower:
        referer = "https://www.bilibili.com/"
    else:
        referer = "https://www.xiaohongshu.com/"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": referer
    }

    RESIDENTIAL_PROXY = "http://phannho01-zone-custom-region-US-session-39663902-sessTime-5:phannho01@global.rotgb.711proxy.com:10000"

    # Nếu là link Bilibili, Facebook, YouTube/Instagram/Twitter, dùng yt-dlp trực tiếp hoặc qua Residential Proxy để tải & gộp mp4 chuẩn
    if any(k in url_lower for k in ["bilibili.com", "b23.tv", "facebook.com", "fb.watch", "fb.com", "fbcdn", "youtube.com", "youtu.be", "instagram.com"]):
        print(f"[download_file] Bilibili/FB/YT/IG URL detected ({url[:60]}), trying yt-dlp direct...")
        # Thêm browser headers cho Bilibili để bypass 412 Precondition Failed
        bili_extra = []
        if any(k in url_lower for k in ['bilibili.com', 'b23.tv']):
            bili_extra = [
                '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                '--add-header', 'Referer:https://www.bilibili.com/',
                '--add-header', 'Origin:https://www.bilibili.com',
                '--add-header', 'Accept-Language:vi-VN,vi;q=0.9,zh-CN;q=0.8,zh;q=0.7,en;q=0.6',
            ]
        cmd = ['yt-dlp', '-f', 'b/bestvideo+bestaudio/best'] + bili_extra + ['-o', dest_path, '--no-warnings', '--force-overwrites', url]
        res = subprocess.run(cmd, capture_output=True, text=True, errors='replace', timeout=90)
        if res.returncode == 0 and os.path.exists(dest_path) and os.path.getsize(dest_path) > 100000:
            print(f"[download_file] yt-dlp direct SUCCESS! Size: {os.path.getsize(dest_path)} bytes")
            return dest_path
        
        print(f"[download_file] yt-dlp direct failed ({res.stderr[:150]}), trying yt-dlp with Residential Proxy...")
        cmd_proxy = ['yt-dlp', '-f', 'b/bestvideo+bestaudio/best', '--proxy', RESIDENTIAL_PROXY, '-o', dest_path, '--no-warnings', '--force-overwrites', url]
        res_p = subprocess.run(cmd_proxy, capture_output=True, text=True, errors='replace', timeout=120)
        if res_p.returncode == 0 and os.path.exists(dest_path) and os.path.getsize(dest_path) > 100000:
            print(f"[download_file] yt-dlp Residential Proxy SUCCESS! Size: {os.path.getsize(dest_path)} bytes")
            return dest_path
            
        print(f"[download_file] yt-dlp proxy failed ({res_p.stderr[:150]}), trying HTTP download...")
        # Nếu là Bilibili mà yt-dlp fail, raise lỗi trực tiếp từ yt-dlp để hệ thống bắt đúng mã 412
        if any(k in url_lower for k in ["bilibili.com", "b23.tv"]):
            err_detail = res_p.stderr.strip() or res.stderr.strip() or "Bilibili download failed"
            raise Exception(f"Bilibili download failed: {err_detail}")

    # Thử HTTP GET download
    try:
        with requests.get(url, headers=headers, stream=True, timeout=45) as r:
            r.raise_for_status()
            with open(dest_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=1024*1024):
                    f.write(chunk)
                    
        # Kiểm tra nếu file quá nhỏ (< 100 KB), nghĩa là bị tải nhầm playlist/manifest XML (.mpd/.m3u8)!
        file_size = os.path.getsize(dest_path) if os.path.exists(dest_path) else 0
        if file_size < 100000:
            print(f"[download_file] WARNING: Downloaded file size is too small ({file_size} bytes). Triggering yt-dlp proxy fallback...")
            cmd_proxy = ['yt-dlp', '-f', 'b/bestvideo+bestaudio/best', '--proxy', RESIDENTIAL_PROXY, '-o', dest_path, '--no-warnings', '--force-overwrites', url]
            res_p = subprocess.run(cmd_proxy, capture_output=True, text=True, errors='replace', timeout=120)
            if res_p.returncode == 0 and os.path.exists(dest_path) and os.path.getsize(dest_path) > 100000:
                print(f"[download_file] yt-dlp proxy fallback SUCCESS! Size: {os.path.getsize(dest_path)} bytes")
                return dest_path
                
        return dest_path
    except Exception as e:
        print(f"Download with referer '{referer}' failed ({e}), trying clean headers...")
        try:
            clean_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            }
            with requests.get(url, headers=clean_headers, stream=True, timeout=45) as r:
                r.raise_for_status()
                with open(dest_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=1024*1024):
                        f.write(chunk)
                        
            if os.path.exists(dest_path) and os.path.getsize(dest_path) < 100000:
                print(f"[download_file] Retry file size too small, running yt-dlp...")
                cmd = ['yt-dlp', '-f', 'b/bestvideo+bestaudio/best', '-o', dest_path, '--no-warnings', '--force-overwrites', url]
                subprocess.run(cmd, capture_output=True, text=True, errors='replace', timeout=90)
                
            return dest_path
        except Exception as e2:
            print(f"Direct download failed ({e2}), trying yt-dlp fallback...")
            cmd = ['yt-dlp', '-f', 'b/bestvideo+bestaudio/best', '-o', dest_path, '--no-warnings', '--force-overwrites', url]
            res = subprocess.run(cmd, capture_output=True, text=True, errors='replace', timeout=90)
            if res.returncode == 0 and os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
                return dest_path
            raise e

def extract_audio(video_path: str, audio_path: str):
    """Tách âm thanh từ file video mp4 thành file mp3, chuẩn hóa 16kHz mono để Whisper nhận diện tốt nhất ngay cả khi có nhạc nền"""
    try:
        (
            ffmpeg
            .input(video_path)
            .output(audio_path, format='mp3', audio_bitrate='128k', ar=16000, ac=1)
            .overwrite_output()
            .run(quiet=True)
        )
        return audio_path
    except ffmpeg.Error as e:
        print(f"FFmpeg Error: {e.stderr.decode('utf-8')}")
        raise e

HALLUCINATION_AND_PROMO_KEYWORDS = [
    # Tiếng Việt (Whisper hay tự sinh ra khi câm / nhạc nền)
    "cảm ơn các bạn đã theo dõi", "cảm ơn các bạn đã xem", "cảm ơn đã theo dõi", "cảm ơn đã xem",
    "hãy like và đăng ký", "nhớ like và đăng ký", "đăng ký kênh", "like và subscribe", "subscribe",
    "hẹn gặp lại các bạn", "hẹn gặp lại trong các video", "xin chào và hẹn gặp lại",
    "xin chào các bạn", "chào mừng các bạn", "chúc các bạn", "vietsub by", "sub by team", "sub by:",
    # Tiếng Trung (Lời chào đầu, tạm biệt, xin like/follow của video gốc)
    "谢谢观看", "感谢收看", "感谢观看", "谢谢大家的观看",
    "点赞关注", "记得关注", "关注我", "点个关注", "请订阅", "订阅我的频道", "别忘了点赞",
    "下期见", "我们下期再见", "下期视频见", "拜拜", "下期更精彩",
    "欢迎收看", "欢迎观看", "大家好我是", "哈喽大家好", "hello家人们",
    # Tiếng Anh
    "thanks for watching", "thank you for watching", "like and subscribe",
    "please subscribe", "don't forget to subscribe", "see you next time",
    "subtitles by", "amara.org", "www.youtube.com", "facebook.com",
    "字幕によって", "字幕提供"
]

def _merge_micro_segments(segments, max_gap: float = 0.55, max_merged_duration: float = 4.5):
    """
    Gộp các phân đoạn lời thoại quá ngắn (< 1.8s) hoặc bị ngắt quãng giữa câu vào nhau.
    Giúp câu thoại dịch đầy đủ ý, không bị vụn vặt và giọng đọc TTS liền mạch, mượt mà.
    """
    if not segments or len(segments) <= 1:
        return segments

    normalized = []
    for s in segments:
        text = (s.get('text') if isinstance(s, dict) else getattr(s, 'text', '')) or ''
        start = float(s.get('start') if isinstance(s, dict) else getattr(s, 'start', 0))
        end = float(s.get('end') if isinstance(s, dict) else getattr(s, 'end', 0))
        if text.strip() and end > start:
            normalized.append({'start': start, 'end': end, 'text': text.strip()})

    if not normalized:
        return []

    merged = [normalized[0]]
    for next_seg in normalized[1:]:
        prev_seg = merged[-1]
        gap = next_seg['start'] - prev_seg['end']
        combined_duration = next_seg['end'] - prev_seg['start']
        prev_duration = prev_seg['end'] - prev_seg['start']

        prev_text = prev_seg['text']
        ends_with_terminator = bool(re.search(r'[。！？.!?]$', prev_text))

        # Điều kiện gộp:
        # - Khoảng nghỉ giữa 2 phân đoạn rất nhỏ (gap <= max_gap, ví dụ <= 0.55s)
        # - Câu trước còn ngắn (< 1.8s) HOẶC câu trước chưa có dấu kết thúc câu
        # - Tổng thời lượng sau khi gộp không quá dài (<= max_merged_duration, ví dụ <= 4.5s)
        if gap >= -0.2 and gap <= max_gap and combined_duration <= max_merged_duration and (prev_duration < 1.8 or not ends_with_terminator):
            is_cjk_end = bool(re.search(r'[\u4e00-\u9fff]$', prev_text))
            sep = "" if is_cjk_end else " "
            prev_seg['text'] = f"{prev_text}{sep}{next_seg['text']}"
            prev_seg['end'] = max(prev_seg['end'], next_seg['end'])
        else:
            merged.append(next_seg)

    return merged

def transcribe_audio(audio_path: str, language: str = None):
    """
    Sử dụng OpenAI Whisper nhận diện giọng nói.
    - Bảo lưu lời thoại tiếng Trung thật ngay cả khi có nhạc nền to (không lọc nhầm dựa trên no_speech_prob).
    - Tự động fallback sang language='zh' nếu lượt đầu không nhận diện được phân đoạn nào.
    - Loại bỏ triệt để hallucination và các câu chào, tạm biệt, xin subscribe của kênh gốc.
    """
    def _call_whisper(lang=None):
        kwargs = {
            "file": audio_file,
            "model": "whisper-1",
            "temperature": 0.0,
            "response_format": "verbose_json",
            "timestamp_granularities": ["segment"],
            "prompt": "Accurately transcribe spoken dialogue from the very beginning across Chinese, English, Vietnamese."
        }
        if lang:
            kwargs["language"] = lang
        return openai_client.audio.transcriptions.create(**kwargs)

    try:
        with open(audio_path, "rb") as audio_file:
            transcript = _call_whisper(language)
    except Exception as e:
        print(f"[transcribe_audio] Whisper error: {e}")
        if _is_openai_quota_error(e):
            record_provider_alert("openai", "critical", OPENAI_QUOTA_ALERT)
            raise Exception(OPENAI_QUOTA_MSG)
        return []

    clear_provider_alert("openai")  # Whisper gọi thành công => credit OpenAI còn dùng được

    raw_segments = getattr(transcript, 'segments', [])
    
    # Nếu lượt đầu không có segment nào và chưa set language, tự động thử lại với language='zh'
    if len(raw_segments) == 0 and not language:
        try:
            print("[transcribe_audio] 0 segments detected, retrying with language='zh' (Chinese fallback)...")
            with open(audio_path, "rb") as audio_file:
                transcript = _call_whisper("zh")
            raw_segments = getattr(transcript, 'segments', [])
            print(f"[transcribe_audio] Fallback zh result: {len(raw_segments)} segments")
        except Exception as fe:
            print(f"[transcribe_audio] Fallback zh error: {fe}")

    clean_segments = []
    cjk_pattern = re.compile(r'[\u4e00-\u9fff]')
    last_normalized_text = ""
    consecutive_repeat_count = 0

    for seg in raw_segments:
        text = seg.get('text', '').strip() if isinstance(seg, dict) else getattr(seg, 'text', '').strip()
        no_speech_prob = seg.get('no_speech_prob', 0) if isinstance(seg, dict) else getattr(seg, 'no_speech_prob', 0)
        avg_logprob = seg.get('avg_logprob', 0) if isinstance(seg, dict) else getattr(seg, 'avg_logprob', 0)
        
        if not text:
            continue
            
        has_cjk = bool(cjk_pattern.search(text))
        
        # Nếu không có chữ Hán và text quá ngắn hoặc toàn ký tự đặc biệt
        if not has_cjk and (len(text) < 2 or not any(c.isalnum() for c in text)):
            continue
            
        # Kiểm tra lọc tiếng ồn: Nếu CÓ chữ Hán (lời thoại tiếng Trung thật), KHÔNG ĐƯỢC XÓA
        # Chỉ loại bỏ khi KHÔNG có chữ Hán VÀ cả 2 chỉ số đều cực kỳ tệ
        if not has_cjk and no_speech_prob > 0.85 and avg_logprob < -1.8:
            print(f"[transcribe] Skipped noise non-cjk segment (no_speech={no_speech_prob:.2f}): '{text[:50]}'")
            continue

        lower_text = text.lower()
        if any(keyword in lower_text for keyword in HALLUCINATION_AND_PROMO_KEYWORDS):
            print(f"[transcribe] Skipped promo/hallucinated phrase: '{text}'")
            continue

        # ĐẶC TRỊ BUG LẶP CÂU / CỤM TỪ (Whisper Repetition Hallucination Loop):
        # Khi có nhạc nền/đoạn câm ở giữa/cuối video, Whisper hay bị lặp đi lặp lại 1 câu/từ (ví dụ: "猜猜", "关注", "chào bạn"...)
        normalized = re.sub(r'[^\w\u4e00-\u9fff]', '', lower_text)
        is_repeat = False
        if normalized:
            if normalized == last_normalized_text:
                is_repeat = True
            elif len(normalized) <= 12 and last_normalized_text and len(last_normalized_text) <= 12:
                if normalized in last_normalized_text or last_normalized_text in normalized:
                    is_repeat = True

        if is_repeat:
            consecutive_repeat_count += 1
            if consecutive_repeat_count >= 3:
                print(f"[transcribe] Skipped repetitive hallucinated segment #{consecutive_repeat_count}: '{text}'")
                continue
        else:
            if normalized:
                last_normalized_text = normalized
                consecutive_repeat_count = 1

        clean_segments.append(seg)
    merged_segments = _merge_micro_segments(clean_segments)
    print(f"[transcribe] Tổng: {len(raw_segments)} segments raw → {len(clean_segments)} segments lọc → {len(merged_segments)} segments sau khi gộp câu trọn vẹn")
    return merged_segments


import base64
import math

def extract_frames(video_path: str, output_dir: str, max_frames: int = 15):
    """Trích xuất tối đa max_frames khung hình phân bổ đều xuyên suốt video, scale nhỏ để OCR siêu nhẹ và chính xác"""
    frames_dir = os.path.join(output_dir, "frames")
    if os.path.exists(frames_dir):
        import shutil
        shutil.rmtree(frames_dir, ignore_errors=True)
    os.makedirs(frames_dir, exist_ok=True)
    
    try:
        probe = ffmpeg.probe(video_path)
        duration = float(probe['format']['duration'])
    except Exception:
        duration = 30.0

    target_fps = max(0.15, min(0.6, max_frames / max(duration, 1.0)))
    try:
        (
            ffmpeg
            .input(video_path)
            .filter('fps', fps=target_fps)
            .filter('scale', 640, -1)
            .output(os.path.join(frames_dir, 'frame_%04d.jpg'), **{'qscale:v': 5})
            .overwrite_output()
            .run(quiet=True)
        )
        return frames_dir, duration
    except ffmpeg.Error as e:
        print(f"FFmpeg Extract Frames Error: {e.stderr.decode('utf-8') if e.stderr else e}")
        return None, duration

def transcribe_video_ocr(video_path: str, output_dir: str):
    """Sử dụng OpenAI Vision API (gpt-4o-mini) đọc chữ phụ đề trên màn hình video nhẹ nhàng và ghép thành segments"""
    frames_dir, duration = extract_frames(video_path, output_dir, max_frames=15)
    if not frames_dir or not os.path.exists(frames_dir):
        return []
        
    image_files = sorted([f for f in os.listdir(frames_dir) if f.endswith('.jpg')])
    if not image_files:
        return []
        
    # Giới hạn tối đa 15 frames để không bao giờ bị vượt payload hay rate limit
    if len(image_files) > 15:
        step = len(image_files) / 15.0
        image_files = [image_files[int(i * step)] for i in range(15)]
        
    content_messages = [
        {"type": "text", "text": f"Đây là {len(image_files)} khung hình video được trích xuất (tổng thời lượng video khoảng {round(duration, 1)}s). Hãy đọc toàn bộ CHỮ PHỤ ĐỀ / LỜI THOẠI TIẾNG TRUNG có trên video theo thứ tự thời gian. Bỏ qua các nút UI (like, share, follow, tên user). Ghép thành các câu hoàn chỉnh, loại bỏ câu trùng lặp giữa các khung hình liên tiếp. Ước tính mốc thời gian 'start' và 'end' (tính bằng giây). Bỏ qua các câu chào tạm biệt hoặc xin like follow. Trả về DUY NHẤT một JSON array: [{{'start': 0.0, 'end': 3.0, 'text': 'chữ tiếng trung'}}, ...]"}
    ]
    
    for img_name in image_files:
        img_path = os.path.join(frames_dir, img_name)
        try:
            with open(img_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            content_messages.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}",
                    "detail": "low"
                }
            })
        except Exception:
            pass
        
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a Video OCR bot. Output ONLY a valid JSON array of objects with keys 'start', 'end', and 'text'."},
                {"role": "user", "content": content_messages}
            ],
            max_tokens=3000,
            temperature=0.1
        )
        
        raw_content = response.choices[0].message.content.strip()
        match = re.search(r'\[[\s\S]*\]', raw_content)
        if match:
            ocr_segments = json.loads(match.group(0))
        else:
            ocr_segments = json.loads(raw_content)
        
        # Clean up frames
        for img_name in os.listdir(frames_dir):
            try:
                os.remove(os.path.join(frames_dir, img_name))
            except:
                pass
        try:
            os.rmdir(frames_dir)
        except:
            pass
        
        clean_segments = []
        for seg in ocr_segments:
            txt = (seg.get('text') or '').strip()
            if txt:
                clean_segments.append({
                    'text': txt,
                    'start': float(seg.get('start', 0)),
                    'end': float(seg.get('end', float(seg.get('start', 0)) + 2.5))
                })
        return _merge_micro_segments(clean_segments)
        
    except Exception as e:
        print(f"Vision API OCR error: {e}")
        if _is_openai_quota_error(e):
            record_provider_alert("openai", "critical", OPENAI_QUOTA_ALERT)
            raise Exception(OPENAI_QUOTA_MSG)
        return []

def translate_segments(segments, translation_style: str = "tiktok", target_language: str = "vi"):
    """Dùng GPT-4o-mini với ngữ cảnh toàn kịch bản, bảng từ lóng mạng xã hội và kiểm soát thời lượng phát âm"""
    if not segments:
        return []
        
    script_data = []
    full_text_list = []
    for i, s in enumerate(segments):
        txt = s.text if hasattr(s, 'text') else s.get('text', '')
        start = s.start if hasattr(s, 'start') else s.get('start', 0)
        end = s.end if hasattr(s, 'end') else s.get('end', 0)
        duration = round(max(0.5, end - start), 1) if (end and start and end > start) else 2.0
        script_data.append({"id": i, "text": txt, "duration_sec": duration})
        if txt and txt.strip():
            full_text_list.append(txt.strip())
            
    full_script_context = " | ".join(full_text_list)
    
    style_guides = {
        "tiktok": """
        PHONG CÁCH: Review TikTok / Reels / Shorts (Bán Hàng, Cuốn Hút, Giữ Chân Người Xem).
        Vai trò: Đóng vai Content Creator chuyên review sản phẩm triệu view trên TikTok/Reels.
        - Hook 3 giây đầu: Câu mở đầu PHẢI tạo tò mò, giật gân hoặc đánh trúng ngay "pain point" của khách hàng.
        - Ngôi xưng hô: Xưng 'mình' (hoặc 'tui / em') - Gọi người xem: 'các bác / mấy bà / cả nhà / mọi người'. Tuyệt đối KHÔNG xưng 'tôi - bạn', KHÔNG dịch ngô nghê như 'gia đình ơi / các chị em gái / các em bé'.
        - Giọng điệu: Sôi nổi, dồn dập, câu ngắn (5-8 từ/câu), từ khóa tạo cảm xúc mạnh: 'đỉnh chóp', 'siêu phẩm', 'cứu tinh', 'đáng tiền', 'ngon-bổ-rẻ', 'mê xỉu', 'hack dáng', 'nhắm mắt múc luôn'.
        - CTA tự nhiên: Lời kêu gọi hành động được lồng ghép mượt mà ở cuối nếu phù hợp.
        """,
        "story": """
        PHONG CÁCH: Thuyết Minh Mềm Mại / Tự Sự (Truyền Cảm, Nhẹ Nhàng, Sâu Lắng, Tinh Tế).
        Vai trò: Đóng vai biên dịch viên chuyên viết kịch bản thuyết minh tài liệu, vlog chữa lành (healing) và podcast.
        - Ngôi xưng hô: Xưng 'mình' hoặc 'tôi' - Gọi người nghe: 'bạn / mọi người', hoặc dùng lối dẫn truyện khách quan ngôi thứ 3.
        - Giọng điệu: Dịu dàng, nhã nhặn, mượt mà, giàu cảm xúc. Chọn lọc từ ngữ giàu hình ảnh, dùng các từ láy, từ miêu tả cảm xúc mượt mà. Tránh từ lóng hiện đại hoặc từ kỹ thuật thô cứng.
        - Nhịp điệu: Thong thả, có dấu ngắt nghỉ hợp lý để diễn viên lồng tiếng dễ lấy hơi và ngắt câu truyền cảm.
        - Phù hợp: Vlog đời sống, tâm sự, thời trang thanh lịch, chăm sóc bản thân, chữa lành, cẩm nang cuộc sống.
        """,
        "natural": """
        PHONG CÁCH: Đời Thường Gần Gũi (Tự Nhiên 100% Như Người Việt Trò Chuyện Trực Tiếp Hàng Ngày).
        Vai trò: Đóng vai biên dịch viên phim chuyên nghiệp, dịch thoại chuẩn khẩu ngữ đời thường.
        - Ngôi xưng hô: Linh hoạt theo ngữ cảnh (mình, em, tao, tui...) - Gọi người nghe: 'bạn / các bác / mọi người'. Có thể dùng mày-tao, anh-em, ông-tôi tùy ngữ cảnh nhân vật.
        - Giọng điệu: Thân thiện, chân thật, mộc mạc. Thêm từ đệm tự nhiên: 'chứ', 'mà', 'ê', 'nè', 'nhỉ', 'nha', 'đấy'. Câu cú gãy gọn, dễ nhớ, dễ hiểu.
        - Nguyên tắc: Nếu dịch sát nghĩa mà nghe bị cứng, hãy linh hoạt viết lại (paraphrase) theo cách diễn đạt thuần Việt nhất. KHÔNG dịch thô, KHÔNG dùng câu từ kiểu 'văn dịch máy'.
        - Phù hợp: Hướng dẫn mẹo vặt, chia sẻ trải nghiệm, nấu ăn, ẩm thực, công nghệ gia đình.
        """,
        "wuxia": """
        PHONG CÁCH: Phim Kiếm Hiệp / Tu Tiên / Cổ Trang (Wuxia / Xianxia - Cổ Phong Hùng Hạo).
        Vai trò: Đóng vai chuyên gia dịch thuật dòng phim Kiếm hiệp / Cổ trang / Tiên hiệp.
        - Văn phong: Cổ kính, dứt khoát, uy nghiêm, hùng hạo. Câu ngắn gọn nhưng mang khí chất giang hồ hoặc sự thoát tục của tiên gia.
        - Thuật ngữ bắt buộc: Sử dụng triệt để hệ thống từ Hán-Việt cổ phong: 'xuất chiêu', 'đột phá cảnh giới', 'bế quan', 'linh khí', 'nội lực', 'thiên mệnh', 'đại đạo', 'siêu phàm nhập thánh', 'tu vi', 'đan dược', 'pháp bảo', 'tông môn'.
        - Danh xưng: Giữ đúng xưng hô giang hồ/tiên môn: Tại hạ, Bổn tọa, Lão phu, Tiền bối, Đạo hữu, Huynh đệ, Chưởng môn, Sư đệ, Bệ hạ, Công tử, Nương tử.
        - Tên chiêu thức/vật phẩm/địa danh: Dịch chuẩn âm Hán-Việt mang cảm giác hoành tráng, kỳ ảo.
        - Tuyệt đối không dùng từ lóng hiện đại, ngôn ngữ đời thường hay từ ngoại lai.
        """,
        "cinematic": """
        PHONG CÁCH: Chuẩn Mực Điện Ảnh (Cinema / Documentary Standard - Sang Trọng, Tinh Giản, Chuẩn Xác).
        Vai trò: Đóng vai chuyên gia dịch phụ đề phim điện ảnh (Subtitle Editor) theo tiêu chuẩn chiếu rạp.
        - Tiêu chuẩn: Ngắn gọn, súc tích, dễ đọc. Mỗi câu dịch tối đa 40 ký tự, tập trung vào ý chính.
        - Tinh giản: Lược bỏ các từ dư thừa nhưng phải giữ trọn vẹn ý nghĩa, ngữ cảnh và sắc thái biểu cảm của thoại gốc.
        - Tông giọng: Chuẩn mực, điện ảnh, trau chuốt. Dùng từ ngữ trung tính, sang trọng. Không dùng từ lóng quá đà trừ khi nhân vật bắt buộc.
        - Phù hợp: Phim tài liệu, phim ngắn nghệ thuật, vlog du lịch, video thiên nhiên, video động lực, nội dung có chiều sâu.
        """,
        "localize": """
        PHONG CÁCH: Bản Địa Hóa / Việt Hóa Hoàn Toàn (Localization - Như Người Việt Tự Viết Ra).
        Vai trò: Đóng vai chuyên gia Bản địa hóa (Localization Specialist) văn hóa Việt Nam.
        - Mục tiêu: Làm cho khán giả Việt Nam cảm thấy nội dung này như được viết ra bởi chính người Việt, không còn nét văn hóa nước ngoài xa lạ.
        - Chuyển đổi văn hóa: Thay thế câu nói đùa, puns, idioms nước ngoài bằng ca dao, tục ngữ hoặc cụm từ tương đương trong văn hóa Việt. Thay địa danh, tên món ăn, biểu tượng văn hóa nước ngoài thành tương đương Việt Nam khi phù hợp.
        - Nguyên tắc: Không dịch từ đối từ. Tập trung truyền tải thông điệp tương đương (Equivalence). Tự do sáng tạo về mặt từ ngữ để đạt độ Việt hóa cao nhất nhưng vẫn giữ ý chính và thông điệp gốc.
        - Phù hợp: Video hài, sketch, meme, lifestyle, nội dung có nhiều yếu tố văn hóa đặc thù nước ngoài.
        """
    }
    
    dictionary_rules = """
    TỪ ĐIỂN CHUYỂN NGỮ TIẾNG LÓNG & TỪ KHÓA MẠNG XÃ HỘI (DOUYIN / TIKTOK / TIẾNG TRUNG):
    - '显瘦' -> 'hack dáng / giấu mỡ / tôn dáng / trông thon gọn hẳn'
    - '显白' -> 'nâng tông da / trắng bật tông / siêu sáng da'
    - '绝了 / 太绝了' -> 'đỉnh chóp / mê xỉu / đỉnh thực sự / quá xuất sắc'
    - '绝绝子' -> 'đỉnh chóp / xịn đét / hết nước chấm / quá ô dề'
    - '闭眼入 / 闭眼冲' -> 'nhắm mắt múc luôn / mua không cần nghĩ / cứ chốt đơn đừng ngại'
    - '种草' -> 'bị gieo mầm mê / bị đầu độc / mê không lối thoát / ưng bụng muốn tậu'
    - '拔草' -> 'chốt đơn / rút cọc / hết mê / tậu về liền tay'
    - '全网最低价' -> 'giá sập sàn / giá hủy diệt / rẻ vô đối'
    - '踩雷 / 避雷' -> 'dẫm mìn / hàng tệ / phốt to / né gấp / đồ dỏm'
    - '质感 / 高级感' -> 'chất vải xịn sò / form đứng cực sang / đẳng cấp hẳn'
    - '打脸' -> 'bị quê / lật kèo / vỡ mộng'
    - '性价比 / 平价' -> 'ngon bổ rẻ / giá hạt dẻ / siêu hời / giá cực êm'
    - '氛围感' -> 'cực thơ / vibe sang chảnh / có gu / đầy cuốn hút'
    - '百搭' -> 'dễ phối đồ / cân mọi outfit / phối gì cũng hợp'
    - '破防' -> 'nhói lòng / sụp đổ tâm lý / muốn khóc thét'
    - '上头' -> 'dính để đời / mê không lối thoát / bị thao túng tâm lý'
    - '下头' -> 'tụt mood / mất cảm tình / tắt đài / hết hồn'
    - '硬控' -> 'dán mắt vào màn hình / cuốn cứng ngắc không lướt được'
    - '社死' -> 'quê xệ / đội quần / muốn độn thổ'
    - '栓Q' -> 'chịu chết / cạn lời / hết nói nổi'
    - '内卷' -> 'cạnh tranh độc hại / chạy deadline vắt chân lên cổ'
    - '躺平' -> 'nằm ngửa / sống tối giản / mặc kệ sự đời'
    - '摸鱼' -> 'trốn việc / lướt top top giờ hành chính'
    - 'i人 / e人' -> 'dân hệ hướng nội / dân hệ hướng ngoại'
    - '家人们 / 姐妹们 / 宝子们' -> 'mọi người ơi / mấy bà ơi / các bác ơi / cả nhà ơi' (TUYỆT ĐỐI KHÔNG dịch: 'gia đình ơi', 'các chị em gái')
    - '上身效果' -> 'lên dáng / mặc lên người / khi mặc thử'
    """
    
    selected_guide = style_guides.get(translation_style, style_guides["tiktok"])
    
    # Bộ từ điển TikTok/Douyin chỉ áp dụng cho phong cách tiktok, không inject vào các phong cách khác
    dict_section = f"\n=== QUY TẮC TỪ ĐIỂN BẮT BUỘC (Tiếng Lóng TikTok / Douyin) ===\n{dictionary_rules}\n" if translation_style == "tiktok" else ""
    
    prompt = f"""Bạn là một chuyên gia biên dịch và chuyển ngữ kịch bản lồng tiếng video ngắn hàng đầu Việt Nam.
Nhiệm vụ của bạn là dịch TOÀN BỘ kịch bản video dưới đây (gốc là tiếng Trung, tiếng Anh hoặc ngôn ngữ khác) sang 100% TIẾNG VIỆT tự nhiên, mượt mà và cuốn hút.

=== BỐI CẢNH NỘI DUNG TOÀN BỘ VIDEO (Đọc kịch bản thô để nắm trọn cốt truyện) ===
"{full_script_context}"

=== PHONG CÁCH YÊU CẦU ===
{selected_guide}

{dict_section}
=== NGUYÊN TẮC BẮT BUỘC PHẢI TUÂN THỦ ===
1. ĐỌC HIỂU TOÀN BỘ MẠCH CHUYỆN: Trước khi dịch từng câu, hãy hiểu cả kịch bản để dịch liền mạch. Các câu khi nối tiếp nhau phải tạo thành bài nói hoàn chỉnh của người Việt, KHÔNG dịch rời rạc word-by-word.
2. DỊCH ĐẦY ĐỦ Ý, TRỌN VẸN CÂU NÓI:
   - Mỗi câu dịch PHẢI ĐẦY ĐỦ Ý, CÓ ĐẦU CÓ ĐUÔI, tự nhiên và trôi chảy. Tuyệt đối KHÔNG dịch cụt ngủn, ngắt lửng câu làm mất nghĩa hoặc nghe bị gãy cụt ý.
   - Dung lượng câu dịch phù hợp với thời lượng duration_sec (tốc độ nói chuẩn tiếng Việt 3.0 - 3.4 từ mỗi giây). Ví dụ: duration = 2.0s -> Dịch khoảng 6-7 từ. duration = 3.5s -> Dịch khoảng 10-12 từ.
   - ĐẶC BIỆT VỚI TIẾNG TRUNG NÓI NHANH: Hãy dịch cô đọng, súc tích, thoát ý nhưng BẮT BUỘC PHẢI GIỮ TRỌN VẸN Ý NGHĨA và thông điệp của câu nói.
3. 100% TIẾNG VIỆT CÓ DẤU CHUẨN: Tuyệt đối không để sót bất kỳ chữ Hán (tiếng Trung) nào. Giữ nguyên các thương hiệu quốc tế hoặc thông số kỹ thuật (như iPhone, Chanel, Uniqlo, 50kg, 100ml...).
4. NẾU CÂU LÀ TIẾNG ỒN HOẶC VÔ NGHĨA: Trả về "translation": "".
5. BẮT BUỘC LOẠI BỎ LỜI CHÀO HỎI, TẠM BIỆT & KÊU GỌI FOLLOW/ĐĂNG KÝ KÊNH GỐC:
   - Các câu chào đầu sáo rỗng (như: 'Xin chào mọi người', 'Chào mừng đến với kênh', '哈喽大家好', '大家好'...).
   - Các câu chào tạm biệt ở cuối video (như: 'Hẹn gặp lại', 'Tạm biệt', 'Bye bye', '下期见', '拜拜', '我们下期再见'...).
   - Các câu kêu gọi đăng ký, like, follow kênh gốc (như: 'Nhớ like và follow', 'Đăng ký kênh', '点赞关注', '记得关注我', '点个关注'...).
   -> Đối với những câu này, BẮT BUỘC trả về "translation": "" (chuỗi rỗng). Tuyệt đối không dịch và không giữ lại.
6. ĐỊNH DẠNG ĐẦU RA: Trả về DUY NHẤT một JSON array các object: [{{"id": 0, "translation": "câu dịch"}}, ...]

Danh sách các câu cần dịch:
{json.dumps(script_data, ensure_ascii=False)}"""

    if target_language == 'en':
        en_style = {
            "tiktok": "energetic, punchy, conversational TikTok/Reels voice-over with a strong hook in the first sentence",
            "story": "warm, gentle, emotional storytelling narration - rich in imagery, no modern slang",
            "natural": "casual, friendly, everyday spoken English like chatting with a friend, use natural filler words",
            "wuxia": "classical wuxia/xianxia martial arts narrative - epic, formal, using ancient honorifics and dramatic action language",
            "cinematic": "elegant, precise, cinema-standard subtitling - concise (max 40 chars per line), refined without slang",
            "localize": "fully localized for English-speaking Western audience - replace cultural references with Western equivalents"
        }.get(translation_style, "energetic, conversational short-video voice-over")
        prompt = f"""You are an expert video localization translator.
Translate the ENTIRE short-video script below (source may be Chinese, Vietnamese or another language) into natural, fluent, engaging ENGLISH for voice-over dubbing.

=== FULL VIDEO CONTEXT ===
"{full_script_context}"

=== STYLE ===
{en_style}

=== RULES ===
1. Read the whole script first and translate it coherently as one spoken piece, NOT word-by-word.
2. Every translated line must be a COMPLETE natural sentence that keeps the full meaning. Never cut a sentence short.
3. Fit the spoken length to duration_sec (about 2.5-3 English words per second). For fast Chinese speech, condense the wording but KEEP the full meaning.
4. 100% English: leave no Chinese characters or Vietnamese words. Keep brand names and specs (iPhone, Uniqlo, 50kg, 100ml).
5. If a line is noise or meaningless, return "translation": "".
6. REMOVE greetings, goodbyes and calls to like/follow/subscribe the original channel (e.g. "hello everyone", "see you next time", "remember to follow"): return "translation": "" for them.
7. OUTPUT ONLY a JSON array of objects: [{{"id": 0, "translation": "..."}}, ...]

Lines to translate:
{json.dumps(script_data, ensure_ascii=False)}"""
        system_msg = "You are a professional video translator to English. Output ONLY a valid JSON array of objects with keys 'id' and 'translation'."
    else:
        system_msg = "You are a professional video translator to Vietnamese. Output ONLY a valid JSON array of objects with keys 'id' and 'translation'."

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        
        raw_content = response.choices[0].message.content.strip()
        if "```json" in raw_content:
            raw_content = raw_content[raw_content.find("```json")+7:raw_content.rfind("```")].strip()
        elif "```" in raw_content:
            raw_content = raw_content[raw_content.find("```")+3:raw_content.rfind("```")].strip()
            
        translated_list = json.loads(raw_content)
        trans_map = {item['id']: item['translation'] for item in translated_list if 'id' in item and 'translation' in item}
    except Exception as e:
        print(f"Translation JSON error: {e}")
        trans_map = {}

    has_chinese_regex = re.compile(r'[\u4e00-\u9fff]')
    unwanted_vn_phrases = [
        "đăng ký kênh", "like và subscribe", "subscribe kênh", "bấm theo dõi", 
        "hẹn gặp lại các bạn", "hẹn gặp lại trong các video", "xin chào và hẹn gặp lại",
        "cảm ơn các bạn đã theo dõi", "cảm ơn các bạn đã xem", "cảm ơn đã theo dõi", "cảm ơn đã xem",
        "nhớ follow kênh", "follow kênh của mình", "nhớ bấm follow", "nhớ thả tim và follow",
        "hãy like và đăng ký", "nhớ like và đăng ký", "nhớ like và subscribe",
        "tạm biệt và hẹn gặp lại", "chúc các bạn một ngày tốt lành và hẹn gặp lại"
    ]
    
    translated_segments = []
    if target_language == 'en':
        unwanted_vn_phrases = [
            "subscribe", "like and follow", "follow me", "follow our", "follow my", "hit the like", "smash the like",
            "see you next time", "see you in the next", "thanks for watching", "thank you for watching"
        ]
    last_trans_norm = ""
    trans_repeat_count = 0

    for i, s in enumerate(segments):
        orig_t = s.text if hasattr(s, 'text') else s.get('text', '')
        translated_text = trans_map.get(i)
        
        # Nếu câu gốc là lời chào, tạm biệt, xin like/follow kênh gốc -> Bỏ qua ngay
        is_promo_orig = any(kw in orig_t.lower() for kw in HALLUCINATION_AND_PROMO_KEYWORDS)
        if is_promo_orig:
            translated_text = ""
            
        # Chỉ gọi retranslate nếu translated_text là None (không có trong JSON) hoặc còn sót chữ Hán
        need_retranslate = False
        if translated_text is None and orig_t and orig_t.strip() and not is_promo_orig:
            need_retranslate = True
        elif translated_text and has_chinese_regex.search(str(translated_text)) and not is_promo_orig:
            need_retranslate = True
            
        if need_retranslate:
            try:
                if target_language == 'en':
                    fb_system = "You are a professional video translator. Return ONLY the natural English translation, with no Chinese characters. If the line is a greeting, goodbye or a call to like/follow/subscribe, return an empty string."
                    fb_user = f"Translate this line into natural, fluent English for voice-over: '{orig_t}'. Do not leave any Chinese characters."
                else:
                    fb_system = "Bạn là chuyên gia chuyển ngữ video sang tiếng Việt tự nhiên. Chỉ trả về câu dịch tiếng Việt thuần túy, tuyệt đối không để sót chữ Trung Quốc. Nếu câu là lời chào tạm biệt hay kêu gọi like/follow kênh gốc, trả về chuỗi rỗng."
                    fb_user = f"Dịch câu thoại sau sang Tiếng Việt chuẩn tự nhiên, bắt trend: '{orig_t}'. Tuyệt đối không để lại chữ Hán."
                sub_res = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": fb_system},
                        {"role": "user", "content": fb_user}
                    ],
                    max_tokens=150,
                    temperature=0.2
                )
                translated_text = sub_res.choices[0].message.content.strip().strip('"').strip("'")
            except Exception as fe:
                print(f"[translate fallback] Error for seg {i}: {fe}")
                if not translated_text:
                    translated_text = ""

        # Bộ lọc hậu kỳ: nếu bản dịch tiếng Việt vẫn còn chứa các câu chào/tạm biệt/kêu gọi follow rác
        if translated_text:
            tl_lower = translated_text.lower()
            if any(unw in tl_lower for unw in unwanted_vn_phrases):
                translated_text = ""

        # Bộ lọc lặp lại chuỗi dịch trùng lặp liên tiếp (Triệt tiêu câu dịch lặp lại từ lần 3 trở đi)
        if translated_text and translated_text.strip():
            trans_norm = re.sub(r'[^\w]', '', translated_text.lower())
            if trans_norm and trans_norm == last_trans_norm:
                trans_repeat_count += 1
                if trans_repeat_count >= 3:
                    print(f"[translate] Skipped 3rd+ consecutive repeated translation #{trans_repeat_count}: '{translated_text}'")
                    translated_text = ""
            else:
                if trans_norm:
                    last_trans_norm = trans_norm
                    trans_repeat_count = 1

        translated_segments.append({
            "id": i,
            "start": s.start if hasattr(s, 'start') else s.get('start', 0),
            "end": s.end if hasattr(s, 'end') else s.get('end', 0),
            "original_text": orig_t,
            "translated_text": translated_text
        })
        
    return translated_segments

def rewrite_script(segments, rewrite_mode: str = "review", target_language: str = "vi"):
    """Viết lại TOÀN BỘ kịch bản từ nội dung video gốc theo phong cách mới (không chỉ dịch)"""
    if not segments:
        return []
    
    # Chuẩn bị dữ liệu gốc
    script_data = []
    full_text_list = []
    for i, s in enumerate(segments):
        text = s.get('translated_text') or s.get('original_text') or (s.text if hasattr(s, 'text') else s.get('text', ''))
        start = s.get('start', s.start if hasattr(s, 'start') else 0)
        end = s.get('end', s.end if hasattr(s, 'end') else 0)
        duration = round(max(0.5, end - start), 1) if (end and start and end > start) else 2.0
        script_data.append({"id": i, "text": text, "duration": duration})
        if text and text.strip():
            full_text_list.append(text.strip())
            
    full_script_overview = " ".join(full_text_list)
    
    rewrite_guides = {
        "review": """
        PHONG CÁCH: Review Sản Phẩm / Trải Nghiệm Thực Tế (Cuốn Hút, Tạo FOMO, Chân Thực)
        - Bám sát CHỦ ĐỀ / SẢN PHẨM thực tế trong video gốc (thời trang, đồ ăn, gia dụng, làm đẹp, đồ công nghệ, đời sống...).
        - Câu đầu tiên: HOOK giật gân, tạo sự tò mò ngay giây đầu (ví dụ: 'Nói thật với các bác, ai mà đang định mua em này thì dừng lại 3 giây nghe tui nói đã...').
        - Thân bài: Nêu bật ưu điểm vượt trội, cảm nhận chân thực, lý do vì sao phải sở hữu.
        - Câu cuối: Kêu gọi hành động khéo léo (CTA: lưu lại kẻo quên, vào giỏ hàng / bio săn deal ngay).
        """,
        "story": """
        PHONG CÁCH: Kể Chuyện Cuốn Hút (Drama Nhẹ, Tò Mò, Mở Thân Kết Chặt Chẽ)
        - Biến diễn biến video thành một câu chuyện có cốt truyện lôi cuốn.
        - Câu đầu: Mở đầu bằng một tình huống bất ngờ, kích thích tò mò (ví dụ: 'Cứ tưởng hôm nay xui xẻo rồi, ai ngờ lại gặp được cái kết bất ngờ này...').
        - Giữ nhịp điệu hồi hộp, dẫn dắt cảm xúc người xem đến tận giây cuối cùng.
        """,
        "education": """
        PHONG CÁCH: Mẹo Vặt / Chia Sẻ Bí Quyết (Dễ Hiểu, Thiết Thực, Có Giá Trị Ngay)
        - Câu đầu: Hook nêu rõ giải pháp cho vấn đề người xem đang gặp phải (ví dụ: 'Bỏ túi ngay 3 mẹo siêu hay mà 90% mọi người đều chưa biết...').
        - Trình bày ngắn gọn, súc tích, từng bước rõ ràng, dễ nhớ, mang lại giá trị thực tế tức thì.
        - Tone giọng chuyên gia nhưng gần gũi, đáng tin cậy.
        """,
        "humor": """
        PHONG CÁCH: Hài Hước / Dí Dỏm / Meme Gen Z (Bắt Trend, Thư Giãn, Gây Cười)
        - Viết theo giọng reaction vui nhộn, tếu táo, dùng ngôn ngữ trẻ trung và slang dí dỏm.
        - Tạo điểm nhấn hài hước từ chính các tình huống hoặc hình ảnh trong clip.
        - Mang lại tiếng cười sảng khoái và tính giải trí cao.
        """,
        "affiliate": """
        PHONG CÁCH: Bán Hàng Chuyển Đổi Cao (Affiliate TikTok Shop / Shopee)
        - Tập trung thúc đẩy hành vi mua sắm cho sản phẩm xuất hiện trong video gốc.
        - Câu đầu: Hook kích thích nhu cầu + nhấn mạnh giá hời / deal shock.
        - Nhấn mạnh: chất lượng vượt tầm giá, số lượng có hạn, ưu đãi chỉ hôm nay.
        - Câu cuối: CTA dứt khoát ('Link mình để ở góc trái / đầu bio nha, nhanh tay kẻo hết size!').
        """
    }
    
    selected_guide = rewrite_guides.get(rewrite_mode, rewrite_guides["review"])
    lang_instruction = "tiếng Việt" if target_language == "vi" else "English"
    
    prompt = f"""Bạn là biên kịch video TikTok chuyên nghiệp tại Việt Nam.

Nội dung video gốc (đã dịch):
"{full_script_overview}"

Chi tiết từng câu và thời lượng:
{json.dumps(script_data, ensure_ascii=False)}

{selected_guide}

QUY TẮC BẮT BUỘC:
1. Viết lại TOÀN BỘ kịch bản bằng {lang_instruction} dựa trên ĐÚNG nội dung và sản phẩm trong video gốc.
2. Giữ ĐÚNG {len(script_data)} câu (segments), mỗi câu khớp độ dài duration gốc (3-4 từ mỗi giây).
3. Câu đầu tiên PHẢI là HOOK gây tò mò trong 3 giây.
4. Câu cuối PHẢI có CTA phù hợp.
5. Ngôn ngữ Gen Z Việt Nam tự nhiên, không cứng nhắc.
6. Trả về JSON array: [{{"id": 0, "text": "câu mới"}}, ...]
"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"You are a professional TikTok video scriptwriter. Output ONLY a valid JSON array with keys 'id' and 'text'. Write in {lang_instruction}."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        raw_content = response.choices[0].message.content.strip()
        if "```json" in raw_content:
            raw_content = raw_content[raw_content.find("```json")+7:raw_content.rfind("```")].strip()
        elif "```" in raw_content:
            raw_content = raw_content[raw_content.find("```")+3:raw_content.rfind("```")].strip()
        
        rewritten_list = json.loads(raw_content)
        rewrite_map = {item['id']: item['text'] for item in rewritten_list if 'id' in item and 'text' in item}
    except Exception as e:
        print(f"Rewrite script error: {e}")
        rewrite_map = {}
    
    result_segments = []
    last_rw_norm = ""
    rw_repeat_count = 0

    for i, s in enumerate(segments):
        orig_text = s.get('translated_text') or s.get('original_text', '')
        new_text = rewrite_map.get(i, orig_text)
        
        if new_text and new_text.strip():
            rw_norm = re.sub(r'[^\w]', '', new_text.lower())
            if rw_norm and rw_norm == last_rw_norm:
                rw_repeat_count += 1
                if rw_repeat_count >= 3:
                    print(f"[rewrite] Skipped 3rd+ consecutive repeated rewrite: '{new_text}'")
                    new_text = ""
            else:
                if rw_norm:
                    last_rw_norm = rw_norm
                    rw_repeat_count = 1

        result_segments.append({
            "id": i,
            "start": s.get('start', 0),
            "end": s.get('end', 0),
            "original_text": s.get('original_text', ''),
            "translated_text": new_text
        })
        
    return result_segments

def generate_srt_file(translated_segments, srt_path: str):
    """Tạo file phụ đề .srt chuẩn từ danh sách segments đã dịch (bỏ qua các câu rỗng/đã lọc)"""
    with open(srt_path, 'w', encoding='utf-8') as f:
        idx = 1
        for seg in translated_segments:
            text = (seg.get('translated_text') or '').strip()
            if not text:
                continue
            start = _seconds_to_srt_time(seg['start'])
            end = _seconds_to_srt_time(seg['end'])
            f.write(f"{idx}\n{start} --> {end}\n{text}\n\n")
            idx += 1
    return srt_path

def _seconds_to_srt_time(seconds: float) -> str:
    """Chuyển đổi giây (float) sang định dạng SRT: HH:MM:SS,mmm"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def burn_subtitles(video_path: str, srt_path: str, output_path: str, cover_sub: bool = False):
    """Sử dụng ffmpeg-python / subprocess để burn phụ đề vào video sử dụng bộ lọc subtitles"""
    srt_clean = srt_path.replace("\\", "/").replace(":", "\\:")
    
    if cover_sub:
        subtitle_style = "FontName=Arial,FontSize=13,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=3,Outline=4,Shadow=0,MarginV=20"
    else:
        subtitle_style = "FontName=Arial,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.5,Shadow=0.5,MarginV=20"
    cmd = [
        'ffmpeg', '-y', '-i', video_path,
        '-vf', f"subtitles=filename='{srt_clean}':force_style='{subtitle_style}'",
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
        '-c:a', 'copy', output_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, errors='replace', timeout=300, encoding='utf-8')
        if result.returncode != 0:
            print(f"FFmpeg Subtitle Error: {result.stderr[-500:]}")
            raise Exception(f"FFmpeg subtitle burn failed: {result.stderr[-200:]}")
        return output_path
    except subprocess.TimeoutExpired:
        raise Exception("FFmpeg subtitle burn timed out")

def merge_and_burn(video_path: str, dubbed_audio_path: str, srt_path: str, output_video_path: str, cover_sub: bool = False):
    """Gộp audio mới và đè phụ đề vào video trong CÙNG 1 LỆNH FFmpeg để tiết kiệm thời gian (siêu tốc)"""
    srt_clean = srt_path.replace('\\', '/').replace(':', '\\:').replace("'", "'\\''")
    
    if cover_sub:
        subtitle_style = "FontName=Arial,FontSize=13,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=3,Outline=4,Shadow=0,MarginV=20"
    else:
        subtitle_style = "FontName=Arial,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.5,Shadow=0.5,MarginV=20"
    
    probe = ffmpeg.probe(video_path)
    has_audio = any(s['codec_type'] == 'audio' for s in probe.get('streams', []))
    
    if has_audio:
        filter_complex = (
            f"[0:a:0]volume=0.05[bg];"
            f"[1:a:0]volume=1.5[dub];"
            f"[bg][dub]amix=inputs=2:duration=first:dropout_transition=2[aout];"
            f"[0:v:0]subtitles=filename='{srt_clean}':force_style='{subtitle_style}'[vout]"
        )
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-i', dubbed_audio_path,
            '-filter_complex', filter_complex,
            '-map', '[vout]', '-map', '[aout]',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
            '-c:a', 'aac', '-b:a', '128k',
            output_video_path
        ]
    else:
        filter_complex = f"[0:v:0]subtitles=filename='{srt_clean}':force_style='{subtitle_style}'[vout]"
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-i', dubbed_audio_path,
            '-filter_complex', filter_complex,
            '-map', '[vout]', '-map', '1:a:0',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
            '-c:a', 'aac', '-b:a', '128k',
            output_video_path
        ]
        
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, errors='replace', timeout=300, encoding='utf-8')
        if result.returncode != 0:
            print(f"FFmpeg Merge & Burn Error: {result.stderr[-500:]}")
            raise Exception(f"FFmpeg merge & burn failed: {result.stderr[-200:]}")
        return output_video_path
    except subprocess.TimeoutExpired:
        raise Exception("FFmpeg merge & burn timed out")

def _generate_single_segment_tts(seg, voice_code, vbee_token, vbee_app_id):
    """Hàm tải 1 đoạn audio lồng tiếng cho 1 segment với cơ chế Retry & Đảm bảo 1 giọng duy nhất"""
    text = seg['translated_text']
    seg_id = seg['id']
    if not text or not text.strip():
        return seg_id, None
    if len(text) > 300:
        text = text[:297] + "..."

    temp_audio_path = f"temp_{seg_id}_{uuid.uuid4().hex[:8]}.mp3"
    audio_generated = False

    # Method 1: OpenAI TTS (Nếu giọng được chọn là OpenAI)
    if voice_code.startswith("openai_"):
        oa_voice = voice_code.replace("openai_", "")
        for attempt in range(4):
            try:
                response = openai_client.audio.speech.create(
                    model="tts-1",
                    voice=oa_voice,
                    input=text
                )
                with open(temp_audio_path, "wb") as f:
                    f.write(response.content)
                audio_generated = True
                break
            except Exception as e:
                print(f"OpenAI TTS retry {attempt+1}/4 for seg [{seg_id}]: {e}")
                if _is_openai_quota_error(e):
                    record_provider_alert("openai", "critical", OPENAI_QUOTA_ALERT)
                    break
                time.sleep(0.5)

    # Method 2: Vbee TTS (Nếu giọng được chọn là Vbee)
    if not audio_generated and not voice_code.startswith("openai_"):
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {vbee_token}",
            "App-Id": vbee_app_id
        }

        # Giọng 24k không hỗ trợ sync → chuyển thẳng sang async, không lãng phí thời gian retry sync
        is_24k_voice = voice_code not in VBEE_SYNC_VOICES  # Chỉ giọng có has_tts_sync mới gọi sync; còn lại async thẳng

        if not is_24k_voice:
            # Thử Vbee sync cho giọng 48k
            payload_sync = {
                "text": text,
                "voiceCode": voice_code,
                "outputFormat": "mp3",
                "bitrate": 128,
                "speed": 1.0,
                "mode": "sync"
            }
            for attempt in range(3):
                try:
                    response = requests.post("https://api.vbee.vn/v1/tts", json=payload_sync, headers=headers, timeout=15)
                    if response.status_code == 200 and len(response.content) > 500:
                        with open(temp_audio_path, "wb") as f:
                            f.write(response.content)
                        audio_generated = True
                        break
                    elif response.status_code == 429:
                        print(f"Vbee 429 Rate Limit on seg [{seg_id}] - Waiting 2s (attempt {attempt+1}/3)")
                        time.sleep(2.0)
                    elif response.status_code == 400 and "does not support" in response.text:
                        # Voice không hỗ trợ sync → thử async ngay
                        break
                    else:
                        print(f"Vbee TTS status {response.status_code} retry {attempt+1}/3 for seg [{seg_id}]: {response.text}")
                        _vbee_check_error(response.status_code, response.text)
                        time.sleep(1.0)
                except Exception as e:
                    print(f"Vbee sync error retry {attempt+1}/3 for seg [{seg_id}]: {e}")
                    time.sleep(1.0)

        # Fallback async: dùng cho giọng 24k hoặc khi sync thất bại
        if not audio_generated:
            payload_async = {
                "text": text,
                "voiceCode": voice_code,
                "outputFormat": "mp3",
                "mode": "async",
                "webhookUrl": "https://taivideonhanh.com/api/vbee_webhook"
            }
            try:
                for a_attempt in range(3):
                    r_async = requests.post("https://api.vbee.vn/v1/tts", json=payload_async, headers=headers, timeout=10)
                    if r_async.status_code == 429:
                        time.sleep(2.0)
                    else:
                        break
                if r_async.status_code == 201:
                    req_id = r_async.json().get("requestId")
                    if req_id:
                        # Poll tối đa 30 lần × 1s = 30 giây (đủ thời gian Vbee xử lý)
                        for _ in range(30):
                            time.sleep(1.0)
                            r_check = requests.get(f"https://api.vbee.vn/v1/tts/requests/{req_id}", headers=headers, timeout=8)
                            if r_check.status_code == 200:
                                cdata = r_check.json()
                                if cdata.get("status") == "COMPLETED" and cdata.get("audioLink"):
                                    r_audio = requests.get(cdata["audioLink"], timeout=15)
                                    if r_audio.status_code == 200 and len(r_audio.content) > 500:
                                        with open(temp_audio_path, "wb") as f:
                                            f.write(r_audio.content)
                                        audio_generated = True
                                    break
                                elif cdata.get("status") == "FAILED":
                                    print(f"Vbee async FAILED for seg [{seg_id}]")
                                    break
                else:
                    print(f"Vbee async init failed for seg [{seg_id}]: status={r_async.status_code}")
                    _vbee_check_error(r_async.status_code, r_async.text)
            except Exception as e:
                print(f"Vbee async fallback error for seg [{seg_id}]: {e}")

        if audio_generated:
            clear_provider_alert("vbee")

    if not audio_generated:
        print(f"[Vbee] Không tạo được audio cho seg [{seg_id}], bỏ qua câu này.")

    if audio_generated and os.path.exists(temp_audio_path):
        return seg_id, temp_audio_path
    return seg_id, None

def _trim_silence(sound: AudioSegment, silence_thresh: float = -42.0) -> AudioSegment:
    """
    Cắt bỏ khoảng lặng thừa ở đầu và cuối file TTS (Vbee/OpenAI luôn tạo ra 100-300ms lặng).
    Giúp giọng đọc bắt đầu tức thì, tự nhiên và tiết kiệm đáng kể thời lượng phát âm.
    """
    try:
        from pydub.silence import detect_leading_silence
        duration = len(sound)
        if duration < 200:
            return sound
        start_trim = max(0, detect_leading_silence(sound, silence_threshold=silence_thresh) - 25)
        end_trim = max(0, detect_leading_silence(sound.reverse(), silence_threshold=silence_thresh) - 35)
        if start_trim + end_trim < duration - 100:
            return sound[start_trim:duration - end_trim]
    except Exception as e:
        print(f"[_trim_silence] Note: {e}")
    return sound

def _speedup_audio(segment_audio: AudioSegment, speed_factor: float) -> AudioSegment:
    """Tăng tốc âm thanh bằng FFmpeg atempo (giữ độ cao pitch tự nhiên, tuyệt đối không bị méo tiếng như pydub)"""
    if speed_factor <= 1.02:
        return segment_audio
    speed_factor = min(speed_factor, 1.28)  # Giới hạn max 1.28x để bảo toàn giọng tự nhiên nhất
    
    unique_id = uuid.uuid4().hex[:8]
    temp_in = f"temp_sp_in_{unique_id}.wav"
    temp_out = f"temp_sp_out_{unique_id}.wav"
    try:
        segment_audio.export(temp_in, format="wav")
        cmd = [
            'ffmpeg', '-y', '-i', temp_in,
            '-filter:a', f"atempo={speed_factor:.3f}",
            '-vn', temp_out
        ]
        res = subprocess.run(cmd, capture_output=True, timeout=5)
        if res.returncode == 0 and os.path.exists(temp_out) and os.path.getsize(temp_out) > 0:
            sped_audio = AudioSegment.from_file(temp_out)
            return sped_audio
    except Exception as e:
        print(f"[speedup] atempo filter note: {e}")
    finally:
        if os.path.exists(temp_in):
            try: os.remove(temp_in)
            except: pass
        if os.path.exists(temp_out):
            try: os.remove(temp_out)
            except: pass
            
    # Fallback sang pydub nếu ffmpeg fail
    try:
        return segment_audio.speedup(playback_speed=speed_factor)
    except Exception:
        return segment_audio

def generate_dubbing_audio(translated_segments, total_duration_ms, output_path: str, voice_code: str = None):
    """
    Tạo audio lồng tiếng tiếng Việt tự nhiên, liền mạch, TUYỆT ĐỐI KHÔNG BỊ CẮT CỤT CÂU THOẠI.
    - Cắt tỉa khoảng lặng thừa (silence trim) ở đầu/cuối từng file TTS.
    - Điều chỉnh tốc độ mượt mà bằng FFmpeg atempo (1.05x - 1.28x) nếu câu thoại dài hơn thời lượng gốc.
    - Sử dụng cơ chế Elastic Ripple Timing: Nếu câu thoại vẫn còn nói, câu sau tự động bắt đầu ngay sau khi câu trước dứt tiếng.
    - Đồng bộ mốc thời gian thực tế vào translated_segments để phụ đề (.srt) khớp chuẩn từng giây.
    """
    if not voice_code or voice_code not in ALL_VOICES:
        voice_code = DEFAULT_VOICE
    
    final_audio = AudioSegment.silent(duration=total_duration_ms)
    vbee_app_id = os.getenv("VBEE_APP_ID")
    vbee_token = os.getenv("VBEE_API_KEY")
    
    # Vbee giới hạn rate limit: dùng max 2 luồng để không dính HTTP 429. OpenAI hỗ trợ 10 luồng.
    max_workers = 10 if voice_code.startswith("openai_") else 1
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = []
        for seg in translated_segments:
            futures.append(executor.submit(_generate_single_segment_tts, seg, voice_code, vbee_token, vbee_app_id))
            if not voice_code.startswith("openai_"):
                time.sleep(0.80)  # Giãn cách 800ms để chống Vbee Rate Limit
                
        results = [f.result() for f in futures]
        
    temp_files_map = {seg_id: temp_path for seg_id, temp_path in results if temp_path}

    cur_pos_ms = 0

    for i, seg in enumerate(translated_segments):
        seg_id = seg['id']
        orig_start_ms = int(seg['start'] * 1000)
        orig_duration_ms = int((seg['end'] - seg['start']) * 1000)
        temp_audio_path = temp_files_map.get(seg_id)
        
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                segment_audio = AudioSegment.from_file(temp_audio_path)
                
                # 1. Cắt khoảng lặng thừa ở đầu và cuối file TTS do API tạo ra
                segment_audio = _trim_silence(segment_audio)
                audio_len = len(segment_audio)
                if audio_len == 0:
                    continue

                # 2. Tính khoảng thời gian có sẵn trước khi câu tiếp theo xuất hiện
                if i + 1 < len(translated_segments):
                    next_orig_start = int(translated_segments[i+1]['start'] * 1000)
                    available_gap_ms = max(orig_duration_ms, next_orig_start - orig_start_ms)
                else:
                    available_gap_ms = max(orig_duration_ms, total_duration_ms - orig_start_ms)

                # 3. Tăng tốc nhẹ nhàng nếu audio dài hơn khoảng thời gian cho phép
                # Ngưỡng an toàn: từ 1.05x đến tối đa 1.28x bằng FFmpeg atempo
                if audio_len > available_gap_ms and available_gap_ms > 400:
                    raw_ratio = audio_len / available_gap_ms
                    speed_factor = min(max(raw_ratio, 1.0), 1.28)
                    if speed_factor > 1.03:
                        segment_audio = _speedup_audio(segment_audio, speed_factor)
                        audio_len = len(segment_audio)

                # 4. Xác định vị trí phát (start_ms):
                # Không bao giờ phát sớm hơn orig_start_ms.
                # Nhưng nếu câu trước chưa dứt, câu này sẽ bắt đầu ngay sau câu trước (cộng thêm 60ms thở tự nhiên).
                actual_start_ms = max(orig_start_ms, cur_pos_ms)
                
                # 5. Đảm bảo final_audio có đủ độ dài nếu câu thoại phát tràn qua
                if actual_start_ms + audio_len > len(final_audio):
                    extra_ms = (actual_start_ms + audio_len) - len(final_audio) + 500
                    final_audio = final_audio + AudioSegment.silent(duration=extra_ms)

                # 6. TUYỆT ĐỐI KHÔNG CẮT BỎ CÂU NÓI (Zero-Truncation Policy):
                # Toàn bộ câu thoại được phát trọn vẹn 100% để đủ ý và không bao giờ bị gãy cụt
                final_audio = final_audio.overlay(segment_audio, position=actual_start_ms)
                
                # Cập nhật con trỏ timeline cho câu tiếp theo
                cur_pos_ms = actual_start_ms + audio_len + 60
                
                # Đồng bộ lại mốc thời gian vào seg để phụ đề (.srt) hiển thị chuẩn khớp với giọng nói
                seg['start'] = round(actual_start_ms / 1000.0, 3)
                seg['end'] = round((actual_start_ms + audio_len) / 1000.0, 3)
            except Exception as e:
                print(f"Overlay audio error on seg {seg_id}: {e}")
            finally:
                if os.path.exists(temp_audio_path):
                    try:
                        os.remove(temp_audio_path)
                    except:
                        pass
        
    final_audio.export(output_path, format="mp3")
    return output_path

def merge_video(video_path, dubbed_audio_path, output_video_path):
    """Ghép audio lồng tiếng đè lên video gốc (Giảm nhạc gốc 15%, Tăng AI 120%)"""
    probe = ffmpeg.probe(video_path)
    has_audio = any(s['codec_type'] == 'audio' for s in probe.get('streams', []))
    
    if has_audio:
        filter_complex = (
            f"[0:a:0]volume=0.05[bg];"
            f"[1:a:0]volume=1.5[dub];"
            f"[bg][dub]amix=inputs=2:duration=first:dropout_transition=2[aout]"
        )
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-i', dubbed_audio_path,
            '-filter_complex', filter_complex,
            '-map', '0:v:0', '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '128k',
            output_video_path
        ]
    else:
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-i', dubbed_audio_path,
            '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '128k',
            output_video_path
        ]
        
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, errors='replace', timeout=300, encoding='utf-8')
        if result.returncode != 0:
            print(f"FFmpeg Merge Error: {result.stderr[-500:]}")
            raise Exception(f"FFmpeg merge failed: {result.stderr[-200:]}")
        return output_video_path
    except subprocess.TimeoutExpired:
        raise Exception("FFmpeg merge timed out")

# --- HÀM CHÍNH ĐỂ THỰC THI TOÀN BỘ QUY TRÌNH ---
def process_full_pipeline(video_url: str, output_dir: str, mode: str = "dub_only", voice_code: str = None, translation_style: str = "tiktok", custom_segments: list = None, status_callback=None, use_ocr: bool = False, **kwargs):
    """
    Hàm tổng hợp chạy theo chế độ:
    - dub_only: Tải -> Tách audio -> STT -> Dịch -> TTS -> Ghép audio mới
    - sub_only: Tải -> Tách audio -> STT -> Dịch -> Tạo SRT -> Burn subtitle lên video
    - dub_and_sub: Tải -> Tách audio -> STT -> Dịch -> TTS -> Ghép audio + Burn subtitle (1 bước siêu tốc)
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    def update_status(msg):
        if status_callback:
            status_callback(msg)
        print(msg)

    base_name = f"video_{int(time.time())}"
    video_path = os.path.join(output_dir, f"{base_name}_goc.mp4")
    audio_path = os.path.join(output_dir, f"{base_name}_audio.mp3")
    dubbed_path = os.path.join(output_dir, f"{base_name}_dubbed.mp3")
    srt_path = os.path.join(output_dir, f"{base_name}_sub.srt")
    final_video_path = os.path.join(output_dir, f"{base_name}_final.mp4")
    
    # === BƯỚC 1: Tải video gốc ===
    update_status("Đang tải video gốc...")
    try:
        download_file(video_url, video_path)
    except Exception as e:
        original_url = kwargs.get("original_url")
        if original_url and ("403" in str(e) or "404" in str(e) or "Not Found" in str(e) or "aweme.snssdk" in video_url):
            update_status("Link video gốc bị hết hạn, đang tự động quét lại...")
            from scraper import get_xiaohongshu_video
            fresh_data = get_xiaohongshu_video(original_url)
            if fresh_data and fresh_data.get("video_url"):
                download_file(fresh_data["video_url"], video_path)
            else:
                raise e
        else:
            raise e
    
    # === BƯỚC 1.5: Kiểm tra thời lượng (chặn video dài trước khi gọi API tốn phí) ===
    real_duration = get_video_duration(video_path)
    if is_video_too_long(real_duration):
        raise Exception(f"Video quá dài ({format_duration(real_duration)}), vui lòng chọn video dưới 3 phút.")
    
    # === BƯỚC 2: Tách audio ===
    update_status("Đang tách âm thanh từ video...")
    extract_audio(video_path, audio_path)
    
    if custom_segments and len(custom_segments) > 0:
        update_status("Sử dụng kịch bản đã được tùy chỉnh bởi bạn...")
        translated = custom_segments
    else:
        # === BƯỚC 3: STT (Speech-to-Text) ===
        if use_ocr:
            # Chế độ OCR: đọc chữ trực tiếp trên màn hình video
            update_status("AI đang đọc chữ trên màn hình video (OCR)...")
            segments = transcribe_video_ocr(video_path, output_dir)
            if not segments:
                update_status("OCR không tìm thấy chữ, thử nhận diện giọng nói...")
                segments = transcribe_audio(audio_path)
        else:
            update_status("AI đang nhận diện giọng nói...")
            segments = transcribe_audio(audio_path)
            # Fallback tự động sang OCR nếu Whisper không nhận diện được phân đoạn nào
            if not segments:
                update_status("Không nhận diện được giọng nói, thử đọc chữ trên màn hình video (OCR Fallback)...")
                segments = transcribe_video_ocr(video_path, output_dir)
        
        if not segments:
            raise Exception("Không nhận diện được lời thoại hoặc chữ trong video. Hãy kiểm tra video có tiếng nói / phụ đề không.")
        
        print(f"[pipeline] Tổng segments sau STT/OCR: {len(segments)}")
        
        # === BƯỚC 4: Dịch ===
        update_status("AI đang dịch kịch bản theo phong cách được chọn...")
        translated = translate_segments(segments, translation_style=translation_style, target_language=kwargs.get('target_language', 'vi'))
    
    # === BƯỚC 4.5: Viết lại kịch bản (nếu bật) ===
    rewrite_mode = kwargs.get('rewrite_mode')
    if rewrite_mode:
        update_status(f"AI đang viết lại kịch bản theo phong cách {rewrite_mode}...")
        target_language = kwargs.get('target_language', 'vi')
        translated = rewrite_script(translated, rewrite_mode=rewrite_mode, target_language=target_language)
    
    if not translated or not any((s.get('translated_text') or '').strip() for s in translated):
        raise Exception("Không nhận diện được lời thoại hợp lệ trong video (chỉ có nhạc nền hoặc không có tiếng nói).")

    # Lấy tổng thời lượng video
    video_info = ffmpeg.probe(video_path)
    total_duration = float(video_info['format']['duration']) * 1000

    
    # === XỬ LÝ THEO CHẾ ĐỘ ===
    
    if mode == "dub_only":
        # Chỉ lồng tiếng: TTS -> Ghép audio mới
        update_status("Đang tạo giọng đọc nhân tạo...")
        generate_dubbing_audio(translated, int(total_duration), dubbed_path, voice_code)
        
        update_status("Đang ghép âm thanh vào video...")
        merge_video(video_path, dubbed_path, final_video_path)
        
    elif mode == "sub_only":
        # Chỉ phụ đề: Tạo SRT -> Burn subtitle
        update_status("Đang tạo phụ đề tiếng Việt...")
        generate_srt_file(translated, srt_path)
        
        update_status("Đang burn phụ đề siêu tốc...")
        burn_subtitles(video_path, srt_path, final_video_path, cover_sub=kwargs.get('cover_sub', False))
        
    elif mode == "dub_and_sub":
        # Lồng tiếng + Phụ đề: TTS -> Ghép audio + Burn subtitle (1 bước siêu tốc)
        update_status("Đang tạo giọng đọc nhân tạo...")
        generate_dubbing_audio(translated, int(total_duration), dubbed_path, voice_code)
        
        update_status("Đang tạo phụ đề tiếng Việt...")
        generate_srt_file(translated, srt_path)
        
        update_status("Đang xử lý lồng tiếng & burn phụ đề siêu tốc...")
        merge_and_burn(video_path, dubbed_path, srt_path, final_video_path, cover_sub=kwargs.get('cover_sub', False))
    else:
        raise ValueError(f"Chế độ không hợp lệ: {mode}")
    
    update_status("Hoàn tất!")
    
    # Dọn dẹp file tạm
    for f in [video_path, audio_path, dubbed_path, srt_path]:
        if os.path.exists(f):
            try:
                os.remove(f)
            except:
                pass
    
    return final_video_path
    
    print(f"Done! Saved to: {final_video_path}")
    return final_video_path


# ===== REACTION VIDEO (Picture-in-Picture) =====

def generate_reaction_video(main_video_path: str, reaction_video_path: str, output_path: str, 
                             pip_position: str = "top-right", pip_size: str = "medium",
                             pip_shape: str = "rectangle", main_volume: float = 0.3,
                             dubbed_audio_path: str = None, srt_path: str = None,
                             cover_sub: bool = False):
    """
    Ghép video reaction (PiP) lên video gốc.
    pip_position: top-right, top-left, bottom-right, bottom-left
    pip_size: small (25%), medium (33%), large (40%)
    pip_shape: rectangle, rounded, circle
    """
    size_map = {"small": 0.25, "medium": 0.33, "large": 0.40}
    scale_ratio = size_map.get(pip_size, 0.33)
    
    # Lấy kích thước video gốc
    probe = ffmpeg.probe(main_video_path)
    video_stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    main_w = int(video_stream['width'])
    main_h = int(video_stream['height'])
    
    pip_w = int(main_w * scale_ratio)
    margin = 20
    
    # Tính vị trí overlay
    pos_map = {
        "top-right": f"W-w-{margin}:{margin}",
        "top-left": f"{margin}:{margin}",
        "bottom-right": f"W-w-{margin}:H-h-{margin}",
        "bottom-left": f"{margin}:H-h-{margin}"
    }
    overlay_pos = pos_map.get(pip_position, pos_map["top-right"])
    
    # Build filter cho PiP
    pip_filter = f"[1:v]scale={pip_w}:-1"
    if pip_shape == "circle":
        pip_filter += f",format=rgba,geq=lum='lum(X,Y)':a='if(gt(pow(X-W/2,2)+pow(Y-H/2,2),pow(min(W,H)/2,2)),0,255)'"
    elif pip_shape == "rounded":
        pip_filter += f",format=rgba,geq=lum='lum(X,Y)':a='if(gt(pow(max(0,abs(X-W/2)-W/2+20),2)+pow(max(0,abs(Y-H/2)-H/2+20),2),pow(20,2)),0,255)'"
    pip_filter += "[pip]"
    
    # Build audio filter
    inputs = [ffmpeg.input(main_video_path), ffmpeg.input(reaction_video_path)]
    audio_filter = f"[0:a]volume={main_volume}[bg];[1:a]volume=1.0[react];[bg][react]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    
    # Nếu có dubbed audio, thêm vào mix
    input_args = ["-y", "-i", main_video_path, "-i", reaction_video_path]
    if dubbed_audio_path and os.path.exists(dubbed_audio_path):
        input_args += ["-i", dubbed_audio_path]
        audio_filter = f"[0:a]volume=0.05[bg];[1:a]volume=0.8[react];[2:a]volume=1.5[dub];[bg][react][dub]amix=inputs=3:duration=first:dropout_transition=2[aout]"
    
    # Build video filter
    video_filter = f"{pip_filter};[0:v][pip]overlay={overlay_pos}[vout]"
    
    # Nếu có SRT, burn phụ đề
    if srt_path and os.path.exists(srt_path):
        safe_srt = srt_path.replace("\\", "/").replace(":", "\\:")
        sub_style = "FontName=Arial,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.5,Shadow=0.5,MarginV=20"
        if cover_sub:
            sub_style = "FontName=Arial,FontSize=13,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=3,Outline=4,Shadow=0,MarginV=20"
        video_filter = f"{pip_filter};[0:v][pip]overlay={overlay_pos},subtitles=filename='{safe_srt}':force_style='{sub_style}'[vout]"
    
    full_filter = f"{video_filter};{audio_filter}"
    
    cmd = input_args + [
        "-filter_complex", full_filter,
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        output_path
    ]
    
    import subprocess
    
    # Dùng ffmpeg binary cục bộ nếu có
    ffmpeg_bin = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ffmpeg", "bin", "ffmpeg")
    if not os.path.exists(ffmpeg_bin):
        ffmpeg_bin = "ffmpeg"
    
    cmd_list = [ffmpeg_bin, "-y"] + input_args[2:] + [
        "-filter_complex", full_filter,
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        output_path
    ]
    
    result = subprocess.run(cmd_list, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg reaction error: {result.stderr[-500:]}")
    
    return output_path
