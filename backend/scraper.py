import re
import json
import subprocess
import requests
from typing import Optional, Dict, Any

TOR_PROXY = "socks5://127.0.0.1:9050"

# Danh sách Proxy dân cư (711proxy) do người dùng cấu hình
RESIDENTIAL_PROXIES = [
    "http://phannho01-zone-custom-region-US-session-39663902-sessTime-5:phannho01@global.rotgb.711proxy.com:10000",
    "http://phannho01-zone-custom-region-US-session-15678873-sessTime-5:phannho01@global.rotgb.711proxy.com:10000",
    "http://phannho01-zone-custom-region-US-session-52109020-sessTime-5:phannho01@global.rotgb.711proxy.com:10000",
    "http://phannho01-zone-custom-region-US-session-37067535-sessTime-5:phannho01@global.rotgb.711proxy.com:10000",
    "http://phannho01-zone-custom-region-US-session-70955252-sessTime-5:phannho01@global.rotgb.711proxy.com:10000",
]

def extract_url(text: str) -> str:
    """
    Tự động trích xuất URL từ text chia sẻ.
    Xử lý: text tiếng Trung/Việt kèm link, short links, copy paste từ app.
    """
    urls = re.findall(r'https?://[^\s\]）》>\u0000-\u001f]+', text)
    if urls:
        return urls[0].rstrip('.,;!?。！？，')
    for pattern in [r'xhslink\.com/[^\s]+', r'v\.douyin\.com/[^\s]+', r'vt\.tiktok\.com/[^\s]+']:
        m = re.findall(pattern, text)
        if m:
            return 'https://' + m[0].rstrip('.,;!?')
    return text.strip()

def detect_platform(url: str) -> str:
    url_lower = url.lower()
    if 'xiaohongshu.com' in url_lower or 'xhslink.com' in url_lower or 'rednote.com' in url_lower:
        return 'xiaohongshu'
    elif 'douyin.com' in url_lower:
        return 'douyin'
    elif 'tiktok.com' in url_lower:
        return 'tiktok'
    elif 'facebook.com' in url_lower or 'fb.watch' in url_lower or 'fb.com' in url_lower:
        return 'facebook'
    elif 'instagram.com' in url_lower:
        return 'instagram'
    elif 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        return 'youtube'
    elif 'bilibili.com' in url_lower or 'b23.tv' in url_lower:
        return 'bilibili'
    elif 'kuaishou.com' in url_lower:
        return 'kuaishou'
    elif 'weibo.com' in url_lower:
        return 'weibo'
    return 'unknown'

def _normalize_youtube_url(url: str) -> str:
    """Chuyển YouTube Shorts URL thành dạng /watch?v= chuẩn"""
    import re
    m = re.search(r'youtube\.com/shorts/([\w-]+)', url)
    if m:
        video_id = m.group(1)
        return f'https://www.youtube.com/watch?v={video_id}'
    return url

def get_video_info_ytdlp(url: str, proxy: str = None) -> Optional[Dict[str, Any]]:
    """Dùng yt-dlp, có thể qua proxy (Tor)"""
    try:
        # Chuyển YouTube Shorts -> URL chuẩn để tránh lỗi đăng nhập
        if detect_platform(url) == 'youtube':
            url = _normalize_youtube_url(url)
        cmd = ['yt-dlp', '--dump-json', '--no-download', '--no-warnings']
        if detect_platform(url) == 'youtube':
            cmd.extend(['--extractor-args', 'youtube:player_client=android'])
        if proxy:
            cmd.extend(['--proxy', proxy])
        cmd.append(url)
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=45, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            err = result.stderr.strip()
            print(f"yt-dlp error: {err}")
            if 'blocked' in err.lower():
                return {"_error": "ip_blocked", "_platform": detect_platform(url)}
            elif 'cookies' in err.lower() or 'available to everyone' in err.lower():
                return {"_error": "needs_cookies", "_platform": detect_platform(url)}
            elif 'No video formats' in err:
                return {"_error": "no_formats", "_platform": detect_platform(url)}
            return None
            
        data = json.loads(result.stdout)
        platform = detect_platform(url)
        
        return {
            "title": data.get('title', 'Video không tiêu đề'),
            "video_url": data.get('url') or data.get('webpage_url') or url,
            "cover_url": data.get('thumbnail', ''),
            "platform": platform,
            "duration": data.get('duration', 0),
            "use_ytdlp": True
        }
    except subprocess.TimeoutExpired:
        return {"_error": "timeout"}
    except Exception as e:
        print(f"yt-dlp error: {e}")
        return None

