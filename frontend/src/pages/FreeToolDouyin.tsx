import API_BASE from '../api';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackPixelEvent } from '../utils/analytics';
import SeoHead from '../components/SeoHead';
import { ToolHeader, CrossLinkingSection, UpsellCard, ToolFooter } from '../components/FreeToolLayout';

const FAQ_DATA = [
  { q: 'Tải video Douyin không logo có miễn phí không?', a: 'Có, hoàn toàn miễn phí 100%. Bạn không cần đăng ký tài khoản hay trả bất kỳ khoản phí nào để tải video Douyin không watermark trên TaiVideoNhanh.com.' },
  { q: 'Video Douyin tải về có chất lượng HD không?', a: 'Có, công cụ của chúng tôi tải video Douyin ở chất lượng gốc HD (720p-1080p) mà không bị nén hay giảm chất lượng. Video giữ nguyên độ phân giải và âm thanh gốc.' },
  { q: 'Có thể tải video Douyin trên điện thoại không?', a: 'Có, TaiVideoNhanh.com hoạt động hoàn hảo trên cả điện thoại iPhone, Android và máy tính. Giao diện được tối ưu responsive cho mọi kích thước màn hình.' },
  { q: 'Tải video Douyin mất bao lâu?', a: 'Chỉ mất khoảng 0.3-1 giây để bóc tách link video Douyin HD không logo. Sau đó bạn chỉ cần bấm nút tải xuống để lưu video về máy.' },
  { q: 'Douyin và TikTok có khác nhau không?', a: 'Có, Douyin (抖音) là phiên bản TikTok dành riêng cho thị trường Trung Quốc do ByteDance phát triển. Douyin có kho video riêng biệt với nội dung phong phú về thời trang, ẩm thực, làm đẹp và giải trí Trung Quốc.' },
  { q: 'Có cần cài đặt phần mềm gì không?', a: 'Không cần cài đặt bất kỳ phần mềm hay extension nào. TaiVideoNhanh.com là công cụ trực tuyến (web-based), bạn chỉ cần mở trình duyệt và dán link là xong.' },
];

const SEO_SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TaiVideoNhanh - Tải Video Douyin Không Logo',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web, Android, iOS',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', ratingCount: '2150', bestRating: '5' },
    description: 'Công cụ tải video Douyin không logo miễn phí, chất lượng HD. Bóc tách video Douyin (TikTok Trung Quốc) siêu tốc trong 0.3 giây.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_DATA.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Cách tải video Douyin không logo miễn phí',
    description: 'Hướng dẫn tải video Douyin (TikTok Trung Quốc) HD không dính watermark chỉ trong 3 bước đơn giản.',
    step: [
      { '@type': 'HowToStep', name: 'Sao chép link', text: 'Mở ứng dụng Douyin, chọn video muốn tải, bấm Chia sẻ → Sao chép liên kết.' },
      { '@type': 'HowToStep', name: 'Dán link vào công cụ', text: 'Truy cập TaiVideoNhanh.com, dán link Douyin vào ô tìm kiếm và bấm Tải Video HD.' },
      { '@type': 'HowToStep', name: 'Tải video về máy', text: 'Bấm nút Tải Video MP4 HD Không Logo để lưu video chất lượng cao về điện thoại hoặc máy tính.' },
    ],
  },
];

