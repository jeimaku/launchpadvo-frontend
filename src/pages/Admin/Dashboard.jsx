import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../../components/Sidebar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0, pendingRevenue: 0, activeClients: 0, expiringSoon: 0
  });
  const [revenueByBranch, setRevenueByBranch] = useState([]);
  const [clientStatusData, setClientStatusData] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Notification States ---
  const [hasNewEmail, setHasNewEmail] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]); // Holds real email data
  const notificationRef = useRef(null);

  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('userRole') || 'staff';
  
  // Role-based booleans
  const isManagement = ['admin', 'manager'].includes(userRole);

  // --- Function to fetch recent emails for the notification dropdown ---
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/emails/inbox', {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Grab the 5 most recent emails to display in the dropdown
        const recentEmails = data.slice(0, 5).map(email => ({
          id: email.id,
          sender: email.sender_name || email.sender_email,
          subject: email.subject,
          time: new Date(email.received_at)
        }));
        setNotifications(recentEmails);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchNotifications(); // Fetch initial notifications on load

    // Socket listener for real-time dashboard notifications
    const socket = io('http://localhost:5000');
    
    socket.on('incoming_email', () => {
      const currentRole = localStorage.getItem('userRole');
      
      // AUTO-REFRESH LOGIC & SOUND: Available for admin, manager, and staff only
      if (['admin', 'manager', 'staff'].includes(currentRole)) {
        setHasNewEmail(true); // Triggers the red dot
        fetchNotifications(); // Refreshes the floating component's data in real-time

        // Trigger the background notification sound
        const notificationSound = new Audio('/notification.mp3');
        notificationSound.play().catch(err => {
          // Browsers may block audio if the user hasn't interacted with the document yet
          console.warn("Audio playback blocked by browser. User interaction required:", err);
        });
      }
    });

    // Close notification dropdown when clicking outside
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      socket.off('incoming_email'); // Clean up the specific listener
      socket.disconnect();
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
          
          <div className="flex items-center gap-3 relative" ref={notificationRef}>
            
            {/* Live Data Badge */}
            <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Data
            </span>

            {/* Notification Bell Button */}
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                setHasNewEmail(false); // Clear the red dot when opened
              }}
              className={`relative flex items-center justify-center p-2 border rounded-full shadow-sm transition-colors ${
                showNotifications ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              title="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              
              {/* Pulsing Red Dot */}
              {hasNewEmail && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                </span>
              )}
            </button>

            {/* Floating Notification Popover */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-3 w-80 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-50 overflow-hidden animate-fade-in origin-top-right">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 text-sm">Notifications</h3>
                </div>
                
                {notifications.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center text-center">
                    <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="font-medium text-slate-400 text-sm">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <Link 
                        to="/email-center" 
                        key={n.id} 
                        className="block px-5 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 font-bold truncate">New email from {n.sender}</p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{n.subject}</p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                              {n.time.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
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