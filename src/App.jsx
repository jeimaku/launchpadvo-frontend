import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';

// CRM Pages
import Dashboard from './pages/Admin/Dashboard';
import LPCVirtualOffice from './pages/Admin/LPCVirtualOffice';
// We will create these three files next!
// import LPCVirtualOffice from './pages/Admin/LPCVirtualOffice';
// import LPOGVirtualOffice from './pages/Admin/LPOGVirtualOffice';
// import Payments from './pages/Admin/Payments';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Placeholder routes until we build the actual pages */}
        <Route path="/lpc-virtual-office" element={<LPCVirtualOffice />} />
        <Route path="/lpog-virtual-office" element={<div className="p-8 text-2xl font-bold">🌆 LPOG Virtual Office Coming Soon...</div>} />
        <Route path="/payments" element={<div className="p-8 text-2xl font-bold">💳 Payments Coming Soon...</div>} />

      </Routes>
    </Router>
  );
}

export default App;