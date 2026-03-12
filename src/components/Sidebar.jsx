import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Desktop expansion state
  const [isExpanded, setIsExpanded] = useState(true); 
  // Mobile drawer state
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('userRole') || 'staff';

  const isActive = (path) => location.pathname === path;

  // Automatically close the mobile sidebar when a user clicks a link and navigates
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // On mobile, the sidebar is always fully expanded when visible
  const showText = isMobileOpen || isExpanded;

  return (
    <>
      {/* ========================================== */}
      {/* MOBILE FLOATING MENU BUTTON                */}
      {/* ========================================== */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-[#d2f34c] shadow-2xl hover:scale-105 transition-transform"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      {/* ========================================== */}
      {/* MOBILE BACKDROP OVERLAY                    */}
      {/* ========================================== */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/60 z-40 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ========================================== */}
      {/* MASTER SIDEBAR CONTAINER                   */}
      {/* ========================================== */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 h-screen bg-slate-900 text-white shadow-xl
        flex flex-col transition-all duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        ${isExpanded ? 'md:w-64' : 'md:w-20'}
      `}>
        
        {/* DESKTOP TOGGLE BUTTON (Hides on Mobile) */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="hidden md:flex absolute -right-3.5 top-9 h-7 w-7 items-center justify-center rounded-full bg-[#d2f34c] text-slate-900 shadow-md hover:scale-110 transition-transform z-50"
        >
          {isExpanded ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          )}
        </button>

        {/* MOBILE CLOSE BUTTON */}
        <button 
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Logo Section */}
        <div className={`flex items-center gap-3 mt-8 mb-10 overflow-hidden ${showText ? 'px-6' : 'px-0 justify-center'}`}>
          <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-lg bg-[#d2f34c]">
            <span className="text-xl font-black text-slate-900">L</span>
          </div>
          {showText && <h1 className="text-xl font-bold tracking-wide whitespace-nowrap animate-fade-in">Launchpad VO</h1>}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-2 text-sm font-semibold text-slate-400 flex-1 px-3 overflow-y-auto overflow-x-hidden">
          
          {/* ADMIN & MANAGER ONLY */}
          {['admin', 'manager'].includes(userRole) && (
            <Link 
              to="/dashboard" 
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/dashboard') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
              title={!showText ? "Analytics Dashboard" : ""}
            >
              <span className="text-lg flex-shrink-0">📊</span>
              {showText && <span className="whitespace-nowrap">Analytics Dashboard</span>}
            </Link>
          )}

          {/* CLIENT ENCODING */}
          {showText ? (
            <p className="px-3 pt-4 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Client Encoding</p>
          ) : (
            <div className="w-full border-t border-slate-800 my-4"></div>
          )}

          <Link 
            to="/lpc-virtual-office" 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/lpc-virtual-office') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
            title={!showText ? "LPC Virtual Office" : ""}
          >
            <span className="text-lg flex-shrink-0">🏢</span>
            {showText && <span className="whitespace-nowrap">LPC Virtual Office</span>}
          </Link>

          <Link 
            to="/lpog-virtual-office" 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/lpog-virtual-office') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
            title={!showText ? "LPOG Virtual Office" : ""}
          >
            <span className="text-lg flex-shrink-0">🏙️</span>
            {showText && <span className="whitespace-nowrap">LPOG Virtual Office</span>}
          </Link>

          {/* FINANCIALS */}
          {showText ? (
            <p className="px-3 pt-4 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Financials</p>
          ) : (
            <div className="w-full border-t border-slate-800 my-4"></div>
          )}

          <Link 
            to="/payments" 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/payments') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
            title={!showText ? "Payments & Receipts" : ""}
          >
            <span className="text-lg flex-shrink-0">💳</span>
            {showText && <span className="whitespace-nowrap">Payments & Receipts</span>}
          </Link>

          {/* STRICTLY ADMIN ONLY */}
          {userRole === 'admin' && (
            <>
              {showText ? (
                <p className="px-3 pt-4 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600">System</p>
              ) : (
                <div className="w-full border-t border-slate-800 my-4"></div>
              )}
              <Link 
                to="/users" 
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/users') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
                title={!showText ? "User Management" : ""}
              >
                <span className="text-lg flex-shrink-0">⚙️</span>
                {showText && <span className="whitespace-nowrap">User Management</span>}
              </Link>
            </>
          )}
        </nav>

        {/* Bottom Section: User Profile & Logout */}
        <div className="border-t border-slate-800 p-4 mt-auto">
          <div className={`flex items-center overflow-hidden ${showText ? 'justify-between' : 'justify-center'}`}>
            {showText && (
              <div className="truncate pr-2 animate-fade-in">
                <p className="text-sm font-bold text-white truncate">{userName}</p>
                <p className="text-xs text-[#d2f34c] capitalize font-medium">{userRole}</p>
              </div>
            )}
            <button 
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
              title="Sign Out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}