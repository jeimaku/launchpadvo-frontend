import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

export default function Users() {  
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add these right below your other states
  const [showUserModal, setShowUserModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [editingUserId, setEditingUserId] = useState(null);

  // Security Check: Kick out non-admins
  const userRole = localStorage.getItem('userRole');

  useEffect(() => {
    if (userRole !== 'admin') {
      window.location.href = '/dashboard'; // Redirect non-admins
      return;
    }
    fetchAdminData();
  }, [userRole]);

    const fetchAdminData = async () => {
        setIsLoading(true);
        try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/users', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });

        if (response.ok) {
            setUsers(await response.json());
        }
        } catch (error) {
        console.error("Error fetching user data:", error);
        } finally {
        setIsLoading(false);
        }
  };

  if (userRole !== 'admin') return null; // Prevent UI flicker before redirect

  const handleEditClick = (user) => {
    setErrorMessage('');
    setEditingUserId(user.id);
    // Pre-fill the form, leaving password blank
    setNewUser({ name: user.name, email: user.email, password: '', role: user.role });
    setShowUserModal(true);
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to permanently disable/delete this user?")) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to delete.');
      }
      fetchAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const token = localStorage.getItem('token');
      const url = editingUserId 
        ? `http://localhost:5000/api/users/${editingUserId}` 
        : 'http://localhost:5000/api/users';
        
      const method = editingUserId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newUser)
      });   

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to create user.');
      }

      await fetchAdminData(); // Refresh the table
      setShowUserModal(false); // Close the modal
      setNewUser({ name: '', email: '', password: '', role: 'staff' }); // Reset form
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 p-8 overflow-hidden overflow-y-auto max-h-screen">
<header className="mb-8">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">User Management</h2>
          <p className="text-slate-500 mt-1 font-medium">Manage internal personnel accounts and system access.</p>
        </header>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 font-bold">Loading secure data...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-700">Internal Personnel ({users.length})</h3>
              <button 
                onClick={() => {
                  setEditingUserId(null);
                  setNewUser({ name: '', email: '', password: '', role: 'staff' });
                  setShowUserModal(true);
                }}
                className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded hover:bg-slate-800 transition-colors font-semibold"
              >
                + Add New User
              </button>
            </div>
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-xs">Name</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-xs">Email / Login</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-xs">System Role</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-xs">Date Created</th>
                    <th className="px-6 py-3 font-semibold text-right uppercase tracking-wider text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{u.name}</td>
                      <td className="px-6 py-4 text-slate-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-widest ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                          u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 
                          u.role === 'staff' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleEditClick(u)} className="text-blue-600 hover:underline text-xs font-bold mr-3">Edit</button>
                        {u.role !== 'admin' && <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:underline text-xs font-bold">Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      {/* ========================================== */}
      {/* CREATE USER MODAL                          */}
      {/* ========================================== */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800">{editingUserId ? 'Edit System User' : 'Create New User'}</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-2xl">&times;</button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 border border-red-200">
                <p className="text-sm font-bold text-red-600">⚠️ {errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Full Name *</label>
                <input required type="text" placeholder="e.g. Jane Doe" className="w-full rounded-lg border border-slate-300 px-4 py-2" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Email Address (Login ID) *</label>
                <input required type="email" placeholder="jane@launchpad.com" className="w-full rounded-lg border border-slate-300 px-4 py-2" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} />
              </div>

                <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                    {editingUserId ? 'New Password (Leave blank to keep current)' : 'Temporary Password *'}
                </label>
                <input required={!editingUserId} type="password" placeholder="••••••••" className="w-full rounded-lg border border-slate-300 px-4 py-2" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} />
                </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">System Role *</label>
                <select required className="w-full rounded-lg border border-slate-300 px-4 py-2 bg-white font-semibold text-slate-700" value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})}>
                  <option value="staff">Staff (Frontliner / Data Entry)</option>
                  <option value="manager">Manager (Verifier / Checker)</option>
                  <option value="admin">Admin (System Administrator)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Controls what pages and buttons this user can access.</p>
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t pt-5">
                <button type="button" onClick={() => setShowUserModal(false)} className="rounded-lg px-6 py-2 font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
                  {isSubmitting ? 'Creating...' : 'Create Secure User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}