import API_BASE from '../api';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackPixelEvent } from '../utils/analytics';
import SeoHead from '../components/SeoHead';
import { ToolHeader, CrossLinkingSection, UpsellCard, ToolFooter } from '../components/FreeToolLayout';

const FAQ_DATA = [
  { q: 'Xiaohongshu là gì?', a: 'Xiaohongshu (小红书 - Tiểu Hồng Thư / RedNote) là nền tảng mạng xã hội của Trung Quốc chuyên chia sẻ nội dung lifestyle, làm đẹp, thời trang, ẩm thực và du lịch. Với hơn 300 triệu người dùng, đây là kho tàng infographic và video hướng dẫn phong phú nhất châu Á.' },
  { q: 'Có thể tải ảnh infographic từ Xiaohongshu không?', a: 'Có, TaiVideoNhanh.com hỗ trợ tải toàn bộ album ảnh infographic HD từ Xiaohongshu. Khi bạn dán link một bài viết có ảnh, hệ thống sẽ trích xuất tất cả ảnh chất lượng gốc để bạn tải về.' },
  { q: 'Video Xiaohongshu tải về có watermark không?', a: 'Không! Công cụ của chúng tôi bóc tách link video gốc HD từ server Xiaohongshu, hoàn toàn không có watermark hay logo bất kỳ.' },
  { q: 'Tải video Xiaohongshu có miễn phí không?', a: 'Hoàn toàn miễn phí 100%. Bạn có thể tải không giới hạn video và ảnh Xiaohongshu mà không cần đăng ký tài khoản hay trả phí.' },
  { q: 'Tại sao link Xiaohongshu của tôi không hoạt động?', a: 'Hãy đảm bảo bạn sao chép đúng link chia sẻ từ ứng dụng Xiaohongshu (dạng xhslink.com/... hoặc xiaohongshu.com/explore/...). Link profile người dùng hoặc link tìm kiếm sẽ không hoạt động.' },
  { q: 'Có thể Việt hóa ảnh Xiaohongshu sang tiếng Việt không?', a: 'Có! TaiVideoNhanh.com cung cấp công cụ Việt Hóa Ảnh AI chuyên biệt, tự động dịch và thay thế text trên ảnh infographic Xiaohongshu sang tiếng Việt chuẩn thiết kế. Truy cập tại /viet-hoa-anh-xiaohongshu.' },
];

const SEO_SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TaiVideoNhanh - Tải Video & Ảnh Xiaohongshu',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web, Android, iOS',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', ratingCount: '1830', bestRating: '5' },
    description: 'Công cụ tải video và ảnh infographic Xiaohongshu (Tiểu Hồng Thư) không watermark miễn phí, chất lượng HD.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_DATA.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Cách tải video và ảnh Xiaohongshu không logo',
    description: 'Hướng dẫn tải video HD và album ảnh infographic từ Xiaohongshu (Tiểu Hồng Thư) chỉ trong 3 bước.',
    step: [
      { '@type': 'HowToStep', name: 'Sao chép link bài viết', text: 'Mở ứng dụng Xiaohongshu, chọn bài viết muốn tải, bấm Chia sẻ → Sao chép liên kết.' },
      { '@type': 'HowToStep', name: 'Dán link vào TaiVideoNhanh', text: 'Truy cập TaiVideoNhanh.com, dán link Xiaohongshu vào ô nhập liệu và bấm Tải Xiaohongshu HD.' },
      { '@type': 'HowToStep', name: 'Tải về máy', text: 'Bấm nút tải để lưu video HD hoặc toàn bộ album ảnh chất lượng gốc về thiết bị của bạn.' },
    ],
  },
];