def _scrape_xhs_with_playwright(url: str, use_proxy: bool = False) -> Optional[Dict[str, Any]]:
    """Dùng Playwright để scrape XHS (Direct trước, Tor proxy fallback)"""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed")
        return None
    
    try:
        with sync_playwright() as p:
            launch_opts = {
                'headless': True,
                'args': ['--no-sandbox', '--disable-dev-shm-usage']
            }
            if use_proxy:
                launch_opts['proxy'] = {"server": TOR_PROXY}
                
            browser = p.chromium.launch(**launch_opts)
            context = browser.new_context(
                # FIX: Mobile UA để tránh bị redirect về /login
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
                viewport={"width": 390, "height": 844},
                locale="zh-CN",
            )
            page = context.new_page()

            # FIX: /explore/ -> /discovery/item/ cho mobile UA
            if '/explore/' in url:
                url = url.replace('/explore/', '/discovery/item/')

            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            
            # Check redirect
            current_url = page.url
            if '/404' in current_url:
                print(f"XHS Playwright (proxy={use_proxy}): Redirected to 404")
                browser.close()
                return {"_error": "post_deleted"}
            if 'login' in current_url or 'signin' in current_url:
                print(f"XHS Playwright (proxy={use_proxy}): Redirected to login")
                browser.close()
                return {"_error": "needs_cookies"}
            
            page.wait_for_timeout(3000)
            
            # FIX: Hỗ trợ cả path mới (noteData.data.noteData) và path cũ (note.noteDetailMap)
            state_data = page.evaluate('''() => {
                try {
                    if (!window.__INITIAL_STATE__) return null;
                    const state = window.__INITIAL_STATE__;

                    function extractFromNd(nd) {
                        if (!nd) return null;
                        let vUrl = "";
                        if (nd.type === "video" && nd.video) {
                            const stream = nd.video?.media?.stream || {};
                            for (const [k, tracks] of Object.entries(stream)) {
                                if (tracks?.[0]?.masterUrl) { vUrl = tracks[0].masterUrl; break; }
                            }
                            if (!vUrl) {
                                const ok = nd.video?.consumer?.originVideoKey;
                                if (ok) vUrl = "https://sns-video-bd.xhscdn.com/" + ok;
                            }
                        }
                        return {
                            type: nd.type,
                            title: nd.title || nd.desc || "",
                            videoUrl: vUrl,
                            cover: (nd.imageList?.[0]?.urlDefault || nd.imageList?.[0]?.url ||
                                    nd.video?.image?.thumbnail || nd.cover?.url || ""),
                            images: (nd.imageList || []).map(img => img.urlDefault || img.url || "").filter(Boolean)
                        };
                    }

                    // PATH MỚI: noteData.data.noteData (mobile/discovery endpoint)
                    const nd_mobile = state?.noteData?.data?.noteData;
                    if (nd_mobile) return extractFromNd(nd_mobile);

                    // PATH CŨ: note.noteDetailMap (PC/explore endpoint)
                    const note = state.note || {};
                    let fni = note.firstNoteId || note.currentNoteId || "";
                    if (typeof fni === 'object' && fni !== null) {
                        fni = fni._value || fni.value || fni._rawValue || "";
                    }
                    const ndm = note.noteDetailMap || {};
                    const noteId = fni || Object.keys(ndm)[0];
                    if (!noteId || !ndm[noteId]) return null;
                    return extractFromNd(ndm[noteId].note || {});
                } catch(e) { return null; }
            }''')
            
            result = None
            
            if state_data:
                if state_data.get('type') == 'video' and state_data.get('videoUrl'):
                    result = {
                        "type": "video",
                        "title": state_data['title'] or 'XHS Video',
                        "video_url": state_data['videoUrl'],
                        "cover_url": state_data.get('cover', ''),
                        "platform": "xiaohongshu",
                    }
                elif state_data.get('type') == 'normal':
                    imgs = state_data.get('images', [])
                    if imgs:
                        result = {
                            "type": "image",
                            "title": state_data.get('title') or "XHS Album",
                            "cover_url": imgs[0],
                            "images": imgs,
                            "platform": "xiaohongshu"
                        }
                    else:
                        result = {"_error": "image_post", "title": state_data.get('title', '')}
            
            if not result:
                # Fallback: find video element in DOM
                video_src = page.evaluate('''() => {
                    const v = document.querySelector("video source") || document.querySelector("video");
                    return v ? (v.src || "") : "";
                }''')
                if video_src:
                    result = {"title": page.title() or "XHS Video", "video_url": video_src,
                              "cover_url": "", "platform": "xiaohongshu"}
            
            browser.close()
            return result
            
    except Exception as e:
        print(f"XHS Playwright error: {e}")
        return None

