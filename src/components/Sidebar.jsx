import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Grab the logged-in user's details from local storage
  const userName = localStorage.getItem('userName') || 'Admin';
  const userRole = localStorage.getItem('userRole') || 'staff';

  // Helper function to check if the current path matches the link so we can highlight it
  const isActive = (path) => location.pathname === path;

  // Handle signing out
  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="w-64 bg-slate-900 text-white p-6 shadow-xl hidden md:flex md:flex-col h-screen sticky top-0">
      
      {/* Logo Section */}
      <div className="flex items-center gap-3 mb-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d2f34c]">
          <span className="text-xl font-black text-slate-900">L</span>
        </div>
        <h1 className="text-xl font-bold tracking-wide">Launchpad VO</h1>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-2 text-sm font-semibold text-slate-400 flex-1">
        <p className="px-4 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Main Menu</p>
        
        <Link 
          to="/dashboard" 
          className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/dashboard') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
        >
          📊 Overview
        </Link>

        <Link 
          to="/lpc-virtual-office" 
          className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/lpc-virtual-office') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
        >
          🏢 LPC Virtual Office
        </Link>

        <Link 
          to="/lpog-virtual-office" 
          className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/lpog-virtual-office') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
        >
          🌆 LPOG Virtual Office
        </Link>

        <Link 
          to="/payments" 
          className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/payments') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
        >
          💳 Payments & Receipts
        </Link>
      </nav>

      {/* Bottom Section: User Profile & Logout */}
      <div className="border-t border-slate-800 pt-6 mt-auto">
        <div className="flex items-center justify-between px-4">
          <div className="truncate pr-2">
            <p className="text-sm font-bold text-white truncate">{userName}</p>
            <p className="text-xs text-[#d2f34c] capitalize font-medium">{userRole}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
            title="Sign Out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
          </button>
        </div>
      </div>
      
    </div>
  );
}