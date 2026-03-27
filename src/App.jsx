import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client'; // <-- IMPORT SOCKET.IO CLIENT
import Login from './pages/Login';

// CRM Pages
import Dashboard from './pages/Admin/Dashboard';
import LPCVirtualOffice from './pages/Admin/LPCVirtualOffice';
import LPOGVirtualOffice from './pages/Admin/LPOGVirtualOffice';
import Payments from './pages/Admin/Payments';
import Users from './pages/Admin/Users';

import EmailCenter from './pages/Admin/EmailCenter'; 
import EmailTrash from './pages/Admin/EmailTrash'; 
import EmailTemplates from './pages/Admin/EmailTemplates'; 

function App() {

  // --- NEW: Global Socket Listener for Notifications ---
  useEffect(() => {
    // Connect to your Node.js backend
    const socket = io('http://192.168.200.15:4000');

    // Listen for the event emitted by imapListener.js
    socket.on('incoming_email', () => {
      // Check local storage to see if the current user is an admin, manager, or staff
      const userRole = localStorage.getItem('userRole');
      
      // Update: Array includes check for multiple roles
      if (['admin', 'manager', 'staff'].includes(userRole)) {
        // Play the notification sound from the public folder
        const notificationSound = new Audio('/notification.mp3');
        notificationSound.play().catch(err => {
          console.error("Audio playback blocked by browser:", err);
        });
      }
    });

    // Cleanup the connection when the app unmounts
    return () => {
      socket.disconnect();
    };
  }, []);
  // ---------------------------------------------------

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Placeholder routes until we build the actual pages */}
        <Route path="/lpc-virtual-office" element={<LPCVirtualOffice />} />
        <Route path="/lpog-virtual-office" element={<LPOGVirtualOffice />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/users" element={<Users />} />
        
        {/* REVISED EMAIL ROUTES */}
        <Route path="/email-center" element={<EmailCenter />} /> 
        <Route path="/email-trash" element={<EmailTrash />} /> 
        <Route path="/email-templates" element={<EmailTemplates />} /> 
        
      </Routes>
    </Router>
  );
}

export default App;