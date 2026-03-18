import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import EmailSidebar from '../../components/EmailSidebar';
import ComposeEmailModal from '../../components/ComposeEmailModal';
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
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
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
  
  // Custom Delete Modal State
  const [templateToDelete, setTemplateToDelete] = useState(null);
  
  // State for the Form (Create/Edit)
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    subject: '',
    body: '',
    isHtml: false, 
    existingAttachments: [],
    newFiles: []
  });

  // State for Preview
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    const existing = JSON.parse(localStorage.getItem('email_templates')) || [];
    setSavedTemplates(existing);
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
    return text.replace(/\s+/g, ' ').trim();
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
    }
  };

  const allTemplates = [SYSTEM_TEMPLATE, ...savedTemplates];

  // Function from your Modal to render distinct files in the preview
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
            <a href={att.base64} download={att.name} className="bg-[#d2f34c] text-slate-900 text-sm font-black px-4 py-2 rounded-full hover:scale-105 transition-transform shadow-lg">
              Download
            </a>
          </div>
        </div>
        <div className="p-3 bg-white">
          <p className="text-xs font-bold text-slate-700 truncate text-center" title={att.name}>{att.name}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-8 relative flex flex-col h-full overflow-hidden">
        
        {/* Page Header */}
        <div className="mb-6 shrink-0">
          <h1 className="text-4xl font-black text-slate-900">Email Center</h1>
          <p className="text-lg text-slate-500 mt-1 font-medium">Manage automated notifications and manual communications.</p>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
          
          {/* Reusable Sidebar Component */}
          <EmailSidebar onCompose={() => setShowComposeModal(true)} />

          {/* Main Content Area */}
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-w-0 overflow-hidden relative">
            
            {/* CUSTOM DELETE CONFIRMATION MODAL OVERLAY */}
            {templateToDelete && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center transform scale-100 animate-scale-in">
                  <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
                    <span className="text-4xl">⚠️</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Template?</h3>
                  <p className="text-slate-500 font-medium mb-8">This action cannot be undone. You will permanently lose this template and its attachments.</p>
                  <div className="flex gap-3 w-full">
                    <button onClick={() => setTemplateToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors">
                      Cancel
                    </button>
                    <button onClick={executeDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-500/30 transition-colors">
                      Yes, Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Inner Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-8 bg-slate-50 shrink-0">
              <div>
                <h3 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                  <span className="text-3xl">📚</span>
                  {currentView === 'library' && 'Template Library'}
                  {currentView === 'form' && (formData.id ? 'Edit Template' : 'Create New Template')}
                  {currentView === 'preview' && 'Preview Template'}
                </h3>
                <p className="text-base text-slate-500 font-medium mt-1">
                  {currentView === 'library' && 'Manage your pre-written emails and attachments.'}
                  {currentView === 'form' && 'Design a reusable email layout with permanent attachments.'}
                  {currentView === 'preview' && 'See exactly how this template will look when loaded.'}
                </p>
              </div>
              {currentView === 'library' && (
                <button onClick={() => { resetForm(); setCurrentView('form'); }} className="rounded-xl bg-[#d2f34c] px-6 py-3 font-bold text-slate-900 shadow-md shadow-[#d2f34c]/20 hover:bg-[#b8d839] hover:-translate-y-0.5 transition-all flex items-center gap-2">
                  <span className="text-xl leading-none">+</span> Create New Template
                </button>
              )}
            </div>

            {/* VIEW 1: TEMPLATE LIBRARY LISTING */}
            {currentView === 'library' && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
                <div className="flex flex-col gap-4">
                  {allTemplates.map(t => (
                    <div key={t.id} className={`bg-white border ${t.isSystem ? 'border-[#d2f34c]/50 bg-[#d2f34c]/5' : 'border-slate-200 hover:border-[#d2f34c]/50'} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group`}>
                      
                      <div className="flex items-start gap-5 flex-1 min-w-0 w-full">
                        <div className={`h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center text-3xl shadow-sm ${t.isSystem ? 'bg-[#d2f34c] text-slate-900' : 'bg-emerald-100 text-emerald-600'}`}>
                          {t.isSystem ? '🤖' : '📝'}
                        </div>
                        
                        <div className="flex flex-col flex-1 min-w-0 mt-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h5 className="font-black text-slate-900 text-2xl truncate">{t.name}</h5>
                            {t.isSystem && (
                              <span className="shrink-0 bg-[#d2f34c] text-slate-900 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-[#b8d839]">
                                System Default
                              </span>
                            )}
                          </div>
                          <p className="text-lg text-slate-700 font-medium truncate w-full">
                            <span className="font-bold text-slate-900">Subj:</span> {t.subject}
                            <span className="text-slate-400 font-normal mx-2">—</span>
                            <span className="text-slate-500 font-normal italic">{getEmailSnippet(t.body)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                        <span className={`text-sm font-bold px-4 py-2 rounded-xl border flex items-center gap-2 ${t.attachments?.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" /></svg>
                          {t.attachments?.length || 0} Files
                        </span>

                        <div className="flex items-center gap-2">
                          <button onClick={() => handlePreviewClick(t)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-base transition-colors shadow-sm">
                            Preview
                          </button>
                          {!t.isSystem && (
                            <>
                              <button onClick={() => handleEditClick(t)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-5 py-2.5 rounded-xl text-base transition-colors shadow-sm">
                                Edit
                              </button>
                              
                              <button onClick={() => confirmDelete(t.id)} className="group bg-red-500 hover:bg-rose-100 border border-transparent hover:border-rose-200 p-2.5 rounded-xl transition-all shadow-md hover:shadow-sm flex items-center justify-center" title="Delete Template">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-white group-hover:text-red-600 transition-colors">
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

            {/* VIEW 2: TEMPLATE FORM */}
            {currentView === 'form' && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white">
                <button onClick={() => setCurrentView('library')} className="mb-6 text-base font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-2">
                  &larr; Back to Library
                </button>

                <form onSubmit={handleSaveTemplate} className="max-w-5xl mx-auto space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wide">Template Name</label>
                      <input required type="text" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#d2f34c] focus:ring-4 focus:ring-[#d2f34c]/20 transition-all" 
                        value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Final Warning Notice" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wide">Saved Subject Line</label>
                      <input required type="text" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#d2f34c] focus:ring-4 focus:ring-[#d2f34c]/20 transition-all" 
                        value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} placeholder="Virtual Office Subscription..." />
                    </div>
                  </div>

                  <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                    <div className="flex border-b-2 border-slate-200 bg-slate-100 p-2 gap-2">
                      <button type="button" onClick={() => setFormData({...formData, isHtml: false})} className={`flex-1 py-3 rounded-xl font-bold text-base transition-all ${!formData.isHtml ? 'bg-white shadow-sm text-emerald-700 border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}>
                        📝 Normal Text Mode
                      </button>
                      <button type="button" onClick={() => setFormData({...formData, isHtml: true})} className={`flex-1 py-3 rounded-xl font-bold text-base transition-all ${formData.isHtml ? 'bg-white shadow-sm text-emerald-700 border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}>
                        💻 HTML Code Mode
                      </button>
                    </div>
                    <div className="p-4">
                      {!formData.isHtml && (
                        <div className="mb-4 rounded-xl bg-[#d2f34c]/20 p-4 text-base text-slate-800 border border-[#d2f34c]/50 flex items-start gap-3">
                          <span className="text-2xl">💡</span> 
                          <span><strong>Normal Mode:</strong> Just type naturally! Spacing, paragraphs, and line breaks will be perfectly preserved when sent. No HTML code required.</span>
                        </div>
                      )}
                      <textarea required rows="10" className="w-full rounded-xl border border-slate-300 bg-white px-5 py-4 text-lg text-slate-900 focus:outline-none focus:border-[#d2f34c] focus:ring-4 focus:ring-[#d2f34c]/20 transition-all resize-y" 
                        value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})} 
                        placeholder={formData.isHtml ? "<p>Write your HTML here...</p>" : "Dear Client,\n\nType your message here. Spacing is automatically saved!\n\nBest,\nAdmin"} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wide">Permanent Attachments</label>
                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-10 relative hover:bg-[#d2f34c]/10 hover:border-[#d2f34c] transition-colors text-center cursor-pointer mb-4">
                      <input type="file" multiple onChange={(e) => { if(e.target.files) setFormData({...formData, newFiles: [...formData.newFiles, ...Array.from(e.target.files)]}) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <span className="text-5xl block mb-3">📎</span>
                      <p className="text-xl font-bold text-slate-700">Click or drag files to attach to this template</p>
                      <p className="text-base font-medium text-slate-500 mt-2">These files will automatically attach whenever this template is used.</p>
                    </div>

                    {(formData.existingAttachments.length > 0 || formData.newFiles.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {formData.existingAttachments.map((f, i) => (
                          <div key={`old-${i}`} className="flex justify-between items-center bg-slate-100 border border-slate-200 p-4 rounded-xl shadow-sm">
                            <span className="text-base font-bold text-slate-800 truncate flex items-center gap-3"><span className="text-xl">📄</span> {f.name}</span>
                            <button type="button" onClick={() => setFormData({...formData, existingAttachments: formData.existingAttachments.filter((_, idx) => idx !== i)})} className="text-red-500 hover:bg-red-100 p-2 rounded-lg ml-2 transition-colors">&times;</button>
                          </div>
                        ))}
                        {formData.newFiles.map((f, i) => (
                          <div key={`new-${i}`} className="flex justify-between items-center bg-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-sm">
                            <span className="text-base font-bold text-emerald-900 truncate flex items-center gap-3"><span className="text-xl">✨</span> {f.name}</span>
                            <button type="button" onClick={() => setFormData({...formData, newFiles: formData.newFiles.filter((_, idx) => idx !== i)})} className="text-red-500 hover:bg-red-100 p-2 rounded-lg ml-2 transition-colors">&times;</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-8">
                    <button type="submit" className="rounded-2xl bg-[#d2f34c] px-12 py-5 text-xl font-black text-slate-900 hover:bg-[#b8d839] transition-all shadow-lg shadow-[#d2f34c]/30">
                      {formData.id ? 'Save Changes' : 'Save Template to Library'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* VIEW 3: TEMPLATE PREVIEW */}
            {currentView === 'preview' && previewTemplate && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50 flex flex-col">
                <button onClick={() => setCurrentView('library')} className="mb-6 text-base font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-2 w-max">
                  &larr; Back to Library
                </button>

                <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col bg-white shadow-lg rounded-3xl p-10 border border-slate-200">
                  <div className="mb-8 border-b border-slate-200 pb-8 flex items-start gap-5">
                     <div className="h-16 w-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl shrink-0">
                        ✉️
                     </div>
                     <div>
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Subject</h4>
                        <h2 className="text-3xl font-black text-slate-900">{previewTemplate.subject}</h2>
                     </div>
                  </div>

                  <div className="text-xl text-slate-800 flex-1 bg-slate-50/50 rounded-2xl p-8 border border-slate-100">
                    {previewTemplate.isHtml ? (
                      <div className="prose prose-lg max-w-none prose-a:text-[#b8d839]" dangerouslySetInnerHTML={{ __html: previewTemplate.body }} />
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                        {previewTemplate.body}
                      </div>
                    )}
                  </div>

                  {previewTemplate.attachments && previewTemplate.attachments.length > 0 && (
                    <div className="mt-10 border-t border-slate-200 pt-8">
                      <h4 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                        📎 Permanent Attachments ({previewTemplate.attachments.length})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {previewTemplate.attachments.map((att, index) => renderAttachmentPreview(att, index))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Keep Compose Modal functionality accessible from Sidebar */}
      {showComposeModal && <ComposeEmailModal onClose={() => setShowComposeModal(false)} onSendSuccess={(msg) => { alert(msg); setShowComposeModal(false); }} />}
    </div>
  );
}