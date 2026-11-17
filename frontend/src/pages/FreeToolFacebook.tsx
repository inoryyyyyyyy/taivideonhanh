import API_BASE from '../api';
import { useState } from 'react';
import { trackPixelEvent } from '../utils/analytics';
import SeoHead from '../components/SeoHead';
import { ToolHeader, CrossLinkingSection, UpsellCard, ToolFooter } from '../components/FreeToolLayout';

export default function FreeToolFacebook() {
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
        setError(data.message || 'Không thể tải video Facebook này. Vui lòng kiểm tra lại link!');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ. Vui lòng thử lại sau!');
    } finally {
      setLoading(false);
    }
  };

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': 'Công Cụ Tải Video Facebook HD - TaiVideoNhanh',
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
      'ratingCount': '1420'
    },
    'description': 'Tải video Facebook HD/Full HD miễn phí về máy tính, điện thoại. Công cụ download video FB nhanh nhất 2026, hỗ trợ Reels, Stories, video công khai.'
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': 'Tải video Facebook HD tại TaiVideoNhanh có tốn phí không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Hoàn toàn miễn phí 100%! Bạn có thể tải không giới hạn số lượng video Facebook HD, Reels, Watch về máy tính hoặc điện thoại mà không cần trả bất kỳ khoản phí nào hay đăng ký tài khoản.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Công cụ có hỗ trợ tải video Facebook chất lượng 1080p, Full HD hay 4K không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Có. TaiVideoNhanh luôn tự động bóc tách và cung cấp link tải ở độ phân giải cao nhất mà video gốc trên Facebook có, bao gồm HD 720p, Full HD 1080p và 4K (nếu nguồn video hỗ trợ).'
        }
      },
      {
        '@type': 'Question',
        'name': 'Làm sao để tải video Facebook Reels hoặc Stories về điện thoại iPhone/Android?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Bạn chỉ cần bấm nút Chia sẻ (Share) dưới video Reels hoặc Story Facebook, chọn Sao chép liên kết (Copy Link). Sau đó mở trình duyệt web dán link vào TaiVideoNhanh.com và nhấn Tải Video HD.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Tôi có thể tải video từ nhóm kín (Group riêng tư) hoặc trang cá nhân riêng tư không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Công cụ tối ưu tốt nhất cho các video ở chế độ công khai (Public) trên Fanpage, Facebook Watch, Reels và Group công khai. Các video riêng tư bị bảo vệ bởi quyền truy cập của Facebook nên không thể lấy trực tiếp.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Video Facebook tải về được lưu ở đâu trên thiết bị của tôi?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Trên máy tính, file MP4 sẽ nằm trong thư mục Downloads. Trên điện thoại Android và iPhone (iOS), video sẽ được lưu trực tiếp vào ứng dụng Quản lý tệp (Files) hoặc Thư viện ảnh (Photos).'
        }
      },
      {
        '@type': 'Question',
        'name': 'TaiVideoNhanh có lưu trữ video hoặc thông tin cá nhân của người dùng không?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Không. Chúng tôi tôn trọng quyền riêng tư tuyệt đối của người dùng. Hệ thống không lưu trữ bất kỳ file video nào trên máy chủ và không thu thập thông tin cá nhân hay tài khoản Facebook.'
        }
      }
    ]
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': 'Cách Tải Video Facebook HD Về Máy Tính & Điện Thoại',
    'description': 'Hướng dẫn chi tiết từng bước tải video Facebook chất lượng cao HD, Full HD miễn phí không cần cài đặt phần mềm.',
    'step': [
      {
        '@type': 'HowToStep',
        'name': 'Bước 1: Sao chép liên kết video Facebook',
        'text': 'Mở ứng dụng Facebook hoặc trang web facebook.com, chọn video, Reels hoặc Story cần tải. Nhấn nút Chia sẻ (Share) -> chọn Sao chép liên kết (Copy Link).'
      },
      {
        '@type': 'HowToStep',
        'name': 'Bước 2: Dán liên kết vào TaiVideoNhanh',
        'text': 'Truy cập trang web TaiVideoNhanh.com/tai-video-facebook-hd và dán liên kết vừa sao chép vào ô tìm kiếm.'
      },
      {
        '@type': 'HowToStep',
        'name': 'Bước 3: Tải video Facebook HD về máy',
        'text': 'Nhấn nút Tải Video HD, hệ thống sẽ xử lý bóc tách trong 0.3 giây. Nhấn Tải Video MP4 HD để hoàn tất lưu về máy.'
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#f3efe8] font-sans text-[#2d2218]">
      <SeoHead
        title="Tải Video Facebook HD Miễn Phí - Download Video FB Nhanh | TaiVideoNhanh"
        description="Tải video Facebook HD/Full HD miễn phí về máy tính, điện thoại. Công cụ download video FB nhanh nhất 2026, hỗ trợ Reels, Stories, video công khai."
        canonical="https://taivideonhanh.com/tai-video-facebook-hd"
        schemas={[softwareAppSchema, faqSchema, howToSchema]}
      />

      <ToolHeader badgeText="FB TOOL" />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* HERO TITLE HEADER */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-[#a2d5c6] text-[#2d2218] font-extrabold text-sm rounded-full border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] mb-4">
            🔥 Miễn Phí 100% - Tải Video FB HD Siêu Tốc
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-[#2d2218] mb-4 leading-tight">
            Tải Video Facebook HD Miễn Phí
          </h1>
          <p className="text-base sm:text-lg font-medium text-[#6b5a4b] max-w-2xl mx-auto">
            Công cụ hỗ trợ <b>download video facebook</b> chất lượng cao, <b>tải video fb</b> Reels, Watch và Stories về máy tính, điện thoại cực nhanh trong 0.3 giây mà không cần cài đặt phần mềm!
          </p>
        </div>

        {/* SEARCH FORM */}
        <form onSubmit={handleDownload} className="bg-white p-4 sm:p-6 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Dán link video Facebook vào đây (VD: https://www.facebook.com/watch/...)"
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

        {/* ERROR STATE */}
        {error && (
          <div className="p-4 mb-8 bg-[#fce4ec] border-2 border-[#2d2218] rounded-2xl text-[#c62828] font-bold text-center">
            ❌ {error}
          </div>
        )}

        {/* RESULT DISPLAY */}
        {result && (
          <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 shadow-[8px_8px_0px_#2d2218] mb-12">
            <h2 className="text-xl font-black text-[#2d2218] mb-4 text-center">🎉 Kết Quả Tải Video Facebook HD</h2>
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {result.cover_url && (
                <img src={result.cover_url} alt="Cover Facebook Video" className="w-48 h-64 object-cover rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218]" />
              )}
              <div className="flex-1 text-center md:text-left space-y-4">
                <h3 className="font-bold text-[#2d2218] text-lg line-clamp-3">{result.title || 'Video Facebook HD'}</h3>
                
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <a
                    href={`${API_BASE}/api/download?b64=${btoa(result.video_url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}&title=${encodeURIComponent(result.title || '')}`}
                    download
                    onClick={() => trackPixelEvent('StartTrial')}
                    className="px-6 py-3 bg-[#a2d5c6] text-[#2d2218] font-black rounded-xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-sm hover:translate-y-[1px] inline-flex items-center gap-2"
                  >
                    📥 Tải Video MP4 HD
                  </a>
                </div>

                <UpsellCard
                  message="✨ Bạn muốn TỰ ĐỘNG LỒNG TIẾNG TIẾNG VIỆT chuẩn giọng đọc chuyên nghiệp cho video này để Reup đăng TikTok, Reels, YouTube Shorts?"
                  ctaText="🎙️ Thử Lồng Tiếng AI Ngay Phút Này (Chỉ từ 2.000đ)"
                />
              </div>
            </div>
          </div>
        )}

        {/* LONG SEO ARTICLE CONTENT */}
        <article className="prose max-w-none bg-white p-6 sm:p-10 rounded-3xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] space-y-8 text-[#2d2218]">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black mb-4">
              Hướng Dẫn Tải Video Facebook HD Miễn Phí
            </h2>
            <p className="font-medium text-[#6b5a4b] leading-relaxed mb-4">
              Facebook hiện nay là nền tảng mạng xã hội video bùng nổ hàng đầu thế giới với hệ sinh thái đa dạng gồm Facebook Watch, Facebook Reels, các đoạn clip ngắn trên Fanpage và các đoạn tin 24h (Stories). Hàng ngày, hàng triệu video giải trí, clip bài giảng, review sản phẩm và tin tức được chia sẻ. Tuy nhiên, Facebook không cung cấp nút tải trực tiếp video về thiết bị ở độ phân giải gốc cao nhất.
            </p>
            <p className="font-medium text-[#6b5a4b] leading-relaxed">
              Nhằm giải quyết nhu cầu lưu trữ video chất lượng sắc nét của người dùng và các nhà sáng tạo nội dung, công cụ <b>Tải Video Facebook HD</b> tại <b>TaiVideoNhanh.com</b> ra đời. Chỉ với 1 thao tác dán link đơn giản, bạn có thể thực hiện <b>download video facebook</b> chất lượng cao, <b>tải video fb</b> mượt mà hoàn toàn miễn phí mà không cần cài thêm ứng dụng hay đăng nhập tài khoản cá nhân.
            </p>
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">
              Cách Tải Video Facebook Về Máy Tính & Điện Thoại
            </h3>
            <p className="font-medium text-[#6b5a4b] leading-relaxed mb-4">
              Dù bạn đang sử dụng máy tính để bàn (PC, Laptop, Mac) hay thiết bị di động (iPhone, iPad, điện thoại Android), việc <b>tải video facebook về máy</b> với TaiVideoNhanh vô cùng đơn giản qua các bước sau:
            </p>
            
            <div className="space-y-4">
              <div className="bg-[#fdf9f1] p-4 rounded-2xl border-2 border-[#2d2218]">
                <h4 className="font-extrabold text-[#2d2218] text-base mb-2">🖥️ Hướng dẫn dành cho Máy tính (Windows / macOS / Linux):</h4>
                <ol className="list-decimal pl-6 space-y-1.5 font-medium text-[#6b5a4b] text-sm">
                  <li>Truy cập Facebook trên trình duyệt (Chrome, Edge, Firefox, Safari) và mở video bạn muốn tải.</li>
                  <li>Nhấn vào nút <b>Chia sẻ (Share)</b> ngay dưới video và chọn <b>Sao chép liên kết (Copy Link)</b>, hoặc copy toàn bộ đường dẫn trên thanh địa chỉ trình duyệt.</li>
                  <li>Mở website <b>TaiVideoNhanh.com/tai-video-facebook-hd</b> và dán liên kết vừa chép vào khung tìm kiếm.</li>
                  <li>Nhấn nút <b>Tải Video HD</b>. Sau 0.3 giây xử lý, bấm nút <b>Tải Video MP4 HD</b> để tải tệp về thư mục Downloads.</li>
                </ol>
              </div>

              <div className="bg-[#fdf9f1] p-4 rounded-2xl border-2 border-[#2d2218]">
                <h4 className="font-extrabold text-[#2d2218] text-base mb-2">📱 Hướng dẫn dành cho Điện thoại (iPhone / iPad / Android):</h4>
                <ol className="list-decimal pl-6 space-y-1.5 font-medium text-[#6b5a4b] text-sm">
                  <li>Mở ứng dụng Facebook trên di động, chọn video, Reels hoặc Story cần lưu lại.</li>
                  <li>Nhấn vào biểu tượng <b>Chia sẻ</b> góc dưới bên phải video, chọn menu tùy chọn và chọn <b>Sao chép liên kết</b>.</li>
                  <li>Mở ứng dụng trình duyệt web (Safari trên iPhone hoặc Chrome trên Android) và truy cập <b>TaiVideoNhanh.com/tai-video-facebook-hd</b>.</li>
                  <li>Dán đường link vào ô nhập liệu, bấm <b>Tải Video HD</b> và lưu trực tiếp video sắc nét vào ứng dụng Quản lý tệp hoặc Thư viện ảnh.</li>
                </ol>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">
              Hỗ Trợ Tải Video Facebook Reels, Stories, Video Công Khai
            </h3>
            <p className="font-medium text-[#6b5a4b] leading-relaxed mb-4">
              Công cụ <b>tải video facebook chất lượng cao</b> của TaiVideoNhanh được lập trình tối ưu hóa thuật toán để bóc tách đa dạng định dạng nội dung trên Facebook:
            </p>
            <ul className="list-disc pl-6 space-y-2 font-medium text-[#6b5a4b]">
              <li><b>Facebook Reels Downloader:</b> Tải các đoạn video ngắn chuẩn tỉ lệ 9:16 sắc nét HD. Đây là nguồn tư liệu dồi dào để các Content Creator tìm kiếm ý tưởng Reup sáng tạo.</li>
              <li><b>Facebook Watch & Video Fanpage:</b> Tải trọn bộ các video dài, clip phóng sự, bài học kinh doanh, tin tức trực tuyến từ các Fanpage lớn với tốc độ cao.</li>
              <li><b>Facebook Stories Saver:</b> Lưu trữ các đoạn khoảnh khắc Story phát hành trong 24 giờ của bạn bè, thần tượng trước khi chúng bị ẩn tự động.</li>
              <li><b>Video Group Công Khai (Public Group):</b> Dễ dàng tải xuống các clip chia sẻ kinh nghiệm, hướng dẫn thủ thuật từ các nhóm cộng đồng mở.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">
              Tại Sao Nên Sử Dụng TaiVideoNhanh Để Tải Video Facebook?
            </h3>
            <p className="font-medium text-[#6b5a4b] leading-relaxed mb-4">
              Giữa hàng loạt trình tải video trực tuyến hiện nay, <b>TaiVideoNhanh.com</b> tự hào là sự lựa chọn ưu việt hàng đầu cho người dùng Việt Nam nhờ những ưu điểm vượt trội:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
              <div className="p-4 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h4 className="font-bold text-[#2d2218] text-base mb-1">⚡ Siêu Tốc 0.3 Giây</h4>
                <p className="text-xs font-medium text-[#6b5a4b]">Bóc tách dữ liệu máy chủ Facebook lập tức, không để bạn phải chờ đợi lâu.</p>
              </div>
              <div className="p-4 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h4 className="font-bold text-[#2d2218] text-base mb-1">🎬 Chất Lượng HD & Full HD</h4>
                <p className="text-xs font-medium text-[#6b5a4b]">Giữ nguyên độ phân giải chuẩn gốc 720p, 1080p, không bị nén mờ hình ảnh.</p>
              </div>
              <div className="p-4 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h4 className="font-bold text-[#2d2218] text-base mb-1">🔒 100% An Toàn & Bảo Mật</h4>
                <p className="text-xs font-medium text-[#6b5a4b]">Không yêu cầu nhập tài khoản Facebook, bảo vệ an toàn 100% khỏi nguy cơ mất acc.</p>
              </div>
              <div className="p-4 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h4 className="font-bold text-[#2d2218] text-base mb-1">💰 Miễn Phí Không Giới Hạn</h4>
                <p className="text-xs font-medium text-[#6b5a4b]">Sử dụng hoàn toàn miễn phí 100%, không bắt đăng ký hay giới hạn lượt tải mỗi ngày.</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">
              Bảng So Sánh Tính Năng
            </h3>
            <p className="font-medium text-[#6b5a4b] leading-relaxed mb-4">
              Hãy cùng so sánh hiệu quả giữa việc dùng TaiVideoNhanh với các phương pháp tải hay quay màn hình thông thường:
            </p>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-left border-collapse border-2 border-[#2d2218]">
                <thead>
                  <tr className="bg-[#a2d5c6] text-[#2d2218] text-sm sm:text-base">
                    <th className="p-3 border-2 border-[#2d2218] font-black">Tiêu chí so sánh</th>
                    <th className="p-3 border-2 border-[#2d2218] font-black bg-[#f6a287]/40">TaiVideoNhanh.com</th>
                    <th className="p-3 border-2 border-[#2d2218] font-black">Phần mềm / App khác</th>
                    <th className="p-3 border-2 border-[#2d2218] font-black">Quay màn hình</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm font-medium">
                  <tr className="border-b border-[#2d2218] bg-white">
                    <td className="p-3 border-2 border-[#2d2218] font-bold">Chất lượng Video</td>
                    <td className="p-3 border-2 border-[#2d2218] font-bold bg-[#f6a287]/10 text-emerald-900">HD / Full HD 1080p Gốc</td>
                    <td className="p-3 border-2 border-[#2d2218]">Thường bị nén còn 480p</td>
                    <td className="p-3 border-2 border-[#2d2218]">Bị mờ, giật khung hình</td>
                  </tr>
                  <tr className="border-b border-[#2d2218] bg-[#fdf9f1]">
                    <td className="p-3 border-2 border-[#2d2218] font-bold">Tốc độ tải xuống</td>
                    <td className="p-3 border-2 border-[#2d2218] font-bold bg-[#f6a287]/10 text-emerald-900">Siêu tốc 0.3 giây</td>
                    <td className="p-3 border-2 border-[#2d2218]">Chờ quảng cáo 30s - 1 phút</td>
                    <td className="p-3 border-2 border-[#2d2218]">Tốn thời gian bằng độ dài video</td>
                  </tr>
                  <tr className="border-b border-[#2d2218] bg-white">
                    <td className="p-3 border-2 border-[#2d2218] font-bold">Cài đặt phần mềm</td>
                    <td className="p-3 border-2 border-[#2d2218] font-bold bg-[#f6a287]/10 text-emerald-900">Không cần cài gì (Trực tiếp Web)</td>
                    <td className="p-3 border-2 border-[#2d2218]">Phải cài Extension / App nặng</td>
                    <td className="p-3 border-2 border-[#2d2218]">Cần phần mềm quay màn hình</td>
                  </tr>
                  <tr className="border-b border-[#2d2218] bg-[#fdf9f1]">
                    <td className="p-3 border-2 border-[#2d2218] font-bold">Bảo mật & Quyền riêng tư</td>
                    <td className="p-3 border-2 border-[#2d2218] font-bold bg-[#f6a287]/10 text-emerald-900">100% An toàn, không lộ Cookie</td>
                    <td className="p-3 border-2 border-[#2d2218]">Dễ dính mã độc / Checkpoint FB</td>
                    <td className="p-3 border-2 border-[#2d2218]">An toàn nhưng dính tạp âm</td>
                  </tr>
                  <tr className="border-b border-[#2d2218] bg-white">
                    <td className="p-3 border-2 border-[#2d2218] font-bold">Chi phí sử dụng</td>
                    <td className="p-3 border-2 border-[#2d2218] font-bold bg-[#f6a287]/10 text-emerald-900">Miễn phí 100% Vĩnh viễn</td>
                    <td className="p-3 border-2 border-[#2d2218]">Thường bắt trả phí VIP</td>
                    <td className="p-3 border-2 border-[#2d2218]">Miễn phí nhưng tốn dung lượng</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black mb-6">
              Câu Hỏi Thường Gặp Về Tải Video Facebook
            </h2>
            <div className="space-y-6">
              <div className="p-5 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h3 className="font-bold text-[#2d2218] text-base sm:text-lg mb-2">
                  1. Tải video Facebook HD tại TaiVideoNhanh có tốn phí không?
                </h3>
                <p className="text-sm text-[#6b5a4b] font-medium leading-relaxed">
                  Hoàn toàn miễn phí 100%! Bạn có thể tải không giới hạn số lượng video Facebook HD, Reels, Watch về máy tính hoặc điện thoại mà không cần trả bất kỳ khoản phí nào hay đăng ký tài khoản.
                </p>
              </div>

              <div className="p-5 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h3 className="font-bold text-[#2d2218] text-base sm:text-lg mb-2">
                  2. Công cụ có hỗ trợ tải video Facebook chất lượng 1080p, Full HD hay 4K không?
                </h3>
                <p className="text-sm text-[#6b5a4b] font-medium leading-relaxed">
                  Có. TaiVideoNhanh luôn tự động bóc tách và cung cấp link tải ở độ phân giải cao nhất mà video gốc trên Facebook có, bao gồm HD 720p, Full HD 1080p và 4K (nếu nguồn video gốc hỗ trợ).
                </p>
              </div>

              <div className="p-5 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h3 className="font-bold text-[#2d2218] text-base sm:text-lg mb-2">
                  3. Làm sao để tải video Facebook Reels hoặc Stories về điện thoại iPhone/Android?
                </h3>
                <p className="text-sm text-[#6b5a4b] font-medium leading-relaxed">
                  Bạn chỉ cần bấm nút Chia sẻ (Share) dưới video Reels hoặc Story Facebook, chọn Sao chép liên kết (Copy Link). Sau đó mở trình duyệt web dán link vào TaiVideoNhanh.com và nhấn Tải Video HD.
                </p>
              </div>

              <div className="p-5 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h3 className="font-bold text-[#2d2218] text-base sm:text-lg mb-2">
                  4. Tôi có thể tải video từ nhóm kín (Group riêng tư) hoặc trang cá nhân riêng tư không?
                </h3>
                <p className="text-sm text-[#6b5a4b] font-medium leading-relaxed">
                  Công cụ tối ưu tốt nhất cho các video ở chế độ công khai (Public) trên Fanpage, Facebook Watch, Reels và Group công khai. Các video riêng tư bị bảo vệ bởi quyền truy cập của Facebook nên không thể lấy trực tiếp.
                </p>
              </div>

              <div className="p-5 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h3 className="font-bold text-[#2d2218] text-base sm:text-lg mb-2">
                  5. Video Facebook tải về được lưu ở đâu trên thiết bị của tôi?
                </h3>
                <p className="text-sm text-[#6b5a4b] font-medium leading-relaxed">
                  Trên máy tính, file MP4 sẽ nằm trong thư mục Downloads. Trên điện thoại Android và iPhone (iOS), video sẽ được lưu trực tiếp vào ứng dụng Quản lý tệp (Files) hoặc Thư viện ảnh (Photos).
                </p>
              </div>

              <div className="p-5 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl">
                <h3 className="font-bold text-[#2d2218] text-base sm:text-lg mb-2">
                  6. TaiVideoNhanh có lưu trữ video hoặc thông tin cá nhân của người dùng không?
                </h3>
                <p className="text-sm text-[#6b5a4b] font-medium leading-relaxed">
                  Không. Chúng tôi tôn trọng quyền riêng tư tuyệt đối của người dùng. Hệ thống không lưu trữ bất kỳ file video nào trên máy chủ và không thu thập thông tin cá nhân hay tài khoản Facebook.
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* CROSS LINKING SECTION */}
        <CrossLinkingSection currentPath="/tai-video-facebook-hd" />

        {/* BOTTOM UPSELL CARD */}
        <UpsellCard
          message="🚀 Bạn đang xây dựng kênh Reup Facebook / TikTok? Hãy dùng thử Studio Lồng Tiếng AI tự động chuyển đổi giọng đọc chuẩn điện ảnh!"
          ctaText="🎙️ Truy Cập Studio Lồng Tiếng AI Ngay"
        />
      </main>

      <ToolFooter />
    </div>
  );
}
