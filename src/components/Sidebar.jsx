import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation(); // This tells us which page we are currently on

  // Helper function to highlight the active menu item
  const isActive = (path) => location.pathname === path;

  return (
    <div className="w-64 bg-slate-900 text-white p-6 shadow-xl hidden md:flex md:flex-col h-screen sticky top-0">
      <div className="flex items-center gap-3 mb-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d2f34c]">
          <span className="text-xl font-black text-slate-900">L</span>
        </div>
        <h1 className="text-xl font-bold">Launchpad VO</h1>
      </div>
      
      <nav className="space-y-4 text-sm font-semibold text-slate-400 flex-1">
        <Link 
          to="/dashboard" 
          className={`block px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
        >
          📊 Dashboard
        </Link>
        <Link 
          to="/contracts" 
          className={`block px-4 py-2 rounded-lg transition-colors ${isActive('/contracts') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
        >
          📄 Contracts
        </Link>
        <Link 
          to="/documents" 
          className={`block px-4 py-2 rounded-lg transition-colors ${isActive('/documents') ? 'bg-[#d2f34c]/10 text-[#d2f34c]' : 'hover:bg-slate-800 hover:text-white'}`}
        >
          📁 Documents
        </Link>
      </nav>
    </div>
  );
}