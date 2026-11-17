import API_BASE from '../api';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';

export default function Affiliate() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    pay_code: number;
    ref_code: string;
    ref_link: string;
    balance: number;
    total_referees: number;
    total_earned: number;
    history: Array<{
      id: string;
      created_at: string;
      amount: number;
      description: string;
    }>;
  } | null>(null);
  
  const [copied, setCopied] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankOwner, setBankOwner] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState('');

  const fetchAffiliateStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`${API_BASE}/api/affiliate/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setStats(data);
      }
    } catch (err) {
      console.error("Fetch Affiliate Stats Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_BASE}/api/affiliate/withdrawals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setWithdrawals(data.withdrawals || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!user) return;
    fetchAffiliateStats();
    fetchWithdrawals();
  }, [user]);

  const handleCopyLink = () => {
    if (!stats?.ref_link) return;
    navigator.clipboard.writeText(stats.ref_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseInt(withdrawAmount) < 500000) {
      setWithdrawMsg('Số tiền rút tối thiểu là 500,000đ');
      return;
    }
    if (!bankName || !bankAccount || !bankOwner) {
      setWithdrawMsg('Vui lòng nhập đầy đủ thông tin ngân hàng');
      return;
    }
    setWithdrawing(true);
    setWithdrawMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/affiliate/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          amount: parseInt(withdrawAmount),
          bank_name: bankName,
          bank_account: bankAccount,
          bank_owner: bankOwner
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setWithdrawMsg('SUCCESS');
        setShowWithdrawForm(false);
        setWithdrawAmount(''); setBankName(''); setBankAccount(''); setBankOwner('');
        fetchAffiliateStats();
        fetchWithdrawals();
      } else {
        setWithdrawMsg(data.message || 'Có lỗi xảy ra');
      }
    } catch (err) {
      setWithdrawMsg('Lỗi kết nối');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f3efe8] font-sans selection:bg-[#ffcdc2] pb-24 md:pb-12">
        {/* Navigation */}
        <div className="p-4 sm:p-6">
          <nav className="flex items-center justify-between max-w-7xl mx-auto bg-white/80 backdrop-blur-md rounded-full px-6 py-4 border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-black">🎥</span>
              <span className="font-bold text-xl tracking-tight text-[#2d2218]">TaiVideoNhanh</span>
            </Link>
            <div className="hidden md:flex gap-8 font-semibold text-[#6b5a4b]">
              <Link to="/" className="hover:text-[#2d2218] transition-colors">Trang Chủ</Link>
              <Link to="/affiliate" className="text-[#e65c4f] font-bold">🤝 Tiếp Thị (20%)</Link>
              <Link to="/blog" className="hover:text-[#2d2218] transition-colors">Blog</Link>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="hidden sm:block font-bold text-[#2d2218] hover:opacity-70">Đăng nhập</Link>
              <Link to="/login?mode=signup" className="bg-[#f6a287] text-[#2d2218] px-5 py-2 rounded-full font-bold border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[2px] transition-all">
                Đăng Ký Làm Đối Tác
              </Link>
            </div>
          </nav>
        </div>

        {/* Hero Section Tuyển Đối Tác */}
        <main className="max-w-5xl mx-auto px-4 md:px-6 pt-10 text-center">
          <div className="bg-[#a2d5c6] border-4 border-[#2d2218] rounded-3xl p-8 md:p-12 shadow-[8px_8px_0px_#2d2218] mb-12">
            <span className="bg-[#e65c4f] text-white text-xs font-black px-4 py-1.5 rounded-full border-2 border-[#2d2218] uppercase tracking-wider mb-6 inline-block shadow-[2px_2px_0px_#2d2218]">
              🎁 CHƯƠNG TRÌNH ĐỐI TÁC TIẾP THỊ LIÊN KẾT
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#2d2218] leading-tight mb-6">
              Kiếm Thu Nhập Thụ Động <br className="hidden sm:block"/>
              Cùng Hoa Hồng <span className="text-[#e65c4f] bg-white px-3 py-1 rounded-2xl border-3 border-[#2d2218] inline-block mt-2">20% Trọn Đời</span>
            </h1>
            <p className="text-base md:text-xl font-bold text-[#2d2218]/90 max-w-2xl mx-auto mb-8 leading-relaxed">
              Bạn có kênh TikTok, Facebook, Youtube hoặc nhóm MMO? Giới thiệu người dùng đến TaiVideoNhanh và nhận ngay 20% mỗi khi khách nạp tiền tự động 24/7.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login?mode=signup" className="bg-[#f6a287] text-[#2d2218] font-black text-lg px-8 py-4 rounded-full border-3 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all">
                🚀 Đăng Ký Nhận Link Giới Thiệu Ngay
              </Link>
              <Link to="/login" className="bg-white text-[#2d2218] font-bold text-lg px-8 py-4 rounded-full border-3 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] transition-all">
                🔑 Đã Có Tài Khoản? Đăng Nhập
              </Link>
            </div>
          </div>

          {/* 3 Bước Kiếm Tiền Dễ Dàng */}
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl font-black text-[#2d2218] uppercase mb-8">
              3 Bước Bắt Đầu Kiếm Tiền Thụ Động
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-6 shadow-[5px_5px_0px_#2d2218]">
                <div className="w-10 h-10 bg-[#f6a287] border-2 border-[#2d2218] rounded-full flex items-center justify-center font-black text-lg text-[#2d2218] mb-4">1</div>
                <h3 className="font-black text-lg text-[#2d2218] mb-2">Đăng Ký Tài Khoản</h3>
                <p className="text-sm font-medium text-[#6b5a4b] leading-relaxed">Tạo tài khoản miễn phí trong 10 giây. Hệ thống tự động cấp cho bạn 1 đường link tiếp thị chứa Mã Ref riêng.</p>
              </div>

              <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-6 shadow-[5px_5px_0px_#2d2218]">
                <div className="w-10 h-10 bg-[#a2d5c6] border-2 border-[#2d2218] rounded-full flex items-center justify-center font-black text-lg text-[#2d2218] mb-4">2</div>
                <h3 className="font-black text-lg text-[#2d2218] mb-2">Chia Sẻ Link Tiếp Thị</h3>
                <p className="text-sm font-medium text-[#6b5a4b] leading-relaxed">Đăng bài viết hoặc video chia sẻ mẹo làm video, cách tải video Trung Quốc không logo lên TikTok/FB/Zalo kèm link của bạn.</p>
              </div>

              <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-6 shadow-[5px_5px_0px_#2d2218]">
                <div className="w-10 h-10 bg-[#e65c4f] text-white border-2 border-[#2d2218] rounded-full flex items-center justify-center font-black text-lg mb-4">3</div>
                <h3 className="font-black text-lg text-[#2d2218] mb-2">Nhận Hoa Hồng Trọn Đời</h3>
                <p className="text-sm font-medium text-[#6b5a4b] leading-relaxed">Mỗi khi người dùng nạp tiền (100k, 300k, 500k), 20% tiền hoa hồng được cộng tự động vào ví của bạn trong 3 giây.</p>
              </div>
            </div>
          </div>

          {/* Quyền Lợi Đối Tác */}
          <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-8 shadow-[6px_6px_0px_#2d2218] text-left mb-12">
            <h3 className="text-xl font-black text-[#2d2218] uppercase mb-6 text-center">
              💡 Tại Sao Nên Chọn Tiếp Thị Cùng TaiVideoNhanh?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 bg-white p-4 rounded-xl border-2 border-[#2d2218]">
                <span className="text-xl">✅</span>
                <div>
                  <h4 className="font-black text-[#2d2218]">Tỷ lệ chuyển đổi siêu cao</h4>
                  <p className="text-xs text-[#6b5a4b] font-medium mt-0.5">Nhu cầu tải video không logo và lồng tiếng AI làm Affiliate TikTok/Reels tại VN cực kỳ bùng nổ.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-[#fdf9f1] p-4 rounded-xl border-2 border-[#2d2218]">
                <span className="text-xl">⚡</span>
                <div>
                  <h4 className="font-black text-[#2d2218]">Thanh toán tự động 24/7</h4>
                  <p className="text-xs text-[#6b5a4b] font-medium mt-0.5">Hệ thống SePay quét giao dịch và cộng tiền vào ví bạn tức thì không phải đợi duyệt thủ công.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-[#fdf9f1] p-4 rounded-xl border-2 border-[#2d2218]">
                <span className="text-xl">♾️</span>
                <div>
                  <h4 className="font-black text-[#2d2218]">Hoa hồng 20% Trọn Đời</h4>
                  <p className="text-xs text-[#6b5a4b] font-medium mt-0.5">Khách nạp lần 1, lần 2 hay lần 100 bạn đều nhận đủ 20% hoa hồng trên mỗi giao dịch.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-4 rounded-xl border-2 border-[#2d2218]">
                <span className="text-xl">🎁</span>
                <div>
                  <h4 className="font-black text-[#2d2218]">Tặng 10k Trải Nghiệm Khách Mới</h4>
                  <p className="text-xs text-[#6b5a4b] font-medium mt-0.5">Khách qua link của bạn được tặng ngay 10.000đ dùng thử giúp dễ chốt đơn hơn bao giờ hết.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#f6a287] border-4 border-[#2d2218] rounded-3xl p-8 text-center shadow-[6px_6px_0px_#2d2218]">
            <h3 className="text-2xl font-black text-[#2d2218] mb-2">Bắt Đầu Tạo Thu Nhập Thụ Động Ngay Hôm Nay!</h3>
            <p className="text-sm font-bold text-[#2d2218]/80 mb-6">Đăng ký tài khoản hoàn toàn miễn phí và nhận link tiếp thị riêng chỉ trong 10 giây.</p>
            <Link to="/login?mode=signup" className="inline-block bg-[#2d2218] text-white font-black text-lg px-8 py-4 rounded-full border-2 border-[#2d2218] shadow-[4px_4px_0px_#6b5a4b] hover:translate-y-[2px] transition-all">
              Tạo Tài Khoản Tiếp Thị Ngay ➔
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3efe8] font-sans selection:bg-[#ffcdc2] pb-24 md:pb-12">
      {/* Top Navbar */}
      <nav className="bg-[#fdf9f1] border-b-[3px] border-[#2d2218] px-4 md:px-8 py-3.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="text-2xl">🎥</span>
            <span className="font-black text-xl tracking-tight text-[#2d2218] uppercase">TaiVideoNhanh</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 font-bold text-sm text-[#6b5a4b]">
            <Link to="/dashboard" className="hover:text-[#2d2218] transition-colors">🎙️ Studio</Link>
            <Link to="/videos" className="hover:text-[#2d2218] transition-colors">📂 Video Của Tôi</Link>
            <Link to="/affiliate" className="text-[#e65c4f] font-black underline decoration-2 underline-offset-4">🤝 Tiếp Thị (20%)</Link>
            <Link to="/blog" className="hover:text-[#2d2218] transition-colors">📝 Blog</Link>
            {role === 'admin' && (
              <Link to="/admin" className="bg-[#f6a287] text-[#2d2218] px-3 py-1 rounded-lg border-2 border-[#2d2218]">Quản Trị</Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="bg-white border-2 border-[#2d2218] px-3.5 py-1.5 rounded-xl shadow-[2px_2px_0px_#2d2218] flex items-center gap-2">
              <span className="text-sm font-bold">💰 Ví:</span>
              <span className="font-black text-[#e65c4f] text-base">
                {stats ? new Intl.NumberFormat('vi-VN').format(stats.balance) + 'đ' : '...'}
              </span>
            </div>
            <button onClick={handleSignOut} className="font-bold text-xs text-[#8b7a6b] hover:text-[#2d2218]">Đăng xuất</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 md:px-6 pt-8">
        {/* Banner Tiếp Thị */}
        <div className="bg-[#a2d5c6] border-4 border-[#2d2218] rounded-3xl p-6 md:p-8 shadow-[8px_8px_0px_#2d2218] mb-8 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="bg-[#e65c4f] text-white text-xs font-black px-3 py-1 rounded-full border border-[#2d2218] uppercase tracking-wider mb-3 inline-block">
              🔥 CHƯƠNG TRÌNH DÀNH CHO CREATOR & AFFILIATE
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-[#2d2218] leading-tight mb-3">
              Nhận Ngay <span className="text-[#e65c4f] bg-white px-2 py-0.5 rounded-xl border-2 border-[#2d2218]">20% Hoa Hồng Trọn Đời</span>
            </h1>
            <p className="text-base font-bold text-[#2d2218]/90 leading-relaxed">
              Chia sẻ link giới thiệu cá nhân của bạn. Mỗi khi có người nạp tiền vào TaiVideoNhanh qua link của bạn, bạn sẽ nhận ngay 20% số tiền nạp tự động vào ví 24/7!
            </p>
          </div>
        </div>

        {/* Khối Copy Link Giới Thiệu */}
        <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 shadow-[6px_6px_0px_#2d2218] mb-8">
          <h3 className="text-sm font-black text-[#8b7a6b] uppercase tracking-wider mb-2">
            🔗 Link Tiếp Thị Liên Kết Riêng Của Bạn
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-white border-3 border-[#2d2218] rounded-2xl px-4 py-3 font-mono text-base font-bold text-[#2d2218] select-all flex items-center shadow-[2px_2px_0px_#2d2218] overflow-x-auto">
              {stats?.ref_link || 'Đang tải link giới thiệu...'}
            </div>
            <button
              onClick={handleCopyLink}
              disabled={!stats}
              className="bg-[#f6a287] hover:bg-[#f48f70] text-[#2d2218] font-black text-base px-6 py-3 rounded-2xl border-3 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              {copied ? '✅ Đã Sao Chép!' : '📋 Sao Chép Link'}
            </button>
          </div>
          {copied && (
            <p className="text-xs font-bold text-[#2e7d32] mt-2">
              🎉 Đã lưu link vào bộ nhớ tạm! Bác có thể dán link này lên Facebook, TikTok, Zalo để giới thiệu bạn bè.
            </p>
          )}
        </div>

        {/* 4 Thẻ Thống Kê */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Người giới thiệu */}
          <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-4 shadow-[4px_4px_0px_#2d2218]">
            <p className="text-xs font-bold text-[#8b7a6b] uppercase mb-1">👥 Đã Giới Thiệu</p>
            <p className="text-2xl md:text-3xl font-black text-[#2d2218]">
              {loading ? '...' : (stats?.total_referees || 0)} <span className="text-sm font-bold text-[#6b5a4b]">người</span>
            </p>
          </div>

          {/* Mức hoa hồng */}
          <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-4 shadow-[4px_4px_0px_#2d2218]">
            <p className="text-xs font-bold text-[#8b7a6b] uppercase mb-1">🎁 Mức Hoa Hồng</p>
            <p className="text-2xl md:text-3xl font-black text-[#e65c4f]">20% <span className="text-xs font-bold text-[#2d2218]">Trọn Đời</span></p>
          </div>

          {/* Tổng tiền kiếm được */}
          <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-4 shadow-[4px_4px_0px_#2d2218]">
            <p className="text-xs font-bold text-[#8b7a6b] uppercase mb-1">💰 Tổng Hoa Hồng</p>
            <p className="text-xl md:text-2xl font-black text-[#2e7d32]">
              {loading ? '...' : (new Intl.NumberFormat('vi-VN').format(stats?.total_earned || 0) + 'đ')}
            </p>
          </div>

          {/* Mã giới thiệu */}
          <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-4 shadow-[4px_4px_0px_#2d2218]">
            <p className="text-xs font-bold text-[#8b7a6b] uppercase mb-1">🏷️ Mã Giới Thiệu</p>
            <p className="text-xl md:text-2xl font-black text-[#2d2218] tracking-wider">
              {stats?.ref_code || '...'}
            </p>
          </div>
        </div>

        {/* Rút Tiền Hoa Hồng */}
        <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 shadow-[6px_6px_0px_#2d2218] mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h3 className="text-lg font-black text-[#2d2218] uppercase flex items-center gap-2">
              💸 Rút Tiền Hoa Hồng
            </h3>
            <button
              onClick={() => setShowWithdrawForm(!showWithdrawForm)}
              className="bg-[#f6a287] hover:bg-[#f48f70] text-[#2d2218] font-black text-sm px-4 py-2 rounded-xl border-3 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all"
            >
              Yêu Cầu Rút Tiền
            </button>
          </div>

          {withdrawals.filter(w => w.status === 'pending').length > 0 && (
            <div className="bg-yellow-100 text-yellow-800 text-sm font-bold border-2 border-yellow-400 rounded-xl p-3 mb-4 inline-block">
              ⚠️ Bạn đang có yêu cầu rút tiền đang chờ xử lý
            </div>
          )}

          {showWithdrawForm && (
            <div className="bg-white border-3 border-[#2d2218] rounded-2xl p-4 sm:p-6 shadow-[4px_4px_0px_#2d2218] mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-[#2d2218] mb-1">Ngân Hàng</label>
                  <select 
                    value={bankName} onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-[#f3efe8] border-2 border-[#2d2218] rounded-xl px-3 py-2 font-bold text-[#2d2218] focus:outline-none focus:ring-2 focus:ring-[#f6a287]"
                  >
                    <option value="">Chọn ngân hàng...</option>
                    {['Vietcombank', 'MB Bank', 'Techcombank', 'BIDV', 'Agribank', 'TPBank', 'VPBank', 'ACB', 'Sacombank', 'SHB', 'HDBank', 'SeABank', 'LienVietPostBank', 'OCB', 'MSB', 'VIB', 'Nam A Bank', 'Eximbank'].map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#2d2218] mb-1">Số Tài Khoản</label>
                  <input 
                    type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full bg-[#f3efe8] border-2 border-[#2d2218] rounded-xl px-3 py-2 font-bold text-[#2d2218] focus:outline-none focus:ring-2 focus:ring-[#f6a287]"
                    placeholder="Nhập số tài khoản"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#2d2218] mb-1">Tên Chủ Tài Khoản</label>
                  <input 
                    type="text" value={bankOwner} onChange={(e) => setBankOwner(e.target.value)}
                    className="w-full bg-[#f3efe8] border-2 border-[#2d2218] rounded-xl px-3 py-2 font-bold text-[#2d2218] focus:outline-none focus:ring-2 focus:ring-[#f6a287]"
                    placeholder="NGUYEN VAN A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#2d2218] mb-1">Số Tiền (VNĐ)</label>
                  <input 
                    type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-[#f3efe8] border-2 border-[#2d2218] rounded-xl px-3 py-2 font-bold text-[#2d2218] focus:outline-none focus:ring-2 focus:ring-[#f6a287]"
                    placeholder="Tối thiểu 500.000đ"
                  />
                </div>
              </div>
              
              {withdrawMsg && withdrawMsg !== 'SUCCESS' && (
                <p className="text-red-600 font-bold text-sm mb-4">{withdrawMsg}</p>
              )}
              {withdrawMsg === 'SUCCESS' && (
                <p className="text-green-600 font-bold text-sm mb-4">Gửi yêu cầu rút tiền thành công!</p>
              )}

              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="w-full sm:w-auto bg-[#a2d5c6] text-[#2d2218] font-black px-6 py-3 rounded-xl border-3 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all disabled:opacity-50"
              >
                {withdrawing ? 'Đang Xử Lý...' : 'Gửi Yêu Cầu'}
              </button>
            </div>
          )}
        </div>

        {/* Hướng Dẫn Kiếm Tiền 3 Bước */}
        <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 shadow-[6px_6px_0px_#2d2218] mb-8">
          <h3 className="text-lg font-black text-[#2d2218] uppercase mb-4 flex items-center gap-2">
            🚀 3 Bước Đơn Giản Để Kiếm Tiền Thu Thụ Động
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="bg-white border-2 border-[#2d2218] rounded-2xl p-4 shadow-[2px_2px_0px_#2d2218]">
              <div className="w-8 h-8 bg-[#f6a287] border-2 border-[#2d2218] rounded-full flex items-center justify-center font-black text-[#2d2218] mb-2">1</div>
              <h4 className="font-black text-[#2d2218] text-sm mb-1">Copy Link Giới Thiệu</h4>
              <p className="text-xs font-medium text-[#6b5a4b]">Nhấp nút "Sao Chép Link" ở trên để lấy đường dẫn tiếp thị cá nhân của bạn.</p>
            </div>

            <div className="bg-white border-2 border-[#2d2218] rounded-2xl p-4 shadow-[2px_2px_0px_#2d2218]">
              <div className="w-8 h-8 bg-[#a2d5c6] border-2 border-[#2d2218] rounded-full flex items-center justify-center font-black text-[#2d2218] mb-2">2</div>
              <h4 className="font-black text-[#2d2218] text-sm mb-1">Chia Sẻ Lên Mạng Xã Hội</h4>
              <p className="text-xs font-medium text-[#6b5a4b]">Viết bài hướng dẫn làm video hoặc đăng clip Review lên Group FB, TikTok, Youtube kèm link của bạn.</p>
            </div>

            <div className="bg-white border-2 border-[#2d2218] rounded-2xl p-4 shadow-[2px_2px_0px_#2d2218]">
              <div className="w-8 h-8 bg-[#e65c4f] text-white border-2 border-[#2d2218] rounded-full flex items-center justify-center font-black text-sm mb-2">3</div>
              <h4 className="font-black text-[#2d2218] text-sm mb-1">Nhận 20% Hoa Hồng Trọn Đời</h4>
              <p className="text-xs font-medium text-[#6b5a4b]">Mỗi khi tài khoản bạn giới thiệu nạp tiền (100k, 300k, 500k), 20% số tiền sẽ tự động được cộng vào ví của bạn.</p>
            </div>
          </div>
        </div>

        {/* Lịch Sử Nhận Hoa Hồng */}
        <div className="bg-white border-4 border-[#2d2218] rounded-3xl p-6 shadow-[6px_6px_0px_#2d2218]">
          <h3 className="text-lg font-black text-[#2d2218] uppercase mb-4 flex items-center gap-2">
            📋 Lịch Sử Nhận Hoa Hồng Tiếp Thị
          </h3>

          {loading ? (
            <p className="text-sm font-bold text-[#6b5a4b] text-center py-6">Đang tải lịch sử...</p>
          ) : stats?.history && stats.history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#2d2218] bg-[#fdf9f1] text-xs font-extrabold text-[#2d2218]">
                    <th className="p-3">THỜI GIAN</th>
                    <th className="p-3">NỘI DUNG GIAO DỊCH</th>
                    <th className="p-3 text-right">HOA HỒNG NHẬN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm font-medium">
                  {stats.history.map((item) => (
                    <tr key={item.id} className="hover:bg-[#fdf9f1]/50">
                      <td className="p-3 text-xs font-bold text-[#6b5a4b]">
                        {new Date(item.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-3 font-bold text-[#2d2218]">
                        {item.description}
                      </td>
                      <td className="p-3 text-right font-black text-[#2e7d32]">
                        +{new Intl.NumberFormat('vi-VN').format(item.amount)}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-[#fdf9f1] rounded-2xl border-2 border-dashed border-[#2d2218]">
              <span className="text-3xl block mb-2">🎁</span>
              <p className="text-sm font-bold text-[#2d2218] mb-1">Chưa có hoa hồng tiếp thị nào</p>
              <p className="text-xs font-medium text-[#6b5a4b] max-w-sm mx-auto">
                Hãy sao chép đường link giới thiệu ở trên và bắt đầu chia sẻ để nhận ngay 20% hoa hồng thụ động trọn đời!
              </p>
            </div>
          )}
        </div>

        {/* Lịch Sử Rút Tiền */}
        <div className="bg-white border-4 border-[#2d2218] rounded-3xl p-6 shadow-[6px_6px_0px_#2d2218] mt-8 mb-8">
          <h3 className="text-lg font-black text-[#2d2218] uppercase mb-4 flex items-center gap-2">
            💸 Lịch Sử Rút Tiền
          </h3>

          {loading ? (
            <p className="text-sm font-bold text-[#6b5a4b] text-center py-6">Đang tải lịch sử...</p>
          ) : withdrawals && withdrawals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#2d2218] bg-[#fdf9f1] text-xs font-extrabold text-[#2d2218]">
                    <th className="p-3">THỜI GIAN</th>
                    <th className="p-3">SỐ TIỀN</th>
                    <th className="p-3">NGÂN HÀNG</th>
                    <th className="p-3">TRẠNG THÁI</th>
                    <th className="p-3">GHI CHÚ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm font-medium">
                  {withdrawals.map((item) => (
                    <tr key={item.id} className="hover:bg-[#fdf9f1]/50">
                      <td className="p-3 text-xs font-bold text-[#6b5a4b]">
                        {new Date(item.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-3 font-black text-[#e65c4f]">
                        {new Intl.NumberFormat('vi-VN').format(item.amount)}đ
                      </td>
                      <td className="p-3 text-xs font-bold text-[#2d2218]">
                        {item.bank_name} - {item.bank_account}<br/>
                        {item.bank_owner}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                          item.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-400' :
                          item.status === 'approved' ? 'bg-green-100 text-green-800 border-green-400' :
                          'bg-red-100 text-red-800 border-red-400'
                        }`}>
                          {item.status === 'pending' ? 'Đang Xử Lý' :
                           item.status === 'approved' ? 'Thành Công' :
                           'Từ Chối'}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-medium text-[#6b5a4b]">
                        {item.admin_note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-[#fdf9f1] rounded-2xl border-2 border-dashed border-[#2d2218]">
              <span className="text-3xl block mb-2">💸</span>
              <p className="text-sm font-bold text-[#2d2218]">Chưa có yêu cầu rút tiền nào</p>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
