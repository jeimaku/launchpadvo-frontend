import React, { useState, useEffect } from 'react';

const API_URL = `http://${window.location.hostname}:5000`;

export default function ComposeEmailModal({ onClose, onSendSuccess }) {
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [files, setFiles] = useState([]); 
  const [isSending, setIsSending] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  
  const [viewMode, setViewMode] = useState('edit'); 

  // --- NEW: FETCH TEMPLATES FROM DATABASE ---
  useEffect(() => {
    const fetchManualTemplates = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/emails/templates`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (response.ok) {
          const data = await response.json();
          // Filter out ONLY manual templates
          const manualTemplates = data.filter(t => t.template_type === 'manual');
          setAvailableTemplates(manualTemplates);
        }
      } catch (error) {
        console.error("Error fetching manual templates:", error);
      }
    };
    
    fetchManualTemplates();
  }, []);

  const dataURLtoFile = (dataurl, filename, mimeType) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1] || mimeType;
    let bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, {type: mime});
  };

  const handleTemplateSelect = (e) => {
    const templateId = e.target.value;
    if (!templateId) return;

    const template = availableTemplates.find(t => t.id === templateId);
    if (template) {
      let parsedBody = template.body ? template.body.replace(/<br \/>/g, '\n') : '';

      setComposeData(prev => ({ 
        ...prev, 
        subject: template.subject, 
        body: parsedBody
      }));
      
      const parsedAttachments = typeof template.attachments === 'string' ? JSON.parse(template.attachments) : (template.attachments || []);
      const reconstructedFiles = parsedAttachments.map(att => 
        dataURLtoFile(att.base64, att.name, att.type)
      );
      
      setFiles(prev => [...prev, ...reconstructedFiles]);
      setViewMode('edit'); 
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setIsSending(true);
    try {
      const token = localStorage.getItem('token'); 
      const formData = new FormData();
      formData.append('to', composeData.to);
      formData.append('subject', composeData.subject);
      
      let finalBody = composeData.body.replace(/\n/g, '<br />');
      formData.append('body', finalBody);
      
      files.forEach((file) => formData.append('attachments', file));

      const response = await fetch(`${API_URL}/api/emails/send`, {
        method: 'POST',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        body: formData 
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to send email');

      onSendSuccess(`Success: ${data.message}`);
    } catch (error) {
      alert(`Error: ${error.message}`);
      setIsSending(false);
    }
  };

  const renderFilePreview = (file, i) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    return (
      <div key={i} className="flex justify-between items-center bg-white border border-slate-200 px-4 py-3 rounded-lg shadow-sm hover:border-slate-300 transition-colors">
        <span className="text-sm font-bold text-slate-700 truncate flex items-center gap-2">
          <span className="text-xl text-slate-400">
            {isImage ? '🖼️' : isVideo ? '🎬' : '📄'}
          </span> 
          {file.name}
        </span>
        <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 p-1.5 transition-colors outline-none focus:outline-none ml-2">
          ✕
        </button>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes modalFadeIn {
          0% { opacity: 0; transform: scale(0.98) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-fade { animation: modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-6" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        
        <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] animate-modal-fade overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50/80 shrink-0">
            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <span className="text-3xl">✉️</span> Compose Email
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-full h-10 w-10 flex items-center justify-center transition-colors shadow-sm outline-none">
              <span className="text-xl font-bold leading-none -mt-0.5">✕</span>
            </button>
          </div>

          <div className="overflow-y-auto custom-scrollbar p-6 md:p-8 flex-1 bg-white">
            
            {availableTemplates.length > 0 && (
              <div className="mb-8 bg-blue-50/50 p-5 rounded-xl border border-blue-100 flex items-center gap-4">
                <span className="text-3xl">📋</span>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-blue-800 uppercase tracking-widest mb-2">Load Pre-saved Template (Optional)</label>
                  <select onChange={handleTemplateSelect} defaultValue="" className="w-full bg-white border border-blue-200 rounded-lg px-4 py-2.5 text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm cursor-pointer transition-shadow">
                    <option value="" disabled>Select a template to auto-fill...</option>
                    {availableTemplates.map(t => {
                      const fileCount = (typeof t.attachments === 'string' ? JSON.parse(t.attachments) : (t.attachments || [])).length;
                      return (
                        <option key={t.id} value={t.id}>{t.name} ({fileCount} files)</option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            <form id="composeForm" onSubmit={handleSendEmail} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600 uppercase tracking-widest">To (Email Address)</label>
                  <input required type="email" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#d2f34c] transition-all" 
                    value={composeData.to} onChange={(e) => setComposeData({...composeData, to: e.target.value})} placeholder="client@company.com" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600 uppercase tracking-widest">Subject</label>
                  <input required type="text" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#d2f34c] transition-all" 
                    value={composeData.subject} onChange={(e) => setComposeData({...composeData, subject: e.target.value})} placeholder="Virtual Office Inquiry" />
                </div>
              </div>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 border-b border-slate-200 p-3 gap-3">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-2 hidden sm:block">Message Body</label>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto">
                    <div className="flex p-1 bg-slate-200/70 rounded-lg shadow-inner shrink-0">
                      <button type="button" onClick={() => setViewMode('edit')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'edit' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        ✍️ Edit
                      </button>
                      <button type="button" onClick={() => setViewMode('preview')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'preview' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        👁️ Preview
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/30">
                  {viewMode === 'edit' && (
                    <div className="mb-3 px-2">
                      <p className="text-sm text-slate-500 italic font-medium">Tip: Type naturally. Paragraphs and line breaks will be preserved perfectly when sent.</p>
                    </div>
                  )}

                  {viewMode === 'edit' ? (
                    <textarea required rows="10" className="w-full rounded-xl border border-slate-300 bg-white px-5 py-4 text-base font-medium text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#d2f34c] transition-all resize-y" 
                      value={composeData.body} onChange={(e) => setComposeData({...composeData, body: e.target.value})} placeholder="Write your message here..." />
                  ) : (
                    <div className="w-full min-h-[14rem] max-h-[22rem] rounded-xl border border-slate-300 bg-white px-6 py-5 overflow-y-auto custom-scrollbar prose max-w-none text-slate-800 shadow-inner">
                      <div dangerouslySetInnerHTML={{ __html: composeData.body.replace(/\n/g, '<br />') || '<p class="text-slate-400 italic">No content to preview yet...</p>' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <label className="mb-2 block text-xs font-bold text-slate-600 uppercase tracking-widest">Attachments</label>
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-8 relative hover:bg-[#d2f34c]/5 hover:border-[#d2f34c] transition-colors text-center cursor-pointer group">
                  <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <svg className="mx-auto h-10 w-10 text-slate-400 group-hover:text-[#b8d839] transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="text-base font-bold text-slate-700">Click or drag files here to attach</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">Supports PDFs, DOCX, Images, and Videos</p>
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-5">
                    {files.map((file, i) => renderFilePreview(file, i))}
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="border-t border-slate-100 p-6 bg-slate-50/80 shrink-0 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="rounded-xl px-8 py-3 text-base font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">
              Cancel
            </button>
            <button type="submit" form="composeForm" disabled={isSending} className="rounded-xl bg-[#d2f34c] px-10 py-3 text-base font-bold text-slate-900 hover:bg-[#b8d839] transition-all shadow-sm shadow-[#d2f34c]/20 disabled:opacity-50 flex items-center gap-2 uppercase tracking-wide">
              {isSending ? 'Sending...' : 'Send Mail'}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}