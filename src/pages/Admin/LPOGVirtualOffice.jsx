import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

export default function LPOGVirtualOffice() {
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person_1: '',
    contact_person_2: '',
    email_1: '',
    email_2: '',
    date_started: '',
    duration: '',
    end_date: '',
    rate_per_month: '',
    payment_info: '',
    payment_terms: '', 
    remarks: ''
  });

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetches ONLY the LPOG clients!
      const response = await fetch('http://localhost:5000/api/virtual-offices?branch=LPOG', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching LPOG clients:', error);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/virtual-offices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // Automatically tags this new client as LPOG!
        body: JSON.stringify({ ...formData, branch: 'LPOG' }) 
      });

      if (!response.ok) throw new Error('Failed to add client');

      fetchClients();
      setShowModal(false);
      setFormData({
        company_name: '', contact_person_1: '', contact_person_2: '', email_1: '', email_2: '',
        date_started: '', duration: '', end_date: '', rate_per_month: '', payment_info: '', payment_terms: '', remarks: ''
      });

    } catch (error) {
      console.error('Error adding client:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 p-8 overflow-hidden">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">LPOG Virtual Office</h2>
            <p className="text-slate-500 mt-1">Manage all clients stationed at the LPOG branch.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-[#d2f34c] px-6 py-2.5 font-bold text-slate-900 transition-colors hover:bg-[#b8d839] shadow-sm"
          >
            + Add New Client
          </button>
        </header>

        <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Company & Contacts</th>
                  <th className="px-6 py-4 font-semibold">Emails</th>
                  <th className="px-6 py-4 font-semibold">Duration & Dates</th>
                  <th className="px-6 py-4 font-semibold">Rate & Terms</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.length > 0 ? (
                  clients.map(client => (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{client.company_name}</p>
                        <p className="text-xs text-slate-500">1: {client.contact_person_1}</p>
                        {client.contact_person_2 && <p className="text-xs text-slate-500">2: {client.contact_person_2}</p>}
                      </td>
                      <td className="px-6 py-4 text-xs text-blue-500">
                        <p>{client.email_1 || '-'}</p>
                        {client.email_2 && <p>{client.email_2}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-700">{client.duration}</p>
                        <p className="text-xs text-slate-500">{formatDate(client.date_started)} to {formatDate(client.end_date)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800">{formatCurrency(client.rate_per_month)} /mo</p>
                        <p className="text-xs font-bold text-[#b8d839] uppercase tracking-wide mt-0.5">{client.payment_terms}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[150px]" title={client.payment_info}>{client.payment_info}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          client.contract_status === 'Active' ? 'bg-[#d2f34c]/20 text-slate-800' : 'bg-red-100 text-red-600'
                        }`}>
                          {client.contract_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs italic text-slate-500 max-w-[200px] truncate" title={client.remarks}>
                        {client.remarks || 'None'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      No LPOG clients found. Click "Add New Client" to populate the list!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800">Register LPOG Client</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Column 1: Company & Contacts */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 border-b pb-2">Client Details</h4>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Company Name *</label>
                  <input required type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Contact Person 1 *</label>
                  <input required type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.contact_person_1} onChange={(e) => setFormData({...formData, contact_person_1: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Contact Person 2</label>
                  <input type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.contact_person_2} onChange={(e) => setFormData({...formData, contact_person_2: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address 1</label>
                  <input type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.email_1} onChange={(e) => setFormData({...formData, email_1: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address 2</label>
                  <input type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.email_2} onChange={(e) => setFormData({...formData, email_2: e.target.value})} />
                </div>
              </div>

              {/* Column 2: Contract & Dates */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 border-b pb-2">Contract Info</h4>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Date Started *</label>
                  <input required type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.date_started} onChange={(e) => setFormData({...formData, date_started: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Duration (e.g. 1 yr) *</label>
                  <input required type="text" placeholder="e.g. 6 mos" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">End Date</label>
                  <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Remarks / Notes</label>
                  <textarea rows="3" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})}></textarea>
                </div>
              </div>

              {/* Column 3: Billing & Payments */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 border-b pb-2">Billing Details</h4>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Rate (per month) *</label>
                  <input required type="number" step="0.01" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.rate_per_month} onChange={(e) => setFormData({...formData, rate_per_month: e.target.value})} />
                </div>
                
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Terms *</label>
                  <select 
                    required 
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    value={formData.payment_terms} 
                    onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                  >
                    <option value="" disabled>-- Select Term --</option>
                    <option value="Full Payment">Full Payment</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annual">Semi-Annual</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Info</label>
                  <input type="text" placeholder="e.g. Billed 12/05" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.payment_info} onChange={(e) => setFormData({...formData, payment_info: e.target.value})} />
                </div>
              </div>

              {/* Form Actions */}
              <div className="col-span-1 md:col-span-3 mt-4 flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="rounded-lg bg-[#d2f34c] px-8 py-2.5 font-bold text-slate-900 hover:bg-[#b8d839] transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}