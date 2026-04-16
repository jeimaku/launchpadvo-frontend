import { useState, useEffect } from 'react';
import { io } from 'socket.io-client'; 
import md5 from 'md5'; 
import Sidebar from '../../components/Sidebar';
import EmailSidebar from '../../components/EmailSidebar';
import ComposeEmailModal from '../../components/ComposeEmailModal'; 
import NotificationBell from '../../components/NotificationBell'; 
import EmailViewModal from '../../components/EmailViewModal';
import launchpadLogo from '../../assets/launchpad-logo2.png';

const API_URL = `http://${window.location.hostname}:5000`;

export default function EmailTrash() {
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  
  const [emailCounts, setEmailCounts] = useState({ inbox: 0, manual: 0, automated: 0 });

  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, id: null, table: null });
  const [restorePrompt, setRestorePrompt] = useState({ isOpen: false, id: null, table: null });
  const [alertPrompt, setAlertPrompt] = useState({ isOpen: false, message: '', isError: false });

  // NEW: Search State
  const [searchTerm, setSearchTerm] = useState('');

  const [systemEmail, setSystemEmail] = useState("");

  const userRole = localStorage.getItem('userRole') || '';
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  const fetchEmailCounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };

      // --- NEW: Fetch logs, inbox, AND the system email config all at once ---
      const [logsResponse, inboxResponse, configResponse] = await Promise.all([
        fetch(`${API_URL}/api/emails/logs`, { headers }),
        fetch(`${API_URL}/api/emails/inbox`, { headers }),
        fetch(`${API_URL}/api/emails/config`, { headers })
      ]);

      if (logsResponse.ok && inboxResponse.ok && configResponse.ok) {
        const logsData = await logsResponse.json();
        const inboxData = await inboxResponse.json();
        const configData = await configResponse.json();
        
        setEmailCounts({
          inbox: inboxData.length,
          manual: logsData.filter(log => log.type === 'Manual').length,
          automated: logsData.filter(log => log.type === 'Automated').length
        });
        
        setSystemEmail(configData.systemEmail); // Save the dynamic email to state
      }
    } catch (error) {
      console.error('Error fetching email counts:', error);
    }
  };

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/emails/trash`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      const data = await response.json();
      setTrashItems(data);
    } catch (error) {
      console.error("Error fetching trash:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchTrash(); 
    fetchEmailCounts(); 

    const socket = io(API_URL);
    socket.on('incoming_email', () => {
      fetchEmailCounts();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const triggerRestore = (id, table, e) => {
    e.stopPropagation();
    setRestorePrompt({ isOpen: true, id, table });
  };

  const executeRestore = async () => {
    const { id, table } = restorePrompt;
    if (!id || !table) return;

    try {
      const response = await fetch(`${API_URL}/api/emails/restore/${id}?table=${table}`, { 
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) { 
        setAlertPrompt({ isOpen: true, message: "Server failed to restore the email.", isError: true });
        setRestorePrompt({ isOpen: false, id: null, table: null });
        return; 
      }
      
      if (selectedEmail && selectedEmail.id === id) { setSelectedEmail(null); }
      setRestorePrompt({ isOpen: false, id: null, table: null });
      setAlertPrompt({ isOpen: true, message: "Email successfully restored!", isError: false });
      fetchTrash(); 
      fetchEmailCounts(); 
    } catch (err) { 
      setAlertPrompt({ isOpen: true, message: "Network Error: Could not restore email.", isError: true });
      setRestorePrompt({ isOpen: false, id: null, table: null });
    }
  };

  const triggerPermanentDelete = (id, table, e) => {
    e.stopPropagation();
    setDeletePrompt({ isOpen: true, id, table });
  };

  const executePermanentDelete = async () => {
    const { id, table } = deletePrompt;
    if (!id || !table) return;

    try {
      const response = await fetch(`${API_URL}/api/emails/permanent/${id}?table=${table}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) { 
        setAlertPrompt({ isOpen: true, message: "Server failed to delete the email permanently.", isError: true });
        setDeletePrompt({ isOpen: false, id: null, table: null });
        return; 
      }
      
      if (selectedEmail && selectedEmail.id === id) { setSelectedEmail(null); }
      setDeletePrompt({ isOpen: false, id: null, table: null });
      setAlertPrompt({ isOpen: true, message: "Email permanently deleted.", isError: false });
      fetchTrash(); 
    } catch (err) { 
      setAlertPrompt({ isOpen: true, message: "Network Error: Could not delete email.", isError: true });
      setDeletePrompt({ isOpen: false, id: null, table: null });
    }
  };

  // NEW: Search Filtering Logic
  const filteredTrash = trashItems.filter(e => 
    e.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.recipient.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEmailSnippet = (htmlString) => {
    if (!htmlString) return '';
    let text = htmlString.replace(/<[^>]*>?/gm, ' ');
    return text.replace(/\s+/g, ' ').trim().substring(0, 120) + '...';
  };

  const formatExactDateTime = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleString('en-US', options);
  };

  const formatShortDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getGravatarUrl = (email) => {
    if (email === systemEmail) return launchpadLogo;
    return `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?s=128&d=mp`;
  };

  const getFallbackAvatar = (email, name) => {
    if (email === systemEmail) return launchpadLogo;
    const displayName = name && name !== email ? name : email.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&rounded=true&bold=true&size=128`;
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      
      <style>{`
        @keyframes modalPopIn {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-pop { animation: modalPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <Sidebar />
      <main className="flex-1 p-6 md:p-8 relative flex flex-col h-full overflow-hidden">
        
        {/* Header Section */}
        <div className="mb-6 shrink-0 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Email Center</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">Manage automated notifications and manual communications.</p>
          </div>
          <div className="flex items-center gap-4">
            {canViewNotifications && <NotificationBell />}
          </div>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
          <EmailSidebar onCompose={() => setShowComposeModal(true)} counts={emailCounts} />

          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-w-0 overflow-hidden">
            
            {/* Top Toolbar with Search */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shrink-0 z-10">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                Recently Deleted
              </h2>

              <div className="relative w-full sm:w-80">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input 
                  type="text" 
                  placeholder="Search trash..." 
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Email List Area */}
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar relative">
              {filteredTrash.length === 0 && !loading ? (
                <div className="text-center text-slate-400 font-medium py-20 flex flex-col items-center justify-center h-full">
                  <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <p className="text-base text-slate-600 font-semibold mb-1">
                    {searchTerm ? "No matching emails found in trash." : "No deleted emails found."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTrash.map((item) => (
                    <div 
                      key={`${item.source}-${item.id}`} 
                      onClick={() => setSelectedEmail({ 
                        ...item, 
                        isIncoming: item.source === 'inbox',
                        sent_at: item.created_at, 
                        sender_email: item.sender, 
                        sender_name: item.sender,
                        recipient_email: item.recipient
                      })} 
                      className="group flex flex-col sm:flex-row sm:items-center px-4 py-3 sm:px-6 sm:py-3 hover:bg-slate-50 cursor-pointer transition-colors relative"
                    >
                      {/* Hover Actions (Slide in from right) */}
                      <div className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 items-center gap-2 bg-slate-50 pl-4 py-2 transition-opacity duration-200 shadow-[-10px_0_10px_rgba(248,250,252,1)] z-10">
                        <button 
                          onClick={(e) => triggerRestore(item.id, item.source, e)} 
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors bg-white border border-slate-200 shadow-sm"
                          title="Restore Email"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                        </button>
                        <button 
                          onClick={(e) => triggerPermanentDelete(item.id, item.source, e)} 
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors bg-white border border-slate-200 shadow-sm"
                          title="Delete Permanently"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>

                      {/* Avatar Column */}
                      <div className="flex items-center gap-3 w-full sm:w-56 md:w-64 shrink-0 pr-4 mb-2 sm:mb-0">
                        {item.source === 'logs' ? (
                          <div className="h-8 w-8 shrink-0 rounded-full border border-slate-200 bg-white p-0.5">
                            <img src={getGravatarUrl(systemEmail)} onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(systemEmail, 'Launchpad'); }} alt="System" className="h-full w-full object-contain rounded-full" />
                          </div>
                        ) : (
                          <img 
                            src={getGravatarUrl(item.sender)} 
                            onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(item.sender, item.sender); }}
                            alt="Avatar" 
                            className="h-8 w-8 rounded-full object-cover shrink-0 border border-slate-200" 
                          />
                        )}
                        
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {item.source === 'logs' ? item.recipient : item.sender.split('@')[0]}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                            {item.source === 'logs' ? 'Sent Mail' : 'Inbox'}
                          </span>
                        </div>
                      </div>

                      {/* Subject & Snippet Column */}
                      <div className="flex-1 flex items-center min-w-0 pr-2 sm:pr-24">
                        <div className="truncate text-sm flex-1">
                          <span className="font-medium text-slate-800 mr-2">{item.subject}</span>
                          <span className="text-slate-400 font-normal hidden md:inline">
                            <span className="mr-1">-</span>
                            {getEmailSnippet(item.body)}
                          </span>
                        </div>
                      </div>

                      {/* Metadata Column (Date) */}
                      <div className="flex items-center gap-4 shrink-0 sm:w-24 justify-end mt-2 sm:mt-0">
                        <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors whitespace-nowrap text-right" title={`Deleted: ${formatExactDateTime(item.deleted_at)}`}>
                           {formatShortDate(item.deleted_at)}
                        </span>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Minimal Footer */}
            <div className="px-6 py-2 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-400 font-medium z-10">
              <span>{filteredTrash.length} {filteredTrash.length === 1 ? 'email' : 'emails'}</span>
            </div>

          </div>
        </div>
      </main>

      {restorePrompt.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 text-center border border-slate-100 animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mb-6 text-emerald-500 text-4xl shadow-inner">♻️</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Restore Email?</h3>
            <p className="text-slate-600 font-medium mb-8">This email will be moved back to its original folder and will no longer be in the trash.</p>
            <div className="flex gap-3">
              <button onClick={() => setRestorePrompt({ isOpen: false, id: null, table: null })} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={executeRestore} className="flex-1 px-5 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]">
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {deletePrompt.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 text-center border border-slate-100 animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6 text-red-500 text-4xl shadow-inner">⚠️</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Permanently?</h3>
            <p className="text-slate-600 font-medium mb-8">This action cannot be undone. This email will be permanently removed from the server.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletePrompt({ isOpen: false, id: null, table: null })} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={executePermanentDelete} className="flex-1 px-5 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]">
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {alertPrompt.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 animate-modal-pop">
            <div className={`mx-auto flex items-center justify-center h-20 w-20 rounded-full mb-6 text-4xl shadow-inner ${alertPrompt.isError ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>
              {alertPrompt.isError ? '❌' : '✅'}
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{alertPrompt.isError ? 'Error' : 'Success'}</h3>
            <p className="text-slate-600 font-medium mb-8">{alertPrompt.message}</p>
            <button onClick={() => setAlertPrompt({ isOpen: false, message: '', isError: false })} className="w-full px-5 py-3 rounded-xl font-bold text-slate-900 bg-[#d2f34c] hover:bg-[#b8d839] shadow-lg shadow-[#d2f34c]/30 transition-all hover:scale-[1.02]">
              Got it
            </button>
          </div>
        </div>
      )}

      <EmailViewModal 
        email={selectedEmail} 
        onClose={() => setSelectedEmail(null)} 
        formatExactDateTime={formatExactDateTime} 
        systemEmail={systemEmail} 
      />

      {showComposeModal && (
        <ComposeEmailModal 
          onClose={() => setShowComposeModal(false)} 
          onSendSuccess={(msg) => { 
            setAlertPrompt({ isOpen: true, message: msg, isError: false }); 
            setShowComposeModal(false); 
            fetchEmailCounts(); 
          }} 
        />
      )}
    </div>
  );
}