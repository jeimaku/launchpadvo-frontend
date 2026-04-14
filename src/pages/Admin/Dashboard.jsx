import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeClients: 0, expiringSoon: 0, totallyExpired: 0, missedEmails: 0
  });
  const [packageData, setPackageData] = useState([]);
  // --- INTERACTIVE CHART STATE ---
  const [portfolioData, setPortfolioData] = useState({
    LPC: { total: 0, VO: 0, UOA: 0, Custom: 0 },
    LPOG: { total: 0, VO: 0, UOA: 0, Custom: 0 }
  });
  const [activeIndex, setActiveIndex] = useState(0); 
  const [drilldownView, setDrilldownView] = useState({ active: false, branch: null });  const [recentActivity, setRecentActivity] = useState([]);
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

      // Fetch all operational data simultaneously
      const [lpcRes, lpogRes, logsRes] = await Promise.all([
        fetch(`http://${window.location.hostname}:5000/api/virtual-offices?branch=LPC`, { headers }),
        fetch(`http://${window.location.hostname}:5000/api/virtual-offices?branch=LPOG`, { headers }),
        fetch(`http://${window.location.hostname}:5000/api/emails/logs`, { headers })
      ]);

      if (lpcRes.ok && lpogRes.ok && logsRes.ok) {
        const lpcClients = await lpcRes.json();
        const lpogClients = await lpogRes.json();
        const allClients = [...lpcClients, ...lpogClients];
        const emailLogs = await logsRes.json();

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
            activeCount++; // Failsafe for no end date
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
          missedEmails: missedEmailsCount
        });

        // 2. Format Data for Interactive Drill-Down
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
        setRecentActivity(emailLogs.slice(0, 20));

        // 4. Sort Action List by Urgency (Most expired first)
        actionNeeded.sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
        setActionNeededClients(actionNeeded.slice(0, 10)); // Increased to top 10 for better visibility
      }
    } catch (error) {
      console.error("Error loading operational dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- INTERACTIVE CHART LOGIC ---
  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
    
    return (
      <g>
        {/* Adjusted Y-coordinates to fit the new percentage text perfectly */}
        <text x={cx} y={cy - 16} dy={0} textAnchor="middle" fill="#64748b" className="text-[10px] font-black uppercase tracking-widest">{payload.name}</text>
        <text x={cx} y={cy + 8} dy={0} textAnchor="middle" fill={fill} className="text-3xl font-black">{value}</text>
        
        {/* NEW: Automatically calculated percentage */}
        <text x={cx} y={cy + 26} dy={0} textAnchor="middle" fill="#94a3b8" className="text-xs font-bold">
          {(percent * 100).toFixed(1)}%
        </text>
        
        {/* Pulse prompt pushed down slightly */}
        {!drilldownView.active && (
          <text x={cx} y={cy + 42} dy={0} textAnchor="middle" fill="#cbd5e1" className="text-[9px] font-bold uppercase tracking-wider animate-pulse">Click to explore</text>
        )}
        
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} className="transition-all duration-300 cursor-pointer" />
        <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={innerRadius - 8} outerRadius={innerRadius - 4} fill={fill} />
      </g>
    );
  };

  // Dynamically build the chart data based on what view the user is in
  let displayData = [];
  if (!drilldownView.active) {
    displayData = [
      { id: 'LPC', name: 'LPC', value: portfolioData.LPC.total, color: '#1e293b' },
      { id: 'LPOG', name: 'LPOG', value: portfolioData.LPOG.total, color: '#d2f34c' }
    ].filter(d => d.value > 0);
  } else {
    const bd = portfolioData[drilldownView.branch];
    const isLPC = drilldownView.branch === 'LPC';
    // LPC uses Blue themes, LPOG uses Yellow/Orange themes
    displayData = [
      { name: 'Virtual Office', value: bd.VO, color: isLPC ? '#1e293b' : '#d2f34c' },
      { name: 'Use of Address', value: bd.UOA, color: isLPC ? '#3b82f6' : '#facc15' },
      { name: 'Custom Packages', value: bd.Custom, color: isLPC ? '#0ea5e9' : '#fb923c' }
    ].filter(d => d.value > 0);
  }

  const handlePieClick = (entry) => {
    if (!drilldownView.active && entry.id) {
      setDrilldownView({ active: true, branch: entry.id });
      setActiveIndex(0); 
    }
  };

  // --- NEW: Calculate the current total for the legend percentages ---
  const currentTotal = displayData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 p-8 overflow-hidden overflow-y-auto max-h-screen custom-scrollbar">
        
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
            {/* OPERATIONAL KPI CARDS                      */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Active Contracts - Emerald Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-emerald-400 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Contracts</p>
                  <p className="text-3xl font-black text-slate-800">{stats.activeClients}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500 shadow-inner">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
              </div>

              {/* Expiring Soon (30 Days) - Orange Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-orange-400 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Expiring (≤ 30 Days)</p>
                  <p className="text-3xl font-black text-slate-800">{stats.expiringSoon}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl text-orange-500 shadow-inner">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>

              {/* Totally Expired - Rose/Red Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-rose-500 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Totally Expired</p>
                  <p className="text-3xl font-black text-slate-800">{stats.totallyExpired}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl text-rose-500 shadow-inner">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
              </div>

              {/* Missed Emails (Feedback) - Purple Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-purple-500 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Missed Auto-Emails</p>
                  <p className="text-3xl font-black text-slate-800">{stats.missedEmails}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600 shadow-inner">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </div>
              </div>

            </div>

            {/* ========================================== */}
            {/* CHARTS ROW                                 */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Priority Action Table (NOW INCLUDES EMAIL FEEDBACK) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Action List & Feedback</h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md uppercase tracking-wider border border-slate-200">Critical Contracts</span>
                </div>
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
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
                              {/* FEEDBACK TAGS */}
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

              {/* Interactive Drill-Down Pie Chart */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-between relative">
                
                {/* Header with dynamic Back Button */}
                <div className="flex justify-between items-center w-full">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{drilldownView.active ? `${drilldownView.branch} Services` : 'Service Distribution'}</h3>
                  {drilldownView.active && (
                    <button 
                      onClick={() => { setDrilldownView({ active: false, branch: null }); setActiveIndex(0); }}
                      className="text-[10px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                    >
                      ← Back
                    </button>
                  )}
                </div>
                
                <div className="h-48 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={50}>
                    <PieChart>
                      <Pie 
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        data={displayData} 
                        cx="50%" cy="50%" 
                        innerRadius={65} outerRadius={80} 
                        dataKey="value" 
                        stroke="none"
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onClick={(entry) => handlePieClick(entry)}
                      >
                        {displayData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} className="cursor-pointer transition-opacity duration-300 hover:opacity-90" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Dynamic Legend with Percentages */}
                <div className={`grid mt-4 w-full pt-4 border-t border-slate-100 ${drilldownView.active ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                  {displayData.map((pkg, index) => (
                    <div 
                      key={pkg.name} 
                      onClick={() => handlePieClick(pkg)}
                      className={`flex flex-col p-2 rounded-lg transition-colors cursor-pointer ${activeIndex === index ? 'bg-slate-50 shadow-sm border border-slate-100' : 'border border-transparent hover:bg-slate-50/50'}`}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pkg.color }}></span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider truncate ${activeIndex === index ? 'text-slate-900' : 'text-slate-500'}`} title={pkg.name}>
                          {pkg.name}
                        </span>
                      </div>
                      <span className={`text-sm font-black pl-4 flex items-baseline gap-1.5 ${activeIndex === index ? 'text-slate-900' : 'text-slate-600'}`}>
                        {pkg.value}
                        {/* NEW: Legend Percentage */}
                        <span className="text-[10px] text-slate-400 font-bold">
                          ({((pkg.value / currentTotal) * 100).toFixed(1)}%)
                        </span>
                      </span>
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
              
              {/* NEW SCROLLABLE WRAPPER */}
              <div className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar relative">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                  {/* STICKY HEADER */}
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-sm">
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