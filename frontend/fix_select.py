import re

with open(r"d:\kiemtienfb\frontend\src\pages\Dashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

correct_block = """                     {mode !== 'sub_only' && (
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
                               .filter(v => targetLang === 'en' ? v.code.startsWith('openai_') : true)
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
                             📚 Thư viện
                           </button>
                         </div>
                       </div>
                     )}"""

start_str = "                     {mode !== 'sub_only' && ("
end_str = "                     )}\n\n                     {/* Chọn phong cách dịch kịch bản */}"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + correct_block + "\n\n" + content[end_idx+len("                     )}\n\n"):]
    with open(r"d:\kiemtienfb\frontend\src\pages\Dashboard.tsx", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Fixed Dashboard.tsx")
else:
    print("Could not find block")
