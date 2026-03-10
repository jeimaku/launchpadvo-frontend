import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';

// CRM Pages
import Dashboard from './pages/Admin/Dashboard';
import LPCVirtualOffice from './pages/Admin/LPCVirtualOffice';
import LPOGVirtualOffice from './pages/Admin/LPOGVirtualOffice';
import Payments from './pages/Admin/Payments';
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
        <Route path="/lpog-virtual-office" element={<LPOGVirtualOffice />} />
        <Route path="/payments" element={<Payments />} />

      </Routes>
    </Router>
  );
}

export default App;