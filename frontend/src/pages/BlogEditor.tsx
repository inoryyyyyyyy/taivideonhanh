import API_BASE from '../api';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function BlogEditor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // post id

  const [form, setForm] = useState({
    title: '',
    slug: '',
    content: '',
    description: '',
    cover_image: '',
    tags: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchPosts();
  }, [user, navigate]);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/my-posts`, {
        headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTitleChange = (val: string) => {
    // Tự động tạo slug từ title
    const slug = val.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
    setForm(f => ({ ...f, title: val, slug: (editing ? f.slug : slug) }));
  };

  const handleSave = async (isPublished: boolean) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const payload = {
        title: form.title,
        slug: form.slug,
        content: form.content,
        description: form.description,
        cover_image: form.cover_image,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        is_published: isPublished
      };

      const url = editing ? `${API_BASE}/api/blog/${editing}` : `${API_BASE}/api/blog`;
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());
      alert(editing ? 'Đã cập nhật bài viết' : 'Đã tạo bài viết');
      resetForm();
      fetchPosts();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bài này?')) return;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      await fetch(`${API_BASE}/api/blog/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchPosts();
    } catch (e) {
      alert('Lỗi khi xóa');
    }
  };

  const handleEdit = (p: any) => {
    setEditing(p.id);
    setForm({
      title: p.title,
      slug: p.slug,
      content: p.content,
      description: p.description || '',
      cover_image: p.cover_image || '',
      tags: (p.tags || []).join(', ')
    });
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ title: '', slug: '', content: '', description: '', cover_image: '', tags: '' });
  };

  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      alert('Vui lòng nhập chủ đề bài viết cần viết!');
      return;
    }
    setIsGeneratingAI(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${API_BASE}/api/generate_seo_post`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic: aiTopic })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lỗi tạo bài');
      
      const art = data.article;
      setForm({
        title: art.title || aiTopic,
        slug: art.slug || aiTopic.toLowerCase().replace(/\s+/g, '-'),
        content: art.content || '',
        description: art.description || '',
        cover_image: art.cover_image || '',
        tags: Array.isArray(art.tags) ? art.tags.join(', ') : (art.tags || '')
      });
      alert('🎉 AI đã viết xong bài chuẩn SEO 1500+ từ! Bạn kiểm tra lại và bấm Lưu Bài nhé.');
    } catch (e: any) {
      alert('Lỗi khi AI viết bài: ' + e.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8f1f2] p-4 sm:p-8 font-sans">
      <div className="max-w-[1200px] mx-auto bg-[#fdf9f1] rounded-[3rem] shadow-sm overflow-hidden border border-[#e5dcd3]">
        
        <header className="px-8 py-6 flex items-center justify-between border-b border-[#e5dcd3]">
          <div className="flex items-center gap-2">
            <div className="text-2xl">✍️</div>
            <span className="font-bold text-xl text-[#2d2218]">Quản Lý Blog</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/blog" className="text-sm font-bold text-[#4a3b2c] hover:text-[#f6a287]">Xem Blog</Link>
            <Link to="/dashboard" className="text-sm font-bold text-[#4a3b2c] hover:text-[#f6a287]">Dashboard</Link>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row">
          {/* Editor */}
          <div className="flex-1 p-6 sm:p-10">
            <h2 className="text-3xl font-extrabold text-[#2d2218] mb-6">{editing ? '✏️ Sửa Bài Viết' : '📝 Viết Bài Mới'}</h2>
            
            {/* PANEL AI TỰ ĐỘNG VIẾT BÀI chuẩn SEO */}
            <div className="mb-8 p-5 bg-[#a2d5c6]/30 border-2 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🤖</span>
                <h3 className="font-black text-[#2d2218] text-base">Tự Động Viết Bài SEO 1500+ Từ Bằng AI</h3>
              </div>
              <p className="text-xs text-[#4a3b2c] mb-3">
                Nhập chủ đề bài viết (Ví dụ: <i>Cách làm Affiliate Shopee hiệu quả 2026</i>), AI sẽ tự động tạo bài viết chuyên sâu, chuẩn SEO Google kèm tiêu đề, mô tả và cấu trúc H2/H3 cuốn hút!
              </p>
              <div className="flex gap-2 flex-col sm:flex-row">
                <input 
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="Nhập chủ đề bài viết... (VD: Cách làm Affiliate Shopee hiệu quả 2026)"
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-[#2d2218] rounded-xl text-sm font-bold outline-none"
                />
                <button
                  onClick={handleGenerateAI}
                  disabled={isGeneratingAI}
                  className="px-5 py-2.5 bg-[#f6a287] text-[#2d2218] font-black rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] text-sm shrink-0 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isGeneratingAI ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#2d2218] border-t-transparent rounded-full animate-spin"></div>
                      AI Đang Viết...
                    </>
                  ) : (
                    '✨ Viết Bài Bằng AI (1-Click)'
                  )}
                </button>
              </div>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Tiêu đề bài viết</label>
                <input value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="VD: Cách tải video Xiaohongshu không logo 2026"
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium text-[#2d2218] shadow-[2px_2px_0px_#2d2218] focus:shadow-none focus:translate-y-[2px] transition-all outline-none" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Slug (URL)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#6b5a4b] font-medium">/blog/</span>
                  <input value={form.slug} onChange={e => setForm(f => ({...f, slug: e.target.value}))}
                    className="flex-1 px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium text-[#2d2218] shadow-[2px_2px_0px_#2d2218] focus:shadow-none focus:translate-y-[2px] transition-all outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Mô tả ngắn (SEO Description)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} placeholder="Mô tả ngắn gọn cho Google hiển thị..."
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium text-[#2d2218] shadow-[2px_2px_0px_#2d2218] focus:shadow-none focus:translate-y-[2px] transition-all outline-none resize-none" />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Tags (phân cách bằng dấu phẩy)</label>
                <input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} placeholder="xiaohongshu, tải video, rednote, tiktok"
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium text-[#2d2218] shadow-[2px_2px_0px_#2d2218] focus:shadow-none focus:translate-y-[2px] transition-all outline-none" />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Ảnh bìa (URL)</label>
                <input value={form.cover_image} onChange={e => setForm(f => ({...f, cover_image: e.target.value}))} placeholder="https://..."
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium text-[#2d2218] shadow-[2px_2px_0px_#2d2218] focus:shadow-none focus:translate-y-[2px] transition-all outline-none" />
                {form.cover_image && (
                  <div className="mt-3">
                    <img src={form.cover_image} alt="Cover Preview" className="w-full max-w-sm rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]" onError={(e: any) => e.target.style.display = 'none'} onLoad={(e: any) => e.target.style.display = 'block'} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Nội dung (HTML)</label>
                <textarea value={form.content} onChange={e => setForm(f => ({...f, content: e.target.value}))} rows={15}
                  placeholder="<h2>Hướng dẫn tải video Xiaohongshu</h2><p>Bước 1: ...</p>"
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium text-[#2d2218] font-mono text-sm shadow-[2px_2px_0px_#2d2218] focus:shadow-none focus:translate-y-[2px] transition-all outline-none resize-y" />
              </div>

              <div className="flex flex-wrap gap-3 pt-4">
                <button onClick={() => handleSave(false)} className="bg-white border-2 border-[#2d2218] px-6 py-3 rounded-xl font-bold text-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all">
                  💾 Lưu Nháp
                </button>
                <button onClick={() => handleSave(true)} className="bg-[#a2d5c6] border-2 border-[#2d2218] px-6 py-3 rounded-xl font-bold text-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all">
                  🚀 Xuất Bản
                </button>
                {editing && (
                  <button onClick={resetForm} className="bg-[#e9ded3] border-2 border-[#2d2218] px-6 py-3 rounded-xl font-bold text-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all">
                    ✖ Hủy
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Post List Sidebar */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[#e5dcd3] p-6 bg-white/50">
            <h3 className="text-xl font-extrabold text-[#2d2218] mb-6">Bài Viết Của Tôi</h3>
            {posts.length === 0 ? (
              <p className="text-[#a08f7f] font-medium text-sm">Chưa có bài viết nào</p>
            ) : (
              <div className="space-y-3">
                {posts.map((p: any) => (
                  <div key={p.id} className="bg-white rounded-xl border-2 border-[#2d2218] p-4 shadow-[2px_2px_0px_#2d2218]">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-[#2d2218] text-sm line-clamp-2">{p.title}</h4>
                      <span className={`shrink-0 text-[8px] font-black px-2 py-1 rounded-full border border-[#2d2218] ${p.is_published ? 'bg-[#a2d5c6]' : 'bg-[#e9ded3]'}`}>
                        {p.is_published ? 'LIVE' : 'NHÁP'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(p)} className="text-xs font-bold text-[#f6a287] hover:underline">Sửa</button>
                      <button onClick={() => handleDelete(p.id)} className="text-xs font-bold text-red-400 hover:underline">Xóa</button>
                      {p.is_published && <Link to={`/blog/${p.slug}`} className="text-xs font-bold text-[#a2d5c6] hover:underline">Xem</Link>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
