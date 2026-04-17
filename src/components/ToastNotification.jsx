import { useEffect } from 'react';

export default function ToastNotification({ message, isVisible, onClose }) {
  
  // Auto-dismiss the notification after 6 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 6000);
      return () => clearTimeout(timer); // Cleanup if the component unmounts early
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] max-w-sm w-full animate-slide-up">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 flex items-start gap-4 relative overflow-hidden">
        
        {/* Subtle background glow */}
        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500 rounded-full blur-[30px] opacity-20 pointer-events-none"></div>

        {/* Informational Icon */}
        <div className="h-10 w-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>

        <div className="flex-1 pt-0.5">
          <h4 className="text-sm font-bold text-white mb-0.5">System Update</h4>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            {message}
          </p>
        </div>

        {/* Manual Close Button */}
        <button 
          onClick={onClose} 
          className="text-slate-500 hover:text-white transition-colors shrink-0 p-1"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

      </div>

      {/* Animation CSS specifically for this toast */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}