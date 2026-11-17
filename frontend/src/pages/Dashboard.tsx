import API_BASE from '../api';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { trackPixelEvent, trackCustomEvent } from '../utils/analytics';
import VoiceLibraryModal from '../components/VoiceLibraryModal';
export default function Dashboard() {
  const { user } = useAuth();
  
  const [payCode, setPayCode] = useState<string | null>(null);
  
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'dub_only' | 'sub_only' | 'dub_and_sub' | 'reaction'>('dub_only');
  const [voiceCode, setVoiceCode] = useState('hn_female_ngochuyen_full_48k-fhg');
  const [rewriteMode, setRewriteMode] = useState('');
  const [pipPosition, setPipPosition] = useState('top-right');
  const [pipSize, setPipSize] = useState('medium');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [translationStyle, setTranslationStyle] = useState<string>('tiktok');
  const [targetLang, setTargetLang] = useState<'vi' | 'en'>('vi');
  const [shouldEditScript, setShouldEditScript] = useState<boolean>(false);
  const [scriptModalData, setScriptModalData] = useState<any[] | null>(null);
  const [isPreviewingScript, setIsPreviewingScript] = useState<boolean>(false);
  const [voices, setVoices] = useState<Array<{code: string; name: string; preview_url: string; category?: string; gender?: string; age?: string; use_case?: string}>>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);

  const [autoPost, setAutoPost] = useState(false);
  const [autoPostAccounts, setAutoPostAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [autoPostCaption, setAutoPostCaption] = useState('');
  const [autoPostTime, setAutoPostTime] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  useEffect(() => {
    if (autoPost) {
      fetchAutoPostAccounts();
    }
  }, [autoPost]);

  const fetchAutoPostAccounts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/postforme/accounts`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (data.data) {
        setAutoPostAccounts(data.data);
        if (data.data.length > 0) {
          setSelectedAccountId(data.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateCaption = async () => {
    if (!videoData?.title) {
      alert("Chưa có tiêu đề video để sinh caption!");
      return;
    }
    setIsGeneratingCaption(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/postforme/generate-caption`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic: videoData.title })
      });
      const data = await res.json();
      if (data.caption) {
        setAutoPostCaption(data.caption);
      }
    } catch (e) {
      alert("Lỗi tạo caption");
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  useEffect(() => {
    const fetchVoicesData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Lấy danh sách yêu thích
        if (session) {
          const favRes = await fetch(`${API_BASE}/api/favorites`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          const favData = await favRes.json();
          if (favData.favorites) {
            setFavorites(favData.favorites);
          }
        }
        
        // Lấy danh sách giọng đọc
        const res = await fetch(`${API_BASE}/api/voices`);
        const data = await res.json();
        if (data.voices && data.voices.length > 0) {
          setVoices(data.voices);
        }
      } catch(e) {}
    };
    fetchVoicesData();
  }, []);

  const handleTogglePreview = (vCode: string) => {
    if (playingVoice === vCode && audioObj) {
      audioObj.pause();
      setPlayingVoice(null);
      return;
    }

    if (audioObj) {
      audioObj.pause();
    }

    const newAudio = new Audio(`${API_BASE}/api/voice-preview/${vCode}?t=${Date.now()}`);
    newAudio.play();
    setAudioObj(newAudio);
    setPlayingVoice(vCode);

    newAudio.onended = () => {
      setPlayingVoice(null);
    };
  };

  
  // Trạng thái chung của Dashboard
  const [status, setStatus] = useState<'idle' | 'fetching_info' | 'info_ready' | 'processing' | 'done' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [videoData, setVideoData] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState('');
  const [translatedImageModal, setTranslatedImageModal] = useState<any>(null);
  const [batchTranslatedModal, setBatchTranslatedModal] = useState<any[] | null>(null);
  const [isTranslatingImage, setIsTranslatingImage] = useState<boolean>(false);
  const [isTranslatingAll, setIsTranslatingAll] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      fetchPayCode();
    }
  }, [user]);

  const fetchPayCode = async () => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('pay_code')
        .eq('user_id', user?.id)
        .single();
      if (!error && data) {
        setPayCode(data.pay_code);
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (showDepositModal) {
      trackPixelEvent('InitiateCheckout');
    }
  }, [showDepositModal]);

  const handleGetInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setStatus('fetching_info');
    setResultMessage('');
    setVideoData(null);
    setJobId(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error('Lỗi phản hồi từ máy chủ. Vui lòng kiểm tra lại đường link.');
      }
      
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Không thể lấy thông tin video');
      }
      
      setVideoData(data.data);
      setStatus('info_ready');
    } catch (error: any) {
      setStatus('error');
      setResultMessage(error.message || 'Lỗi kết nối máy chủ');
    }
  };

  const handleStartAI = async (overrideSegments?: any[]) => {
    if (!videoData) return;
    
    trackCustomEvent('SubmitVideoUrl', { url: videoData.video_url || videoData.url || '' });

    // Nếu người dùng bật tùy chọn Sửa Kịch Bản và chưa sửa (overrideSegments chưa có), gọi API xem trước kịch bản
    if (shouldEditScript && !overrideSegments) {
      if (isPreviewingScript) return;
      setIsPreviewingScript(true);
      try {
        const res = await fetch(`${API_BASE}/api/preview_script`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_url: videoData.video_url || videoData.url || '',
            original_url: videoData.url || '',
            translation_style: translationStyle,
            target_language: targetLang
          })
        });
        const data = await res.json();
        if (data.status === 'success' && data.segments) {
          setScriptModalData(data.segments);
        } else {
          alert(data.message || 'Lỗi khi trích xuất kịch bản');
        }
      } catch (e) {
        alert('Lỗi kết nối trích xuất kịch bản');
      } finally {
        setIsPreviewingScript(false);
      }
      return;
    }

    setStatus('processing');
    setAiStatus('Khởi tạo công việc...');
    setScriptModalData(null); // Đóng modal kịch bản nếu đang mở
    
    try {
      // 1. Gửi yêu cầu bắt đầu lồng tiếng
      const res = await fetch(`${API_BASE}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          video_url: videoData.video_url || videoData.url || '',
          original_url: videoData.url || '',
          title: videoData.title || '',
          cover_url: videoData.thumbnail || videoData.cover_url || '',
          mode: mode,
          voice_code: voiceCode,
          translation_style: translationStyle,
          rewrite_mode: rewriteMode || undefined,
          pip_position: pipPosition,
          pip_size: pipSize,
          custom_segments: overrideSegments || null,
          no_speech: false,
          target_language: targetLang,
          autopost: autoPost,
          autopost_account_id: selectedAccountId || null,
          autopost_caption: autoPostCaption || null,
          autopost_time: autoPostTime ? new Date(autoPostTime).toISOString() : null
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Không thể bắt đầu xử lý');
      
      const currentJobId = data.job_id;
      setJobId(currentJobId);
      setAiStatus('Đang tải và xử lý video...');
      
      // 2. Poll trạng thái
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/status/${currentJobId}`);
          const statusData = await statusRes.json();
          
          if (statusData.is_done) {
            clearInterval(pollInterval);
            if (statusData.db_job_id) setJobId(statusData.db_job_id);
            setStatus('done');
            trackCustomEvent('VideoProcessedSuccess', { url: videoData.video_url || videoData.url || '' });
            // Cập nhật lại số dư
            window.dispatchEvent(new Event('balanceUpdated'));
          } else if (statusData.is_error) {
            clearInterval(pollInterval);
            setStatus('error');
            setResultMessage('Lỗi khi xử lý video: ' + (statusData.status || 'Unknown'));
          } else {
            setAiStatus(statusData.status || 'Đang xử lý...');
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 3000);
      
    } catch (error: any) {
      setStatus('error');
      setResultMessage(error.message);
    }
  };

  return (
    <>
        <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-start p-4 sm:p-8 md:p-12">
          
          <div className="w-full bg-white border-[3px] border-[#2d2218] rounded-3xl p-6 sm:p-10 shadow-[8px_8px_0px_#2d2218]">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-5xl font-black text-[#2d2218] mb-3">Khu Vực Studio</h1>
              <p className="text-[#6b5a4b] font-medium text-base sm:text-lg">Dán link chia sẻ video để bắt đầu lồng tiếng tự động.</p>
            </div>
            
            {/* Input Box */}
            <div className="relative w-full bg-[#fdf8ef] border-[3px] border-dashed border-[#2d2218] rounded-2xl p-3 sm:p-4 mb-8">
            <form onSubmit={handleGetInfo} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text');
                  // Replace newlines with spaces so it stays on one line in the UI, but preserves the URL
                  setUrl(text.replace(/[\r\n]+/g, ' '));
                }}
                placeholder="Dán link chia sẻ video vào đây..."
                className="flex-1 px-6 py-4 bg-transparent outline-none text-[#2d2218] font-medium placeholder:text-[#a08f7f] text-lg rounded-2xl border-2 border-transparent focus:border-[#2d2218] transition-all bg-white"
                required
              />
              <button
                type="submit"
                disabled={status === 'fetching_info' || status === 'processing' || !url}
                className="bg-[#a2d5c6] sm:w-auto w-full px-8 py-4 rounded-2xl border-2 border-[#2d2218] font-bold text-[#2d2218] text-lg hover:bg-[#8ec2b3] transition-all shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'fetching_info' ? 'Đang lấy data...' : 'Phân Tích'}
              </button>
            </form>
          </div>

          {/* Hệ thống thông báo lỗi thông minh & Hướng dẫn xử lý cho người dùng */}
          {status === 'error' && (
            <div className="mb-8 p-6 sm:p-8 bg-[#fff0f0] border-[3px] border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] animate-in fade-in zoom-in-95 duration-200">
              {/* Banner An tâm Hoàn tiền 100% */}
              <div className="flex items-center gap-3 bg-[#a2d5c6] p-3.5 px-5 border-2 border-[#2d2218] rounded-2xl shadow-[3px_3px_0px_#2d2218] mb-6">
                <span className="text-2xl">🛡️</span>
                <div>
                  <p className="font-black text-[#2d2218] text-sm sm:text-base">AN TÂM TUYỆT ĐỐI 100%</p>
                  <p className="text-[#2d2218] text-xs sm:text-sm font-medium">Hệ thống đã tự động hoàn lại 100% tiền vào ví của bạn (nếu có trừ trước đó).</p>
                </div>
              </div>

              {/* Tiêu đề & Nguyên nhân lỗi dễ hiểu */}
              <div className="flex items-start gap-4 mb-4">
                <span className="text-4xl shrink-0">⚠️</span>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-[#2d2218] mb-1">
                    {resultMessage.toLowerCase().includes('tiktokcdn') || resultMessage.toLowerCase().includes('v16') || resultMessage.toLowerCase().includes('v19')
                      ? 'Đường Link TikTok Chưa Đúng Định Dạng'
                      : resultMessage.toLowerCase().includes('facebook') || resultMessage.toLowerCase().includes('fb.watch')
                      ? 'Video Facebook Riêng Tư Hoặc Hạn Chế'
                      : 'Chưa Thể Phân Tích Video Này'}
                  </h3>
                  <p className="text-[#4a3b2c] font-medium text-sm sm:text-base leading-relaxed">
                    {resultMessage.toLowerCase().includes('tiktokcdn') || resultMessage.toLowerCase().includes('v16') || resultMessage.toLowerCase().includes('v19')
                      ? 'Đường link bạn vừa dán là link luồng tạm thời từ TikTok (mã CDN), loại link này sẽ bị hệ thống TikTok chặn kết nối sau vài giây.'
                      : resultMessage.toLowerCase().includes('facebook') || resultMessage.toLowerCase().includes('fb.watch')
                      ? 'Video Facebook này đang để ở chế độ Riêng tư hoặc thuộc Nhóm kín nên hệ thống chưa có quyền truy cập.'
                      : resultMessage}
                  </p>
                </div>
              </div>

              {/* Khối Hướng Dẫn Khắc Phục Chi Tiết */}
              <div className="bg-white border-2 border-[#2d2218] rounded-2xl p-4 sm:p-5 mb-6 shadow-[4px_4px_0px_#2d2218]">
                <h4 className="font-bold text-[#2d2218] text-base mb-3 flex items-center gap-2">
                  <span>💡</span> Hướng dẫn khắc phục siêu đơn giản:
                </h4>
                <ul className="space-y-2.5 text-sm text-[#4a3b2c] font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-[#e65c4f] font-black">1.</span>
                    <span><b>Với TikTok:</b> Mở App TikTok ➔ Bấm nút <b>Chia sẻ</b> (Share) ➔ Chọn <b>Sao chép liên kết</b> (Link chuẩn có dạng <i>https://vt.tiktok.com/...</i> hoặc <i>https://www.tiktok.com/@user/video/...</i>).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#e65c4f] font-black">2.</span>
                    <span><b>Với Facebook / Douyin / Xiaohongshu:</b> Đảm bảo video đang ở chế độ Công khai (Public).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#e65c4f] font-black">3.</span>
                    <span>Dán lại đường link mới sao chép vào ô tìm kiếm bên trên và bấm <b>Phân Tích</b>.</span>
                  </li>
                </ul>
              </div>

              {/* Các Nút Thao Tác Nhanh */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setStatus('idle');
                    setResultMessage('');
                    setTimeout(() => {
                      document.getElementById('url')?.focus();
                    }, 100);
                  }}
                  className="flex-1 min-w-[200px] bg-[#f6a287] text-[#2d2218] px-6 py-3.5 rounded-2xl font-bold border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all text-center"
                >
                  🔄 Đã Hiểu - Dán Lại Link Mới
                </button>
                
                <button
                  onClick={() => {
                    setShowDepositModal(true);
                  }}
                  className="bg-white text-[#2d2218] px-6 py-3.5 rounded-2xl font-bold border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all text-center"
                >
                  💰 Kiểm Tra Ví & Nạp Tiền
                </button>
              </div>
            </div>
          )}

          {/* Card Thông tin Video */}
          {(status === 'info_ready' || status === 'processing' || status === 'done') && videoData && (
             <div className="bg-white border-[3px] border-[#2d2218] rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#2d2218] animate-in fade-in zoom-in-95 duration-300">
               <div className="flex flex-col sm:flex-row gap-6 mb-8 items-center sm:items-start text-center sm:text-left">
                 
                 {videoData.cover_url && (
<div className="w-full sm:w-1/3 aspect-[9/16] sm:aspect-square rounded-2xl overflow-hidden border-2 border-[#2d2218] shrink-0">
                      <img 
                        src={videoData.cover_url.replace(/^http:\/\//i, 'https://')} 
                        referrerPolicy="no-referrer"
                        alt="Thumbnail" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                 )}
                 
                 <div className="flex-1 flex flex-col justify-center">
                   <h3 className="text-xl sm:text-2xl font-bold text-[#2d2218] mb-2 line-clamp-2">
                     {videoData.title || "Video không có tiêu đề"}
                   </h3>
                    <span className="inline-block px-3 py-1 bg-[#e8f1f2] border-2 border-[#2d2218] rounded-full text-xs font-bold text-[#2d2218] w-max mx-auto sm:mx-0">
                      {videoData.duration ? `⏱️ Thời lượng: ${videoData.duration >= 60 ? `${Math.floor(videoData.duration / 60)} phút ${videoData.duration % 60}s` : `${videoData.duration}s`} • ` : ''}Nguồn: {videoData.platform || 'N/A'}
                    </span>
                 </div>
               </div>

               {/* NẾU LÀ BÀI VIẾT BỘ SƯU TẬP ẢNH (Image Carousel) */}
               {status === 'info_ready' && (videoData.type === 'image' || (videoData.images && videoData.images.length > 0)) ? (
                 <div className="flex flex-col gap-6">
                   <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
                     <div>
                       <span className="inline-block px-3 py-1 bg-[#a2d5c6] border-2 border-[#2d2218] rounded-full text-xs font-black text-[#2d2218] mb-1">
                         📸 Bộ Sưu Tập {videoData.images?.length || 1} Ảnh HD (Không Watermark)
                       </span>
                       <p className="text-xs text-[#6b5a4b] font-medium">Bấm bên dưới để tải trọn bộ về máy trong 1 file ZIP duy nhất</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={async () => {
                            setIsTranslatingAll(true);
                            try {
                              const res = await fetch(`${API_BASE}/api/translate_images_batch`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ urls: videoData.images })
                              });
                              const data = await res.json();
                              if (data.status === 'success') {
                                setBatchTranslatedModal(data.results);
                              } else {
                                alert(data.message || 'Lỗi khi việt hóa album ảnh');
                              }
                            } catch (e) {
                              alert('Lỗi kết nối AI Việt Hóa Hàng Loạt');
                            } finally {
                              setIsTranslatingAll(false);
                            }
                          }}
                          disabled={isTranslatingAll}
                          className="flex-1 sm:flex-initial bg-[#f6a287] text-[#2d2218] px-5 py-3 rounded-xl font-bold border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isTranslatingAll ? '⏳ AI Đang Việt Hóa Tất Cả...' : '🪄 Việt Hóa Tất Cả Ảnh'}
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(`${API_BASE}/api/download_images_zip`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ urls: videoData.images, title: videoData.title })
                              });
                              const blob = await response.blob();
                              const downloadUrl = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = downloadUrl;
                              a.download = `${videoData.title || 'album_anh'}.zip`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                            } catch (err) {
                              alert('Lỗi tải ZIP ảnh');
                            }
                          }}
                          className="flex-1 sm:flex-initial bg-[#e65c4f] text-white px-5 py-3 rounded-xl font-bold border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          📦 Tải Tất Cả Ảnh (.ZIP)
                        </button>
                      </div>
                    </div>

                   {/* Grid Danh sách ảnh HD */}
                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                     {videoData.images?.map((imgUrl: string, idx: number) => (
                       <div key={idx} className="group relative bg-[#f8f6f0] border-2 border-[#2d2218] rounded-2xl overflow-hidden shadow-[4px_4px_0px_#2d2218]">
                         <div className="aspect-square overflow-hidden bg-gray-100">
                           <img 
                             src={imgUrl.replace(/^http:\/\//i, 'https://')} 
                             referrerPolicy="no-referrer"
                             alt={`Ảnh ${idx + 1}`} 
                             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                           />
                         </div>
                         <div className="p-2.5 bg-white border-t-2 border-[#2d2218] flex flex-col gap-2">
                           <div className="flex items-center justify-between">
                             <span className="text-xs font-black text-[#2d2218]"># {idx + 1}</span>
                             <a
                               href={`${API_BASE}/api/download_single_image?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent((videoData.title || 'anh') + '_' + (idx + 1))}`}
                               download
                               className="px-2.5 py-1 bg-[#a2d5c6] text-[#2d2218] rounded-lg border border-[#2d2218] text-xs font-bold hover:bg-[#8ec2b3] transition-all shadow-[2px_2px_0px_#2d2218]"
                             >
                               📥 Tải Ảnh
                             </a>
                           </div>

                           <button
                             onClick={async () => {
                               setIsTranslatingImage(true);
                               try {
                                 const res = await fetch(`${API_BASE}/api/translate_image`, {
                                   method: 'POST',
                                   headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify({ url: imgUrl })
                                 });
                                 const data = await res.json();
                                 if (data.status === 'success') {
                                   setTranslatedImageModal({
                                     ...data.result,
                                     origUrl: imgUrl
                                   });
                                 } else {
                                   alert(data.message || 'Lỗi khi dịch ảnh');
                                 }
                               } catch (e) {
                                 alert('Lỗi kết nối AI Dịch Ảnh');
                               } finally {
                                 setIsTranslatingImage(false);
                               }
                             }}
                             disabled={isTranslatingImage}
                             className="w-full py-1.5 px-2 bg-[#f6a287] text-[#2d2218] rounded-lg border border-[#2d2218] text-xs font-bold hover:bg-[#e65c4f] hover:text-white transition-all shadow-[2px_2px_0px_#2d2218] flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                           >
                             {isTranslatingImage ? '⏳ AI Đang Dịch...' : '🪄 AI Dịch & Việt Hóa'}
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               ) : status === 'info_ready' && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <a 
                     href={`${API_BASE}/api/download?b64=${btoa(videoData.video_url || videoData.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}&title=${encodeURIComponent(videoData.title || '')}`} 
                     download
                     className="w-full text-center bg-[#fdf9f1] text-[#2d2218] px-6 py-4 rounded-2xl font-bold border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all"
                   >
                     📥 Tải Video Gốc (HD)
                   </a>
                   
                   {/* TIKTOK VN FILTER - disabled: !(videoData.platform === 'tiktok' && videoData.region === 'VN') && ( */}
                   <div className="flex flex-col gap-3 col-span-full">
                      {/* Chọn ngôn ngữ đầu ra */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setTargetLang('vi'); if (voiceCode.startsWith('en-')) setVoiceCode('hn_female_ngochuyen_full_48k-fhg'); }}
                          className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${targetLang === 'vi' ? 'bg-[#e65c4f] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-white' : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'}`}
                        >
                          <span className="text-lg block mb-1">🇻🇳</span>
                          Tiếng Việt
                        </button>
                        <button
                          onClick={() => { setTargetLang('en'); setVoiceCode('en-US-Standard-E'); }}
                          className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${targetLang === 'en' ? 'bg-[#3b82f6] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-white' : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'}`}
                        >
                          <span className="text-lg block mb-1">🇺🇸</span>
                          English
                        </button>
                      </div>

                      {/* Chế độ xử lý */}
                     <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                       <button
                         onClick={() => setMode('dub_only')}
                         className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${mode === 'dub_only' ? 'bg-[#f6a287] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-[#2d2218]' : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'}`}
                       >
                         <span className="text-lg block mb-1">🎙️</span>
                         Lồng Tiếng
                         <span className="block text-xs mt-1 opacity-75">3.000đ</span>
                       </button>
                       <button
                         onClick={() => setMode('sub_only')}
                         className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${mode === 'sub_only' ? 'bg-[#a2d5c6] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-[#2d2218]' : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'}`}
                       >
                         <span className="text-lg block mb-1">📝</span>
                         Phụ Đề
                         <span className="block text-xs mt-1 opacity-75">2.000đ</span>
                       </button>
                       <button
                         onClick={() => setMode('dub_and_sub')}
                         className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${mode === 'dub_and_sub' ? 'bg-[#e8d5f5] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-[#2d2218]' : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'}`}
                       >
                         <span className="text-lg block mb-1">🎙️📝</span>
                         Combo
                         <span className="block text-xs mt-1 opacity-75">4.000đ</span>
                       </button>
                       <button
                         onClick={() => setMode('reaction')}
                         className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${mode === 'reaction' ? 'bg-[#ffe885] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-[#2d2218]' : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'}`}
                       >
                         <span className="text-lg block mb-1">🎬</span>
                         Reaction PiP
                         <span className="block text-xs mt-1 opacity-75">5.000đ</span>
                       </button>
                     </div>

                     {mode === 'reaction' && (
                       <div className="space-y-3 p-4 border-2 border-[#2d2218] rounded-xl bg-[#fdf9f1]">
                         <p className="text-sm font-bold text-[#2d2218]">📹 Cấu hình Reaction Video</p>
                         <div className="grid grid-cols-2 gap-3">
                           <div>
                             <label className="text-xs font-bold text-[#6b5a4b]">Vị trí PiP</label>
                             <select value={pipPosition} onChange={e => setPipPosition(e.target.value)} className="w-full px-3 py-2 border-2 border-[#2d2218] rounded-lg text-sm font-bold">
                               <option value="top-right">↗️ Góc trên phải</option>
                               <option value="top-left">↖️ Góc trên trái</option>
                               <option value="bottom-right">↘️ Góc dưới phải</option>
                               <option value="bottom-left">↙️ Góc dưới trái</option>
                             </select>
                           </div>
                           <div>
                             <label className="text-xs font-bold text-[#6b5a4b]">Kích thước</label>
                             <select value={pipSize} onChange={e => setPipSize(e.target.value)} className="w-full px-3 py-2 border-2 border-[#2d2218] rounded-lg text-sm font-bold">
                               <option value="small">Nhỏ (25%)</option>
                               <option value="medium">Vừa (33%)</option>
                               <option value="large">Lớn (40%)</option>
                             </select>
                           </div>
                         </div>
                         <p className="text-xs text-[#6b5a4b]">⚠️ Tính năng này yêu cầu bạn upload video reaction riêng (sẽ ra mắt sớm)</p>
                       </div>
                      )}

                     <div className="bg-[#e8f1f2] px-4 py-3 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]">
                       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                         <div className="flex items-center gap-2">
                           <span className="text-xl">🎵</span>
                           <div>
                             <p className="font-bold text-[#2d2218] text-sm">Video không có lời thoại?</p>
                             <p className="text-xs text-[#6b5a4b]">Dùng tính năng Review Video để AI tự viết kịch bản.</p>
                           </div>
                         </div>
                         <Link to="/review-video" className="bg-[#2d2218] text-white text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap">
                           Dùng ngay &rarr;
                         </Link>
                       </div>
                     </div>

                     {/* Chọn giọng nói (chỉ hiện khi có lồng tiếng) */}
                     {mode !== 'sub_only' && (
                       <div className="bg-white px-4 py-3.5 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]">
                         <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                           <label className="font-bold text-[#2d2218] text-sm flex items-center gap-1.5">
                             🗣️ Chọn giọng đọc AI:
                           </label>
                           <button
                             type="button"
                             onClick={() => handleTogglePreview(voiceCode)}
                             className="text-xs font-bold bg-[#f6a287] text-[#2d2218] px-3 py-1.5 rounded-lg border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218] transition-all flex items-center gap-1 cursor-pointer"
                           >
                             {playingVoice === voiceCode ? '⏸️ Đang phát...' : '🔊 Nghe thử giọng này'}
                           </button>
                         </div>
                         <div className="flex gap-2">
                           <select
                             value={voiceCode}
                             onChange={(e) => {
                               setVoiceCode(e.target.value);
                               if (playingVoice && audioObj) {
                                 audioObj.pause();
                                 setPlayingVoice(null);
                               }
                             }}
                             className="w-full px-3 py-2.5 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-lg font-bold text-[#2d2218] text-sm focus:ring-2 focus:ring-[#f6a287] outline-none"
                           >
                             {[...voices]
                               .filter(v => targetLang === 'en' ? String((v as any).locale || '').startsWith('en') : !String((v as any).locale || '').startsWith('en'))
                               .sort((a, b) => {
                                 const aFav = favorites.includes(a.code);
                                 const bFav = favorites.includes(b.code);
                                 if (aFav && !bFav) return -1;
                                 if (!aFav && bFav) return 1;
                                 return 0;
                               })
                               .map(v => (
                               <option key={v.code} value={v.code}>
                                 {favorites.includes(v.code) ? '❤️ ' : ''}{v.name}
                               </option>
                             ))}
                           </select>
                           <button
                             type="button"
                             onClick={() => setIsVoiceModalOpen(true)}
                             className="shrink-0 bg-[#a2d5c6] text-[#2d2218] font-bold px-3 py-2 border-2 border-[#2d2218] rounded-lg shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218] transition-all whitespace-nowrap"
                           >
                             📚 Thư viện giọng nói
                           </button>
                         </div>
                       </div>
                     )}

                     {/* Chọn phong cách dịch kịch bản */}
                     <div className="bg-white px-4 py-3.5 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]">
                       <label className="font-bold text-[#2d2218] text-sm flex items-center gap-1.5 mb-2">
                         🎭 Phong cách dịch kịch bản:
                       </label>
                       <select
                         value={translationStyle}
                         onChange={(e) => setTranslationStyle(e.target.value)}
                         className="w-full px-3 py-2.5 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-lg font-bold text-[#2d2218] text-sm focus:ring-2 focus:ring-[#a2d5c6] outline-none cursor-pointer mb-4"
                       >
                         <option value="tiktok">🔥 Review TikTok / Reels (Bán Hàng, Cuốn Hút, Súc Tích)</option>
                         <option value="story">📖 Thuyết Minh Mềm Mại (Truyền Cảm, Nhẹ Nhàng, Tinh Tế)</option>
                         <option value="natural">🛋️ Đời Thường Gần Gũi (Tự Nhiên 100% Chuẩn Ngữ Cảnh)</option>
                          <option value="wuxia">⚔️ Kiếm Hiệp / Tu Tiên (Cổ Phong Hán Việt, Wuxia)</option>
                          <option value="cinematic">🎬 Chuẩn Điện Ảnh (Sang Trọng, Tinh Giản, Phụ Đề)</option>
                          <option value="localize">🇻🇳 Việt Hóa Hoàn Toàn (Bản Địa Hóa Văn Hóa Việt)</option>
                       </select>

                       {/* Viết lại kịch bản AI */}
                       <div className="space-y-2 pt-4 border-t-2 border-dashed border-[#e5dcd3]">
                         <label className="block text-sm font-bold text-[#2d2218]">✍️ Viết Lại Kịch Bản (Tùy chọn)</label>
                         <select 
                           value={rewriteMode} 
                           onChange={e => setRewriteMode(e.target.value)}
                           className="w-full px-4 py-3 border-2 border-[#2d2218] rounded-xl font-bold bg-[#fdf9f1]"
                         >
                           <option value="">Không viết lại (chỉ dịch)</option>
                           <option value="review">🔥 Review Bán Hàng Shopee</option>
                           <option value="story">📖 Kể Chuyện Hấp Dẫn</option>
                           <option value="education">📚 Giáo Dục / Tips & Tricks</option>
                           <option value="humor">😂 Hài Hước / Dí Dỏm</option>
                           <option value="affiliate">🎯 Affiliate Shopee (CTA mạnh)</option>
                         </select>
                         {rewriteMode && <p className="text-xs text-[#e65c4f] font-medium">+2.000đ phụ phí viết lại kịch bản AI</p>}
                       </div>
                     </div>

                     {/* Tùy chọn Xem & Chỉnh Sửa Kịch Bản 2 cột */}
                     <div className="bg-white px-4 py-3 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] flex items-center justify-between cursor-pointer" onClick={() => setShouldEditScript(!shouldEditScript)}>
                       <div className="flex items-center gap-2">
                         <span className="text-lg">✏️</span>
                         <div>
                           <p className="font-bold text-[#2d2218] text-sm">Xem & Chỉnh sửa kịch bản trước khi lồng tiếng</p>
                           <p className="text-xs text-[#6b5a4b]">Bảng 2 cột tùy chỉnh từng dòng thoại chuẩn ý 100%</p>
                         </div>
                       </div>
                       <input 
                         type="checkbox" 
                         checked={shouldEditScript} 
                         onChange={(e) => setShouldEditScript(e.target.checked)}
                         className="w-5 h-5 accent-[#f6a287] cursor-pointer"
                       />
                     </div>

                      {/* Đăng tự động lên Fanpage */}
                      <div className="bg-white px-4 py-3 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setAutoPost(!autoPost)}>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🤖</span>
                            <div>
                              <p className="font-bold text-[#2d2218] text-sm">Đăng tự động lên Fanpage (Facebook)</p>
                              <p className="text-xs text-[#6b5a4b]">Tự động tải video lên Facebook sau khi hoàn thành</p>
                            </div>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={autoPost} 
                            onChange={(e) => setAutoPost(e.target.checked)}
                            className="w-5 h-5 accent-[#f6a287] cursor-pointer"
                          />
                        </div>
                        {autoPost && (
                          <div className="mt-4 pt-4 border-t-2 border-dashed border-[#e5dcd3] flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                            {autoPostAccounts.length === 0 ? (
                              <Link to="/social-dashboard" className="w-full block text-center bg-[#1877F2] text-white font-bold py-2.5 rounded-lg hover:bg-[#166fe5] transition-colors border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]">
                                Kết Nối Fanpage Facebook
                              </Link>
                            ) : (
                              <>
                                <div>
                                  <label className="text-xs font-bold text-[#2d2218] mb-1 block">Chọn Fanpage đăng:</label>
                                  <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="w-full bg-[#fdf9f1] border-2 border-[#2d2218] rounded-lg p-2 font-bold text-sm outline-none">
                                    {autoPostAccounts.map(acc => (
                                      <option key={acc.id} value={acc.id}>{acc.name || acc.username || acc.platform}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="relative">
                                  <label className="text-xs font-bold text-[#2d2218] mb-1 flex justify-between">
                                    <span>Nội dung bài viết (Caption):</span>
                                    <button onClick={handleGenerateCaption} disabled={isGeneratingCaption} type="button" className="text-[#f6a287] hover:underline flex items-center gap-1 bg-[#2d2218] px-2 py-0.5 rounded text-[10px]">
                                      {isGeneratingCaption ? '⏳ Đang viết...' : '✨ AI Viết Caption'}
                                    </button>
                                  </label>
                                  <textarea 
                                    value={autoPostCaption} 
                                    onChange={e => setAutoPostCaption(e.target.value)}
                                    placeholder="Ví dụ: Review chi tiết sản phẩm cực đỉnh..."
                                    className="w-full h-20 bg-[#fdf9f1] border-2 border-[#2d2218] rounded-lg p-2 font-medium text-sm outline-none resize-none"
                                  ></textarea>
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-[#2d2218] mb-1 block">Thời gian đăng (Tùy chọn):</label>
                                  <input 
                                    type="datetime-local" 
                                    value={autoPostTime} 
                                    onChange={e => setAutoPostTime(e.target.value)}
                                    className="w-full bg-[#fdf9f1] border-2 border-[#2d2218] rounded-lg p-2 font-bold text-sm outline-none"
                                  />
                                  <p className="text-[10px] text-[#6b5a4b] mt-1">* Bỏ trống để đăng ngay lập tức sau khi có video.</p>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                     <button 
                       onClick={() => handleStartAI()}
                       className="w-full text-center bg-[#f6a287] text-[#2d2218] px-6 py-4 rounded-2xl font-bold border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all text-lg"
                     >
                       ✨ Bắt Đầu Xử Lý (-{(mode === 'dub_only' ? 3 : mode === 'sub_only' ? 2 : mode === 'reaction' ? 5 : 4) + (autoPost ? 1 : 0) + (rewriteMode ? 2 : 0)}K)
                     </button>
                   </div>
                 </div>
               )}

               {/* Nếu đang xử lý AI */}
               {status === 'processing' && (
                 <div className="text-center p-8 bg-[#e8f1f2] rounded-2xl border-2 border-[#2d2218]">
                   <div className="w-12 h-12 border-[4px] border-[#2d2218] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                   <p className="font-black text-[#2d2218] text-lg mb-2">{aiStatus || 'Hệ thống đang xử lý...'}</p>
                   <p className="font-medium text-[#6b5a4b]">Quá trình này có thể mất 1-2 phút tùy độ dài video.</p>
                 </div>
               )}

               {/* Nếu AI đã xử lý xong */}
               {status === 'done' && (
                 <div className="text-center p-8 bg-[#a2d5c6] rounded-2xl border-2 border-[#2d2218]">
                   <div className="w-16 h-16 bg-white border-2 border-[#2d2218] rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-[4px_4px_0px_#2d2218]">🎉</div>
                   <h4 className="font-black text-[#2d2218] text-2xl mb-6">Video Của Bạn Đã Sẵn Sàng!</h4>
                   
                   <div className="flex flex-col sm:flex-row justify-center gap-4">
                     <a 
                       href={`${API_BASE}/api/download_video/${jobId}`}
                       onClick={() => trackCustomEvent('DownloadProcessedVideo')}
                       className="px-8 py-4 bg-[#fdf9f1] font-black text-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218] border-2 border-[#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all"
                     >
                       📥 Tải Video
                     </a>
                   </div>
                 </div>
               )}
              </div>
            )}

              {/* Quản Lý Tiếp Thị Liên Kết Quick Widget */}
              <div className="mt-8 bg-[#a2d5c6] border-[3px] border-[#2d2218] rounded-3xl p-6 shadow-[6px_6px_0px_#2d2218] flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-[#e65c4f] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#2d2218]">
                      HOA HỒNG 20% TRỌN ĐỜI
                    </span>
                    <span className="font-extrabold text-xs text-[#2d2218]">Mã Ref: TVN{payCode || '...'}</span>
                  </div>
                  <h4 className="font-black text-[#2d2218] text-xl mb-1">🤝 Kiếm Tiền Thụ Động Cùng TaiVideoNhanh</h4>
                  <p className="text-xs font-bold text-[#2d2218]/80">Chia sẻ link giới thiệu cá nhân của bạn và nhận ngay 20% mỗi khi khách nạp tiền.</p>
                </div>
                <Link
                  to="/affiliate"
                  className="w-full md:w-auto bg-[#fdf9f1] hover:bg-white text-[#2d2218] font-black text-sm px-6 py-3 rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all whitespace-nowrap text-center"
                >
                  Bảng Quản Lý Tiếp Thị ➔
                </Link>
              </div>

          </div>
        </div>


      {/* Modal Hiển Thị Kết Quả AI Dịch & Việt Hóa Ảnh */}
      {translatedImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#fdf9f1] border-[3px] border-[#2d2218] rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[10px_10px_0px_#2d2218] relative">
            <button
              onClick={() => setTranslatedImageModal(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white border-2 border-[#2d2218] rounded-full font-black text-xl flex items-center justify-center hover:bg-[#ffcccb] transition-all shadow-[2px_2px_0px_#2d2218] cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🪄</span>
              <div>
                <h3 className="text-2xl font-black text-[#2d2218]">Bản Dịch Tiếng Việt & Prompt AI</h3>
                <p className="text-xs text-[#6b5a4b] font-medium">Đã phân tích văn bản & tạo câu lệnh vẽ lại ảnh chuẩn 100% tiếng Việt</p>
              </div>
            </div>

            {/* Ảnh gốc xem đối chiếu */}
            <div className="mb-6 flex gap-4 items-center bg-white p-3 rounded-2xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218]">
              <img src={translatedImageModal.origUrl} alt="Original" className="w-20 h-20 object-cover rounded-xl border border-[#2d2218]" />
              <div>
                <h4 className="font-black text-[#2d2218] text-base">{translatedImageModal.title}</h4>
                <p className="text-xs text-[#6b5a4b] font-medium">{translatedImageModal.subtitle}</p>
              </div>
            </div>

            {/* Danh sách mục đã dịch tiếng Việt */}
            <div className="mb-6 bg-white border-2 border-[#2d2218] rounded-2xl p-5 shadow-[4px_4px_0px_#2d2218]">
              <h4 className="font-bold text-[#2d2218] text-base mb-4 flex items-center gap-2 border-b-2 border-[#2d2218] pb-2">
                <span>📜</span> Nội Dung Tiếng Việt Chuẩn Chuyên Ngành:
              </h4>
              <div className="space-y-3">
                {translatedImageModal.sections?.map((sec: any, idx: number) => (
                  <div key={idx} className="p-3 bg-[#fdf9f1] border border-[#2d2218] rounded-xl">
                    <span className="inline-block px-2 py-0.5 bg-[#a2d5c6] text-[#2d2218] text-xs font-black rounded-md border border-[#2d2218] mb-1">
                      Mục #{sec.num || idx + 1}: {sec.heading}
                    </span>
                    <p className="text-sm font-medium text-[#2d2218] mt-1">{sec.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ảnh mới vừa được AI Việt Hóa & Vẽ Lại Tự Động 1-Click */}
            {translatedImageModal.generated_image_url && (
              <div className="mb-6 bg-white border-2 border-[#2d2218] rounded-2xl p-5 shadow-[4px_4px_0px_#2d2218]">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="inline-block px-3 py-1 bg-[#a2d5c6] text-[#2d2218] text-xs font-black rounded-full border border-[#2d2218] mb-1">
                      ✨ Ảnh Infographic Tiếng Việt Mới (1-Click AI)
                    </span>
                    <p className="text-xs text-[#6b5a4b] font-medium">Đã tự động dịch & vẽ lại hoàn toàn bằng AI</p>
                  </div>
                  <a
                    href={`${API_BASE}/api/download_single_image?url=${encodeURIComponent(translatedImageModal.generated_image_url.startsWith('http') ? translatedImageModal.generated_image_url : API_BASE + translatedImageModal.generated_image_url)}&filename=${encodeURIComponent('anh_tieng_viet_hd')}`}
                    download
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#e65c4f] text-white rounded-xl border-2 border-[#2d2218] text-xs font-black hover:bg-[#d54b3e] transition-all shadow-[3px_3px_0px_#2d2218] flex items-center justify-center gap-1.5"
                  >
                    📥 Tải Ảnh Tiếng Việt HD
                  </a>
                </div>

                <div className="max-h-[480px] flex justify-center items-center bg-[#fdf9f1] rounded-2xl overflow-hidden border-2 border-[#2d2218] p-2 shadow-[3px_3px_0px_#2d2218]">
                  <img
                    src={translatedImageModal.generated_image_url.startsWith('http') ? translatedImageModal.generated_image_url : `${API_BASE}${translatedImageModal.generated_image_url}`}
                    alt="Generated Infographic"
                    className="max-h-[450px] w-auto object-contain rounded-xl border border-[#2d2218]"
                  />
                </div>
              </div>
            )}

            {/* Đóng Modal */}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setTranslatedImageModal(null)}
                className="w-full sm:w-auto bg-[#fdf9f1] text-[#2d2218] px-6 py-3 rounded-2xl font-bold border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all text-center cursor-pointer text-sm"
              >
                ✕ Đóng Cửa Sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hiển Thị Kết Quả Việt Hóa Tất Cả Ảnh Hàng Loạt */}
      {batchTranslatedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#fdf9f1] border-[3px] border-[#2d2218] rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[10px_10px_0px_#2d2218] relative">
            <button
              onClick={() => setBatchTranslatedModal(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white border-2 border-[#2d2218] rounded-full font-black text-xl flex items-center justify-center hover:bg-[#ffcccb] transition-all shadow-[2px_2px_0px_#2d2218] cursor-pointer"
            >
              ✕
            </button>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🪄</span>
                <div>
                  <h3 className="text-2xl font-black text-[#2d2218]">Bộ Sưu Tập Ảnh Tiếng Việt ({batchTranslatedModal.length} Ảnh)</h3>
                  <p className="text-xs text-[#6b5a4b] font-medium">Đã dịch & tự động vẽ lại 100% bằng AI 1-Click</p>
                </div>
              </div>

              <button
                onClick={async () => {
                  try {
                    const genUrls = batchTranslatedModal.map(item => item.generated_image_url.startsWith('http') ? item.generated_image_url : `${API_BASE}${item.generated_image_url}`);
                    const response = await fetch(`${API_BASE}/api/download_images_zip`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ urls: genUrls, title: 'album_tieng_viet' })
                    });
                    const blob = await response.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `album_anh_tieng_viet.zip`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  } catch (err) {
                    alert('Lỗi tải ZIP');
                  }
                }}
                className="w-full sm:w-auto bg-[#e65c4f] text-white px-6 py-3 rounded-2xl font-bold border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all text-sm shrink-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                📦 Tải Tất Cả Ảnh Tiếng Việt (.ZIP)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {batchTranslatedModal.map((item: any, idx: number) => {
                const imgSrc = item.generated_image_url.startsWith('http') ? item.generated_image_url : (item.generated_image_url.startsWith('/') ? item.generated_image_url : `/${item.generated_image_url}`);
                const dlUrl = `${API_BASE}/api/download_single_image?url=${encodeURIComponent(imgSrc)}&filename=${encodeURIComponent('anh_tieng_viet_' + (idx + 1))}`;
                return (
                  <div key={idx} className="bg-white border-2 border-[#2d2218] rounded-2xl p-4 shadow-[4px_4px_0px_#2d2218] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 border-b-2 border-[#2d2218] pb-2">
                        <span className="text-xs font-black text-[#2d2218] px-2.5 py-0.5 bg-[#a2d5c6] rounded-md border border-[#2d2218]">
                          Ảnh #{idx + 1}: {item.title || 'ẢNH TIẾNG VIỆT'}
                        </span>
                        <a
                          href={dlUrl}
                          download
                          className="px-3 py-1 bg-[#f6a287] text-[#2d2218] rounded-lg border border-[#2d2218] text-xs font-bold hover:bg-[#e65c4f] hover:text-white transition-all shadow-[2px_2px_0px_#2d2218]"
                        >
                          📥 Tải Ảnh HD
                        </a>
                      </div>

                      <div className="aspect-[9/16] max-h-[360px] mx-auto rounded-xl overflow-hidden border-2 border-[#2d2218] mb-3 bg-[#fdf9f1] p-1 flex items-center justify-center">
                        <img
                          src={imgSrc}
                          alt={`Generated ${idx + 1}`}
                          className="max-h-[340px] w-auto object-contain rounded-lg border border-[#2d2218]"
                        />
                      </div>
                    </div>

                    {item.sections && item.sections.length > 0 && (
                      <div className="bg-[#fdf9f1] border border-[#2d2218] rounded-xl p-2.5 text-xs text-[#2d2218] line-clamp-3">
                        <strong>Nội dung:</strong> {item.sections.map((s: any) => `${s.heading}: ${s.detail}`).join('; ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 CỘT CHỈNH SỬA KỊCH BẢN */}
      {scriptModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl max-w-4xl w-full p-6 shadow-[8px_8px_0px_#2d2218] max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-[#2d2218]">
              <h3 className="text-xl font-black text-[#2d2218] flex items-center gap-2">
                ✏️ Bảng Chỉnh Sửa Kịch Bản 2 Cột (Thoại Gốc vs Tiếng Việt)
              </h3>
              <button onClick={() => setScriptModalData(null)} className="text-2xl font-bold text-[#6b5a4b] hover:text-[#2d2218]">×</button>
            </div>
            
            <p className="text-xs text-[#6b5a4b] mb-4">
              Bác có thể tự do chỉnh sửa câu từ ở cột <b>Lời Thoại Dịch Tiếng Việt</b> cho vừa vặn và chuẩn ý nhất trước khi bấm lồng tiếng nhé!
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
              {scriptModalData.map((seg: any, idx: number) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218]">
                  <div className="bg-[#fdf9f1] p-3 rounded-xl border border-[#2d2218]">
                    <span className="text-xs font-bold text-[#8c7a6b] block mb-1">Dòng #{idx + 1} ({seg.start ? seg.start.toFixed(1) : 0}s - {seg.end ? seg.end.toFixed(1) : 0}s) - Thoại Gốc:</span>
                    <p className="text-sm font-medium text-[#2d2218]">{seg.text || seg.original_text || '(Không có thoại)'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#f6a287] block mb-1">Dịch Tiếng Việt (Có thể sửa):</span>
                    <textarea 
                      value={seg.translated_text || ''}
                      onChange={(e) => {
                        const updated = [...scriptModalData];
                        updated[idx].translated_text = e.target.value;
                        setScriptModalData(updated);
                      }}
                      className="w-full p-2.5 bg-white border-2 border-[#2d2218] rounded-xl text-sm font-semibold text-[#2d2218] focus:ring-2 focus:ring-[#f6a287] outline-none resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t-2 border-[#2d2218]">
              <button 
                onClick={() => setScriptModalData(null)}
                className="px-5 py-3 bg-[#e8f1f2] text-[#2d2218] font-bold rounded-xl border-2 border-[#2d2218]"
              >
                Hủy Bỏ
              </button>
              <button 
                onClick={() => handleStartAI(scriptModalData)}
                className="px-6 py-3 bg-[#f6a287] text-[#2d2218] font-black rounded-xl border-2 border-[#2d2218] shadow-[3px_3px_0px_#2d2218] hover:translate-y-[1px]"
              >
                🎙️ Tiến Hành Lồng Tiếng Kịch Bản Này
              </button>
            </div>
          </div>
        </div>
      )}

      <VoiceLibraryModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        voices={voices}
        favorites={favorites}
        setFavorites={setFavorites}
        onSelectVoice={setVoiceCode}
        playingVoice={playingVoice}
        setPlayingVoice={setPlayingVoice}
        audioObj={audioObj}
        setAudioObj={setAudioObj}
      />

    </>
  );
}
