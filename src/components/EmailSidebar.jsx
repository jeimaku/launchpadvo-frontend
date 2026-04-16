import { useNavigate, useLocation } from 'react-router-dom';

export default function EmailSidebar({ activeTab, onTabChange, counts = {}, onCompose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (tab) => {
    if (['inbox', 'manual', 'automated'].includes(tab)) {
      if (!location.pathname.includes('/email-center')) {
        navigate('/email-center', { state: { tab } });
      } else {
        if (onTabChange) onTabChange(tab);
      }
    } 
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
    // Reduced width to w-56 and tightened paddings/margins
    <div className="w-56 shrink-0 flex flex-col gap-1.5 overflow-y-auto pb-4 pr-5 border-r border-slate-200/60 mr-2">
      
      {/* Compose Button - Compact and sharp */}
      <button 
        onClick={onCompose} 
        className="mb-5 w-full flex items-center justify-center gap-2 bg-[#d2f34c] hover:bg-[#b8d839] text-slate-900 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        Compose
      </button>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-1">
        
        {/* Inbox */}
        <button 
          onClick={() => handleNavigation('inbox')} 
          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg font-semibold transition-colors text-sm border ${
            isActive('inbox') 
              ? 'bg-blue-50 text-blue-700 shadow-sm border-blue-100/50' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            Inbox
          </div>
          {counts.inbox > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${isActive('inbox') ? 'bg-blue-200/50 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>{counts.inbox}</span>
          )}
        </button>

        {/* Sent (Manual) */}
        <button 
          onClick={() => handleNavigation('manual')} 
          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg font-semibold transition-colors text-sm border ${
            isActive('manual') 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm border-indigo-100/50' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            Sent Emails
          </div>
          {counts.manual > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${isActive('manual') ? 'bg-indigo-200/50 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>{counts.manual}</span>
          )}
        </button>

        {/* Automated Logs */}
        <button 
          onClick={() => handleNavigation('automated')} 
          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg font-semibold transition-colors text-sm border ${
            isActive('automated') 
              ? 'bg-emerald-50 text-emerald-700 shadow-sm border-emerald-100/50' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            System Logs
          </div>
          {counts.automated > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${isActive('automated') ? 'bg-emerald-200/50 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{counts.automated}</span>
          )}
        </button>

        <div className="my-3 border-t border-slate-200/80 mx-2"></div>

        {/* Template Library Page */}
        <button 
          onClick={() => handleNavigation('templates')} 
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg font-semibold transition-colors text-sm border ${
            isActive('templates') 
              ? 'bg-purple-50 text-purple-700 shadow-sm border-purple-100/50' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          Templates
        </button>

        {/* View Trash Page */}
        <button 
          onClick={() => handleNavigation('trash')} 
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg font-semibold transition-colors text-sm border ${
            isActive('trash') 
              ? 'bg-rose-50 text-rose-700 shadow-sm border-rose-100/50' 
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          Trash Bin
        </button>

      </nav>
    </div>
  );
}