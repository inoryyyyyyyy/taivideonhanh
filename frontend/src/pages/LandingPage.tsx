import API_BASE from '../api';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';

export default function LandingPage() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'fetching_info' | 'info_ready' | 'error'>('idle');
  const [videoData, setVideoData] = useState<any>(null);
  const [resultMessage, setResultMessage] = useState('');
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  // Capture referral code from URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('aff_ref', ref);
    }
  }, []);

  // Fetch balance when user is logged in
  React.useEffect(() => {
    if (user) {
      supabase.from('wallets').select('balance').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setBalance(data.balance); });
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setBalance(null);
  };

  const handleGetInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setStatus('fetching_info');
    setResultMessage('');
    
    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error('Lỗi phản hồi từ máy chủ. Vui lòng kiểm tra lại đường link.');
      }

      if (res.ok && data.status === 'success') {
        setVideoData(data.data);
        setStatus('info_ready');
        setResultMessage('Phân tích video thành công!');
      } else {
        throw new Error(data.message || 'Có lỗi xảy ra khi phân tích video');
      }
    } catch (error: any) {
      setStatus('error');
      setResultMessage(error.message || 'Lỗi kết nối máy chủ');
    }
  };

  return (
    <div className="min-h-screen bg-[#f3efe8] font-sans selection:bg-[#ffcdc2]">
      {/* Navigation */}
      <div className="p-4 sm:p-6">
        <nav className="flex items-center justify-between max-w-7xl mx-auto bg-white/80 backdrop-blur-md rounded-full px-6 py-4 border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tighter">🎥</span>
            <span className="font-bold text-xl tracking-tight text-[#2d2218]">TaiVideoNhanh</span>
          </div>
          <div className="hidden md:flex gap-8 font-semibold text-[#6b5a4b]">
            <a href="#features" className="hover:text-[#2d2218] transition-colors">Tính Năng</a>
            <a href="#pricing" className="hover:text-[#2d2218] transition-colors">Bảng Giá</a>
            <Link to="/affiliate" className="text-[#e65c4f] font-bold hover:text-[#2d2218] transition-colors">🤝 Tiếp Thị (20%)</Link>
            <a href="#how" className="hover:text-[#2d2218] transition-colors">Cách Hoạt Động</a>
            <Link to="/blog" className="hover:text-[#2d2218] transition-colors">Blog</Link>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 bg-[#fdf9f1] px-3 py-1.5 rounded-full border-2 border-[#2d2218]">
                  <span className="text-sm font-bold text-[#6b5a4b]">💰</span>
                  <span className="font-black text-[#2d2218] text-sm">
                    {balance !== null ? new Intl.NumberFormat('vi-VN').format(balance) + 'đ' : '...'}
                  </span>
                </div>
                <Link to="/dashboard" className="bg-[#a2d5c6] text-[#2d2218] px-5 py-2 rounded-full font-bold border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[0px_0px_0px_#2d2218] transition-all">
                  Studio
                </Link>
                <button onClick={handleSignOut} className="hidden sm:block font-bold text-[#6b5a4b] hover:text-[#2d2218] transition-colors text-sm">
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block font-bold text-[#2d2218] hover:opacity-70 transition-opacity">Đăng nhập</Link>
                <Link to="/login?mode=signup" className="bg-[#f6a287] text-[#2d2218] px-5 py-2 rounded-full font-bold border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[0px_0px_0px_#2d2218] transition-all">
                  Đăng Ký Nhận 10k
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto">
        <main className="relative px-4 sm:px-6 pt-16 pb-24 text-center flex flex-col items-center overflow-hidden">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-extrabold text-[#2d2218] max-w-4xl leading-[1.1] mb-6 tracking-tight z-10 px-2">
            Nền Tảng Tải & Lồng Tiếng Xây Kênh <br className="hidden sm:block"/>
            Nhanh – Tiện – Rẻ!
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-[#6b5a4b] max-w-2xl font-medium mb-10 z-10 px-4">
            Tải video chất lượng cao không logo miễn phí. Trí tuệ nhân tạo tự động dịch và lồng tiếng Việt chuẩn xác, cực nhanh, cực rẻ giúp bạn sáng tạo nội dung và xây kênh mỗi ngày.
          </p>

          <form onSubmit={handleGetInfo} className="w-full max-w-2xl relative z-10">
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-2 rounded-[2rem] sm:rounded-full border-4 border-dashed border-[#2d2218]">
              <div className="flex-1 flex items-center px-4 py-2">
                <span className="text-2xl mr-3 opacity-50">🔗</span>
                <input 
                  type="text" 
                  required
                  placeholder="Dán link video Douyin, TikTok, Xiaohongshu..."
                  className="w-full bg-transparent border-none outline-none font-medium text-lg text-[#2d2218] placeholder:text-[#a08f7f]"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                disabled={status === 'fetching_info'}
                className="bg-[#d4bca4] text-[#2d2218] px-8 py-4 sm:py-0 rounded-full font-bold text-lg border-2 border-[#2d2218] hover:bg-[#c2aa91] transition-colors disabled:opacity-50"
              >
                {status === 'fetching_info' ? 'Đang xử lý...' : 'Phân Tích'}
              </button>
            </div>
            <p className="mt-4 text-sm font-semibold text-[#8b7a6b]">
              Hỗ trợ tải từ: Douyin, TikTok, Xiaohongshu, Kuaishou, Bilibili.
            </p>
          </form>
          
          {/* Kết quả phân tích */}
          {status !== 'idle' && status !== 'fetching_info' && (
            <div className={`mt-8 w-full max-w-2xl p-6 rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] text-left ${status === 'error' ? 'bg-[#ffcdc2]' : 'bg-white'}`}>
              <h3 className="font-bold text-xl text-[#2d2218] mb-2">
                {status === 'error' ? '❌ Lỗi' : '✅ Phân Tích Thành Công'}
              </h3>
              <p className="text-[#6b5a4b] font-medium mb-4">{resultMessage}</p>
              
              {status === 'info_ready' && videoData && (
                <div className="flex flex-col sm:flex-row gap-4 border-t-2 border-dashed border-[#e5dcd3] pt-4 mt-4">
                  {videoData.cover_url && (
                    <img src={videoData.cover_url.replace(/^http:\/\//i, 'https://')} referrerPolicy="no-referrer" alt="Thumbnail" className="w-32 h-32 object-cover rounded-xl border-2 border-[#2d2218]" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-[#2d2218] line-clamp-2 mb-1">{videoData.title || 'Không có tiêu đề'}</p>
                    <p className="text-sm text-[#8b7a6b] mb-4">
                      {videoData.duration ? `Thời lượng: ${videoData.duration >= 60 ? `${Math.floor(videoData.duration / 60)} phút ${videoData.duration % 60}s` : `${videoData.duration}s`} | ` : ''}Nguồn: {videoData.platform || 'douyin'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a href={`${API_BASE}/api/download?b64=${btoa(videoData.video_url || videoData.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}&title=${encodeURIComponent(videoData.title || '')}`} download className="bg-[#2d2218] text-white px-4 py-2 rounded-full text-sm font-bold border-2 border-[#2d2218] hover:bg-transparent hover:text-[#2d2218] transition-colors">
                        ⬇️ Tải Video Gốc (HD)
                      </a>
                      <button onClick={() => navigate('/login')} className="bg-[#f6a287] text-[#2d2218] px-4 py-2 rounded-full text-sm font-bold border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[0px_0px_0px_#2d2218] transition-all">
                        🎙️ Dịch & Lồng Tiếng (3.000đ)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        <section id="features" className="px-6 py-20 bg-[#2d2218] text-[#f3efe8] rounded-t-[3rem] sm:rounded-[3rem] mx-2 mb-10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-center mb-16 tracking-tight">Tại sao chọn TaiVideoNhanh?</h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-[#3e3125] p-8 rounded-3xl border-2 border-[#5c4a38]">
                <div className="text-4xl mb-4">🚀</div>
                <h3 className="text-xl font-bold mb-3 text-white">Tốc độ chớp nhoáng</h3>
                <p className="text-[#a89b8d] font-medium leading-relaxed">Tải video góc cực nhanh. Hệ thống lồng tiếng AI xử lý 1 video chỉ trong vòng 1-2 phút.</p>
              </div>
              <div className="bg-[#3e3125] p-8 rounded-3xl border-2 border-[#5c4a38]">
                <div className="text-4xl mb-4">🗣️</div>
                <h3 className="text-xl font-bold mb-3 text-white">Giọng đọc siêu thực</h3>
                <p className="text-[#a89b8d] font-medium leading-relaxed">Sử dụng công nghệ AI hàng đầu (Vbee, OpenAI) cho ra giọng đọc tự nhiên như người thật.</p>
              </div>
              <div className="bg-[#3e3125] p-8 rounded-3xl border-2 border-[#5c4a38]">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-xl font-bold mb-3 text-white">Chi phí siêu rẻ</h3>
                <p className="text-[#a89b8d] font-medium leading-relaxed">Tải video miễn phí 100%. Lồng tiếng chỉ 3.000đ/video. Thanh toán linh hoạt qua VietQR.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how" className="px-6 py-20 bg-[#fdf8ef] border-t-2 border-b-2 border-[#2d2218] my-10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-center mb-16 tracking-tight text-[#2d2218]">3 Bước Đơn Giản</h2>
            
            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-1 border-t-4 border-dashed border-[#d4bca4] z-0" style={{ width: '66%', left: '16.66%' }}></div>
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-white border-[4px] border-[#2d2218] flex items-center justify-center text-3xl font-black shadow-[4px_4px_0px_#2d2218] mb-6 z-10">1</div>
                <h3 className="text-xl font-bold mb-3 text-[#2d2218]">Dán Link</h3>
                <p className="text-[#6b5a4b] font-medium">Copy link video từ Douyin, TikTok, Xiaohongshu và dán vào hệ thống.</p>
              </div>
              
              <div className="relative z-10 flex flex-col items-center text-center mt-10 md:mt-0">
                <div className="w-24 h-24 rounded-full bg-[#f6a287] border-[4px] border-[#2d2218] flex items-center justify-center text-3xl font-black shadow-[4px_4px_0px_#2d2218] mb-6 z-10">2</div>
                <h3 className="text-xl font-bold mb-3 text-[#2d2218]">AI Xử Lý</h3>
                <p className="text-[#6b5a4b] font-medium">Hệ thống tải video gốc, tách âm, dịch và lồng tiếng Việt hoàn toàn tự động.</p>
              </div>
              
              <div className="relative z-10 flex flex-col items-center text-center mt-10 md:mt-0">
                <div className="w-24 h-24 rounded-full bg-[#a2d5c6] border-[4px] border-[#2d2218] flex items-center justify-center text-3xl font-black shadow-[4px_4px_0px_#2d2218] mb-6 z-10">3</div>
                <h3 className="text-xl font-bold mb-3 text-[#2d2218]">Nhận Kết Quả</h3>
                <p className="text-[#6b5a4b] font-medium">Tải video đã hoàn thiện với chất lượng cao nhất, sẵn sàng đăng tải lên các nền tảng.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="px-6 py-20 max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-center mb-4 tracking-tight text-[#2d2218]">Bảng Giá Đơn Giản</h2>
          <p className="text-[#6b5a4b] font-medium text-lg text-center mb-16 max-w-2xl mx-auto">Thanh toán theo mức sử dụng, không cần gói cước cố định hàng tháng.</p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white p-8 rounded-[2rem] border-[3px] border-[#2d2218] shadow-[8px_8px_0px_#2d2218] flex flex-col">
              <h3 className="text-2xl font-black text-[#2d2218] mb-2">Tải Video Gốc</h3>
              <div className="text-[#6b5a4b] font-medium mb-6">Dành cho nhu cầu cơ bản</div>
              <div className="text-5xl font-black text-[#2d2218] mb-8">0đ <span className="text-lg font-medium text-[#8b7a6b]">/ video</span></div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 font-medium text-[#4a3b2c]">
                  <span className="text-[#f6a287] font-black">✓</span> Tải không có logo/watermark
                </li>
                <li className="flex items-start gap-3 font-medium text-[#4a3b2c]">
                  <span className="text-[#f6a287] font-black">✓</span> Chất lượng cao nhất
                </li>
                <li className="flex items-start gap-3 font-medium text-[#4a3b2c]">
                  <span className="text-[#f6a287] font-black">✓</span> Hỗ trợ 5+ nền tảng
                </li>
                <li className="flex items-start gap-3 font-medium text-[#4a3b2c]">
                  <span className="text-[#f6a287] font-black">✓</span> Không giới hạn số lượng
                </li>
              </ul>
              <a href="#" onClick={(e) => {e.preventDefault(); window.scrollTo(0,0)}} className="text-center w-full bg-[#fdf9f1] text-[#2d2218] px-6 py-4 rounded-xl font-bold border-2 border-[#2d2218] hover:bg-[#e5dcd3] transition-colors">Dùng Ngay</a>
            </div>

            {/* Pro Tier */}
            <div className="bg-[#2d2218] text-white p-8 rounded-[2rem] border-[3px] border-[#2d2218] shadow-[8px_8px_0px_#f6a287] flex flex-col relative transform md:-translate-y-4">
              <div className="absolute -top-4 right-8 bg-[#f6a287] text-[#2d2218] px-4 py-1 rounded-full text-sm font-black border-2 border-[#2d2218] transform rotate-3">ĐƯỢC ƯA CHUỘNG</div>
              <h3 className="text-2xl font-black mb-2 text-white">Lồng Tiếng AI</h3>
              <div className="text-[#a89b8d] font-medium mb-6">Dành cho người kiếm tiền online</div>
              <div className="text-5xl font-black mb-8 text-white">3.000đ <span className="text-lg font-medium text-[#a89b8d]">/ video</span></div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 font-medium text-[#d9cfc5]">
                  <span className="text-[#a2d5c6] font-black">✓</span> Mọi tính năng của gói Tải Video Gốc
                </li>
                <li className="flex items-start gap-3 font-medium text-[#d9cfc5]">
                  <span className="text-[#a2d5c6] font-black">✓</span> Tự động dịch sang Tiếng Việt
                </li>
                <li className="flex items-start gap-3 font-medium text-[#d9cfc5]">
                  <span className="text-[#a2d5c6] font-black">✓</span> Lồng tiếng Việt cực tự nhiên
                </li>
                <li className="flex items-start gap-3 font-medium text-[#d9cfc5]">
                  <span className="text-[#a2d5c6] font-black">✓</span> Tự động gắn phụ đề
                </li>
              </ul>
              <Link to="/login?mode=signup" className="text-center w-full bg-[#f6a287] text-[#2d2218] px-6 py-4 rounded-xl font-bold border-2 border-[#2d2218] hover:bg-[#e09177] transition-colors shadow-[4px_4px_0px_#2d2218]">Đăng Ký & Nhận 10k</Link>
            </div>
          </div>
        </section>

        {/* Affiliate Section */}
        <section className="px-6 py-20 bg-[#a2d5c6] text-center border-t-4 border-b-4 border-[#2d2218]">
          <div className="max-w-4xl mx-auto">
            <span className="bg-[#e65c4f] text-white text-xs font-black px-4 py-1.5 rounded-full border-2 border-[#2d2218] uppercase tracking-wider mb-4 inline-block shadow-[2px_2px_0px_#2d2218]">
              🎁 TIẾP THỊ LIÊN KẾT 20% HOA HỒNG TRỌN ĐỜI
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-[#2d2218] mb-6 leading-tight">
              Tạo Thu Nhập Thụ Động Cùng TaiVideoNhanh
            </h2>
            <p className="text-lg text-[#2d2218]/90 font-bold mb-8 max-w-2xl mx-auto leading-relaxed">
              Chia sẻ link giới thiệu cá nhân của bạn lên TikTok, Facebook, Youtube. Nhận ngay <b className="text-[#e65c4f] bg-white px-2 py-0.5 rounded-lg border border-[#2d2218]">20% hoa hồng trọn đời</b> mỗi khi người dùng nạp tiền tự động 24/7!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
              <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-5 shadow-[4px_4px_0px_#2d2218]">
                <span className="text-2xl block mb-2">🔗</span>
                <h4 className="font-black text-[#2d2218] mb-1">1. Lấy Link Cá Nhân</h4>
                <p className="text-xs font-medium text-[#6b5a4b]">Mỗi tài khoản có 1 đường link tiếp thị riêng chứa Mã Ref duy nhất.</p>
              </div>

              <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-5 shadow-[4px_4px_0px_#2d2218]">
                <span className="text-2xl block mb-2">📢</span>
                <h4 className="font-black text-[#2d2218] mb-1">2. Chia Sẻ Video / Bài Viết</h4>
                <p className="text-xs font-medium text-[#6b5a4b]">Đăng bài hướng dẫn làm video hoặc review công cụ lên mạng xã hội.</p>
              </div>

              <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-5 shadow-[4px_4px_0px_#2d2218]">
                <span className="text-2xl block mb-2">💸</span>
                <h4 className="font-black text-[#2d2218] mb-1">3. Nhận 20% Tự Động</h4>
                <p className="text-xs font-medium text-[#6b5a4b]">Hoa hồng được cộng thẳng vào ví tự động 3 giây sau khi khách nạp tiền.</p>
              </div>
            </div>

            <Link to="/affiliate" className="inline-block bg-[#f6a287] text-[#2d2218] px-8 py-4 rounded-full font-black text-lg border-3 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all">
              Tham Gia Tiếp Thị 20% Ngay ➔
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="px-6 py-24 max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-12 text-[#2d2218]">Câu Hỏi Thường Gặp</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              { q: 'TaiVideoNhanh là gì?', a: 'TaiVideoNhanh là nền tảng SaaS cho phép bạn tải video từ Douyin, TikTok, Xiaohongshu không có logo/watermark hoàn toàn miễn phí. Ngoài ra, hệ thống còn hỗ trợ tự động dịch và lồng tiếng Việt bằng trí tuệ nhân tạo (AI) với chi phí chỉ 3.000đ/video.' },
              { q: 'Tải video có miễn phí không?', a: 'Có! Tính năng tải video gốc (không logo, chất lượng cao) là hoàn toàn miễn phí, không giới hạn số lượng, không cần đăng ký tài khoản.' },
              { q: 'Lồng tiếng AI hoạt động như thế nào?', a: 'Hệ thống sử dụng AI của OpenAI để dịch nội dung từ tiếng Trung sang tiếng Việt, sau đó dùng công nghệ Text-to-Speech (TTS) của Vbee để tạo giọng đọc tiếng Việt tự nhiên và ghép vào video gốc. Toàn bộ quá trình diễn ra tự động chỉ trong 1-2 phút.' },
              { q: 'Giá lồng tiếng là bao nhiêu?', a: 'Mỗi video lồng tiếng có giá 3.000đ, không phân biệt độ dài. Khi đăng ký tài khoản mới, bạn được tặng ngay 10.000đ (tương đương 3 video miễn phí) để trải nghiệm.' },
              { q: 'Tôi có thể nạp tiền bằng cách nào?', a: 'Hiện tại TaiVideoNhanh hỗ trợ nạp tiền qua chuyển khoản ngân hàng (VietQR). Số dư được cộng tự động ngay sau khi hệ thống nhận được giao dịch.' },
              { q: 'Video lồng tiếng có thể dùng cho mục đích gì?', a: 'Bạn có thể dùng video đã lồng tiếng để đăng lên Facebook, TikTok, YouTube, Instagram phục vụ kinh doanh Affiliate Marketing, xây dựng Fanpage bán hàng, hoặc tạo nội dung cho kênh cá nhân.' },
              { q: 'TaiVideoNhanh có hỗ trợ những nền tảng nào?', a: 'Hiện tại hệ thống hỗ trợ tải video từ Douyin, TikTok, Xiaohongshu, Kuaishou, Weibo và Bilibili. Chúng tôi liên tục cập nhật thêm các nền tảng mới.' },
            ].map((faq, i) => (
              <details key={i} className="group bg-white rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] overflow-hidden">
                <summary className="cursor-pointer px-6 py-5 font-bold text-[#2d2218] text-left flex items-center justify-between gap-4">
                  <span>{faq.q}</span>
                  <span className="text-xl shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-6 pb-5 text-[#6b5a4b] font-medium text-sm leading-relaxed border-t-2 border-dashed border-[#e5dcd3] pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-20 bg-[#f6a287] text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#2d2218] mb-4">Sẵn Sàng Xây Kênh Tiện Lợi & Hiệu Quả?</h2>
          <p className="text-[#4a3b2c] font-medium mb-10 max-w-xl mx-auto">Đăng ký ngay hôm nay để nhận 10.000đ trải nghiệm miễn phí lồng tiếng AI.</p>
          <Link to="/login?mode=signup" className="inline-block bg-[#2d2218] text-white px-10 py-5 rounded-full font-bold text-lg border-2 border-[#2d2218] shadow-[4px_4px_0px_#6b5a4b] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#6b5a4b] transition-all">
            Bắt Đầu Ngay - Miễn Phí
          </Link>
        </section>

        {/* Footer */}
        <footer className="px-6 py-12 bg-[#2d2218] text-[#d9cfc5]">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🎬</span>
                <span className="font-bold text-xl text-white">TaiVideoNhanh</span>
              </div>
              <p className="text-sm leading-relaxed">Nền tảng tải video không logo và lồng tiếng AI tiện dụng, hiệu quả. Giải pháp tối ưu cho nhà sáng tạo nội dung, Affiliate Marketer và người xây kênh.</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Tính Năng</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/tai-video-douyin-khong-logo" className="hover:text-white transition-colors">Tải video Douyin không logo</Link></li>
                <li><Link to="/tai-video-tiktok-khong-logo" className="hover:text-white transition-colors">Tải video TikTok không watermark</Link></li>
                <li><Link to="/tai-video-xiaohongshu" className="hover:text-white transition-colors">Tải video Xiaohongshu chất lượng cao</Link></li>
                <li><Link to="/tai-video-kuaishou-khong-logo" className="hover:text-white transition-colors">Tải video Kuaishou không logo</Link></li>
                <li><Link to="/tai-video-bilibili" className="hover:text-white transition-colors">Tải video Bilibili HD</Link></li>
                <li><Link to="/tai-video-facebook-hd" className="hover:text-white transition-colors">Tải video Facebook HD</Link></li>
                <li><Link to="/tai-video-youtube" className="hover:text-white transition-colors">Tải video YouTube MP4</Link></li>
                <li><Link to="/viet-hoa-anh-xiaohongshu" className="hover:text-white transition-colors">Việt hóa ảnh Xiaohongshu AI</Link></li>
                <li>Lồng tiếng Việt tự động bằng AI</li>
                <li>Tạo phụ đề tiếng Việt tự động</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Liên Kết</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Tính năng</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Bảng giá</a></li>
                <li><a href="#how" className="hover:text-white transition-colors">Cách hoạt động</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Đăng nhập / Đăng ký</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#4a3b2c] pt-8 text-center text-sm">
            <p>© 2026 TaiVideoNhanh.com — Công cụ tiện dụng, hiệu quả giúp bạn xây kênh dễ dàng.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
