import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import API_BASE from '../api';
import { Link } from 'react-router-dom';

export default function MyVideos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Post Modal State
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [postForm, setPostForm] = useState({
    account_id: '',
    caption: '',
    scheduled_at: ''
  });
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  const fetchVideos = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API_BASE}/api/my-videos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.videos) {
        setVideos(data.videos);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPostModal = async (videoId: string) => {
    setSelectedVideoId(videoId);
    setShowPostModal(true);
    setPostForm({ account_id: '', caption: '', scheduled_at: '' });
    
    // Fetch accounts if not already fetched
    if (accounts.length === 0) {
      setLoadingAccounts(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_BASE}/api/postforme/accounts`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        if (data.data) {
          setAccounts(data.data.filter((a: any) => a.status === 'connected'));
          if (data.data.length > 0) {
            setPostForm(prev => ({ ...prev, account_id: data.data[0].id }));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingAccounts(false);
      }
    } else {
      if (accounts.length > 0) {
        setPostForm(prev => ({ ...prev, account_id: accounts[0].id }));
      }
    }
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.account_id) {
      alert("Vui lòng chọn Fanpage để đăng!");
      return;
    }
    if (!confirm("Hệ thống sẽ trừ 1.000đ từ ví của bạn để đăng bài này. Bạn có đồng ý?")) return;

    setIsPosting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/postforme/post-now`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_id: selectedVideoId,
          account_id: postForm.account_id,
          caption: postForm.caption,
          scheduled_at: postForm.scheduled_at ? new Date(postForm.scheduled_at).toISOString() : ""
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Thành công! " + data.message);
        setShowPostModal(false);
        // Force reload to update balance in layout
        window.location.reload();
      } else {
        alert("Lỗi: " + (data.detail || "Không thể lên lịch"));
      }
    } catch (e) {
      console.error(e);
      alert("Đã có lỗi hệ thống xảy ra");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-white border-[3px] border-[#2d2218] rounded-3xl p-6 sm:p-10 shadow-[8px_8px_0px_#2d2218] mb-8 relative">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b-[3px] border-[#2d2218]">
            <Link to="/dashboard" className="w-12 h-12 bg-[#e8f1f2] border-[3px] border-[#2d2218] rounded-xl flex items-center justify-center text-xl hover:bg-[#f6a287] hover:-translate-y-1 hover:shadow-[4px_4px_0px_#2d2218] transition-all">
              ⬅
            </Link>
            <h1 className="text-3xl font-black text-[#2d2218]">Video Của Tôi</h1>
          </div>

          <div className="bg-[#fff9c4] border-[3px] border-[#2d2218] rounded-xl p-4 mb-8">
            <p className="font-bold text-[#2d2218] flex items-start gap-2">
              <span className="text-xl">⚠️</span> Lưu ý: Hệ thống chỉ lưu trữ video trong vòng 3 ngày để tối ưu không gian. Vui lòng tải xuống sớm.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 border-[4px] border-[#2d2218] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="font-bold text-[#6b5a4b]">Đang tải danh sách video...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-10">
              <span className="text-4xl block mb-4">📭</span>
              <p className="font-bold text-[#6b5a4b] text-lg">Chưa có video nào.</p>
              <Link to="/dashboard" className="inline-block mt-4 text-[#f6a287] font-bold hover:underline">
                Đi lồng tiếng ngay!
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {videos.map((vid) => (
                <div key={vid.id} className="flex flex-col sm:flex-row items-center gap-4 p-4 sm:p-5 bg-[#fdf9f1] border-[3px] border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218] hover:translate-x-1 transition-transform">
                  {/* Thumbnail Ảnh Bìa */}
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl overflow-hidden border-[3px] border-[#2d2218] bg-[#e8f1f2] shrink-0 flex items-center justify-center">
                    {vid.cover_url ? (
                      <img 
                        src={vid.cover_url.replace(/^http:\/\//i, 'https://')} 
                        referrerPolicy="no-referrer"
                        alt="Thumbnail" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-3xl">🎬</span>
                    )}
                  </div>

                  {/* Thông tin Video */}
                  <div className="flex-1 min-w-0 text-center sm:text-left w-full">
                    <h3 className="font-black text-[#2d2218] text-base sm:text-lg line-clamp-2" title={vid.title}>
                      {vid.title || 'Video không tên'}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="text-xs font-bold text-[#6b5a4b] bg-white border-2 border-[#2d2218] px-2 py-1 rounded-md">
                        🕒 {new Date(vid.created_at).toLocaleString('vi-VN')}
                      </span>
                      <span className={`px-2 py-1 rounded-md border-2 border-[#2d2218] text-xs font-bold ${vid.status === 'done' ? 'bg-[#a2d5c6]' : 'bg-[#fff9c4]'}`}>
                        {vid.status === 'done' ? 'Đã Xong' : vid.status}
                      </span>
                    </div>
                  </div>

                  {/* Nút thao tác */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0 mt-3 sm:mt-0">
                    <a 
                      href={`${API_BASE}/api/download_video/${vid.id}`}
                      className="w-full text-center bg-[#a2d5c6] text-[#2d2218] px-5 py-2.5 rounded-xl font-bold border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218] transition-all text-sm"
                      download
                    >
                      📥 Tải Video
                    </a>
                    {vid.status === 'done' && (
                      <button 
                        onClick={() => handleOpenPostModal(vid.id)}
                        className="w-full text-center bg-[#1877F2] text-white px-5 py-2.5 rounded-xl font-bold border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218] transition-all text-sm flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Đăng Lên FB
                      </button>
                    )}
                    {vid.cover_url && (
                      <a 
                        href={vid.cover_url.replace(/^http:\/\//i, 'https://')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-center bg-white text-[#2d2218] px-5 py-1.5 rounded-xl font-bold border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218] transition-all text-xs"
                      >
                        🖼️ Xem Ảnh Bìa
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Post to FB Modal */}
        {showPostModal && (
          <div className="fixed inset-0 bg-[#2d2218]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#fdf9f1] w-full max-w-md border-[4px] border-[#2d2218] rounded-3xl p-6 shadow-[8px_8px_0px_#2d2218] animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-[#2d2218] flex items-center gap-2">
                  <span className="text-[#1877F2]">📘</span> Đăng Facebook
                </h2>
                <button 
                  onClick={() => setShowPostModal(false)}
                  className="w-8 h-8 rounded-lg bg-white border-2 border-[#2d2218] flex items-center justify-center font-bold text-sm hover:bg-red-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {loadingAccounts ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d2218]"></div>
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border-2 border-[#2d2218] border-dashed">
                  <p className="font-bold text-[#6b5a4b] mb-4">Bạn chưa kết nối Fanpage nào!</p>
                  <Link to="/social-dashboard" className="bg-[#1877F2] text-white px-5 py-2.5 rounded-xl font-bold border-2 border-[#2d2218] inline-block shadow-[2px_2px_0px_#2d2218]">
                    Đến trang Kết Nối
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmitPost} className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border-[3px] border-[#2d2218]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-[#2d2218]">Phí dịch vụ:</span>
                      <span className="font-black text-red-500 text-lg">1.000đ</span>
                    </div>
                    <p className="text-xs font-semibold text-gray-500">Đăng bài tự động lên Fanpage được tính phí 1.000đ/lần đăng.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#2d2218] mb-1">Chọn Fanpage <span className="text-red-500">*</span></label>
                    <select 
                      required
                      value={postForm.account_id}
                      onChange={e => setPostForm({...postForm, account_id: e.target.value})}
                      className="w-full px-4 py-3 bg-white border-[3px] border-[#2d2218] rounded-xl font-bold text-[#2d2218] focus:outline-none focus:border-[#f6a287]"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.username || acc.platform}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#2d2218] mb-1">Nội dung bài viết (Caption)</label>
                    <textarea 
                      value={postForm.caption}
                      onChange={e => setPostForm({...postForm, caption: e.target.value})}
                      placeholder="Nhập nội dung bài viết..."
                      rows={4}
                      className="w-full px-4 py-3 bg-white border-[3px] border-[#2d2218] rounded-xl font-semibold text-[#2d2218] focus:outline-none focus:border-[#f6a287] resize-none"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#2d2218] mb-1">Thời gian đăng (Tùy chọn hẹn giờ)</label>
                    <input 
                      type="datetime-local" 
                      value={postForm.scheduled_at}
                      onChange={e => setPostForm({...postForm, scheduled_at: e.target.value})}
                      className="w-full px-4 py-3 bg-white border-[3px] border-[#2d2218] rounded-xl font-bold text-[#2d2218] focus:outline-none focus:border-[#f6a287]"
                    />
                    <p className="text-xs font-semibold text-gray-500 mt-1">Để trống nếu muốn đăng ngay lập tức.</p>
                  </div>

                  <button 
                    type="submit"
                    disabled={isPosting}
                    className="w-full mt-4 bg-[#f6a287] text-[#2d2218] py-4 rounded-xl font-black text-lg border-[3px] border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPosting ? 'Đang xử lý...' : 'Thanh Toán 1.000đ & Đăng'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
