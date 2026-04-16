import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../../components/Sidebar'; 
import EmailSidebar from '../../components/EmailSidebar'; 
import NotificationBell from '../../components/NotificationBell'; 
import launchpadLogo from '../../assets/launchpad-logo2.png';
import md5 from 'md5'; 

import EmailViewModal from '../../components/EmailViewModal'; 
import ComposeEmailModal from '../../components/ComposeEmailModal'; 

export default function EmailCenter() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('inbox'); 
  const [showComposeModal, setShowComposeModal] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  const [emailLogs, setEmailLogs] = useState([]);
  const [inboxEmails, setInboxEmails] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null); 
  
  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, id: null, table: null });
  const [alertPrompt, setAlertPrompt] = useState({ isOpen: false, message: '', isError: false });

  const [systemEmail, setSystemEmail] = useState("");

  const userRole = localStorage.getItem('userRole') || '';
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  // Clear search term when switching tabs
  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  const fetchEmails = async () => {
    setIsLoadingLogs(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };

      const [logsResponse, inboxResponse, configResponse] = await Promise.all([
        fetch(`http://${window.location.hostname}:5000/api/emails/logs`, { headers }),
        fetch(`http://${window.location.hostname}:5000/api/emails/inbox`, { headers }),
        fetch(`http://${window.location.hostname}:5000/api/emails/config`, { headers })
      ]);

      if (logsResponse.ok && inboxResponse.ok && configResponse.ok) {
        const logsData = await logsResponse.json();
        const inboxData = await inboxResponse.json();
        const configData = await configResponse.json();
        
        setEmailLogs(logsData);
        setInboxEmails(inboxData);
        setSystemEmail(configData.systemEmail); 
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    const socket = io(`http://${window.location.hostname}:5000`);
    socket.on('incoming_email', () => {
      const currentRole = localStorage.getItem('userRole');
      if (['admin', 'manager', 'staff'].includes(currentRole)) {
        fetchEmails(); 
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const triggerDeletePrompt = (id, table, e) => {
    e.stopPropagation(); 
    setDeletePrompt({ isOpen: true, id, table });
  };

  const executeSoftDelete = async () => {
    const { id, table } = deletePrompt;
    if (!id || !table) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/emails/delete/${id}?table=${table}`, {
        method: 'PUT', 
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      
      if (response.ok) {
        fetchEmails(); 
        setDeletePrompt({ isOpen: false, id: null, table: null }); 
      } else {
        setAlertPrompt({ isOpen: true, message: "Failed to move email to trash.", isError: true });
        setDeletePrompt({ isOpen: false, id: null, table: null });
      }
    } catch (error) { 
      setAlertPrompt({ isOpen: true, message: "Network Error.", isError: true });
      setDeletePrompt({ isOpen: false, id: null, table: null });
    }
  };

  const manualLogs = emailLogs.filter(log => log.type === 'Manual');
  const automatedLogs = emailLogs.filter(log => log.type === 'Automated');

  const filteredInbox = inboxEmails.filter(e => 
    e.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.sender_email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.sender_name && e.sender_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredManual = manualLogs.filter(e => 
    e.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.recipient_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAutomated = automatedLogs.filter(e => 
    e.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.recipient_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentFilteredData = activeTab === 'inbox' ? filteredInbox : (activeTab === 'manual' ? filteredManual : filteredAutomated);

  const formatShortDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatExactDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleEmailClick = (email, isInbox = false) => {
    let attachments = email.attachments || []; 
    if (typeof attachments === 'string') {
      try { attachments = JSON.parse(attachments); } catch (e) { attachments = []; }
    }
    if (isInbox) {
      setSelectedEmail({
        subject: email.subject, sender_email: email.sender_email, sender_name: email.sender_name,
        sent_at: email.received_at, body: email.body, attachments: attachments, isIncoming: true
      });
    } else {
      setSelectedEmail({ ...email, attachments: attachments, isIncoming: false });
    }
  };

  const getEmailSnippet = (htmlString) => {
    if (!htmlString) return '';
    let text = htmlString.replace(/<[^>]*>?/gm, ' ');
    return text.replace(/\s+/g, ' ').trim();
  };

  const getGravatarUrl = (email) => {
    if (email === systemEmail) return launchpadLogo;
    return `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?s=128&d=404`;
  };

  const getFallbackAvatar = (email, name) => {
    if (email === systemEmail) return launchpadLogo;
    const displayName = name && name !== email ? name : email.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&rounded=true&bold=true&size=128`;
  };

  const parseAttachments = (attachmentString) => {
    if (!attachmentString) return [];
    if (typeof attachmentString !== 'string') return attachmentString;
    try { return JSON.parse(attachmentString); } catch(e) { return []; }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">

      <style>{`
        @keyframes modalPopIn {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-pop { animation: modalPopIn 0.2s ease-out forwards; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
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
          
          <EmailSidebar 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            onCompose={() => setShowComposeModal(true)}
            counts={{ inbox: inboxEmails.length, manual: manualLogs.length, automated: automatedLogs.length }} 
          />

          {/* MAIN INBOX CONTAINER */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-w-0 overflow-hidden">
            
            {/* Top Toolbar */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shrink-0 z-10">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                {activeTab === 'inbox' && <><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Inbox</>}
                {activeTab === 'manual' && <><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span> Sent Emails</>}
                {activeTab === 'automated' && <><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> System Logs</>}
              </h2>

              <div className="relative w-full sm:w-80">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input 
                  type="text" 
                  placeholder="Search emails..." 
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
              {isLoadingLogs ? (
                <div className="flex justify-center items-center h-full text-slate-400 font-medium text-sm">
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                    Loading emails...
                  </span>
                </div>
              ) : currentFilteredData.length === 0 ? (
                <div className="text-center text-slate-400 font-medium py-20 flex flex-col items-center justify-center h-full">
                  <svg className="w-12 h-12 text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                  <p className="text-base text-slate-600 font-semibold mb-1">
                    {searchTerm ? "No matching emails found." : "Your inbox is empty."}
                  </p>
                  {searchTerm && <p className="text-xs text-slate-400">Try adjusting your search for "{searchTerm}".</p>}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {currentFilteredData.map((email) => {
                    const isInbox = activeTab === 'inbox';
                    const attachmentsList = parseAttachments(email.attachments);
                    
                    return (
                      <div 
                        key={email.id} 
                        onClick={() => handleEmailClick(email, isInbox)} 
                        className="group flex flex-col sm:flex-row sm:items-center px-4 py-3 sm:px-6 sm:py-3 hover:bg-slate-50 cursor-pointer transition-colors relative"
                      >
                        
                        {/* Hover Actions (Slide in from right) */}
                        {(isInbox || activeTab === 'manual') && (
                          <div className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 items-center gap-2 bg-slate-50 pl-4 py-2 transition-opacity duration-200 shadow-[-10px_0_10px_rgba(248,250,252,1)] z-10">
                            <button 
                              onClick={(e) => triggerDeletePrompt(email.id, isInbox ? 'inbox' : 'logs', e)} 
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors bg-white border border-slate-200 shadow-sm"
                              title="Move to Trash"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          </div>
                        )}

                        {/* Avatar Column */}
                        <div className="flex items-center gap-3 w-full sm:w-56 md:w-64 shrink-0 pr-4 mb-2 sm:mb-0">
                          {isInbox ? (
                            <img 
                              src={getGravatarUrl(email.sender_email)} 
                              onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(email.sender_email, email.sender_name); }}
                              alt="Avatar" 
                              className="h-8 w-8 rounded-full object-cover shrink-0 border border-slate-200" 
                            />
                          ) : (
                            <div className="h-8 w-8 shrink-0 rounded-full border border-slate-200 bg-white p-0.5">
                              <img src={getGravatarUrl(systemEmail)} onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(systemEmail, 'Launchpad'); }} alt="System" className="h-full w-full object-contain rounded-full" />
                            </div>
                          )}
                          
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {isInbox 
                                ? (email.sender_name && email.sender_name !== email.sender_email ? email.sender_name : email.sender_email.split('@')[0]) 
                                : email.recipient_email}
                            </span>
                            {!isInbox && (
                              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Sent To</span>
                            )}
                          </div>
                        </div>

                        {/* Subject & Snippet Column */}
                        <div className="flex-1 flex items-center min-w-0 pr-2 sm:pr-24">
                          <div className="truncate text-sm flex-1">
                            <span className="font-medium text-slate-800 mr-2">{email.subject}</span>
                            <span className="text-slate-400 font-normal hidden md:inline">
                              <span className="mr-1">-</span>
                              {getEmailSnippet(email.body)}
                            </span>
                          </div>
                        </div>

                        {/* Metadata Column (Icons & Date) */}
                        <div className="flex items-center gap-4 shrink-0 sm:w-24 justify-end mt-2 sm:mt-0">
                          {attachmentsList.length > 0 && (
                            <div className="flex items-center text-slate-400" title={`${attachmentsList.length} attachment(s)`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            </div>
                          )}
                          <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors whitespace-nowrap text-right">
                            {formatShortDate(email.received_at || email.sent_at)}
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Minimal Footer */}
            <div className="px-6 py-2 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-400 font-medium">
              <span>{currentFilteredData.length} {currentFilteredData.length === 1 ? 'email' : 'emails'}</span>
            </div>

          </div>
        </div>
      </main>

      {/* --- CUSTOM DIALOGS --- */}
      {deletePrompt.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center border border-slate-100 animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 mb-4 text-red-500 text-2xl">🗑️</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Move to Trash?</h3>
            <p className="text-slate-500 text-sm mb-6">You can restore it later from the Recently Deleted section.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletePrompt({ isOpen: false, id: null, table: null })} className="flex-1 px-4 py-2 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={executeSoftDelete} className="flex-1 px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 transition-colors text-sm">
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {alertPrompt.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center border border-slate-100 animate-modal-pop">
            <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 text-3xl ${alertPrompt.isError ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
              {alertPrompt.isError ? '❌' : '✅'}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{alertPrompt.isError ? 'Error' : 'Success'}</h3>
            <p className="text-slate-500 text-sm mb-6">{alertPrompt.message}</p>
            <button onClick={() => setAlertPrompt({ isOpen: false, message: '', isError: false })} className="w-full px-4 py-2 rounded-lg font-bold text-slate-900 bg-[#d2f34c] hover:bg-[#b8d839] transition-colors text-sm">
              Got it
            </button>
          </div>
        </div>
      )}

      <EmailViewModal email={selectedEmail} onClose={() => setSelectedEmail(null)} formatExactDateTime={formatExactDateTime} systemEmail={systemEmail} />

      {showComposeModal && (
        <ComposeEmailModal 
          onClose={() => setShowComposeModal(false)} 
          onSendSuccess={(msg) => { 
            setAlertPrompt({ isOpen: true, message: msg, isError: false }); 
            setShowComposeModal(false); 
            setActiveTab('manual'); 
            fetchEmails(); 
          }} 
        />
      )}
    </div>
  );
}