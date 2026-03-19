import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import EmailSidebar from '../../components/EmailSidebar';
import ComposeEmailModal from '../../components/ComposeEmailModal'; 

export default function EmailTrash() {
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showComposeModal, setShowComposeModal] = useState(false);

  // --- Dialog States ---
  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, id: null, table: null });
  const [restorePrompt, setRestorePrompt] = useState({ isOpen: false, id: null, table: null }); // <-- NEW
  const [alertPrompt, setAlertPrompt] = useState({ isOpen: false, message: '', isError: false });

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/emails/trash', {
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

  useEffect(() => { fetchTrash(); }, []);

  // --- NEW: Trigger Restore Prompt ---
  const triggerRestore = (id, table, e) => {
    e.stopPropagation();
    setRestorePrompt({ isOpen: true, id, table });
  };

  // --- NEW: Execute Restore after confirmation ---
  const executeRestore = async () => {
    const { id, table } = restorePrompt;
    if (!id || !table) return;

    try {
      const response = await fetch(`http://localhost:5000/api/emails/restore/${id}?table=${table}`, { 
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
      const response = await fetch(`http://localhost:5000/api/emails/permanent/${id}?table=${table}`, { 
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

  const getEmailSnippet = (htmlString) => {
    if (!htmlString) return '';
    let text = htmlString.replace(/<[^>]*>?/gm, ' ');
    return text.replace(/\s+/g, ' ').trim().substring(0, 80) + '...';
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      
      {/* GLOBAL MODAL ANIMATION STYLES */}
      <style>{`
        @keyframes modalPopIn {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-pop { animation: modalPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <Sidebar />
      <main className="flex-1 p-8 relative flex flex-col h-full overflow-hidden">
        
        <div className="mb-6 shrink-0">
          <h1 className="text-4xl font-black text-slate-900">Email Center</h1>
          <p className="text-lg text-slate-500 mt-1 font-medium">Manage automated notifications and manual communications.</p>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
          <EmailSidebar onCompose={() => setShowComposeModal(true)} />

          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-w-0 overflow-hidden">
            <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <span className="text-3xl">🗑️</span> Recently Deleted
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {trashItems.length === 0 && !loading ? (
                <div className="p-16 flex flex-col items-center justify-center text-center">
                  <div className="bg-slate-50 p-6 rounded-full mb-4 text-6xl">🗑️</div>
                  <h3 className="text-2xl font-black text-slate-700">Trash is Empty</h3>
                  <p className="text-slate-500 font-medium mt-1 text-lg">No deleted emails found.</p>
                </div>
              ) : (
                trashItems.map((item) => (
                  <div key={`${item.source}-${item.id}`} onClick={() => setSelectedEmail(item)} className="flex items-start gap-6 p-6 border border-slate-100 rounded-3xl hover:bg-slate-50 hover:border-red-200 transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-md">
                    <div className="flex flex-col flex-1 min-w-0">
                       <div className="flex justify-between items-start mb-2">
                        <span className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-xl border ${
                          item.source === 'logs' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {item.source === 'logs' ? 'Sent Mail' : 'Inbox'}
                        </span>
                        <span className="text-sm font-bold text-slate-400">
                          Deleted on {new Date(item.deleted_at).toLocaleString([], { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="font-black text-slate-900 text-xl mb-1">{item.subject}</h4>
                      <p className="text-slate-600 text-base leading-relaxed line-clamp-2">{getEmailSnippet(item.body)}</p>
                      
                      <div className="mt-4 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => triggerRestore(item.id, item.source, e)} className="px-5 py-2.5 bg-[#d2f34c] text-slate-900 rounded-xl font-bold shadow-sm hover:bg-[#b8d839] hover:-translate-y-0.5 transition-all flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                          Restore
                        </button>
                        <button onClick={(e) => triggerPermanentDelete(item.id, item.source, e)} className="px-5 py-2.5 bg-red-100 text-red-700 rounded-xl font-bold shadow-sm hover:bg-red-200 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete Forever
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --- Email Preview Modal --- */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-modal-pop">
            <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div className="flex-1 pr-6">
                <h2 className="text-3xl font-black text-slate-900 leading-tight mb-4">{selectedEmail.subject}</h2>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-base font-medium text-slate-600 space-y-2">
                  <div className="flex"><span className="w-20 text-slate-400 font-bold">From:</span> <span className="text-slate-900">{selectedEmail.sender || 'Unknown'}</span></div>
                  <div className="flex"><span className="w-20 text-slate-400 font-bold">To:</span> <span className="text-slate-900">{selectedEmail.recipient || 'Unknown'}</span></div>
                  <div className="flex"><span className="w-20 text-slate-400 font-bold">Date:</span> <span className="text-slate-900">{new Date(selectedEmail.created_at).toLocaleString()}</span></div>
                </div>
              </div>
              <button onClick={() => setSelectedEmail(null)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-full transition-colors bg-white border border-slate-200 shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 bg-white">
              {selectedEmail.body ? (
                <div className="prose prose-slate prose-lg max-w-none prose-a:text-[#b8d839]" dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
              ) : (
                <p className="text-slate-400 italic text-lg">No content available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM DIALOGS --- */}

      {/* 1. Restore Confirmation Modal */}
      {restorePrompt.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 text-center border border-slate-100 animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mb-6 text-emerald-500 text-4xl">♻️</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Restore Email?</h3>
            <p className="text-slate-600 font-medium mb-8">This email will be moved back to its original folder and will no longer be in the trash.</p>
            <div className="flex gap-3">
              <button onClick={() => setRestorePrompt({ isOpen: false, id: null, table: null })} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={executeRestore} className="flex-1 px-5 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all">
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Permanent Delete Warning Modal */}
      {deletePrompt.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 text-center border border-slate-100 animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6 text-red-500 text-4xl">⚠️</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Permanently?</h3>
            <p className="text-slate-600 font-medium mb-8">This action cannot be undone. This email will be permanently removed from the server.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletePrompt({ isOpen: false, id: null, table: null })} className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={executePermanentDelete} className="flex-1 px-5 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all">
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Success/Error Alert Modal */}
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

      {showComposeModal && <ComposeEmailModal onClose={() => setShowComposeModal(false)} onSendSuccess={(msg) => { setAlertPrompt({ isOpen: true, message: msg, isError: false }); setShowComposeModal(false); }} />}
    </div>
  );
}