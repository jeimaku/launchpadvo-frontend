import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell'; // Added Import
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import myLogo from '../../assets/launchpad.png';
import { QRCodeSVG } from 'qrcode.react';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]); 
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Advanced Features State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterMode, setFilterMode] = useState('All');
  const [confirmAction, setConfirmAction] = useState({ show: false, type: '', paymentId: null });
  
  // Modals
  const [viewModal, setViewModal] = useState({ show: false, payment: null });
  
  // Receipt Preview Modal
  const [receiptPreview, setReceiptPreview] = useState({ show: false, data: null });
  const [isDownloading, setIsDownloading] = useState(false);

  // User Role Checking
  const userRole = localStorage.getItem('userRole') || 'staff';
  const canVerify = ['admin', 'manager', 'supervisor'].includes(userRole);
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  const [formData, setFormData] = useState({
    virtual_office_id: '', amount_paid: '', mode_of_payment: '', 
    reference_number: '', payment_date: new Date().toISOString().split('T')[0]
  });

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/payments', {
        headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' }
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (error) { console.error('Error fetching payments:', error); }
  };

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const resLPC = await fetch('http://localhost:5000/api/virtual-offices?branch=LPC', { headers: { 'Authorization': `Bearer ${token}` }});
      const resLPOG = await fetch('http://localhost:5000/api/virtual-offices?branch=LPOG', { headers: { 'Authorization': `Bearer ${token}` }});
      
      if (resLPC.ok && resLPOG.ok) {
        const lpcData = await resLPC.json();
        const lpogData = await resLPOG.json();
        setClients([...lpcData, ...lpogData]);
      }
    } catch (error) { console.error('Error fetching clients:', error); }
  };

  useEffect(() => { fetchPayments(); fetchClients(); }, []);

  // METRICS & FILTERS
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalVerified = payments.filter(p => p.status === 'Verified').reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalVoided = payments.filter(p => p.status === 'Voided').reduce((sum, p) => sum + Number(p.amount_paid), 0);

  const uniqueModes = [...new Set(payments.map(p => p.mode_of_payment))].filter(Boolean);
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (payment.reference_number && payment.reference_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'All' || payment.status === filterStatus;
    const matchesMode = filterMode === 'All' || payment.mode_of_payment === filterMode;
    return matchesSearch && matchesStatus && matchesMode;
  });

  // ==========================================
  // 📸 DOWNLOAD LOGIC (PNG & SECURE PDF)
  // ==========================================
  
  const captureReceiptImage = async () => {
    const receiptElement = document.getElementById('secure-receipt-template');
    if (!receiptElement) throw new Error("Receipt element not found");
    
    return await toPng(receiptElement, { 
      cacheBust: true, 
      backgroundColor: '#ffffff', 
      pixelRatio: 2,
      width: receiptElement.scrollWidth,
      height: receiptElement.scrollHeight
    });
  };

  const handleDownloadPNG = async () => {
    setIsDownloading(true);
    try {
      const dataUrl = await captureReceiptImage();
      const link = document.createElement('a');
      link.download = `Launchpad_Receipt_${receiptPreview.data.official_receipt_number}.png`; 
      link.href = dataUrl;
      link.click();
    } catch (error) {
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSecurePDF = async () => {
    setIsDownloading(true);
    try {
      const dataUrl = await captureReceiptImage();
      const receiptElement = document.getElementById('secure-receipt-template');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = receiptElement.scrollWidth;
      const imgHeight = receiptElement.scrollHeight;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      const marginX = (pdfWidth - finalWidth) / 2;

      pdf.addImage(dataUrl, 'PNG', marginX, 0, finalWidth, finalHeight);
      pdf.save(`Launchpad_Receipt_REC${receiptPreview.data.id.toString().padStart(5, '0')}.pdf`);
    } catch (error) {
      alert("Failed to generate Secure PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // CRUD ACTIONS
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (!response.ok) throw new Error('Failed to record payment');
      
      fetchPayments();
      setShowRecordModal(false);
      setFormData({ virtual_office_id: '', amount_paid: '', mode_of_payment: '', reference_number: '', payment_date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeAction = async () => {
    const { type, paymentId } = confirmAction;
    setConfirmAction({ show: false, type: '', paymentId: null });
    const token = localStorage.getItem('token');

    try {
      let response;
      if (type === 'VERIFY') {
        response = await fetch(`http://localhost:5000/api/payments/${paymentId}/verify`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }});
      } else if (type === 'DELETE') {
        response = await fetch(`http://localhost:5000/api/payments/${paymentId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
      } else if (type === 'VOID') {
        response = await fetch(`http://localhost:5000/api/payments/${paymentId}/void`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }});
      }
      if (!response.ok) throw new Error('Action failed');
      fetchPayments();
    } catch (error) {
      alert(error.message);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  const selectedClient = clients.find(c => c.id.toString() === formData.virtual_office_id);

  const IconEye = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
  const IconReceipt = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  const IconCheck = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
  const IconTrash = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
  const IconXCircle = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 p-8 overflow-hidden overflow-y-auto max-h-screen">
        {/* MODIFIED HEADER WITH NOTIFICATION BELL */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Payments & Receipts</h2>
            <p className="text-slate-500 mt-1">Master financial ledger and verification queue.</p>
          </div>
          <div className="flex items-center gap-4">
            {canViewNotifications && <NotificationBell />}
            <button onClick={() => setShowRecordModal(true)} className="rounded-lg bg-[#d2f34c] px-6 py-2.5 font-bold text-slate-900 transition-colors hover:bg-[#b8d839] shadow-sm flex items-center gap-2">
              <span>+</span> Record Payment
            </button>
          </div>
        </header>

        {/* METRICS DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
          <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 lg:gap-4 overflow-hidden">
            <div className="shrink-0 h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-bold text-slate-500 uppercase truncate">Pending Verification</p>
              <p className="text-xl lg:text-2xl font-black text-slate-800 truncate">{formatCurrency(totalPending)}</p>
            </div>
          </div>
          <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 lg:gap-4 overflow-hidden">
            <div className="shrink-0 h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-bold text-slate-500 uppercase truncate">Verified Revenue</p>
              <p className="text-xl lg:text-2xl font-black text-slate-800 truncate">{formatCurrency(totalVerified)}</p>
            </div>
          </div>
          <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 lg:gap-4 overflow-hidden opacity-75">
            <div className="shrink-0 h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-bold text-slate-500 uppercase truncate">Total Voided</p>
              <p className="text-xl lg:text-2xl font-black text-slate-800 truncate">{formatCurrency(totalVoided)}</p>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <input 
              type="text" placeholder="Search Company or Reference #..." 
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-[#b8d839] focus:ring-1 focus:ring-[#b8d839]"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-48">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Voided">Voided</option>
            </select>
          </div>
          <div className="w-48">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
              <option value="All">All Modes</option>
              {uniqueModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 min-w-[900px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date & Maker</th>
                  <th className="px-6 py-4 font-semibold">Company</th>
                  <th className="px-6 py-4 font-semibold">Amount & Mode</th>
                  <th className="px-6 py-4 font-semibold">Reference #</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length > 0 ? (
                  filteredPayments.map(payment => (
                    <tr key={payment.id} className={`transition-colors ${payment.status === 'Voided' ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-700">{new Date(payment.payment_date).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-400">By: {payment.recorded_by_name}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{payment.company_name}</td>
                      <td className="px-6 py-4">
                        <p className={`font-bold ${payment.status === 'Voided' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {formatCurrency(payment.amount_paid)}
                        </p>
                        <p className="text-xs text-slate-500">{payment.mode_of_payment}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{payment.reference_number || 'N/A'}</td>
                      <td className="px-6 py-4">
                        {payment.status === 'Pending' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Pending</span>}
                        {payment.status === 'Verified' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Verified</span>}
                        {payment.status === 'Voided' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-500">Voided</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2 items-center flex-wrap">
                          <button onClick={() => setViewModal({ show: true, payment: payment })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border text-slate-600 bg-white border-slate-200 hover:bg-slate-100 shadow-sm">
                            <IconEye /> View
                          </button>

                          {payment.status === 'Pending' && (
                            <>
                              <button onClick={() => setConfirmAction({ show: true, type: 'DELETE', paymentId: payment.id })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border text-red-600 bg-red-50 border-red-200 hover:bg-red-100 shadow-sm">
                                <IconTrash /> Delete
                              </button>
                              {canVerify && (
                                <button onClick={() => setConfirmAction({ show: true, type: 'VERIFY', paymentId: payment.id })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 shadow-sm">
                                  <IconCheck /> Verify
                                </button>
                              )}
                            </>
                          )}

                          {payment.status === 'Verified' && (
                            <>
                              <button 
                                onClick={() => setReceiptPreview({ show: true, data: payment })} 
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border text-green-700 bg-green-50 border-green-200 hover:bg-green-100 shadow-sm"
                              >
                                <IconReceipt /> Receipt
                              </button>
                              {canVerify && (
                                <button onClick={() => setConfirmAction({ show: true, type: 'VOID', paymentId: payment.id })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100 shadow-sm">
                                  <IconXCircle /> Void
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">No matching payments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🧾 RECEIPT PREVIEW MODAL */}
      {/* ========================================== */}
      {receiptPreview.show && receiptPreview.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[95vh] w-full max-w-[900px] overflow-hidden animate-fade-in">
            
            <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 mb-4 sm:mb-0">Receipt Preview</h2>
              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => setReceiptPreview({ show: false, data: null })} 
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 bg-white"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDownloadPNG}
                  disabled={isDownloading}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-slate-900 bg-[#d2f34c] hover:bg-[#b8d839] rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isDownloading ? 'Processing...' : 'Download Image'}
                </button>
                <button 
                  onClick={handleDownloadSecurePDF}
                  disabled={isDownloading}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isDownloading ? 'Processing...' : 'Download Secure PDF'}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-200 flex justify-center custom-scrollbar">
              <div id="secure-receipt-template" className="w-[800px] min-h-[1130px] shrink-0 bg-white text-black font-serif p-12 shadow-lg border border-slate-200 flex flex-col relative overflow-hidden">

                <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" 
                    style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><text x="0" y="100" font-family="sans-serif" font-size="24" font-weight="bold" fill="black" transform="rotate(-45 100 100)">LAUNCHPAD COWORKING</text></svg>')`, backgroundSize: '150px 150px' }}>
                </div>

                <div className="flex justify-between items-start border-b-[3px] border-slate-900 pb-6 mb-8 relative z-10">
                  <div className="flex items-center gap-4">
                  <img src={myLogo} alt="Launchpad Logo" className="h-16 object-contain" />
                  <div className="mt-1">
                    <h1 className="text-4xl font-serif font-black uppercase tracking-tight text-black leading-none">
                      Launchpad
                    </h1>
                    <p className="text-lg font-sans font-bold text-[#567189] uppercase tracking-[0.25em] mt-1">
                      Coworking
                    </p>
                  </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-4xl font-black text-slate-200 uppercase tracking-wider mb-2">Receipt</h2>
                    <p className="font-bold text-slate-600">No. <span className="text-slate-900 ml-1">{receiptPreview.data.official_receipt_number}</span></p>
                    <p className="text-sm font-semibold text-slate-500 mt-1">Date: <span className="text-slate-800 ml-1">{new Date(receiptPreview.data.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-10 relative z-10">
                  <div className="p-5 border border-slate-200 rounded-lg bg-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Branch / Facility</p>
                    <p className="text-lg font-bold text-slate-800">{receiptPreview.data.branch === 'LPC' ? 'Commercenter Alabang' : receiptPreview.data.branch === 'LPOG' ? 'One Griffinstone' : 'Headquarters'}</p>
                    <p className="text-sm font-medium text-slate-500 mt-1">Virtual Office Registration</p>
                  </div>
                  <div className="p-5 border border-slate-200 rounded-lg">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To</p>
                    <p className="text-xl font-bold text-slate-900 leading-tight">{receiptPreview.data.company_name}</p>
                    <p className="text-sm font-medium text-slate-500 mt-1">Authorized Representative</p>
                  </div>
                </div>

                <table className="w-full text-left mb-10 border-collapse relative z-10">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-3 px-2 text-sm font-bold text-slate-800 uppercase tracking-wider w-[40%]">Package Tier</th>
                      <th className="py-3 px-2 text-sm font-bold text-slate-800 uppercase tracking-wider w-[60%]">Status / Inclusions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-5 px-2 align-top">
                        <p className="font-bold text-lg text-slate-900">Virtual Office</p>
                        <p className="text-sm font-semibold text-[#8ca81b] bg-[#d2f34c]/20 inline-block px-2 py-0.5 rounded mt-2 uppercase">{receiptPreview.data.package_tier}</p>
                      </td>
                      <td className="py-5 px-2 align-top">
                        {receiptPreview.data.package_tier === 'Use of Address' ? (
                          <ul className="list-disc list-inside space-y-1 text-sm font-medium text-slate-700">
                            <li>Use of address for Business Registration</li>
                            {receiptPreview.data.branch === 'LPOG' && <li>Mail handling included</li>}
                          </ul>
                        ) : receiptPreview.data.package_tier.startsWith('Custom:') ? (
                          <p className="text-sm font-medium text-slate-700">{receiptPreview.data.package_tier.replace('Custom: ', '')}</p>
                        ) : (
                          <ul className="list-disc list-inside space-y-1 text-sm font-medium text-slate-700">
                            <li>10 days use of coworking desk per month</li>
                            <li>Access during operating hours: Monday-Friday, 9:00 am - 7:00 pm; Sat 10:00 am-5:00 pm</li>
                            <li>Receptionist during operating hours</li>
                            <li>Air-conditioning, lighting, and furniture</li>
                            <li>Unlimited coffee and filtered water</li>
                            <li>High speed internet access</li>
                            <li>Access to printer/ scanner/ photocopier (print 10 pages/day)</li>
                            <li>Access to lounge and pantry</li>
                            <li>Free 3-hour parking (P10.00 in every succeeding hour)</li>
                            <li>Access to Launchpad-hosted events (i.e. Mission Mondays, Pitch Night)</li>
                            <li>Use of address for Business Registration</li>
                            <li>Mail handling</li>
                            <li>Renewal every 12 months at a discounted price</li>
                          </ul>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-end mb-12 relative z-10">
                  <div className="w-[400px] bg-slate-50 rounded-lg border border-slate-200 p-6 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-300 pb-3 mb-4 text-center">Payment Summary</h4>
                    <div className="space-y-3 text-sm font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mode of Payment</span>
                        <span className="text-slate-800 font-bold">{receiptPreview.data.mode_of_payment}</span>
                      </div>
                      {receiptPreview.data.reference_number && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Reference No.</span>
                          <span className="font-mono text-slate-800">{receiptPreview.data.reference_number}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-3">
                        <span className="text-lg font-black text-slate-900">Total Paid</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(receiptPreview.data.amount_paid)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 text-sm mt-auto pt-8 border-t border-slate-200 relative z-10">
                  <div>
                    <p className="font-bold text-slate-800 uppercase tracking-widest mb-1">Received & Encoded By</p>
                    <p className="text-slate-500 font-medium">{receiptPreview.data.recorded_by_name}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 uppercase tracking-widest mb-1">Officially Verified By</p>
                    <p className="text-slate-500 font-medium">{receiptPreview.data.verified_by_name || 'Management Team'}</p>
                  </div>
                  <div className="flex justify-end items-center">
                    <QRCodeSVG 
                      value={`LAUNCHPAD COWORKING\nReceipt: ${receiptPreview.data.official_receipt_number}\nBilled To: ${receiptPreview.data.company_name}\nAmount: PHP ${receiptPreview.data.amount_paid}\nDate: ${new Date(receiptPreview.data.payment_date).toLocaleDateString()}\nStatus: OFFICIAL`}
                      size={80}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                </div>

                <p className="text-center text-xs font-semibold text-slate-400 mt-16 tracking-widest uppercase relative z-10">This is a system-generated, immutable official receipt.</p>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERVIEW MODAL */}
      {viewModal.show && viewModal.payment && (() => {
        const payment = viewModal.payment;
        const client = clients.find(c => c.id === payment.virtual_office_id) || {};

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Transaction Overview</h3>
                  <p className="text-sm text-slate-500">{payment.company_name} ({client.branch || payment.branch || 'N/A'})</p>
                </div>
                <button onClick={() => setViewModal({ show: false, payment: null })} className="text-slate-400 hover:text-slate-600 font-bold text-2xl">&times;</button>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 uppercase tracking-wide text-xs">Payment Information</h4>
                  <div className="grid grid-cols-2 gap-y-3">
                    <p className="text-slate-500">Amount Paid:</p>
                    <p className={`font-bold ${payment.status === 'Voided' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{formatCurrency(payment.amount_paid)}</p>
                    <p className="text-slate-500">Date Paid:</p>
                    <p className="font-semibold text-slate-800">{new Date(payment.payment_date).toLocaleDateString()}</p>
                    <p className="text-slate-500">Mode:</p>
                    <p className="font-semibold text-slate-800">{payment.mode_of_payment}</p>
                    <p className="text-slate-500">Reference #:</p>
                    <p className="font-mono text-slate-700">{payment.reference_number || 'None provided'}</p>
                    <p className="text-slate-500">Status:</p>
                    <p>
                      {payment.status === 'Pending' && <span className="text-amber-600 font-bold">Pending Verification</span>}
                      {payment.status === 'Verified' && <span className="text-green-600 font-bold">Verified</span>}
                      {payment.status === 'Voided' && <span className="text-red-600 font-bold">Voided</span>}
                    </p>
                  </div>

                  <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 uppercase tracking-wide text-xs mt-6">Audit Trail</h4>
                  <div className="grid grid-cols-2 gap-y-3">
                    <p className="text-slate-500">Encoded By:</p>
                    <p className="font-semibold text-slate-800">{payment.recorded_by_name}</p>
                    <p className="text-slate-500">Verified By:</p>
                    <p className="font-semibold text-slate-800">{payment.verified_by_name || '—'}</p>
                    <p className="text-slate-500">Record ID:</p>
                    <p className="font-mono text-xs text-slate-400">REC-{payment.id.toString().padStart(5, '0')}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 uppercase tracking-wide text-xs">Client Contract Details</h4>
                  {client.id ? (
                    <div className="grid grid-cols-2 gap-y-3">
                      <p className="text-slate-500">Package Tier:</p>
                      <p className="font-semibold text-slate-800 truncate" title={client.package_tier}>{client.package_tier}</p>
                      <p className="text-slate-500">Agreed Rate:</p>
                      <p className="font-semibold text-slate-800">{formatCurrency(client.rate_per_month)}</p>
                      <p className="text-slate-500">Payment Terms:</p>
                      <p className="font-semibold text-slate-800">{client.payment_terms}</p>
                      <p className="text-slate-500">Duration:</p>
                      <p className="font-semibold text-slate-800">{client.duration}</p>
                      <p className="text-slate-500">Contract Status:</p>
                      <p className="font-semibold text-slate-800">{client.contract_status}</p>
                      <p className="text-slate-500 mt-2">Primary Contact:</p>
                      <div className="col-span-2 text-slate-800">
                        <p className="font-semibold">{client.contact_person_1 || 'N/A'}</p>
                        <p className="text-blue-500 text-xs">{client.email_1 || 'No email provided'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-lg text-slate-500 text-xs italic text-center">
                      Detailed contract information could not be retrieved. The client record may have been deleted.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RECORD PAYMENT MODAL */}
      {showRecordModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800">Record Payment</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Select Client *</label>
                <select required className="w-full rounded-lg border border-slate-300 px-4 py-2 bg-white" value={formData.virtual_office_id} onChange={(e) => setFormData({...formData, virtual_office_id: e.target.value})}>
                  <option value="" disabled>-- Choose a Company --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.company_name} ({client.branch})</option>
                  ))}
                </select>
              </div>

              {selectedClient && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 shadow-inner">
                  <p className="font-bold mb-1">Billing Details:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li><span className="font-semibold">Agreed Rate:</span> {formatCurrency(selectedClient.rate_per_month)}</li>
                    <li><span className="font-semibold">Terms:</span> {selectedClient.payment_terms}</li>
                  </ul>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Amount Paid (₱) *</label>
                <input required type="number" step="0.01" className="w-full rounded-lg border border-slate-300 px-4 py-2" value={formData.amount_paid} onChange={(e) => setFormData({...formData, amount_paid: e.target.value})} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Mode of Payment *</label>
                <select required className="w-full rounded-lg border border-slate-300 px-4 py-2 bg-white" value={formData.mode_of_payment} onChange={(e) => setFormData({...formData, mode_of_payment: e.target.value})}>
                  <option value="" disabled>-- Select Method --</option>
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Bank Transfer (BDO)">Bank Transfer (BDO)</option>
                  <option value="Bank Transfer (Metrobank)">Bank Transfer (Metrobank)</option>
                  <option value="Check">Check</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  {formData.mode_of_payment === 'Cash' ? 'Physical OR Number (Optional)' : 'Reference Number *'}
                </label>
                <input 
                  type="text" required={formData.mode_of_payment !== 'Cash'}
                  placeholder={formData.mode_of_payment === 'Cash' ? "e.g. OR-1234 or leave blank" : "e.g. 100234958"} 
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm" 
                  value={formData.reference_number} onChange={(e) => setFormData({...formData, reference_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Date of Payment *</label>
                <input required type="date" className="w-full rounded-lg border border-slate-300 px-4 py-2" value={formData.payment_date} onChange={(e) => setFormData({...formData, payment_date: e.target.value})} />
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowRecordModal(false)} className="rounded-lg px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="rounded-lg bg-[#d2f34c] px-6 py-2.5 font-bold text-slate-900 hover:bg-[#b8d839] disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmAction.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4 ${
              confirmAction.type === 'DELETE' ? 'bg-red-100 text-red-600' : 
              confirmAction.type === 'VOID' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {confirmAction.type === 'DELETE' || confirmAction.type === 'VOID' ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {confirmAction.type === 'DELETE' ? 'Delete Draft?' : confirmAction.type === 'VOID' ? 'Void Official Receipt?' : 'Verify Payment?'}
            </h3>
            <p className="text-slate-500 mb-6 text-sm px-2">
              {confirmAction.type === 'DELETE' && "This will remove this pending payment completely. Use this only for mistakes."}
              {confirmAction.type === 'VOID' && "This will permanently void the official receipt and zero out its value in the reports. This cannot be undone."}
              {confirmAction.type === 'VERIFY' && "Please confirm the money has cleared the bank. This will lock the record and generate the official receipt."}
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmAction({ show: false, type: '', paymentId: null })} className="rounded-lg px-6 py-2 font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
              <button 
                onClick={executeAction} 
                className={`rounded-lg px-6 py-2 font-bold text-white shadow-sm transition-colors ${
                  confirmAction.type === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 
                  confirmAction.type === 'VOID' ? 'bg-slate-600 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}