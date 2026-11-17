import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import DepositModal from './DepositModal';
import { trackPixelEvent } from '../utils/analytics';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [balance, setBalance] = useState<number | null>(null);
  const [payCode, setPayCode] = useState<string>('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(100000);
  const prevBalanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
  }, [user]);

  useEffect(() => {
    if (showDepositModal) {
      trackPixelEvent('InitiateCheckout');
    }
  }, [showDepositModal]);

  const fetchBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance, pay_code')
        .eq('user_id', user?.id)
        .single();
      
      if (error) throw error;
      
      if (prevBalanceRef.current !== null && data.balance > prevBalanceRef.current) {
        const amountAdded = data.balance - prevBalanceRef.current;
        if (amountAdded >= 50000) {
          trackPixelEvent('Purchase', { currency: 'VND', value: amountAdded });
        }
      }
      prevBalanceRef.current = data.balance;
      
      setBalance(data.balance);
      setPayCode(data.pay_code);
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItemClass = (path: string, colorClass: string) => {
    if (isActive(path)) {
      return `flex items-center gap-3 font-bold text-[#2d2218] bg-[#fff9eb] px-4 py-3 rounded-xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] transition-all`;
    }
    return `flex items-center gap-3 font-bold ${colorClass} hover:text-[#2d2218] px-4 py-3 rounded-xl border-2 border-transparent hover:bg-[#e8f1f2] transition-colors`;
  };

  return (
    <div className="flex min-h-screen bg-[#f3efe8] font-sans selection:bg-[#a2d5c6] selection:text-[#2d2218]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-white flex-col border-r-[3px] border-[#2d2218] fixed h-screen z-40">
        <div className="p-6 border-b-[3px] border-[#2d2218] bg-[#fdf9f1]">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="text-4xl group-hover:scale-110 transition-transform">🎬</span>
            <span className="text-xl font-black text-[#2d2218] tracking-tight">TaiVideoNhanh</span>
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          <Link to="/dashboard" className={navItemClass('/dashboard', 'text-[#2d2218]')}>
            <span className="text-xl">✨</span> Lồng Tiếng Mới
          </Link>
          <Link to="/review-video" className={navItemClass('/review-video', 'text-[#2d2218]')}>
            <span className="text-xl">🎵</span> Review Video AI
          </Link>
          <Link to="/voice-library" className={navItemClass('/voice-library', 'text-[#2d2218]')}>
            <span className="text-xl">📚</span> Thư viện giọng nói
          </Link>
          <Link to="/videos" className={navItemClass('/videos', 'text-[#6b5a4b]')}>
            <span className="text-xl">📁</span> Video Của Tôi
          </Link>
          <Link to="/affiliate" className={navItemClass('/affiliate', 'text-[#f5a623]')}>
            <span className="text-xl">🤝</span> Tiếp Thị (20%)
          </Link>
          <Link to="/academy" className={navItemClass('/academy', 'text-[#e65c4f]')}>
            <span className="text-xl">🎓</span> Khóa Học Miễn Phí
          </Link>
          <Link to="/shopee-tool" className={navItemClass('/shopee-tool', 'text-[#6b5a4b]')}>
            <span className="text-xl">🛒</span> Convert Shopee Link
          </Link>
          <Link to="/social-dashboard" className={navItemClass('/social-dashboard', 'text-[#1877F2]')}>
            <span className="text-xl">📘</span> Kết Nối Fanpage FB
          </Link>
          {role === 'admin' && (
            <>
              <div className="pt-4 border-t-2 border-dashed border-[#e5dcd3]"></div>
              <Link to="/admin" className={navItemClass('/admin', 'text-[#e65c4f]')}>
                <span className="text-xl">👑</span> Quản Trị Viên
              </Link>
              <Link to="/write" className={navItemClass('/write', 'text-[#6b5a4b]')}>
                <span className="text-xl">📝</span> Viết Blog SEO
              </Link>
            </>
          )}
          <a href="#" onClick={(e) => { e.preventDefault(); setShowDepositModal(true); }} className="flex items-center gap-3 font-bold text-[#6b5a4b] hover:text-[#2d2218] px-4 py-3 rounded-xl border-2 border-transparent hover:bg-[#e8f1f2] transition-colors">
            <span className="text-xl">💳</span> Nạp Tiền
          </a>
        </nav>
        
        <div className="p-6 border-t-[3px] border-[#2d2218] bg-[#fdf9f1]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#f6a287] border-2 border-[#2d2218] flex items-center justify-center font-bold text-[#2d2218]">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden text-ellipsis whitespace-nowrap">
              <p className="font-bold text-[#2d2218] text-sm">{user?.email}</p>
            </div>
          </div>
          
          <div className="bg-white border-2 border-[#2d2218] rounded-xl p-3 mb-4 shadow-[2px_2px_0px_#2d2218]">
            <p className="text-xs font-bold text-[#8b7a6b] mb-1">SỐ DƯ HIỆN TẠI</p>
            <p className="font-black text-[#2d2218] text-lg">
              {balance !== null ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(balance) : '...'}
            </p>
          </div>
          
          <button 
            onClick={handleSignOut}
            className="w-full font-bold text-[#2d2218] border-2 border-[#2d2218] px-4 py-2 rounded-xl hover:bg-[#ffcccb] transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-72">
        {/* Topbar - Mobile only */}
        <div className="md:hidden bg-white border-b-[3px] border-[#2d2218] px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <span className="font-extrabold text-base text-[#2d2218]">TaiVideoNhanh</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="bg-[#fdf9f1] px-3 py-1 rounded-full border-2 border-[#2d2218] flex items-center">
              <span className="text-xs text-[#6b5a4b] font-bold mr-1">💰</span>
              <span className="font-black text-[#2d2218] text-xs">
                {balance !== null ? new Intl.NumberFormat('vi-VN').format(balance) + 'đ' : '...'}
              </span>
            </div>
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="font-extrabold text-[#2d2218] bg-[#a2d5c6] px-3 py-1.5 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] transition-all flex items-center gap-1 text-sm cursor-pointer"
            >
              {showMobileMenu ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Out Drawer */}
        {showMobileMenu && (
          <div className="fixed inset-0 bg-[#2d2218]/60 backdrop-blur-sm z-50 md:hidden flex justify-end animate-in fade-in duration-200">
            <div className="w-4/5 max-w-xs bg-[#fdf9f1] h-full border-l-[3px] border-[#2d2218] p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
              <div>
                <div className="flex items-center justify-between border-b-2 border-[#2d2218] pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎬</span>
                    <span className="font-black text-lg text-[#2d2218]">TaiVideoNhanh</span>
                  </div>
                  <button onClick={() => setShowMobileMenu(false)} className="w-8 h-8 rounded-lg bg-white border-2 border-[#2d2218] flex items-center justify-center font-bold text-sm">
                    ✕
                  </button>
                </div>

                <div className="bg-white border-2 border-[#2d2218] rounded-xl p-3 mb-6 shadow-[2px_2px_0px_#2d2218]">
                  <p className="text-xs font-bold text-[#8b7a6b] mb-1">TÀI KHOẢN</p>
                  <p className="font-bold text-[#2d2218] text-sm truncate mb-2">{user?.email}</p>
                  <div className="bg-[#fdf9f1] border border-[#2d2218] rounded-lg p-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-[#6b5a4b]">Số dư ví:</span>
                    <span className="font-black text-[#2d2218]">
                      {balance !== null ? new Intl.NumberFormat('vi-VN').format(balance) + 'đ' : '...'}
                    </span>
                  </div>
                </div>

                <nav className="space-y-3">
                  <Link to="/dashboard" onClick={() => setShowMobileMenu(false)} className={navItemClass('/dashboard', 'text-[#2d2218]')}>
                    <span className="text-xl">✨</span> Lồng Tiếng Mới
                  </Link>
                  <Link to="/review-video" onClick={() => setShowMobileMenu(false)} className={navItemClass('/review-video', 'text-[#2d2218]')}>
                    <span className="text-xl">🎵</span> Review Video AI
                  </Link>
                  <Link to="/voice-library" onClick={() => setShowMobileMenu(false)} className={navItemClass('/voice-library', 'text-[#2d2218]')}>
                    <span className="text-xl">📚</span> Thư viện giọng nói
                  </Link>
                  <Link to="/videos" onClick={() => setShowMobileMenu(false)} className={navItemClass('/videos', 'text-[#6b5a4b]')}>
                    <span className="text-xl">📁</span> Video Của Tôi
                  </Link>
                  <Link to="/affiliate" onClick={() => setShowMobileMenu(false)} className={navItemClass('/affiliate', 'text-[#f5a623]')}>
                    <span className="text-xl">🤝</span> Tiếp Thị (20%)
                  </Link>
                  <Link to="/academy" onClick={() => setShowMobileMenu(false)} className={navItemClass('/academy', 'text-[#e65c4f]')}>
                    <span className="text-xl">🎓</span> Khóa Học Miễn Phí
                  </Link>
                  <Link to="/shopee-tool" onClick={() => setShowMobileMenu(false)} className={navItemClass('/shopee-tool', 'text-[#6b5a4b]')}>
                    <span className="text-xl">🛒</span> Convert Shopee Link
                  </Link>
                  <Link to="/social-dashboard" onClick={() => setShowMobileMenu(false)} className={navItemClass('/social-dashboard', 'text-[#1877F2]')}>
                    <span className="text-xl">📘</span> Kết Nối Fanpage FB
                  </Link>
                  {role === 'admin' && (
                    <>
                      <div className="border-t-2 border-dashed border-[#e5dcd3] my-2"></div>
                      <Link to="/admin" onClick={() => setShowMobileMenu(false)} className={navItemClass('/admin', 'text-[#e65c4f]')}>
                        <span className="text-xl">👑</span> Quản Trị Viên
                      </Link>
                    </>
                  )}
                  <a href="#" onClick={(e) => { e.preventDefault(); setShowMobileMenu(false); setShowDepositModal(true); }} className="flex items-center gap-3 text-[#6b5a4b] font-bold px-4 py-3 rounded-xl border-2 border-transparent hover:bg-white">
                    <span className="text-xl">💳</span> Nạp Tiền
                  </a>
                </nav>
              </div>
              <button 
                onClick={handleSignOut}
                className="w-full mt-6 font-bold text-[#2d2218] border-2 border-[#2d2218] px-4 py-3 rounded-xl hover:bg-[#ffcccb] transition-colors"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-10 relative">
          {children}
        </main>
      </div>

      {showDepositModal && (
        <DepositModal 
          show={showDepositModal}
          onClose={() => {
            setShowDepositModal(false);
            fetchBalance();
          }} 
          payCode={payCode}
          depositAmount={depositAmount}
          setDepositAmount={setDepositAmount}
          trackPixelEvent={trackPixelEvent}
        />
      )}
    </div>
  );
}
