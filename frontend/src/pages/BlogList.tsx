import API_BASE from '../api';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function BlogList() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/blog`)
      .then(r => r.json())
      .then(data => { setPosts(data.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#e8f1f2] p-4 sm:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto bg-[#fdf9f1] min-h-[90vh] rounded-[3rem] shadow-sm overflow-hidden border border-[#e5dcd3]">
        
        {/* Navbar */}
        <header className="px-8 py-6 flex items-center justify-between border-b border-[#e5dcd3]">
          <Link to="/" className="flex items-center gap-3">
            <div className="text-3xl">🎬</div>
            <span className="font-bold text-2xl text-[#2d2218] tracking-tight">TaiVideoNhanh</span>
          </Link>
          <Link to="/login" className="text-sm font-bold text-[#2d2218] bg-[#f6a287] px-6 py-3 rounded-full border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[0px_0px_0px_#2d2218] transition-all">
            Đăng Nhập
          </Link>
        </header>

        <main className="px-6 sm:px-12 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#2d2218] mb-4">Blog & Chia Sẻ</h1>
            <p className="text-[#6b5a4b] font-medium text-lg max-w-2xl mx-auto">Hướng dẫn tải video, mẹo kiếm tiền Affiliate, và cách sử dụng AI lồng tiếng hiệu quả nhất.</p>
          </div>

          {loading ? (
            <div className="text-center text-[#6b5a4b] font-bold text-xl py-20">Đang tải bài viết...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-6">📝</div>
              <p className="text-[#6b5a4b] font-bold text-xl">Chưa có bài viết nào</p>
              <p className="text-[#a08f7f] font-medium mt-2">Các bài viết hướng dẫn sẽ sớm được cập nhật!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {posts.map((post: any) => (
                <Link key={post.id} to={`/blog/${post.slug}`} className="group bg-white rounded-3xl border-2 border-[#2d2218] shadow-[6px_6px_0px_#2d2218] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_#2d2218] transition-all overflow-hidden">
                  {post.cover_image && (
                    <div className="aspect-video overflow-hidden">
                      <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(post.tags || []).slice(0, 3).map((tag: string) => (
                        <span key={tag} className="px-3 py-1 bg-[#e8f1f2] border border-[#2d2218] rounded-full text-xs font-bold text-[#2d2218]">{tag}</span>
                      ))}
                    </div>
                    <h2 className="text-xl font-bold text-[#2d2218] mb-2 line-clamp-2 group-hover:text-[#f6a287] transition-colors">{post.title}</h2>
                    <p className="text-[#6b5a4b] font-medium text-sm line-clamp-3">{post.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-[#a08f7f] font-bold">
                      <span>{new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
                      <span>👁️ {post.views || 0} lượt xem</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
