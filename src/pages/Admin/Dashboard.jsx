import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeClients: 0, expiringSoon: 0, automatedEmails: 0, manualEmails: 0
  });
  const [branchData, setBranchData] = useState([]);
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

        // 1. Calculate Operational KPIs
        const activeCount = allClients.filter(c => c.contract_status === 'Active').length;
        const expiringCount = allClients.filter(c => ['Pending Renewal', 'Expired'].includes(c.contract_status)).length;
        
        const automatedCount = emailLogs.filter(log => log.type === 'Automated').length;
        const manualCount = emailLogs.filter(log => log.type === 'Manual').length;
        
        setStats({
          activeClients: activeCount,
          expiringSoon: expiringCount,
          automatedEmails: automatedCount,
          manualEmails: manualCount
        });

        // 2. Format Data for Branch Distribution Chart
        setBranchData([
          { name: 'Commercenter (LPC)', clients: lpcClients.length, color: '#1e293b' },
          { name: 'One Griffinstone (LPOG)', clients: lpogClients.length, color: '#d2f34c' } 
        ]);

        // 3. Get Recent System Activity (Increased slice to 20 to utilize the new scrollbar)
        setRecentActivity(emailLogs.slice(0, 20));

        // 4. Get Clients Needing Immediate Action
        const priorityClients = allClients
          .filter(c => ['Pending Renewal', 'Expired'].includes(c.contract_status))
          .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
          .slice(0, 5);
        
        setActionNeededClients(priorityClients);
      }
    } catch (error) {
      console.error("Error loading operational dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
            {/* COLORFUL OPERATIONAL KPI CARDS             */}
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

              {/* Expiring / Action Needed - Orange Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-orange-400 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Expiring Soon</p>
                  <p className="text-3xl font-black text-slate-800">{stats.expiringSoon}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl text-orange-500 shadow-inner">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>

              {/* Automated Emails - Purple Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-purple-400 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Automated Emails</p>
                  <p className="text-3xl font-black text-slate-800">{stats.automatedEmails}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl text-purple-500 shadow-inner">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
              </div>

              {/* Manual Quick Actions - Blue Accent */}
              <div className="bg-white p-5 rounded-xl border-l-4 border-l-blue-400 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Manual Actions</p>
                  <p className="text-3xl font-black text-slate-800">{stats.manualEmails}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-blue-500 shadow-inner">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </div>
              </div>

            </div>

            {/* ========================================== */}
            {/* CHARTS ROW                                 */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Priority Action Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Contract Action List</h3>
                  <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2.5 py-1 rounded-md uppercase tracking-wider border border-orange-200">Expiring Soon</span>
                </div>
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 font-bold">Company</th>
                        <th className="px-6 py-4 font-bold">Branch</th>
                        <th className="px-6 py-4 font-bold">Status</th>
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
                                client.contract_status === 'Expired' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-orange-50 text-orange-600 border-orange-200'
                              }`}>
                                {client.contract_status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium">All clear. No pending contract expirations.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pie Chart: Portfolio Distribution */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest w-full text-left">Virtual Office Tracking</h3>
                <div className="h-48 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={50}>
                    <PieChart>
                      <Pie data={branchData} cx="50%" cy="50%" innerRadius={65} outerRadius={80} paddingAngle={2} dataKey="clients" stroke="none">
                        {branchData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 'bold'}} 
                        formatter={(value) => [`${value} Clients`, 'Count']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-3 mt-6 w-full pt-4 border-t border-slate-100">
                  {branchData.map(branch => (
                    <div key={branch.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: branch.color }}></span>
                        <span className="text-xs font-bold text-slate-600">{branch.name}</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{branch.clients}</span>
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