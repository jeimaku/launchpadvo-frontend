import React, { useState, useEffect } from 'react';
// UPDATED IMPORT
import launchpadLogo from '../assets/launchpad-logo-dark.png';

const SYSTEM_DEFAULT = {
  id: 'system-default',
  name: 'System Default: Automated Renewal',
  subject: 'Virtual Office Subscription Renewal Notice',
  trigger_event: 'subscription_renewal',
  is_html: 1,
  body: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #1e293b; text-align: center; border-bottom: 3px solid #d2f34c;">
        <img src="cid:launchpadLogo" alt="Launchpad Business Logo" style="width: 100%; max-width: 600px; display: block;" />
      </div>
      <div style="padding: 30px; color: #333; line-height: 1.6;">
        <h2>Greetings, [Client Name]!</h2>
        <p>We hope this email finds you well.</p>
        <p>This is a formal notification regarding your <strong>Virtual Office</strong> subscription for <strong>[Company Name]</strong>. Our records indicate that your current subscription is scheduled to expire in <strong style="color: #eab308; font-size: 1.1em;">[X] days</strong> (on <strong>[Exact Expiry Date]</strong>).</p>
        <p>To ensure uninterrupted access to our professional services, amenities, and business address features, we kindly request that you initiate the renewal process at your earliest convenience. Maintaining an active subscription is vital for the continuity of your business operations within our community.</p>
        <p>If you have already initiated the renewal or have questions regarding your package tier, please contact our support team or reply directly to this email.</p>
        <p>Thank you for choosing Launchpad as your business partner.</p>
        <br>
        <p>Best Regards,<br><strong>Launchpad Management Team</strong></p>
      </div>
    </div>
  `
};

export default function AutomatedTemplatesModal({ onClose, onUpdateSuccess }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/emails/templates`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      const data = await response.json();
      
      const autoTemplates = data.filter(t => t.template_type === 'automated');
      const hasActiveRenewalCustom = autoTemplates.some(t => t.trigger_event === 'subscription_renewal' && t.is_active === 1);
      
      const combined = [
        { ...SYSTEM_DEFAULT, is_active: hasActiveRenewalCustom ? 0 : 1 },
        ...autoTemplates
      ];

      setTemplates(combined);
      
      const activeOne = combined.find(t => t.is_active === 1) || combined[0];
      setSelectedTemplate(activeOne);

    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const handleActivate = async () => {
    if (!selectedTemplate) return;
    setIsActivating(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/emails/templates/${selectedTemplate.id}/activate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ triggerEvent: 'subscription_renewal' }) 
      });

      if (response.ok) {
        onUpdateSuccess('Automated Template successfully updated!');
        onClose();
      }
    } catch (error) {
      console.error("Error activating template:", error);
    } finally {
      setIsActivating(false);
    }
  };

  const renderPreviewBody = (html) => {
    if (!html) return '';
    return html.replace(/src="([^"]*(launchpad-logo|launchpad-logo-dark|cid:launchpadLogo)[^"]*)"/gi, `src="${launchpadLogo}"`);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/85 backdrop-blur-sm p-4 md:p-6 animate-modal-fade font-sans">
      <div className="w-full max-w-6xl h-[85vh] rounded-2xl bg-white shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-slate-700 ring-1 ring-white/10 flex flex-col overflow-hidden">
        
        {/* DARK HEADER */}
        <div className="flex items-center justify-between border-b border-slate-700 p-6 bg-slate-900 shrink-0">
          <div>
            <h3 className="text-2xl font-black text-white flex items-center gap-3">
              <span className="text-3xl">⚙️</span> Manage Automated Templates
            </h3>
            <p className="text-slate-300 font-medium text-sm mt-1">Select the email layout the system will automatically send for Subscription Renewals.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-red-500 rounded-full h-10 w-10 flex items-center justify-center transition-all shadow-sm outline-none">
            <span className="text-xl font-bold leading-none -mt-0.5">✕</span>
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden bg-slate-100/50">
          
          <div className="w-[40%] bg-white border-r border-slate-200 overflow-y-auto custom-scrollbar p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-2 mt-2">Available Renewal Templates</h4>
            {templates.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100 text-center">
                No templates available.
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setSelectedTemplate(t)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border-2 relative ${selectedTemplate?.id === t.id ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                  >
                    {t.is_active === 1 && (
                      <span className="absolute top-4 right-4 h-3 w-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" title="Currently Active"></span>
                    )}
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-lg ${t.id === 'system-default' ? 'bg-slate-200' : 'bg-purple-200 text-purple-700'}`}>
                        {t.id === 'system-default' ? '🤖' : '🎨'}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-base leading-tight pr-6">{t.name}</h5>
                      </div>
                    </div>
                    {t.is_active === 1 && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md uppercase tracking-wide">
                        ✓ Active for this event
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-[60%] p-8 overflow-y-auto custom-scrollbar flex flex-col">
            {selectedTemplate ? (
              <div className="bg-white shadow-md rounded-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden max-w-3xl mx-auto w-full">
                
                <div className="border-b border-slate-100 p-6 bg-slate-50 flex items-start gap-4">
                   <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
                      ✉️
                   </div>
                   <div className="flex-1 pt-1">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Preview Subject</h4>
                      <h2 className="text-xl font-bold text-slate-900">{selectedTemplate.subject}</h2>
                   </div>
                </div>

                <div className="flex-1 bg-white p-8">
                  {selectedTemplate.is_html ? (
                    <div className="prose max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: renderPreviewBody(selectedTemplate.body) }} />
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }} className="text-slate-700 leading-relaxed">
                      {selectedTemplate.body}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">Select a template to preview</div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 p-6 bg-slate-50 shrink-0 flex justify-end gap-4 items-center">
          {selectedTemplate?.is_active === 1 ? (
             <span className="text-emerald-600 font-bold flex items-center gap-2 mr-auto px-4">
               <span className="text-xl">✅</span> This template is actively sending for this event.
             </span>
          ) : (
             <span className="text-slate-500 font-medium text-sm mr-auto px-4">
               Clicking activate will replace the current template for <strong>Subscription Renewals</strong>.
             </span>
          )}

          <button onClick={onClose} className="rounded-xl px-8 py-3 text-base font-bold text-slate-600 hover:bg-slate-200 transition-colors">
            Close
          </button>
          <button 
            onClick={handleActivate} 
            disabled={isActivating || selectedTemplate?.is_active === 1}
            className="rounded-xl bg-purple-600 px-10 py-3 text-base font-bold text-white hover:bg-purple-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            {isActivating ? 'Saving...' : 'Set as Active Template'}
          </button>
        </div>

      </div>
    </div>
  );
}