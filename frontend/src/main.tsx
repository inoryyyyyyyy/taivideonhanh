import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ReviewVideo from './pages/ReviewVideo'
import BlogList from './pages/BlogList'
import BlogPost from './pages/BlogPost'
import BlogEditor from './pages/BlogEditor'
import AdminDashboard from './pages/AdminDashboard'
import MyVideos from './pages/MyVideos'
import Affiliate from './pages/Affiliate'
import Academy from './pages/Academy'
import VoiceLibrary from './pages/VoiceLibrary'
import { AuthProvider, useAuth } from './AuthContext'
import API_BASE from './api';
import { useEffect } from 'react';
import { trackPixelEvent } from './utils/analytics';


// Capture UTM Parameters on load
const searchParams = new URLSearchParams(window.location.search);
const utmData: any = {};
['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
  const value = searchParams.get(param);
  if (value) utmData[param] = value;
});
if (Object.keys(utmData).length > 0) {
  localStorage.setItem('utm_data', JSON.stringify(utmData));
}

function PixelInjector() {
  const location = useLocation();

  useEffect(() => {
    fetch(`${API_BASE}/api/public-settings`)
      .then(res => res.json())
      .then(data => {
        if (data.fb_pixel) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          fbq('init', data.fb_pixel);
        }
        if (data.tiktok_pixel) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          !function (w, d, t) { w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)}; ttq.load(data.tiktok_pixel); ttq.page(); }(window, document, 'ttq');
        }
      })
      .catch(console.error);
  }, []);

  // Fire PageView event on every route change
  useEffect(() => {
    // A slight delay to ensure scripts are initialized
    setTimeout(() => {
      trackPixelEvent('PageView', { path: location.pathname });
    }, 500);
  }, [location.pathname]);

  return null;
}


import FreeToolTiktok from './pages/FreeToolTiktok'
import FreeToolDouyin from './pages/FreeToolDouyin'
import FreeToolXiaohongshu from './pages/FreeToolXiaohongshu'
import FreeToolKuaishou from './pages/FreeToolKuaishou'
import FreeToolBilibili from './pages/FreeToolBilibili'
import FreeToolYoutube from './pages/FreeToolYoutube'
import FreeToolFacebook from './pages/FreeToolFacebook'
import FreeToolVietHoaAnh from './pages/FreeToolVietHoaAnh'
import ContentCreator from './pages/ContentCreator'
import ShopeeTool from './pages/ShopeeTool'
import SocialDashboard from './pages/SocialDashboard'
import DashboardLayout from './components/DashboardLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3efe8] flex items-center justify-center p-4 font-sans">
        <div className="text-center bg-white border-4 border-[#2d2218] rounded-3xl p-8 shadow-[6px_6px_0px_#2d2218]">
          <div className="w-12 h-12 border-4 border-[#2d2218] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-extrabold text-[#2d2218] text-lg">Đang xác thực tài khoản...</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3efe8] flex items-center justify-center p-4 font-sans">
        <div className="text-center bg-white border-4 border-[#2d2218] rounded-3xl p-8 shadow-[6px_6px_0px_#2d2218]">
          <div className="w-12 h-12 border-4 border-[#2d2218] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-extrabold text-[#2d2218] text-lg">Đang kiểm tra quyền Admin...</p>
        </div>
      </div>
    );
  }
  if (!user || role !== 'admin') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function EditorRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3efe8] flex items-center justify-center p-4 font-sans">
        <div className="text-center bg-white border-4 border-[#2d2218] rounded-3xl p-8 shadow-[6px_6px_0px_#2d2218]">
          <div className="w-12 h-12 border-4 border-[#2d2218] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-extrabold text-[#2d2218] text-lg">Đang kiểm tra quyền...</p>
        </div>
      </div>
    );
  }
  if (!user || (role !== 'admin' && role !== 'editor')) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <PixelInjector />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
          <Route path="/review-video" element={<ProtectedRoute><DashboardLayout><ReviewVideo /></DashboardLayout></ProtectedRoute>} />
          <Route path="/videos" element={<ProtectedRoute><DashboardLayout><MyVideos /></DashboardLayout></ProtectedRoute>} />
          <Route path="/affiliate" element={<ProtectedRoute><DashboardLayout><Affiliate /></DashboardLayout></ProtectedRoute>} />
          <Route path="/academy" element={<ProtectedRoute><DashboardLayout><Academy /></DashboardLayout></ProtectedRoute>} />
          <Route path="/voice-library" element={<ProtectedRoute><DashboardLayout><VoiceLibrary /></DashboardLayout></ProtectedRoute>} />
          <Route path="/shopee-tool" element={<ProtectedRoute><DashboardLayout><ShopeeTool /></DashboardLayout></ProtectedRoute>} />
          <Route path="/social-dashboard" element={<ProtectedRoute><DashboardLayout><SocialDashboard /></DashboardLayout></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/write" element={<EditorRoute><DashboardLayout><BlogEditor /></DashboardLayout></EditorRoute>} />
          
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/tai-video-tiktok-khong-logo" element={<FreeToolTiktok />} />
          <Route path="/tai-video-douyin-khong-logo" element={<FreeToolDouyin />} />
          <Route path="/tai-video-xiaohongshu" element={<FreeToolXiaohongshu />} />
          <Route path="/tai-video-kuaishou-khong-logo" element={<FreeToolKuaishou />} />
          <Route path="/tai-video-bilibili" element={<FreeToolBilibili />} />
          <Route path="/tai-video-youtube" element={<FreeToolYoutube />} />
          <Route path="/tai-video-facebook-hd" element={<FreeToolFacebook />} />
          <Route path="/viet-hoa-anh-xiaohongshu" element={<FreeToolVietHoaAnh />} />
          <Route path="/cong-cu-tao-anh" element={<ContentCreator />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
