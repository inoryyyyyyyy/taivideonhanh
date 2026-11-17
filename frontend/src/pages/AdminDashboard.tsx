import React, { useState, useEffect } from 'react';
import API_BASE from '../api';
import { trackPixelEvent, trackCustomEvent } from '../utils/analytics';
import { useAuth } from '../AuthContext';
import { Navigate, Link } from 'react-router-dom';

interface UserData {
  id: string;
  user_id: string;
  email: string;
  balance: number;
  role: string;
  pay_code: number;
  created_at: string;
  is_vip?: boolean;
}

export default function AdminDashboard() {
  const { role, session } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'transactions' | 'jobs' | 'marketing' | 'settings' | 'withdrawals' | 'templates' | 'funnels' | 'funnel_report' | 'academy'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Academy State
  const [academyModules, setAcademyModules] = useState<any[]>([]);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', badge: 'HỌC MIỄN PHÍ', is_vip_only: false, sort_order: 0 });
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonParentModuleId, setLessonParentModuleId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', duration: '10:00', is_vip: false, video_url: '', summary: '', sort_order: 0 });
  const [academyResources, setAcademyResources] = useState<any[]>([]);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState({ title: '', type: 'ZIP / Google Drive', size: '0 MB', url: '', description: '', sort_order: 0 });
  
  
  const [overviewData, setOverviewData] = useState<any>(null);
  const [providerAlerts, setProviderAlerts] = useState<any[]>([]);
  // Bộ lọc kỳ nạp tiền ở Tổng quan (0 = tất cả năm / cả năm)
  const [ovYear, setOvYear] = useState<number>(new Date().getFullYear());
  const [ovMonth, setOvMonth] = useState<number>(new Date().getMonth() + 1);
  const overviewUrl = () => `/api/admin/overview?year=${ovYear}&month=${ovYear ? ovMonth : 0}`;

  const [showTxModal, setShowTxModal] = useState(false);
  const [modalTxData, setModalTxData] = useState<any[]>([]);
  const [modalTxTitle, setModalTxTitle] = useState('');
  
  const handleCardClick = async (type: 'auto_add' | 'manual_add' | 'deduct' | 'affiliate') => {
    try {
      const token = session?.access_token;
      let txs = [];
      let title = '';
      
      if (type === 'affiliate') {
        const res = await fetch(`${API_BASE}/api/admin/withdrawals`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        txs = (data.withdrawals || []).filter((w: any) => w.status === 'approved');
        title = 'Lịch Sử Chi Affiliate (Đã duyệt)';
      } else {
        const qs = new URLSearchParams({ limit: '200' });
        const periodLabel = ovYear ? (ovMonth ? `Tháng ${ovMonth}/${ovYear}` : `Năm ${ovYear}`) : 'Tất cả thời gian';
        if (type === 'auto_add' || type === 'manual_add') {
          qs.set('deposit_kind', type === 'auto_add' ? 'auto' : 'manual');
          if (ovYear) { qs.set('year', String(ovYear)); qs.set('month', String(ovMonth)); }
          title = (type === 'auto_add' ? 'Lịch Sử Nạp Tự Động' : 'Lịch Sử Nạp Thủ Công') + ` - ${periodLabel} (tối đa 200 giao dịch mới nhất)`;
        } else if (type === 'deduct') {
          qs.set('type_filter', 'DEDUCT');
          title = 'Lịch Sử Tiêu Dùng';
        }
        const res = await fetch(`${API_BASE}/api/admin/transactions?${qs}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        txs = data.transactions || [];
      }
      
      setModalTxData(txs);
      setModalTxTitle(title);
      setShowTxModal(true);
    } catch (e) {
      alert('Lỗi tải dữ liệu');
    }
  };


  const [users, setUsers] = useState<UserData[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 50;
  
  
  const [addAmount, setAddAmount] = useState<number>(50000);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  

  // Filter & Search Users State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [txSearch, setTxSearch] = useState('');
  const [txType, setTxType] = useState('all');
  const [jobSearch, setJobSearch] = useState('');
  // Debounce 400ms: không gọi API sau mỗi phím gõ
  const [dSearchTerm, setDSearchTerm] = useState('');
  const [dTxSearch, setDTxSearch] = useState('');
  const [dJobSearch, setDJobSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDSearchTerm(searchTerm), 400); return () => clearTimeout(t); }, [searchTerm]);
  useEffect(() => { const t = setTimeout(() => setDTxSearch(txSearch), 400); return () => clearTimeout(t); }, [txSearch]);
  useEffect(() => { const t = setTimeout(() => setDJobSearch(jobSearch), 400); return () => clearTimeout(t); }, [jobSearch]);
  // C\u1ea3nh b\u00e1o credit OpenAI/Vbee: t\u1ea3i khi v\u00e0o admin, l\u00e0m m\u1edbi m\u1ed7i 60s
  useEffect(() => {
    if (role !== 'admin' || !session?.access_token) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/provider-alerts`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
        if (res.ok) { const d = await res.json(); setProviderAlerts(d.alerts || []); }
      } catch (e) { /* b\u1ecf qua */ }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [role, session]);
  
  // Update Affiliate Pct State
  const [editingAffiliateUserId, setEditingAffiliateUserId] = useState<string | null>(null);
  const [affiliatePctInput, setAffiliatePctInput] = useState<number>(20);
  const [updatingAffiliate, setUpdatingAffiliate] = useState(false);

  // Users - Role Edit
  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);
  const [roleInput, setRoleInput] = useState<string>('user');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({ fb_pixel: '', tiktok_pixel: '', google_analytics: '', resend_api_key: '', ai_custom_instructions: '' });
  
  
  // UTM Builder State
  const [utmSource, setUtmSource] = useState('facebook');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [generatedUtm, setGeneratedUtm] = useState('');
  
  const generateUtmLink = () => {
    const baseUrl = 'https://taivideonhanh.com/?mode=signup';
    const params = new URLSearchParams();
    if (utmSource) params.append('utm_source', utmSource);
    if (utmMedium) params.append('utm_medium', utmMedium);
    if (utmCampaign) params.append('utm_campaign', utmCampaign);
    setGeneratedUtm(`${baseUrl}&${params.toString()}`);
  };

  const triggerDemoPixelEvents = () => {
    trackPixelEvent('CompleteRegistration', { currency: 'VND', value: 0 });
    trackPixelEvent('StartTrial', { currency: 'VND', value: 0 });
    trackPixelEvent('InitiateCheckout');
    trackPixelEvent('AddPaymentInfo');
    trackPixelEvent('Purchase', { currency: 'VND', value: 50000 });
    
    // Custom Events
    trackCustomEvent('SubmitVideoUrl');
    trackCustomEvent('VideoProcessedSuccess');
    trackCustomEvent('DownloadProcessedVideo');
    
    alert("Đã gửi tất cả các sự kiện qua luồng Browser (Pixel) và Server (CAPI). Vui lòng kiểm tra trên FB Event Manager.");
  };

  // Marketing State
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastHtml, setBroadcastHtml] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Email Templates & Funnels State
  const [templates, setTemplates] = useState<any[]>([]);
  const [funnels, setFunnels] = useState<any[]>([]);
  const [editingTemplateCode, setEditingTemplateCode] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ subject: '', html_content: '' });
  
  const [showFunnelModal, setShowFunnelModal] = useState(false);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [funnelForm, setFunnelForm] = useState<any>({ name: '', delay_days: 1, subject: '', html_content: '', is_active: true, target_segment: 'all' });
  const [funnelReportData, setFunnelReportData] = useState<any>(null);
  const [funnelDetail, setFunnelDetail] = useState<any>(null);
  const [showFunnelDetail, setShowFunnelDetail] = useState(false);
  
  // Preview Modal State
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Debounce search - reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dSearchTerm, roleFilter, dTxSearch, txType, dJobSearch]);

  // Reset page when switching tabs
  useEffect(() => {
    setCurrentPage(1);
    setTotalItems(0);
  }, [activeTab]);

  useEffect(() => {
    if (role === 'admin') {
      if (activeTab === 'overview') fetchData(overviewUrl(), (data: any) => setOverviewData(data.metrics));
      else if (activeTab === 'users') {
        const params = new URLSearchParams({ page: String(currentPage), limit: String(ITEMS_PER_PAGE) });
        if (dSearchTerm) params.set('search', dSearchTerm);
        if (roleFilter !== 'all') params.set('role_filter', roleFilter);
        fetchData(`/api/admin/users?${params}`, (data: any) => { setUsers(data.users || data); setTotalItems(data.total || 0); });
      }
      else if (activeTab === 'marketing') {
        fetchData(`/api/admin/users?limit=10000`, (data: any) => { setUsers(data.users || data); setTotalItems(data.total || 0); });
      }
      else if (activeTab === 'transactions') {
        const params = new URLSearchParams({ page: String(currentPage), limit: String(ITEMS_PER_PAGE) });
        if (dTxSearch.trim()) params.set('search', dTxSearch.trim());
        if (txType !== 'all') params.set('type_filter', txType);
        fetchData(`/api/admin/transactions?${params}`, (data: any) => { setTransactions(data.transactions); setTotalItems(data.total || 0); });
      }
      else if (activeTab === 'jobs') {
        const params = new URLSearchParams({ page: String(currentPage), limit: String(ITEMS_PER_PAGE) });
        if (dJobSearch.trim()) params.set('search', dJobSearch.trim());
        fetchData(`/api/admin/jobs?${params}`, (data: any) => { setJobs(data.jobs); setTotalItems(data.total || 0); });
      }
      else if (activeTab === 'settings') fetchSettings();
      else if (activeTab === 'templates') fetchData('/api/admin/email-templates', setTemplates);
      else if (activeTab === 'funnels') fetchData('/api/admin/funnels', setFunnels);
      else if (activeTab === 'funnel_report') fetchData('/api/admin/funnel-report', (data: any) => setFunnelReportData(data.data));
      else if (activeTab === 'academy') {
        fetchData('/api/admin/academy/modules', (data: any) => setAcademyModules(data.modules || []));
        fetchData('/api/admin/academy/resources', (data: any) => setAcademyResources(data.resources || []));
      }
    }
  }, [role, activeTab, session, currentPage, dSearchTerm, roleFilter, dTxSearch, txType, dJobSearch, ovYear, ovMonth]);

  const fetchData = async (endpoint: string, setter: any) => {
    
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (endpoint === '/api/admin/users') setter(data.users);
        else setter(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) alert("Lưu cấu hình thành công!");
    } catch (e) {
      alert("Lỗi khi lưu cấu hình");
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastSubject || !broadcastHtml) return alert("Vui lòng nhập đủ tiêu đề và nội dung email");
    if (!confirm("Bạn có chắc muốn gửi email này cho TẤT CẢ người dùng?")) return;
    
    setSendingEmail(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ subject: broadcastSubject, html: broadcastHtml })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(`Đã gửi thành công tới ${data.sent} người dùng!`);
        setBroadcastSubject('');
        setBroadcastHtml('');
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch (e) {
      alert("Lỗi khi gửi email");
    } finally {
      setSendingEmail(false);
    }
  };

  
  const handleUpdateAffiliatePct = async (userId: string) => {
    setUpdatingAffiliate(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/update-affiliate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ user_id: userId, affiliate_pct: affiliatePctInput })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Cập nhật phần trăm hoa hồng thành công!");
        setEditingAffiliateUserId(null);
        fetchData('/api/admin/users', setUsers);
      } else {
        alert("Lỗi: " + (data.detail || "Không thể cập nhật"));
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi khi cập nhật!');
    } finally {
      setUpdatingAffiliate(false);
    }
  };

  const handleUpdateRole = async (userId: string) => {
    if (updatingRole) return;
    setUpdatingRole(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: userId, role: roleInput })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert('Cập nhật quyền thành công!');
        setEditingRoleUserId(null);
        fetchData('/api/admin/users', setUsers);
      } else {
        alert(data.message || 'Lỗi cập nhật');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối');
    } finally {
      setUpdatingRole(false);
    }
  };

  const [refunding, setRefunding] = useState(false);
  const handleRefundStuckJobs = async () => {
    if (!window.confirm("Hệ thống sẽ hoàn tiền cho toàn bộ video bị treo quá 30 phút. Bạn có chắc chắn không?")) return;
    if (refunding) return;
    setRefunding(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/jobs/refund-stuck`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message);
        fetchData('/api/admin/jobs', (data: any) => setJobs(data.jobs));
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch (err) {
      alert("Lỗi kết nối");
    } finally {
      setRefunding(false);
    }
  };

  const handleAddBalance = async (userId: string) => {
    if (!addAmount || addAmount <= 0) return alert("Số tiền không hợp lệ");
    try {
      const res = await fetch(`${API_BASE}/api/admin/add_balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ user_id: userId, amount: addAmount })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Cộng tiền thành công! Số dư mới: " + data.new_balance);
        fetchData('/api/admin/users', setUsers);
        setSelectedUser(null);
      } else {
        alert("Lỗi: " + data.detail);
      }
    } catch (e) {
      alert("Đã xảy ra lỗi");
    }
  };

  const handleUpdateTemplate = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/email-templates/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify(templateForm)
      });
      if (res.ok) {
        alert("Cập nhật mẫu email thành công!");
        setEditingTemplateCode(null);
        fetchData('/api/admin/email-templates', setTemplates);
      } else {
        alert("Lỗi khi cập nhật");
      }
    } catch (e) {
      alert("Lỗi kết nối");
    }
  };

  const handleSaveFunnel = async () => {
    try {
      const method = editingFunnelId ? 'PUT' : 'POST';
      const url = editingFunnelId ? `${API_BASE}/api/admin/funnels/${editingFunnelId}` : `${API_BASE}/api/admin/funnels`;
      
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify(funnelForm)
      });
      
      if (res.ok) {
        alert("Lưu phễu email thành công!");
        setShowFunnelModal(false);
        fetchData('/api/admin/funnels', setFunnels);
      } else {
        alert("Lỗi khi lưu phễu email");
      }
    } catch (e) {
      alert("Lỗi kết nối");
    }
  };

  const handleDeleteFunnel = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa phễu này?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/funnels/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        fetchData('/api/admin/funnels', setFunnels);
      }
    } catch (e) {
      alert("Lỗi khi xóa");
    }
  };

  if (role !== 'admin' && role !== null) {
    return <Navigate to="/dashboard" replace />;
  }


  const { utmStats, totalUtmUsers, totalUtmRevenue } = React.useMemo(() => {
    if (!users || users.length === 0) return { utmStats: [], totalUtmUsers: 0, totalUtmRevenue: 0 };
    const statsMap: Record<string, { source: string, campaign: string, users_count: number, total_revenue: number }> = {};
    let totalUsers = 0;
    let totalRevenue = 0;
    
    users.forEach((u: any) => {
      if (!u.utm_source && !u.utm_campaign) return; // Ignore pure organic to keep report clean
      const source = u.utm_source || 'unknown';
      const campaign = u.utm_campaign || 'none';
      const key = `${source}_${campaign}`;
      
      if (!statsMap[key]) {
        statsMap[key] = { source, campaign, users_count: 0, total_revenue: 0 };
      }
      statsMap[key].users_count += 1;
      statsMap[key].total_revenue += (u.total_deposited || 0);
      totalUsers += 1;
      totalRevenue += (u.total_deposited || 0);
    });
    
    return {
      utmStats: Object.values(statsMap).sort((a, b) => b.total_revenue - a.total_revenue),
      totalUtmUsers: totalUsers,
      totalUtmRevenue: totalRevenue
    };
  }, [users]);

  const refreshAcademyModules = async () => {
    const res = await fetch(`${API_BASE}/api/admin/academy/modules`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    const data = await res.json();
    setAcademyModules(data.modules || []);
  };

  const handleSaveModule = async () => {
    const url = editingModuleId
      ? `${API_BASE}/api/admin/academy/modules/${editingModuleId}`
      : `${API_BASE}/api/admin/academy/modules`;
    await fetch(url, {
      method: editingModuleId ? 'PUT' : 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(moduleForm)
    });
    setShowModuleModal(false);
    refreshAcademyModules();
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Xóa chương này sẽ xóa tất cả bài học bên trong. Tiếp tục?')) return;
    await fetch(`${API_BASE}/api/admin/academy/modules/${moduleId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    refreshAcademyModules();
  };

  const handleSaveLesson = async () => {
    const url = editingLessonId
      ? `${API_BASE}/api/admin/academy/lessons/${editingLessonId}`
      : `${API_BASE}/api/admin/academy/lessons`;
    const body = editingLessonId ? lessonForm : { ...lessonForm, module_id: lessonParentModuleId };
    await fetch(url, {
      method: editingLessonId ? 'PUT' : 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setShowLessonModal(false);
    refreshAcademyModules();
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Xóa bài học này?')) return;
    await fetch(`${API_BASE}/api/admin/academy/lessons/${lessonId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    refreshAcademyModules();
  };

  const refreshAcademyResources = async () => {
    const res = await fetch(`${API_BASE}/api/admin/academy/resources`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    const data = await res.json();
    setAcademyResources(data.resources || []);
  };

  const handleSaveResource = async () => {
    const url = editingResourceId
      ? `${API_BASE}/api/admin/academy/resources/${editingResourceId}`
      : `${API_BASE}/api/admin/academy/resources`;
    await fetch(url, {
      method: editingResourceId ? 'PUT' : 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resourceForm)
    });
    setShowResourceModal(false);
    refreshAcademyResources();
  };

  const handleDeleteResource = async (id: string) => {
    if (!confirm('Xóa tài nguyên này?')) return;
    await fetch(`${API_BASE}/api/admin/academy/resources/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    refreshAcademyResources();
  };

  return (
    <div className="min-h-screen bg-[#e8f1f2] font-sans flex flex-col md:flex-row selection:bg-[#f6a287] selection:text-white">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-[#a2d5c6] border-b-4 border-[#2d2218] p-4 sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">👑</span>
          <span className="font-black text-lg text-[#2d2218] uppercase tracking-tighter">Admin_OS</span>
        </Link>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-2xl font-black text-[#2d2218] bg-white border-2 border-[#2d2218] rounded-xl px-3 py-1 shadow-[2px_2px_0px_#2d2218]">
          {sidebarOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Admin */}
      <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-64 bg-[#fdf9f1] border-r-4 border-[#2d2218] flex flex-col sticky top-0 md:min-h-screen z-10 shadow-[4px_0px_0px_#2d2218]`}>
        <div className="p-6 border-b-4 border-[#2d2218] bg-[#a2d5c6]">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-3xl">👑</span>
            <span className="font-black text-xl text-[#2d2218] uppercase tracking-tighter">Admin_OS</span>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          <button onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'overview' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            📊 Báo cáo Tổng quan
          </button>
          <button onClick={() => { setActiveTab('users'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'users' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            👥 Quản lý Người dùng
          </button>
          <button onClick={() => { setActiveTab('transactions'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'transactions' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            💸 Sổ cái Giao dịch
          </button>
          <button onClick={() => { setActiveTab('jobs'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'jobs' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            🎬 Tiến trình Video
          </button>
          
          <div className="my-2 border-t-2 border-dashed border-[#d4c5b9]"></div>
          
          <Link to="/write" target="_blank" className="text-left px-4 py-3 rounded-xl font-bold border-2 border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2] flex justify-between items-center">
            <span>📝 Viết Blog SEO</span> <span>↗</span>
          </Link>
          <button onClick={() => { setActiveTab('marketing'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'marketing' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            ✉️ Marketing (Email)
          </button>
          <button onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'settings' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            ⚙️ Cài đặt (Pixel)
          </button>
          <button onClick={() => { setActiveTab('academy'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'academy' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            📚 Khóa Học Miễn Phí
          </button>
          <div className="my-2 border-t-2 border-dashed border-[#d4c5b9]"></div>
          <button onClick={() => { setActiveTab('templates'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'templates' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            🎨 Mẫu Email (Templates)
          </button>
          <button onClick={() => { setActiveTab('funnels'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'funnels' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            ⏳ Phễu Email (Funnels)
          </button>
          <button onClick={() => { setActiveTab('funnel_report'); setSidebarOpen(false); }} className={`text-left px-4 py-3 rounded-xl font-bold border-2 ${activeTab === 'funnel_report' ? 'bg-[#f6a287] border-[#2d2218] shadow-[2px_2px_0px_#2d2218]' : 'border-transparent text-[#6b5a4b] hover:bg-[#e8f1f2]'}`}>
            📊 Báo Cáo Phễu
          </button>
        </nav>
        
        <div className="p-4 border-t-4 border-[#2d2218] bg-white">
          <Link to="/dashboard" className="block text-center px-4 py-2 bg-white font-bold border-2 border-[#2d2218] rounded-xl shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218]">
            Quay lại App ↪
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 overflow-x-hidden">
        
        {activeTab === 'funnel_report' && funnelReportData && (
          <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden mb-8">
            <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1]">
              <h2 className="text-2xl font-black text-[#2d2218] uppercase">Báo Cáo Phễu Chuyển Đổi</h2>
              <p className="text-[#6b5a4b] font-medium mt-2">Đo lường từ lúc đăng ký đến khi nạp tiền.</p>
            </div>
            <div className="p-8 bg-[#fdf8ef]">
              <div className="max-w-4xl mx-auto py-4">
                <div className="relative">
                  {/* Dòng kẻ dọc kết nối các bước */}
                  <div className="absolute left-[3rem] sm:left-[4rem] top-12 bottom-12 w-3 bg-[#2d2218] rounded-full z-0 hidden sm:block"></div>
                  
                  {/* Bước 1 */}
                  <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8 mb-8 sm:mb-16 group">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#a2d5c6] border-[4px] border-[#2d2218] flex items-center justify-center text-4xl sm:text-5xl shadow-[6px_6px_0px_#2d2218] flex-shrink-0 z-10 group-hover:-translate-y-2 group-hover:shadow-[8px_8px_0px_#2d2218] transition-all">
                      👋
                    </div>
                    <div className="flex-1 w-full bg-white border-[4px] border-[#2d2218] rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#2d2218] flex flex-col sm:flex-row items-center justify-between gap-6 group-hover:-translate-y-1 group-hover:shadow-[10px_10px_0px_#2d2218] transition-all">
                      <div className="text-center sm:text-left">
                        <h3 className="font-black text-[#2d2218] text-2xl sm:text-3xl mb-2">Đăng Ký Tài Khoản</h3>
                        <p className="text-[#6b5a4b] font-bold text-base sm:text-lg">Tổng số thành viên hệ thống</p>
                      </div>
                      <div className="text-4xl sm:text-5xl font-black text-[#2d2218] bg-[#fdf9f1] px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border-[4px] border-[#2d2218] shadow-[4px_4px_0px_#2d2218]">
                        {funnelReportData.step1_registered.toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>

                  {/* Tỷ lệ 1 */}
                  <div className="relative z-10 flex justify-center sm:justify-start sm:ml-40 -mt-12 sm:-mt-24 mb-12 sm:mb-16">
                    <div className="bg-[#e8f1f2] border-[4px] border-[#2d2218] rounded-2xl px-6 py-3 text-lg font-black text-[#2d2218] shadow-[6px_6px_0px_#2d2218] flex items-center gap-3 transform sm:-rotate-2">
                      <span className="text-xl">👇</span>
                      <span>Chuyển đổi:</span>
                      <span className="text-white text-xl sm:text-2xl bg-[#2d2218] px-3 py-1 rounded-xl">
                        {funnelReportData.step1_registered > 0 ? ((funnelReportData.step2_active / funnelReportData.step1_registered) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>

                  {/* Bước 2 */}
                  <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8 mb-8 sm:mb-16 group">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#fce4ec] border-[4px] border-[#2d2218] flex items-center justify-center text-4xl sm:text-5xl shadow-[6px_6px_0px_#2d2218] flex-shrink-0 z-10 group-hover:-translate-y-2 group-hover:shadow-[8px_8px_0px_#2d2218] transition-all">
                      🔥
                    </div>
                    <div className="flex-1 w-full bg-white border-[4px] border-[#2d2218] rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#2d2218] flex flex-col sm:flex-row items-center justify-between gap-6 group-hover:-translate-y-1 group-hover:shadow-[10px_10px_0px_#2d2218] transition-all">
                      <div className="text-center sm:text-left">
                        <h3 className="font-black text-[#2d2218] text-2xl sm:text-3xl mb-2">Sử Dụng Tính Năng</h3>
                        <p className="text-[#6b5a4b] font-bold text-base sm:text-lg">Đã dùng AI xử lý video</p>
                      </div>
                      <div className="text-4xl sm:text-5xl font-black text-[#2d2218] bg-[#fdf9f1] px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border-[4px] border-[#2d2218] shadow-[4px_4px_0px_#2d2218]">
                        {funnelReportData.step2_active.toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>

                  {/* Tỷ lệ 2 */}
                  <div className="relative z-10 flex justify-center sm:justify-start sm:ml-40 -mt-12 sm:-mt-24 mb-12 sm:mb-16">
                    <div className="bg-[#fdf9f1] border-[4px] border-[#2d2218] rounded-2xl px-6 py-3 text-lg font-black text-[#2d2218] shadow-[6px_6px_0px_#2d2218] flex items-center gap-3 transform sm:-rotate-2">
                      <span className="text-xl">👇</span>
                      <span>Chuyển đổi:</span>
                      <span className="text-[#2d2218] text-xl sm:text-2xl bg-[#a2d5c6] border-2 border-[#2d2218] px-3 py-1 rounded-xl">
                        {funnelReportData.step2_active > 0 ? ((funnelReportData.step3_paid / funnelReportData.step2_active) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>

                  {/* Bước 3 */}
                  <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8 group">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#f6a287] border-[4px] border-[#2d2218] flex items-center justify-center text-4xl sm:text-5xl shadow-[6px_6px_0px_#2d2218] flex-shrink-0 z-10 group-hover:-translate-y-2 group-hover:shadow-[8px_8px_0px_#2d2218] transition-all">
                      💎
                    </div>
                    <div className="flex-1 w-full bg-[#2d2218] border-[4px] border-[#2d2218] rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#f6a287] flex flex-col sm:flex-row items-center justify-between gap-6 group-hover:-translate-y-1 group-hover:shadow-[10px_10px_0px_#f6a287] transition-all relative overflow-hidden">
                      {/* Hiệu ứng tia chớp trang trí */}
                      <div className="absolute top-0 right-0 p-4 opacity-10 text-8xl pointer-events-none">⚡</div>
                      
                      <div className="text-center sm:text-left relative z-10">
                        <h3 className="font-black text-[#fdf9f1] text-2xl sm:text-3xl mb-2">Khách Hàng Trả Phí</h3>
                        <p className="text-[#a2d5c6] font-bold text-base sm:text-lg">Đã nạp tiền thành công</p>
                      </div>
                      <div className="text-4xl sm:text-5xl font-black text-[#2d2218] bg-[#f6a287] px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border-[4px] border-[#2d2218] shadow-[4px_4px_0px_#fdf9f1] relative z-10">
                        {funnelReportData.step3_paid.toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              
              <div className="mt-16 max-w-4xl mx-auto">
                <div className="bg-[#a2d5c6] border-[4px] border-[#2d2218] rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_#2d2218] flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="text-center sm:text-left">
                    <h3 className="font-black text-[#2d2218] text-2xl mb-1">Tỷ Lệ Chuyển Đổi Tổng Thể</h3>
                    <p className="text-[#2d2218] font-bold opacity-80">Từ lúc đăng ký ➡️ Khách hàng trả phí</p>
                  </div>
                  <div className="text-5xl font-black text-white bg-[#2d2218] px-8 py-4 rounded-2xl border-[4px] border-[#2d2218] shadow-[6px_6px_0px_#fdf9f1]">
                    {funnelReportData.step1_registered > 0 ? ((funnelReportData.step3_paid / funnelReportData.step1_registered) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
              
              {/* CÔNG CỤ TẠO LINK UTM & BẮN SỰ KIỆN */}
              <div className="mt-12 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. UTM Generator */}
                <div className="bg-white border-[4px] border-[#2d2218] rounded-3xl p-6 shadow-[6px_6px_0px_#2d2218]">
                  <h3 className="font-black text-[#2d2218] text-xl mb-4 uppercase">🔗 Trình tạo Link UTM Quảng Cáo</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#6b5a4b] mb-1">Nguồn (Source)</label>
                      <select value={utmSource} onChange={e => setUtmSource(e.target.value)} className="w-full px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold bg-[#fdf9f1]">
                        <option value="facebook">Facebook (facebook)</option>
                        <option value="tiktok">TikTok (tiktok)</option>
                        <option value="zalo">Zalo (zalo)</option>
                        <option value="youtube">YouTube (youtube)</option>
                        <option value="other">Khác (other)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#6b5a4b] mb-1">Phương thức (Medium)</label>
                      <input type="text" value={utmMedium} onChange={e => setUtmMedium(e.target.value)} placeholder="vd: cpc, video, banner" className="w-full px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#6b5a4b] mb-1">Tên Chiến Dịch (Campaign)</label>
                      <input type="text" value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} placeholder="vd: KhuyenMai_T8" className="w-full px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold" />
                    </div>
                    <button onClick={generateUtmLink} className="w-full py-3 bg-[#f6a287] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all">Tạo Link URL</button>
                    {generatedUtm && (
                      <div className="mt-4 p-3 bg-[#e8f1f2] border-2 border-[#2d2218] rounded-xl relative group">
                        <p className="text-xs font-bold break-all pr-8 text-[#2d2218]">{generatedUtm}</p>
                        <button onClick={() => {navigator.clipboard.writeText(generatedUtm); alert('Đã copy!');}} className="absolute right-2 top-2 p-1 bg-white border-2 border-[#2d2218] rounded cursor-pointer hover:bg-gray-100" title="Copy">
                          📋
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Fire Demo Events */}
                <div className="bg-white border-[4px] border-[#2d2218] rounded-3xl p-6 shadow-[6px_6px_0px_#2d2218]">
                  <h3 className="font-black text-[#2d2218] text-xl mb-4 uppercase">🚀 Bắn sự kiện FB Pixel (Demo)</h3>
                  <p className="text-sm font-medium text-[#6b5a4b] mb-6">
                    Sử dụng công cụ này để mô phỏng một khách hàng đi qua toàn bộ phễu. FB Pixel sẽ nhận diện được các <b>Sự kiện tùy chỉnh (Custom Events)</b> để bạn có thể chọn làm Mục tiêu chuyển đổi trong tài khoản Ads.
                  </p>
                  <button onClick={triggerDemoPixelEvents} className="w-full py-4 bg-[#a2d5c6] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all flex justify-center items-center gap-2 text-lg">
                    <span>🔥</span> Gửi Dữ Liệu Demo Ngay
                  </button>
                  <ul className="mt-6 space-y-2 text-xs font-bold text-[#6b5a4b]">
                    <li>✅ CompleteRegistration (Đăng ký)</li>
                    <li>✅ StartTrial (Dùng thử)</li>
                    <li>✅ SubmitVideoUrl (Gửi Video)</li>
                    <li>✅ VideoProcessedSuccess (Xử lý xong)</li>
                    <li>✅ InitiateCheckout (Mở bảng giá)</li>
                    <li>✅ Purchase (Nạp tiền)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
                
        {/* CẢNH BÁO CREDIT OPENAI / VBEE - hiển thị ở mọi tab */}
        {providerAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            {providerAlerts.map((a: any) => (
              <div key={a.provider} className="bg-[#ffcccb] border-4 border-[#2d2218] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_#2d2218] flex items-start gap-3">
                <span className="text-3xl">🚨</span>
                <div className="flex-1">
                  <p className="font-black text-[#2d2218] uppercase">
                    Cảnh báo {a.provider === 'openai' ? 'OpenAI' : 'Vbee'}: hết credit / hạn mức
                  </p>
                  <p className="font-medium text-[#2d2218] text-sm mt-1">{a.message}</p>
                  <p className="text-xs text-[#6b5a4b] font-bold mt-2">
                    Lỗi lần đầu: {new Date(a.first_seen * 1000).toLocaleString('vi-VN')} · Gần nhất: {new Date(a.last_seen * 1000).toLocaleString('vi-VN')} · {a.count} lần
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#fdf9f1] p-4 sm:p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
              <div>
                <h2 className="text-2xl font-black text-[#2d2218] uppercase tracking-tight">Tổng Quan Hệ Thống</h2>
                <p className="font-bold text-[#6b5a4b]">Báo cáo nhanh các chỉ số quan trọng của dự án.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-[#2d2218] text-sm">📅 Doanh thu nạp:</span>
                <select
                  value={ovYear}
                  onChange={(e) => setOvYear(Number(e.target.value))}
                  className="px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none bg-white"
                >
                  <option value={0}>Tất cả thời gian</option>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
                <select
                  value={ovYear ? ovMonth : 0}
                  disabled={!ovYear}
                  onChange={(e) => setOvMonth(Number(e.target.value))}
                  className="px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none bg-white disabled:opacity-40"
                >
                  <option value={0}>Cả năm</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={async () => {
                  if(confirm("Bạn có chắc chắn muốn dọn dẹp bộ nhớ server? Các file video cũ sẽ bị xóa vĩnh viễn.")){
                    const res = await fetch(API_BASE + '/api/admin/clear-cache', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${session?.access_token}` }
                    });
                    const data = await res.json();
                    alert(data.message);
                    fetchData(overviewUrl(), (data: any) => setOverviewData(data.metrics));
                  }
                }}
                className="w-full sm:w-auto bg-yellow-300 text-[#2d2218] font-black px-6 py-3 rounded-xl border-2 border-[#2d2218] shadow-[2px_2px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center justify-center gap-2"
              >
                🧹 Dọn Rác Máy Chủ
              </button>
            </div>

            {overviewData ? (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div onClick={() => handleCardClick('auto_add')} className="bg-[#a2d5c6] p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218] cursor-pointer hover:scale-105 transition-transform">
                  <h3 className="font-bold text-[#2d2218] mb-2">🤖 Nạp Tự Động</h3>
                  <p className="text-xs font-bold text-[#2d2218]/70 -mt-1 mb-1">{ovYear ? (ovMonth ? `Tháng ${ovMonth}/${ovYear}` : `Năm ${ovYear}`) : 'Tất cả thời gian'}</p>
                  <p className="text-3xl font-black text-[#2d2218]">{(overviewData.total_add_auto || 0).toLocaleString()}đ</p>
                </div>
                
                <div onClick={() => handleCardClick('manual_add')} className="bg-[#b4d5a2] p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218] cursor-pointer hover:scale-105 transition-transform">
                  <h3 className="font-bold text-[#2d2218] mb-2">👋 Nạp Thủ Công</h3>
                  <p className="text-xs font-bold text-[#2d2218]/70 -mt-1 mb-1">{ovYear ? (ovMonth ? `Tháng ${ovMonth}/${ovYear}` : `Năm ${ovYear}`) : 'Tất cả thời gian'}</p>
                  <p className="text-3xl font-black text-[#2d2218]">{(overviewData.total_add_manual || 0).toLocaleString()}đ</p>
                </div>
                
                <div onClick={() => handleCardClick('deduct')} className="bg-[#f6a287] p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218] cursor-pointer hover:scale-105 transition-transform">
                  <h3 className="font-bold text-[#2d2218] mb-2">💸 Tổng Tiêu Dùng</h3>
                  <p className="text-3xl font-black text-[#2d2218]">{(overviewData.total_deduct || 0).toLocaleString()}đ</p>
                </div>
                
                <div onClick={() => handleCardClick('affiliate')} className="bg-yellow-300 p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218] cursor-pointer hover:scale-105 transition-transform">
                  <h3 className="font-bold text-[#2d2218] mb-2">🏦 Đã Chi Affiliate</h3>
                  <p className="text-3xl font-black text-[#2d2218]">{(overviewData.total_affiliate || 0).toLocaleString()}đ</p>
                </div>
                
                <div className="bg-white p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
                  <h3 className="font-bold text-[#2d2218] mb-2">👥 Tổng Users</h3>
                  <p className="text-3xl font-black text-[#2d2218]">{overviewData.total_users || 0}</p>
                </div>

                <div className="bg-blue-300 p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
                  <h3 className="font-bold text-[#2d2218] mb-2">🎬 Video Hoàn Thành</h3>
                  <p className="text-3xl font-black text-[#2d2218]">{overviewData.jobs_done || 0}</p>
                </div>

                <div className="bg-red-300 p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
                  <h3 className="font-bold text-[#2d2218] mb-2">❌ Lỗi Sinh Video</h3>
                  <p className="text-3xl font-black text-[#2d2218]">{overviewData.jobs_error || 0}</p>
                </div>

                <div className="bg-gray-300 p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218] lg:col-span-2 xl:col-span-3 flex flex-col justify-center">
                  <h3 className="font-bold text-[#2d2218] mb-2">💾 Bộ Nhớ Máy Chủ Đang Bị Chiếm Dụng</h3>
                  <p className="text-3xl font-black text-[#2d2218]">{overviewData.storage_formatted || "0 B"}</p>
                  {overviewData.storage_bytes > 5 * 1024 * 1024 * 1024 && (
                    <p className="text-red-700 font-bold mt-2">Cảnh báo: Bộ nhớ rác đã vượt quá 5GB, hãy ấn dọn dẹp!</p>
                  )}
                </div>
              </div>
              </>

            ) : (
              <div className="text-center font-bold text-[#6b5a4b] py-12">Đang tải dữ liệu...</div>
            )}
            
            {showTxModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-2xl shadow-[8px_8px_0px_#2d2218] p-6 w-full max-w-4xl max-h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-black text-[#2d2218]">{modalTxTitle}</h2>
                      <button onClick={() => setShowTxModal(false)} className="text-3xl font-black text-[#2d2218] hover:text-red-500">&times;</button>
                    </div>
                    
                    <div className="overflow-auto bg-white border-4 border-[#2d2218] rounded-xl flex-1">
                      <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-[#2d2218] text-[#fdf9f1]">
                          <tr>
                            <th className="p-3 font-bold border-r border-[#fdf9f1]">Thời gian</th>
                            <th className="p-3 font-bold border-r border-[#fdf9f1]">Email</th>
                            <th className="p-3 font-bold border-r border-[#fdf9f1]">Số Tiền</th>
                            <th className="p-3 font-bold">Mô tả</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalTxData.length === 0 ? (
                            <tr><td colSpan={4} className="p-4 text-center font-bold">Không có dữ liệu</td></tr>
                          ) : (
                            modalTxData.map((item, idx) => (
                              <tr key={idx} className="border-b-2 border-[#2d2218] hover:bg-gray-100 font-bold">
                                <td className="p-3 border-r-2 border-[#2d2218]">{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                                <td className="p-3 border-r-2 border-[#2d2218]">{item.email || 'Không rõ'}</td>
                                <td className="p-3 border-r-2 border-[#2d2218] text-green-600">
                                  {Math.abs(item.amount).toLocaleString()}đ
                                </td>
                                <td className="p-3">{item.description || (item.bank_name + ' - ' + item.bank_account)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}





{/* USERS */}
        {activeTab === 'users' && (
          <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden">
            <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-[#2d2218] uppercase">Danh sách người dùng</h2>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <input 
                  type="text" 
                  placeholder="🔍 Tìm theo ID, Email, Mã nạp..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none"
                />
                <select 
                  value={roleFilter} 
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-4 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none bg-white"
                >
                  <option value="all">Tất cả phân quyền</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-x-auto">
              <p className="text-xs text-[#6b5a4b] font-medium mb-2 md:hidden">👉 Vuốt ngang để xem đầy đủ bảng</p>
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b-4 border-[#2d2218]">
                    <th className="pb-4 font-black text-[#2d2218]">MÃ NẠP (PAY_CODE)</th>
                    <th className="pb-4 font-black text-[#2d2218]">TÀI KHOẢN</th>
                    <th className="pb-4 font-black text-[#2d2218]">SỐ DƯ</th>
                    <th className="pb-4 font-black text-[#2d2218]">PHÂN QUYỀN</th>
                    <th className="pb-4 font-black text-[#2d2218]">HOA HỒNG AFF (%)</th>
                    <th className="pb-4 font-black text-[#2d2218]">NGUỒN ĐĂNG KÝ (UTM)</th>
                    <th className="pb-4 font-black text-[#2d2218] text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b-2 border-dashed border-[#a08f7f] last:border-0 hover:bg-[#fdf9f1]">
                      <td className="py-4 font-bold text-[#e65c4f] text-lg">
                        TVN{u.pay_code}
                      </td>
                      <td className="py-4 font-medium text-[#2d2218]">
                        <div>{u.email}</div>
                        <div className="text-xs text-[#a08f7f] truncate w-32" title={u.user_id}>{u.user_id}</div>
                      </td>
                      <td className="py-4 font-bold text-[#388e3c] text-lg">
                        {u.balance.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-4">
                        {editingRoleUserId === u.user_id ? (
                          <div className="flex flex-col gap-2">
                            <select 
                              value={roleInput} 
                              onChange={(e) => setRoleInput(e.target.value)}
                              className="px-2 py-1 border-2 border-[#2d2218] rounded-lg font-bold text-xs outline-none"
                            >
                              <option value="user">USER</option>
                              <option value="editor">EDITOR</option>
                              <option value="admin">ADMIN</option>
                            </select>
                            <div className="flex gap-1">
                              <button disabled={updatingRole} onClick={() => handleUpdateRole(u.user_id)} className="flex-1 py-1 bg-[#a2d5c6] font-bold border-2 border-[#2d2218] rounded-lg text-xs">Lưu</button>
                              <button onClick={() => setEditingRoleUserId(null)} className="flex-1 py-1 bg-white font-bold border-2 border-[#2d2218] rounded-lg text-xs">Hủy</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-[#2d2218] ${u.role === 'admin' ? 'bg-[#f6a287] text-[#2d2218]' : u.role === 'editor' ? 'bg-[#a2d5c6] text-[#2d2218]' : 'bg-[#e8f1f2] text-[#6b5a4b]'}`}>
                              {u.role.toUpperCase()}
                            </span>
                            <button 
                              onClick={async () => {
                                const newVip = !(u as any).is_vip;
                                try {
                                  await fetch(`${API_BASE}/api/admin/users/toggle-vip`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ user_id: u.user_id, is_vip: newVip })
                                  });
                                  const params = new URLSearchParams({ page: String(currentPage), limit: String(ITEMS_PER_PAGE) });
                                  if (searchTerm) params.set('search', searchTerm);
                                  if (roleFilter !== 'all') params.set('role_filter', roleFilter);
                                  fetchData(`/api/admin/users?${params}`, (data: any) => { setUsers(data.users || data); setTotalItems(data.total || 0); });
                                } catch { alert('Lỗi cập nhật VIP'); }
                              }}
                              className={`px-2 py-1 rounded-full text-xs font-bold border-2 border-[#2d2218] cursor-pointer transition-all ${(u as any).is_vip ? 'bg-[#e65c4f] text-white' : 'bg-gray-100 text-gray-400'}`}
                              title={(u as any).is_vip ? 'Click để tắt VIP' : 'Click để bật VIP'}
                            >
                              {(u as any).is_vip ? '👑 VIP' : 'Free'}
                            </button>
                            <button onClick={() => { setEditingRoleUserId(u.user_id); setRoleInput(u.role); }} className="text-xs font-bold text-[#6b5a4b] hover:text-[#e65c4f] underline">Sửa</button>
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        {editingAffiliateUserId === u.user_id ? (
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              value={affiliatePctInput} 
                              onChange={(e) => setAffiliatePctInput(Number(e.target.value))} 
                              className="w-16 px-2 py-1 border-2 border-[#2d2218] rounded-lg font-bold text-sm outline-none" 
                            />
                            <button disabled={updatingAffiliate} onClick={() => handleUpdateAffiliatePct(u.user_id)} className="px-2 py-1 bg-[#a2d5c6] font-bold border-2 border-[#2d2218] rounded-lg text-xs">OK</button>
                            <button onClick={() => setEditingAffiliateUserId(null)} className="px-2 py-1 bg-white font-bold border-2 border-[#2d2218] rounded-lg text-xs">Hủy</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-[#2d2218]">{(u as any).affiliate_pct || 20}%</span>
                            <button onClick={() => { setEditingAffiliateUserId(u.user_id); setAffiliatePctInput((u as any).affiliate_pct || 20); }} className="text-xs font-bold text-[#6b5a4b] hover:text-[#e65c4f] underline">Sửa</button>
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        {(u as any).utm_source ? (
                          <div className="text-xs font-bold text-[#2d2218]">
                            <span className="bg-[#a2d5c6] px-2 py-1 rounded border border-[#2d2218] mr-1">{(u as any).utm_source}</span>
                            {(u as any).utm_campaign && <span className="bg-[#e8f1f2] px-2 py-1 rounded border border-[#2d2218]">{(u as any).utm_campaign}</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Tự nhiên</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        {selectedUser === u.user_id ? (
                          <div className="flex items-center justify-end gap-2">
                            <input type="number" value={addAmount} onChange={(e) => setAddAmount(Number(e.target.value))} className="w-28 px-3 py-2 border-2 border-[#2d2218] rounded-xl font-bold text-sm outline-none" />
                            <button onClick={() => handleAddBalance(u.user_id)} className="px-4 py-2 bg-[#a2d5c6] font-bold border-2 border-[#2d2218] rounded-xl shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] text-sm">OK</button>
                            <button onClick={() => setSelectedUser(null)} className="px-4 py-2 bg-white font-bold border-2 border-[#2d2218] rounded-xl text-sm">Hủy</button>
                          </div>
                        ) : (
                          <button onClick={() => { setSelectedUser(u.user_id); setAddAmount(50000); }} className="px-5 py-2 bg-[#f6a287] font-bold border-2 border-[#2d2218] rounded-xl shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all text-sm">+ Nạp Tiền</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              {totalItems > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-6 py-4 border-t-2 border-[#2d2218]">
                  <p className="text-sm font-medium text-[#6b5a4b]">
                    Hiển thị {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} / {totalItems}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-4 py-2 font-bold border-2 border-[#2d2218] rounded-xl bg-white disabled:opacity-40 hover:bg-[#fdf9f1] transition-all text-sm"
                    >
                      ← Trước
                    </button>
                    <span className="px-4 py-2 font-bold text-sm text-[#2d2218]">
                      Trang {currentPage} / {Math.ceil(totalItems / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalItems / ITEMS_PER_PAGE), p + 1))}
                      disabled={currentPage >= Math.ceil(totalItems / ITEMS_PER_PAGE)}
                      className="px-4 py-2 font-bold border-2 border-[#2d2218] rounded-xl bg-white disabled:opacity-40 hover:bg-[#fdf9f1] transition-all text-sm"
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MARKETING */}
        {activeTab === 'marketing' && (
          <div className="space-y-8 w-full">
            <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden max-w-4xl">
              <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1]">
                <h2 className="text-2xl font-black text-[#2d2218] uppercase">Gửi Email Hàng Loạt (Broadcast)</h2>
                <p className="font-medium text-[#6b5a4b] mt-2">Gửi email marketing đến toàn bộ khách hàng trong hệ thống qua Resend.</p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-[#2d2218] mb-2">Tiêu đề Email (Subject)</label>
                  <input 
                    type="text" 
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl outline-none text-[#2d2218] font-bold shadow-[2px_2px_0px_#2d2218]" 
                    placeholder="Khuyến mãi 50% dịp lễ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#2d2218] mb-2">Nội dung (HTML hỗ trợ)</label>
                  <textarea 
                    rows={8}
                    value={broadcastHtml}
                    onChange={(e) => setBroadcastHtml(e.target.value)}
                    className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl outline-none text-[#2d2218] font-medium shadow-[2px_2px_0px_#2d2218]" 
                    placeholder="<h2>Chào bạn,</h2><p>Nhân dịp...</p>"
                  />
                </div>
                <button 
                  onClick={handleSendBroadcast}
                  disabled={sendingEmail}
                  className="w-full py-4 bg-[#f6a287] font-black text-[#2d2218] text-lg border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218] hover:translate-y-[4px] hover:shadow-[0px_0px_0px_#2d2218] transition-all disabled:opacity-50"
                >
                  {sendingEmail ? "Đang gửi..." : "🚀 GỬI BROADCAST NGAY"}
                </button>
              </div>
            </div>
            
            {/* Báo cáo UTM */}
            <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden max-w-4xl">
              <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1]">
                <h2 className="text-2xl font-black text-[#2d2218] uppercase">Báo cáo UTM Quảng Cáo</h2>
                <p className="font-medium text-[#6b5a4b] mt-2">Theo dõi hiệu quả chiến dịch quảng cáo và doanh thu tương ứng.</p>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#a2d5c6] text-[#2d2218] border-b-4 border-[#2d2218]">
                      <th className="p-4 font-black">Nguồn (Source)</th>
                      <th className="p-4 font-black">Chiến dịch (Campaign)</th>
                      <th className="p-4 font-black text-center">Số User</th>
                      <th className="p-4 font-black text-center">% Tổng User</th>
                      <th className="p-4 font-black text-right">Tổng Nạp</th>
                      <th className="p-4 font-black text-center">% Tổng Nạp</th>
                      <th className="p-4 font-black text-right">ARPU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utmStats.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-[#6b5a4b] font-bold">Chưa có dữ liệu UTM</td>
                      </tr>
                    ) : (
                      <>
                        {utmStats.map((stat, i) => {
                          const userPercent = totalUtmUsers > 0 ? ((stat.users_count / totalUtmUsers) * 100).toFixed(1) : '0';
                          const revPercent = totalUtmRevenue > 0 ? ((stat.total_revenue / totalUtmRevenue) * 100).toFixed(1) : '0';
                          const arpu = stat.users_count > 0 ? Math.round(stat.total_revenue / stat.users_count) : 0;
                          return (
                            <tr key={i} className="border-b-2 border-[#2d2218] hover:bg-[#fdf9f1] font-bold text-[#2d2218]">
                              <td className="p-4">{stat.source}</td>
                              <td className="p-4 text-[#f6a287]">{stat.campaign}</td>
                              <td className="p-4 text-center">{stat.users_count}</td>
                              <td className="p-4 text-center text-blue-600">{userPercent}%</td>
                              <td className="p-4 text-right text-green-700">{stat.total_revenue.toLocaleString('vi-VN')}đ</td>
                              <td className="p-4 text-center text-blue-600">{revPercent}%</td>
                              <td className="p-4 text-right text-purple-700">{arpu.toLocaleString('vi-VN')}đ</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-[#f6a287] text-[#2d2218] font-black border-t-4 border-[#2d2218]">
                          <td className="p-4" colSpan={2}>TỔNG CỘNG CÁC NGUỒN</td>
                          <td className="p-4 text-center">{totalUtmUsers}</td>
                          <td className="p-4 text-center">100%</td>
                          <td className="p-4 text-right">{totalUtmRevenue.toLocaleString('vi-VN')}đ</td>
                          <td className="p-4 text-center">100%</td>
                          <td className="p-4 text-right">{totalUtmUsers > 0 ? Math.round(totalUtmRevenue / totalUtmUsers).toLocaleString('vi-VN') : '0'}đ</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden max-w-3xl">
            <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1]">
              <h2 className="text-2xl font-black text-[#2d2218] uppercase">Cài đặt Hệ thống</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Facebook Pixel ID</label>
                <input 
                  type="text" 
                  value={settings.fb_pixel}
                  onChange={(e) => setSettings({...settings, fb_pixel: e.target.value})}
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl outline-none font-bold shadow-[2px_2px_0px_#2d2218]" 
                  placeholder="Ví dụ: 1234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">TikTok Pixel ID</label>
                <input 
                  type="text" 
                  value={settings.tiktok_pixel}
                  onChange={(e) => setSettings({...settings, tiktok_pixel: e.target.value})}
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl outline-none font-bold shadow-[2px_2px_0px_#2d2218]" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Google Analytics (G-XXXX)</label>
                <input 
                  type="text" 
                  value={settings.google_analytics}
                  onChange={(e) => setSettings({...settings, google_analytics: e.target.value})}
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl outline-none font-bold shadow-[2px_2px_0px_#2d2218]" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#2d2218] mb-2">Đào tạo AI viết bài (Custom Instructions)</label>
                <textarea 
                  value={settings.ai_custom_instructions || ''}
                  onChange={(e) => setSettings({...settings, ai_custom_instructions: e.target.value})}
                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl outline-none font-bold shadow-[2px_2px_0px_#2d2218]" 
                  placeholder="Nhập kiến thức để đào tạo AI (ví dụ: Hãy viết với văn phong hài hước, nhắc đến thương hiệu X...)"
                  rows={4}
                />
              </div>
              <button 
                onClick={handleSaveSettings}
                className="px-8 py-3 bg-[#a2d5c6] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all"
              >
                💾 Lưu Cài Đặt
              </button>
            </div>
          </div>
        )}

        {/* TRANSACTIONS & JOBS ... */}
        {activeTab === 'transactions' && (
          <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden">
            <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-[#2d2218] uppercase">Sổ cái Giao dịch</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="🔍 Tìm theo Email hoặc ID (UUID)..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="px-4 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none"
                />
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value)}
                  className="px-4 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none bg-white"
                >
                  <option value="all">Tất cả loại</option>
                  <option value="DEPOSIT">Deposit (Nạp tiền)</option>
                  <option value="REFUND">Refund (Hoàn tiền)</option>
                  <option value="DEDUCT">Deduct (Trừ tiền)</option>
                  <option value="WITHDRAW">Withdraw (Rút tiền)</option>
                  <option value="AFFILIATE_COMMISSION">Affiliate (Hoa hồng)</option>
                </select>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto">
              <p className="text-xs text-[#6b5a4b] font-medium mb-2 md:hidden">👉 Vuốt ngang để xem đầy đủ bảng</p>
              <table className="w-full text-left border-collapse min-w-[800px]">
                {/* Headers */}
                <thead>
                  <tr className="border-b-4 border-[#2d2218]">
                    <th className="pb-4 font-black text-[#2d2218]">THỜI GIAN</th>
                    <th className="pb-4 font-black text-[#2d2218]">TÀI KHOẢN</th>
                    <th className="pb-4 font-black text-[#2d2218]">SỐ TIỀN</th>
                    <th className="pb-4 font-black text-[#2d2218]">LOẠI</th>
                    <th className="pb-4 font-black text-[#2d2218]">MÔ TẢ</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b-2 border-dashed border-[#a08f7f] hover:bg-[#fdf9f1]">
                      <td className="py-4 font-medium text-[#6b5a4b]">{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                      <td className="py-4 font-bold text-[#2d2218]">{t.email}</td>
                      <td className={`py-4 font-bold text-lg ${t.amount > 0 ? 'text-[#388e3c]' : 'text-[#d32f2f]'}`}>
                        {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-4"><span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-[#2d2218] ${t.type === 'DEPOSIT' ? 'bg-[#a2d5c6]' : 'bg-[#fdf9f1]'}`}>{t.type}</span></td>
                      <td className="py-4 text-[#6b5a4b]">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              {totalItems > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-6 py-4 border-t-2 border-[#2d2218]">
                  <p className="text-sm font-medium text-[#6b5a4b]">
                    Hiển thị {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} / {totalItems}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-4 py-2 font-bold border-2 border-[#2d2218] rounded-xl bg-white disabled:opacity-40 hover:bg-[#fdf9f1] transition-all text-sm"
                    >
                      ← Trước
                    </button>
                    <span className="px-4 py-2 font-bold text-sm text-[#2d2218]">
                      Trang {currentPage} / {Math.ceil(totalItems / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalItems / ITEMS_PER_PAGE), p + 1))}
                      disabled={currentPage >= Math.ceil(totalItems / ITEMS_PER_PAGE)}
                      className="px-4 py-2 font-bold border-2 border-[#2d2218] rounded-xl bg-white disabled:opacity-40 hover:bg-[#fdf9f1] transition-all text-sm"
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
           <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden">
             <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1] flex flex-col sm:flex-row justify-between items-center gap-4">
               <h2 className="text-2xl font-black text-[#2d2218] uppercase">Tiến trình Video Jobs</h2>
               <input
                 type="text"
                 placeholder="🔍 Tìm theo Email hoặc ID (UUID)..."
                 value={jobSearch}
                 onChange={(e) => setJobSearch(e.target.value)}
                 className="px-4 py-2 border-2 border-[#2d2218] rounded-xl font-bold outline-none flex-1 min-w-[200px] max-w-sm"
               />
               <button 
                 onClick={handleRefundStuckJobs}
                 disabled={refunding}
                 className="px-5 py-2 bg-[#ffcccb] font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218] transition-all whitespace-nowrap"
               >
                 {refunding ? 'Đang xử lý...' : '🔄 Dọn dẹp & Hoàn tiền video treo'}
               </button>
             </div>
             <div className="p-4 sm:p-6 overflow-x-auto">
               <p className="text-xs text-[#6b5a4b] font-medium mb-2 md:hidden">👉 Vuốt ngang để xem đầy đủ bảng</p>
               <table className="w-full text-left border-collapse min-w-[800px]">
                 <thead>
                   <tr className="border-b-4 border-[#2d2218]">
                     <th className="pb-4 font-black text-[#2d2218]">THỜI GIAN</th>
                     <th className="pb-4 font-black text-[#2d2218]">TÀI KHOẢN</th>
                     <th className="pb-4 font-black text-[#2d2218]">TRẠNG THÁI</th>
                     <th className="pb-4 font-black text-[#2d2218]">KẾT QUẢ</th>
                   </tr>
                 </thead>
                 <tbody>
                   {jobs.map((j) => (
                     <tr key={j.id} className="border-b-2 border-dashed border-[#a08f7f] hover:bg-[#fdf9f1]">
                       <td className="py-4 font-medium text-[#6b5a4b]">{new Date(j.created_at).toLocaleString('vi-VN')}</td>
                       <td className="py-4 font-bold text-[#2d2218]">{j.email}</td>
                       <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-[#2d2218] ${j.status === 'done' ? 'bg-[#a2d5c6]' : j.status === 'error' ? 'bg-[#ffcccb]' : 'bg-[#fdf9f1]'}`}>
                            {j.status.toUpperCase()}
                          </span>
                          {j.error_message && (
                            <div className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 max-w-sm font-medium leading-relaxed shadow-sm">
                              <div className="font-bold flex items-center gap-1">
                                <span>⚠️</span>
                                <span>{j.error_message.includes('(') ? j.error_message.split('(')[0].trim() : j.error_message}</span>
                              </div>
                              {j.error_message.includes('(') && (
                                <div className="text-[11px] text-[#6b5a4b] mt-1 pl-4">
                                  {j.error_message.substring(j.error_message.indexOf('('))}
                                </div>
                              )}
                            </div>
                          )}
                       </td>
                       <td className="py-4">
                         {j.status === 'done' && j.result_video_url ? (
                           <a href={`${API_BASE}/api/download_video/${j.id}`} className="text-[#f6a287] font-bold underline">Tải Video</a>
                         ) : <span>-</span>}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               {/* Pagination */}
               {totalItems > ITEMS_PER_PAGE && (
                 <div className="flex items-center justify-between px-6 py-4 border-t-2 border-[#2d2218]">
                   <p className="text-sm font-medium text-[#6b5a4b]">
                     Hiển thị {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} / {totalItems}
                   </p>
                   <div className="flex gap-2">
                     <button
                       onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                       disabled={currentPage <= 1}
                       className="px-4 py-2 font-bold border-2 border-[#2d2218] rounded-xl bg-white disabled:opacity-40 hover:bg-[#fdf9f1] transition-all text-sm"
                     >
                       ← Trước
                     </button>
                     <span className="px-4 py-2 font-bold text-sm text-[#2d2218]">
                       Trang {currentPage} / {Math.ceil(totalItems / ITEMS_PER_PAGE)}
                     </span>
                     <button
                       onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalItems / ITEMS_PER_PAGE), p + 1))}
                       disabled={currentPage >= Math.ceil(totalItems / ITEMS_PER_PAGE)}
                       className="px-4 py-2 font-bold border-2 border-[#2d2218] rounded-xl bg-white disabled:opacity-40 hover:bg-[#fdf9f1] transition-all text-sm"
                     >
                       Sau →
                     </button>
                   </div>
                 </div>
               )}
             </div>
           </div>
        )}
        {activeTab === 'templates' && (
          <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden">
            <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1]">
              <h2 className="text-2xl font-black text-[#2d2218] uppercase">Mẫu Email (Templates)</h2>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto">
              <p className="text-xs text-[#6b5a4b] font-medium mb-2 md:hidden">👉 Vuốt ngang để xem đầy đủ bảng</p>
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b-4 border-[#2d2218]">
                    <th className="pb-4 font-black text-[#2d2218]">MÃ (CODE)</th>
                    <th className="pb-4 font-black text-[#2d2218]">TÊN MẪU</th>
                    <th className="pb-4 font-black text-[#2d2218]">TIÊU ĐỀ (SUBJECT)</th>
                    <th className="pb-4 font-black text-[#2d2218] text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <React.Fragment key={t.code}>
                      <tr className="border-b-2 border-dashed border-[#a08f7f] hover:bg-[#fdf9f1]">
                        <td className="py-4 font-bold text-[#2d2218]">{t.code}</td>
                        <td className="py-4 font-medium text-[#6b5a4b]">{t.name}</td>
                        <td className="py-4 font-medium text-[#6b5a4b]">{t.subject}</td>
                        <td className="py-4 text-right">
                          <button 
                            onClick={() => {
                              setEditingTemplateCode(t.code);
                              setTemplateForm({ subject: t.subject, html_content: t.html_content });
                            }}
                            className="px-4 py-2 bg-[#f6a287] font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218]"
                          >
                            Sửa
                          </button>
                        </td>
                      </tr>
                      {editingTemplateCode === t.code && (
                        <tr>
                          <td colSpan={4} className="p-4 bg-[#e8f1f2] border-b-4 border-[#2d2218]">
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-bold text-[#2d2218] mb-2">Tiêu đề (Subject)</label>
                                <input 
                                  value={templateForm.subject} 
                                  onChange={e => setTemplateForm({...templateForm, subject: e.target.value})}
                                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-[#2d2218] mb-2">Nội dung HTML (Sử dụng biến dạng {"{{var}}"})</label>
                                <textarea 
                                  value={templateForm.html_content}
                                  onChange={e => setTemplateForm({...templateForm, html_content: e.target.value})}
                                  rows={8}
                                  className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium font-mono text-sm"
                                />
                              </div>
                              <div className="flex gap-4">
                                <button onClick={() => setPreviewHtml(templateForm.html_content)} className="px-6 py-2 bg-[#ffdd57] font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[2px_2px_0px_#2d2218]">Xem Trước</button>
                                <button onClick={() => handleUpdateTemplate(t.code)} className="px-6 py-2 bg-[#a2d5c6] font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[2px_2px_0px_#2d2218]">Lưu Thay Đổi</button>
                                <button onClick={() => setEditingTemplateCode(null)} className="px-6 py-2 bg-white font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[2px_2px_0px_#2d2218]">Hủy</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'funnels' && (
          <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden">
            <div className="p-4 sm:p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-black text-[#2d2218] uppercase">Phễu Email (Funnels)</h2>
              <button onClick={() => { setEditingFunnelId(null); setFunnelForm({ name: '', delay_days: 1, subject: '', html_content: '', is_active: true, target_segment: 'all' }); setShowFunnelModal(true); }} className="px-6 py-3 bg-[#a2d5c6] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all">+ TẠO PHỄU MỚI</button>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead><tr className="border-b-4 border-[#2d2218]">
                  <th className="pb-4 font-black text-[#2d2218]">TÊN PHỄU</th>
                  <th className="pb-4 font-black text-[#2d2218]">SAU</th>
                  <th className="pb-4 font-black text-[#2d2218]">ĐỐI TƯỢNG</th>
                  <th className="pb-4 font-black text-[#2d2218] text-center">GỬI</th>
                  <th className="pb-4 font-black text-[#2d2218] text-center">MỞ</th>
                  <th className="pb-4 font-black text-[#2d2218] text-center">CLICK</th>
                  <th className="pb-4 font-black text-[#2d2218] text-center">BOUNCE</th>
                  <th className="pb-4 font-black text-[#2d2218] text-right">THAO TÁC</th>
                </tr></thead>
                <tbody>
                  {funnels.length === 0 ? (<tr><td colSpan={8} className="py-8 text-center text-[#6b5a4b] font-medium">Chưa có phễu nào.</td></tr>) : funnels.map((f: any) => {
                    const sent = f.sent || 0, delivered = f.delivered || 0, opens = f.opens || 0, clicks = f.clicks || 0, bounced = f.bounced || 0;
                    const openRate = delivered > 0 ? ((opens / delivered) * 100).toFixed(1) : '0';
                    const clickRate = opens > 0 ? ((clicks / opens) * 100).toFixed(1) : '0';
                    const segLabels: Record<string, string> = { 'all': '🌍 Tất cả', 'never_used': '🆕 Chưa dùng', 'used_not_paid': '🔥 Chưa nạp', 'paid': '💎 VIP', 'inactive_7d': '😴 Nghỉ 7d' };
                    return (<tr key={f.id} className="border-b-2 border-dashed border-[#a08f7f] hover:bg-[#fdf9f1]">
                      <td className="py-4"><div className="font-bold text-[#2d2218]">{f.name}</div><div className="text-xs text-[#6b5a4b] mt-1 truncate max-w-[180px]">{f.subject}</div><span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${f.is_active ? 'bg-[#a2d5c6] border-[#2d2218]' : 'bg-[#e5dcd3] border-[#6b5a4b]'}`}>{f.is_active ? 'ON' : 'OFF'}</span></td>
                      <td className="py-4 font-bold text-[#f6a287]">{f.delay_days}d</td>
                      <td className="py-4"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-[#e8f1f2] border border-[#2d2218]">{segLabels[f.target_segment] || '🌍 Tất cả'}</span></td>
                      <td className="py-4 text-center"><div className="font-black text-[#2d2218] text-lg">{sent}</div></td>
                      <td className="py-4 text-center"><div className="font-black text-[#2d2218] text-lg">{opens}</div><div className="text-xs font-bold text-[#a2d5c6]">{openRate}%</div></td>
                      <td className="py-4 text-center"><div className="font-black text-[#2d2218] text-lg">{clicks}</div><div className="text-xs font-bold text-[#f6a287]">{clickRate}%</div></td>
                      <td className="py-4 text-center"><div className="font-black text-[#d32f2f]">{bounced}</div></td>
                      <td className="py-4 text-right space-x-1">
                        <button onClick={async () => { try { const res = await fetch(`${API_BASE}/api/admin/funnel-detail/${f.id}`, { headers: { 'Authorization': `Bearer ${session?.access_token}` } }); const data = await res.json(); if (data.status === 'success') { setFunnelDetail(data); setShowFunnelDetail(true); } } catch(e) { alert('Lỗi'); } }} className="px-3 py-2 bg-[#e8f1f2] font-bold text-xs text-[#2d2218] border-2 border-[#2d2218] rounded-xl">📊</button>
                        <button onClick={() => { setEditingFunnelId(f.id); setFunnelForm({ name: f.name, delay_days: f.delay_days, subject: f.subject, html_content: f.html_content, is_active: f.is_active, target_segment: f.target_segment || 'all' }); setShowFunnelModal(true); }} className="px-3 py-2 bg-white font-bold text-xs text-[#2d2218] border-2 border-[#2d2218] rounded-xl">✏️</button>
                        <button onClick={() => handleDeleteFunnel(f.id)} className="px-3 py-2 bg-[#ffcccb] font-bold text-xs text-[#d32f2f] border-2 border-[#d32f2f] rounded-xl">🗑️</button>
                      </td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
            {showFunnelModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2218]/80 p-4">
                <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl w-full max-w-2xl shadow-[8px_8px_0px_#2d2218] flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b-4 border-[#2d2218] flex justify-between items-center bg-white rounded-t-[1.3rem]">
                    <h2 className="text-2xl font-black text-[#2d2218]">{editingFunnelId ? 'Sửa Phễu' : 'Tạo Phễu Mới'}</h2>
                    <button onClick={() => setShowFunnelModal(false)} className="text-2xl font-black text-[#2d2218]">✕</button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Tên phễu</label><input value={funnelForm.name} onChange={e => setFunnelForm({...funnelForm, name: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" placeholder="Chăm sóc KH ngày 2" /></div>
                      <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Gửi sau N ngày</label><input type="number" min="0" value={funnelForm.delay_days} onChange={e => setFunnelForm({...funnelForm, delay_days: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" /></div>
                    </div>
                    <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Đối tượng gửi</label>
                      <select value={funnelForm.target_segment} onChange={e => setFunnelForm({...funnelForm, target_segment: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium">
                        <option value="all">🌍 Tất cả người dùng</option>
                        <option value="never_used">🆕 Chưa dùng thử</option>
                        <option value="used_not_paid">🔥 Đã dùng, chưa nạp tiền</option>
                        <option value="paid">💎 Đã nạp tiền (VIP)</option>
                        <option value="inactive_7d">😴 Không hoạt động 7 ngày</option>
                      </select>
                    </div>
                    <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Tiêu đề (Subject)</label><input value={funnelForm.subject} onChange={e => setFunnelForm({...funnelForm, subject: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" /></div>
                    
                    {/* Rich Email Editor */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-bold text-[#2d2218]">Nội dung Email</label>
                        <div className="flex bg-white border-2 border-[#2d2218] rounded-lg overflow-hidden">
                          <button onClick={() => setPreviewHtml(null)} className={`px-3 py-1 text-xs font-bold ${previewHtml === null ? 'bg-[#2d2218] text-white' : 'text-[#2d2218]'}`}>📝 Code</button>
                          <button onClick={() => setPreviewHtml(funnelForm.html_content)} className={`px-3 py-1 text-xs font-bold ${previewHtml !== null ? 'bg-[#2d2218] text-white' : 'text-[#2d2218]'}`}>👁️ Preview</button>
                        </div>
                      </div>
                      
                      {/* Toolbar */}
                      <div className="flex flex-wrap gap-1 p-2 bg-white border-2 border-b-0 border-[#2d2218] rounded-t-xl">
                        <button type="button" onClick={() => { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + "\n<h1 style='color:#2d2218;font-size:28px;font-weight:900'>Tiêu đề</h1>"}); }} className="px-2 py-1 text-xs font-bold bg-[#e8f1f2] border border-[#2d2218] rounded hover:bg-[#a2d5c6]" title="Heading">H1</button>
                        <button type="button" onClick={() => { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + "\n<h2 style='color:#2d2218;font-size:22px;font-weight:900'>Tiêu đề phụ</h2>"}); }} className="px-2 py-1 text-xs font-bold bg-[#e8f1f2] border border-[#2d2218] rounded hover:bg-[#a2d5c6]" title="Heading 2">H2</button>
                        <button type="button" onClick={() => { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + "\n<p style='color:#6b5a4b;font-size:16px'>Nội dung đoạn văn ở đây...</p>"}); }} className="px-2 py-1 text-xs font-bold bg-[#e8f1f2] border border-[#2d2218] rounded hover:bg-[#a2d5c6]" title="Paragraph">¶</button>
                        <button type="button" onClick={() => { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + "\n<strong style='color:#2d2218'>Chữ đậm</strong>"}); }} className="px-2 py-1 text-xs font-black bg-[#e8f1f2] border border-[#2d2218] rounded hover:bg-[#a2d5c6]" title="Bold">B</button>
                        <div className="w-px bg-[#2d2218] mx-1"></div>
                        <button type="button" onClick={() => { const url = prompt('Nhập URL ảnh:'); if(url) { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + `\n<div style='text-align:center;margin:20px 0'><img src='${url}' style='max-width:100%;border-radius:12px;border:3px solid #2d2218' alt='image' /></div>`}); }}} className="px-2 py-1 text-xs font-bold bg-[#a2d5c6] border border-[#2d2218] rounded hover:bg-[#f6a287]" title="Chèn ảnh">🖼️ Ảnh</button>
                        <button type="button" onClick={() => { const url = prompt('Nhập link YouTube (VD: https://youtube.com/watch?v=xxxx):'); if(url) { const vid = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/); if(vid) { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + `\n<div style='text-align:center;margin:20px 0'><a href='${url}' style='display:inline-block;position:relative'><img src='https://img.youtube.com/vi/${vid[1]}/maxresdefault.jpg' style='max-width:100%;border-radius:12px;border:3px solid #2d2218' alt='video' /><div style='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,0,0,0.85);border-radius:16px;padding:12px 24px'><span style='color:#fff;font-size:24px;font-weight:900'>▶ Xem Video</span></div></a></div>`}); } else alert('Link YouTube không hợp lệ'); }}} className="px-2 py-1 text-xs font-bold bg-[#ff6b6b] text-white border border-[#2d2218] rounded hover:opacity-80" title="Chèn YouTube">▶ YouTube</button>
                        <div className="w-px bg-[#2d2218] mx-1"></div>
                        <button type="button" onClick={() => { const text = prompt('Chữ trên nút:', 'BẮT ĐẦU NGAY'); const link = prompt('URL nút:', 'https://taivideonhanh.com/videos'); if(text && link) { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + `\n<div style='text-align:center;margin:30px 0'><a href='${link}' style='display:inline-block;background:#f6a287;color:#2d2218;font-weight:900;padding:16px 40px;border-radius:12px;text-decoration:none;font-size:18px;border:3px solid #2d2218'>${text}</a></div>`}); }}} className="px-2 py-1 text-xs font-bold bg-[#f6a287] border border-[#2d2218] rounded hover:opacity-80" title="Nút CTA">🔘 Nút CTA</button>
                        <button type="button" onClick={() => { const href = prompt('URL liên kết:'); const text = prompt('Chữ hiển thị:', 'Bấm vào đây'); if(href && text) { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + `\n<a href='${href}' style='color:#f6a287;font-weight:bold;text-decoration:underline'>${text}</a>`}); }}} className="px-2 py-1 text-xs font-bold bg-[#e8f1f2] border border-[#2d2218] rounded hover:bg-[#a2d5c6]" title="Liên kết">🔗</button>
                        <button type="button" onClick={() => { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + "\n<hr style='border:none;border-top:2px dashed #d4c5b9;margin:20px 0' />"}); }} className="px-2 py-1 text-xs font-bold bg-[#e8f1f2] border border-[#2d2218] rounded hover:bg-[#a2d5c6]" title="Đường kẻ">—</button>
                        <button type="button" onClick={() => { const t = funnelForm.html_content; setFunnelForm({...funnelForm, html_content: t + "\n<div style='background:#e8f1f2;border-radius:12px;padding:20px;margin:20px 0;border:2px solid #2d2218'>\n  <p style='color:#2d2218;font-weight:bold'>Tiêu đề khung</p>\n  <p style='color:#6b5a4b'>Nội dung trong khung...</p>\n</div>"}); }} className="px-2 py-1 text-xs font-bold bg-[#e8f1f2] border border-[#2d2218] rounded hover:bg-[#a2d5c6]" title="Khung nội dung">📦 Khung</button>
                      </div>
                      
                      {/* Editor / Preview */}
                      {previewHtml !== null ? (
                        <div className="w-full min-h-[300px] bg-white border-2 border-[#2d2218] rounded-b-xl p-4 overflow-y-auto">
                          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                      ) : (
                        <textarea 
                          value={funnelForm.html_content} 
                          onChange={e => setFunnelForm({...funnelForm, html_content: e.target.value})}
                          rows={10}
                          className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-b-xl font-medium font-mono text-sm"
                          placeholder="Viết HTML hoặc dùng toolbar phía trên để chèn nội dung..."
                        />
                      )}
                    </div>
                    
                    <div className="bg-[#e8f1f2] border-2 border-[#2d2218] rounded-xl p-4">
                      <p className="font-bold text-[#2d2218] text-sm mb-2">📋 Biến có sẵn (bấm để chèn vào nội dung):</p>
                      <div className="flex flex-wrap gap-2">
                        {['{{user_name}}', '{{user_email}}', '{{balance}}', '{{days_since_signup}}', '{{signup_date}}'].map(v => (<code key={v} className="px-2 py-1 bg-white border border-[#2d2218] rounded text-xs font-mono font-bold cursor-pointer hover:bg-[#f6a287] transition-all" onClick={() => { setFunnelForm({...funnelForm, html_content: funnelForm.html_content + v}); navigator.clipboard.writeText(v); }}>{v}</code>))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 font-bold text-[#2d2218]"><input type="checkbox" checked={funnelForm.is_active} onChange={e => setFunnelForm({...funnelForm, is_active: e.target.checked})} className="w-5 h-5 accent-[#f6a287]" /> Kích hoạt phễu này</label>
                  </div>
                  <div className="p-6 border-t-4 border-[#2d2218] bg-white rounded-b-[1.3rem] flex justify-end gap-4">
                    <button onClick={() => setShowFunnelModal(false)} className="px-6 py-3 bg-white font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218]">Hủy</button>
                    <button onClick={handleSaveFunnel} className="px-8 py-3 bg-[#f6a287] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218]">Lưu Phễu</button>
                  </div>
                </div>
              </div>
            )}
            {showFunnelDetail && funnelDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2218]/80 p-4">
                <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl w-full max-w-4xl shadow-[8px_8px_0px_#2d2218] flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b-4 border-[#2d2218] flex justify-between items-center bg-white rounded-t-[1.3rem]">
                    <div><h2 className="text-2xl font-black text-[#2d2218]">📊 {funnelDetail.funnel?.name}</h2><p className="text-sm text-[#6b5a4b] font-medium mt-1">{funnelDetail.total_users} người nhận</p></div>
                    <button onClick={() => setShowFunnelDetail(false)} className="text-2xl font-black text-[#2d2218]">✕</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 border-b-2 border-[#2d2218]">
                    <div className="bg-[#a2d5c6] border-2 border-[#2d2218] rounded-xl p-4 text-center"><div className="text-2xl font-black text-[#2d2218]">{funnelDetail.rates?.delivery_rate}</div><div className="text-xs font-bold mt-1">Delivery</div></div>
                    <div className="bg-[#e8f1f2] border-2 border-[#2d2218] rounded-xl p-4 text-center"><div className="text-2xl font-black text-[#2d2218]">{funnelDetail.rates?.open_rate}</div><div className="text-xs font-bold mt-1">Open</div></div>
                    <div className="bg-[#f6a287] border-2 border-[#2d2218] rounded-xl p-4 text-center"><div className="text-2xl font-black text-[#2d2218]">{funnelDetail.rates?.click_rate}</div><div className="text-xs font-bold mt-1">Click</div></div>
                    <div className="bg-[#ffcccb] border-2 border-[#d32f2f] rounded-xl p-4 text-center"><div className="text-2xl font-black text-[#d32f2f]">{funnelDetail.rates?.bounce_rate}</div><div className="text-xs font-bold mt-1">Bounce</div></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="border-b-2 border-[#2d2218]">
                        <th className="pb-3 font-black text-[#2d2218] text-sm">EMAIL</th>
                        <th className="pb-3 font-black text-[#2d2218] text-sm text-center">GỬI</th>
                        <th className="pb-3 font-black text-[#2d2218] text-sm text-center">NHẬN</th>
                        <th className="pb-3 font-black text-[#2d2218] text-sm text-center">MỞ</th>
                        <th className="pb-3 font-black text-[#2d2218] text-sm text-center">CLICK</th>
                      </tr></thead>
                      <tbody>
                        {(funnelDetail.users || []).map((u: any, i: number) => (<tr key={i} className="border-b border-dashed border-[#d4c5b9] hover:bg-white">
                          <td className="py-3 font-medium text-[#2d2218] text-sm">{u.email}</td>
                          <td className="py-3 text-center">{u.sent_at ? '✅' : '—'}</td>
                          <td className="py-3 text-center">{u.delivered ? '✅' : u.bounced ? '❌' : '—'}</td>
                          <td className="py-3 text-center">{u.opened ? '👁️' : '—'}</td>
                          <td className="py-3 text-center">{u.clicked ? '🔗' : '—'}</td>
                        </tr>))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        {activeTab === 'academy' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#fdf9f1] p-4 sm:p-6 border-4 border-[#2d2218] rounded-2xl shadow-[4px_4px_0px_#2d2218]">
              <div>
                <h2 className="text-2xl font-black text-[#2d2218] uppercase">📚 Quản Lý Khóa Học</h2>
                <p className="font-bold text-[#6b5a4b]">Thêm, sửa, xóa chương và bài học hiển thị trên trang Khóa Học Miễn Phí.</p>
              </div>
              <button onClick={() => { setEditingModuleId(null); setModuleForm({ title: '', description: '', badge: 'HỌC MIỄN PHÍ', is_vip_only: false, sort_order: 0 }); setShowModuleModal(true); }} className="w-full sm:w-auto px-6 py-3 bg-[#a2d5c6] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#2d2218] transition-all">
                + THÊM CHƯƠNG MỚI
              </button>
            </div>

            {academyModules.length === 0 ? (
              <div className="text-center font-bold text-[#6b5a4b] py-12 bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218]">Chưa có chương nào. Hãy thêm chương mới!</div>
            ) : (
              academyModules.map((mod: any) => (
                <div key={mod.id} className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden">
                  <div className="p-4 sm:p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex-1 cursor-pointer" onClick={() => setExpandedModuleId(expandedModuleId === mod.id ? null : mod.id)}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xl">{expandedModuleId === mod.id ? '▼' : '▶'}</span>
                        <h3 className="font-black text-[#2d2218] text-lg">{mod.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-[#2d2218] ${mod.is_vip_only ? 'bg-[#f6a287]' : 'bg-[#a2d5c6]'}`}>{mod.badge}</span>
                      </div>
                      <p className="text-sm text-[#6b5a4b] font-medium mt-1 ml-8">{mod.description}</p>
                      <p className="text-xs text-[#6b5a4b] ml-8 mt-1">{(mod.lessons || []).length} bài học · Thứ tự: {mod.sort_order}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingModuleId(mod.id); setModuleForm({ title: mod.title, description: mod.description || '', badge: mod.badge || 'HỌC MIỄN PHÍ', is_vip_only: mod.is_vip_only || false, sort_order: mod.sort_order || 0 }); setShowModuleModal(true); }} className="px-4 py-2 bg-white font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[2px_2px_0px_#2d2218] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#2d2218] text-sm">Sửa</button>
                      <button onClick={() => handleDeleteModule(mod.id)} className="px-4 py-2 bg-[#ffcccb] font-bold text-[#d32f2f] border-2 border-[#d32f2f] rounded-xl shadow-[2px_2px_0px_#d32f2f] text-sm">Xóa</button>
                    </div>
                  </div>
                  {expandedModuleId === mod.id && (
                    <div className="p-4 sm:p-6 bg-[#e8f1f2]">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-black text-[#2d2218]">Danh sách bài học</h4>
                        <button onClick={() => { setEditingLessonId(null); setLessonParentModuleId(mod.id); setLessonForm({ title: '', duration: '10:00', is_vip: mod.is_vip_only || false, video_url: '', summary: '', sort_order: (mod.lessons || []).length + 1 }); setShowLessonModal(true); }} className="px-4 py-2 bg-[#a2d5c6] font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[2px_2px_0px_#2d2218] text-sm">+ Thêm bài học</button>
                      </div>
                      {(mod.lessons || []).length === 0 ? (
                        <p className="text-[#6b5a4b] font-medium text-center py-4">Chưa có bài học nào.</p>
                      ) : (
                        <div className="space-y-3">
                          {(mod.lessons || []).map((les: any) => (
                            <div key={les.id} className="bg-white border-2 border-[#2d2218] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-[#2d2218]">{les.title}</span>
                                  <span className="text-xs px-2 py-0.5 bg-[#e8f1f2] border border-[#2d2218] rounded font-bold">{les.duration}</span>
                                  {les.is_vip && <span className="text-xs px-2 py-0.5 bg-[#f6a287] border border-[#2d2218] rounded font-bold">VIP 👑</span>}
                                </div>
                                <p className="text-xs text-[#6b5a4b] mt-1">{les.summary}</p>
                                {les.video_url && <p className="text-xs text-blue-600 mt-1 truncate max-w-md">🔗 {les.video_url}</p>}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => { setEditingLessonId(les.id); setLessonParentModuleId(mod.id); setLessonForm({ title: les.title, duration: les.duration || '10:00', is_vip: les.is_vip || false, video_url: les.video_url || '', summary: les.summary || '', sort_order: les.sort_order || 0 }); setShowLessonModal(true); }} className="px-3 py-1 bg-white font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-lg text-xs">Sửa</button>
                                <button onClick={() => handleDeleteLesson(les.id)} className="px-3 py-1 bg-[#ffcccb] font-bold text-[#d32f2f] border-2 border-[#d32f2f] rounded-lg text-xs">Xóa</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {showModuleModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2218]/80 p-4">
                <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl w-full max-w-2xl shadow-[8px_8px_0px_#2d2218] flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b-4 border-[#2d2218] flex justify-between items-center bg-white rounded-t-[1.3rem]">
                    <h2 className="text-2xl font-black text-[#2d2218]">{editingModuleId ? 'Sửa Chương' : 'Thêm Chương Mới'}</h2>
                    <button onClick={() => setShowModuleModal(false)} className="text-2xl font-black text-[#2d2218]">✕</button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4">
                    <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Tên chương</label><input value={moduleForm.title} onChange={e => setModuleForm({...moduleForm, title: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" placeholder="Ví dụ: Chương 1: Nhập Môn..." /></div>
                    <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Mô tả</label><textarea value={moduleForm.description} onChange={e => setModuleForm({...moduleForm, description: e.target.value})} rows={3} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Badge</label><input value={moduleForm.badge} onChange={e => setModuleForm({...moduleForm, badge: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" /></div>
                      <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Thứ tự</label><input type="number" value={moduleForm.sort_order} onChange={e => setModuleForm({...moduleForm, sort_order: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" /></div>
                    </div>
                    <label className="flex items-center gap-2 font-bold text-[#2d2218]"><input type="checkbox" checked={moduleForm.is_vip_only} onChange={e => setModuleForm({...moduleForm, is_vip_only: e.target.checked})} className="w-5 h-5 accent-[#f6a287]" /> Chỉ dành cho VIP</label>
                  </div>
                  <div className="p-6 border-t-4 border-[#2d2218] bg-white rounded-b-[1.3rem] flex justify-end gap-4">
                    <button onClick={() => setShowModuleModal(false)} className="px-6 py-3 bg-white font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218]">Hủy</button>
                    <button onClick={handleSaveModule} className="px-8 py-3 bg-[#f6a287] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218]">Lưu Chương</button>
                  </div>
                </div>
              </div>
            )}

            {showLessonModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2218]/80 p-4">
                <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl w-full max-w-2xl shadow-[8px_8px_0px_#2d2218] flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b-4 border-[#2d2218] flex justify-between items-center bg-white rounded-t-[1.3rem]">
                    <h2 className="text-2xl font-black text-[#2d2218]">{editingLessonId ? 'Sửa Bài Học' : 'Thêm Bài Học Mới'}</h2>
                    <button onClick={() => setShowLessonModal(false)} className="text-2xl font-black text-[#2d2218]">✕</button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4">
                    <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Tên bài học</label><input value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" placeholder="Bài 1: Tư duy chọn ngách..." /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Thời lượng</label><input value={lessonForm.duration} onChange={e => setLessonForm({...lessonForm, duration: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" placeholder="10:00" /></div>
                      <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Thứ tự</label><input type="number" value={lessonForm.sort_order} onChange={e => setLessonForm({...lessonForm, sort_order: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" /></div>
                    </div>
                    <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Link Video (YouTube Embed)</label><input value={lessonForm.video_url} onChange={e => setLessonForm({...lessonForm, video_url: e.target.value})} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" placeholder="https://www.youtube.com/embed/..." /></div>
                    <div><label className="block text-sm font-bold text-[#2d2218] mb-2">Tóm tắt</label><textarea value={lessonForm.summary} onChange={e => setLessonForm({...lessonForm, summary: e.target.value})} rows={3} className="w-full px-4 py-3 bg-white border-2 border-[#2d2218] rounded-xl font-medium" /></div>
                    <label className="flex items-center gap-2 font-bold text-[#2d2218]"><input type="checkbox" checked={lessonForm.is_vip} onChange={e => setLessonForm({...lessonForm, is_vip: e.target.checked})} className="w-5 h-5 accent-[#f6a287]" /> Bài học VIP</label>
                  </div>
                  <div className="p-6 border-t-4 border-[#2d2218] bg-white rounded-b-[1.3rem] flex justify-end gap-4">
                    <button onClick={() => setShowLessonModal(false)} className="px-6 py-3 bg-white font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218]">Hủy</button>
                    <button onClick={handleSaveLesson} className="px-8 py-3 bg-[#f6a287] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[4px_4px_0px_#2d2218]">Lưu Bài Học</button>
                  </div>
                </div>
              </div>
            )}

            {/* Tài Nguyên VIP */}
            <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] overflow-hidden mt-8">
              <div className="p-6 border-b-4 border-[#2d2218] bg-[#fdf9f1] flex justify-between items-center">
                <h2 className="text-2xl font-black text-[#2d2218] uppercase">📦 Tài Nguyên VIP</h2>
                <button onClick={() => { setEditingResourceId(null); setResourceForm({ title: '', type: 'ZIP / Google Drive', size: '0 MB', url: '', description: '', sort_order: 0 }); setShowResourceModal(true); }} className="px-5 py-2 bg-[#a2d5c6] font-bold text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[3px_3px_0px_#2d2218] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#2d2218]">+ Thêm Tài Nguyên</button>
              </div>
              <div className="p-6 space-y-3">
                {academyResources.length === 0 && <p className="text-[#6b5a4b]">Chưa có tài nguyên VIP nào.</p>}
                {academyResources.map((res: any) => (
                  <div key={res.id} className="flex items-center justify-between p-4 border-2 border-[#2d2218] rounded-xl bg-[#fdf9f1]">
                    <div>
                      <span className="font-bold text-[#2d2218]">{res.title}</span>
                      <span className="ml-2 text-xs text-[#6b5a4b]">{res.type} • {res.size}</span>
                      {res.description && <p className="text-xs text-[#6b5a4b] mt-1">{res.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingResourceId(res.id); setResourceForm({ title: res.title, type: res.type, size: res.size, url: res.url, description: res.description || '', sort_order: res.sort_order || 0 }); setShowResourceModal(true); }} className="px-3 py-1 bg-[#f6a287] font-bold text-sm border-2 border-[#2d2218] rounded-lg">Sửa</button>
                      <button onClick={() => handleDeleteResource(res.id)} className="px-3 py-1 bg-[#ffcccb] font-bold text-sm border-2 border-[#2d2218] rounded-lg">Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {showResourceModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white border-4 border-[#2d2218] rounded-3xl shadow-[8px_8px_0px_#2d2218] w-full max-w-lg p-6 space-y-4">
                  <h3 className="text-xl font-black text-[#2d2218]">{editingResourceId ? 'Sửa Tài Nguyên' : 'Thêm Tài Nguyên VIP'}</h3>
                  <input value={resourceForm.title} onChange={e => setResourceForm({...resourceForm, title: e.target.value})} placeholder="Tên tài nguyên" className="w-full px-4 py-3 border-2 border-[#2d2218] rounded-xl font-bold" />
                  <input value={resourceForm.url} onChange={e => setResourceForm({...resourceForm, url: e.target.value})} placeholder="URL (Google Drive, Mega, etc.)" className="w-full px-4 py-3 border-2 border-[#2d2218] rounded-xl font-bold" />
                  <div className="flex gap-3">
                    <input value={resourceForm.type} onChange={e => setResourceForm({...resourceForm, type: e.target.value})} placeholder="Loại (ZIP, PDF, etc.)" className="flex-1 px-4 py-3 border-2 border-[#2d2218] rounded-xl font-bold" />
                    <input value={resourceForm.size} onChange={e => setResourceForm({...resourceForm, size: e.target.value})} placeholder="Dung lượng" className="flex-1 px-4 py-3 border-2 border-[#2d2218] rounded-xl font-bold" />
                  </div>
                  <textarea value={resourceForm.description} onChange={e => setResourceForm({...resourceForm, description: e.target.value})} placeholder="Mô tả (tùy chọn)" rows={2} className="w-full px-4 py-3 border-2 border-[#2d2218] rounded-xl font-bold" />
                  <input type="number" value={resourceForm.sort_order} onChange={e => setResourceForm({...resourceForm, sort_order: Number(e.target.value)})} placeholder="Thứ tự" className="w-32 px-4 py-3 border-2 border-[#2d2218] rounded-xl font-bold" />
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveResource} className="flex-1 py-3 bg-[#a2d5c6] font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl shadow-[3px_3px_0px_#2d2218]">{editingResourceId ? 'Cập Nhật' : 'Thêm Mới'}</button>
                    <button onClick={() => setShowResourceModal(false)} className="flex-1 py-3 bg-white font-black text-[#2d2218] border-2 border-[#2d2218] rounded-xl">Hủy</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview HTML Modal */}
        {previewHtml !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2d2218]/80 p-4">
            <div className="bg-[#fdf9f1] border-4 border-[#2d2218] rounded-3xl w-full max-w-4xl shadow-[8px_8px_0px_#2d2218] flex flex-col h-[90vh]">
              <div className="p-4 border-b-4 border-[#2d2218] flex justify-between items-center bg-white rounded-t-[1.3rem]">
                <h2 className="text-xl font-black text-[#2d2218]">Xem trước Email</h2>
                <button onClick={() => setPreviewHtml(null)} className="text-2xl font-black text-[#2d2218]">✕</button>
              </div>
              <div className="flex-1 p-0 bg-gray-100 overflow-hidden rounded-b-[1.3rem]">
                <iframe 
                  srcDoc={previewHtml} 
                  className="w-full h-full border-none bg-white"
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