def _get_douyin_ttwid() -> str:
    """Fetch a fresh ttwid cookie from Douyin's token endpoint"""
    try:
        ttwid_url = 'https://ttwid.bytedance.com/ttwid/union/register/'
        ttwid_payload = {
            "region": "cn",
            "aid": 1128,
            "needFid": False,
            "service": "www.douyin.com",
            "migrate_info": {"ticket": "", "source": "node"},
            "cbUrlProtocol": "https",
            "union": True
        }
        r = requests.post(ttwid_url, json=ttwid_payload, timeout=5)
        for cookie in r.cookies:
            if cookie.name == 'ttwid':
                return cookie.value
    except Exception as e:
        print(f"[Douyin] ttwid fetch error: {e}")
    return ""

def parse_douyin_fast(url: str) -> Optional[Dict[str, Any]]:
    """Dùng Fast HTTP Mobile Share Page Parser (~0.3s) bóc tách link video Douyin HD không logo không cần cookie hay captcha"""
    mobile_headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9"
    }
    try:
        # Step 1: Get ttwid cookie (required since mid-2026)
        ttwid = _get_douyin_ttwid()
        if ttwid:
            mobile_headers["Cookie"] = f"ttwid={ttwid}"
            print(f"[Douyin] Got ttwid cookie")

        r_init = requests.get(url, headers=mobile_headers, allow_redirects=True, timeout=10)
        final_url = r_init.url
        m_id = re.search(r'/video/(\d+)', final_url) or re.search(r'modal_id=(\d+)', final_url)
        video_id = m_id.group(1) if m_id else ""
        if not video_id:
            return None
            
        share_url = f"https://www.iesdouyin.com/share/video/{video_id}/"
        r_share = requests.get(share_url, headers=mobile_headers, timeout=10)
        html = r_share.text
        
        # Try _ROUTER_DATA first (new format since mid-2026), then RENDER_DATA (legacy)
        m_render = re.search(r'window\._ROUTER_DATA\s*=\s*(\{.*?\});\s*</script>', html, re.DOTALL) or \
                   re.search(r'window\._ROUTER_DATA\s*=\s*(\{.*?\})</script>', html, re.DOTALL) or \
                   re.search(r'id="RENDER_DATA"\s*type="application/json">(.*?)</script>', html) or \
                   re.search(r'window\._ROUTER_DATA\s*=\s*({.*?});</script>', html, re.DOTALL)
                   
        if not m_render:
            print(f"[Douyin] No ROUTER_DATA or RENDER_DATA found (HTML size={len(html)})")
            return None
            
        raw_json = m_render.group(1).replace('undefined', 'null')
        data = json.loads(raw_json)
        
        play_url = ""
        cover_url = ""
        title = "Douyin Video"
        duration = 0
        def find_info(obj, depth=0):
            nonlocal play_url, cover_url, title, duration
            if depth > 12 or not obj: return
            if isinstance(obj, dict):
                if not title or title == "Douyin Video":
                    desc = obj.get("desc") or obj.get("title")
                    if desc and isinstance(desc, str) and len(desc) > 2:
                        title = desc
                if "play_addr" in obj and isinstance(obj["play_addr"], dict):
                    urls = obj["play_addr"].get("url_list", [])
                    if urls and not play_url:
                        play_url = urls[0]
                        cover = obj.get("cover", {})
                        if isinstance(cover, dict):
                            cover_url = cover.get("url_list", [""])[0]
                if not duration:
                    dur = obj.get("duration")
                    if dur and isinstance(dur, (int, float)) and dur > 0:
                        duration = int(dur / 1000) if dur > 10000 else int(dur)
                for v in obj.values():
                    find_info(v, depth+1)
            elif isinstance(obj, list):
                for item in obj:
                    find_info(item, depth+1)

        find_info(data)
        
        if play_url:
            nologo_url = play_url.replace("playwm", "play")
            final_cdn_url = nologo_url
            try:
                r_redir = requests.get(nologo_url, headers=mobile_headers, allow_redirects=False, timeout=3)
                if r_redir.status_code in (301, 302, 303, 307, 308) and r_redir.headers.get("Location"):
                    final_cdn_url = r_redir.headers["Location"]
            except Exception as e_red:
                print(f"[Douyin] CDN Redirect note: {e_red}")
                
            return {
                "title": title[:100],
                "video_url": final_cdn_url,
                "cover_url": cover_url,
                "duration": duration,
                "platform": "douyin"
            }
        else:
            print(f"[Douyin] No play_url found in data (has play_addr in html: {'play_addr' in html})")
    except Exception as e:
        print(f"Fast Douyin parser error: {e}")
    return None

