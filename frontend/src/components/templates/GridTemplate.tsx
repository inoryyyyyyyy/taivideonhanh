import React from 'react';

interface PostItem {
  name: string;
  description: string;
  bullet_points: string[];
  search_query: string;
  image_url: string;
}

interface GridTemplateProps {
  data: {
    title: string;
    subtitle: string;
    items: PostItem[];
  };
  id?: string;
}

const GridTemplate: React.FC<GridTemplateProps> = ({ data, id = 'export-node' }) => {
  return (
    <div id={id} className="w-[1080px] bg-gradient-to-br from-[#c6e994] to-[#a3d95d] font-sans flex flex-col pb-12 relative overflow-hidden">
      {/* Header */}
      <div className="w-full text-[#1b4332] py-16 px-12 text-center relative z-10">
        <h1 className="text-6xl font-black mb-6 uppercase leading-tight drop-shadow-sm">{data.title}</h1>
        {data.subtitle && <p className="text-3xl font-bold opacity-90">{data.subtitle}</p>}
      </div>

      {/* Grid Container */}
      <div className="w-full px-12 grid grid-cols-2 gap-8 relative z-20">
        {data.items.map((item, idx) => (
          <div key={idx} className="bg-white/90 backdrop-blur-sm rounded-[32px] p-6 shadow-xl border-4 border-[#8bc34a] flex items-center gap-6">
            <div className="w-[160px] h-[160px] flex-shrink-0 bg-white rounded-2xl overflow-hidden shadow-inner border-2 border-gray-200">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
              )}
            </div>
            
            <div className="flex-1 flex flex-col justify-center">
              <div className="bg-[#ffeb3b] text-[#33691e] px-4 py-2 rounded-full font-black text-xl mb-3 inline-block self-start border-2 border-[#cddc39]">
                {item.name}
              </div>
              
              <ul className="space-y-2">
                {item.bullet_points.map((point, i) => (
                  <li key={i} className="flex items-start text-lg text-gray-800 font-bold">
                    <span className="text-green-600 mr-2 text-xl leading-none">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      
      {/* Watermark */}
      <div className="absolute bottom-6 right-8 text-[#33691e] opacity-50 font-black text-xl">
        AI Content Creator
      </div>
    </div>
  );
};

export default GridTemplate;
