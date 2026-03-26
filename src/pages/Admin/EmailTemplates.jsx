import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../../components/Sidebar';
import EmailSidebar from '../../components/EmailSidebar';
import ComposeEmailModal from '../../components/ComposeEmailModal';
import NotificationBell from '../../components/NotificationBell'; 
import launchpadLogo from '../../assets/launchpad-logo.png'; 

// System Default Template
const SYSTEM_TEMPLATE = {
  id: 'system-automated-renewal',
  name: 'System Default: Automated Renewal',
  subject: 'Virtual Office Subscription Renewal Notice',
  isSystem: true,
  isHtml: true, 
  attachments: [],
  body: `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #fefce8; text-align: center; padding: 20px; border-bottom: 3px solid #d2f34c;">
        <img src="${launchpadLogo}" alt="Launchpad Business Logo" style="max-width: 250px;" />
      </div>
      <div style="padding: 30px; color: #333; line-height: 1.6;">
        <h2>Greetings, [Client Name]!</h2>
        <p>We hope this email finds you well.</p>
        <p>This is a formal notification regarding your <strong>Virtual Office</strong> subscription for <strong>[Company Name]</strong>. Our records indicate that your current subscription is scheduled to expire in <strong style="color: #eab308; font-size: 1.1em;">[X] days</strong> (on <strong>[Exact Expiry Date]</strong>).</p>
        <p>To continue accessing the services and features of your Virtual Office, please renew your subscription at your earliest convenience. Maintaining an active subscription is vital for the continuity of your business operations.</p>
        <p>Thank you for choosing Launchpad as your business partner.</p>
        <br>
        <p>Best Regards,<br><strong>Launchpad Management Team</strong></p>
      </div>
    </div>
  `
};

