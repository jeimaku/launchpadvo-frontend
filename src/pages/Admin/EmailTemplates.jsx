import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../../components/Sidebar';
import EmailSidebar from '../../components/EmailSidebar';
import ComposeEmailModal from '../../components/ComposeEmailModal';
import NotificationBell from '../../components/NotificationBell'; 
import launchpadLogo from '../../assets/launchpad-logo-dark.png'; 

const API_URL = `http://${window.location.hostname}:5000`;

// ==========================================
// THE PROFESSIONAL MASTER WRAPPER
// ==========================================
const BASE_TEMPLATE_WRAPPER = `
  <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
    <div style="text-align: center; background-color: #1e293b; border-bottom: 3px solid #d2f34c;">
      <img src="${launchpadLogo}" alt="Launchpad Banner" style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto;" />
    </div>
    <div style="padding: 40px 30px; color: #334155; line-height: 1.7; font-size: 15px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Greetings, [Client Name]!</h2>
      <p>Please replace this text with your professional message...</p>
      <br/>
      <p style="margin-bottom: 0;">Best Regards,<br/><strong style="color: #0f172a;">Launchpad Management Team</strong></p>
    </div>
  </div>
`;


export default function EmailTemplates() {
  const [currentView, setCurrentView] = useState('library'); 
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showComposeModal, setShowComposeModal] = useState(false);
  
  const [emailCounts, setEmailCounts] = useState({ inbox: 0, manual: 0, automated: 0 });
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [alertPrompt, setAlertPrompt] = useState({ isOpen: false, message: '', isError: false }); 
  
  // NEW: Search State
  const [searchTerm, setSearchTerm] = useState('');

  // NEW: Sample client for Live Preview
  const [previewClient, setPreviewClient] = useState(null);

  const [formData, setFormData] = useState({
    id: null,
    name: '',
    subject: '',
    body: BASE_TEMPLATE_WRAPPER,
    templateType: 'manual', 
    triggerEvent: '', 
    isHtml: true, 
    existingAttachments: [],
    newFiles: []
  });

  const [previewTemplate, setPreviewTemplate] = useState(null);

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const handleBackRequest = () => {
    setShowUnsavedModal(true);
  };

  const confirmLeave = () => {
    setShowUnsavedModal(false);
    resetForm();
    setCurrentView('library');
  };

  const userRole = localStorage.getItem('userRole') || '';
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  const editorRef = useRef(null);
  const savedRangeRef = useRef(null); 
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    insertOrderedList: false,
    insertUnorderedList: false
  });

  useEffect(() => {
    if (currentView === 'form' && editorRef.current) {
      if (editorRef.current.innerHTML !== formData.body) {
        editorRef.current.innerHTML = formData.body || '';
      }
    }
  }, [currentView, formData.id]);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/emails/templates`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map(t => ({
          ...t,
          templateType: t.template_type,
          triggerEvent: t.trigger_event,
          isHtml: t.is_html === 1,
          attachments: typeof t.attachments === 'string' ? JSON.parse(t.attachments) : (t.attachments || [])
        }));
        setSavedTemplates(formattedData);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

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
    } catch (error) { console.error('Error fetching email counts:', error); }
  };

  useEffect(() => {
    fetchTemplates();
    fetchEmailCounts(); 
    
    // --- NEW: Fetch one active client to use for the live preview ---
    const fetchPreviewClient = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/virtual-offices?branch=LPC`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          const clients = await res.json();
          const activeClient = clients.find(c => c.contract_status === 'Active');
          if (activeClient) setPreviewClient(activeClient);
        }
      } catch(e) { console.error(e); }
    };
    fetchPreviewClient();

    const socket = io(API_URL);
    socket.on('incoming_email', () => fetchEmailCounts());
    return () => socket.disconnect();
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
    setFormData({ id: null, name: '', subject: '', body: BASE_TEMPLATE_WRAPPER, templateType: 'manual', triggerEvent: '', isHtml: true, existingAttachments: [], newFiles: [] });
    setActiveFormats({ bold: false, italic: false, underline: false, insertOrderedList: false, insertUnorderedList: false });
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
      templateType: template.templateType || 'manual',
      triggerEvent: template.triggerEvent || '', 
      isHtml: true, 
      existingAttachments: template.attachments || [],
      newFiles: []
    });
    setCurrentView('form');
  };

  const handlePreviewClick = (template) => {
    setPreviewTemplate(template);
    setCurrentView('preview');
  };

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
    
    if (file && file.size > 2 * 1024 * 1024) {
      setAlertPrompt({ isOpen: true, message: "The image is too large. Please upload a file smaller than 2MB.", isError: true });
      e.target.value = null;
      return;
    }

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
          
          const imgTag = `<img src="${event.target.result}" style="width: 100%; max-width: 600px; height: auto; display: block; margin: 15px auto; border-radius: 8px;" alt="Embedded Image" />`;
          document.execCommand('insertHTML', false, imgTag);
          handleEditorInput();
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = null; 
  };

  // --- NEW: Click-to-Insert Smart Tag ---
  const insertSmartTag = (tagText) => {
    if (editorRef.current) {
      editorRef.current.focus();
      
      // Restore cursor position if it exists
      if (savedRangeRef.current) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
      }
      
      // Insert the text at the cursor
      document.execCommand('insertText', false, tagText);
      handleEditorInput();
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setFormData(prev => ({ ...prev, body: editorRef.current.innerHTML, isHtml: true }));
    }
  };

  const handleSetActive = async (templateId, triggerEvent) => {
    if (!templateId) return; 
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/emails/templates/${templateId}/activate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ trigger_event: triggerEvent })
      });

      if (response.ok) {
        await fetchTemplates(); 
        setAlertPrompt({ isOpen: true, message: "Automation rule updated successfully!", isError: false });
      }
    } catch (error) { console.error("Error setting active template:", error); }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();

    const strippedBody = formData.body.replace(/<[^>]*>?/gm, '').trim();
    if (!strippedBody && !formData.body.includes('<img')) {
      setAlertPrompt({ isOpen: true, message: "Please provide a message layout for the template before saving.", isError: true });
      return;
    }

    const fileDataPromises = formData.newFiles.map(async (file) => ({
      name: file.name, type: file.type, size: file.size, base64: await fileToBase64(file)
    }));
    const processedNewFiles = await Promise.all(fileDataPromises);
    const finalAttachments = [...formData.existingAttachments, ...processedNewFiles];

    const payload = {
      id: formData.id || Date.now().toString(), 
      name: formData.name,
      subject: formData.subject,
      body: formData.body,
      templateType: formData.templateType,
      triggerEvent: formData.templateType === 'automated' ? formData.triggerEvent : '', 
      isHtml: formData.isHtml,
      attachments: finalAttachments
    };

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/emails/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : ''},
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchTemplates(); 
        resetForm();
        setCurrentView('library');
        setAlertPrompt({ isOpen: true, message: "Template saved successfully!", isError: false });
      } else {
        throw new Error('Failed to save template to database.');
      }
    } catch (error) {
      setAlertPrompt({ isOpen: true, message: error.message, isError: true });
    }
  };

  const confirmDelete = (id) => setTemplateToDelete(id);

  const executeDelete = async () => {
    if (!templateToDelete) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/emails/templates/${templateToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });

      if (response.ok) {
        await fetchTemplates(); 
        setTemplateToDelete(null);
        setAlertPrompt({ isOpen: true, message: "Template deleted.", isError: false });
      }
    } catch (error) { console.error("Delete error:", error); }
  };

  const allTemplates = [ ...savedTemplates];

  // NEW: Search Filtering Logic
  const filteredTemplates = allTemplates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- UPGRADED: Dynamic Live Preview Renderer ---
  const renderSafePreviewBody = (htmlContent) => {
    if (!htmlContent) return '';
    
    // 1. Fix the Logo
    let content = htmlContent.replace(/src="([^"]*(launchpad-logo|launchpad-logo-dark|cid:launchpadLogo)[^"]*)"/gi, `src="${launchpadLogo}"`);

    // 2. Inject Real Data if we have a preview client
    if (previewClient) {
      const exactExpiryDate = previewClient.end_date 
        ? new Date(previewClient.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
        : 'May 8, 2026';
        
      const daysCalc = previewClient.end_date 
        ? Math.max(0, Math.ceil((new Date(previewClient.end_date) - new Date()) / (1000*60*60*24))) 
        : 7;

      content = content
        .replace(/\[Client Name\]/gi, previewClient.contact_person_1 || 'Client')
        .replace(/\[Company Name\]/gi, previewClient.company_name || 'Company')
        .replace(/\[Exact Expiry Date\]/gi, exactExpiryDate)
        .replace(/\[X\]/gi, daysCalc);
    }
    return content;
  };

  const renderDynamicSubject = (subject) => {
    if (!subject) return <span className="text-slate-300 italic font-medium">Subject line will appear here...</span>;
    if (!previewClient) return subject;
    return subject
      .replace(/\[Client Name\]/gi, previewClient.contact_person_1 || 'Client')
      .replace(/\[Company Name\]/gi, previewClient.company_name || 'Company');
  };
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      
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
        
        .rich-editor:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          font-weight: bold;
          pointer-events: none;
          display: block;
        }
      `}</style>

      <Sidebar />
      <main className="flex-1 p-8 relative flex flex-col h-full overflow-hidden">
        
        {/* --- PAGE HEADER --- */}
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
            
            {/* INNER CONTENT HEADER */}
            <div className="flex flex-col xl:flex-row gap-4 justify-between xl:items-center border-b border-slate-100 p-8 bg-slate-50/80 shrink-0">
              <div className="flex-1">
                <h3 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                  <span className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                  </span>
                  {currentView === 'library' && 'Template Library'}
                  {currentView === 'form' && (formData.id ? 'Edit Template' : 'Design New Template')}
                  {currentView === 'preview' && 'Template Preview'}
                  {currentView === 'automations' && 'Automation Engine'}
                </h3>
                <p className="text-base text-slate-500 font-medium mt-1">
                  {currentView === 'library' && 'Manage your pre-written emails and permanent attachments.'}
                  {currentView === 'form' && 'Create a beautiful, reusable email layout to save time.'}
                  {currentView === 'preview' && 'See exactly how this template will look when sent.'}
                  {currentView === 'automations' && 'Manage the rules for system-triggered emails.'}
                </p>
              </div>
              
              {currentView === 'library' && (
                <div className="flex flex-col sm:flex-row items-center gap-4 xl:w-auto w-full mt-4 xl:mt-0">
                  
                  {/* NEW: Search Input */}
                  <div className="relative w-full sm:w-64 shrink-0">
                    <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input 
                      type="text" 
                      placeholder="Search templates..." 
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={() => setCurrentView('automations')} className="flex-1 sm:flex-none rounded-xl bg-slate-800 px-5 py-2.5 font-bold text-white text-sm shadow-sm hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      Rules
                    </button>
                    <button onClick={() => { resetForm(); setCurrentView('form'); }} className="flex-1 sm:flex-none rounded-xl bg-[#d2f34c] px-5 py-2.5 font-bold text-slate-900 text-sm shadow-sm hover:bg-[#b8d839] transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                      New
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================== */}
            {/* VIEW: LIBRARY                              */}
            {/* ========================================== */}
            {currentView === 'library' && (
              <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-slate-50/30">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center text-slate-500 font-medium py-16 flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <p className="text-base font-semibold mb-1">
                      {searchTerm ? "No templates match your search." : "No templates found."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-w-6xl mx-auto">
                    {filteredTemplates.map(t => {
                      // --- DYNAMIC DISTINCTION STYLING ---
                      let accentBorder = 'border-l-blue-500';
                      let badgeStyle = 'text-blue-700 bg-blue-50 border-blue-200';
                      let iconColor = 'text-blue-600';
                      
                      if (t.templateType === 'automated') {
                        if (t.triggerEvent === 'notice_of_termination') {
                          accentBorder = 'border-l-rose-500';
                          badgeStyle = 'text-rose-700 bg-rose-50 border-rose-200';
                          iconColor = 'text-rose-500';
                        } else if (t.triggerEvent === 'document_request') {
                          accentBorder = 'border-l-amber-500';
                          badgeStyle = 'text-amber-700 bg-amber-50 border-amber-200';
                          iconColor = 'text-amber-500';
                        } else {
                          accentBorder = 'border-l-purple-500';
                          badgeStyle = 'text-purple-700 bg-purple-50 border-purple-200';
                          iconColor = 'text-purple-500';
                        }
                      }

                      return (
                        <div key={t.id} className={`bg-white border border-slate-200 border-l-4 ${accentBorder} hover:shadow-md rounded-xl p-4 sm:px-6 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group`}>
                          
                          <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                            {/* Minimalist Colored Icon */}
                            <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border border-slate-100 bg-slate-50 shadow-sm ${iconColor}`}>
                              {t.isSystem ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>
                              ) : t.templateType === 'automated' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                              )}
                            </div>
                            
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-0.5">
                                <h5 className="font-bold text-slate-800 text-base truncate">{t.name}</h5>
                                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${badgeStyle}`}>
                                  {t.templateType === 'automated' 
                                    ? (t.triggerEvent === 'notice_of_termination' ? 'Termination Rule' : t.triggerEvent === 'document_request' ? 'Document Rule' : 'Renewal Rule') 
                                    : 'Manual Use'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate w-full">
                                <span className="font-semibold text-slate-700">Subject:</span> {t.subject}
                                <span className="text-slate-300 font-normal mx-2">|</span>
                                <span>{getEmailSnippet(t.body)}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end mt-2 md:mt-0">
                            <span className="text-xs font-semibold px-2 py-1 rounded flex items-center gap-1.5 text-slate-500">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                              {t.attachments?.length || 0} Files
                            </span>

                            <div className="flex items-center gap-2">
                              <button onClick={() => handlePreviewClick(t)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm">
                                Preview
                              </button>
                              {!t.isSystem && (
                                <>
                                  <button onClick={() => handleEditClick(t)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm">
                                    Edit
                                  </button>
                                  
                                  <button onClick={() => confirmDelete(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Delete Template">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================== */}
            {/* VIEW: SPLIT-SCREEN FORM & LIVE PREVIEW     */}
            {/* ========================================== */}
            {currentView === 'form' && (
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row w-full bg-slate-50">

              {/* ================= LEFT COLUMN: EDITOR FORM ================= */}
                <div className="w-full lg:w-[50%] xl:w-[45%] flex flex-col h-full border-r border-slate-200 relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] shrink-0">
                  
                  {/* Sticky Header & Back Button */}
                  <div className="px-6 py-4 sm:px-8 sm:py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                    <button type="button" onClick={handleBackRequest} className="text-sm font-bold text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors group">
                      <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Library
                    </button>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 uppercase tracking-widest px-3 py-1 rounded-md hidden sm:block">Editor Mode</span>
                  </div>

                  {/* Scrollable Editor Area */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 bg-slate-50/50">
                    <form id="templateForm" onSubmit={handleSaveTemplate} className="space-y-10 max-w-3xl mx-auto pb-6">
                      
                      {/* 1. Template Details */}
                      <div>
                        <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide border-b border-slate-200 pb-2"><span className="text-[#b8d839] text-lg">1.</span> Template Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="mb-2 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Template Name</label>
                            <input required type="text" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#b8d839] transition-all placeholder:text-slate-400" 
                              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Final Warning Notice" />
                          </div>
                          <div>
                            <label className="mb-2 block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Default Subject Line</label>
                            <input required type="text" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#d2f34c] focus:border-[#b8d839] transition-all placeholder:text-slate-400" 
                              value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} placeholder="e.g., Action Required..." />
                          </div>
                        </div>
                      </div>

                      {/* 2. Automation Settings */}
                      <div>
                        <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide border-b border-slate-200 pb-2"><span className="text-[#b8d839] text-lg">2.</span> Automation Settings</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-900 rounded-2xl shadow-inner border border-slate-800 relative overflow-hidden">
                          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#d2f34c] rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
                          
                          <div className="relative z-10">
                            <label className="mb-2.5 block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Template Usage</label>
                            <select className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#d2f34c] transition-all cursor-pointer" 
                              value={formData.templateType} onChange={(e) => setFormData({...formData, templateType: e.target.value})}>
                              <option value="manual">Manual Use</option>
                              <option value="automated">Automated Rule</option>
                            </select>
                          </div>

                          {formData.templateType === 'automated' ? (
                            <div className="relative z-10 animate-fade-in">
                              <label className="mb-2.5 block text-[10px] font-bold text-purple-400 uppercase tracking-widest">System Trigger *</label>
                              <select required className="w-full rounded-xl border border-purple-500/50 bg-purple-900/50 px-4 py-3 text-sm font-bold text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all cursor-pointer"
                                value={formData.triggerEvent} onChange={(e) => setFormData({...formData, triggerEvent: e.target.value})}>
                                <option value="" disabled>-- Select Trigger --</option>
                                <option value="subscription_renewal">Pre-Expiry Warning</option>
                                <option value="notice_of_termination">Notice of Termination</option>
                                <option value="document_request">Document Request</option>
                              </select>
                            </div>
                          ) : (
                            <div className="relative z-10 flex items-center opacity-60">
                              <p className="text-[11px] font-medium text-slate-400 leading-relaxed mt-5">Available in 'Compose Email' for manual sending.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3. Rich Text Editor */}
                      <div>
                        <div className="flex justify-between items-end mb-4 border-b border-slate-200 pb-2">
                          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                            <span className="text-[#b8d839] text-lg">3.</span> Message Layout
                          </h4>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded uppercase tracking-tight flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Max Image 1MB
                          </span>
                        </div>

                        {/* --- INTERACTIVE SMART TAGS UI --- */}
                        <div className="mb-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                             <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                               <span className="text-blue-500 text-sm"></span> Interactive Smart Tags
                             </h5>
                             <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">Click to insert at cursor</span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button type="button" onClick={() => insertSmartTag('[Client Name]')} className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all group text-left shadow-sm hover:shadow">
                              <code className="text-xs font-black text-slate-700 group-hover:text-blue-700 transition-colors">[Client Name]</code>
                              <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">Contact Person</span>
                            </button>
                            
                            <button type="button" onClick={() => insertSmartTag('[Company Name]')} className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all group text-left shadow-sm hover:shadow">
                              <code className="text-xs font-black text-slate-700 group-hover:text-blue-700 transition-colors">[Company Name]</code>
                              <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">Client's Company</span>
                            </button>

                            <button type="button" onClick={() => insertSmartTag('[Exact Expiry Date]')} className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all group text-left shadow-sm hover:shadow">
                              <code className="text-xs font-black text-slate-700 group-hover:text-blue-700 transition-colors">[Exact Expiry Date]</code>
                              <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">e.g., May 8, 2026</span>
                            </button>

                            <button type="button" onClick={() => insertSmartTag('[X]')} className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all group text-left shadow-sm hover:shadow">
                              <code className="text-xs font-black text-slate-700 group-hover:text-blue-700 transition-colors">[X]</code>
                              <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">Days Remaining</span>
                            </button>
                          </div>
                        </div>
                          
                        <div className="border border-slate-300 rounded-xl shadow-sm bg-white focus-within:ring-2 focus-within:ring-[#d2f34c] focus-within:border-[#b8d839] transition-all relative overflow-hidden">

                          <div ref={editorRef} contentEditable onInput={() => { handleEditorInput(); saveSelection(); }} onBlur={() => { handleEditorInput(); saveSelection(); }} onKeyUp={() => { checkActiveFormats(); saveSelection(); }} onMouseUp={() => { checkActiveFormats(); saveSelection(); }} className="rich-editor w-full min-h-[300px] max-h-[500px] overflow-y-auto p-6 outline-none text-sm text-slate-800 leading-relaxed custom-scrollbar prose max-w-none relative z-0" data-placeholder="Design your template here. Use tags like [Client Name] or [Exact Expiry Date]." />
                        </div>
                      </div>

                      {/* 4. Attachments */}
                      <div>
                        <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide border-b border-slate-200 pb-2"><span className="text-[#b8d839] text-lg">4.</span> Permanent Attachments</h4>
                        <div className="bg-white border-2 border-dashed border-slate-300 hover:border-[#b8d839] hover:bg-[#d2f34c]/5 rounded-2xl p-6 transition-all text-center cursor-pointer group shadow-sm relative">
                          <input type="file" multiple onChange={(e) => { if(e.target.files) setFormData({...formData, newFiles: [...formData.newFiles, ...Array.from(e.target.files)]}) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          <svg className="mx-auto h-8 w-8 text-slate-400 group-hover:text-[#b8d839] transition-colors mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <p className="text-sm font-bold text-slate-700">Click or drag files here to attach</p>
                        </div>
                        {(formData.existingAttachments.length > 0 || formData.newFiles.length > 0) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            {formData.existingAttachments.map((f, i) => (
                              <div key={`old-${i}`} className="flex justify-between items-center bg-white border border-slate-200 px-4 py-3 rounded-lg shadow-sm">
                                <span className="text-xs font-bold text-slate-700 truncate flex items-center gap-2">
                                  <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                  {f.name}
                                </span>
                                <button type="button" onClick={() => setFormData({...formData, existingAttachments: formData.existingAttachments.filter((_, idx) => idx !== i)})} className="text-slate-400 hover:text-red-500 font-black p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                              </div>
                            ))}
                            {formData.newFiles.map((f, i) => (
                              <div key={`new-${i}`} className="flex justify-between items-center bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg shadow-sm">
                                <span className="text-xs font-bold text-emerald-800 truncate flex items-center gap-2">
                                  <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                  {f.name}
                                </span>
                                <button type="button" onClick={() => setFormData({...formData, newFiles: formData.newFiles.filter((_, idx) => idx !== i)})} className="text-emerald-400 hover:text-red-500 font-black p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </form>
                  </div>

                  {/* Sticky Footer (Left Column) */}
                  <div className="bg-white border-t border-slate-200 px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between shrink-0 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.02)]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block flex-1">Watch live updates on the right &rarr;</p>
                    <button type="submit" form="templateForm" className="rounded-xl bg-[#d2f34c] px-8 py-3 text-sm font-black text-slate-900 hover:bg-[#b8d839] hover:-translate-y-0.5 transition-all shadow-lg shadow-[#d2f34c]/20 uppercase tracking-wide w-full sm:w-auto">
                      {formData.id ? 'Save Changes' : 'Publish Template'}
                    </button>
                  </div>
                </div>

                s{/* ================= RIGHT COLUMN: LIVE PREVIEW ================= */}
                <div className="hidden lg:flex flex-1 bg-slate-200/60 p-4 lg:p-6 xl:p-8 overflow-y-auto custom-scrollbar flex-col relative border-l border-slate-300/60">
                   
                   <div className="sticky top-0 z-10 flex flex-col gap-3 mb-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-slate-500 uppercase tracking-widest text-[11px] flex items-center gap-2 bg-slate-200/80 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-slate-300/50">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        Live Client Preview
                      </h4>
                      
                      {/* Display the mock client being used */}
                      {previewClient && (
                        <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-300/50 shadow-sm text-[10px] font-bold text-slate-500 flex items-center gap-2">
                          Data Source: <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{previewClient.company_name}</span>
                        </div>
                      )}
                    </div>

                    {/* --- NEW: Sample Data Notice --- */}
                    <div className="bg-blue-50/90 backdrop-blur-sm border border-blue-200 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                       <span className="text-blue-500 text-base leading-none mt-0.5">ℹ️</span>
                       <p className="text-xs font-medium text-blue-800 leading-relaxed">
                         <strong>Note:</strong> The system is using sample data from an active client to display exactly how this email will look when sent to your virtual office clients.
                       </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col w-full max-w-[600px] mx-auto transition-all">
                     
                      {/* Fake Gmail Header */}
                     <div className="border-b border-slate-100 p-6 bg-white flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden p-2 shadow-inner">
                          <img src={launchpadLogo} alt="Logo" className="w-full h-full object-contain opacity-80" />
                        </div>
                        <div className="flex-1 pt-0.5 min-w-0">
                           {/* UPGRADED: Dynamic Subject Line */}
                           <h2 className="text-xl font-bold text-slate-900 leading-tight truncate" title={formData.subject}>
                             {renderDynamicSubject(formData.subject)}
                           </h2>
                           <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                             <span className="font-bold text-slate-700">Launchpad Virtual Office</span>
                             <span className="text-xs hidden xl:inline-block truncate">&lt;admin@launchpadcoworkingph.com&gt;</span>
                           </p>
                        </div>
                     </div>

                    {/* --- THE ACTUAL EMAIL BODY PREVIEW --- */}
                     <div className="text-base text-slate-800 bg-white p-4 sm:p-6 min-h-[300px] flex justify-center border-b border-slate-100 overflow-x-auto">
                        {formData.isHtml ? (
                          <div className="prose max-w-none text-slate-700 w-full flex flex-col items-center" dangerouslySetInnerHTML={{ __html: renderSafePreviewBody(formData.body) }} />
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }} className="text-slate-700 leading-relaxed w-full">
                            {formData.body}
                          </div>
                        )}
                     </div>
                     {/* -------------------------------------------------- */}

                     {/* Fake Gmail Attachments */}
                     {(formData.existingAttachments.length > 0 || formData.newFiles.length > 0) && (
                       <div className="bg-slate-50 border-t border-slate-100 p-6">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                            Attachments ({(formData.existingAttachments.length + formData.newFiles.length)})
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {formData.existingAttachments.map((f, i) => (
                               <span key={`old-prev-${i}`} className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                 {f.name}
                               </span>
                            ))}
                            {formData.newFiles.map((f, i) => (
                               <span key={`new-prev-${i}`} className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                 {f.name}
                               </span>
                            ))}
                          </div>
                       </div>
                     )}

                  </div>
                </div>

              </div>
            )}

            {/* ========================================== */}
            {/* VIEW: AUTOMATION RULES ENGINE              */}
            {/* ========================================== */}
            {currentView === 'automations' && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50/80">
                <div className="max-w-6xl mx-auto">
                  <button onClick={() => setCurrentView('library')} className="mb-6 text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-2 transition-colors w-max group">
                    <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Library
                  </button>

                  <div className="mb-10">
                     <h2 className="text-3xl font-black text-slate-900">Automation Engine</h2>
                     <p className="text-slate-500 font-medium mt-2 text-base">Select which templates the system should automatically send for each specific trigger event.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {[
                        { 
                          id: 'subscription_renewal', title: 'Pre-Expiry Warnings', desc: 'Fires every 7 days when a contract has < 30 days remaining.', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
                          icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        },
                        { 
                          id: 'notice_of_termination', title: 'Notice of Termination', desc: 'Fires exactly 30 days after the contract expiration date.', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700',
                          icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        },
                        { 
                          id: 'document_request', title: 'Document Request', desc: 'Fires exactly 90 days after expiration if documents are not surrendered.', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
                          icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                        }
                     ].map(rule => {
                        const activeTemplate = savedTemplates.find(t => t.triggerEvent === rule.id && (t.is_active === 1 || t.is_active === true));
                        const availableTemplates = savedTemplates.filter(t => t.triggerEvent === rule.id);

                        return (
                          <div key={rule.id} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow relative overflow-hidden">
                             <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-40 pointer-events-none ${rule.bg}`}></div>
                             
                             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${rule.bg} ${rule.text} border ${rule.border} relative z-10 shadow-sm`}>
                                {rule.icon}
                             </div>
                             
                             <h3 className="font-black text-xl text-slate-900 relative z-10">{rule.title}</h3>
                             <p className="text-sm text-slate-500 font-medium mb-8 mt-2 relative z-10 leading-relaxed">{rule.desc}</p>

                             <div className="mt-auto pt-5 border-t border-slate-100 relative z-10">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Currently Active Template</label>
                                <select
                                  className={`w-full rounded-xl border-2 px-4 py-3 text-sm font-bold outline-none cursor-pointer transition-all ${
                                      activeTemplate ? 'bg-emerald-50 border-emerald-200 text-emerald-800 focus:border-emerald-400' : 'bg-slate-50 border-slate-200 text-slate-600 focus:border-slate-400'
                                  }`}
                                  value={activeTemplate ? activeTemplate.id : ''}
                                  onChange={(e) => handleSetActive(e.target.value, rule.id)}
                                >
                                   <option value="" disabled>-- Select a Template --</option>
                                   {availableTemplates.map(t => (
                                     <option key={t.id} value={t.id}>{t.name}</option>
                                   ))}
                                </select>
                                
                                {availableTemplates.length === 0 && (
                                   <div className="mt-3 flex items-start gap-2 bg-rose-50 p-3 rounded-lg border border-rose-100">
                                      <svg className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                      <p className="text-xs text-rose-700 font-medium">No templates exist for this trigger yet.</p>
                                   </div>
                                )}
                             </div>
                          </div>
                        )
                     })}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* VIEW: PREVIEW                              */}
            {/* ========================================== */}
            {currentView === 'preview' && previewTemplate && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-100/50 flex flex-col">
                <div className="max-w-4xl mx-auto w-full">
                  <button onClick={() => setCurrentView('library')} className="mb-6 text-sm font-bold text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors w-max group">
                    <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Library
                  </button>

                  <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
                    <div className="border-b border-slate-100 p-6 bg-slate-50/80 flex items-start gap-4">
                       <div className="h-14 w-14 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 shadow-inner border border-slate-300">
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                       </div>
                       <div className="flex-1 pt-1">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subject</h4>
                          <h2 className="text-2xl font-bold text-slate-900">{previewTemplate.subject}</h2>
                       </div>
                    </div>

                    <div className="text-base text-slate-800 bg-white p-8 min-h-[300px] flex justify-center">
                      {previewTemplate.isHtml ? (
                        <div className="prose max-w-none text-slate-700 w-full flex flex-col items-center" dangerouslySetInnerHTML={{ __html: renderSafePreviewBody(previewTemplate.body) }} />
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }} className="text-slate-700 leading-relaxed w-full">
                          {previewTemplate.body}
                        </div>
                      )}
                    </div>

                    {previewTemplate.attachments && previewTemplate.attachments.length > 0 && (
                      <div className="bg-slate-50 border-t border-slate-200 p-6">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                          Attachments ({previewTemplate.attachments.length})
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {previewTemplate.attachments.map((att, index) => (
                             <div key={index} className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-sm">
                               <svg className="w-6 h-6 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                               <span className="text-sm font-bold text-slate-700">{att.name}</span>
                             </div>
                          ))}
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

      {/* --- MODALS --- */}
      {templateToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-rose-100 mb-6 text-rose-500 shadow-inner">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Template?</h3>
            <p className="text-slate-500 font-medium text-base mb-8">This action cannot be undone. You will lose this template and its attachments.</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setTemplateToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wide">
                Cancel
              </button>
              <button onClick={executeDelete} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-sm transition-all text-sm uppercase tracking-wide">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {alertPrompt.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 animate-modal-pop">
            <div className={`mx-auto flex items-center justify-center h-20 w-20 rounded-full mb-6 shadow-inner ${alertPrompt.isError ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-500'}`}>
              {alertPrompt.isError ? (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
              )}
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{alertPrompt.isError ? 'Error' : 'Success'}</h3>
            <p className="text-slate-500 font-medium text-base mb-8">{alertPrompt.message}</p>
            <button onClick={() => setAlertPrompt({ isOpen: false, message: '', isError: false })} className="w-full px-5 py-3 rounded-xl font-bold text-slate-900 bg-[#d2f34c] hover:bg-[#b8d839] shadow-sm transition-all text-sm uppercase tracking-wide">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* --- UNSAVED CHANGES WARNING MODAL --- */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-modal-pop">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-amber-100 mb-6 text-amber-500 shadow-inner">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Unsaved Progress</h3>
            <p className="text-slate-500 font-medium text-base mb-8 leading-relaxed">Are you sure you want to leave the editor? Any unsaved formatting or layout changes will be lost permanently.</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setShowUnsavedModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-xs uppercase tracking-wide">
                Keep Editing
              </button>
              <button onClick={confirmLeave} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl shadow-sm transition-all text-xs uppercase tracking-wide">
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {showComposeModal && <ComposeEmailModal onClose={() => setShowComposeModal(false)} onSendSuccess={(msg) => { setAlertPrompt({ isOpen: true, message: msg, isError: false }); setShowComposeModal(false); fetchEmailCounts(); }} />}
    </div>
  );
}