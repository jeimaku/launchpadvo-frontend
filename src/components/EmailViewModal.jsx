import React, { useState, useEffect, useRef } from 'react';
import md5 from 'md5'; 
import launchpadLogo from '../assets/launchpad-logo2.png'; 

export default function EmailViewModal({ email, onClose, formatExactDateTime, systemEmail }) {
  const [displayEmail, setDisplayEmail] = useState(email);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (email) {
      setDisplayEmail(email);
      setIsClosing(false);
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
    return `https://www.gravatar.com/avatar/${hash}?s=128&d=404`;
  };

  const getFallbackAvatar = (emailAddress, name) => {
    if (emailAddress === systemEmail) return launchpadLogo;
    const displayName = name && name !== emailAddress ? name : emailAddress.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&rounded=true&bold=true&size=128`;
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
    
    let visualContent;
    if (isImage) {
      visualContent = <img src={att.url} alt="thumbnail" className="w-full h-full object-cover" />;
    } else if (isPDF) {
      visualContent = <div className="text-3xl text-red-500">📄</div>;
    } else if (isVideo) {
      visualContent = <div className="text-3xl text-purple-500">🎥</div>;
    } else if (isDoc) {
      visualContent = <div className="text-3xl text-blue-500">📝</div>;
    } else {
      visualContent = <div className="text-3xl text-slate-400">📎</div>;
    }

    const fileExt = att.filename?.split('.').pop()?.toUpperCase().substring(0, 4) || 'FILE';

    return (
      <div key={index} className="group flex flex-col justify-between p-4 border border-slate-200 bg-white rounded-xl shadow-sm hover:shadow-md hover:border-[#d2f34c] transition-all">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 shrink-0 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 relative">
            {visualContent}
            {(isImage || isPDF || isVideo) && (
              <a href={att.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold backdrop-blur-sm">
                Open
              </a>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-bold text-slate-800 truncate" title={att.filename}>{att.filename}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">{fileExt} Document</p>
          </div>
        </div>

        <button 
          onClick={() => forceDownload(att.url, att.filename || 'download')}
          className="mt-4 w-full py-2.5 rounded-lg bg-slate-50 text-slate-600 font-bold text-sm hover:bg-[#d2f34c] hover:text-slate-900 transition-colors border border-slate-200 hover:border-[#d2f34c] flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download
        </button>
      </div>
    );
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
        
        /* Make scrollbar look clean */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9; 
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}</style>
      
      <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-8 
          ${isClosing ? 'animate-overlay-exit' : 'animate-overlay-enter'}`} 
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        
        {/* STRICT MODAL BOUNDARIES: max-h-[90vh] enforces the window size */}
        <div className={`w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/50 
          ${isClosing ? 'animate-modal-exit' : 'animate-modal-enter'}`}>
          
          {/* 1. Header: Subject & Date (shrink-0 prevents it from squishing) */}
          <div className="relative border-b border-slate-200 p-8 bg-white shrink-0 flex justify-between items-start gap-6">
            <div className="flex-1">
              <h3 className="text-3xl leading-tight">
                <span className="font-normal text-black text-[11px] uppercase tracking-widest mr-3 block mb-2">Subject:</span>
                <span className="font-bold text-black">{displayEmail.subject}</span>
              </h3>
            </div>
            
            <div className="flex flex-col items-end shrink-0 pt-1 border-r border-slate-200 pr-8 mr-14">
              <span className="text-[11px] font-normal text-black uppercase tracking-widest mb-1">
                {displayEmail.isIncoming ? 'Date Received:' : 'Date Sent:'}
              </span>
              <span className="text-sm text-black font-bold">
                {formatExactDateTime(displayEmail.sent_at)}
              </span>
            </div>

            <button 
              onClick={handleClose} 
              className="absolute top-8 right-8 text-slate-400 hover:text-white bg-slate-100 hover:bg-red-500 rounded-full h-10 w-10 flex items-center justify-center transition-colors"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {/* 2. Sub-Header: Sender & Recipient Block (shrink-0) */}
          <div className="flex items-center gap-4 bg-slate-50/80 px-8 py-5 border-b border-slate-200 shrink-0">
            <div className="h-14 w-14 shrink-0 rounded-full border border-slate-200 shadow-sm bg-white overflow-hidden">
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
                  className="h-full w-full object-contain p-1" 
                />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              {displayEmail.isIncoming ? (
                <>
                  <p className="text-lg text-black font-normal truncate">
                    <span className="font-bold">{displayEmail.sender_name && displayEmail.sender_name !== displayEmail.sender_email ? displayEmail.sender_name : displayEmail.sender_email}</span> 
                    {displayEmail.sender_name && displayEmail.sender_name !== displayEmail.sender_email && (
                      <span className="text-black text-sm ml-2">&lt;{displayEmail.sender_email}&gt;</span>
                    )}
                  </p>
                  <p className="text-sm text-black mt-1 flex items-center gap-2">
                    <span className="font-normal text-black uppercase tracking-widest text-[10px]">To:</span>
                    <span className="font-bold">Launchpad</span> &lt;{systemEmail}&gt;
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg text-black font-normal truncate">
                    <span className="font-bold">Launchpad Virtual Office</span> 
                    <span className="text-black text-sm ml-2">&lt;{systemEmail}&gt;</span>
                  </p>
                  <p className="text-sm text-black mt-1 flex items-center gap-2 truncate">
                    <span className="font-normal text-black uppercase tracking-widest text-[10px]">To:</span>
                    <span className="font-bold">{displayEmail.recipient_email || displayEmail.recipient || 'Recipient'}</span>
                  </p>
                </>
              )}
            </div>
          </div>
          
          {/* 3. Scrollable Body Section - min-h-0 is the secret to forcing flexbox to scroll! */}
          <div className="p-8 overflow-y-auto custom-scrollbar bg-white flex-1 relative min-h-0">
            <div className="mb-4">
              <span className="font-normal text-black uppercase tracking-widest text-[11px]">E-mail Content:</span>
            </div>
            <div 
              className="prose max-w-none text-black text-[15px] leading-relaxed pb-8" 
              dangerouslySetInnerHTML={{ __html: displayEmail.body }} 
              style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
            />
          </div>

          {/* 4. Organized Attachments Tray (shrink-0) */}
          {sortedAttachments.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 p-8 shrink-0">
              <h4 className="text-[11px] font-normal text-black mb-4 uppercase tracking-widest flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                {sortedAttachments.length} Attachment{sortedAttachments.length > 1 ? 's' : ''}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
                {sortedAttachments.map((att, index) => renderAttachment(att, index))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}