export default function FreeToolDouyin() {
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
        setError(data.message || 'Không thể tải video Douyin này. Vui lòng kiểm tra lại link!');
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
        title="Tải Video Douyin Không Logo Miễn Phí HD 2026 | TaiVideoNhanh"
        description="Công cụ tải video Douyin (TikTok Trung Quốc) không logo miễn phí, chất lượng HD sắc nét. Bóc tách video Douyin siêu tốc trong 0.3 giây, không cần cài phần mềm!"
        canonical="https://taivideonhanh.com/tai-video-douyin-khong-logo"
        ogImage="https://taivideonhanh.com/og-image.jpg"
        schemas={SEO_SCHEMAS}
      />

      <ToolHeader badgeText="DOUYIN TOOL" />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-[#a2d5c6] text-[#2d2218] font-extrabold text-sm rounded-full border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] mb-4">
            🔥 Miễn Phí 100% - Không Cần Đăng Nhập
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-[#2d2218] mb-4 leading-tight">
            Tải Video Douyin Không Logo (Watermark-Free) 2026
          </h1>
          <p className="text-base sm:text-lg font-medium text-[#6b5a4b] max-w-2xl mx-auto">
            Công cụ tải video Douyin (TikTok Trung Quốc) chất lượng cao HD không dính logo miễn phí, siêu tốc trong 0.3 giây!
          </p>
        </div>

        {/* INPUT BOX */}
        <form onSubmit={handleDownload} className="bg-white p-4 sm:p-6 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Dán link video Douyin vào đây (VD: https://v.douyin.com/...)"
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
                '📥 Tải Video HD'
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-8 bg-[#fce4ec] border-2 border-[#2d2218] rounded-2xl text-[#c62828] font-bold text-center">
            ❌ {error}
          </div>
        )}

        {/* RESULT */}
        {result && (
          <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 shadow-[8px_8px_0px_#2d2218] mb-12">
            <h2 className="text-xl font-black text-[#2d2218] mb-4 text-center">🎉 Kết Quả Tải Video HD Không Logo</h2>
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {result.cover_url && (
                <img src={result.cover_url} alt="Ảnh bìa video Douyin" className="w-48 h-64 object-cover rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]" loading="lazy" />
              )}
              <div className="flex-1 text-center md:text-left space-y-4">
                <h3 className="font-bold text-[#2d2218] text-lg">{result.title}</h3>
                
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <a
                    href={`${API_BASE}/api/download?b64=${btoa(result.video_url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}&title=${encodeURIComponent(result.title || '')}`}
                    download
                    onClick={() => trackPixelEvent('StartTrial')}
                    className="px-6 py-3 bg-[#a2d5c6] text-[#2d2218] font-black rounded-xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-sm hover:translate-y-[1px]"
                  >
                    📥 Tải Video MP4 HD Không Logo
                  </a>
                </div>

                <UpsellCard
                  message="✨ Bạn muốn TỰ ĐỘNG LỒNG TIẾNG TIẾNG VIỆT chuẩn giọng đọc cho video này để Reup TikTok/Reels?"
                  ctaText="🎙️ Thử Lồng Tiếng AI Ngay Phút Này (Chỉ từ 2.000đ)"
                />
              </div>
            </div>
          </div>
        )}

        {/* SEO ARTICLE CONTENT */}
        <article className="prose max-w-none bg-white p-6 sm:p-8 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] space-y-6 text-[#2d2218]">
          <h2 className="text-2xl font-black">Hướng Dẫn Tải Video Douyin Không Logo Miễn Phí 2026</h2>
          
          <h3 className="text-xl font-bold">Douyin Là Gì? Tại Sao Nên Tải Video Douyin?</h3>
          <p className="font-medium text-[#6b5a4b]">
            Douyin (抖音) là nền tảng chia sẻ video ngắn hàng đầu Trung Quốc do ByteDance phát triển, ra mắt từ năm 2016. Đây chính là phiên bản gốc của TikTok quốc tế, với hơn <strong>750 triệu người dùng hoạt động hàng tháng</strong> chỉ riêng tại Trung Quốc. Douyin sở hữu kho nội dung khổng lồ về thời trang, ẩm thực, làm đẹp, gia dụng, công nghệ và giải trí mà bạn không thể tìm thấy trên TikTok quốc tế.
          </p>
          <p className="font-medium text-[#6b5a4b]">
            Tuy nhiên, khi tải video trực tiếp từ ứng dụng Douyin, video sẽ bị dính mờ <strong>watermark logo Douyin và ID tác giả</strong> trên video. Điều này gây khó chịu khi bạn muốn sử dụng video cho mục đích reup, xây kênh bán hàng, hoặc làm content marketing. Công cụ <strong>TaiVideoNhanh.com</strong> giúp bạn <strong>xóa logo Douyin 100%</strong>, giữ nguyên chất lượng HD sắc nét gốc!
          </p>

          <h3 className="text-xl font-bold">Các Bước Tải Video Douyin Không Logo Nhanh Nhất</h3>
          <ol className="list-decimal pl-6 space-y-2 font-medium">
            <li><strong>Bước 1: Lấy link video Douyin</strong> — Mở ứng dụng Douyin hoặc trang web douyin.com. Tìm video bạn muốn tải, bấm nút <strong>Chia sẻ (分享)</strong> → chọn <strong>Sao chép liên kết (复制链接)</strong>.</li>
            <li><strong>Bước 2: Dán link vào TaiVideoNhanh</strong> — Quay lại trang này, dán đường link Douyin vừa sao chép vào ô nhập liệu phía trên.</li>
            <li><strong>Bước 3: Bấm Tải Video HD</strong> — Nhấn nút "📥 Tải Video HD" và đợi khoảng 0.3 giây để hệ thống bóc tách link video gốc.</li>
            <li><strong>Bước 4: Lưu video về máy</strong> — Bấm nút <strong>"Tải Video MP4 HD Không Logo"</strong> để lưu video nét căng, không dính bất kỳ watermark nào về điện thoại hoặc máy tính.</li>
          </ol>

          <h3 className="text-xl font-bold">Tại Sao Chọn TaiVideoNhanh.com Để Tải Video Douyin?</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#a2d5c6]">
                  <th className="p-3 text-left border-2 border-[#2d2218] font-black">Tính năng</th>
                  <th className="p-3 text-center border-2 border-[#2d2218] font-black">TaiVideoNhanh</th>
                  <th className="p-3 text-center border-2 border-[#2d2218] font-black">Công cụ khác</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-3 border-2 border-[#2d2218] font-medium">Xóa logo 100%</td><td className="p-3 text-center border-2 border-[#2d2218]">✅</td><td className="p-3 text-center border-2 border-[#2d2218]">❌ / ⚠️</td></tr>
                <tr className="bg-[#fdf9f1]"><td className="p-3 border-2 border-[#2d2218] font-medium">Tốc độ bóc tách</td><td className="p-3 text-center border-2 border-[#2d2218]">⚡ 0.3 giây</td><td className="p-3 text-center border-2 border-[#2d2218]">5-15 giây</td></tr>
                <tr><td className="p-3 border-2 border-[#2d2218] font-medium">Chất lượng HD gốc</td><td className="p-3 text-center border-2 border-[#2d2218]">✅ 1080p</td><td className="p-3 text-center border-2 border-[#2d2218]">480p-720p</td></tr>
                <tr className="bg-[#fdf9f1]"><td className="p-3 border-2 border-[#2d2218] font-medium">Lồng tiếng AI Tiếng Việt</td><td className="p-3 text-center border-2 border-[#2d2218]">✅ Tích hợp</td><td className="p-3 text-center border-2 border-[#2d2218]">❌</td></tr>
                <tr><td className="p-3 border-2 border-[#2d2218] font-medium">Không quảng cáo</td><td className="p-3 text-center border-2 border-[#2d2218]">✅</td><td className="p-3 text-center border-2 border-[#2d2218]">❌ Nhiều popup</td></tr>
                <tr className="bg-[#fdf9f1]"><td className="p-3 border-2 border-[#2d2218] font-medium">Không cần đăng nhập</td><td className="p-3 text-center border-2 border-[#2d2218]">✅</td><td className="p-3 text-center border-2 border-[#2d2218]">⚠️ Một số yêu cầu</td></tr>
              </tbody>
            </table>
          </div>

          <p className="font-medium text-[#6b5a4b]">
            Ngoài Douyin, <strong>TaiVideoNhanh.com</strong> còn hỗ trợ tải video từ nhiều nền tảng khác như <Link to="/tai-video-tiktok-khong-logo" className="text-[#f6a287] font-bold hover:underline">TikTok</Link>, <Link to="/tai-video-xiaohongshu" className="text-[#f6a287] font-bold hover:underline">Xiaohongshu (Tiểu Hồng Thư)</Link>, <Link to="/tai-video-kuaishou-khong-logo" className="text-[#f6a287] font-bold hover:underline">Kuaishou</Link>, <Link to="/tai-video-bilibili" className="text-[#f6a287] font-bold hover:underline">Bilibili</Link>, <Link to="/tai-video-facebook-hd" className="text-[#f6a287] font-bold hover:underline">Facebook</Link> và <Link to="/tai-video-youtube" className="text-[#f6a287] font-bold hover:underline">YouTube</Link>. Đặc biệt, nền tảng còn cung cấp tính năng <strong>lồng tiếng AI tiếng Việt tự động</strong> chỉ từ 2.000đ/video, giúp bạn xây kênh nội dung cực kỳ nhanh chóng.
          </p>
        </article>

        {/* FAQ SECTION */}
        <section className="bg-white p-6 sm:p-8 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] space-y-6 text-[#2d2218] mt-10">
          <h2 className="text-2xl font-black text-center">❓ Câu Hỏi Thường Gặp Về Tải Video Douyin</h2>
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

        {/* CROSS LINKING */}
        <CrossLinkingSection currentPath="/tai-video-douyin-khong-logo" />
      </main>

      <ToolFooter />
    </div>
  );
}
