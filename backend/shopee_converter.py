import re
import requests
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse, quote
from openai import OpenAI
import os
import time

from dotenv import load_dotenv
load_dotenv()

openai_client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
)

import sqlite3
import random
import string

def generate_slug(length=6):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def save_shortlink(target_url: str, user_id: str) -> str:
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shortlinks.db')
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS shortlinks
                 (slug TEXT PRIMARY KEY, target_url TEXT, clicks INTEGER DEFAULT 0, user_id TEXT)''')
    
    slug = generate_slug()
    # Ensure unique slug
    while True:
        c.execute("SELECT 1 FROM shortlinks WHERE slug = ?", (slug,))
        if not c.fetchone():
            break
        slug = generate_slug()
        
    c.execute("INSERT INTO shortlinks (slug, target_url, user_id) VALUES (?, ?, ?)", (slug, target_url, user_id))
    conn.commit()
    conn.close()
    return f"https://taivideonhanh.com/sp/{slug}"

def resolve_and_convert_shopee_link(url: str, affiliate_id: str, user_id: str = "") -> str:
    """Resolve redirect and apply affiliate ID"""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        r = requests.get(url, headers=headers, allow_redirects=True, timeout=10)
        final_url = r.url
        
        parsed = urlparse(final_url)
        query = parse_qs(parsed.query)
        
        # Strip old tracking params
        for k in list(query.keys()):
            if k.startswith('utm_') or k == 'uls_trackid' or k == 'smtt':
                del query[k]
                
        clean_query = urlencode(query, doseq=True)
        clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, clean_query, parsed.fragment))
        
        # Build Shopee tracking link correctly
        encoded_origin = quote(clean_url, safe='')
        aff_id = affiliate_id
        if aff_id.startswith("an_"):
            aff_id = aff_id[3:]
            
        new_url = f"https://s.shopee.vn/an_redir?origin_link={encoded_origin}&affiliate_id={aff_id}"
        
        # Create internal shortlink
        return save_shortlink(new_url, user_id)
    except Exception as e:
        print(f"Error resolving {url}: {e}")
        return url

def convert_shopee_text(text: str, affiliate_id: str, rewrite: bool = False, user_id: str = "") -> str:
    """Tìm tất cả link trong text, chuyển đổi và có thể dùng AI viết lại"""
    url_pattern = r'https?://(?:s\.shopee\.vn|shp\.ee|vn\.shp\.ee|shopee\.vn)[^\s]*'
    urls_found = set(re.findall(url_pattern, text))
    
    if not urls_found:
        return text if not rewrite else _rewrite_with_ai(text)
        
    converted_text = text
    for url in urls_found:
        new_url = resolve_and_convert_shopee_link(url, affiliate_id, user_id)
        converted_text = converted_text.replace(url, new_url)
        time.sleep(0.5)
        
    if rewrite:
        converted_text = _rewrite_with_ai(converted_text)
        
    return converted_text

def _rewrite_with_ai(text: str) -> str:
    try:
        prompt = f"""Bạn là một chuyên gia content affiliate marketing chuyên nghiệp.
Nhiệm vụ của bạn là viết lại bài đăng dưới đây sao cho tự nhiên, hấp dẫn hơn, thu hút người đọc click vào link mua hàng.
Bạn có thể sắp xếp lại câu chữ, thêm emoji, thay đổi văn phong (tươi trẻ, review chân thực).

QUY TẮC TUYỆT ĐỐI QUAN TRỌNG:
1. Bạn KHÔNG ĐƯỢC PHÉP thay đổi bất kỳ đường link (URL) nào trong bài viết. Giữ nguyên 100% các link `https://tinyurl.com/...` hoặc `https://shopee...`
2. Giữ nguyên đúng thứ tự các sản phẩm nếu đây là một danh sách.
3. Không thêm các câu như "Đây là bài viết viết lại". Chỉ trả về nội dung bài viết.

Bài viết gốc:
{text}"""

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"AI rewrite error: {e}")
        return text
