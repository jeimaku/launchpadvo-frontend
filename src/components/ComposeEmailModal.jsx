import React, { useState, useEffect, useRef } from 'react';

const API_URL = `http://${window.location.hostname}:5000`;

export default function ComposeEmailModal({ onClose, onSendSuccess }) {
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [files, setFiles] = useState([]); 
  const [isSending, setIsSending] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  
  // References for the editor and cursor tracking
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null); 

  // --- TRACK ACTIVE FORMATTING STATES ---
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    insertOrderedList: false,
    insertUnorderedList: false
  });

  // --- FETCH TEMPLATES FROM DATABASE ---
  useEffect(() => {
    const fetchManualTemplates = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/emails/templates`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (response.ok) {
          const data = await response.json();
          // Ensure we catch 'manual' templates regardless of API casing
          const manualTemplates = data.filter(t => t.template_type === 'manual' || t.templateType === 'manual');
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

    const template = availableTemplates.find(t => t.id === templateId || t.id === Number(templateId));
    if (template) {
      const rawHTML = template.body || '';
      
      setComposeData(prev => ({ 
        ...prev, 
        subject: template.subject, 
        body: rawHTML
      }));

      if (editorRef.current) {
        editorRef.current.innerHTML = rawHTML;
      }
      
      const parsedAttachments = typeof template.attachments === 'string' ? JSON.parse(template.attachments) : (template.attachments || []);
      const reconstructedFiles = parsedAttachments.map(att => 
        dataURLtoFile(att.base64, att.name, att.type)
      );
      
      setFiles(prev => [...prev, ...reconstructedFiles]);
    }
  };

  // --- RICH TEXT EDITOR FUNCTIONS ---
  
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && editorRef.current && editorRef.current.contains(selection.anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0);
    }
  };

  const checkActiveFormats = () => {
    if (!editorRef.current) return;
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    });
  };

  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    handleEditorInput();
    checkActiveFormats(); 
  };

  const handleInlineImage = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        
        if (editorRef.current) {
          editorRef.current.focus();
          
          if (savedRangeRef.current) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedRangeRef.current);
          }

          const imgTag = `<br/><img src="${event.target.result}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" alt="Embedded Image" /><br/><br/>`;
          document.execCommand('insertHTML', false, imgTag);
          handleEditorInput();
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = null; 
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setComposeData(prev => ({ ...prev, body: editorRef.current.innerHTML }));
    }
  };

  // --- STANDARD FILE ATTACHMENTS ---
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

    const strippedBody = composeData.body.replace(/<[^>]*>?/gm, '').trim();
    if (!strippedBody && !composeData.body.includes('<img')) {
      alert("Please provide a message body before sending.");
      return;
    }

    setIsSending(true);
    try {
      const token = localStorage.getItem('token'); 
      const formData = new FormData();
      formData.append('to', composeData.to);
      formData.append('subject', composeData.subject);
      formData.append('body', composeData.body);
      
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }

        .rich-editor:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          font-weight: bold;
          pointer-events: none;
          display: block;
        }

        .rich-editor ul { list-style-type: disc; margin-left: 1.5rem; padding-left: 1rem; }
        .rich-editor ol { list-style-type: decimal; margin-left: 1.5rem; padding-left: 1rem; }
      `}</style>

      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/85 backdrop-blur-sm p-4 md:p-6" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        
        <div className="w-full max-w-5xl rounded-2xl bg-white shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-slate-700 flex flex-col max-h-[95vh] animate-modal-fade overflow-hidden ring-1 ring-white/10">
          
          <div className="flex items-center justify-between border-b border-slate-700 p-6 bg-slate-900 shrink-0">
            <h3 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="text-3xl">✉️</span> Compose Email
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-red-500 rounded-full h-10 w-10 flex items-center justify-center transition-all shadow-sm outline-none">
              <span className="text-xl font-bold leading-none -mt-0.5">✕</span>
            </button>
          </div>

          <div className="overflow-y-auto custom-scrollbar p-6 md:p-8 flex-1 bg-slate-50">
            
            {/* PERMANENT TEMPLATE SELECTOR UI */}
            <div className="mb-8 bg-blue-50 p-5 rounded-xl border border-blue-200 flex items-center gap-4 shadow-sm">
              <span className="text-3xl">📋</span>
              <div className="flex-1">
                <label className="block text-xs font-bold text-blue-800 uppercase tracking-widest mb-2">Load Pre-saved Template (Optional)</label>
                <select 
                  onChange={handleTemplateSelect} 
                  defaultValue="" 
                  disabled={availableTemplates.length === 0}
                  className="w-full bg-white border border-blue-300 rounded-lg px-4 py-2.5 text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-shadow disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {availableTemplates.length === 0 ? (
                    <option value="" disabled>No manual templates available. Create one in the Library!</option>
                  ) : (
                    <>
                      <option value="" disabled>Select a template to auto-fill...</option>
                      {availableTemplates.map(t => {
                        const fileCount = (typeof t.attachments === 'string' ? JSON.parse(t.attachments) : (t.attachments || [])).length;
                        return (
                          <option key={t.id} value={t.id}>{t.name} ({fileCount} files)</option>
                        );
                      })}
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="mb-6 px-5 py-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-emerald-800 text-sm shadow-sm">
              <p className="font-bold mb-1 uppercase tracking-wide text-xs">✨ Free-Form Editing Enabled</p>
              <p className="font-medium">You have full control over the layout. Use the formatting toolbar below to seamlessly mix text, lists, and inline images exactly how you want them to appear to the recipient.</p>
            </div>

            <form id="composeForm" onSubmit={handleSendEmail} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600 uppercase tracking-widest">To (Email Address)</label>
                  <input required type="email" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#b8d839] transition-all placeholder:font-bold placeholder:text-slate-400" 
                    value={composeData.to} onChange={(e) => setComposeData({...composeData, to: e.target.value})} placeholder="client@company.com" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-600 uppercase tracking-widest">Subject</label>
                  <input required type="text" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#b8d839] transition-all placeholder:font-bold placeholder:text-slate-400" 
                    value={composeData.subject} onChange={(e) => setComposeData({...composeData, subject: e.target.value})} placeholder="Virtual Office Inquiry" />
                </div>
              </div>
              
              {/* RICH TEXT EDITOR */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-600 uppercase tracking-widest">Message Layout</label>
                <div className="border border-slate-300 rounded-xl shadow-sm bg-white focus-within:ring-2 focus-within:ring-[#d2f34c] focus-within:border-[#b8d839] transition-all relative">
                  
                  {/* Formatting Toolbar */}
                  <div className="flex flex-wrap items-center gap-1 bg-slate-100 border-b border-slate-300 p-2 rounded-t-xl relative z-10">
                    
                    <button 
                      type="button" 
                      onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }} 
                      className={`relative group w-8 h-8 flex items-center justify-center rounded font-bold transition-all ${
                        activeFormats.bold ? 'bg-slate-300 text-slate-900 shadow-inner ring-1 ring-slate-400' : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      B
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-blue-600 text-white text-[11px] font-black px-2.5 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-50">Bold Text</span>
                    </button>
                    
                    <button 
                      type="button" 
                      onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }} 
                      className={`relative group w-8 h-8 flex items-center justify-center rounded italic transition-all ${
                        activeFormats.italic ? 'bg-slate-300 text-slate-900 shadow-inner ring-1 ring-slate-400' : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      I
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-purple-600 text-white text-[11px] font-black px-2.5 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-50">Italic Text</span>
                    </button>
                    
                    <button 
                      type="button" 
                      onMouseDown={(e) => { e.preventDefault(); handleFormat('underline'); }} 
                      className={`relative group w-8 h-8 flex items-center justify-center rounded underline transition-all ${
                        activeFormats.underline ? 'bg-slate-300 text-slate-900 shadow-inner ring-1 ring-slate-400' : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      U
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-pink-600 text-white text-[11px] font-black px-2.5 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-50">Underline</span>
                    </button>
                    
                    <div className="w-px h-5 bg-slate-300 mx-2"></div> 
                    
                    <button 
                      type="button" 
                      onMouseDown={(e) => { e.preventDefault(); handleFormat('insertOrderedList'); }} 
                      className={`relative group px-3 h-8 flex items-center justify-center rounded font-bold text-sm transition-all ${
                        activeFormats.insertOrderedList ? 'bg-slate-300 text-slate-900 shadow-inner ring-1 ring-slate-400' : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      1.
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-amber-600 text-white text-[11px] font-black px-2.5 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-50">Numbered List</span>
                    </button>
                    
                    <button 
                      type="button" 
                      onMouseDown={(e) => { e.preventDefault(); handleFormat('insertUnorderedList'); }} 
                      className={`relative group px-3 h-8 flex items-center justify-center rounded font-black text-xl leading-none transition-all ${
                        activeFormats.insertUnorderedList ? 'bg-slate-300 text-slate-900 shadow-inner ring-1 ring-slate-400' : 'hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      •
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-teal-600 text-white text-[11px] font-black px-2.5 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-50">Bullet Points</span>
                    </button>
                    
                    <div className="w-px h-5 bg-slate-300 mx-2"></div> 
                    
                    <label 
                      onMouseDown={saveSelection}
                      className="relative group px-3 h-8 flex items-center gap-2 hover:bg-emerald-100 text-emerald-700 rounded font-bold text-sm cursor-pointer transition-colors border border-transparent hover:border-emerald-200"
                    >
                      <span>🖼️ Insert Image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleInlineImage} />
                      <span className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-emerald-600 text-white text-[11px] font-black px-2.5 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-50">Embed a Photo</span>
                    </label>
                  </div>

                  {/* Editable Content Area */}
                  <div
                    ref={editorRef}
                    contentEditable
                    onInput={() => { handleEditorInput(); saveSelection(); }}
                    onBlur={() => { handleEditorInput(); saveSelection(); }}
                    onKeyUp={() => { checkActiveFormats(); saveSelection(); }}   
                    onMouseUp={() => { checkActiveFormats(); saveSelection(); }} 
                    className="rich-editor w-full min-h-[300px] max-h-[500px] overflow-y-auto p-5 outline-none text-base text-slate-800 leading-relaxed custom-scrollbar prose max-w-none rounded-b-xl relative z-0"
                    data-placeholder="Start drafting your email here. You can click 'Insert Image' above to drop photos directly into this text..."
                  />
                </div>
              </div>

              {/* STANDARD ATTACHMENTS */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <label className="mb-2 block text-xs font-bold text-slate-600 uppercase tracking-widest">Standard File Attachments</label>
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 relative hover:bg-slate-50 hover:border-slate-400 transition-colors text-center cursor-pointer group shadow-sm">
                  <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <svg className="mx-auto h-10 w-10 text-slate-400 group-hover:text-slate-600 transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="text-base font-bold text-slate-700">Click or drag files here to attach</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">Use this area for formal documents (PDFs, Word files, Zips)</p>
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-5">
                    {files.map((file, i) => renderFilePreview(file, i))}
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 p-6 bg-white shrink-0 flex justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 relative">
            <button type="button" onClick={onClose} className="rounded-xl px-8 py-3 text-base font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-colors">
              Cancel
            </button>
            <button type="submit" form="composeForm" disabled={isSending} className="rounded-xl bg-[#d2f34c] px-10 py-3 text-base font-black text-slate-900 hover:bg-[#b8d839] transition-all shadow-md shadow-[#d2f34c]/30 disabled:opacity-50 flex items-center gap-2 uppercase tracking-wider hover:-translate-y-0.5">
              {isSending ? 'Sending...' : 'Send Email Now'}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}