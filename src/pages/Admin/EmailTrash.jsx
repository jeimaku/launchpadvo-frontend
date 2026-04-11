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

  const systemEmail = "lptest.renewal@gmail.com";

  const userRole = localStorage.getItem('userRole') || '';
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  const fetchEmailCounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };

      const [logsResponse, inboxResponse] = await Promise.all([
        fetch(`${API_URL}/api/emails/logs`, { headers }),
        fetch(`${API_URL}/api/emails/inbox`, { headers })
      ]);

      if (logsResponse.ok && inboxResponse.ok) {
        const logsData = await logsResponse.json();
        const inboxData = await inboxResponse.json();
        
        setEmailCounts({
          inbox: inboxData.length,
          manual: logsData.filter(log => log.type === 'Manual').length,
          automated: logsData.filter(log => log.type === 'Automated').length
        });
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
      <main className="flex-1 p-8 relative flex flex-col h-full overflow-hidden">
        
        <div className="mb-6 shrink-0 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black text-slate-900">Email Center</h1>
            <p className="text-lg text-slate-500 mt-1 font-medium">Manage automated notifications and manual communications.</p>
          </div>
          <div className="flex items-center gap-4">
            {canViewNotifications && <NotificationBell />}
          </div>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
          <EmailSidebar onCompose={() => setShowComposeModal(true)} counts={emailCounts} />

          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-w-0 overflow-hidden">
            
            {/* Header Area with Search */}
            <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-3xl">🗑️</span> Recently Deleted
              </h2>

              {/* NEW: Search Input */}
              <div className="relative w-full max-w-md ml-auto">
                <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input 
                  type="text" 
                  placeholder="Search trash..." 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {filteredTrash.length === 0 && !loading ? (
                <div className="text-center text-slate-400 font-medium py-16 flex flex-col items-center justify-center">
                  <svg className="w-16 h-16 text-slate-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <p className="text-xl text-slate-500 font-bold mb-1">
                    {searchTerm ? "No matching emails found in trash." : "No deleted emails found."}
                  </p>
                </div>
              ) : (
                filteredTrash.map((item) => (
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
                    className="flex items-start gap-6 p-6 border border-slate-100 rounded-3xl hover:bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer group shadow-sm"
                  >
                    {item.source === 'logs' ? (
                      <div className="h-14 w-14 shrink-0 rounded-full border border-slate-200 shadow-sm bg-white p-1 mt-1">
                        <img src={getGravatarUrl(systemEmail)} onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(systemEmail, 'Launchpad'); }} alt="System" className="h-full w-full object-contain rounded-full" />
                      </div>
                    ) : (
                      <img 
                        src={getGravatarUrl(item.sender)} 
                        onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(item.sender, item.sender); }}
                        alt="Avatar" 
                        className="h-14 w-14 rounded-full object-cover shadow-sm border border-slate-200 shrink-0 mt-1" 
                      />
                    )}

                    <div className="flex flex-col flex-1 min-w-0">
                       <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-slate-900 text-xl flex items-center gap-3 truncate">
                          <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border shrink-0 ${
                            item.source === 'logs' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-blue-50 text-blue-600 border-blue-200'
                          }`}>
                            {item.source === 'logs' ? 'Sent Mail' : 'Inbox'}
                          </span>
                          {item.source === 'logs' ? (
                            <>
                              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mr-1">Sent To:</span>
                              <span className="truncate">{item.recipient}</span>
                            </>
                          ) : (
                            <span className="truncate">{item.sender}</span>
                          )}
                        </h4>
                        <span className="text-sm font-bold text-slate-400 whitespace-nowrap ml-4 mt-1">
                          Deleted {formatExactDateTime(item.deleted_at)}
                        </span>
                      </div>
                      <h5 className="font-bold text-slate-800 text-lg mb-2">{item.subject}</h5>
                      <p className="text-slate-600 text-base leading-relaxed line-clamp-2">{getEmailSnippet(item.body)}</p>
                    </div>
                    
                    <div className="flex flex-col gap-2.5 shrink-0 ml-4 pl-6 border-l border-slate-100 justify-center min-h-[80px]">
                      <button 
                        onClick={(e) => triggerRestore(item.id, item.source, e)} 
                        className="w-full px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-emerald-500 hover:text-white hover:border-emerald-600 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-sm"
                        title="Restore Email"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        Restore
                      </button>
                      <button 
                        onClick={(e) => triggerPermanentDelete(item.id, item.source, e)} 
                        className="w-full px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-rose-500 hover:text-white hover:border-rose-600 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-sm"
                        title="Delete Permanently"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
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