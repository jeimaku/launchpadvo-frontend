import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

export default function Dashboard() {
  // 1. State to hold our backend data
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 2. useEffect runs automatically as soon as the page loads
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Grab the ID badge we saved during login
        const token = localStorage.getItem('token');
        
        // Security check: If they don't have a token, kick them back to login
        if (!token) {
          navigate('/');
          return;
        }

        // Fetch the data from our backend
        const response = await fetch('http://localhost:5000/api/dashboard/analytics', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`, // Present the ID badge
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          // If the token is expired or invalid, clear it and kick them out
          localStorage.removeItem('token');
          navigate('/');
          throw new Error('Unauthorized access');
        }

        const data = await response.json();
        setAnalytics(data); // Save the data to React state
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [navigate]);

  // 3. Helper function to find specific status counts safely
  const getStatusCount = (statusName) => {
    if (!analytics || !analytics.overview) return 0;
    const found = analytics.overview.find(item => item.status === statusName);
    return found ? found.count : 0;
  };

  // 4. Loading Screen
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-xl font-bold text-slate-500 animate-pulse">Loading Launchpad Data...</p>
      </div>
    );
  }

  // 5. The Main Dashboard UI
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      
      <Sidebar />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-8">
        <header className="mb-8 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-slate-800">Overview</h2>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              navigate('/');
            }}
            className="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
          >
            Sign Out
          </button>
        </header>

        {/* STAT CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
            <h3 className="text-sm font-semibold text-slate-500">Total Clients</h3>
            <p className="text-3xl font-black text-slate-800 mt-2">{analytics?.totalClients || 0}</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 border-l-4 border-l-[#d2f34c]">
            <h3 className="text-sm font-semibold text-slate-500">Active Contracts</h3>
            <p className="text-3xl font-black text-slate-800 mt-2">{getStatusCount('Active')}</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 border-l-4 border-l-orange-500">
            <h3 className="text-sm font-semibold text-slate-500">Expiring Soon</h3>
            <p className="text-3xl font-black text-slate-800 mt-2">{getStatusCount('Warning')}</p>
          </div>

        </div>

        {/* RECENT ACTIVITY TABLE */}
        <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Recent Contracts</h3>
          </div>
          <div className="p-6">
            {analytics?.recentActivity?.length > 0 ? (
              <ul className="space-y-4">
                {analytics.recentActivity.map(contract => (
                  <li key={contract.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-bold text-slate-800">{contract.company_name}</p>
                      <p className="text-slate-500">{contract.client_name}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      contract.status === 'Active' ? 'bg-[#d2f34c]/20 text-slate-800' : 
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {contract.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No recent activity found.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}