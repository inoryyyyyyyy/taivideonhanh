import API_BASE from '../api';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackPixelEvent } from '../utils/analytics';
import SeoHead from '../components/SeoHead';
import { ToolHeader, CrossLinkingSection, UpsellCard, ToolFooter } from '../components/FreeToolLayout';

const FAQ_DATA = [
  { q: 'Việt hóa ảnh Xiaohongshu là gì?', a: 'Việt hóa ảnh là quá trình tự động dịch toàn bộ chữ tiếng Trung/tiếng Anh trên ảnh infographic sang tiếng Việt, đồng thời giữ nguyên 100% hình vẽ, layout và thiết kế gốc. Công nghệ AI Direct Inpainting của TaiVideoNhanh.com thực hiện điều này chỉ trong 3 giây.' },
  { q: 'Công cụ này có miễn phí không?', a: 'Bạn có thể dùng thử miễn phí để xem chất lượng. Với nhu cầu sử dụng thường xuyên, chi phí chỉ từ 1.000đ/ảnh — rẻ hơn nhiều so với việc thuê designer chỉnh sửa thủ công.' },
  { q: 'Hỗ trợ những loại ảnh nào?', a: 'Công cụ hoạt động tốt nhất với ảnh infographic có chữ rõ ràng, nền tương đối đơn giản. Ảnh từ Xiaohongshu, Douyin, Pinterest hoặc bất kỳ ảnh có link URL đều được hỗ trợ.' },
  { q: 'Chất lượng ảnh sau khi Việt hóa có bị giảm không?', a: 'Không! Công nghệ AI Inpainting của chúng tôi xóa sạch chữ gốc và đè chữ tiếng Việt một cách tự nhiên, giữ nguyên độ phân giải và chất lượng ảnh gốc.' },
  { q: 'Có cần biết Photoshop hay Canva không?', a: 'Hoàn toàn không cần! Chỉ cần dán link ảnh và bấm 1 nút, AI sẽ tự động xử lý mọi thứ. Không cần bất kỳ kỹ năng thiết kế nào.' },
];

const SEO_SCHEMAS = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TaiVideoNhanh - Việt Hóa Ảnh Xiaohongshu AI',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web, Android, iOS',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.7', ratingCount: '980', bestRating: '5' },
    description: 'Công cụ Việt hóa ảnh Xiaohongshu bằng AI. Tự động dịch chữ trên ảnh infographic sang tiếng Việt, giữ nguyên thiết kế gốc.',
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
    name: 'Cách Việt hóa ảnh Xiaohongshu sang tiếng Việt bằng AI',
    description: 'Hướng dẫn dịch ảnh infographic Xiaohongshu sang tiếng Việt tự động bằng công nghệ AI Inpainting.',
    step: [
      { '@type': 'HowToStep', name: 'Lấy link ảnh', text: 'Sao chép URL link trực tiếp của ảnh Xiaohongshu cần Việt hóa.' },
      { '@type': 'HowToStep', name: 'Dán link vào công cụ', text: 'Truy cập TaiVideoNhanh.com, dán link ảnh vào ô nhập liệu và bấm Việt Hóa Ảnh 1-Click.' },
      { '@type': 'HowToStep', name: 'Tải ảnh tiếng Việt', text: 'Đợi AI xử lý trong 3 giây, sau đó tải ảnh đã Việt hóa về máy.' },
    ],
  },
];

