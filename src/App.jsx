import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; // <-- ADDED Navigate
import { io } from 'socket.io-client'; 
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

// ==========================================
// 🛡️ THE ROUTE BOUNCER (RBAC SECURITY)
// ==========================================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  // 1. Not Logged In? Kick them back to the login screen immediately.
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // 2. Logged In, but wrong role? (e.g., Staff trying to access Admin Users page)
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Passed all checks? Let them in!
  return children;
};

function App() {

  // --- Global Socket Listener for Notifications ---
  useEffect(() => {
    const SOCKET_URL = `http://${window.location.hostname}:5000`;
    const socket = io(SOCKET_URL);

    socket.on('incoming_email', () => {
      const userRole = localStorage.getItem('userRole');
      
      if (['admin', 'manager', 'staff'].includes(userRole)) {
        const notificationSound = new Audio('/notification.mp3');
        notificationSound.play().catch(err => {
          console.error("Audio playback blocked by browser:", err);
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);
  // ---------------------------------------------------

  // Define the standard internal roles
  const internalRoles = ['admin', 'manager', 'supervisor', 'staff'];

  return (
    <Router>
      <Routes>
        {/* PUBLIC ROUTE */}
        <Route path="/" element={<Login />} />
        
        {/* PROTECTED ROUTES (All Internal Staff) */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={internalRoles}>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/lpc-virtual-office" element={
          <ProtectedRoute allowedRoles={internalRoles}>
            <LPCVirtualOffice />
          </ProtectedRoute>
        } />
        
        <Route path="/lpog-virtual-office" element={
          <ProtectedRoute allowedRoles={internalRoles}>
            <LPOGVirtualOffice />
          </ProtectedRoute>
        } />
        
        <Route path="/payments" element={
          <ProtectedRoute allowedRoles={internalRoles}>
            <Payments />
          </ProtectedRoute>
        } />
        
        <Route path="/email-center" element={
          <ProtectedRoute allowedRoles={internalRoles}>
            <EmailCenter />
          </ProtectedRoute>
        } /> 
        
        <Route path="/email-trash" element={
          <ProtectedRoute allowedRoles={internalRoles}>
            <EmailTrash />
          </ProtectedRoute>
        } /> 
        
        <Route path="/email-templates" element={
          <ProtectedRoute allowedRoles={internalRoles}>
            <EmailTemplates />
          </ProtectedRoute>
        } /> 

        {/* STRICTLY ADMIN ONLY ROUTE */}
        <Route path="/users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Users />
          </ProtectedRoute>
        } />
        
      </Routes>
    </Router>
  );
}

export default App;