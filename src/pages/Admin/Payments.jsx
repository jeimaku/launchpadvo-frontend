import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]); // For the dropdown menu
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Grab the user's role to determine if they can verify payments
  const userRole = localStorage.getItem('userRole') || 'staff';
  const canVerify = ['admin', 'manager', 'supervisor'].includes(userRole);

  const [formData, setFormData] = useState({
    virtual_office_id: '',
    amount_paid: '',
    mode_of_payment: '',
    reference_number: '',
    payment_date: new Date().toISOString().split('T')[0] // Defaults to today
  });

  // Fetch the master ledger of payments
  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/payments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  // Fetch all clients so the staff can select who is paying
  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/virtual-offices', {
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

  useEffect(() => {
    fetchPayments();
    fetchClients();
  }, []);

  // Handle a Staff member submitting a new payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to record payment');

      fetchPayments();
      setShowModal(false);
      setFormData({
        virtual_office_id: '', amount_paid: '', mode_of_payment: '', 
        reference_number: '', payment_date: new Date().toISOString().split('T')[0]
      });

    } catch (error) {
      console.error('Error recording payment:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle a Manager clicking "Verify"
  const handleVerify = async (paymentId) => {
    if (!window.confirm("Are you sure you want to verify this payment? This will generate the official receipt.")) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/payments/${paymentId}/verify`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to verify payment');
      
      fetchPayments(); // Refresh the table to show it as verified!
    } catch (error) {
      console.error('Error verifying:', error);
      alert(error.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 p-8 overflow-hidden">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Payments & Receipts</h2>
            <p className="text-slate-500 mt-1">Master financial ledger and verification queue.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-[#d2f34c] px-6 py-2.5 font-bold text-slate-900 transition-colors hover:bg-[#b8d839] shadow-sm"
          >
            + Record Payment
          </button>
        </header>

        <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Company</th>
                  <th className="px-6 py-4 font-semibold">Amount & Mode</th>
                  <th className="px-6 py-4 font-semibold">Reference #</th>
                  <th className="px-6 py-4 font-semibold">Staff Maker</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length > 0 ? (
                  payments.map(payment => (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {payment.company_name}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{formatCurrency(payment.amount_paid)}</p>
                        <p className="text-xs text-slate-500">{payment.mode_of_payment}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {payment.reference_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {payment.recorded_by_name}
                      </td>
                      <td className="px-6 py-4">
                        {payment.status === 'Pending' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            Pending Verification
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                            Verified
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* THE MAKER-CHECKER LOGIC IN ACTION */}
                        {payment.status === 'Pending' && canVerify && (
                          <button 
                            onClick={() => handleVerify(payment.id)}
                            className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                          >
                            Verify Payment
                          </button>
                        )}
                        
                        {payment.status === 'Verified' && (
                          <button 
                            onClick={() => alert('PDF Generator coming next!')}
                            className="rounded border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            📄 Receipt
                          </button>
                        )}

                        {payment.status === 'Pending' && !canVerify && (
                          <span className="text-xs text-slate-400 italic">Awaiting Manager</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pop-up Modal for Recording a Payment */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800">Record Payment</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Select Client *</label>
                <select 
                  required 
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 bg-white"
                  value={formData.virtual_office_id} 
                  onChange={(e) => setFormData({...formData, virtual_office_id: e.target.value})}
                >
                  <option value="" disabled>-- Choose a Company --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.company_name} ({client.branch})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Amount Paid (₱) *</label>
                <input required type="number" step="0.01" className="w-full rounded-lg border border-slate-300 px-4 py-2" value={formData.amount_paid} onChange={(e) => setFormData({...formData, amount_paid: e.target.value})} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Mode of Payment *</label>
                <select 
                  required 
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 bg-white"
                  value={formData.mode_of_payment} 
                  onChange={(e) => setFormData({...formData, mode_of_payment: e.target.value})}
                >
                  <option value="" disabled>-- Select Method --</option>
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Bank Transfer (BDO)">Bank Transfer (BDO)</option>
                  <option value="Bank Transfer (Metrobank)">Bank Transfer (Metrobank)</option>
                  <option value="Check">Check</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Reference Number</label>
                <input type="text" placeholder="e.g. 100234958" className="w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm" value={formData.reference_number} onChange={(e) => setFormData({...formData, reference_number: e.target.value})} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Date of Payment *</label>
                <input required type="date" className="w-full rounded-lg border border-slate-300 px-4 py-2" value={formData.payment_date} onChange={(e) => setFormData({...formData, payment_date: e.target.value})} />
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="rounded-lg bg-[#d2f34c] px-6 py-2.5 font-bold text-slate-900 hover:bg-[#b8d839] disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Submit Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}