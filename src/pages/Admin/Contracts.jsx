import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

export default function Contracts() {
  const [clients, setClients] = useState([]);
  const [contracts, setContracts] = useState([]); 
  
  const [formData, setFormData] = useState({
    userId: '',
    companyName: '',
    startDate: '',
    endDate: ''
  });

  const fetchContracts = async () => {
    try {
      const token = localStorage.getItem('token');
      // FIXED: Corrected the backtick syntax error
      const response = await fetch(`http://${window.location.hostname}:5000/api/contracts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContracts(data);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://${window.location.hostname}:5000/api/users/clients`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setClients(data);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };

    fetchClients();
    fetchContracts(); 
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId) {
      alert("Please select a client from the dropdown first!");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // FIXED: Corrected the backtick syntax error
      const response = await fetch(`http://${window.location.hostname}:5000/api/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: formData.userId,
          company_name: formData.companyName,
          start_date: formData.startDate,
          end_date: formData.endDate
        })
      });

      if (!response.ok) throw new Error('Failed to create contract.');

      setFormData({ userId: '', companyName: '', startDate: '', endDate: '' });
      fetchContracts();

    } catch (error) {
      console.error('Error creating contract:', error);
      alert(error.message);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 p-8">
        <header className="mb-8 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-slate-800">Contract Management</h2>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          <div className="xl:col-span-1">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800">Create New Contract</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Assign to Client</label>
                  <select
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-700 focus:border-[#d2f34c] focus:outline-none focus:ring-2 focus:ring-[#d2f34c]/50 bg-white"
                    value={formData.userId}
                    onChange={(e) => setFormData({...formData, userId: e.target.value})}
                  >
                    <option value="" disabled>-- Select a Client --</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Company Name</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-700 focus:border-[#d2f34c] focus:outline-none focus:ring-2 focus:ring-[#d2f34c]/50"
                    placeholder="e.g. Acme Corp"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-700 focus:border-[#d2f34c] focus:outline-none focus:ring-2 focus:ring-[#d2f34c]/50"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">End Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-700 focus:border-[#d2f34c] focus:outline-none focus:ring-2 focus:ring-[#d2f34c]/50"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 rounded-lg bg-[#d2f34c] px-6 py-2.5 font-bold text-slate-900 transition-colors hover:bg-[#b8d839]"
                >
                  Generate Contract
                </button>
              </form>
            </div>
          </div>

          <div className="xl:col-span-2">
            <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800">All Contracts</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Company</th>
                      <th className="px-6 py-3 font-semibold">Client Name</th>
                      <th className="px-6 py-3 font-semibold">Duration</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contracts.length > 0 ? (
                      contracts.map(contract => (
                        <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{contract.company_name}</td>
                          <td className="px-6 py-4">{contract.client_name}</td>
                          <td className="px-6 py-4">
                            {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              contract.status === 'Active' ? 'bg-[#d2f34c]/20 text-slate-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {contract.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                          No contracts found. Create one to get started!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}