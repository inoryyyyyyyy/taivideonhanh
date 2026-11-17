import API_BASE from '../api';
import { useState } from 'react';
import { trackPixelEvent } from '../utils/analytics';
import SeoHead from '../components/SeoHead';
import { ToolHeader, CrossLinkingSection, UpsellCard, ToolFooter } from '../components/FreeToolLayout';

export default function FreeToolYoutube() {
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
        setError(data.message || 'Không thể tải video YouTube này. Vui lòng kiểm tra lại link!');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ. Vui lòng thử lại sau!');
    } finally {
      setLoading(false);
    }
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': 'Công Cụ Tải Video YouTube MP4 HD - TaiVideoNhanh',
    'operatingSystem': 'All',
    'applicationCategory': 'MultimediaApplication',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'VND'
    },
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': '4.9',
      'ratingCount': '18500'
    }
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': 'Tải video YouTube tại TaiVideoNhanh.com có miễn phí không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Hoàn toàn miễn phí 100%. Bạn có thể tải bao nhiêu video YouTube, YouTube Shorts tùy thích mà không cần đăng ký tài khoản hay trả bất kỳ chi phí nào.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Có thể tải YouTube Shorts dạng video MP4 ngắn được không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Có! TaiVideoNhanh hỗ trợ bóc tách liên kết YouTube Shorts (dạng /shorts/...) và xuất ra file MP4 chất lượng cao full HD có âm thanh đầy đủ.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Làm thế nào để tải video YouTube về điện thoại iPhone hoặc Android?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Bạn chỉ cần mở ứng dụng YouTube trên điện thoại, bấm Share (Chia sẻ) -> Copy Link (Sao chép liên kết), sau đó dán link vào TaiVideoNhanh.com trên trình duyệt web và bấm nút Tải Video HD.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Công cụ có hỗ trợ tải video chất lượng HD, Full HD, 4K không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Có! Hệ thống tự động phân tích và cung cấp chất lượng video tốt nhất có sẵn trên YouTube (720p, 1080p Full HD hoặc 4K) cho bạn tải về.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Tôi có cần cài đặt phần mềm hay extension gì không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Không cần cài bất kỳ phần mềm hay tiện ích mở rộng nào. TaiVideoNhanh hoạt động trực tiếp trên mọi trình duyệt web như Chrome, Safari, Edge, Cốc Cốc trên cả PC và thiết bị di động.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Tải video từ YouTube về máy có dính vi-rút hay quảng cáo độc hại không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'TaiVideoNhanh cam kết 100% an toàn, không chứa mã độc, không popup quảng cáo phiền phức và không thu thập bất kỳ thông tin cá nhân nào của bạn.'
        }
      }
    ]
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': 'Cách Tải Video YouTube MP4 HD Về Máy Tính & Điện Thoại',
    'description': 'Hướng dẫn chi tiết 3 bước đơn giản để tải video YouTube và YouTube Shorts về máy miễn phí, siêu tốc trong 0.3 giây.',
    'step': [
      {
        '@type': 'HowToStep',
        'name': 'Bước 1: Sao chép đường dẫn (URL) video YouTube',
        'text': 'Mở video YouTube hoặc YouTube Shorts bạn muốn tải, nhấn vào nút Chia sẻ (Share) và chọn Sao chép liên kết (Copy link).'
      },
      {
        '@type': 'HowToStep',
        'name': 'Bước 2: Dán URL vào TaiVideoNhanh.com',
        'text': 'Truy cập TaiVideoNhanh.com/tai-video-youtube, dán đường dẫn vừa sao chép vào khung tìm kiếm và nhấn nút "Tải Video HD".'
      },
      {
        '@type': 'HowToStep',
        'name': 'Bước 3: Tải video YouTube về thiết bị',
        'text': 'Chọn chất lượng video mong muốn và bấm nút Tải về để lưu file MP4 HD sắc nét về điện thoại hoặc máy tính của bạn.'
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#f3efe8] font-sans">
      <SeoHead
        title="Tải Video YouTube MP4 HD Miễn Phí | TaiVideoNhanh"
        description="Công cụ tải video YouTube MP4 HD/4K miễn phí. Download YouTube Shorts, video YouTube về máy tính, điện thoại nhanh nhất 2026!"
        canonical="https://taivideonhanh.com/tai-video-youtube"
        schemas={[softwareSchema, faqSchema, howToSchema]}
      />

      <ToolHeader badgeText="YOUTUBE TOOL" />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-[#a2d5c6] text-[#2d2218] font-extrabold text-sm rounded-full border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] mb-4">
            🔥 Miễn Phí 100% - Không Cần Đăng Nhập - Tốc Độ Cao
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-[#2d2218] mb-4 leading-tight">
            Tải Video YouTube MP4 HD & Shorts Miễn Phí 2026
          </h1>
          <p className="text-base sm:text-lg font-medium text-[#6b5a4b] max-w-2xl mx-auto">
            Công cụ download YouTube MP4 HD/4K, tải video YouTube Shorts về máy tính và điện thoại cực kỳ đơn giản, không giật lag, 100% miễn phí!
          </p>
        </div>

        {/* INPUT FORM */}
        <form onSubmit={handleDownload} className="bg-white p-4 sm:p-6 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Dán link YouTube vào đây (VD: https://youtu.be/... hoặc https://youtube.com/shorts/...)"
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
                  Đang Phân Tích...
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

        {/* RESULT DISPLAY */}
        {result && (
          <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 shadow-[8px_8px_0px_#2d2218] mb-12">
            <h2 className="text-xl font-black text-[#2d2218] mb-4 text-center">🎉 Kết Quả Tải Video YouTube HD</h2>
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {result.cover_url && (
                <img src={result.cover_url} alt={result.title || 'YouTube Video Thumbnail'} className="w-48 h-64 object-cover rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]" />
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
                    📥 Tải Video MP4 HD
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
        <article className="prose max-w-none bg-white p-6 sm:p-10 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] space-y-8 text-[#2d2218]">
          <h2 className="text-2xl sm:text-3xl font-black text-[#2d2218] border-b-4 border-[#2d2218] pb-3">
            Hướng Dẫn Tải Video YouTube MP4 HD Miễn Phí 2026
          </h2>
          <p className="font-medium text-[#6b5a4b] leading-relaxed text-base">
            YouTube hiện là nền tảng chia sẻ video lớn nhất thế giới với hàng tỷ video ca nhạc, bài giảng hướng dẫn, tài liệu phim ảnh, vlog giải trí và video ngắn Shorts. Tuy nhiên, việc không thể lưu video trực tiếp về thiết bị di động hoặc máy tính để xem offline mà không có kết nối Internet thường mang lại nhiều phiền toái. Bạn đang tìm kiếm giải pháp <strong>tải video YouTube về máy</strong> vừa miễn phí, vừa bảo đảm chất lượng Full HD, 4K siêu nét?
          </p>
          <p className="font-medium text-[#6b5a4b] leading-relaxed text-base">
            Công cụ <strong>TaiVideoNhanh.com</strong> ra đời nhằm cung cấp giải pháp bóc tách đường dẫn video YouTube tiên tiến nhất 2026. Với công nghệ xử lý dữ liệu đám mây tốc độ cao, TaiVideoNhanh cho phép người dùng <strong>download youtube mp4</strong> chất lượng nguyên bản hoàn toàn miễn phí, không yêu cầu cài đặt phần mềm nặng máy hay đăng ký tài khoản phức tạp.
          </p>

          <h3 className="text-xl font-extrabold text-[#2d2218] pt-4">
            Cách Tải Video YouTube Về Máy Nhanh Nhất
          </h3>
          <p className="font-medium text-[#6b5a4b] leading-relaxed text-base">
            Để tiến hành <strong>tải video youtube HD</strong> về điện thoại Android, iPhone, iPad hay máy tính PC, laptop của bạn, chỉ cần làm theo 3 bước đơn giản dưới đây:
          </p>
          <ol className="list-decimal pl-6 space-y-3 font-semibold text-[#2d2218]">
            <li className="leading-relaxed">
              <strong>Bước 1: Sao chép đường link video YouTube:</strong> Truy cập ứng dụng YouTube hoặc trang web <code className="bg-[#fdf9f1] px-2 py-1 rounded border border-[#2d2218]">youtube.com</code> trên thiết bị của bạn. Chọn video cần lưu, sau đó nhấn vào biểu tượng <strong>Chia sẻ (Share)</strong> và chọn <strong>Sao chép liên kết (Copy link)</strong>.
            </li>
            <li className="leading-relaxed">
              <strong>Bước 2: Dán liên kết vào TaiVideoNhanh.com:</strong> Mở trình duyệt web và truy cập trang <code className="bg-[#fdf9f1] px-2 py-1 rounded border border-[#2d2218]">taivideonhanh.com/tai-video-youtube</code>. Dán đoạn URL vừa copy vào ô nhập liệu và bấm nút <strong>📥 Tải Video HD</strong>.
            </li>
            <li className="leading-relaxed">
              <strong>Bước 3: Tải file MP4 về thiết bị:</strong> Hệ thống tự động phân tích đường dẫn trong chưa đầy 0.3 giây. Bạn chỉ cần nhấn vào nút <strong>Tải Video MP4 HD</strong> để tải tệp media sắc nét về thư viện máy.
            </li>
          </ol>

          <h3 className="text-xl font-extrabold text-[#2d2218] pt-4">
            Hỗ Trợ Tải YouTube Shorts Sắc Nét
          </h3>
          <p className="font-medium text-[#6b5a4b] leading-relaxed text-base">
            YouTube Shorts là xu hướng video ngắn dọc cực kỳ bùng nổ, nơi các nhà sáng tạo nội dung đăng tải hàng ngàn video thú vị hàng ngày. Tuy nhiên, định dạng link Shorts (dạng <code className="bg-[#fdf9f1] px-2 py-1 rounded border border-[#2d2218]">youtube.com/shorts/...</code>) thường khiến các công cụ tải video thông thường gặp lỗi hoặc không nhận diện được.
          </p>
          <p className="font-medium text-[#6b5a4b] leading-relaxed text-base">
            TaiVideoNhanh.com tự hào là một trong những nền tảng tối ưu nhất hỗ trợ <strong>tải youtube shorts</strong> nguyên bản HD 1080p. Dù bạn sử dụng liên kết rút gọn dạng <code className="bg-[#fdf9f1] px-2 py-1 rounded border border-[#2d2218]">youtu.be</code> hay link Shorts dọc, hệ thống đều tự động nhận diện và bóc tách dữ liệu chuẩn xác, giúp bạn lưu trữ video Shorts về làm tài liệu học tập, dựng phim hoặc sáng tạo nội dung hiệu quả.
          </p>

          <h3 className="text-xl font-extrabold text-[#2d2218] pt-4">
            Tại Sao Chọn TaiVideoNhanh.com Để Tải YouTube?
          </h3>
          <p className="font-medium text-[#6b5a4b] leading-relaxed text-base">
            Giữa hàng trăm trang web hỗ trợ tải video trực tuyến, <strong>TaiVideoNhanh.com</strong> khẳng định vị thế ưu việt nhờ những ưu điểm vượt trội:
          </p>
          <ul className="list-disc pl-6 space-y-3 font-medium text-[#6b5a4b]">
            <li>
              <strong className="text-[#2d2218]">Tốc độ xử lý siêu tốc:</strong> Thuật toán bóc tách dữ liệu thông minh giúp phản hồi link chỉ trong 0.3 giây, không mất thời gian chờ đợi đếm ngược quảng cáo.
            </li>
            <li>
              <strong className="text-[#2d2218]">Chất lượng hình ảnh & âm thanh tối đa:</strong> Giữ nguyên độ phân giải gốc của video YouTube, hỗ trợ xuất định dạng MP4 nét chuẩn Full HD / 4K với âm thanh rõ ràng, tròn tiếng.
            </li>
            <li>
              <strong className="text-[#2d2218]">An toàn tuyệt đối - Không quảng cáo độc hại:</strong> Loại bỏ hoàn toàn các cửa sổ quảng cáo nhảy ngẫu nhiên (pop-up) hay liên kết nguy hiểm chứa virus, đảm bảo trải nghiệm người dùng sạch sẽ và an toàn.
            </li>
            <li>
              <strong className="text-[#2d2218]">Tương thích đa nền tảng:</strong> Sử dụng mượt mà trên mọi hệ điều hành (Windows, macOS, iOS, Android, Linux) và mọi trình duyệt web phổ biến (Chrome, Safari, Firefox, Edge, Cốc Cốc).
            </li>
            <li>
              <strong className="text-[#2d2218]">Tích hợp hệ sinh thái AI:</strong> Dễ dàng kết nối với Studio Lồng Tiếng AI tự động để việt hóa giọng đọc video nước ngoài, tạo nội dung Reup kiếm tiền trên Facebook Reels, TikTok, YouTube Shorts.
            </li>
          </ul>

          <h3 className="text-xl font-extrabold text-[#2d2218] pt-4">
            Bảng So Sánh Các Website Tải YouTube Phổ Biến
          </h3>
          <p className="font-medium text-[#6b5a4b] mb-4">
            Dưới đây là bảng đánh giá so sánh trực quan giữa TaiVideoNhanh.com và các dịch vụ download YouTube phổ biến trên thị trường:
          </p>

          <div className="overflow-x-auto my-6 border-2 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-[#a2d5c6] border-b-2 border-[#2d2218] text-[#2d2218]">
                  <th className="p-3.5 font-black text-sm">Tiêu chí so sánh</th>
                  <th className="p-3.5 font-black text-sm">TaiVideoNhanh.com</th>
                  <th className="p-3.5 font-black text-sm">Website thông thường (y2mate, savefrom...)</th>
                </tr>
              </thead>
              <tbody className="divide-y border-[#2d2218] font-medium text-sm text-[#2d2218]">
                <tr className="hover:bg-[#fdf9f1]">
                  <td className="p-3.5 font-bold">Tốc độ bóc tách link</td>
                  <td className="p-3.5 text-[#2e7d32] font-bold">⚡ Cực nhanh (&lt; 0.5s)</td>
                  <td className="p-3.5 text-[#c62828]">Chậm (5s - 15s)</td>
                </tr>
                <tr className="hover:bg-[#fdf9f1]">
                  <td className="p-3.5 font-bold">Quảng cáo Pop-up / Mã độc</td>
                  <td className="p-3.5 text-[#2e7d32] font-bold">🛡️ Không có quảng cáo độc hại</td>
                  <td className="p-3.5 text-[#c62828]">Rất nhiều pop-up nhảy tràn màn hình</td>
                </tr>
                <tr className="hover:bg-[#fdf9f1]">
                  <td className="p-3.5 font-bold">Hỗ trợ YouTube Shorts</td>
                  <td className="p-3.5 text-[#2e7d32] font-bold">✅ Tối ưu hoàn hảo 1080p</td>
                  <td className="p-3.5 text-[#e65100]">Thường bị lỗi đường dẫn</td>
                </tr>
                <tr className="hover:bg-[#fdf9f1]">
                  <td className="p-3.5 font-bold">Độ phân giải video xuất ra</td>
                  <td className="p-3.5 text-[#2e7d32] font-bold">🎯 Full HD / 4K nét căng</td>
                  <td className="p-3.5 text-[#e65100]">Giới hạn 360p - 720p (muốn HD phải trả phí)</td>
                </tr>
                <tr className="hover:bg-[#fdf9f1]">
                  <td className="p-3.5 font-bold">Yêu cầu đăng ký tài khoản</td>
                  <td className="p-3.5 text-[#2e7d32] font-bold">❌ Không cần đăng ký</td>
                  <td className="p-3.5 text-[#e65100]">Một số yêu cầu đăng ký / mua VIP</td>
                </tr>
                <tr className="hover:bg-[#fdf9f1]">
                  <td className="p-3.5 font-bold">Tính năng Lồng Tiếng AI</td>
                  <td className="p-3.5 text-[#2e7d32] font-bold">🎙️ Tích hợp Studio AI sẵn có</td>
                  <td className="p-3.5 text-[#c62828]">Không hỗ trợ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[#2d2218] border-b-4 border-[#2d2218] pb-3 pt-6">
            Câu Hỏi Thường Gặp Khi Tải Video YouTube
          </h2>
          <div className="space-y-6 pt-2">
            <div className="bg-[#fdf9f1] p-5 rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218]">
              <h3 className="font-extrabold text-[#2d2218] text-lg mb-2">
                1. Tải video YouTube tại TaiVideoNhanh.com có miễn phí không?
              </h3>
              <p className="text-[#6b5a4b] font-medium leading-relaxed">
                Hoàn toàn miễn phí 100%. Bạn có thể <strong>tải video youtube về máy</strong> với số lượng không giới hạn mà không mất bất kỳ khoản phí nào, cũng không cần đăng ký tài khoản hay khai báo thông tin cá nhân.
              </p>
            </div>

            <div className="bg-[#fdf9f1] p-5 rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218]">
              <h3 className="font-extrabold text-[#2d2218] text-lg mb-2">
                2. Có thể tải YouTube Shorts dạng video MP4 ngắn được không?
              </h3>
              <p className="text-[#6b5a4b] font-medium leading-relaxed">
                Có! Dịch vụ <strong>tải youtube shorts</strong> tại TaiVideoNhanh được tối ưu hóa đặc biệt. Chỉ cần dán link Shorts dạng <code className="bg-white px-2 py-0.5 rounded border border-[#2d2218]">/shorts/</code>, hệ thống sẽ bóc tách tức thì tệp MP4 sắc nét kèm âm thanh sống động.
              </p>
            </div>

            <div className="bg-[#fdf9f1] p-5 rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218]">
              <h3 className="font-extrabold text-[#2d2218] text-lg mb-2">
                3. Làm thế nào để tải video YouTube về điện thoại iPhone hoặc Android?
              </h3>
              <p className="text-[#6b5a4b] font-medium leading-relaxed">
                Rất đơn giản: Mở ứng dụng YouTube trên Smartphone -&gt; Bấm nút Share (Chia sẻ) -&gt; Chọn Sao chép liên kết -&gt; Mở trình duyệt Safari hoặc Chrome truy cập TaiVideoNhanh.com/tai-video-youtube -&gt; Dán link và bấm Tải Video HD.
              </p>
            </div>

            <div className="bg-[#fdf9f1] p-5 rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218]">
              <h3 className="font-extrabold text-[#2d2218] text-lg mb-2">
                4. Công cụ có hỗ trợ tải video chất lượng HD, Full HD, 4K không?
              </h3>
              <p className="text-[#6b5a4b] font-medium leading-relaxed">
                Có! TaiVideoNhanh tự động giữ nguyên chất lượng cao nhất mà video gốc trên YouTube sở hữu (bao gồm 720p, 1080p Full HD hoặc 4K), giúp bạn trải nghiệm video với độ nét tuyệt vời.
              </p>
            </div>

            <div className="bg-[#fdf9f1] p-5 rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218]">
              <h3 className="font-extrabold text-[#2d2218] text-lg mb-2">
                5. Tôi có cần cài đặt phần mềm hay extension gì không?
              </h3>
              <p className="text-[#6b5a4b] font-medium leading-relaxed">
                Không cần! Bạn không phải cài ứng dụng, app hay tiện ích mở rộng (extension) nào gây nặng bộ nhớ máy. Mọi thao tác <strong>download youtube mp4</strong> đều thực hiện online 100% trên website.
              </p>
            </div>

            <div className="bg-[#fdf9f1] p-5 rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218]">
              <h3 className="font-extrabold text-[#2d2218] text-lg mb-2">
                6. Tải video từ YouTube về máy có dính vi-rút hay quảng cáo độc hại không?
              </h3>
              <p className="text-[#6b5a4b] font-medium leading-relaxed">
                Cam kết 100% sạch sẽ và an toàn. TaiVideoNhanh không sử dụng quảng cáo chuyển hướng hay mã độc, mang lại môi trường trải nghiệm mượt mà, bảo vệ thiết bị của bạn tuyệt đối.
              </p>
            </div>
          </div>
        </article>

        {/* CROSS LINKING SECTION */}
        <CrossLinkingSection currentPath="/tai-video-youtube" />

        {/* UPSELL CARD */}
        <div className="mt-8">
          <UpsellCard
            message="🚀 Bạn là Nhà Sáng Tạo Nội Dung? Hãy biến video YouTube thành video viral trên TikTok/Reels với công cụ Lồng Tiếng AI siêu nhanh!"
            ctaText="🔥 Trải Nghiệm Studio Lồng Tiếng AI Ngay"
          />
        </div>

        {/* FOOTER */}
        <ToolFooter />
      </main>
    </div>
  );
}
