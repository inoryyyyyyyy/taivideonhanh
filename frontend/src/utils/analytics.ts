import { supabase } from '../supabaseClient';
import API_BASE from '../api';

// Generate a random ID for Deduplication
const generateEventId = () => {
  return 'evt_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

export const trackPixelEvent = async (eventName: string, payload: any = {}) => {
  const eventId = generateEventId();
  
  // Track Facebook Pixel
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, payload, { eventID: eventId });
  }
  
  // Track Tiktok Pixel
  if (typeof window !== 'undefined' && (window as any).ttq) {
    (window as any).ttq.track(eventName, payload);
  }

  // Fire CAPI to Backend
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    fetch(`${API_BASE}/api/capi/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        custom_data: payload
      })
    });
  } catch (err) {
    console.error("CAPI Tracking Error:", err);
  }
};

export const trackCustomEvent = async (eventName: string, payload: any = {}) => {
  const eventId = generateEventId();
  
  // Track Custom events on FB
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('trackCustom', eventName, payload, { eventID: eventId });
  }
  
  // Custom events on TT might not be standard, but we can pass it if supported
  if (typeof window !== 'undefined' && (window as any).ttq) {
    (window as any).ttq.track(eventName, payload);
  }

  // Fire CAPI to Backend
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    fetch(`${API_BASE}/api/capi/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        custom_data: payload
      })
    });
  } catch (err) {
    console.error("CAPI Tracking Error:", err);
  }
};