def _scrape_douyin_with_playwright(url: str) -> Optional[Dict[str, Any]]:
    """Dùng Playwright để scrape Douyin - intercept API responses"""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 720},
                locale="zh-CN",
            )
            page = context.new_page()
            
            # Intercept API responses for video detail
            video_data = {}
            def capture_api(response):
                try:
                    if 'aweme/detail' in response.url or 'aweme/v1/web/aweme' in response.url:
                        body = response.json()
                        aweme = body.get('aweme_detail') or {}
                        if not aweme and body.get('aweme_list'):
                            aweme = body['aweme_list'][0] if body['aweme_list'] else {}
                        if aweme and aweme.get('video'):
                            vid = aweme['video']
                            play_urls = vid.get('play_addr', {}).get('url_list', [])
                            if play_urls:
                                video_data['title'] = aweme.get('desc', 'Douyin Video')
                                video_data['video_url'] = play_urls[0]
                                video_data['cover'] = vid.get('cover', {}).get('url_list', [''])[0]
                except:
                    pass
            page.on("response", capture_api)
            
            page.goto(url, wait_until="domcontentloaded", timeout=25000)
            page.wait_for_timeout(5000)
            
            # Check intercepted API data
            if video_data.get('video_url'):
                browser.close()
                return {
                    "title": video_data['title'][:100],
                    "video_url": video_data['video_url'],
                    "cover_url": video_data.get('cover', ''),
                    "platform": "douyin",
                }
            
            # Fallback: Parse RENDER_DATA
            render_data = page.evaluate("""() => {
                try {
                    const el = document.getElementById('RENDER_DATA');
                    if (!el) return null;
                    const decoded = decodeURIComponent(el.textContent);
                    const data = JSON.parse(decoded);
                    // Search for video info in RENDER_DATA
                    function findVideo(obj, depth) {
                        if (depth > 6 || !obj) return null;
                        if (typeof obj !== 'object') return null;
                        if (obj.play_addr && obj.play_addr.url_list) {
                            return { urls: obj.play_addr.url_list, cover: obj.cover?.url_list?.[0] || '' };
                        }
                        for (const v of Object.values(obj)) {
                            const r = findVideo(v, depth + 1);
                            if (r) return r;
                        }
                        return null;
                    }
                    function findTitle(obj, depth) {
                        if (depth > 4 || !obj) return '';
                        if (typeof obj !== 'object') return '';
                        if (obj.desc && typeof obj.desc === 'string' && obj.desc.length > 2) return obj.desc;
                        for (const v of Object.values(obj)) {
                            const r = findTitle(v, depth + 1);
                            if (r) return r;
                        }
                        return '';
                    }
                    const vid = findVideo(data, 0);
                    const title = findTitle(data, 0);
                    if (vid && vid.urls.length > 0) {
                        return { videoUrl: vid.urls[0], cover: vid.cover, title: title };
                    }
                    return null;
                } catch(e) { return null; }
            }""")
            
            if render_data and render_data.get('videoUrl'):
                browser.close()
                return {
                    "title": (render_data.get('title') or page.title() or 'Douyin Video')[:100],
                    "video_url": render_data['videoUrl'],
                    "cover_url": render_data.get('cover', ''),
                    "platform": "douyin",
                }
            
            browser.close()
            return None
    except Exception as e:
        print(f"Douyin Playwright error: {e}")
        return None

