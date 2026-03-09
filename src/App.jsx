import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';

// Admin Pages
import Dashboard from './pages/Admin/Dashboard';
import Contracts from './pages/Admin/Contracts';

// Client Pages
import ClientDashboard from './pages/Client/ClientDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* If the URL is just '/', show the Login page */}
        <Route path="/" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contracts" element={<Contracts />} />

        {/* Client Dashboard Route */}
        <Route path="/client-dashboard" element={<ClientDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;