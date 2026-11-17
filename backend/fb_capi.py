import os
import hashlib
import time
import httpx

FB_CAPI_TOKEN = os.getenv("FB_CAPI_TOKEN")

def hash_data(data: str) -> str:
    """Hash string using SHA256 as required by Facebook."""
    if not data:
        return ""
    return hashlib.sha256(data.strip().lower().encode('utf-8')).hexdigest()

def send_fb_capi_event(pixel_id: str, event_name: str, event_id: str = None, email: str = None, phone: str = None, external_id: str = None, value: float = None, currency: str = "VND", user_agent: str = None, ip_address: str = None, fbp: str = None, fbc: str = None, custom_data: dict = None):
    """
    Sends an event to Facebook Conversions API.
    """
    if not FB_CAPI_TOKEN or not pixel_id:
        print("FB CAPI: Missing Token or Pixel ID")
        return
        
    url = f"https://graph.facebook.com/v19.0/{pixel_id}/events"
    
    # User Data
    user_data = {}
    if email:
        user_data['em'] = [hashlib.sha256(email.strip().lower().encode('utf-8')).hexdigest()]
    if phone:
        # Simple cleanup for VN phone
        phone_clean = phone.strip()
        if phone_clean.startswith('0'):
            phone_clean = '84' + phone_clean[1:]
        user_data['ph'] = [hashlib.sha256(phone_clean.encode('utf-8')).hexdigest()]
        
    if ip_address:
        user_data['client_ip_address'] = ip_address
    if user_agent:
        user_data['client_user_agent'] = user_agent
    if fbp:
        user_data['fbp'] = fbp
    if fbc:
        user_data['fbc'] = fbc
    if external_id:
        user_data['external_id'] = [hashlib.sha256(external_id.strip().encode('utf-8')).hexdigest()]
        
    # Default fallback user_agent/ip if not provided but required by FB
    if not user_agent:
        user_data['client_user_agent'] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        
    event_data = {
        "event_name": event_name,
        "event_time": int(time.time()),
        "action_source": "website",
        "user_data": user_data,
    }
    
    if event_id:
        event_data["event_id"] = event_id
    
    # Custom Data
    c_data = {}
    if value is not None:
        c_data["value"] = value
        c_data["currency"] = currency
    if custom_data:
        c_data.update(custom_data)
        
    if c_data:
        event_data["custom_data"] = c_data
        
    payload = {
        "data": [event_data],
        "access_token": FB_CAPI_TOKEN
    }
    
    try:
        # Fire and forget / background via httpx sync or async
        # Since this might be called in a fast webhook, we shouldn't block long.
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, json=payload)
            print(f"FB CAPI Event '{event_name}' Response: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"FB CAPI Error: {e}")
