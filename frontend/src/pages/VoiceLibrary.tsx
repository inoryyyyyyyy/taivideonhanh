import { useState, useEffect, useMemo } from 'react';
import { Heart, Play, Square, Search } from 'lucide-react';
import API_BASE from '../api';
import { supabase } from '../supabaseClient';
import { trackCustomEvent } from '../utils/analytics';

export default function VoiceLibrary() {
  const [voices, setVoices] = useState<Array<any>>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    trackCustomEvent('view_voice_library_page');
    
    const fetchVoicesData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const favRes = await fetch(`${API_BASE}/api/favorites`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          const favData = await favRes.json();
          if (favData.favorites) {
            setFavorites(favData.favorites);
          }
        }
        
        const res = await fetch(`${API_BASE}/api/voices`);
        const data = await res.json();
        if (data.voices && data.voices.length > 0) {
          setVoices(data.voices);
        }
      } catch(e) {}
    };
    fetchVoicesData();
  }, []);

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
        trackCustomEvent('favorite_voice', { voiceCode });
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
    trackCustomEvent('preview_voice_library', { voiceCode: vCode });
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border-[3px] border-[#2d2218] shadow-[6px_6px_0px_#2d2218]">
        <h1 className="text-2xl font-black text-[#2d2218] flex items-center gap-3">
          <span className="text-3xl">📚</span> Thư Viện Giọng Nói AI
        </h1>
        <p className="text-gray-600 font-medium mt-2">
          Khám phá và lưu lại những giọng đọc phù hợp nhất cho video Affiliate, Review, Kể chuyện của bạn. Các giọng thả tim sẽ được ưu tiên khi bạn tạo video mới!
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl border-2 border-[#2d2218] shadow-[4px_4px_0px_#2d2218] flex flex-wrap gap-4">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm theo tên hoặc ID..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#f6a287]"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="flex-1 sm:w-auto px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold bg-[#fdf9f1] outline-none cursor-pointer">
            <option value="all">Giới tính</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="flex-1 sm:w-auto px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold bg-[#fdf9f1] outline-none cursor-pointer">
            <option value="all">Mục đích</option>
            <option value="hot">🔥 Ưu tiên / Đề xuất</option>
            <option value="review">🛍️ Review / Bán hàng</option>
            <option value="story">📖 Kể chuyện</option>
            <option value="news">📰 Tin tức / Kiến thức</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredVoices.map((v: any) => {
          const isFav = favorites.includes(v.code);
          return (
            <div key={v.code} className="bg-white border-2 border-[#2d2218] p-5 rounded-2xl shadow-[4px_4px_0px_#2d2218] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#2d2218] transition-all flex flex-col relative group">
              <div className="flex justify-between items-start mb-3 pr-8">
                <div>
                  <h3 className="font-black text-[#2d2218] text-xl leading-tight group-hover:text-[#e65c4f] transition-colors">{v.name}</h3>
                  <p className="text-xs font-mono text-gray-500 mt-1">ID: {v.code}</p>
                </div>
                <button 
                  onClick={() => handleToggleFavorite(v.code)}
                  className="absolute top-4 right-4 p-2 hover:bg-[#f3efe8] rounded-full transition-colors"
                  title={isFav ? "Bỏ yêu thích" : "Yêu thích"}
                >
                  <Heart size={24} className={isFav ? "fill-red-500 text-red-500" : "text-gray-300"} strokeWidth={isFav ? 2 : 3} />
                </button>
              </div>
              
              <div className="flex gap-2 text-[11px] font-bold mt-1 flex-wrap mb-4">
                {v.category === 'hot' && <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-md border border-red-200">🔥 Đề xuất</span>}
                {v.gender && <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md border border-blue-200">{v.gender === 'male' ? '👨 Nam' : '👩 Nữ'}</span>}
                {v.age && <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md border border-green-200">{v.age === 'young' ? 'Trẻ' : v.age === 'middle_aged' ? 'Trung niên' : v.age}</span>}
                {v.use_case && <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md border border-purple-200">{v.use_case === 'social_media' ? 'Review/Bán hàng' : v.use_case === 'narrative_story' ? 'Kể chuyện' : (v.use_case === 'informative_educational' || v.use_case === 'news') ? 'Tin tức/Kiến thức' : v.use_case === 'advertisement' ? 'Quảng cáo' : v.use_case}</span>}
              </div>

              <div className="mt-auto">
                <button
                  onClick={() => handleTogglePreview(v.code, v.preview_url)}
                  className={`w-full font-bold text-sm py-3 rounded-xl border-2 border-[#2d2218] transition-all flex justify-center items-center gap-2 ${playingVoice === v.code ? 'bg-[#2d2218] text-white shadow-[2px_2px_0px_#f6a287]' : 'bg-[#fdf9f1] text-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:bg-[#a2d5c6]'}`}
                >
                  {playingVoice === v.code ? <Square size={18} className="fill-white" /> : <Play size={18} className="fill-[#2d2218]" />}
                  {playingVoice === v.code ? 'Đang phát...' : 'Nghe thử giọng này'}
                </button>
              </div>
            </div>
          );
        })}
        
        {filteredVoices.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-[#2d2218]">Không tìm thấy giọng đọc nào!</h3>
            <p className="text-gray-500 mt-2">Vui lòng thử từ khóa hoặc bộ lọc khác.</p>
          </div>
        )}
      </div>
    </div>
  );
}
