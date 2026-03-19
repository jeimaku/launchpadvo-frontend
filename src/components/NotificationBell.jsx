import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function NotificationBell() {
  const [hasNewEmail, setHasNewEmail] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  // --- Volume Control States ---
  const [volume, setVolume] = useState(1); // Default volume is 100%
  const [prevVolume, setPrevVolume] = useState(1); // Remembers volume before muting
  const volumeRef = useRef(volume);

  // --- Unread Tracking State ---
  const [readEmailIds, setReadEmailIds] = useState(() => {
    const saved = localStorage.getItem('readEmailIds');
    return saved ? JSON.parse(saved) : [];
  });

  const notificationRef = useRef(null);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/emails/inbox', {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      
      if (response.ok) {
        const data = await response.json();
        const recentEmails = data.slice(0, 5).map(email => ({
          id: email.id,
          sender: email.sender_name || email.sender_email,
          subject: email.subject,
          time: new Date(email.received_at)
        }));
        setNotifications(recentEmails);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const socket = io('http://localhost:5000');
    
    socket.on('incoming_email', () => {
      const currentRole = localStorage.getItem('userRole');
      
      if (['admin', 'manager', 'staff'].includes(currentRole)) {
        setHasNewEmail(true); 
        fetchNotifications();

        if (volumeRef.current > 0) {
          const notificationSound = new Audio('/notification.mp3');
          notificationSound.volume = volumeRef.current;
          notificationSound.play().catch(err => {
            console.warn("Audio playback blocked by browser. User interaction required:", err);
          });
        }

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Launchpad Virtual Office", {
            body: "You have received a new email notification.",
            icon: "/launchpad-logo2.png",
          });
        }
      }
    });

    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      socket.off('incoming_email');
      socket.disconnect();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- Volume Handlers ---
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) {
      setPrevVolume(newVolume);
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0); 
    } else {
      setVolume(prevVolume || 1); 
    }
  };

  const setMaxVolume = () => {
    setVolume(1);
    setPrevVolume(1);
  };

  const markAsRead = (id) => {
    if (!readEmailIds.includes(id)) {
      const updatedReadIds = [...readEmailIds, id];
      setReadEmailIds(updatedReadIds);
      localStorage.setItem('readEmailIds', JSON.stringify(updatedReadIds));
    }
    setShowNotifications(false);
  };

  const unreadCount = notifications.filter(n => !readEmailIds.includes(n.id)).length;

  return (
    <>
      <style>{`
        @keyframes dropdownOpen {
          0% { opacity: 0; transform: scale(0.95) translateY(-10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-dropdown-open { 
          animation: dropdownOpen 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        
        /* Custom Volume Slider Styling */
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #1e293b;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          margin-top: -5px;
          transition: transform 0.1s;
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        input[type=range]::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 4px;
          background: #e2e8f0;
        }
        input[type=range]::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #1e293b;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          transition: transform 0.1s;
        }
        input[type=range]::-moz-range-thumb:hover {
          transform: scale(1.15);
        }
        input[type=range]::-moz-range-track {
          height: 6px;
          border-radius: 4px;
          background: #e2e8f0;
        }
      `}</style>

      <div className="relative" ref={notificationRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        
        {/* Main Notification Bell Button */}
        <button 
          onClick={() => {
            setShowNotifications(!showNotifications);
            setHasNewEmail(false); 
          }}
          className={`relative flex items-center justify-center p-2.5 border rounded-full transition-all duration-300 shadow-sm ${
            showNotifications 
              ? 'bg-slate-100 border-slate-300 ring-4 ring-amber-400/20' 
              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Notifications"
        >
          <svg 
            className="w-6 h-6 text-amber-400 drop-shadow-[0_2px_2px_rgba(251,191,36,0.5)]" 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            stroke="#d97706" 
            strokeWidth="0.5"
          >
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
          
          {hasNewEmail && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white shadow-sm"></span>
            </span>
          )}
        </button>

        {/* Floating Notification Popover */}
        {showNotifications && (
          <div className="absolute right-0 top-full mt-4 w-96 bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] border border-slate-200 z-50 overflow-hidden origin-top-right animate-dropdown-open flex flex-col">
            
            {/* Sleek Dark Header */}
            <div className="px-6 py-4 bg-slate-800 flex justify-between items-center border-b border-slate-900 shrink-0">
              <h3 className="font-bold text-white text-[15px] tracking-wide">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-[#d2f34c] text-slate-900 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-lg shadow-sm">
                  {unreadCount} New
                </span>
              )}
            </div>

            {/* --- Volume Control Sub-Header --- */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-4 shrink-0 shadow-inner">
              
              {/* Left Side: Muted Bell Toggle (Red when muted, Slate when active) */}
              <button 
                onClick={toggleMute} 
                className="group cursor-pointer p-1.5 rounded-full hover:bg-red-50 transition-colors focus:outline-none"
                title={volume > 0 ? "Click to Mute" : "Click to Unmute"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                  className={`w-5 h-5 transition-colors duration-200 ${volume === 0 ? 'text-red-500' : 'text-slate-400 group-hover:text-red-400'}`}
                >
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  <path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path>
                  <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path>
                  <path d="M18 8a6 6 0 0 0-9.33-5"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>

              {/* Center: Styled Slider Track */}
              <div className="flex-1 flex items-center relative h-1.5 rounded-lg bg-slate-200 overflow-visible group cursor-pointer">
                <div 
                  className="absolute left-0 top-0 bottom-0 rounded-l-lg pointer-events-none transition-all duration-75" 
                  style={{ width: `${volume * 100}%`, backgroundColor: '#d2f34c' }}
                ></div>
                <input 
                  type="range" 
                  min="0" max="1" step="0.01" 
                  value={volume} 
                  onChange={handleVolumeChange} 
                  className="absolute inset-0 w-full h-full appearance-none bg-transparent outline-none m-0 p-0 z-10"
                />
              </div>

              {/* Right Side: Ringing Bell with Sound Waves (Emerald Green when active) */}
              <button 
                onClick={setMaxVolume}
                className="group cursor-pointer p-1.5 rounded-full hover:bg-emerald-50 transition-colors focus:outline-none" 
                title="Set to Max Volume"
              >
                {/* Expanded viewBox to 28 so the waves don't get cut off! */}
                <svg viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                  className={`w-6 h-6 transition-colors duration-200 ${volume > 0.5 ? 'text-emerald-500' : 'text-emerald-300 group-hover:text-emerald-400'}`}
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h14s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  <path d="M23 15a7 7 0 0 0 0-10"></path>
                  <path d="M26 17a10 10 0 0 0 0-14"></path>
                </svg>
              </button>
            </div>
            
            {/* List Container */}
            {notifications.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center bg-white flex-1">
                <div className="h-16 w-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <span className="text-3xl drop-shadow-sm">📭</span>
                </div>
                <p className="font-bold text-slate-800 text-base mb-1">You're all caught up!</p>
                <p className="text-sm text-slate-500">No new notifications right now.</p>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto bg-white flex-1 custom-scrollbar">
                {notifications.map((n) => {
                  const isUnread = !readEmailIds.includes(n.id);

                  return (
                    <Link 
                      to="/email-center" 
                      key={n.id} 
                      onClick={() => markAsRead(n.id)}
                      className="block px-6 py-4 border-b border-slate-200 bg-white hover:bg-slate-50 transition-all relative group"
                    >
                      <div className="flex items-start gap-4 relative">
                        
                        {/* Unread Indicator Glowing Dot (This is the ONLY thing removed when clicked) */}
                        {isUnread && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#b8d839] shadow-[0_0_8px_rgba(210,243,76,0.8)]"></span>
                        )}

                        {/* Custom Avatar Icon (Color stays the same forever) */}
                        <div className="h-11 w-11 ml-3 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform duration-300 bg-slate-800 border-2 border-slate-700 group-hover:scale-105">
                          <svg className="w-5 h-5 text-[#d2f34c]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                        </div>
                        
                        {/* Text Content (Font and weight stay exactly the same forever) */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-slate-900 font-bold truncate mb-0.5">
                            {n.sender}
                          </p>
                          <p className="text-[13px] text-slate-800 font-bold truncate mb-1.5">
                            {n.subject}
                          </p>
                          <p className="text-[10px] font-bold text-[#8ca819] uppercase tracking-widest">
                            {n.time.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* View All Footer */}
            {notifications.length > 0 && (
              <Link 
                to="/email-center" 
                className="block px-6 py-3.5 bg-slate-50 text-center text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-[#d2f34c] hover:text-slate-900 transition-colors border-t border-slate-200 shrink-0"
              >
                View Email Center
              </Link>
            )}

          </div>
        )}
      </div>
    </>
  );
}