export default function FreeToolXiaohongshu() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setResult(data.data);
      } else {
        setError(data.message || 'Không thể tải link Xiaohongshu này. Vui lòng kiểm tra lại link!');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3efe8] font-sans">
      <SeoHead
        title="Tải Video & Ảnh Xiaohongshu Không Logo Miễn Phí HD | TaiVideoNhanh"
        description="Công cụ tải video HD và album ảnh infographic Xiaohongshu (Tiểu Hồng Thư / RedNote) không watermark miễn phí. Bóc tách nội dung XHS siêu tốc!"
        canonical="https://taivideonhanh.com/tai-video-xiaohongshu"
        ogImage="https://taivideonhanh.com/og-image.jpg"
        schemas={SEO_SCHEMAS}
      />

      <ToolHeader badgeText="XHS TOOL" />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-[#a2d5c6] text-[#2d2218] font-extrabold text-sm rounded-full border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] mb-4">
            📕 Tải Video & Album Ảnh Xiaohongshu (RedNote) HD
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-[#2d2218] mb-4 leading-tight">
            Tải Video & Ảnh Xiaohongshu Không Logo Miễn Phí
          </h1>
          <p className="text-base sm:text-lg font-medium text-[#6b5a4b] max-w-2xl mx-auto">
            Công cụ hỗ trợ bóc tách video HD và toàn bộ album ảnh infographic chất lượng cao từ Xiaohongshu không dính watermark!
          </p>
        </div>

        <form onSubmit={handleDownload} className="bg-white p-4 sm:p-6 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Dán link Xiaohongshu (xhslink.com/...) vào đây"
              className="flex-1 px-5 py-4 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl font-bold text-[#2d2218] text-base focus:ring-2 focus:ring-[#a2d5c6] outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-[#f6a287] text-[#2d2218] font-black rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] text-lg shrink-0 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#2d2218] border-t-transparent rounded-full animate-spin"></div>
                  Đang Bóc Tách...
                </>
              ) : (
                '📥 Tải Xiaohongshu HD'
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-8 bg-[#fce4ec] border-2 border-[#2d2218] rounded-2xl text-[#c62828] font-bold text-center">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 shadow-[8px_8px_0px_#2d2218] mb-12">
            <h2 className="text-xl font-black text-[#2d2218] mb-4 text-center">🎉 Đã Bóc Tách Thành Công Nội Dung Xiaohongshu</h2>
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {result.cover_url && (
                <img src={result.cover_url} alt="Ảnh bìa bài viết Xiaohongshu" className="w-48 h-64 object-cover rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]" loading="lazy" />
              )}
              <div className="flex-1 text-center md:text-left space-y-4">
                <h3 className="font-bold text-[#2d2218] text-lg">{result.title}</h3>
                
                {result.video_url && (
                  <a
                    href={`${API_BASE}/api/download?b64=${btoa(result.video_url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}&title=${encodeURIComponent(result.title || '')}`}
                    download
                    onClick={() => trackPixelEvent('StartTrial')}
                    className="inline-block px-6 py-3 bg-[#a2d5c6] text-[#2d2218] font-black rounded-xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-sm hover:translate-y-[1px]"
                  >
                    📥 Tải Video MP4 HD
                  </a>
                )}

                <UpsellCard
                  message="🖼️ Bạn muốn TỰ ĐỘNG VIỆT HÓA ẢNH Infographic Xiaohongshu này sang Tiếng Việt chuẩn thiết kế?"
                  ctaText="🎨 Dùng Thử Trình Việt Hóa Ảnh AI Ngay!"
                />
              </div>
            </div>
          </div>
        )}

        {/* SEO ARTICLE CONTENT */}
        <article className="prose max-w-none bg-white p-6 sm:p-8 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] space-y-6 text-[#2d2218]">
          <h2 className="text-2xl font-black">Hướng Dẫn Tải Video & Ảnh Xiaohongshu Miễn Phí 2026</h2>

          <h3 className="text-xl font-bold">Xiaohongshu (Tiểu Hồng Thư) Là Gì?</h3>
          <p className="font-medium text-[#6b5a4b]">
            Xiaohongshu (小红书 - còn gọi là Tiểu Hồng Thư, RedNote hoặc Little Red Book) là nền tảng mạng xã hội hàng đầu Trung Quốc với hơn <strong>300 triệu người dùng hoạt động hàng tháng</strong>. Khác với TikTok hay Douyin tập trung vào video ngắn giải trí, Xiaohongshu nổi tiếng với nội dung <strong>chuyên sâu dạng infographic</strong> — đặc biệt trong lĩnh vực chăm sóc da, skincare, thời trang, nấu ăn, nuôi dạy con và mẹo vặt cuộc sống.
          </p>
          <p className="font-medium text-[#6b5a4b]">
            Đối với những ai làm content trên Facebook, TikTok hay Instagram, Xiaohongshu là <strong>nguồn cảm hứng vô tận</strong> với hàng triệu bài viết infographic chuyên nghiệp. Tuy nhiên, việc tải ảnh và video từ Xiaohongshu gặp nhiều khó khăn do nền tảng dán watermark và không cho phép tải trực tiếp. <strong>TaiVideoNhanh.com</strong> giải quyết vấn đề này giúp bạn!
          </p>

          <h3 className="text-xl font-bold">Cách Tải Bài Viết Xiaohongshu Chỉ Trong 3 Bước</h3>
          <ol className="list-decimal pl-6 space-y-2 font-medium">
            <li><strong>Bước 1: Lấy link bài viết</strong> — Mở ứng dụng Xiaohongshu, tìm bài viết (video hoặc ảnh) bạn muốn tải. Bấm biểu tượng <strong>Chia sẻ (分享)</strong> → chọn <strong>Sao chép liên kết (复制链接)</strong>.</li>
            <li><strong>Bước 2: Dán link vào TaiVideoNhanh</strong> — Truy cập trang này, dán đường link XHS vào ô nhập liệu phía trên và bấm <strong>"📥 Tải Xiaohongshu HD"</strong>.</li>
            <li><strong>Bước 3: Tải về máy</strong> — Hệ thống sẽ tự động bóc tách và hiển thị kết quả. Bấm nút tải để lưu video hoặc ảnh HD về điện thoại/máy tính.</li>
          </ol>

          <h3 className="text-xl font-bold">TaiVideoNhanh Hỗ Trợ Những Gì Từ Xiaohongshu?</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#a2d5c6]">
                  <th className="p-3 text-left border-2 border-[#2d2218] font-black">Loại nội dung</th>
                  <th className="p-3 text-center border-2 border-[#2d2218] font-black">Hỗ trợ</th>
                  <th className="p-3 text-center border-2 border-[#2d2218] font-black">Chất lượng</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-3 border-2 border-[#2d2218] font-medium">Video Xiaohongshu</td><td className="p-3 text-center border-2 border-[#2d2218]">✅</td><td className="p-3 text-center border-2 border-[#2d2218]">HD 1080p</td></tr>
                <tr className="bg-[#fdf9f1]"><td className="p-3 border-2 border-[#2d2218] font-medium">Album ảnh infographic</td><td className="p-3 text-center border-2 border-[#2d2218]">✅</td><td className="p-3 text-center border-2 border-[#2d2218]">Chất lượng gốc</td></tr>
                <tr><td className="p-3 border-2 border-[#2d2218] font-medium">Ảnh đơn</td><td className="p-3 text-center border-2 border-[#2d2218]">✅</td><td className="p-3 text-center border-2 border-[#2d2218]">Chất lượng gốc</td></tr>
                <tr className="bg-[#fdf9f1]"><td className="p-3 border-2 border-[#2d2218] font-medium">Xóa watermark</td><td className="p-3 text-center border-2 border-[#2d2218]">✅</td><td className="p-3 text-center border-2 border-[#2d2218]">100% sạch</td></tr>
              </tbody>
            </table>
          </div>

          <p className="font-medium text-[#6b5a4b]">
            Bên cạnh Xiaohongshu, <strong>TaiVideoNhanh.com</strong> còn hỗ trợ tải video từ <Link to="/tai-video-douyin-khong-logo" className="text-[#f6a287] font-bold hover:underline">Douyin</Link>, <Link to="/tai-video-tiktok-khong-logo" className="text-[#f6a287] font-bold hover:underline">TikTok</Link>, <Link to="/tai-video-kuaishou-khong-logo" className="text-[#f6a287] font-bold hover:underline">Kuaishou</Link>, <Link to="/tai-video-bilibili" className="text-[#f6a287] font-bold hover:underline">Bilibili</Link>, <Link to="/tai-video-facebook-hd" className="text-[#f6a287] font-bold hover:underline">Facebook</Link> và <Link to="/tai-video-youtube" className="text-[#f6a287] font-bold hover:underline">YouTube</Link>. Đặc biệt, bạn có thể <Link to="/viet-hoa-anh-xiaohongshu" className="text-[#f6a287] font-bold hover:underline">Việt hóa ảnh Xiaohongshu</Link> sang tiếng Việt bằng AI!
          </p>
        </article>

        {/* FAQ SECTION */}
        <section className="bg-white p-6 sm:p-8 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] space-y-6 text-[#2d2218] mt-10">
          <h2 className="text-2xl font-black text-center">❓ Câu Hỏi Thường Gặp Về Tải Xiaohongshu</h2>
          <div className="space-y-4">
            {FAQ_DATA.map((faq, i) => (
              <details key={i} className="bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl overflow-hidden group">
                <summary className="px-5 py-4 font-bold cursor-pointer hover:bg-[#a2d5c6]/30 list-none flex items-center justify-between">
                  <span>{faq.q}</span>
                  <span className="text-lg group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-5 py-4 border-t-2 border-[#2d2218] font-medium text-[#6b5a4b]">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        <CrossLinkingSection currentPath="/tai-video-xiaohongshu" />
      </main>

      <ToolFooter />
    </div>
  );
}
