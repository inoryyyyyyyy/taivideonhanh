import React from 'react';

interface PostItem {
  name: string;
  description: string;
  bullet_points: string[];
  search_query: string;
  image_url: string;
}

interface TopListTemplateProps {
  data: {
    title: string;
    subtitle: string;
    items: PostItem[];
  };
  id?: string;
}

const TopListTemplate: React.FC<TopListTemplateProps> = ({ data, id = 'export-node' }) => {
  return (
    <div id={id} className="w-[800px] bg-[#f8f9fa] font-sans flex flex-col items-center pb-12 relative overflow-hidden">
      {/* Header Area */}
      <div className="w-full bg-[#dc2626] text-white py-16 px-8 text-center rounded-b-[40px] shadow-lg mb-12 relative z-10">
        <h1 className="text-5xl font-black mb-4 uppercase leading-tight drop-shadow-md">{data.title}</h1>
        {data.subtitle && <p className="text-2xl font-bold italic opacity-90">{data.subtitle}</p>}
      </div>

      {/* Items List */}
      <div className="w-full px-8 flex flex-col gap-8 relative z-20">
        {data.items.map((item, idx) => (
          <div key={idx} className="bg-white rounded-[24px] shadow-xl flex overflow-hidden border-4 border-transparent hover:border-yellow-400 transition-all">
            {/* Image Section */}
            <div className="w-2/5 h-[300px] relative bg-gray-100 flex-shrink-0">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
              )}
              <div className="absolute top-4 left-4 bg-yellow-400 text-black text-2xl font-black py-2 px-6 rounded-full shadow-md z-10">
                #{idx + 1}
              </div>
            </div>
            
            {/* Content Section */}
            <div className="w-3/5 p-8 flex flex-col justify-center">
              <h2 className="text-3xl font-extrabold text-gray-800 mb-2 uppercase">{item.name}</h2>
              <p className="text-lg text-gray-600 mb-4 italic">{item.description}</p>
              
              <ul className="space-y-3">
                {item.bullet_points.map((point, i) => (
                  <li key={i} className="flex items-start text-lg text-gray-700 font-medium">
                    <span className="text-red-500 mr-2 text-2xl leading-none">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer watermark */}
      <div className="absolute bottom-4 right-6 opacity-40 font-bold text-gray-500 text-lg">
        Tạo bởi Công cụ AI
      </div>
    </div>
  );
};

export default TopListTemplate;
