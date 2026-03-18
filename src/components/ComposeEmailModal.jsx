import React, { useState, useEffect } from 'react';
import launchpadLogo from '../assets/launchpad-logo.png'; 

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

export default function ComposeEmailModal({ onClose, onSendSuccess }) {
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [files, setFiles] = useState([]); 
  const [isSending, setIsSending] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  
  // NEW STATE: Toggle between editing text and visually previewing HTML
  const [composeMode, setComposeMode] = useState('edit'); 

  useEffect(() => {
    const userTemplates = JSON.parse(localStorage.getItem('email_templates')) || [];
    setAvailableTemplates([SYSTEM_TEMPLATE, ...userTemplates]);
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
      
      let parsedBody = template.body;
      if (template.isHtml === false) {
        parsedBody = template.body.replace(/\n/g, '<br />');
      }

      setComposeData(prev => ({ ...prev, subject: template.subject, body: parsedBody }));
      
      const reconstructedFiles = template.attachments.map(att => 
        dataURLtoFile(att.base64, att.name, att.type)
      );
      
      setFiles(prev => [...prev, ...reconstructedFiles]);
      // Switch back to edit mode automatically when a new template is loaded
      setComposeMode('edit');
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
      
      // Auto-convert standard line breaks to HTML if they are typing normally
      let finalBody = composeData.body;
      if (!finalBody.includes('<p>') && !finalBody.includes('<div>') && !finalBody.includes('<br')) {
         finalBody = finalBody.replace(/\n/g, '<br />');
      }
      formData.append('body', finalBody);
      
      files.forEach((file) => formData.append('attachments', file));

      const response = await fetch('http://localhost:5000/api/emails/send', {
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
    const url = URL.createObjectURL(file);

    return (
      <div key={i} className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm relative group">
        <div className="h-24 bg-slate-100 flex items-center justify-center overflow-hidden">
          {isImage ? <img src={url} className="object-cover w-full h-full" alt="preview"/> :
           isVideo ? <span className="text-3xl">🎬</span> :
           <span className="text-3xl text-blue-500">📄</span>}
        </div>
        <div className="p-2 text-xs font-bold text-slate-700 truncate text-center bg-slate-50 border-t border-slate-200">
          {file.name}
        </div>
        <button type="button" onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          &times;
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-fade-in text-left">
      <div className="w-full max-w-4xl rounded-3xl bg-white p-8 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-6 shrink-0">
          <h3 className="text-3xl font-black text-slate-900">Compose New Mail</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 rounded-full h-10 w-10 flex items-center justify-center transition-colors">
            <span className="text-2xl font-bold leading-none -mt-1">&times;</span>
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar pr-2 mt-6 flex-1">
          <div className="mb-6 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex items-center gap-4">
            <span className="text-3xl">📋</span>
            <div className="flex-1">
              <label className="block text-sm font-bold text-indigo-900 mb-1">Load Template (Optional)</label>
              <select onChange={handleTemplateSelect} defaultValue="" className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-indigo-900 font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/20 cursor-pointer shadow-sm">
                <option value="" disabled>Select a template to auto-fill...</option>
                {availableTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.attachments.length} files)</option>
                ))}
              </select>
            </div>
          </div>

          <form id="composeForm" onSubmit={handleSendEmail} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wide">To (Email Address)</label>
              <input required type="email" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#d2f34c] focus:ring-4 focus:ring-[#d2f34c]/20 transition-all" 
                value={composeData.to} onChange={(e) => setComposeData({...composeData, to: e.target.value})} placeholder="client@company.com" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700 uppercase tracking-wide">Subject</label>
              <input required type="text" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#d2f34c] focus:ring-4 focus:ring-[#d2f34c]/20 transition-all" 
                value={composeData.subject} onChange={(e) => setComposeData({...composeData, subject: e.target.value})} placeholder="Virtual Office Inquiry" />
            </div>
            
            {/* MESSAGE BODY WITH NEW PREVIEW TOGGLE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide">Message Body</label>
                <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                  <button type="button" onClick={() => setComposeMode('edit')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${composeMode === 'edit' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    ✍️ Edit Content
                  </button>
                  <button type="button" onClick={() => setComposeMode('preview')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${composeMode === 'preview' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    👁️ Visual Preview
                  </button>
                </div>
              </div>

              {composeMode === 'edit' ? (
                <textarea required rows="8" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#d2f34c] focus:ring-4 focus:ring-[#d2f34c]/20 transition-all resize-y" 
                  value={composeData.body} onChange={(e) => setComposeData({...composeData, body: e.target.value})} placeholder="Write your message here..." />
              ) : (
                <div className="w-full min-h-[14rem] rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 px-6 py-5 overflow-y-auto custom-scrollbar prose max-w-none text-slate-800">
                  <div dangerouslySetInnerHTML={{ __html: composeData.body.replace(/\n/g, '<br />') || '<p class="text-slate-400 italic">No content to preview yet...</p>' }} />
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-8 relative hover:bg-slate-100 hover:border-slate-400 transition-colors text-center cursor-pointer">
              <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <span className="text-4xl block mb-2">📎</span>
              <p className="text-lg font-black text-slate-700">Click or drag files here to attach</p>
              <p className="text-sm font-medium text-slate-500 mt-1">Supports PDFs, DOCX, Images, and Videos</p>
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                {files.map((file, i) => renderFilePreview(file, i))}
              </div>
            )}
          </form>
        </div>

        <div className="mt-6 flex justify-end gap-4 border-t border-slate-100 pt-6 shrink-0">
          <button type="button" onClick={onClose} className="rounded-2xl px-8 py-4 text-lg font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">Cancel</button>
          <button type="submit" form="composeForm" disabled={isSending} className="rounded-2xl bg-[#d2f34c] px-10 py-4 text-lg font-black text-slate-900 hover:bg-[#b8d839] transition-all shadow-lg shadow-[#d2f34c]/20 disabled:opacity-50 flex items-center gap-3">
            {isSending ? 'Sending...' : 'Send Mail'}
          </button>
        </div>

      </div>
    </div>
  );
}