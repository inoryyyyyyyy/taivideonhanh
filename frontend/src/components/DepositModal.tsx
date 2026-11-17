

interface DepositModalProps {
  show: boolean;
  onClose: () => void;
  depositAmount: number;
  setDepositAmount: (amount: number) => void;
  payCode: string | null;
  trackPixelEvent?: (eventName: string, data?: any) => void;
}

export default function DepositModal({ 
  show, 
  onClose, 
  depositAmount, 
  setDepositAmount, 
  payCode, 
  trackPixelEvent = () => {} 
}: DepositModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-[#2d2218]/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[8px_8px_0px_#2d2218] my-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-black text-[#2d2218] uppercase">Nạp Tiền Tự Động</h3>
          <button onClick={onClose} className="text-xl font-bold p-2 hover:bg-[#e8f1f2] rounded-xl border-2 border-transparent hover:border-[#2d2218]">
            ✖
          </button>
        </div>
        
        <p className="font-medium text-[#6b5a4b] mb-4 text-center text-sm">
          Chọn mức nạp bên dưới. Tiền sẽ tự động được cộng vào tài khoản trong 3-5 giây.
        </p>

        {/* Chọn Mức Nạp Tiền & Khuyến Mãi */}
        <div className="mb-4">
          <p className="text-[11px] font-bold text-[#8b7a6b] mb-2 uppercase text-center tracking-wide">
            🎁 Chọn Mức Nạp (Nạp nhiều - Tặng thêm tiền)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {/* 100k */}
            <button
              type="button"
              onClick={() => { setDepositAmount(100000); trackPixelEvent('AddPaymentInfo', { currency: 'VND', value: 100000 }); }}
              className={`p-2.5 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                depositAmount === 100000
                  ? 'bg-[#fdf8ef] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-[#2d2218]'
                  : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'
              }`}
            >
              <span className="text-xs block font-black">100.000đ</span>
              <span className="block text-[10px] text-[#6b5a4b] mt-0.5">Nhận 100k</span>
            </button>

            {/* 300k */}
            <button
              type="button"
              onClick={() => { setDepositAmount(300000); trackPixelEvent('AddPaymentInfo', { currency: 'VND', value: 300000 }); }}
              className={`relative p-2.5 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                depositAmount === 300000
                  ? 'bg-[#f6a287] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-[#2d2218]'
                  : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'
              }`}
            >
              <span className="absolute -top-2.5 right-1 bg-[#e65c4f] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-[#2d2218]">
                +10%
              </span>
              <span className="text-xs block font-black">300.000đ</span>
              <span className="block text-[10px] font-bold text-[#2d2218] mt-0.5">
                Nhận <b className="text-[#e65c4f]">330k</b>
              </span>
            </button>

            {/* 500k */}
            <button
              type="button"
              onClick={() => { setDepositAmount(500000); trackPixelEvent('AddPaymentInfo', { currency: 'VND', value: 500000 }); }}
              className={`relative p-2.5 rounded-xl border-2 font-bold text-center transition-all cursor-pointer ${
                depositAmount === 500000
                  ? 'bg-[#a2d5c6] border-[#2d2218] shadow-[3px_3px_0px_#2d2218] text-[#2d2218]'
                  : 'bg-white border-[#e5dcd3] text-[#6b5a4b] hover:border-[#2d2218]'
              }`}
            >
              <span className="absolute -top-2.5 right-1 bg-[#e65c4f] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-[#2d2218]">
                +20%
              </span>
              <span className="text-xs block font-black">500.000đ</span>
              <span className="block text-[10px] font-bold text-[#2d2218] mt-0.5">
                Nhận <b className="text-[#e65c4f]">600k</b>
              </span>
            </button>
          </div>
        </div>
        
        <div className="bg-white border-[3px] border-[#2d2218] rounded-2xl p-3 mb-4 flex flex-col items-center justify-center shadow-[4px_4px_0px_#2d2218]">
          {payCode ? (
            <>
              <img 
                src={`https://vietqr.app/img?acc=96247TAIVIDEO&bank=BIDV&des=TVN${payCode}&amount=${depositAmount}`} 
                alt="QR Code Nạp Tiền" 
                className="w-44 h-44 object-contain"
              />
              <p className="text-xs font-extrabold text-[#e65c4f] mt-1">
                Quét QR tự động điền {new Intl.NumberFormat('vi-VN').format(depositAmount)}đ
              </p>
            </>
          ) : (
            <div className="w-44 h-44 bg-gray-100 flex items-center justify-center font-bold">Đang tải...</div>
          )}
        </div>

        <div className="bg-white border-2 border-[#2d2218] rounded-xl p-3.5 mb-4 shadow-[2px_2px_0px_#2d2218] text-center">
          <p className="text-[11px] font-bold text-[#8b7a6b] mb-1">HOẶC CHUYỂN KHOẢN THỦ CÔNG</p>
          <p className="font-black text-[#2d2218] text-base">BIDV - 96247TAIVIDEO</p>
          <p className="font-bold text-[#6b5a4b] text-xs mb-2">HO KINH DOANH PHAN DUC NHO</p>
          
          <div className="bg-[#a2d5c6] border-2 border-[#2d2218] rounded-xl p-2.5">
            <p className="text-[11px] font-bold text-[#2d2218] mb-0.5">NỘI DUNG CHUYỂN KHOẢN</p>
            <div className="bg-white border-2 border-[#2d2218] rounded-lg p-1.5">
              <span className="font-black text-[#2d2218] text-xl tracking-wider select-all">TVN{payCode || '...'}</span>
            </div>
            <p className="text-[10px] font-bold text-[#2d2218] mt-1.5 flex items-center justify-center gap-1">
              <span className="text-red-600 text-sm">⚠️</span> Ghi đúng mã <b className="bg-yellow-200 px-1 border border-[#2d2218] rounded">TVN{payCode}</b> để được cộng tiền tự động
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
