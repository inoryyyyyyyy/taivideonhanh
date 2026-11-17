import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Navigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import API_BASE from '../api';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    setIsSignUp(searchParams.get('mode') === 'signup');
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('aff_ref', ref);
    }
    setErrorMsg('');
    setSuccessMsg('');
  }, [searchParams]);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        let normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail.endsWith('@gmail.com') || normalizedEmail.endsWith('@googlemail.com')) {
          const parts = normalizedEmail.split('@');
          parts[0] = parts[0].replace(/\./g, '');
          normalizedEmail = parts.join('@');
        }

        const affRef = localStorage.getItem('aff_ref');
        const utmStr = localStorage.getItem('utm_data');
        const utmData = utmStr ? JSON.parse(utmStr) : {};
        const { error, data } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: name,
              referred_by_code: affRef || null,
              ...utmData
            }
          }
        });
        if (error) throw error;
        
        if (data.user) {
          try {
            await fetch(`${API_BASE}/api/marketing/subscribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: normalizedEmail, first_name: name })
            });
          } catch (err) {
            console.error("Marketing Error:", err);
          }
        }
        
        setSuccessMsg("🎉 Đăng ký thành công! Vui lòng kiểm tra hộp thư email của bạn để xác nhận tài khoản.");
        setEmail('');
        setPassword('');
        setName('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (error: any) {
      setErrorMsg(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex selection:bg-[#f6a287] selection:text-white font-sans bg-[#e8f1f2]">
      {/* Left Side - Hidden on mobile */}
      <div className="hidden lg:flex lg:flex-1 bg-[#a2d5c6] border-r-[4px] border-[#2d2218] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#fdf9f1] border-[4px] border-[#2d2218] rounded-full opacity-50"></div>
        <div className="absolute bottom-20 -right-20 w-64 h-64 bg-[#f6a287] border-[4px] border-[#2d2218] rounded-full opacity-50"></div>
        
        <Link to="/" className="flex items-center gap-2 relative z-10 w-max bg-white px-4 py-2 border-[3px] border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all">
          <div className="text-3xl">🎬</div>
          <span className="font-black text-2xl text-[#2d2218] uppercase tracking-tighter">TaiVideoNhanh</span>
        </Link>
        
        <div className="max-w-xl relative z-10">
          <h1 className="text-4xl xl:text-5xl font-black text-[#2d2218] mb-6 leading-[1.15]">
            Nền tảng <br/>
            <span className="text-[#e65c4f] relative inline-block">
              Tải & Lồng Tiếng
              <svg className="absolute w-full h-4 -bottom-1 left-0 text-[#2d2218]" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none"/></svg>
            </span> 
            <br/>Xây Kênh: Nhanh – Tiện – Rẻ.
          </h1>
          <p className="text-xl font-bold text-[#2d2218] mb-10 leading-relaxed max-w-lg">
            Tải video không logo, dịch và lồng tiếng AI tự động cực nhanh, cực rẻ. Đăng ký ngay hôm nay để nhận 10.000đ dùng thử!
          </p>
          
          <div className="bg-[#fdf9f1] border-[4px] border-[#2d2218] rounded-3xl p-6 shadow-[8px_8px_0px_#2d2218] transform rotate-[-2deg] hover:rotate-0 transition-transform">
            <p className="font-bold text-[#2d2218] text-lg mb-4">"Chưa bao giờ làm video Affiliate lại dễ dàng đến thế. Giọng đọc AI quá tự nhiên, tỷ lệ chuyển đổi tăng gấp 3!"</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f6a287] border-[3px] border-[#2d2218] rounded-full flex items-center justify-center font-black text-xl">HN</div>
              <div>
                <p className="font-black text-[#2d2218]">Hoàng Nam</p>
                <p className="font-bold text-[#6b5a4b] text-sm">TikTok Creator (1.2M Followers)</p>
              </div>
            </div>
          </div>
        </div>
        
        <p className="font-bold text-[#2d2218] relative z-10">© 2026 TaiVideoNhanh. All rights reserved.</p>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 xl:px-32 bg-[#fdf9f1] relative">
        <div className="lg:hidden flex justify-center mb-10 mt-8">
          <Link to="/" className="flex items-center gap-2 bg-white px-5 py-3 border-[3px] border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
            <div className="text-3xl">🎬</div>
            <span className="font-black text-2xl text-[#2d2218] uppercase tracking-tighter">TaiVideoNhanh</span>
          </Link>
        </div>

        <div className="w-full max-w-md mx-auto">
          <div className="text-center lg:text-left mb-10">
            <h2 className="text-4xl sm:text-5xl font-black text-[#2d2218] uppercase tracking-tight mb-3">
              {isSignUp ? "Tạo Tài Khoản" : "Đăng Nhập"}
            </h2>
            <p className="text-[#6b5a4b] font-bold text-lg">
              {isSignUp ? "Tham gia cộng đồng Creator lớn nhất VN 🚀" : "Chào mừng bạn trở lại Studio 👋"}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleAuth}>
            {isSignUp && (
              <div>
                <label className="block text-sm font-black text-[#2d2218] uppercase tracking-wider mb-2">Tên hiển thị</label>
                <input
                  type="text"
                  required={isSignUp}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 bg-white border-[3px] border-[#2d2218] rounded-2xl outline-none text-[#2d2218] font-bold text-lg shadow-[4px_4px_0px_#2d2218] focus:shadow-[0px_0px_0px_#2d2218] focus:translate-y-[4px] transition-all"
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-black text-[#2d2218] uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-white border-[3px] border-[#2d2218] rounded-2xl outline-none text-[#2d2218] font-bold text-lg shadow-[4px_4px_0px_#2d2218] focus:shadow-[0px_0px_0px_#2d2218] focus:translate-y-[4px] transition-all"
                placeholder="hello@taivideonhanh.com"
              />
            </div>

            <div>
              <label className="block text-sm font-black text-[#2d2218] uppercase tracking-wider mb-2">Mật khẩu</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-white border-[3px] border-[#2d2218] rounded-2xl outline-none text-[#2d2218] font-bold text-lg shadow-[4px_4px_0px_#2d2218] focus:shadow-[0px_0px_0px_#2d2218] focus:translate-y-[4px] transition-all"
                placeholder="••••••••"
              />
            </div>

            {errorMsg && (
              <div className="p-4 bg-[#ffcccb] border-[3px] border-[#2d2218] rounded-2xl text-sm font-bold text-[#2d2218] flex items-start gap-3 shadow-[4px_4px_0px_#2d2218]">
                <span className="text-xl">⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}
            
            {successMsg && (
              <div className="p-5 bg-[#a2d5c6] border-[3px] border-[#2d2218] rounded-2xl text-sm font-bold text-[#2d2218] flex items-start gap-3 shadow-[4px_4px_0px_#2d2218]">
                <span className="text-xl">✅</span>
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-[#f6a287] border-[3px] border-[#2d2218] rounded-2xl shadow-[6px_6px_0px_#2d2218] hover:shadow-[0px_0px_0px_#2d2218] hover:translate-y-[6px] active:scale-[0.98] transition-all text-xl font-black uppercase tracking-wider text-[#2d2218] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang xử lý...' : (isSignUp ? 'Đăng Ký Ngay' : 'Đăng Nhập')}
              </button>
            </div>
          </form>

          <div className="mt-10 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-[3px] border-dashed border-[#d4c5b9]"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-[#fdf9f1] font-black text-[#6b5a4b] uppercase">HOẶC</span>
            </div>
          </div>

          <div className="mt-8 text-center pb-12 lg:pb-0">
            <button
              onClick={() => navigate(`/login?mode=${isSignUp ? 'login' : 'signup'}`)}
              className="inline-block font-black text-lg text-[#2d2218] border-b-[3px] border-[#2d2218] hover:text-[#f6a287] hover:border-[#f6a287] transition-colors pb-1"
            >
              {isSignUp ? "Đã có tài khoản? Đăng nhập ngay" : "Chưa có tài khoản? Đăng ký mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
