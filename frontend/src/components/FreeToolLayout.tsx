import { Link } from 'react-router-dom';

interface ToolLink {
  to: string;
  emoji: string;
  label: string;
}

const ALL_TOOLS: ToolLink[] = [
  { to: '/tai-video-tiktok-khong-logo', emoji: '🎵', label: 'Tải Video TikTok' },
  { to: '/tai-video-douyin-khong-logo', emoji: '🇨🇳', label: 'Tải Video Douyin' },
  { to: '/tai-video-xiaohongshu', emoji: '📕', label: 'Tải Video Xiaohongshu' },
  { to: '/tai-video-kuaishou-khong-logo', emoji: '⚡', label: 'Tải Video Kuaishou' },
  { to: '/tai-video-bilibili', emoji: '📺', label: 'Tải Video Bilibili' },
  { to: '/tai-video-facebook-hd', emoji: '👤', label: 'Tải Video Facebook' },
  { to: '/tai-video-youtube', emoji: '▶️', label: 'Tải Video YouTube' },
  { to: '/viet-hoa-anh-xiaohongshu', emoji: '🎨', label: 'Việt Hóa Ảnh XHS' },
  { to: '/cong-cu-tao-anh', emoji: '🖼️', label: 'Tạo Ảnh Bài Viết' },
];

/**
 * CrossLinkingSection – Grid of internal links to all free tools.
 * Excludes the current page's path.
 */
export function CrossLinkingSection({ currentPath }: { currentPath: string }) {
  const otherTools = ALL_TOOLS.filter(t => t.to !== currentPath);

  return (
    <section className="bg-white p-6 sm:p-8 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] mt-10">
      <h2 className="text-2xl font-black text-[#2d2218] mb-6 text-center">🛠️ Các Công Cụ Miễn Phí Khác</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {otherTools.map(tool => (
          <Link
            key={tool.to}
            to={tool.to}
            className="flex items-center gap-2 px-4 py-3 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-xl font-bold text-[#2d2218] text-sm hover:bg-[#a2d5c6] hover:translate-y-[-1px] transition-all shadow-[2px_2px_0px_#2d2218]"
          >
            <span className="text-lg">{tool.emoji}</span>
            <span className="truncate">{tool.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * ToolHeader – Shared sticky header for all free tool pages.
 */
export function ToolHeader({ badgeText }: { badgeText: string }) {
  return (
    <header className="px-4 sm:px-6 py-4 sm:py-5 bg-[#fdf9f1] border-b-4 border-[#2d2218] flex items-center justify-between sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2 text-xl sm:text-2xl font-black text-[#2d2218]">
        <span className="bg-[#f6a287] px-3 py-1 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]">TaiVideoNhanh</span>
        <span className="text-xs font-bold px-2 py-1 bg-[#a2d5c6] rounded-lg border border-[#2d2218] hidden sm:inline">{badgeText}</span>
      </Link>
      <Link to="/dashboard" className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[#f6a287] text-[#2d2218] font-black rounded-xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] hover:translate-y-[1px] text-xs sm:text-sm">
        🎙️ Lồng Tiếng AI
      </Link>
    </header>
  );
}

/**
 * UpsellCard – CTA card to promote AI voiceover service.
 */
export function UpsellCard({ message, ctaText }: { message: string; ctaText: string }) {
  return (
    <div className="mt-6 p-4 bg-[#f6a287]/20 border-2 border-[#2d2218] rounded-2xl shadow-[3px_3px_0px_#2d2218]">
      <p className="font-extrabold text-[#2d2218] text-sm mb-2">{message}</p>
      <Link
        to="/dashboard"
        className="inline-block px-5 py-2.5 bg-[#f6a287] text-[#2d2218] font-black rounded-xl border-2 border-[#2d2218] text-xs shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px]"
      >
        {ctaText}
      </Link>
    </div>
  );
}

/**
 * ToolFooter – SEO-friendly footer with links, copyright, disclaimer.
 */
export function ToolFooter() {
  return (
    <footer className="max-w-4xl mx-auto px-4 py-10 text-center space-y-4">
      <div className="flex flex-wrap justify-center gap-3 text-sm font-bold text-[#6b5a4b]">
        <Link to="/" className="hover:text-[#2d2218]">Trang Chủ</Link>
        <span>·</span>
        <Link to="/blog" className="hover:text-[#2d2218]">Blog</Link>
        <span>·</span>
        <Link to="/academy" className="hover:text-[#2d2218]">Academy</Link>
        <span>·</span>
        <Link to="/affiliate" className="hover:text-[#2d2218]">Kiếm Tiền Affiliate</Link>
        <span>·</span>
        <Link to="/dashboard" className="hover:text-[#2d2218]">Studio Lồng Tiếng AI</Link>
      </div>
      <p className="text-xs text-[#6b5a4b]">
        © {new Date().getFullYear()} TaiVideoNhanh.com — Nền tảng tải video & lồng tiếng AI hàng đầu Việt Nam.
        <br />
        Công cụ chỉ phục vụ mục đích cá nhân. Vui lòng tôn trọng bản quyền nội dung gốc.
      </p>
    </footer>
  );
}
