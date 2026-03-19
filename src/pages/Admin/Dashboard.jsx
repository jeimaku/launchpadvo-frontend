import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell'; // <-- IMPORT YOUR NEW COMPONENT
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0, pendingRevenue: 0, activeClients: 0, expiringSoon: 0
  });
  const [revenueByBranch, setRevenueByBranch] = useState([]);
  const [clientStatusData, setClientStatusData] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('userRole') || 'staff';
  
  // Role-based booleans
  const isManagement = ['admin', 'manager'].includes(userRole);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch all data simultaneously
      const [paymentsRes, lpcRes, lpogRes] = await Promise.all([
        fetch('http://localhost:5000/api/payments', { headers }),
        fetch('http://localhost:5000/api/virtual-offices?branch=LPC', { headers }),
        fetch('http://localhost:5000/api/virtual-offices?branch=LPOG', { headers })
      ]);

      if (paymentsRes.ok && lpcRes.ok && lpogRes.ok) {
        const payments = await paymentsRes.json();
        const clients = [...(await lpcRes.json()), ...(await lpogRes.json())];

        // 1. Calculate Top-Level Stats
        const verifiedPayments = payments.filter(p => p.status === 'Verified');
        const pendingPayments = payments.filter(p => p.status === 'Pending');
        
        setStats({
          totalRevenue: verifiedPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0),
          pendingRevenue: pendingPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0),
          activeClients: clients.filter(c => c.contract_status === 'Active').length,
          expiringSoon: clients.filter(c => c.contract_status === 'Expiring').length
        });

        // 2. Format Data for Bar Chart (Revenue by Branch)
        const lpcRev = verifiedPayments.filter(p => p.branch === 'LPC').reduce((sum, p) => sum + Number(p.amount_paid), 0);
        const lpogRev = verifiedPayments.filter(p => p.branch === 'LPOG').reduce((sum, p) => sum + Number(p.amount_paid), 0);
        setRevenueByBranch([
          { name: 'Commercenter (LPC)', revenue: lpcRev },
          { name: 'One Griffinstone (LPOG)', revenue: lpogRev }
        ]);

        // 3. Format Data for Pie Chart (Client Status)
        const activeCount = clients.filter(c => c.contract_status === 'Active').length;
        const expiredCount = clients.filter(c => c.contract_status === 'Expired').length;
        setClientStatusData([
          { name: 'Active', value: activeCount, color: '#d2f34c' }, // Lime Green
          { name: 'Expired/Inactive', value: expiredCount, color: '#94a3b8' } // Slate 400
        ]);

        // 4. Get Recent 5 Payments for the quick table
        setRecentPayments(payments.slice(0, 5));
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 p-8 overflow-hidden overflow-y-auto max-h-screen">
        
        {/* HEADER SECTION */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Overview</h2>
            <p className="text-slate-500 mt-1 font-medium">Welcome back, {userName}. Here is what's happening today.</p>
          </div>
          
          <div className="flex items-center gap-3 relative">
            
            {/* Live Data Badge */}
            <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Data
            </span>

            {/* ---> RENDER THE NEW COMPONENT HERE <--- */}
            <NotificationBell />

          </div>
        </header>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 font-bold">Loading Analytics...</div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            
            {/* ========================================== */}
            {/* KPI CARDS (Role Based Display)             */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Only Management sees the money totals */}
              {isManagement && (
                <>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Verified Revenue</p>
                    <p className="text-3xl font-black text-slate-800">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Pending Verification</p>
                    <p className="text-3xl font-black text-slate-800">{formatCurrency(stats.pendingRevenue)}</p>
                  </div>
                </>
              )}

              {/* Staff and Management see client metrics */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-2 bg-[#d2f34c]"></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active Contracts</p>
                <p className="text-3xl font-black text-slate-800">{stats.activeClients}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-2 bg-red-400"></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Expiring / Action Needed</p>
                <p className="text-3xl font-black text-slate-800">{stats.expiringSoon}</p>
              </div>
            </div>

            {/* ========================================== */}
            {/* CHARTS ROW (Management Only)               */}
            {/* ========================================== */}
            {isManagement && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Bar Chart: Revenue by Branch */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-6">Revenue by Facility</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByBranch} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                        <YAxis tickFormatter={(val) => `₱${val.toLocaleString()}`} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart: Client Health */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 w-full text-left">Portfolio Health</h3>
                  <div className="h-48 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={clientStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                          {clientStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 mt-6">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#d2f34c]"></span><span className="text-xs font-bold text-slate-600">Active</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400"></span><span className="text-xs font-bold text-slate-600">Inactive</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* RECENT ACTIVITY TABLE                      */}
            {/* ========================================== */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Recent Financial Activity</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Client</th>
                      {isManagement && <th className="px-6 py-4 font-semibold">Amount</th>}
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentPayments.length > 0 ? (
                      recentPayments.map(payment => (
                        <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-600">{new Date(payment.payment_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 font-bold text-slate-800">{payment.company_name}</td>
                          {isManagement && <td className="px-6 py-4 font-mono text-slate-700">{formatCurrency(payment.amount_paid)}</td>}
                          <td className="px-6 py-4">
                            {payment.status === 'Pending' && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">Pending</span>}
                            {payment.status === 'Verified' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">Verified</span>}
                            {payment.status === 'Voided' && <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs font-bold">Voided</span>}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={isManagement ? 4 : 3} className="px-6 py-8 text-center text-slate-500">No recent activity found.</td></tr>
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