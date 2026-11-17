import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import API_BASE from '../api';
import { format } from 'date-fns';

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  status: string;
  avatar_url?: string;
  external_id?: string;
}

interface SocialPost {
  id: string;
  status: string;
  caption: string;
  scheduled_at: string;
  social_accounts: string[];
  media?: { url: string }[];
  platform_posts?: {
    platform: string;
    status: string;
    platform_post_url?: string;
  }[];
}

export default function SocialDashboard() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [accountsRes, postsRes] = await Promise.all([
        fetch(`${API_BASE}/api/postforme/accounts`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch(`${API_BASE}/api/postforme/posts`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ]);

      const accountsData = await accountsRes.json();
      const postsData = await postsRes.json();

      if (accountsData.data) {
        setAccounts(accountsData.data);
      }
      
      if (postsData.data) {
        setPosts(postsData.data);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectFanpage = async () => {
    try {
      setConnecting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/postforme/auth-url`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ platform: 'facebook' })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Lỗi tạo link kết nối!");
      }
    } catch (e) {
      console.error(e);
      alert("Đã xảy ra lỗi hệ thống!");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Bạn có chắc chắn muốn ngắt kết nối Fanpage này?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/postforme/disconnect/${accountId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      if (res.ok) {
        fetchData();
      } else {
        alert("Lỗi ngắt kết nối!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'processed':
      case 'published':
        return <span className="px-2.5 py-1 text-xs font-bold bg-[#cce3d4] text-[#1e5631] rounded-full border border-[#1e5631]">Đã Đăng</span>;
      case 'scheduled':
        return <span className="px-2.5 py-1 text-xs font-bold bg-[#fff3cd] text-[#856404] rounded-full border border-[#856404]">Đã Lên Lịch</span>;
      case 'processing':
        return <span className="px-2.5 py-1 text-xs font-bold bg-[#cce5ff] text-[#004085] rounded-full border border-[#004085]">Đang Xử Lý</span>;
      case 'failed':
        return <span className="px-2.5 py-1 text-xs font-bold bg-[#f8d7da] text-[#721c24] rounded-full border border-[#721c24]">Lỗi</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold bg-gray-200 text-gray-800 rounded-full border border-gray-400">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center min-h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f6a287]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-[#2d2218] tracking-tight mb-2">
            Quản Lý Fanpage & Lịch Đăng 📆
          </h1>
          <p className="text-[#2d2218]/70 text-lg font-medium">Theo dõi lịch đăng bài tự động trên các nền tảng mạng xã hội</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột trái: Quản lý Fanpage */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#fff9f5] rounded-[2rem] p-6 lg:p-8 border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#2d2218]">Fanpage Của Bạn</h2>
            </div>
            
            <div className="space-y-4">
              {accounts.length === 0 ? (
                <div className="text-center p-6 border-2 border-dashed border-[#2d2218]/20 rounded-2xl">
                  <p className="text-[#2d2218]/60 font-medium mb-4">Chưa có Fanpage nào được kết nối.</p>
                </div>
              ) : (
                accounts.map(acc => (
                  <div key={acc.id} className="bg-white rounded-2xl p-4 flex items-center justify-between border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                        {acc.avatar_url ? (
                          <img src={acc.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#1877F2] font-bold text-xl">FB</div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-[#2d2218] line-clamp-1">{acc.username || acc.platform}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`w-2 h-2 rounded-full ${acc.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <span className="text-xs font-medium text-gray-500 capitalize">{acc.status}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDisconnect(acc.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="Ngắt kết nối"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}

              <button 
                onClick={handleConnectFanpage}
                disabled={connecting}
                className="w-full mt-4 flex justify-center items-center gap-2 bg-[#1877F2] text-white font-bold py-3.5 px-4 rounded-xl hover:bg-[#166fe5] border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all disabled:opacity-70"
              >
                {connecting ? 'Đang tạo link...' : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Kết Nối Fanpage Facebook
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Cột phải: Lịch sử đăng bài */}
        <div className="lg:col-span-2">
          <div className="bg-[#fff9f5] rounded-[2rem] p-6 lg:p-8 border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218]">
            <h2 className="text-2xl font-bold text-[#2d2218] mb-6">Lịch Sử & Bài Đăng Chờ</h2>
            
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-[#2d2218]/20 rounded-3xl">
                  <p className="text-[#2d2218]/60 font-medium text-lg">Chưa có bài đăng nào.</p>
                  <p className="text-[#2d2218]/50 mt-2">Bài đăng sẽ xuất hiện ở đây khi bạn đặt lịch tạo video kèm tính năng tự động đăng Fanpage.</p>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="bg-white rounded-2xl p-5 border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] flex flex-col sm:flex-row gap-5">
                    {/* Media Preview */}
                    <div className="w-full sm:w-32 h-32 bg-gray-100 rounded-xl overflow-hidden border-2 border-[#2d2218] flex-shrink-0 relative">
                      {post.media && post.media.length > 0 ? (
                        <video src={post.media[0].url} className="w-full h-full object-cover" muted />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Post Details */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <p className="text-[#2d2218] font-medium line-clamp-2">{post.caption || '(Không có nội dung)'}</p>
                        {getStatusBadge(post.status)}
                      </div>
                      
                      <div className="mt-auto space-y-2">
                        <div className="flex items-center text-sm font-medium text-[#2d2218]/60 gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{post.scheduled_at ? format(new Date(post.scheduled_at), 'HH:mm - dd/MM/yyyy') : 'Ngay lập tức'}</span>
                        </div>
                        
                        {post.platform_posts && post.platform_posts.length > 0 && post.platform_posts[0].platform_post_url && (
                          <a 
                            href={post.platform_posts[0].platform_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-bold text-[#1877F2] hover:underline"
                          >
                            Xem bài trên FB
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
