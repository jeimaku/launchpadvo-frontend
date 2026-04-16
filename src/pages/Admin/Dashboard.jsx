import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';

export default function Dashboard() {
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

        // 1. SMART DATE MATH & EMAIL VERIFICATION
        let activeCount = 0;
        let expiringCount = 0;
        let expiredCount = 0;
        let missedEmailsCount = 0;

        const actionNeeded = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        allClients.forEach(c => {
          let isExpiring = false;
          let isExpired = false;

          // Date Math
          if (c.end_date) {
            const expiryDate = new Date(c.end_date);
            expiryDate.setHours(0,0,0,0);
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

            if (daysUntilExpiry < 0) {
              expiredCount++;
              isExpired = true;
            } else if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
              expiringCount++;
              isExpiring = true;
            } else {
              activeCount++;
            }
          } else {
            activeCount++; 
          }

          // Email Verification Logic
          if (isExpiring || isExpired) {
            const gotEmail = emailLogs.some(log => log.recipient_email === c.email_1 && log.type === 'Automated');
            const isDisabled = (c.auto_email_enabled === 0 || c.auto_email_enabled === false);
            
            const missed = !gotEmail || isDisabled;
            if (missed) missedEmailsCount++;

            actionNeeded.push({
              ...c,
              isExpired,
              isExpiring,
              missedEmail: missed,
              emailStatus: isDisabled ? 'Disabled' : gotEmail ? 'Sent' : 'Pending / Failed'
            });
          }
        });

        setStats({
          activeClients: activeCount,
          expiringSoon: expiringCount,
          totallyExpired: expiredCount,
          missedEmails: missedEmailsCount,
          pendingRevenue: pendingAmt,
          verifiedRevenue: verifiedAmt
        });

        // 2. Format Data for Service Distribution 
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

        // 3. Get Recent System Activity 
        setRecentActivity(emailLogs.slice(0, 50)); 

        // 4. Sort Action List by Urgency 
        actionNeeded.sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
        setActionNeededClients(actionNeeded); 
      }
    } catch (error) {
      console.error("Error loading operational dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-hidden overflow-y-auto max-h-screen custom-scrollbar">
        
        {/* HEADER SECTION */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Operations Overview</h2>
            <p className="text-slate-500 mt-1 text-sm font-medium">Welcome back, {userName}. Here is your daily operational brief.</p>
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
          <div className="h-64 flex items-center justify-center text-slate-400 font-medium text-sm">Loading operational data...</div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            
            {/* ========================================== */}
            {/* ROBUST KPI CARDS (6-Grid)                  */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Active Contracts - Emerald Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-emerald-400 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Contracts</p>
                  <p className="text-2xl font-black text-slate-800">{stats.activeClients}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
              </div>

              {/* Expiring Soon (30 Days) - Orange Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-orange-400 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expiring (≤ 30 Days)</p>
                  <p className="text-2xl font-black text-slate-800">{stats.expiringSoon}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl text-orange-500 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>

              {/* Missed Emails (Feedback) - Purple Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-purple-500 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Missed Auto-Emails</p>
                  <p className="text-2xl font-black text-slate-800">{stats.missedEmails}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </div>
              </div>

              {/* Total Verified Revenue */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-green-500 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Verified Revenue</p>
                  <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.verifiedRevenue)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl text-green-600 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>

              {/* Pending Verification */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-blue-500 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pending Verification</p>
                  <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.pendingRevenue)}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>

              {/* Totally Expired - Rose/Red Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-rose-500 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow opacity-90">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Totally Expired</p>
                  <p className="text-2xl font-black text-rose-600">{stats.totallyExpired}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl text-rose-500 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
              </div>

            </div>

            {/* ========================================== */}
            {/* WIDGET ROW                                 */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* SCROLLABLE Action Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-20">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Action List & Feedback</h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md uppercase tracking-wider border border-slate-200">Critical Contracts</span>
                </div>
                
                <div className="overflow-x-auto overflow-y-auto max-h-[360px] custom-scrollbar flex-1 relative">
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 font-bold">Company</th>
                        <th className="px-6 py-3 font-bold">Branch</th>
                        <th className="px-6 py-3 font-bold">Status</th>
                        <th className="px-6 py-3 font-bold">Auto-Email Tracker</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {actionNeededClients.length > 0 ? (
                        actionNeededClients.map(client => (
                          <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{client.company_name}</td>
                            <td className="px-6 py-4 text-slate-500 font-medium">{client.branch}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                client.isExpired ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-orange-50 text-orange-600 border-orange-200'
                              }`}>
                                {client.isExpired ? 'Expired' : 'Expiring (≤ 30 Days)'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {client.emailStatus === 'Disabled' && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 shadow-sm">System Disabled</span>}
                              {client.emailStatus === 'Sent' && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 shadow-sm">✅ Sent by System</span>}
                              {client.emailStatus === 'Pending / Failed' && <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200 shadow-sm">⚠️ No Email Sent</span>}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">All clear. No critical contracts pending.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CLEAN Dual-Branch Service Distribution Board */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center w-full px-6 py-5 border-b border-slate-100 bg-white shrink-0 z-20">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Service Distribution</h3>
                  <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider border border-slate-200">
                    Total Clients: {portfolioData.LPC.total + portfolioData.LPOG.total}
                  </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-8 bg-slate-50/30">
                  {/* Branch Data Loop */}
                  {[
                    { id: 'LPC', label: 'LPC Branch', data: portfolioData.LPC, color: 'bg-slate-800', accent: 'text-blue-600' },
                    { id: 'LPOG', label: 'LPOG Branch', data: portfolioData.LPOG, color: 'bg-[#d2f34c]', accent: 'text-[#8ca81b]' }
                  ].map((branch) => (
                    <div key={branch.id} className="flex flex-col">
                      <div className="flex justify-between items-end mb-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-5 rounded-full ${branch.color}`}></span>
                          <h4 className="font-black text-slate-800 text-base tracking-tight">{branch.label}</h4>
                        </div>
                        <span className="text-sm font-black text-slate-500">{branch.data.total} Total</span>
                      </div>

                      <div className="space-y-5">
                        {[
                          { label: 'Virtual Office', val: branch.data.VO },
                          { label: 'Use of Address', val: branch.data.UOA },
                          { label: 'Custom Packages', val: branch.data.Custom }
                        ].map((item, idx) => {
                          const percentage = branch.data.total > 0 ? Math.round((item.val / branch.data.total) * 100) : 0;
                          return (
                            <div key={idx} className="group">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-slate-900 transition-colors">
                                  {item.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-slate-800">{item.val}</span>
                                  <span className="text-[10px] font-bold text-slate-400">({percentage}%)</span>
                                </div>
                              </div>
                              {/* Interactive Animated Bar */}
                              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                <div 
                                  className={`h-full ${branch.color} rounded-full transition-all duration-1000 ease-out shadow-sm`} 
                                  style={{ width: isLoading ? '0%' : `${percentage}%` }}
                                >
                                  {/* Subtle Shine effect for interactivity */}
                                  <div className="w-full h-full opacity-20 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ========================================== */}
            {/* SCROLLABLE SYSTEM AUDIT TRAIL              */}
            {/* ========================================== */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-20">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">System Activity Log</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Audit trail of outgoing communications</p>
                </div>
              </div>
              
              <div className="overflow-x-auto overflow-y-auto max-h-[320px] custom-scrollbar relative">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 font-bold">Timestamp</th>
                      <th className="px-6 py-3 font-bold">Trigger Type</th>
                      <th className="px-6 py-3 font-bold">Recipient</th>
                      <th className="px-6 py-3 font-bold">Subject</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentActivity.length > 0 ? (
                      recentActivity.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                            {new Date(log.sent_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                             <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                               log.type === 'Automated' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-blue-50 text-blue-600 border-blue-200'
                             }`}>
                               {log.type}
                             </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">{log.recipient_email}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium truncate max-w-xs" title={log.subject}>{log.subject}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-medium">No system activity logged yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}