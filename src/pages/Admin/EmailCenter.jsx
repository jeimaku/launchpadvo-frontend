import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../../components/Sidebar'; 
import EmailSidebar from '../../components/EmailSidebar'; 
import NotificationBell from '../../components/NotificationBell'; // Added Import
import launchpadLogo from '../../assets/launchpad-logo2.png';
import md5 from 'md5'; 

// Import modular components
import EmailViewModal from '../../components/EmailViewModal'; 
import ComposeEmailModal from '../../components/ComposeEmailModal'; 

export default function EmailCenter() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('inbox'); 
  const [showComposeModal, setShowComposeModal] = useState(false);
  
  const [emailLogs, setEmailLogs] = useState([]);
  const [inboxEmails, setInboxEmails] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null); 
  
  // Custom Modals
  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, id: null, table: null });
  const [alertPrompt, setAlertPrompt] = useState({ isOpen: false, message: '', isError: false });

  const systemEmail = "lptest.renewal@gmail.com";

  // Role Check for Notification Bell
  const userRole = localStorage.getItem('userRole') || '';
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  const fetchEmails = async () => {
    setIsLoadingLogs(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };

      const [logsResponse, inboxResponse] = await Promise.all([
        fetch('http://localhost:5000/api/emails/logs', { headers }),
        fetch('http://localhost:5000/api/emails/inbox', { headers })
      ]);

      if (logsResponse.ok && inboxResponse.ok) {
        const logsData = await logsResponse.json();
        const inboxData = await inboxResponse.json();
        setEmailLogs(logsData);
        setInboxEmails(inboxData);
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    const socket = io('http://localhost:5000');
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
      const response = await fetch(`http://localhost:5000/api/emails/delete/${id}?table=${table}`, {
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

  const formatExactDateTime = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return new Date(dateString).toLocaleString('en-US', options);
  };

  const handleEmailClick = (email, isIncoming = false) => {
    let attachments = email.attachments || []; 
    if (typeof attachments === 'string') {
      try { attachments = JSON.parse(attachments); } catch (e) { attachments = []; }
    }
    if (isIncoming) {
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
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      <style>{`
        @keyframes modalPopIn {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-pop { animation: modalPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <Sidebar />

      <main className="flex-1 p-8 relative flex flex-col h-full overflow-hidden">
        {/* MODIFIED HEADER WITH NOTIFICATION BELL */}
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
          
          <EmailSidebar 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            onCompose={() => setShowComposeModal(true)}
            counts={{ inbox: inboxEmails.length, manual: manualLogs.length, automated: automatedLogs.length }} 
          />

          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-w-0 overflow-hidden">
            <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                {activeTab === 'inbox' && <><span className="w-4 h-4 rounded-full bg-blue-500 inline-block"></span> Inbox</>}
                {activeTab === 'manual' && <><span className="w-4 h-4 rounded-full bg-indigo-500 inline-block"></span> Sent Emails</>}
                {activeTab === 'automated' && <><span className="w-4 h-4 rounded-full bg-emerald-500 inline-block"></span> System Logs</>}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingLogs ? (
                <div className="flex justify-center items-center h-full text-slate-400 font-medium text-xl">Loading emails...</div>
              ) : activeTab === 'inbox' ? (
                inboxEmails.length === 0 ? (
                  <div className="text-center text-slate-400 font-medium py-16 text-xl">No incoming emails yet.</div>
                ) : (
                  inboxEmails.map((email) => {
                    const attachmentsList = parseAttachments(email.attachments);
                    return (
                    <div key={email.id} onClick={() => handleEmailClick(email, true)} className="flex items-start gap-6 p-6 border border-slate-100 rounded-3xl hover:bg-slate-50 hover:border-blue-200 transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-md">
                      <img 
                        src={getGravatarUrl(email.sender_email)} 
                        onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(email.sender_email, email.sender_name); }}
                        alt="Avatar" 
                        className="h-14 w-14 rounded-full object-cover shadow-sm border border-slate-200 shrink-0 mt-1" 
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-black text-slate-900 text-xl">
                            {email.sender_name && email.sender_name !== email.sender_email ? `${email.sender_name} ` : ''}
                            <span className="text-base font-semibold text-slate-500">&lt;{email.sender_email}&gt;</span>
                          </h4>
                          <span className="text-sm font-bold text-slate-400 whitespace-nowrap">{formatExactDateTime(email.received_at)}</span>
                        </div>
                        <h5 className="font-bold text-slate-800 text-lg mb-2">{email.subject}</h5>
                        <p className="text-slate-600 text-base leading-relaxed line-clamp-2">{getEmailSnippet(email.body)}</p>
                        
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex gap-3">
                            {attachmentsList.length > 0 && (
                              <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 text-sm font-bold px-4 py-1.5 rounded-xl border border-slate-200">
                                📎 {attachmentsList.length} Attachment{attachmentsList.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <button 
                            onClick={(e) => triggerDeletePrompt(email.id, 'inbox', e)} 
                            className="p-2.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm"
                            title="Move to Trash"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )})
                )
              ) : (
                (activeTab === 'manual' ? manualLogs : automatedLogs).length === 0 ? (
                  <div className="text-center text-slate-400 font-medium py-16 text-xl">No emails found.</div>
                ) : (
                  (activeTab === 'manual' ? manualLogs : automatedLogs).map((log) => {
                    const attachmentsList = parseAttachments(log.attachments);
                    return (
                    <div key={log.id} onClick={() => handleEmailClick(log, false)} className="flex items-start gap-6 p-6 border border-slate-100 rounded-3xl hover:bg-slate-50 hover:border-indigo-200 transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-md">
                      <div className="h-14 w-14 shrink-0 rounded-full border border-slate-200 shadow-sm bg-white p-1 mt-1">
                        <img src={getGravatarUrl(systemEmail)} onError={(e) => { e.target.onerror = null; e.target.src = getFallbackAvatar(systemEmail, 'Launchpad'); }} alt="System" className="h-full w-full object-contain rounded-full" />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                         <div className="flex justify-between items-start mb-1">
                          <h4 className="font-black text-slate-900 text-xl">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mr-2">Sent To:</span>
                            {log.recipient_email}
                          </h4>
                          <span className="text-sm font-bold text-slate-400 whitespace-nowrap">{formatExactDateTime(log.sent_at)}</span>
                        </div>
                        <h5 className="font-bold text-slate-800 text-lg mb-2">{log.subject}</h5>
                        <p className="text-slate-600 text-base leading-relaxed line-clamp-2">{getEmailSnippet(log.body)}</p>
                        
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex gap-3">
                             {attachmentsList.length > 0 && (
                              <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 text-sm font-bold px-4 py-1.5 rounded-xl border border-slate-200">
                                📎 {attachmentsList.length} Attachment{attachmentsList.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {activeTab === 'manual' && (
                            <button 
                              onClick={(e) => triggerDeletePrompt(log.id, 'logs', e)} 
                              className="p-2.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm"
                              title="Move to Trash"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )})
                )
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --- CUSTOM DIALOGS WITH POP-IN ANIMATION --- */}

      {deletePrompt.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 text-center border border-slate-100 animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6 text-red-500 text-4xl">🗑️</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Move to Trash?</h3>
            <p className="text-slate-600 font-medium mb-8">You can restore it later from the Recently Deleted section.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletePrompt({ isOpen: false, id: null, table: null })} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={executeSoftDelete} className="flex-1 px-5 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all">
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {alertPrompt.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 animate-modal-pop">
            <div className={`mx-auto flex items-center justify-center h-20 w-20 rounded-full mb-6 text-4xl ${alertPrompt.isError ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>
              {alertPrompt.isError ? '❌' : '✅'}
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{alertPrompt.isError ? 'Error' : 'Success'}</h3>
            <p className="text-slate-600 font-medium mb-8">{alertPrompt.message}</p>
            <button onClick={() => setAlertPrompt({ isOpen: false, message: '', isError: false })} className="w-full px-5 py-3 rounded-xl font-bold text-slate-900 bg-[#d2f34c] hover:bg-[#b8d839] shadow-lg shadow-[#d2f34c]/30 transition-all">
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