def parse_xhs_fast_http(url: str) -> Optional[Dict[str, Any]]:
    """Dùng HTTP GET siêu tốc (~0.8s) để lấy dữ liệu XHS không cần mở Chromium"""
    # FIX: Mobile UA không bị redirect về login như PC UA
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    try:
        # FIX: /explore/<id> -> /discovery/item/<id> (mobile endpoint đúng)
        if "/explore/" in url:
            url = url.replace("/explore/", "/discovery/item/")

        r = requests.get(url, headers=headers, timeout=5, allow_redirects=True)
        html = r.text
        match = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.*?});</script>', html, re.DOTALL) or \
                re.search(r'window\.__INITIAL_STATE__\s*=\s*({.*?})</script>', html, re.DOTALL)
        if match:
            raw_json = match.group(1).replace('undefined', 'null')
            data = json.loads(raw_json)

            # FIX: PATH MỚI (Mobile endpoint): noteData.data.noteData
            nd = None
            note_data_obj = data.get('noteData', {})
            if isinstance(note_data_obj, dict):
                inner_data = note_data_obj.get('data', {})
                if isinstance(inner_data, dict):
                    nd = inner_data.get('noteData') or inner_data.get('note')

            # PATH CŨ (PC endpoint): note.noteDetailMap
            if not nd:
                note = data.get('note', {})
                fni = note.get('firstNoteId') or note.get('currentNoteId') or ""
                if isinstance(fni, dict):
                    fni = fni.get('_value') or fni.get('value') or fni.get('_rawValue') or ""
                ndm = note.get('noteDetailMap', {})
                note_id = fni or (list(ndm.keys())[0] if ndm else "")
                if note_id and note_id in ndm:
                    nd = ndm[note_id].get('note', {})

            if nd:
                title = nd.get('title') or nd.get('desc') or 'XHS Content'
                
                # NẾU LÀ BÀI VIẾT BỘ SƯU TẬP ẢNH (Image Carousel Post)
                if nd.get('type') == 'normal':
                    images = []
                    if nd.get('imageList'):
                        for img in nd['imageList']:
                            img_url = img.get('urlDefault') or img.get('url') or ""
                            if img_url:
                                images.append(img_url)
                    if images:
                        return {
                            "type": "image",
                            "title": title[:100],
                            "cover_url": images[0],
                            "images": images,
                            "platform": "xiaohongshu"
                        }
                    return {"_error": "image_post", "title": title}

                v_url = ""
                if nd.get('type') == 'video' and nd.get('video'):
                    stream = nd['video'].get('media', {}).get('stream', {})
                    for k, tracks in stream.items():
                        if tracks and isinstance(tracks, list) and tracks[0].get('masterUrl'):
                            v_url = tracks[0]['masterUrl']
                            break
                    if not v_url:
                        ok = nd['video'].get('consumer', {}).get('originVideoKey')
                        if ok: v_url = f"https://sns-video-bd.xhscdn.com/{ok}"
                cover = ""
                if nd.get('imageList'):
                    cover = nd['imageList'][0].get('urlDefault') or nd['imageList'][0].get('url') or ""
                elif nd.get('video', {}).get('image'):
                    cover = nd['video']['image'].get('thumbnail') or ""
                elif nd.get('cover', {}).get('url'):
                    cover = nd['cover']['url']
                if v_url:
                    return {
                        "type": "video",
                        "title": title[:100],
                        "video_url": v_url,
                        "cover_url": cover,
                        "platform": "xiaohongshu"
                    }
    except Exception as e:
        print(f"Fast XHS HTTP parse error: {e}")
    return None

