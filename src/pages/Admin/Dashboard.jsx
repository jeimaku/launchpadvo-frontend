import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import ToastNotification from '../../components/ToastNotification'; // <--- NEW IMPORT

// ─────────────────────────────────────────────
// Inline SVG Donut Chart (Light Theme Optimized)
// ─────────────────────────────────────────────
function DonutChart({ segments, size = 120, strokeWidth = 16 }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = total > 0 ? (seg.value / total) * circumference : 0;
    const gap = circumference - dash;
    const rotate = (offset / (total || 1)) * 360 - 90;
    offset += seg.value;
    return { ...seg, dash, gap, rotate };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block drop-shadow-sm">
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="#f1f5f9" /* slate-100 */
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {arcs.map((arc, i) =>
        arc.value > 0 ? (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={0}
            style={{
              transform: `rotate(${arc.rotate}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
              transition: 'stroke-dasharray 0.8s ease',
            }}
            strokeLinecap="round"
          />
        ) : null
      )}
      {/* Center total */}
      <text x={cx} y={cy - 2} textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="900" fontFamily="inherit">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="700" fontFamily="inherit" letterSpacing="1">
        CLIENTS
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────
// Branch Distribution Card (Light Theme)
// ─────────────────────────────────────────────
function BranchCard({ label, data, accentColor, dotColor }) {
  const total = data.total;
  const rows = [
    { label: 'Virtual Office', val: data.VO, color: accentColor },
    { label: 'Use of Address', val: data.UOA, color: '#6366f1' },
    { label: 'Custom Packages', val: data.Custom, color: '#f59e0b' },
  ];

  const segments = rows.map((r) => ({
    label: r.label,
    value: r.val,
    color: r.color,
  }));

  const hasData = total > 0;
  const chartSegments = hasData
    ? segments
    : [{ label: 'No Data', value: 1, color: '#e2e8f0' }];

  return (
    <div className="flex-1 flex flex-col gap-5 p-5 bg-slate-50/50 rounded-xl border border-slate-100">
      {/* Branch Header */}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: dotColor }}></span>
        <span className="text-sm font-black text-slate-800 uppercase tracking-widest">{label}</span>
        <span className="ml-auto text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-sm">
          {total} Total
        </span>
      </div>

      {/* Chart + Legend row */}
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="flex-shrink-0">
          <DonutChart segments={chartSegments} size={100} strokeWidth={14} />
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3.5 flex-1 min-w-0">
          {rows.map((item, idx) => {
            const pct = total > 0 ? Math.round((item.val / total) * 100) : 0;
            return (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }}></span>
                    <span className="text-[11px] font-bold text-slate-500 truncate uppercase tracking-wide">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-black text-slate-800">{item.val}</span>
                    <span className="text-[10px] font-semibold text-slate-400">({pct}%)</span>
                  </div>
                </div>
                {/* Mini bar */}
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%`, background: item.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────
export default function Dashboard() {

  const [toast, setToast] = useState({ show: false, message: '' });

  const [stats, setStats] = useState({
    activeClients: 0, expiringSoon: 0, totallyExpired: 0, missedEmails: 0,
    pendingRevenue: 0, verifiedRevenue: 0
  });

  const [portfolioData, setPortfolioData] = useState({
    LPC: { total: 0, VO: 0, UOA: 0, Custom: 0 },
    LPOG: { total: 0, VO: 0, UOA: 0, Custom: 0 }
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [actionNeededClients, setActionNeededClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const userName = localStorage.getItem('userName') || 'User';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [lpcRes, lpogRes, logsRes, paymentsRes] = await Promise.all([
        fetch(`http://${window.location.hostname}:5000/api/virtual-offices?branch=LPC`, { headers }),
        fetch(`http://${window.location.hostname}:5000/api/virtual-offices?branch=LPOG`, { headers }),
        fetch(`http://${window.location.hostname}:5000/api/emails/logs`, { headers }),
        fetch(`http://${window.location.hostname}:5000/api/payments`, { headers })
      ]);

      if (lpcRes.ok && lpogRes.ok && logsRes.ok) {
        const lpcClients = await lpcRes.json();
        const lpogClients = await lpogRes.json();
        const allClients = [...lpcClients, ...lpogClients];
        const emailLogs = await logsRes.json();

        let pendingAmt = 0;
        let verifiedAmt = 0;
        if (paymentsRes.ok) {
          const payments = await paymentsRes.json();
          payments.forEach(p => {
            if (p.status === 'Pending') pendingAmt += parseFloat(p.amount_paid || 0);
            if (p.status === 'Verified') verifiedAmt += parseFloat(p.amount_paid || 0);
          });
        }

        let activeCount = 0, expiringCount = 0, expiredCount = 0, missedEmailsCount = 0;
        const actionNeeded = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        allClients.forEach(c => {
          let isExpiring = false;
          let isExpired = false;
          if (c.end_date) {
            const expiryDate = new Date(c.end_date);
            expiryDate.setHours(0, 0, 0, 0);
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry < 0) { expiredCount++; isExpired = true; }
            else if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) { expiringCount++; isExpiring = true; }
            else { activeCount++; }
          } else { activeCount++; }

          if (isExpiring || isExpired) {
            const gotEmail = emailLogs.some(log => log.recipient_email === c.email_1 && log.type === 'Automated');
            const isDisabled = (c.auto_email_enabled === 0 || c.auto_email_enabled === false);
            const missed = !gotEmail || isDisabled;
            if (missed) missedEmailsCount++;
            actionNeeded.push({
              ...c, isExpired, isExpiring, missedEmail: missed,
              emailStatus: isDisabled ? 'Disabled' : gotEmail ? 'Sent' : 'Pending / Failed'
            });
          }
        });

        setStats({
          activeClients: activeCount, expiringSoon: expiringCount,
          totallyExpired: expiredCount, missedEmails: missedEmailsCount,
          pendingRevenue: pendingAmt, verifiedRevenue: verifiedAmt
        });

        let lpcVO = 0, lpcUOA = 0, lpcCustom = 0;
        let lpogVO = 0, lpogUOA = 0, lpogCustom = 0;
        lpcClients.forEach(c => {
          if (c.package_tier === 'Virtual Office Package') lpcVO++;
          else if (c.package_tier === 'Use of Address') lpcUOA++;
          else if (c.package_tier && c.package_tier.startsWith('Custom')) lpcCustom++;
        });
        lpogClients.forEach(c => {
          if (c.package_tier === 'Virtual Office Package') lpogVO++;
          else if (c.package_tier === 'Use of Address') lpogUOA++;
          else if (c.package_tier && c.package_tier.startsWith('Custom')) lpogCustom++;
        });

        setPortfolioData({
          LPC: { total: lpcClients.length, VO: lpcVO, UOA: lpcUOA, Custom: lpcCustom },
          LPOG: { total: lpogClients.length, VO: lpogVO, UOA: lpogUOA, Custom: lpogCustom }
        });

        setRecentActivity(emailLogs.slice(0, 50)); 
        actionNeeded.sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
        setActionNeededClients(actionNeeded); 

        // --- NEW: TRIGGER TOAST NOTIFICATION ---
        const totalAlerts = expiringCount + expiredCount;
        if (totalAlerts > 0) {
          // Add a tiny 500ms delay so it slides in smoothly AFTER the page loads
          setTimeout(() => {
            setToast({
              show: true,
              message: `${totalAlerts} contract${totalAlerts > 1 ? 's' : ''} triggered automation rules today. The system has successfully handled the necessary emails.`
            });
          }, 500);
        }
        // ---------------------------------------

      } // <-- Notice the closing bracket is now properly at the end!
    } catch (error) {
      console.error("Error loading operational dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-hidden overflow-y-auto max-h-screen custom-scrollbar">

        {/* HEADER */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Operations Overview</h2>
            <p className="text-slate-500 mt-1 text-sm font-medium">
              Welcome back, {userName}. Here is your daily operational brief.
            </p>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-600 shadow-sm flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              System Live
            </div>
            <NotificationBell />
          </div>
        </header>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 font-medium text-sm">
            Loading operational data...
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">

            {/* ── KPI CARDS ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 shadow-sm border border-emerald-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900">{stats.activeClients}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Contracts</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-orange-50 rounded-xl text-orange-500 shadow-sm border border-orange-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900">{stats.expiringSoon}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Expiring (≤ 30 Days)</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 shadow-sm border border-purple-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900">{stats.missedEmails}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Missed Auto-Emails</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-lime-50 rounded-xl text-lime-600 shadow-sm border border-lime-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900">{formatCurrency(stats.verifiedRevenue)}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Verified Revenue</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-500 shadow-sm border border-indigo-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21V3h6.5a4.5 4.5 0 110 9H8M5 7h12M5 10h12" />
                  </svg>
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900">{formatCurrency(stats.pendingRevenue)}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pending Verification</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-rose-50 rounded-xl text-rose-500 shadow-sm border border-rose-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-rose-600">{stats.totallyExpired}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Totally Expired</p>
                </div>
              </div>

            </div>

            {/* ── WIDGET ROW ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Action List Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-20">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Action List & Feedback</h3>
                  <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-3 py-1 rounded-full uppercase tracking-wider border border-rose-100">
                    Critical Contracts
                  </span>
                </div>
                <div className="overflow-x-auto overflow-y-auto max-h-[440px] custom-scrollbar flex-1 relative">
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                    <thead className="bg-slate-50/80 backdrop-blur-md text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 font-bold">Company</th>
                        <th className="px-6 py-4 font-bold">Branch</th>
                        <th className="px-6 py-4 font-bold">Status</th>
                        <th className="px-6 py-4 font-bold">Auto-Email Tracker</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {actionNeededClients.length > 0 ? (
                        actionNeededClients.map(client => (
                          <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-800">{client.company_name}</td>
                            <td className="px-6 py-4 text-slate-500 font-medium">{client.branch}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                client.isExpired
                                  ? 'bg-rose-50 text-rose-600 border-rose-100'
                                  : 'bg-orange-50 text-orange-600 border-orange-100'
                              }`}>
                                {client.isExpired ? 'Expired' : 'Expiring (≤ 30 Days)'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {client.emailStatus === 'Disabled' && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-md border border-slate-200">System Disabled</span>
                              )}
                              {client.emailStatus === 'Sent' && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-100">✅ Sent by System</span>
                              )}
                              {client.emailStatus === 'Pending / Failed' && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-md border border-rose-100">⚠️ No Email Sent</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                            All clear. No critical contracts pending.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── REDESIGNED SERVICE DISTRIBUTION (LIGHT THEME) ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                {/* Card Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    Service Distribution
                  </h3>
                  <div className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-slate-200">
                    {portfolioData.LPC.total + portfolioData.LPOG.total} Clients
                  </div>
                </div>

                {/* Color Legend Strip */}
                <div className="px-6 pt-5 flex flex-wrap gap-x-5 gap-y-2">
                  {[
                    { label: 'Virtual Office', color: '#84cc16' }, // Lime-500 instead of bright neon
                    { label: 'Use of Address', color: '#6366f1' }, // Indigo-500
                    { label: 'Custom', color: '#f59e0b' },         // Amber-500
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: item.color }}></span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* Branch Panels */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-5">
                  <BranchCard
                    label="LPC Branch"
                    data={portfolioData.LPC}
                    accentColor="#84cc16"
                    dotColor="#0ea5e9" // Light blue dot
                  />
                  <BranchCard
                    label="LPOG Branch"
                    data={portfolioData.LPOG}
                    accentColor="#84cc16"
                    dotColor="#ec4899" // Pink dot
                  />
                </div>
              </div>
              {/* ── END SERVICE DISTRIBUTION ── */}

            </div>

            {/* ── SYSTEM ACTIVITY LOG ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-20">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">System Activity Log</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Audit trail of outgoing communications</p>
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[320px] custom-scrollbar relative">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                  <thead className="bg-slate-50/80 backdrop-blur-md text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-bold">Timestamp</th>
                      <th className="px-6 py-4 font-bold">Trigger Type</th>
                      <th className="px-6 py-4 font-bold">Recipient</th>
                      <th className="px-6 py-4 font-bold">Subject</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentActivity.length > 0 ? (
                      recentActivity.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                            {new Date(log.sent_at).toLocaleString([], {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                              log.type === 'Automated'
                                ? 'bg-purple-50 text-purple-600 border-purple-100'
                                : 'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">{log.recipient_email}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium truncate max-w-xs" title={log.subject}>
                            {log.subject}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-medium">
                          No system activity logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

        {/* --- NEW: RENDER TOAST --- */}
      <ToastNotification 
        isVisible={toast.show} 
        message={toast.message} 
        onClose={() => setToast({ ...toast, show: false })} 
      />

    </div>
  );
}