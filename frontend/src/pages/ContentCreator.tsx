import React, { useState } from 'react';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import TopListTemplate from '../components/templates/TopListTemplate';
import GridTemplate from '../components/templates/GridTemplate';
import API_BASE from '../api';

const ContentCreator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [template, setTemplate] = useState('list');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const response = await fetch(`${API_BASE}/api/generate-post-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, template }),
      });

      if (!response.ok) {
        throw new Error('Lỗi khi gọi API sinh nội dung');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const node = document.getElementById('export-node');
    if (!node) return;

    try {
      const dataUrl = await toPng(node, { 
        cacheBust: true,
        pixelRatio: 2, // high quality
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      });
      
      const zip = new JSZip();
      zip.file(`${topic.replace(/[^a-zA-Z0-9]/g, '_')}_poster.png`, dataUrl.split(',')[1], {base64: true});
      
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Posters_${Date.now()}.zip`;
      link.click();
    } catch (err) {
      console.error('Error generating image', err);
      alert('Có lỗi xảy ra khi xuất ảnh.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar for Controls */}
      <div className="w-1/3 p-8 bg-white shadow-xl border-r z-50 overflow-y-auto">
        <h2 className="text-3xl font-black mb-6 text-gray-800">Công cụ Tạo Ảnh</h2>
        
        <div className="mb-6">
          <label className="block text-gray-700 font-bold mb-2">Chủ đề bài viết</label>
          <textarea 
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ví dụ: Top 5 loại cặp chống gù tốt nhất"
            className="w-full border-2 border-gray-300 rounded-xl p-4 h-32 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 font-bold mb-2">Chọn Template</label>
          <div className="flex gap-4">
            <button 
              onClick={() => setTemplate('list')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 ${template === 'list' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
            >
              Danh sách (Top List)
            </button>
            <button 
              onClick={() => setTemplate('grid')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 ${template === 'grid' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
            >
              Lưới (Grid Menu)
            </button>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={loading || !topic}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
        >
          {loading ? 'Đang nghiên cứu & tạo...' : 'Tạo Nội dung & Ảnh'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl font-medium border border-red-200">
            {error}
          </div>
        )}

        {data && (
          <div className="mt-8 pt-8 border-t">
            <button 
              onClick={handleDownload}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-green-200"
            >
              ⬇️ Tải về File ZIP
            </button>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="w-2/3 p-12 bg-gray-100 flex justify-center items-start overflow-y-auto h-screen relative">
        <div className="scale-75 origin-top relative shadow-2xl">
          {loading && (
            <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center backdrop-blur-sm rounded-[40px]">
              <div className="text-2xl font-black text-blue-600 animate-pulse">Đang dùng AI tạo nội dung...</div>
            </div>
          )}
          
          {data ? (
            template === 'list' ? <TopListTemplate data={data} id="export-node" /> : <GridTemplate data={data} id="export-node" />
          ) : (
            <div className="w-[800px] h-[1000px] bg-white rounded-[40px] shadow-sm flex items-center justify-center border-4 border-dashed border-gray-300">
              <p className="text-gray-400 font-bold text-2xl">Bản xem trước ảnh sẽ hiển thị ở đây</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentCreator;
