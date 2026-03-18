import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import myLogo from '../assets/launchpad.png'; // <-- ADD THIS LINE

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Desktop expansion state
  const [isExpanded, setIsExpanded] = useState(true); 
  // Mobile drawer state
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const userName = localStorage.getItem('userName') || 'User';
  const userRole = localStorage.getItem('userRole') || 'staff';
  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(userName);
  const [profilePassword, setProfilePassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Automatically close the mobile sidebar when a user clicks a link and navigates
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: profileName, password: profilePassword })
      });

      if (!response.ok) throw new Error('Failed to update profile');
      
      // Update local storage so the sidebar name changes immediately
      localStorage.setItem('userName', profileName);
      alert('Profile updated successfully!');
      setShowProfileModal(false);
      setProfilePassword(''); // Clear password field
    } catch (error) {
      alert(error.message);
    } finally {
      setIsUpdating(false);
    }
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
        <div className={`flex items-center mt-8 mb-10 overflow-hidden ${showText ? 'px-6' : 'justify-center'}`}>
          {showText ? (
            /* Shows the logo AND text when sidebar is OPEN */
            <div className="flex items-center gap-3 animate-fade-in">
              <img src={myLogo} alt="Launchpad Logo" className="h-10 w-auto object-contain shrink-0 filter brightness-0 invert opacity-90" />
              <div className="flex flex-col">
                <span className="text-base font-black tracking-wide text-white uppercase leading-none">Launchpad</span>
                <span className="text-[10px] font-bold tracking-widest text-[#d2f34c] uppercase mt-1">Coworking</span>
              </div>
            </div>
          ) : (
            /* Shows ONLY the logo icon when sidebar is CLOSED */
            <img src={myLogo} alt="Launchpad Logo" className="h-8 w-auto object-contain shrink-0 filter brightness-0 invert opacity-90 animate-fade-in" />
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-2 text-sm font-semibold text-slate-400 flex-1 px-3 overflow-y-auto overflow-x-hidden">
          
          {/* DASHBOARD (All Internal Roles) */}
          <Link 
            to="/dashboard" 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/dashboard') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
            title={!showText ? "Dashboard" : ""}
          >
            <span className="text-lg flex-shrink-0">📊</span>
            {showText && <span className="whitespace-nowrap">Dashboard</span>}
          </Link>

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

          {/* COMMUNICATIONS */}
          {showText ? (
            <p className="px-3 pt-4 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Communications</p>
          ) : (
            <div className="w-full border-t border-slate-800 my-4"></div>
          )}

          <Link 
            to="/email-center" 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/email-center') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
            title={!showText ? "Email Center" : ""}
          >
            <span className="text-lg flex-shrink-0">📧</span>
            {showText && <span className="whitespace-nowrap">Email Center</span>}
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
              <div className="flex items-center gap-2 truncate pr-2 animate-fade-in">
                <div className="truncate">
                  <p className="text-sm font-bold text-white truncate">{userName}</p>
                  <p className="text-xs text-[#d2f34c] capitalize font-medium">{userRole}</p>
                </div>
                {/* NEW PROFILE SETTINGS BUTTON */}
                <button onClick={() => setShowProfileModal(true)} className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-md hover:bg-slate-800" title="My Profile">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
              </div>
            )}

            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0" title="Sign Out">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>

          </div>
        </div>
      </div>
      {/* ========================================== */}
      {/* MY PROFILE MODAL                           */}
      {/* ========================================== */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in text-left">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800">My Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-2xl">&times;</button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Display Name</label>
                <input required type="text" className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-800" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">New Password <span className="text-slate-400 font-normal">(Leave blank to keep current)</span></label>
                <input type="password" placeholder="••••••••" className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-800" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} />
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t pt-5">
                <button type="button" onClick={() => setShowProfileModal(false)} className="rounded-lg px-6 py-2 font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                <button type="submit" disabled={isUpdating} className="rounded-lg bg-[#d2f34c] px-6 py-2 font-bold text-slate-900 hover:bg-[#b8d839] transition-colors shadow-sm disabled:opacity-50">
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}