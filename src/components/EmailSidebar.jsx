import { useNavigate, useLocation } from 'react-router-dom';

export default function EmailSidebar({ activeTab, onTabChange, counts = {}, onCompose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (tab) => {
    // If clicking a main tab (Inbox, Sent, Automated)
    if (['inbox', 'manual', 'automated'].includes(tab)) {
      if (!location.pathname.includes('/email-center')) {
        // If not on the Email Center page, navigate there and pass the target tab in state
        navigate('/email-center', { state: { tab } });
      } else {
        // If already on the page, just change the active tab state
        if (onTabChange) onTabChange(tab);
      }
    } 
    // If clicking dedicated pages
    else if (tab === 'templates') {
      navigate('/email-templates');
    } else if (tab === 'trash') {
      navigate('/email-trash');
    }
  };

  const isActive = (tab) => {
    if (tab === 'templates') return location.pathname.includes('/email-templates');
    if (tab === 'trash') return location.pathname.includes('/email-trash');
    return location.pathname.includes('/email-center') && activeTab === tab;
  };

  return (
    <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto pb-4 pr-4 border-r border-slate-200/60 mr-2">
      
      {/* Compose Button */}
      <button 
        onClick={onCompose} 
        className="mb-6 flex items-center justify-center gap-3 bg-[#c4ea21] hover:bg-[#b8d839] text-slate-900 px-6 py-4 rounded-2xl font-black shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.03] active:scale-95 text-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        Compose
      </button>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-2">
        
        {/* Inbox */}
        <button 
          onClick={() => handleNavigation('inbox')} 
          className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-[1.03] text-lg ${
            isActive('inbox') 
              ? 'bg-blue-100 text-blue-800 shadow-sm hover:brightness-105' 
              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
          }`}
        >
          <div className="flex items-center gap-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            Inbox
          </div>
          {counts.inbox > 0 && (
            <span className={`text-sm px-2.5 py-0.5 rounded-full ${isActive('inbox') ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-700'}`}>{counts.inbox}</span>
          )}
        </button>

        {/* Sent (Manual) */}
        <button 
          onClick={() => handleNavigation('manual')} 
          className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-[1.03] text-lg ${
            isActive('manual') 
              ? 'bg-indigo-100 text-indigo-800 shadow-sm hover:brightness-105' 
              : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          <div className="flex items-center gap-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            Sent Emails
          </div>
          {counts.manual > 0 && (
            <span className={`text-sm px-2.5 py-0.5 rounded-full ${isActive('manual') ? 'bg-indigo-200 text-indigo-900' : 'bg-slate-200 text-slate-700'}`}>{counts.manual}</span>
          )}
        </button>

        {/* Automated Logs */}
        <button 
          onClick={() => handleNavigation('automated')} 
          className={`flex items-center justify-between w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-[1.03] text-lg ${
            isActive('automated') 
              ? 'bg-emerald-100 text-emerald-800 shadow-sm hover:brightness-105' 
              : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
          }`}
        >
          <div className="flex items-center gap-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            System Logs
          </div>
          {counts.automated > 0 && (
            <span className={`text-sm px-2.5 py-0.5 rounded-full ${isActive('automated') ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}>{counts.automated}</span>
          )}
        </button>

        <div className="my-4 border-t border-slate-200/80 mx-4"></div>

        {/* Template Library Page */}
        <button 
          onClick={() => handleNavigation('templates')} 
          className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-[1.03] text-lg ${
            isActive('templates') 
              ? 'bg-purple-100 text-purple-800 shadow-sm' 
              : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          Template Library
        </button>

        {/* View Trash Page */}
        <button 
          onClick={() => handleNavigation('trash')} 
          className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl font-bold transition-all duration-300 transform hover:scale-[1.03] text-lg ${
            isActive('trash') 
              ? 'bg-red-100 text-red-800 shadow-sm' 
              : 'text-slate-600 hover:bg-red-50 hover:text-red-700'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          Trash Bin
        </button>

      </nav>
    </div>
  );
}