def scrape_tiktok_tikwm(url: str) -> Optional[Dict[str, Any]]:
    """Dùng TikWM API để lấy video TikTok HD không logo siêu tốc (~0.5s)"""
    try:
        r = requests.post("https://www.tikwm.com/api/", data={"url": url, "hd": 1}, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get('code') == 0:
                v_data = data.get('data', {})
                play_url = v_data.get('play') or v_data.get('wmplay')
                if play_url:
                    if play_url.startswith('/'):
                        play_url = "https://www.tikwm.com" + play_url
                    return {
                        "title": (v_data.get('title') or "TikTok Video")[:100],
                        "video_url": play_url,
                        "cover_url": v_data.get('cover', ''),
                        "platform": "tiktok",
                        "region": v_data.get('region', '')
                    }
    except Exception as e:
        print(f"TikWM API error: {e}")
    return None

def get_xiaohongshu_video(text: str) -> Optional[Dict[str, Any]]:
    """
    Hàm chính: Tự động nhận diện nền tảng và lấy thông tin video.
    XHS: Fast HTTP (0.8s) → Playwright DIRECT → Playwright + Tor → yt-dlp + Tor
    Douyin: Playwright → yt-dlp + Tor
    TikTok: TikWM API (0.5s) → yt-dlp direct → yt-dlp + Tor
    """
    url = extract_url(text)
    
    if not url.startswith('http://') and not url.startswith('https://'):
        # Auto-prepend https:// if it looks like a valid domain
        if any(url.startswith(d) for d in ['www.', 'youtube.com', 'youtu.be', 'tiktok.com', 'douyin.com', 'xiaohongshu.com', 'rednote.com', 'v.douyin.com', 'xhslink.com', 'fb.watch', 'facebook.com']):
            url = 'https://' + url
        else:
            return {"_error": "invalid_url"}
    
    platform = detect_platform(url)
    
    if platform == 'xiaohongshu':
        print(f"[XHS] Trying Fast HTTP fetch (~0.8s)...")
        fast_res = parse_xhs_fast_http(url)
        if fast_res and not fast_res.get('_error'):
            print(f"[XHS] Fast HTTP fetch SUCCESS!")
            return fast_res
        if fast_res and fast_res.get('_error') == 'image_post':
            return fast_res
            
        print(f"[XHS] Trying Playwright DIRECT...")
        result = _scrape_xhs_with_playwright(url, use_proxy=False)
        if result and not result.get('_error'):
            return result
        if result and result.get('_error') == 'image_post':
            return result
        
        print(f"[XHS] Direct failed, trying Playwright + Tor...")
        result = _scrape_xhs_with_playwright(url, use_proxy=True)
        if result and not result.get('_error'):
            return result
        if result and result.get('_error') in ('image_post', 'post_deleted'):
            return result
        
        print(f"[XHS] Trying yt-dlp + Tor...")
        result = get_video_info_ytdlp(url, proxy=TOR_PROXY)
        if result and not result.get('_error'):
            return result
        return result
    
    elif platform == 'douyin':
        print(f"[Douyin] Trying Fast Mobile Parser (~0.3s)...")
        fast_douyin = parse_douyin_fast(url)
        if fast_douyin and not fast_douyin.get('_error'):
            print(f"[Douyin] Fast Mobile Parser SUCCESS!")
            return fast_douyin

        # Douyin: Playwright fallback
        print(f"[Douyin] Fast parser failed, trying Playwright...")
        result = _scrape_douyin_with_playwright(url)
        if result and not result.get('_error'):
            return result
        
        # Fallback: yt-dlp with Tor
        print(f"[Douyin] Trying yt-dlp + Tor...")
        result = get_video_info_ytdlp(url, proxy=TOR_PROXY)
        if result and not result.get('_error'):
            return result
        return result

    elif platform == 'tiktok':
        print(f"[TikTok] Trying TikWM API (~0.5s)...")
        result = scrape_tiktok_tikwm(url)
        if result and not result.get('_error'):
            print(f"[TikTok] TikWM API SUCCESS!")
            return result
            
        print(f"[TikTok] TikWM failed, trying yt-dlp direct...")
        result = get_video_info_ytdlp(url)
        if result and not result.get('_error'):
            return result

        print(f"[TikTok] Direct yt-dlp failed, trying yt-dlp + Tor...")
        result = get_video_info_ytdlp(url, proxy=TOR_PROXY)
        if result and not result.get('_error'):
            return result
        return result
    
    # Các nền tảng khác (YouTube, YouTube Shorts, Facebook, Instagram, Bilibili...):
    # Thử yt-dlp trực tiếp -> Residential Proxy -> Tor Proxy để vượt qua 100% mã chặn của YouTube / Meta
    print(f"[{platform.upper()}] Trying yt-dlp direct...")
    result = get_video_info_ytdlp(url)
    if result and not result.get('_error'):
        return result

    print(f"[{platform.upper()}] Direct failed ({result.get('_error') if result else 'None'}), trying Residential Proxy...")
    if RESIDENTIAL_PROXIES:
        res_proxy_result = get_video_info_ytdlp(url, proxy=RESIDENTIAL_PROXIES[0])
        if res_proxy_result and not res_proxy_result.get('_error'):
            print(f"[{platform.upper()}] Residential Proxy SUCCESS!")
            return res_proxy_result

    print(f"[{platform.upper()}] Trying Tor Proxy fallback...")
    tor_result = get_video_info_ytdlp(url, proxy=TOR_PROXY)
    if tor_result and not tor_result.get('_error'):
        print(f"[{platform.upper()}] Tor Proxy SUCCESS!")
        return tor_result

    return result or {"_error": "unknown_error"}

if __name__ == "__main__":
    pass
