import { useState, useMemo } from 'react';
import { Heart, X, Play, Square, Search } from 'lucide-react';
import API_BASE from '../api';
import { supabase } from '../supabaseClient';

export default function VoiceLibraryModal({ isOpen, onClose, voices, favorites, setFavorites, onSelectVoice, playingVoice, setPlayingVoice, audioObj, setAudioObj }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const handleToggleFavorite = async (voiceCode: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ voice_id: voiceCode })
      });
      const data = await res.json();
      if (data.status === 'added') {
        setFavorites([...favorites, voiceCode]);
      } else if (data.status === 'removed') {
        setFavorites(favorites.filter((id: string) => id !== voiceCode));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePreview = (vCode: string, url: string) => {
    if (playingVoice === vCode && audioObj) {
      audioObj.pause();
      setPlayingVoice(null);
      return;
    }
    if (audioObj) {
      audioObj.pause();
    }
    const newAudio = new Audio(url || `${API_BASE}/api/voice-preview/${vCode}`);
    setAudioObj(newAudio);
    setPlayingVoice(vCode);
    newAudio.play().catch(e => {
      console.error('Audio playback failed:', e);
      setPlayingVoice(null);
      alert('Tạm thời chưa có file nghe thử cho giọng này.');
    });
    newAudio.onended = () => setPlayingVoice(null);
  };

  const filteredVoices = useMemo(() => {
    return voices.filter((v: any) => {
      const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) || v.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGender = filterGender === 'all' || v.gender === filterGender;
      
      let matchesCategory = true;
      if (filterCategory === 'review') {
        matchesCategory = ['social_media', 'advertisement'].includes(v.use_case) || v.category === 'hot';
      } else if (filterCategory === 'story') {
        matchesCategory = v.use_case === 'narrative_story';
      } else if (filterCategory === 'news') {
        matchesCategory = ['informative_educational', 'news', 'conversational'].includes(v.use_case);
      } else if (filterCategory === 'hot') {
        matchesCategory = v.category === 'hot';
      }

      return matchesSearch && matchesGender && matchesCategory;
    }).sort((a: any, b: any) => {
      // Sort favorites first
      const aFav = favorites.includes(a.code);
      const bFav = favorites.includes(b.code);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [voices, searchTerm, filterGender, filterCategory, favorites]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#fdf9f1] rounded-2xl border-4 border-[#2d2218] shadow-[8px_8px_0px_#2d2218] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#a2d5c6] p-4 border-b-4 border-[#2d2218] flex justify-between items-center shrink-0">
          <h2 className="text-xl font-black text-[#2d2218] flex items-center gap-2">
            🎙️ Thư viện giọng nói
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors">
            <X size={24} strokeWidth={3} className="text-[#2d2218]" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b-2 border-[#2d2218] bg-white flex flex-wrap gap-4 shrink-0">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm tên hoặc ID giọng..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#f6a287]"
            />
          </div>
          <div className="flex gap-2">
            <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold bg-[#fdf9f1] outline-none cursor-pointer">
              <option value="all">Tất cả giới tính</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold bg-[#fdf9f1] outline-none cursor-pointer">
              <option value="all">Tất cả mục đích</option>
              <option value="hot">🔥 Ưu tiên / Đề xuất</option>
              <option value="review">🛍️ Review / Bán hàng</option>
              <option value="story">📖 Kể chuyện / Podcast</option>
              <option value="news">📰 Tin tức / Cung cấp thông tin</option>
            </select>
          </div>
        </div>

        {/* Voice List */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#fdf9f1]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVoices.map((v: any) => {
              const isFav = favorites.includes(v.code);
              return (
                <div key={v.code} className="bg-white border-2 border-[#2d2218] p-4 rounded-xl shadow-[2px_2px_0px_#2d2218] flex flex-col gap-3 relative">
                  <div className="flex justify-between items-start pr-8">
                    <div>
                      <h3 className="font-bold text-[#2d2218] text-lg leading-tight">{v.name}</h3>
                      <p className="text-xs font-mono text-gray-500 mt-1">ID: {v.code}</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleToggleFavorite(v.code); }}
                      className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                      title={isFav ? "Bỏ yêu thích" : "Yêu thích"}
                    >
                      <Heart size={22} className={isFav ? "fill-red-500 text-red-500" : "text-gray-400"} />
                    </button>
                  </div>
                  
                  <div className="flex gap-2 text-xs font-bold mt-1 flex-wrap">
                    {v.category === 'hot' && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200">🔥 Đề xuất</span>}
                    {v.gender && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded border border-blue-200">{v.gender === 'male' ? 'Nam' : 'Nữ'}</span>}
                    {v.age && <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded border border-green-200">{v.age === 'young' ? 'Trẻ' : v.age === 'middle_aged' ? 'Trung niên' : v.age}</span>}
                    {v.use_case && <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded border border-purple-200">{v.use_case === 'social_media' ? 'Review/Bán hàng' : v.use_case === 'narrative_story' ? 'Kể chuyện' : (v.use_case === 'informative_educational' || v.use_case === 'news') ? 'Tin tức/Kiến thức' : v.use_case === 'advertisement' ? 'Quảng cáo' : v.use_case}</span>}
                  </div>

                  <div className="flex gap-2 mt-auto pt-2">
                    <button
                      onClick={() => handleTogglePreview(v.code, v.preview_url)}
                      className="flex-1 bg-[#fdf9f1] border-2 border-[#2d2218] font-bold text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors flex justify-center items-center gap-1 shadow-[1px_1px_0px_#2d2218]"
                    >
                      {playingVoice === v.code ? <Square size={16} className="fill-[#2d2218]" /> : <Play size={16} className="fill-[#2d2218]" />}
                      {playingVoice === v.code ? 'Dừng' : 'Nghe thử'}
                    </button>
                    <button
                      onClick={() => {
                        onSelectVoice(v.code);
                        onClose();
                      }}
                      className="flex-1 bg-[#f6a287] border-2 border-[#2d2218] font-bold text-[#2d2218] text-sm py-2 rounded-lg hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218] shadow-[2px_2px_0px_#2d2218] transition-all"
                    >
                      Chọn giọng này
                    </button>
                  </div>
                </div>
              );
            })}
            
            {filteredVoices.length === 0 && (
              <div className="col-span-full py-10 text-center font-bold text-gray-500">
                Không tìm thấy giọng đọc nào phù hợp.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
