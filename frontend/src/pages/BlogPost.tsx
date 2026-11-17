import API_BASE from '../api';
import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

/** Detect if content is plain text (no HTML tags) and convert to HTML */
function textToHtml(content: string): string {
  if (!content) return '';
  // If already contains HTML block tags, return as-is
  if (/<(h[1-6]|p|div|ul|ol|li|table|blockquote|br\s*\/?)[\s>]/i.test(content)) {
    return content;
  }
  // Convert plain text to HTML
  const lines = content.split('\n');
  let html = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    // Headings: lines starting with roman numerals (I. II. III.) or all caps section titles
    if (/^[IVX]+\.\s/.test(line) || /^#{1,3}\s/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      line = line.replace(/^#{1,3}\s/, '');
      html += `<h2>${line}</h2>`;
      continue;
    }

    // Sub-headings: "Bước 1:", "Bước 2:", etc.
    if (/^Bước\s+\d+/i.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3>${line}</h3>`;
      continue;
    }

    // Lines with underscores only (separator)
    if (/^_{3,}$/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<hr/>';
      continue;
    }

    // List items: lines starting with ✅ 👉 ⚠️ • - ★ or similar
    if (/^[✅👉⚠️•\-★📌🔗💡🎯📢🔥⭐💰📊📱🏷️✔️❌⛔📝🛒]+\s/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${line}</li>`;
      continue;
    }

    // Bold pattern: text wrapped in ** or uppercase-only lines as strong
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Regular paragraph
    if (inList) { html += '</ul>'; inList = false; }
    html += `<p>${line}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/api/blog/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setPost(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const renderedContent = useMemo(() => {
    if (!post?.content) return '';
    return textToHtml(post.content);
  }, [post?.content]);

  if (loading) return <div className="min-h-screen bg-[#e8f1f2] flex items-center justify-center text-2xl font-bold text-[#2d2218]">Đang tải...</div>;
  if (!post) return <div className="min-h-screen bg-[#e8f1f2] flex items-center justify-center text-2xl font-bold text-[#2d2218]">Bài viết không tồn tại</div>;

  return (
    <div className="min-h-screen bg-[#e8f1f2] p-4 sm:p-8 font-sans">
      <div className="max-w-[900px] mx-auto bg-[#fdf9f1] rounded-[3rem] shadow-sm overflow-hidden border border-[#e5dcd3]">
        
        <header className="px-8 py-6 flex items-center justify-between border-b border-[#e5dcd3]">
          <Link to="/" className="flex items-center gap-2">
            <div className="text-2xl">🎬</div>
            <span className="font-bold text-xl text-[#2d2218]">TaiVideoNhanh</span>
          </Link>
          <Link to="/blog" className="text-sm font-bold text-[#4a3b2c] hover:text-[#f6a287]">← Tất cả bài viết</Link>
        </header>

        <article className="px-6 sm:px-12 py-12">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(post.tags || []).map((tag: string) => (
              <span key={tag} className="px-3 py-1 bg-[#a2d5c6] border-2 border-[#2d2218] rounded-full text-xs font-black text-[#2d2218]">{tag}</span>
            ))}
          </div>
          
          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#2d2218] mb-4 leading-tight">{post.title}</h1>
          
          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-[#a08f7f] font-bold mb-10">
            <span>{new Date(post.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>·</span>
            <span>👁️ {post.views} lượt xem</span>
          </div>
          
          {/* Cover Image */}
          {post.cover_image && (
            <div className="rounded-2xl overflow-hidden border-2 border-[#2d2218] shadow-[6px_6px_0px_#2d2218] mb-10">
              <img src={post.cover_image} alt={post.title} className="w-full object-cover" />
            </div>
          )}
          
          {/* Content - Render as HTML */}
          <div 
            className="prose prose-lg max-w-none text-[#2d2218] leading-relaxed
              [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-[#2d2218] [&_h2]:mt-10 [&_h2]:mb-4
              [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-[#2d2218] [&_h3]:mt-8 [&_h3]:mb-3
              [&_p]:mb-4 [&_p]:text-[#4a3b2c] [&_p]:font-medium
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
              [&_li]:mb-2 [&_li]:text-[#4a3b2c] [&_li]:font-medium
              [&_a]:text-[#f6a287] [&_a]:font-bold [&_a]:underline
              [&_blockquote]:border-l-4 [&_blockquote]:border-[#f6a287] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#6b5a4b]
              [&_img]:rounded-2xl [&_img]:border-2 [&_img]:border-[#2d2218] [&_img]:my-6
              [&_strong]:text-[#2d2218]"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />

          {/* CTA */}
          <div className="mt-16 bg-[#f6a287] rounded-3xl p-10 border-2 border-[#2d2218] shadow-[6px_6px_0px_#2d2218] text-center">
            <h3 className="text-2xl font-extrabold text-[#2d2218] mb-3">Trải Nghiệm TaiVideoNhanh Ngay!</h3>
            <p className="text-[#4a3b2c] font-medium mb-6">Tải video miễn phí, lồng tiếng AI chỉ 3.000đ/video</p>
            <Link to="/" className="inline-block bg-[#2d2218] text-white px-8 py-4 rounded-full font-bold border-2 border-[#2d2218] shadow-[4px_4px_0px_#6b5a4b] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#6b5a4b] transition-all">
              Dùng Thử Ngay
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