export default function EmailTemplates() {
  const [currentView, setCurrentView] = useState('library'); 
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showComposeModal, setShowComposeModal] = useState(false);
  
  const [emailCounts, setEmailCounts] = useState({ inbox: 0, manual: 0, automated: 0 });

  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [alertPrompt, setAlertPrompt] = useState({ isOpen: false, message: '', isError: false }); 
  
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    subject: '',
    body: '',
    isHtml: false, 
    existingAttachments: [],
    newFiles: []
  });

  const [previewTemplate, setPreviewTemplate] = useState(null);

  const userRole = localStorage.getItem('userRole') || '';
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  const fetchEmailCounts = async () => {
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

  useEffect(() => {
    const existing = JSON.parse(localStorage.getItem('email_templates')) || [];
    setSavedTemplates(existing);
    
    fetchEmailCounts(); 

    const socket = io('http://localhost:5000');
    socket.on('incoming_email', () => {
      fetchEmailCounts();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const resetForm = () => {
    setFormData({ id: null, name: '', subject: '', body: '', isHtml: false, existingAttachments: [], newFiles: [] });
  };

  const getEmailSnippet = (htmlString) => {
    if (!htmlString) return '';
    let text = htmlString.replace(/<[^>]*>?/gm, ' '); 
    text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return text.replace(/\s+/g, ' ').trim().substring(0, 100) + '...';
  };

  const handleEditClick = (template) => {
    setFormData({
      id: template.id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      isHtml: template.isHtml !== undefined ? template.isHtml : true,
      existingAttachments: template.attachments || [],
      newFiles: []
    });
    setCurrentView('form');
  };

  const handlePreviewClick = (template) => {
    setPreviewTemplate(template);
    setCurrentView('preview');
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    
    const fileDataPromises = formData.newFiles.map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      base64: await fileToBase64(file)
    }));
    const processedNewFiles = await Promise.all(fileDataPromises);
    
    const finalAttachments = [...formData.existingAttachments, ...processedNewFiles];

    const newTemplate = {
      id: formData.id || Date.now().toString(), 
      name: formData.name,
      subject: formData.subject,
      body: formData.body,
      isHtml: formData.isHtml,
      attachments: finalAttachments
    };

    let updatedTemplates;
    if (formData.id) {
      updatedTemplates = savedTemplates.map(t => t.id === formData.id ? newTemplate : t);
    } else {
      updatedTemplates = [...savedTemplates, newTemplate];
    }

    localStorage.setItem('email_templates', JSON.stringify(updatedTemplates));
    setSavedTemplates(updatedTemplates);
    resetForm();
    setCurrentView('library');
    setAlertPrompt({ isOpen: true, message: "Template saved successfully!", isError: false });
  };

  const confirmDelete = (id) => {
    setTemplateToDelete(id);
  };

  const executeDelete = () => {
    if (templateToDelete) {
      const updated = savedTemplates.filter(t => t.id !== templateToDelete);
      localStorage.setItem('email_templates', JSON.stringify(updated));
      setSavedTemplates(updated);
      setTemplateToDelete(null);
      setAlertPrompt({ isOpen: true, message: "Template deleted.", isError: false });
    }
  };

  const allTemplates = [SYSTEM_TEMPLATE, ...savedTemplates];

  const renderAttachmentPreview = (att, index) => {
    const isImage = att.type?.startsWith('image/');
    const isVideo = att.type?.startsWith('video/');
    const isPDF = att.type === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf');
    
    let visualContent;
    if (isImage) {
      visualContent = <img src={att.base64} alt="thumbnail" className="w-full h-full object-cover" />;
    } else if (isPDF) {
      visualContent = <div className="text-4xl text-red-500">📄</div>;
    } else if (isVideo) {
      visualContent = <video src={att.base64} className="w-full h-full object-cover" />;
    } else {
      visualContent = <div className="text-4xl text-blue-500">📝</div>;
    }

    return (
      <div key={index} className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="h-32 bg-slate-50 flex items-center justify-center relative group border-b border-slate-100">
          {visualContent}
          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
            <a href={att.base64} download={att.name} className="bg-[#d2f34c] text-slate-900 text-xs font-bold px-4 py-2 rounded-full hover:scale-105 transition-transform shadow-lg uppercase tracking-wide">
              Download
            </a>
          </div>
        </div>
        <div className="p-3 bg-white">
          <p className="text-sm font-bold text-slate-700 truncate text-center" title={att.name}>{att.name}</p>
        </div>
      </div>
    );
  };

  const renderSafePreviewBody = (htmlContent) => {
    if (!htmlContent) return '';
    return htmlContent.replace(/src="([^"]*(launchpad-logo|cid:launchpadLogo)[^"]*)"/gi, `src="${launchpadLogo}"`);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      
      <style>{`
        @keyframes modalPopIn {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-pop { animation: modalPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
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

          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-w-0 overflow-hidden relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 p-8 bg-slate-50/80 shrink-0">
              <div>
                <h3 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                  <span className="text-3xl">📚</span>
                  {currentView === 'library' && 'Template Library'}
                  {currentView === 'form' && (formData.id ? 'Edit Template' : 'Create New Template')}
                  {currentView === 'preview' && 'Template Preview'}
                </h3>
                <p className="text-base text-slate-500 font-medium mt-1">
                  {currentView === 'library' && 'Manage your pre-written emails and permanent attachments.'}
                  {currentView === 'form' && 'Design a reusable email layout to save time on repetitive emails.'}
                  {currentView === 'preview' && 'See exactly how this template will look when sent.'}
                </p>
              </div>
              {currentView === 'library' && (
                <button onClick={() => { resetForm(); setCurrentView('form'); }} className="rounded-xl bg-[#d2f34c] px-6 py-3 font-bold text-slate-900 text-base shadow-sm hover:bg-[#b8d839] hover:-translate-y-0.5 transition-all flex items-center gap-2">
                  <span className="text-xl leading-none font-black">+</span> Create New Template
                </button>
              )}
            </div>

            {currentView === 'library' && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50/30">
                <div className="flex flex-col gap-4">
                  {allTemplates.map(t => (
                    <div key={t.id} className={`bg-white border ${t.isSystem ? 'border-[#d2f34c]/60 bg-[#d2f34c]/5' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'} rounded-2xl p-6 shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group`}>
                      
                      <div className="flex items-start gap-5 flex-1 min-w-0 w-full">
                        <div className={`h-14 w-14 shrink-0 rounded-xl flex items-center justify-center text-2xl shadow-sm ${t.isSystem ? 'bg-[#d2f34c] text-slate-900' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                          {t.isSystem ? '🤖' : '📝'}
                        </div>
                        
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h5 className="font-bold text-slate-900 text-xl truncate">{t.name}</h5>
                            {t.isSystem && (
                              <span className="shrink-0 bg-[#d2f34c] text-slate-900 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border border-[#b8d839]">
                                System Default
                              </span>
                            )}
                          </div>
                          <p className="text-base text-slate-600 font-medium truncate w-full">
                            <span className="font-bold text-slate-800">Subject:</span> {t.subject}
                            <span className="text-slate-300 font-normal mx-2">|</span>
                            <span className="text-slate-500 italic">{getEmailSnippet(t.body)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                        <span className={`text-sm font-bold px-4 py-2 rounded-lg border flex items-center gap-2 ${t.attachments?.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" /></svg>
                          {t.attachments?.length || 0} Files
                        </span>

                        <div className="flex items-center gap-2">
                          <button onClick={() => handlePreviewClick(t)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm uppercase tracking-wide">
                            Preview
                          </button>
                          {!t.isSystem && (
                            <>
                              <button onClick={() => handleEditClick(t)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm uppercase tracking-wide">
                                Edit
                              </button>
                              
                              <button onClick={() => confirmDelete(t.id)} className="group bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 p-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center" title="Delete Template">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 group-hover:text-red-500 transition-colors">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentView === 'form' && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50/30">
                <div className="max-w-4xl mx-auto">
                  
                  <button onClick={() => setCurrentView('library')} className="mb-6 text-base font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-2 transition-colors w-max">
                    &larr; Back to Library
                  </button>

                  <form onSubmit={handleSaveTemplate} className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-widest">Template Name</label>
                        <input required type="text" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#d2f34c] transition-all" 
                          value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Final Warning Notice" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-widest">Default Subject Line</label>
                        <input required type="text" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#d2f34c] transition-all" 
                          value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} placeholder="Virtual Office Subscription..." />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest">Email Body</label>
                        
                        <div className="flex p-1 bg-slate-100 rounded-lg shadow-inner">
                          <button type="button" onClick={() => setFormData({...formData, isHtml: false})} className={`px-4 py-1.5 rounded-md font-bold text-sm transition-all ${!formData.isHtml ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                            Text Mode
                          </button>
                          <button type="button" onClick={() => setFormData({...formData, isHtml: true})} className={`px-4 py-1.5 rounded-md font-bold text-sm transition-all ${formData.isHtml ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                            HTML Mode
                          </button>
                        </div>
                      </div>
                      
                      {!formData.isHtml && (
                        <p className="text-sm font-medium text-slate-600 mb-3 italic">
                          Tip: Type naturally. Paragraphs and line breaks will be preserved perfectly.
                        </p>
                      )}
                      
                      <textarea required rows="12" className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-5 py-4 text-base text-slate-900 shadow-inner focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#d2f34c] focus:border-[#d2f34c] transition-all resize-y font-mono" 
                        value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})} 
                        placeholder={formData.isHtml ? "<p>Write your HTML code here...</p>" : "Dear Client,\n\nType your message here.\n\nBest,\nAdmin"} 
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-widest">Permanent Attachments</label>
                      
                      <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-8 relative hover:bg-[#d2f34c]/5 hover:border-[#d2f34c] transition-colors text-center cursor-pointer mb-4 group">
                        <input type="file" multiple onChange={(e) => { if(e.target.files) setFormData({...formData, newFiles: [...formData.newFiles, ...Array.from(e.target.files)]}) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <svg className="mx-auto h-10 w-10 text-slate-400 group-hover:text-[#b8d839] transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="text-base font-bold text-slate-700">Click or drag files here to attach</p>
                        <p className="text-sm font-medium text-slate-500 mt-1">Files attached here will be permanently tied to this template.</p>
                      </div>

                      {(formData.existingAttachments.length > 0 || formData.newFiles.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {formData.existingAttachments.map((f, i) => (
                            <div key={`old-${i}`} className="flex justify-between items-center bg-white border border-slate-200 px-4 py-3 rounded-lg shadow-sm">
                              <span className="text-sm font-bold text-slate-700 truncate flex items-center gap-2"><span className="text-lg text-slate-400">📄</span> {f.name}</span>
                              <button type="button" onClick={() => setFormData({...formData, existingAttachments: formData.existingAttachments.filter((_, idx) => idx !== i)})} className="text-red-400 hover:text-red-600 p-1 transition-colors">✕</button>
                            </div>
                          ))}
                          {formData.newFiles.map((f, i) => (
                            <div key={`new-${i}`} className="flex justify-between items-center bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg shadow-sm">
                              <span className="text-sm font-bold text-emerald-800 truncate flex items-center gap-2"><span className="text-lg text-emerald-500">✨</span> {f.name}</span>
                              <button type="button" onClick={() => setFormData({...formData, newFiles: formData.newFiles.filter((_, idx) => idx !== i)})} className="text-red-400 hover:text-red-600 p-1 transition-colors">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end border-t border-slate-100 pt-6 mt-4">
                      <button type="submit" className="rounded-xl bg-[#d2f34c] px-8 py-3 text-base font-bold text-slate-900 hover:bg-[#b8d839] transition-all shadow-sm flex items-center gap-2 uppercase tracking-wide">
                        {formData.id ? 'Save Changes' : 'Save Template'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {currentView === 'preview' && previewTemplate && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-100/50 flex flex-col">
                <div className="max-w-4xl mx-auto w-full">
                  <button onClick={() => setCurrentView('library')} className="mb-6 text-base font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-2 transition-colors w-max">
                    &larr; Back to Library
                  </button>

                  <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-slate-200">
                    <div className="border-b border-slate-100 p-6 bg-slate-50/50 flex items-start gap-4">
                       <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shrink-0 shadow-inner border border-emerald-200">
                          ✉️
                       </div>
                       <div className="flex-1 pt-1">
                          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Subject</h4>
                          <h2 className="text-2xl font-bold text-slate-900">{previewTemplate.subject}</h2>
                       </div>
                    </div>

                    <div className="text-base text-slate-800 bg-white p-8 min-h-[300px]">
                      {previewTemplate.isHtml ? (
                        <div className="prose max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: renderSafePreviewBody(previewTemplate.body) }} />
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }} className="text-slate-700 leading-relaxed">
                          {previewTemplate.body}
                        </div>
                      )}
                    </div>

                    {previewTemplate.attachments && previewTemplate.attachments.length > 0 && (
                      <div className="bg-slate-50 border-t border-slate-200 p-6">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          📎 Attachments ({previewTemplate.attachments.length})
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {previewTemplate.attachments.map((att, index) => renderAttachmentPreview(att, index))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {templateToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6 text-red-500 text-4xl shadow-inner">⚠️</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Template?</h3>
            <p className="text-slate-500 font-medium text-base mb-8">This action cannot be undone. You will lose this template and its attachments.</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setTemplateToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-base uppercase tracking-wide">
                Cancel
              </button>
              <button onClick={executeDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-sm transition-all text-base uppercase tracking-wide">
                Yes, Delete
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
            <p className="text-slate-500 font-medium text-base mb-8">{alertPrompt.message}</p>
            <button onClick={() => setAlertPrompt({ isOpen: false, message: '', isError: false })} className="w-full px-5 py-3 rounded-xl font-bold text-slate-900 bg-[#d2f34c] hover:bg-[#b8d839] shadow-sm transition-all text-base uppercase tracking-wide">
              Got it
            </button>
          </div>
        </div>
      )}

      {showComposeModal && <ComposeEmailModal onClose={() => setShowComposeModal(false)} onSendSuccess={(msg) => { setAlertPrompt({ isOpen: true, message: msg, isError: false }); setShowComposeModal(false); fetchEmailCounts(); }} />}
    </div>
  );
}