export default function FreeToolVietHoaAnh() {
  const [imgUrl, setImgUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultImg, setResultImg] = useState('');
  const [error, setError] = useState('');

  const handleTranslateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imgUrl.trim()) return;
    setLoading(true);
    setError('');
    setResultImg('');

    try {
      const res = await fetch(`${API_BASE}/api/translate_image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imgUrl })
      });
      const data = await res.json();
      if (data.status === 'success' && data.result?.generated_image_url) {
        const fullUrl = data.result.generated_image_url.startsWith('http') ? data.result.generated_image_url : `${API_BASE}${data.result.generated_image_url}`;
        setResultImg(fullUrl);
      } else {
        setError(data.message || 'Không thể dịch ảnh này. Vui lòng dán đường link ảnh sắc nét!');
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
        title="Việt Hóa Ảnh Xiaohongshu Bằng AI 1-Click Miễn Phí | TaiVideoNhanh"
        description="Công cụ Việt hóa ảnh Xiaohongshu bằng AI. Tự động dịch chữ tiếng Trung trên ảnh infographic sang tiếng Việt, giữ nguyên 100% thiết kế gốc chỉ trong 3 giây!"
        canonical="https://taivideonhanh.com/viet-hoa-anh-xiaohongshu"
        ogImage="https://taivideonhanh.com/og-image.jpg"
        schemas={SEO_SCHEMAS}
      />

      <ToolHeader badgeText="IMAGE AI" />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-[#a2d5c6] text-[#2d2218] font-extrabold text-sm rounded-full border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] mb-4">
            🎨 Công Nghệ Direct Inpainting Overlay 2026
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-[#2d2218] mb-4 leading-tight">
            Công Cụ Việt Hóa Ảnh Xiaohongshu 1-Click
          </h1>
          <p className="text-base sm:text-lg font-medium text-[#6b5a4b] max-w-2xl mx-auto">
            Tự động đọc chữ tiếng Trung trên ảnh Infographic, xóa sạch chữ gốc và đè chữ Tiếng Việt đẹp mắt, giữ nguyên 100% hình vẽ hoạt hình!
          </p>
        </div>

        <form onSubmit={handleTranslateImage} className="bg-white p-4 sm:p-6 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={imgUrl}
              onChange={(e) => setImgUrl(e.target.value)}
              placeholder="Dán URL link ảnh Xiaohongshu/Douyin cần dịch vào đây"
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
                  AI Đang Việt Hóa...
                </>
              ) : (
                '🎨 Việt Hóa Ảnh 1-Click'
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-8 bg-[#fce4ec] border-2 border-[#2d2218] rounded-2xl text-[#c62828] font-bold text-center">
            ❌ {error}
          </div>
        )}

        {resultImg && (
          <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 shadow-[8px_8px_0px_#2d2218] mb-12 text-center">
            <h2 className="text-xl font-black text-[#2d2218] mb-4">🎉 Ảnh Đã Được Việt Hóa Nét Căng!</h2>
            <div className="max-w-md mx-auto mb-6">
              <img src={resultImg} alt="Ảnh đã Việt hóa tiếng Việt" className="w-full h-auto rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]" loading="lazy" />
            </div>
            <a
              href={resultImg}
              target="_blank"
              rel="noreferrer"
              download="anh_viethoa_hd.jpg"
              onClick={() => trackPixelEvent('StartTrial')}
              className="inline-block px-8 py-3.5 bg-[#a2d5c6] text-[#2d2218] font-black rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] text-base hover:translate-y-[1px]"
            >
              📥 Tải Ảnh Tiếng Việt HD
            </a>

            <UpsellCard
              message="🎙️ Bạn có video Xiaohongshu/Douyin muốn LỒNG TIẾNG TIẾNG VIỆT tự động? Chỉ từ 2.000đ/video!"
              ctaText="🎙️ Thử Lồng Tiếng AI Ngay"
            />
          </div>
        )}

        {/* SEO ARTICLE */}
        <article className="prose max-w-none bg-white p-6 sm:p-8 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] space-y-6 text-[#2d2218]">
          <h2 className="text-2xl font-black">Việt Hóa Ảnh Xiaohongshu Bằng AI — Tiết Kiệm 95% Thời Gian</h2>

          <h3 className="text-xl font-bold">Tại Sao Bạn Cần Việt Hóa Ảnh Xiaohongshu?</h3>
          <p className="font-medium text-[#6b5a4b]">
            Xiaohongshu là kho tàng <strong>ảnh infographic chuyên nghiệp</strong> về chăm sóc da, skincare, làm đẹp, thời trang, nấu ăn và mẹo vặt cuộc sống. Hàng triệu bài viết với thiết kế đẹp mắt, thông tin bổ ích — nhưng tất cả đều bằng <strong>tiếng Trung</strong>. Nếu bạn muốn sử dụng những ảnh này cho content Facebook, TikTok, Instagram bằng tiếng Việt, bạn cần phải dịch và chỉnh sửa chữ trên ảnh.
          </p>
          <p className="font-medium text-[#6b5a4b]">
            Cách truyền thống là dùng <strong>Photoshop hoặc Canva</strong> để xóa chữ gốc, dịch nội dung rồi đè chữ mới — mất <strong>15-30 phút cho mỗi ảnh</strong>. Với 10 ảnh/ngày, bạn tốn 3-5 tiếng chỉ để Việt hóa! Công cụ <strong>Việt Hóa Ảnh AI</strong> của TaiVideoNhanh.com giải quyết bài toán này: chỉ cần <strong>1 click, 3 giây</strong> là xong.
          </p>

          <h3 className="text-xl font-bold">Công Nghệ AI Inpainting Hoạt Động Như Thế Nào?</h3>
          <ol className="list-decimal pl-6 space-y-2 font-medium">
            <li><strong>OCR Detection (Nhận dạng chữ)</strong> — AI quét toàn bộ ảnh, xác định vị trí và nội dung từng dòng chữ tiếng Trung/Anh trên ảnh.</li>
            <li><strong>Dịch thuật thông minh</strong> — Nội dung chữ được dịch sang tiếng Việt tự nhiên, giữ nguyên ý nghĩa và phong cách diễn đạt.</li>
            <li><strong>Inpainting (Xóa và đè chữ)</strong> — AI xóa sạch chữ gốc khỏi ảnh, tái tạo lại nền (background) một cách tự nhiên, sau đó đè chữ tiếng Việt với font, size và vị trí phù hợp.</li>
          </ol>

          <h3 className="text-xl font-bold">So Sánh: Việt Hóa Ảnh Thủ Công vs AI</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#a2d5c6]">
                  <th className="p-3 text-left border-2 border-[#2d2218] font-black">Tiêu chí</th>
                  <th className="p-3 text-center border-2 border-[#2d2218] font-black">AI TaiVideoNhanh</th>
                  <th className="p-3 text-center border-2 border-[#2d2218] font-black">Photoshop thủ công</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-3 border-2 border-[#2d2218] font-medium">Thời gian xử lý</td><td className="p-3 text-center border-2 border-[#2d2218]">⚡ 3 giây</td><td className="p-3 text-center border-2 border-[#2d2218]">15-30 phút</td></tr>
                <tr className="bg-[#fdf9f1]"><td className="p-3 border-2 border-[#2d2218] font-medium">Cần kỹ năng thiết kế</td><td className="p-3 text-center border-2 border-[#2d2218]">❌ Không cần</td><td className="p-3 text-center border-2 border-[#2d2218]">✅ Cần thành thạo</td></tr>
                <tr><td className="p-3 border-2 border-[#2d2218] font-medium">Chi phí</td><td className="p-3 text-center border-2 border-[#2d2218]">Từ 1.000đ/ảnh</td><td className="p-3 text-center border-2 border-[#2d2218]">Miễn phí (nhưng tốn thời gian)</td></tr>
                <tr className="bg-[#fdf9f1]"><td className="p-3 border-2 border-[#2d2218] font-medium">Giữ nguyên thiết kế gốc</td><td className="p-3 text-center border-2 border-[#2d2218]">✅ 100%</td><td className="p-3 text-center border-2 border-[#2d2218]">⚠️ Tùy kỹ năng</td></tr>
                <tr><td className="p-3 border-2 border-[#2d2218] font-medium">Xử lý hàng loạt</td><td className="p-3 text-center border-2 border-[#2d2218]">✅ Nhanh chóng</td><td className="p-3 text-center border-2 border-[#2d2218]">❌ Rất mất thời gian</td></tr>
              </tbody>
            </table>
          </div>

          <p className="font-medium text-[#6b5a4b]">
            Bạn cũng có thể <Link to="/tai-video-xiaohongshu" className="text-[#f6a287] font-bold hover:underline">tải video & ảnh gốc từ Xiaohongshu</Link> trước, sau đó sử dụng công cụ Việt hóa ảnh này để dịch sang tiếng Việt. Kết hợp với <Link to="/tai-video-douyin-khong-logo" className="text-[#f6a287] font-bold hover:underline">tải video Douyin</Link> và <Link to="/tai-video-tiktok-khong-logo" className="text-[#f6a287] font-bold hover:underline">tải video TikTok</Link>, bạn sẽ có bộ công cụ hoàn hảo để xây kênh nội dung.
          </p>
        </article>

        {/* FAQ SECTION */}
        <section className="bg-white p-6 sm:p-8 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] space-y-6 text-[#2d2218] mt-10">
          <h2 className="text-2xl font-black text-center">❓ Câu Hỏi Thường Gặp Về Việt Hóa Ảnh AI</h2>
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

        <CrossLinkingSection currentPath="/viet-hoa-anh-xiaohongshu" />
      </main>

      <ToolFooter />
    </div>
  );
}
