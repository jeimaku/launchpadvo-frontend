import React from 'react';
import md5 from 'md5'; 
import launchpadLogo from '../assets/launchpad-logo2.png'; // <-- UPDATED TO logo2.png

export default function EmailViewModal({ email, onClose, formatExactDateTime, systemEmail }) {
  if (!email) return null;

  // --- Force Download Function ---
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

  // --- SMART AVATAR HELPER 1: Get real picture or return 404 ---
  const getGravatarUrl = (emailAddress) => {
    if (emailAddress === systemEmail) return launchpadLogo;
    const cleanEmail = emailAddress.trim().toLowerCase();
    const hash = md5(cleanEmail);
    return `https://www.gravatar.com/avatar/${hash}?s=128&d=404`;
  };

  // --- SMART AVATAR HELPER 2: Generate the UI Fallback ---
  const getFallbackAvatar = (emailAddress, name) => {
    if (emailAddress === systemEmail) return launchpadLogo;
    const displayName = name && name !== emailAddress ? name : emailAddress.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&rounded=true&bold=true&size=128`;
  };

  // --- Attachment Sorting ---
  const sortedAttachments = [...(email.attachments || [])].sort((a, b) => {
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
      visualContent = <div className="text-3xl text-purple-500">🎬</div>;
    } else if (isDoc) {
      visualContent = <div className="text-3xl text-blue-500">📝</div>;
    } else {
      visualContent = <div className="text-3xl text-slate-400">📁</div>;
    }

    const fileExt = att.filename?.split('.').pop()?.toUpperCase().substring(0, 4) || 'FILE';

    return (
      <div key={index} className="group flex flex-col justify-between p-4 border border-slate-200 bg-white rounded-2xl shadow-sm hover:shadow-md hover:border-[#d2f34c] transition-all">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 shrink-0 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 relative">
            {visualContent}
            {(isImage || isPDF || isVideo) && (
              <a href={att.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold backdrop-blur-sm">
                Open
              </a>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-sm font-bold text-slate-800 truncate" title={att.filename}>{att.filename}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">{fileExt} Document</p>
          </div>
        </div>

        <button 
          onClick={() => forceDownload(att.url, att.filename || 'download')}
          className="mt-4 w-full py-2.5 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-[#d2f34c] hover:text-slate-900 transition-colors border border-slate-200 hover:border-[#d2f34c] flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download File
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/50">
        
        {/* Sleek Header Section */}
        <div className="relative border-b border-slate-100 p-8 bg-white shrink-0">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-3xl font-black text-slate-900 pr-12 leading-tight">{email.subject}</h3>
            <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 rounded-full h-10 w-10 flex items-center justify-center transition-colors">
              <span className="text-2xl font-bold leading-none -mt-1">&times;</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            {/* AVATAR INJECTION FOR MODAL HEADER (With Fallback) */}
            <div className="h-12 w-12 shrink-0 rounded-full border border-slate-200 shadow-sm bg-white overflow-hidden">
              {email.isIncoming ? (
                <img 
                  src={getGravatarUrl(email.sender_email)} 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getFallbackAvatar(email.sender_email, email.sender_name);
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
            
            <div className="flex-1">
              {email.isIncoming ? (
                <>
                  <p className="text-base text-slate-900 font-bold">
                    {email.sender_name && email.sender_name !== email.sender_email ? `${email.sender_name} ` : ''} 
                    <span className="text-slate-500 font-medium">&lt;{email.sender_email}&gt;</span>
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">To: <span className="font-medium text-slate-700">Launchpad &lt;{systemEmail}&gt;</span></p>
                </>
              ) : (
                <>
                  <p className="text-base text-slate-900 font-bold">
                    Launchpad <span className="text-slate-500 font-medium">&lt;{systemEmail}&gt;</span>
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">To: <span className="font-medium text-slate-700">{email.recipient_email}</span></p>
                </>
              )}
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-slate-400 block mb-1">
                {formatExactDateTime(email.sent_at)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Scrollable Body Section */}
        <div className="p-8 overflow-y-auto custom-scrollbar bg-white flex-1 text-lg text-slate-800">
          <div className="prose max-w-none prose-lg text-slate-700" dangerouslySetInnerHTML={{ __html: email.body }} />
        </div>

        {/* Organized Attachments Tray */}
        {sortedAttachments.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 p-8 shrink-0">
            <h4 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              {sortedAttachments.length} Attachment{sortedAttachments.length > 1 ? 's' : ''}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
              {sortedAttachments.map((att, index) => renderAttachment(att, index))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}