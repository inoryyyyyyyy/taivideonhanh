import API_BASE from '../api';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';

interface Lesson {
  id: string;
  title: string;
  duration: string;
  is_vip: boolean;
  is_locked: boolean;
  video_url: string | null;
  summary: string;
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  badge: string;
  is_vip_only: boolean;
  lessons: Lesson[];
}

interface Resource {
  id: string;
  title: string;
  type: string;
  size: string;
  url: string;
  description: string;
}

export default function Academy() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [courses, setCourses] = useState<CourseModule[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [showVipModal, setShowVipModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [vipPrice, setVipPrice] = useState<number>(399000);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (user) {
          // Fetch balance
          const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
          if (wallet) setBalance(wallet.balance);
        }

        // Fetch courses
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/api/academy/courses`, { headers });
        const data = await res.json();
        
        if (res.ok) {
          setIsVip(data.is_vip);
          setCourses(data.courses || []);
          setResources(data.resources || []);
          if (data.vip_price) setVipPrice(data.vip_price);
        }
      } catch (err) {
        console.error("Fetch Academy Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  const handleLessonSelect = (les: Lesson) => {
    if (les.is_locked) {
      setShowVipModal(true);
    } else {
      setActiveLesson(les);
    }
  };

  const handleUpgradeVip = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (balance < vipPrice) {
      setMsg({
        type: 'error',
        text: `Số dư ví không đủ ${vipPrice.toLocaleString('vi-VN')}đ (Hiện có ${balance.toLocaleString('vi-VN')}đ). Vui lòng nạp thêm tiền!`
      });
      return;
    }

    setUpgrading(true);
    setMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_BASE}/api/upgrade-vip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setIsVip(true);
        setBalance(prev => prev - vipPrice);
        setShowVipModal(false);
        setMsg({ type: 'success', text: data.message });
        // Refresh courses to unlock
        const refreshRes = await fetch(`${API_BASE}/api/academy/courses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok) {
          setCourses(refreshData.courses || []);
          setResources(refreshData.resources || []);
        }
      } else {
        setMsg({ type: 'error', text: data.message || 'Nâng cấp VIP thất bại.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Có lỗi xảy ra, vui lòng thử lại.' });
    } finally {
      setUpgrading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f3efe8] font-sans selection:bg-[#ffcdc2] pb-24 md:pb-12">
      {/* Top Navbar */}
      <nav className="bg-[#fdf9f1] border-b-[3px] border-[#2d2218] px-4 md:px-8 py-3.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-black">🎥</span>
            <span className="font-black text-xl text-[#2d2218] tracking-tight">TaiVideoNhanh</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 font-bold text-[#6b5a4b] text-sm">
            <Link to="/dashboard" className="hover:text-[#2d2218] transition-colors">🎙️ Studio</Link>
            <Link to="/videos" className="hover:text-[#2d2218] transition-colors">📂 Video Của Tôi</Link>
            <Link to="/affiliate" className="hover:text-[#2d2218] transition-colors">🤝 Tiếp Thị (20%)</Link>
            <Link to="/academy" className="text-[#e65c4f] font-extrabold flex items-center gap-1">
              🎓 Khóa Học Miễn Phí {isVip ? '👑 VIP' : ''}
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-[#a2d5c6] text-[#2d2218] px-3 py-1.5 rounded-full border border-[#2d2218]">
                  💰 {balance.toLocaleString('vi-VN')}đ
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-xs font-bold text-[#6b5a4b] hover:text-[#e65c4f] px-2 py-1"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-[#f6a287] text-[#2d2218] font-bold text-xs px-4 py-2 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-8">

        {msg && (
          <div className={`mb-6 p-4 rounded-2xl border-3 border-[#2d2218] font-extrabold text-sm shadow-[4px_4px_0px_#2d2218] flex items-center justify-between ${
            msg.type === 'success' ? 'bg-[#a2d5c6] text-[#2d2218]' : 'bg-[#ffcdc2] text-[#2d2218]'
          }`}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} className="font-black text-lg px-2">✕</button>
          </div>
        )}

        {/* Hero Header Banner */}
        <div className="bg-[#a2d5c6] border-4 border-[#2d2218] rounded-3xl p-6 md:p-10 shadow-[8px_8px_0px_#2d2218] mb-8 relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[#2d2218] text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  🎓 HỌC VIỆN XÂY KÊNH & MMO
                </span>
                {isVip ? (
                  <span className="bg-[#ffcdc2] text-[#2d2218] text-xs font-black px-3 py-1 rounded-full border border-[#2d2218] flex items-center gap-1 shadow-[2px_2px_0px_#2d2218]">
                    👑 MEMBER VIP TRỌN ĐỜI
                  </span>
                ) : (
                  <span className="bg-white text-[#6b5a4b] text-xs font-bold px-3 py-1 rounded-full border border-[#2d2218]">
                    HỌC VIÊN MIỄN PHÍ
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#2d2218] leading-tight mb-2">
                Bí Quyết Xây Kênh Triệu Views & Chốt Đơn Affiliate
              </h1>
              <p className="text-sm md:text-base font-bold text-[#2d2218]/80 max-w-2xl">
                Khóa học thực chiến từ A-Z hướng dẫn bạn tìm nguồn video Trung Quốc hot trend, lồng tiếng AI tiếng Việt và ép thuật toán cắn xu hướng.
              </p>
            </div>

            {!isVip && (
              <button
                onClick={() => setShowVipModal(true)}
                className="w-full md:w-auto bg-[#e65c4f] hover:bg-[#d94f42] text-white font-black text-base px-7 py-4 rounded-2xl border-3 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all shrink-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>👑 Nâng Cấp VIP ({(vipPrice / 1000).toFixed(0)}K)</span>
              </button>
            )}
          </div>
        </div>

        {/* Video Player Modal/Section if a lesson is selected */}
        {activeLesson && (
          <div className="mb-10 bg-[#2d2218] text-white rounded-3xl p-6 border-4 border-[#2d2218] shadow-[8px_8px_0px_#6b5a4b]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-[#f6a287] text-[#2d2218] text-xs font-black px-3 py-1 rounded-full">
                  ĐANG PHÁT BÀI HỌC
                </span>
                <h3 className="font-black text-lg md:text-xl text-white">{activeLesson.title}</h3>
              </div>
              <button
                onClick={() => setActiveLesson(null)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                ✕ Đóng Player
              </button>
            </div>

            {activeLesson.video_url ? (
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black mb-4 border-2 border-white/20">
                <iframe
                  src={activeLesson.video_url}
                  title={activeLesson.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <div className="p-12 text-center bg-white/5 rounded-2xl mb-4 border-2 border-dashed border-white/20">
                <span className="text-4xl block mb-2">🔒</span>
                <p className="font-black text-lg text-white mb-2">Bài học này dành riêng cho Thành Viên VIP</p>
                <button
                  onClick={() => setShowVipModal(true)}
                  className="bg-[#f6a287] text-[#2d2218] font-black text-sm px-6 py-2.5 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]"
                >
                  Nâng Cấp VIP Để Xem Video
                </button>
              </div>
            )}

            <p className="text-sm text-white/80 font-medium leading-relaxed bg-white/10 p-4 rounded-xl">
              💡 <b>Tóm tắt bài học:</b> {activeLesson.summary}
            </p>
          </div>
        )}

        {/* Course Modules & Lessons List */}
        <div className="space-y-8 mb-12">
          <h2 className="text-xl md:text-2xl font-black text-[#2d2218] uppercase tracking-wide flex items-center gap-2">
            📚 Các Chương Khóa Học Masterclass
          </h2>

          {loading ? (
            <div className="text-center py-12 bg-white rounded-3xl border-3 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]">
              <div className="w-10 h-10 border-4 border-[#2d2218] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="font-extrabold text-[#2d2218]">Đang tải danh sách bài học...</p>
            </div>
          ) : (
            courses.map((module) => (
              <div
                key={module.id}
                className="bg-white border-4 border-[#2d2218] rounded-3xl p-6 md:p-8 shadow-[6px_6px_0px_#2d2218]"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-4 border-b-2 border-dashed border-[#e5dcd3]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#2d2218] uppercase ${
                        module.is_vip_only ? 'bg-[#e65c4f] text-white' : 'bg-[#a2d5c6] text-[#2d2218]'
                      }`}>
                        {module.badge}
                      </span>
                    </div>
                    <h3 className="text-lg md:text-xl font-black text-[#2d2218]">{module.title}</h3>
                  </div>
                  <p className="text-xs font-bold text-[#6b5a4b] max-w-sm">{module.description}</p>
                </div>

                <div className="space-y-3">
                  {module.lessons.map((les) => (
                    <div
                      key={les.id}
                      onClick={() => handleLessonSelect(les)}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        les.is_locked
                          ? 'bg-[#f8f5f0] border-[#e5dcd3] opacity-85 hover:border-[#e65c4f]'
                          : 'bg-[#fdf9f1] border-[#2d2218] hover:bg-[#fffcdc] shadow-[2px_2px_0px_#2d2218]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className={`w-9 h-9 rounded-xl border-2 border-[#2d2218] flex items-center justify-center font-black text-sm shrink-0 ${
                          les.is_locked ? 'bg-gray-200 text-gray-500' : 'bg-[#f6a287] text-[#2d2218]'
                        }`}>
                          {les.is_locked ? '🔒' : '▶'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm md:text-base text-[#2d2218] truncate">
                            {les.title}
                          </h4>
                          <p className="text-xs font-medium text-[#6b5a4b] truncate">{les.summary}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold text-[#6b5a4b] bg-white px-2.5 py-1 rounded-lg border border-[#2d2218]">
                          ⏱️ {les.duration}
                        </span>
                        {les.is_locked ? (
                          <span className="bg-[#e65c4f] text-white text-xs font-black px-3 py-1.5 rounded-xl border border-[#2d2218]">
                            Mở Khóa VIP
                          </span>
                        ) : (
                          <span className="bg-[#a2d5c6] text-[#2d2218] text-xs font-black px-3 py-1.5 rounded-xl border border-[#2d2218]">
                            Học Ngay
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Kho Tài Nguyên VIP */}
        <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 md:p-8 shadow-[6px_6px_0px_#2d2218] mb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <span className="bg-[#ffcdc2] text-[#2d2218] text-[10px] font-black px-3 py-1 rounded-full border border-[#2d2218] uppercase tracking-wider mb-1 inline-block shadow-[1px_1px_0px_#2d2218]">
                🎁 ĐẶC QUYỀN MEMBER VIP
              </span>
              <h3 className="text-xl font-black text-[#2d2218]">📥 Kho Tài Nguyên VIP Tải Về Hàng Tháng</h3>
            </div>
            {!isVip && (
              <span className="text-xs font-black bg-[#e65c4f] text-white px-3 py-1.5 rounded-xl border border-[#2d2218]">
                🔒 Cần Quyền VIP Để Tải
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isVip && resources.length > 0 ? (
              resources.map((res) => (
                <div key={res.id} className="bg-white border-2 border-[#2d2218] rounded-2xl p-5 shadow-[3px_3px_0px_#2d2218] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-black bg-[#a2d5c6] text-[#2d2218] px-2.5 py-0.5 rounded-md border border-[#2d2218]">
                        {res.type} ({res.size})
                      </span>
                    </div>
                    <h4 className="font-black text-[#2d2218] text-base mb-1">{res.title}</h4>
                    <p className="text-xs font-medium text-[#6b5a4b] mb-4">{res.description}</p>
                  </div>
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center bg-[#f6a287] hover:bg-[#f59173] text-[#2d2218] font-black text-sm py-2.5 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] transition-all block"
                  >
                    📥 Tải Tài Nguyên VIP Về Máy
                  </a>
                </div>
              ))
            ) : (
              <div className="col-span-full p-8 text-center bg-white border-2 border-dashed border-[#2d2218] rounded-2xl">
                <span className="text-3xl block mb-2">🔒</span>
                <h4 className="font-black text-[#2d2218] text-lg mb-1">Kho Tài Nguyên Dành Cho VIP</h4>
                <p className="text-xs text-[#6b5a4b] font-medium mb-4">Nâng cấp tài khoản VIP {(vipPrice / 1000).toFixed(0)}K để nhận Kho 500+ Video Mẫu Trung Quốc Hot Trend + Prompt ChatGPT kịch bản bán hàng.</p>
                <button
                  onClick={() => setShowVipModal(true)}
                  className="bg-[#e65c4f] text-white font-black text-sm px-6 py-2.5 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]"
                >
                  Nâng Cấp VIP Mở Khóa Tài Nguyên ➔
                </button>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Modal Nâng Cấp VIP */}
      {showVipModal && (
        <div className="fixed inset-0 bg-[#2d2218]/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-[8px_8px_0px_#2d2218] my-8 relative">
            <button
              onClick={() => setShowVipModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-white border-2 border-[#2d2218] rounded-full flex items-center justify-center font-black text-sm hover:bg-gray-100"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <span className="bg-[#ffcdc2] text-[#2d2218] text-xs font-black px-4 py-1.5 rounded-full border-2 border-[#2d2218] uppercase tracking-wider mb-3 inline-block shadow-[2px_2px_0px_#2d2218]">
                👑 NÂNG CẤP TÀI KHOẢN VIP HỌC VIỆN
              </span>
              <h3 className="text-2xl md:text-3xl font-black text-[#2d2218] mb-2">
                Học Xây Kênh Masterclass & Nhận Kho Tài Nguyên
              </h3>
              <div className="flex items-baseline justify-center gap-2 mt-3">
                <span className="text-3xl font-black text-[#e65c4f]">{vipPrice.toLocaleString('vi-VN')}đ</span>
                <span className="text-sm font-bold text-[#6b5a4b] line-through">999.000đ</span>
                <span className="bg-[#a2d5c6] text-[#2d2218] text-[10px] font-black px-2 py-0.5 rounded border border-[#2d2218]">
                  GIẢM 60% TRỌN ĐỜI
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6 bg-white p-4 rounded-2xl border-2 border-[#2d2218]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2d2218]">
                <span className="text-emerald-600 text-sm">✅</span>
                <span>Mở khóa toàn bộ 15+ Bài học Masterclass nâng cao</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#2d2218]">
                <span className="text-emerald-600 text-sm">✅</span>
                <span>Tải Kho 500+ Video Mẫu Trung Quốc chưa khai thác</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#2d2218]">
                <span className="text-emerald-600 text-sm">✅</span>
                <span>Bộ 100+ Prompt ChatGPT viết kịch bản chốt đơn</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#2d2218]">
                <span className="text-emerald-600 text-sm">✅</span>
                <span>Huy hiệu Member VIP Vàng ánh kim nổi bật</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#2d2218]">
                <span className="text-emerald-600 text-sm">✅</span>
                <span>Nhận ngay 20% hoa hồng (= 79.800đ) khi giới thiệu bạn bè nâng VIP</span>
              </div>
            </div>

            <div className="bg-[#f8f5f0] p-3 rounded-xl border border-[#2d2218] mb-6 flex justify-between items-center text-xs font-bold">
              <span className="text-[#6b5a4b]">Số dư ví hiện tại của bạn:</span>
              <span className="text-[#2d2218] font-black text-sm">{balance.toLocaleString('vi-VN')}đ</span>
            </div>

            {msg && (
              <div className={`mb-4 p-3 rounded-xl border-2 border-[#2d2218] font-extrabold text-xs ${
                msg.type === 'success' ? 'bg-[#a2d5c6] text-[#2d2218]' : 'bg-[#ffcdc2] text-[#2d2218]'
              }`}>
                {msg.text}
              </div>
            )}

            {balance >= vipPrice ? (
              <button
                onClick={handleUpgradeVip}
                disabled={upgrading}
                className="w-full bg-[#e65c4f] hover:bg-[#d94f42] text-white font-black text-base py-4 rounded-2xl border-3 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {upgrading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>🚀 Xác Nhận Trừ Ví {(vipPrice / 1000).toFixed(0)}K Nâng VIP Ngay</span>
                )}
              </button>
            ) : (
              <Link
                to="/dashboard"
                onClick={() => setShowVipModal(false)}
                className="w-full bg-[#f6a287] hover:bg-[#f59173] text-[#2d2218] font-black text-base py-4 rounded-2xl border-3 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 block text-center"
              >
                💳 Nạp Tiền Vào Ví Để Nâng VIP (Cần thêm {(vipPrice - balance).toLocaleString('vi-VN')}đ)
              </Link>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
