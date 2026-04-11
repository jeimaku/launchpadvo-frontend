import React, { useState, useEffect } from 'react';
import md5 from 'md5'; 
import launchpadLogo from '../assets/launchpad-logo2.png'; 
import launchpadBanner from '../assets/launchpad-logo-dark.png';

export default function EmailViewModal({ email, onClose, formatExactDateTime, systemEmail }) {
  const [displayEmail, setDisplayEmail] = useState(email);
  const [isClosing, setIsClosing] = useState(false);
  const [isAttachmentsExpanded, setIsAttachmentsExpanded] = useState(true);

  useEffect(() => {
    if (email) {
      setDisplayEmail(email);
      setIsClosing(false);
      setIsAttachmentsExpanded(true); 
    } else if (!email && displayEmail) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setDisplayEmail(null);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [email, displayEmail]);

  const handleClose = () => {
    onClose(); 
  };

  if (!displayEmail) return null;

  const forceDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download file. It may be missing from the server.");
    }
  };

  const getGravatarUrl = (emailAddress) => {
    if (emailAddress === systemEmail) return launchpadLogo;
    const cleanEmail = emailAddress.trim().toLowerCase();
    const hash = md5(cleanEmail);
    // d=404 forces Gravatar to return an error if no profile pic exists, triggering our slick fallback!
    return `https://www.gravatar.com/avatar/${hash}?s=128&d=404`;
  };

  const getFallbackAvatar = (emailAddress, name) => {
    if (emailAddress === systemEmail) return launchpadLogo;
    let displayName = emailAddress.split('@')[0];
    if (name && name.trim() !== '' && name !== emailAddress) {
      displayName = name;
    }
    // Generates a beautiful initials avatar using Launchpad's dark slate and neon green colors
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e293b&color=d2f34c&rounded=true&bold=true&size=128&length=2`;
  };

  const sortedAttachments = [...(displayEmail.attachments || [])].sort((a, b) => {
    const getWeight = (type, filename) => {
      if (type?.startsWith('image/')) return 1;
      if (type?.startsWith('video/')) return 2;
      if (type === 'application/pdf' || filename?.toLowerCase().endsWith('.pdf')) return 3;
      return 4; 
    };
    return getWeight(a.type, a.filename) - getWeight(b.type, b.filename);
  });

  const renderAttachment = (att, index) => {
    const isImage = att.type?.startsWith('image/');
    const isVideo = att.type?.startsWith('video/');
    const isPDF = att.type === 'application/pdf' || att.filename?.toLowerCase().endsWith('.pdf');
    const isDoc = att.filename?.toLowerCase().match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i);
    
    // BEAUTIFUL STATIC ICONS FOR EVERY FILE TYPE
    let svgIcon;
    if (isImage) {
      svgIcon = <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>;
    } else if (isPDF) {
      svgIcon = <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>;
    } else if (isVideo) {
      svgIcon = <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>;
    } else if (isDoc) {
      svgIcon = <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
    } else {
      svgIcon = <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>;
    }

    const fileExt = att.filename?.split('.').pop()?.toUpperCase().substring(0, 4) || 'FILE';
    
    return (
      <div key={index} className="group flex items-center justify-between p-3 border border-slate-200 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-[#d2f34c] transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 shadow-inner">
            {svgIcon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate" title={att.filename}>{att.filename}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{fileExt} FILE</p>
          </div>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); forceDownload(att.url, att.filename || 'download'); }}
          className="p-2 ml-3 shrink-0 rounded-lg bg-slate-50 text-slate-500 hover:bg-[#d2f34c] hover:text-slate-900 transition-colors border border-transparent hover:border-[#b8d839]"
          title="Download File"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  };

  const renderSafeBody = (htmlContent) => {
    if (!htmlContent) return '';
    // FIXED: Now uses launchpadBanner instead of the square launchpadLogo
    return htmlContent.replace(/src="([^"]*(launchpad-logo|launchpad-logo-dark|cid:launchpadLogo)[^"]*)"/gi, `src="${launchpadBanner}"`);
  };

  return (
    <>
      <style>{`
        @keyframes modalEnter {
          0% { opacity: 0; transform: scale(0.95) translateY(15px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modalExit {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(15px); }
        }
        @keyframes overlayEnter {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes overlayExit {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-modal-enter { animation: modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-modal-exit { animation: modalExit 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-overlay-enter { animation: overlayEnter 0.3s ease-out forwards; }
        .animate-overlay-exit { animation: overlayExit 0.3s ease-out forwards; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; border: 2px solid #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
      
      <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/85 backdrop-blur-sm p-4 md:p-8 font-sans
          ${isClosing ? 'animate-overlay-exit' : 'animate-overlay-enter'}`} 
      >
        
        <div className={`w-full max-w-5xl rounded-2xl bg-white shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-slate-700 ring-1 ring-white/10 overflow-hidden flex flex-col max-h-[90vh] 
          ${isClosing ? 'animate-modal-exit' : 'animate-modal-enter'}`}>
          
          {/* 1. Dark Header */}
          <div className="relative border-b border-slate-700 p-8 bg-slate-900 shrink-0 flex justify-between items-start gap-6">
            <div className="flex-1">
              <h3 className="text-3xl leading-tight text-white tracking-tight">
                <span className="font-bold text-slate-400 text-xs uppercase tracking-widest mr-3 block mb-2">Subject:</span>
                <span className="font-black text-white">{displayEmail.subject}</span>
              </h3>
            </div>
            
            <div className="flex flex-col items-end shrink-0 pt-1 border-r border-slate-700 pr-8 mr-14">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                {displayEmail.isIncoming ? 'Date Received:' : 'Date Sent:'}
              </span>
              <span className="text-sm text-slate-300 font-bold">
                {formatExactDateTime(displayEmail.sent_at)}
              </span>
            </div>

            <button 
              onClick={handleClose} 
              className="absolute top-8 right-8 text-slate-400 hover:text-white bg-slate-800 hover:bg-red-500 rounded-full h-10 w-10 flex items-center justify-center transition-colors shadow-sm outline-none"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {/* 2. Sub-Header */}
          <div className="flex items-center gap-4 bg-white px-8 py-5 border-b border-slate-200 shrink-0 shadow-sm z-10">
            <div className="h-14 w-14 shrink-0 rounded-full border border-slate-200 shadow-sm bg-slate-100 overflow-hidden">
              {displayEmail.isIncoming ? (
                <img 
                  src={getGravatarUrl(displayEmail.sender_email)} 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getFallbackAvatar(displayEmail.sender_email, displayEmail.sender_name);
                  }}
                  alt="Avatar" 
                  className="h-full w-full object-cover" 
                />
              ) : (
                <img 
                  src={getGravatarUrl(systemEmail)} 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getFallbackAvatar(systemEmail, 'Launchpad');
                  }}
                  alt="Launchpad Logo" 
                  className="h-full w-full object-contain p-1 bg-white" 
                />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              {displayEmail.isIncoming ? (
                <>
                  <p className="text-lg text-slate-900 font-normal truncate">
                    <span className="font-black">{displayEmail.sender_name && displayEmail.sender_name !== displayEmail.sender_email ? displayEmail.sender_name : displayEmail.sender_email}</span> 
                    {displayEmail.sender_name && displayEmail.sender_name !== displayEmail.sender_email && (
                      <span className="text-slate-500 text-sm ml-2 font-medium">&lt;{displayEmail.sender_email}&gt;</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">To:</span>
                    <span className="font-bold text-slate-800">Launchpad</span> <span className="text-slate-500">&lt;{systemEmail}&gt;</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg text-slate-900 font-normal truncate">
                    <span className="font-black">Launchpad Virtual Office</span> 
                    <span className="text-slate-500 text-sm ml-2 font-medium">&lt;{systemEmail}&gt;</span>
                  </p>
                  <p className="text-sm text-slate-600 mt-1 flex items-center gap-2 truncate">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">To:</span>
                    <span className="font-bold text-slate-800">{displayEmail.recipient_email || displayEmail.recipient || 'Recipient'}</span>
                  </p>
                </>
              )}
            </div>
          </div>
          
          {/* 3. Scrollable Body Section */}
          <div className="overflow-y-auto custom-scrollbar bg-slate-100/50 flex-1 relative min-h-0">
            <div className="max-w-4xl mx-auto my-6 sm:my-8 bg-white shadow-sm border border-slate-200 rounded-3xl overflow-hidden">
              <div className="p-8 sm:p-12">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2">
                    <span className="text-lg">✉️</span> E-mail Content
                  </span>
                </div>
                <div 
                  className="prose max-w-none text-slate-800 text-base leading-loose" 
                  dangerouslySetInnerHTML={{ __html: renderSafeBody(displayEmail.body) }} 
                />
              </div>
            </div>
          </div>

          {/* 4. COMPACT & EMPHASIZED Collapsible Attachments Tray */}
          {sortedAttachments.length > 0 && (
            <div className="bg-white border-t border-slate-200 shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.06)] relative">
              
              {/* Emphasized Toggle Header */}
              <div 
                onClick={() => setIsAttachmentsExpanded(!isAttachmentsExpanded)}
                className="w-full px-8 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 text-[#d2f34c] group-hover:scale-105 transition-transform shadow-md">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                    </svg>
                  </div>
                  <div>
                    <span className="block font-black text-base text-slate-900">
                      {sortedAttachments.length} Attached File{sortedAttachments.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                
                {/* DYNAMIC High-Visibility Button */}
                <div className={`flex items-center gap-2 px-5 py-2 rounded-full font-black text-xs transition-all duration-300 border shadow-md ${
                  isAttachmentsExpanded 
                    ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700 hover:shadow-lg' 
                    : 'bg-[#d2f34c] text-slate-900 border-[#b8d839] hover:bg-[#b8d839] hover:shadow-lg'
                }`}>
                  <span className="uppercase tracking-widest">{isAttachmentsExpanded ? 'Minimize Tray' : 'Expand Files'}</span>
                  <div className={`transition-transform duration-300 ease-in-out ${isAttachmentsExpanded ? 'rotate-0' : 'rotate-180'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Compact Expandable Tray Content */}
              <div className={`transition-all duration-300 ease-in-out overflow-hidden bg-slate-50/80 ${isAttachmentsExpanded ? 'max-h-[220px] opacity-100 border-t border-slate-200' : 'max-h-0 opacity-0'}`}>
                <div className="px-8 pb-6 pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar max-h-[200px]">
                  {sortedAttachments.map((att, index) => renderAttachment(att, index))}
                </div>
              </div>
              
            </div>
          )}

        </div>
      </div>
    </>
  );
}