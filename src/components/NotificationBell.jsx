import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function NotificationBell() {
  const [hasNewEmail, setHasNewEmail] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // --- Volume Control ---
  const [volume, setVolume] = useState(1);
  const volumeRef = useRef(volume);
  const audioRef = useRef(new Audio('/notification.mp3'));

  const notificationRef = useRef(null);

  const userRole = (localStorage.getItem('userRole') || '').toLowerCase();
  const isAuthorized = ['admin', 'manager', 'staff'].includes(userRole);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const playNotificationSound = () => {
    if (volumeRef.current > 0) {
      audioRef.current.volume = volumeRef.current;
      audioRef.current.play().catch(e => console.log('Audio blocked by browser:', e));
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      // FIXED: Fetching from the LOGS table to see all outgoing automated/manual emails
      const response = await fetch(`http://${window.location.hostname}:5000/api/emails/logs`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Format the latest 6 outgoing emails as notifications
        const recentActivity = data.slice(0, 6).map(log => ({
          id: log.id,
          type: log.type, // 'Automated' or 'Manual'
          recipient: log.recipient_email,
          subject: log.subject,
          time: new Date(log.sent_at)
        }));
        
        setNotifications(recentActivity);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    // FIXED: Dynamically connect to the backend, removing the hardcoded IPs that caused the crash
    const socket = io(`http://${window.location.hostname}:5000`);

    // Listen for outgoing manual/quick-action emails
    socket.on('email_sent', () => {
      fetchNotifications();
      setHasNewEmail(true);
      playNotificationSound();
    });

    // Listen for background automated cron-job emails
    socket.on('incoming_email', () => { 
      fetchNotifications();
      setHasNewEmail(true);
      playNotificationSound();
    });

    fetchNotifications();

    return () => socket.disconnect();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthorized) return null;

  return (
    <div className="relative" ref={notificationRef}>
      {/* Bell Icon */}
      <button
        onClick={() => {
          setShowNotifications(!showNotifications);
          if (!showNotifications) setHasNewEmail(false);
        }}
        className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100 focus:outline-none"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {hasNewEmail && (
          <span className="absolute top-1.5 right-2 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></span>
        )}
      </button>

      {/* Dropdown */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-fade-in origin-top-right">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-800 uppercase tracking-wide text-sm">System Activity</h3>
            {notifications.length > 0 && (
              <span className="bg-[#d2f34c] text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                Recent
              </span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center">
              <span className="text-4xl mb-3 opacity-50">📭</span>
              <p className="text-sm font-medium text-slate-500">No recent email activity.</p>
            </div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
              {notifications.map((n, idx) => (
                <Link
                  key={idx}
                  to="/email-center"
                  className="block p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    {/* Dynamic Icon based on Automated vs Manual */}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border ${n.type === 'Automated' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-center mb-1">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${n.type === 'Automated' ? 'text-purple-600' : 'text-blue-600'}`}>
                          {n.type} Send
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 group-hover:text-[#8ca819] transition-colors">
                          {n.time.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                      <p className="text-[13px] text-slate-900 font-bold truncate mb-0.5" title={n.subject}>
                        {n.subject}
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 truncate">
                        To: <span className="font-bold text-slate-700">{n.recipient}</span>
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {notifications.length > 0 && (
            <Link
              to="/email-center"
              className="block px-6 py-3.5 bg-slate-50 text-center text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-[#d2f34c] hover:text-slate-900 transition-colors border-t border-slate-100"
            >
              View Email Center
            </Link>
          )}
        </div>
      )}
    </div>
  );
}