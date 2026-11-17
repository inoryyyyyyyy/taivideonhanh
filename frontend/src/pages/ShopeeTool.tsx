import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function ShopeeTool() {
  const [inputText, setInputText] = useState('');
  const [affiliateId, setAffiliateId] = useState(() => {
    return localStorage.getItem('shopee_affiliate_id') || '';
  });
  const [rewrite, setRewrite] = useState(false);
  
  React.useEffect(() => {
    localStorage.setItem('shopee_affiliate_id', affiliateId);
  }, [affiliateId]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  
  const [copied, setCopied] = useState(false);

  const handleConvert = async () => {
    if (!inputText.trim()) {
      setError('Vui lòng nhập bài viết có chứa link Shopee.');
      return;
    }
    if (!affiliateId.trim()) {
      setError('Vui lòng nhập mã ID Affiliate của bạn.');
      return;
    }

    setError('');
    setIsLoading(true);
    setResult('');
    setCopied(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_BASE}/api/convert_shopee_links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: inputText,
          affiliate_id: affiliateId,
          rewrite: rewrite
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lỗi khi chuyển đổi');

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8">
      <div className="bg-white rounded-3xl border-[3px] border-[#2d2218] shadow-[8px_8px_0px_#2d2218] overflow-hidden">
        
        <div className="bg-[#a2d5c6] p-6 border-b-[3px] border-[#2d2218]">
          <h1 className="text-2xl font-black text-[#2d2218] mb-2 flex items-center gap-2">
            <span className="text-3xl">🛒</span> Công Cụ Chuyển Đổi Link Shopee
          </h1>
          <p className="font-bold text-[#2d2218]/80 text-sm">
            Tự động thay thế mọi link Shopee trong bài viết thành link Affiliate của bạn.
          </p>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          
          {error && (
            <div className="p-4 bg-[#fdf9f1] text-[#e65c4f] border-2 border-[#e65c4f] rounded-xl font-bold text-sm">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block font-black text-[#2d2218] mb-2">Mã ID Shopee Affiliate của bạn</label>
            <input 
              type="text" 
              placeholder="VD: 17339730373"
              value={affiliateId}
              onChange={(e) => setAffiliateId(e.target.value)}
              className="w-full bg-[#fdf9f1] border-[3px] border-[#2d2218] rounded-xl px-4 py-3 font-bold text-[#2d2218] placeholder:text-[#2d2218]/40 focus:outline-none focus:ring-4 focus:ring-[#f6a287]/30 transition-all"
            />
            <p className="text-xs font-bold text-[#6b5a4b] mt-2 opacity-70">
              Sẽ được nối vào tham số UTM để đảm bảo ghi nhận hoa hồng.
            </p>
          </div>

          <div>
            <label className="block font-black text-[#2d2218] mb-2">Nội dung bài viết (chứa link Shopee)</label>
            <textarea 
              rows={6}
              placeholder="Dán bài viết chứa các link s.shopee.vn vào đây..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-[#fdf9f1] border-[3px] border-[#2d2218] rounded-xl px-4 py-3 font-bold text-[#2d2218] placeholder:text-[#2d2218]/40 focus:outline-none focus:ring-4 focus:ring-[#f6a287]/30 transition-all resize-none"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-4 border-[3px] border-[#2d2218] rounded-xl hover:bg-[#fdf9f1] transition-all">
            <input 
              type="checkbox" 
              checked={rewrite}
              onChange={(e) => setRewrite(e.target.checked)}
              className="w-5 h-5 accent-[#f6a287] rounded border-2 border-[#2d2218] cursor-pointer"
            />
            <span className="font-bold text-[#2d2218]">✨ Dùng AI viết lại bài viết (Giữ nguyên link, xáo trộn câu chữ để tránh trùng lặp)</span>
          </label>

          <button
            onClick={handleConvert}
            disabled={isLoading}
            className="w-full py-4 bg-[#f6a287] text-[#2d2218] rounded-2xl border-[3px] border-[#2d2218] font-black text-lg hover:-translate-y-1 hover:shadow-[6px_6px_0px_#2d2218] active:translate-y-0 active:shadow-[0px_0px_0px_#2d2218] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin text-xl">⏳</span> Đang chuyển đổi link... (có thể mất vài giây)
              </span>
            ) : (
              'Chuyển Đổi Link Ngay 🚀'
            )}
          </button>

          {result && (
            <div className="mt-8 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <label className="font-black text-[#2d2218]">Kết quả</label>
                <button 
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-[#a2d5c6] text-[#2d2218] font-bold text-xs rounded-lg border-2 border-[#2d2218] hover:bg-[#8ec2b3] transition-all"
                >
                  {copied ? '✅ Đã Copy' : '📋 Copy Text'}
                </button>
              </div>
              <textarea 
                readOnly
                rows={8}
                value={result}
                className="w-full bg-white border-[3px] border-[#2d2218] rounded-xl px-4 py-3 font-bold text-[#2d2218] focus:outline-none focus:ring-4 focus:ring-[#f6a287]/30 transition-all resize-none shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)]"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
