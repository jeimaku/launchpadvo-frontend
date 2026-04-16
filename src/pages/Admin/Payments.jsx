import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell'; 
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import myLogo from '../../assets/launchpad.png';
import { QRCodeSVG } from 'qrcode.react';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]); 
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterMode, setFilterMode] = useState('All');
  const [filterMaker, setFilterMaker] = useState('All'); 

  // NEW: State for the Coverage Period Filter
  const [filterCoverageStart, setFilterCoverageStart] = useState('');
  const [filterCoverageEnd, setFilterCoverageEnd] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  const [confirmAction, setConfirmAction] = useState({ show: false, type: '', paymentId: null });
  
  const [viewModal, setViewModal] = useState({ show: false, payment: null });
  
  const [receiptPreview, setReceiptPreview] = useState({ show: false, data: null });
  const [isDownloading, setIsDownloading] = useState(false);

  const userRole = localStorage.getItem('userRole') || 'staff';
  const canVerify = ['admin', 'manager', 'supervisor'].includes(userRole);
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  const [formData, setFormData] = useState({
    virtual_office_id: '', amount_paid: '', mode_of_payment: '', 
    reference_number: '', payment_date: new Date().toISOString().split('T')[0],
    payment_type: '', coverage_start_date: '', coverage_end_date: '' // NEW FIELDS
  });
  
  // NEW STATE: To hold the SI Number temporarily during verification
  const [siNumberInput, setSiNumberInput] = useState('');

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/payments`, {
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
      const resLPC = await fetch(`http://${window.location.hostname}:5000/api/virtual-offices?branch=LPC`, { headers: { 'Authorization': `Bearer ${token}` }});
      const resLPOG = await fetch(`http://${window.location.hostname}:5000/api/virtual-offices?branch=LPOG`, { headers: { 'Authorization': `Bearer ${token}` }});
      
      if (resLPC.ok && resLPOG.ok) {
        const lpcData = await resLPC.json();
        const lpogData = await resLPOG.json();
        setClients([...lpcData, ...lpogData]);
      }
    } catch (error) { console.error('Error fetching clients:', error); }
  };

  useEffect(() => { fetchPayments(); fetchClients(); }, []);

  const totalPending = payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalVerified = payments.filter(p => p.status === 'Verified').reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalVoided = payments.filter(p => p.status === 'Voided').reduce((sum, p) => sum + Number(p.amount_paid), 0);

  const uniqueModes = [...new Set(payments.map(p => p.mode_of_payment))].filter(Boolean).sort();
  const uniqueMakers = [...new Set(payments.map(p => p.recorded_by_name))].filter(Boolean).sort(); 

  // UPGRADED FILTER LOGIC
  const filteredPayments = payments.filter(payment => {
    // 1. Search by Company, Reference No, OR SI Number
    const matchesSearch = payment.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (payment.reference_number && payment.reference_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (payment.si_number && payment.si_number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'All' || payment.status === filterStatus;
    const matchesMode = filterMode === 'All' || payment.mode_of_payment === filterMode;
    const matchesMaker = filterMaker === 'All' || payment.recorded_by_name === filterMaker; 
    
    // 2. Filter by Coverage Dates
    // If a start filter is set, the payment's coverage start must be on or after it
    const matchesCoverageStart = !filterCoverageStart || (payment.coverage_start_date && payment.coverage_start_date >= filterCoverageStart);
    // If an end filter is set, the payment's coverage end must be on or before it
    const matchesCoverageEnd = !filterCoverageEnd || (payment.coverage_end_date && payment.coverage_end_date <= filterCoverageEnd);

    return matchesSearch && matchesStatus && matchesMode && matchesMaker && matchesCoverageStart && matchesCoverageEnd;
  });

  // Make sure to add the new filters to the useEffect dependency array so it resets to Page 1!
  useEffect(() => {
    setCurrentPage(1); 
  }, [searchTerm, filterStatus, filterMode, filterMaker, filterCoverageStart, filterCoverageEnd, itemsPerPage]);

  const actualItemsPerPage = itemsPerPage === 'All' ? filteredPayments.length : Number(itemsPerPage);
  const totalPages = Math.ceil(filteredPayments.length / (actualItemsPerPage || 1));
  const indexOfLastItem = currentPage * actualItemsPerPage;
  const indexOfFirstItem = indexOfLastItem - actualItemsPerPage;
  const currentItems = filteredPayments.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (direction) => {
    if (direction === 'prev' && currentPage > 1) setCurrentPage(currentPage - 1);
    if (direction === 'next' && currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

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

// ==========================================
  // UNIFIED SMART PAYMENT CALCULATOR (BULLETPROOF)
  // ==========================================
  const getPaymentDetails = (client, selectedType) => {
    if (!client) return { amount: '', start: '', end: '', isFullyPaid: false };

    const startObj = new Date(client.date_started);
    const endObj = new Date(client.end_date);
    const rate = parseFloat(client.rate_per_month) || 0;

    // 1. Find where we left off (using verified and pending to avoid overlap)
    const clientPayments = payments.filter(p => String(p.virtual_office_id) === String(client.id) && p.status !== 'Voided');
    let nextStartObj = new Date(client.date_started);
    let isFirstPayment = clientPayments.length === 0;

    if (!isFirstPayment) {
        const validDates = clientPayments.filter(p => p.coverage_end_date).map(p => new Date(p.coverage_end_date));
        if (validDates.length > 0) {
            const maxDate = new Date(Math.max(...validDates));
            nextStartObj = new Date(maxDate);
            nextStartObj.setDate(nextStartObj.getDate() + 1); // Start the day AFTER the last payment ended
        }
    }

    // --- LOOPHOLE 2 FIXED: Prevent billing beyond the contract ---
    if (nextStartObj > endObj) {
        return { amount: 0, start: endObj.toISOString().split('T')[0], end: endObj.toISOString().split('T')[0], isFullyPaid: true };
    }

    // 2. Initial Prorated Math
    const daysInStartMonth = new Date(startObj.getFullYear(), startObj.getMonth() + 1, 0).getDate();
    let firstMonthAmount = rate;
    let initialEndDate = new Date(startObj.getFullYear(), startObj.getMonth() + 1, 0); 
    if (startObj.getDate() !== 1) {
        firstMonthAmount = (rate / daysInStartMonth) * (daysInStartMonth - startObj.getDate() + 1);
    }

    // --- LOOPHOLE 1 FIXED: Final Prorated Math (Calculates exactly from where we left off) ---
    const daysInEndMonth = new Date(endObj.getFullYear(), endObj.getMonth() + 1, 0).getDate();
    const activeDaysLeft = Math.round((endObj - nextStartObj) / (1000 * 60 * 60 * 24)) + 1;
    let finalMonthAmount = (rate / daysInEndMonth) * activeDaysLeft;

    // 3. Regular Installment Math
    let stdAmount = rate;
    let regularEndDate = new Date(nextStartObj);
    if (client.payment_terms === 'Quarterly') {
        stdAmount = rate * 3;
        regularEndDate.setMonth(regularEndDate.getMonth() + 3);
    } else if (client.payment_terms === 'Semi-Annual') {
        stdAmount = rate * 6;
        regularEndDate.setMonth(regularEndDate.getMonth() + 6);
    } else if (client.payment_terms === 'Annually' || client.payment_terms === 'Annual') {
        stdAmount = rate * 12;
        regularEndDate.setMonth(regularEndDate.getMonth() + 12);
    } else {
        regularEndDate.setMonth(regularEndDate.getMonth() + 1);
    }
    regularEndDate.setDate(regularEndDate.getDate() - 1);
    
    // Cap regular installment at contract end to prevent overflow
    if (regularEndDate > endObj) regularEndDate = new Date(endObj); 

    // 4. Total Balance Math
    let fullMonthsBetween = (endObj.getFullYear() - startObj.getFullYear()) * 12 + (endObj.getMonth() - startObj.getMonth()) - 1;
    if (fullMonthsBetween < 0) fullMonthsBetween = 0;
    if (startObj.getDate() === 1) fullMonthsBetween += 1;

    const totalContractValue = firstMonthAmount + ((rate / daysInEndMonth) * endObj.getDate()) + (fullMonthsBetween * rate);
    const verifiedPayments = payments.filter(p => String(p.virtual_office_id) === String(client.id) && p.status === 'Verified');
    const pendingPayments = payments.filter(p => String(p.virtual_office_id) === String(client.id) && p.status === 'Pending');
    const totalPaidSoFar = verifiedPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) + pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
    const remainingBalance = totalContractValue - totalPaidSoFar;

    // 5. Route the exact dates and amounts
    switch (selectedType) {
        case 'Initial Prorated Payment':
            return { amount: firstMonthAmount, start: startObj.toISOString().split('T')[0], end: initialEndDate.toISOString().split('T')[0], isFullyPaid: false };
        case 'Final Prorated Payment':
            return { amount: finalMonthAmount, start: nextStartObj.toISOString().split('T')[0], end: endObj.toISOString().split('T')[0], isFullyPaid: false };
        case 'Regular Installment':
            return { amount: stdAmount, start: nextStartObj.toISOString().split('T')[0], end: regularEndDate.toISOString().split('T')[0], isFullyPaid: false };
        case 'Full Contract (Upfront)':
        case 'Remaining Contract Balance':
            return { amount: remainingBalance > 0 ? remainingBalance : 0, start: nextStartObj.toISOString().split('T')[0], end: endObj.toISOString().split('T')[0], isFullyPaid: false };
        default:
            return { amount: '', start: nextStartObj.toISOString().split('T')[0], end: '', isFullyPaid: false };
    }
  };

  const handleClientSelect = (e) => {
      const clientId = e.target.value;
      const client = clients.find(c => String(c.id) === String(clientId));

      if (!client) {
           setFormData(prev => ({ ...prev, virtual_office_id: clientId, isFullyPaid: false }));
           return;
      }

      const clientPayments = payments.filter(p => String(p.virtual_office_id) === String(client.id) && p.status !== 'Voided');
      const startObj = new Date(client.date_started);
      
      // Let's test what a regular installment would look like
      const testDetails = getPaymentDetails(client, 'Regular Installment');
      
      let autoType = 'Regular Installment';
      
      if (testDetails.isFullyPaid) {
          autoType = 'Remaining Contract Balance'; // Just to park the dropdown safely
      } else if (client.payment_terms === 'Full Payment' || client.payment_terms === 'Annually') {
          autoType = 'Full Contract (Upfront)';
      } else if (clientPayments.length === 0 && startObj.getDate() !== 1) {
          autoType = 'Initial Prorated Payment';
      } else if (testDetails.end === new Date(client.end_date).toISOString().split('T')[0]) {
          // --- SMART DETECTION: If the next regular end date hits the contract end date, 
          // it means this is the final payment cycle!
          autoType = 'Final Prorated Payment';
      }

      const details = getPaymentDetails(client, autoType);

      setFormData(prev => ({
          ...prev,
          virtual_office_id: clientId,
          payment_type: autoType,
          amount_paid: details.amount !== '' ? parseFloat(details.amount).toFixed(2) : '',
          coverage_start_date: details.start,
          coverage_end_date: details.end,
          isFullyPaid: details.isFullyPaid // Store this state so we can disable the button!
      }));
  };

  const handlePaymentTypeChange = (e) => {
      const selectedType = e.target.value;
      const client = clients.find(c => String(c.id) === String(formData.virtual_office_id));
      
      const details = getPaymentDetails(client, selectedType);

      setFormData(prev => ({ 
          ...prev, 
          payment_type: selectedType,
          amount_paid: details.amount !== '' ? parseFloat(details.amount).toFixed(2) : prev.amount_paid,
          coverage_start_date: details.start || prev.coverage_start_date,
          coverage_end_date: details.end || prev.coverage_end_date
      }));
  };

  // Helper to dynamically show remaining months in the UI
  const getMonthsLeft = () => {
    if (!formData.coverage_start_date || !formData.coverage_end_date) return null;
    const s = new Date(formData.coverage_start_date);
    const e = new Date(formData.coverage_end_date);
    const totalDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.round(totalDays / 30.44)); // Approximation
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/payments`, {
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
      // FIXED: Removed hardcoded IPs
      if (type === 'VERIFY') {
        if (!siNumberInput.trim()) {
           alert("Please enter the Sales Invoice (SI) Number.");
           return;
        }
        response = await fetch(`http://${window.location.hostname}:5000/api/payments/${paymentId}/verify`, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ si_number: siNumberInput }) // Send SI to backend
        });
        setSiNumberInput(''); // clear it after sending
      } else if (type === 'DELETE') {
        response = await fetch(`http://${window.location.hostname}:5000/api/payments/${paymentId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
      } else if (type === 'VOID') {
        response = await fetch(`http://${window.location.hostname}:5000/api/payments/${paymentId}/void`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }});
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

        <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-slate-100 space-y-4 shrink-0">
          <div className="w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Search</label>
            <input 
              type="text" 
              placeholder="🔍 Search by Company, Ref #, or SI Number..."  
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-[#b8d839] focus:ring-1 focus:ring-[#b8d839]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Payment Status</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Verified">Verified</option>
                <option value="Voided">Voided</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Mode of Payment</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
                <option value="All">All Modes</option>
                {uniqueModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Encoded By</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterMaker} onChange={(e) => setFilterMaker(e.target.value)}>
                <option value="All">All Staff</option>
                {uniqueMakers.map(maker => <option key={maker} value={maker}>{maker}</option>)}
              </select>
            </div>
          </div>

          {/* NEW: Coverage Period Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider flex justify-between">
                Coverage From <span className="font-normal text-slate-400 capitalize">Start Date</span>
              </label>
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterCoverageStart} onChange={(e) => setFilterCoverageStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider flex justify-between">
                Coverage To <span className="font-normal text-slate-400 capitalize">End Date</span>
              </label>
              <div className="flex gap-2">
                <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterCoverageEnd} onChange={(e) => setFilterCoverageEnd(e.target.value)} />
                
                {/* Clear Button appears only if a date is selected */}
                {(filterCoverageStart || filterCoverageEnd) && (
                  <button onClick={() => { setFilterCoverageStart(''); setFilterCoverageEnd(''); }} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold rounded-lg transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 min-w-[1050px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold w-32">Date & Maker</th>
                  <th className="px-6 py-4 font-semibold w-48">Company & Type</th>
                  <th className="px-6 py-4 font-semibold w-40">Coverage Period</th>
                  <th className="px-6 py-4 font-semibold w-32">Amount & Mode</th>
                  <th className="px-6 py-4 font-semibold w-40">Ref & SI Number</th>
                  <th className="px-6 py-4 font-semibold w-32">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                    {currentItems.length > 0 ? (
                      currentItems.map(payment => (
                    <tr key={payment.id} className={`transition-colors ${payment.status === 'Voided' ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                      {/* Date & Maker */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-700">{new Date(payment.payment_date).toLocaleDateString()}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">By: {payment.recorded_by_name}</p>
                      </td>
                      
                      {/* Company & Type */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{payment.company_name}</p>
                        <p className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 inline-block px-1.5 py-0.5 rounded mt-1 uppercase tracking-wide truncate max-w-[180px]" title={payment.payment_type}>
                          {payment.payment_type || 'Standard'}
                        </p>
                      </td>
                      
                      {/* Coverage Period */}
                      <td className="px-6 py-4">
                        {payment.coverage_start_date ? (
                          <div className="text-xs font-medium text-slate-700 leading-tight">
                            <p>{new Date(payment.coverage_start_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                            <p className="text-slate-400">to {new Date(payment.coverage_end_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not specified</span>
                        )}
                      </td>
                      
                      {/* Amount & Mode */}
                      <td className="px-6 py-4">
                        <p className={`font-bold ${payment.status === 'Voided' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {formatCurrency(payment.amount_paid)}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{payment.mode_of_payment}</p>
                      </td>
                      
                      {/* Ref & SI Number */}
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="space-y-1">
                          <p className="text-slate-500">
                            <span className="font-sans text-[10px] font-bold uppercase text-slate-400 mr-1">REF:</span> 
                            {payment.reference_number || 'N/A'}
                          </p>
                          {/* Only show the SI line if an SI actually exists */}
                          {payment.si_number && (
                            <p className="text-slate-900 font-bold">
                              <span className="font-sans text-[10px] font-bold uppercase text-slate-400 mr-1.5">SI:</span> 
                              <span className="bg-[#d2f34c]/30 px-1 py-0.5 rounded">{payment.si_number}</span>
                            </p>
                          )}
                        </div>
                      </td>
                      
                      {/* Status */}
                      <td className="px-6 py-4">
                        {payment.status === 'Pending' && <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">Pending</span>}
                        {payment.status === 'Verified' && <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">Verified</span>}
                        {payment.status === 'Voided' && <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-500 uppercase tracking-wide">Voided</span>}
                      </td>
                      
                      {/* Actions */}
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
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">No matching payments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex flex-col md:flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <span className="text-sm text-slate-500">
                Showing <span className="font-bold text-slate-700">{filteredPayments.length === 0 ? 0 : indexOfFirstItem + 1}</span> to <span className="font-bold text-slate-700">{Math.min(indexOfLastItem, filteredPayments.length)}</span> of <span className="font-bold text-slate-700">{filteredPayments.length}</span> entries
              </span>
              <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                <label className="text-sm text-slate-500">Rows per page:</label>
                <select 
                  className="rounded border border-slate-300 text-sm p-1"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(e.target.value)}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="All">All</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handlePageChange('prev')}
                disabled={currentPage === 1}
                className={`px-3 py-1 text-sm rounded border ${currentPage === 1 ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors'}`}
              >
                Previous
              </button>
              <span className="text-sm font-semibold text-slate-700 px-2">
                Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => handlePageChange('next')}
                disabled={currentPage === totalPages || totalPages === 0}
                className={`px-3 py-1 text-sm rounded border ${currentPage === totalPages || totalPages === 0 ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors'}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {receiptPreview.show && receiptPreview.data && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
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
                    
                    {/* NEW: Add the SI Ref right here */}
                    {receiptPreview.data.si_number && (
                      <p className="font-bold text-slate-600 mt-1">SI Ref: <span className="text-slate-900 ml-1">{receiptPreview.data.si_number}</span></p>
                    )}
                    
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

                {/* NEW RECEIPT BREAKDOWN */}
                <div className="mb-10 relative z-10">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b-2 border-slate-900 pb-2 mb-4">Billing Details</h4>
                  
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="py-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-wider w-[50%]">Item Description</th>
                        <th className="py-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-wider w-[30%]">Coverage Period</th>
                        <th className="py-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-wider w-[20%] text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-4 px-2 align-top">
                          <p className="font-bold text-lg text-slate-900">Virtual Office Package</p>
                          <p className="text-sm font-medium text-slate-600 mt-1">{receiptPreview.data.payment_type || 'Standard Billing'}</p>
                          <p className="text-xs font-semibold text-[#8ca81b] bg-[#d2f34c]/20 inline-block px-2 py-0.5 rounded mt-2 uppercase">{receiptPreview.data.package_tier}</p>
                        </td>
                        <td className="py-4 px-2 align-top text-sm font-medium text-slate-700">
                          {receiptPreview.data.coverage_start_date ? (
                            <>
                              {new Date(receiptPreview.data.coverage_start_date).toLocaleDateString()} <br/>
                              <span className="text-slate-400 text-xs">to</span> <br/>
                              {new Date(receiptPreview.data.coverage_end_date).toLocaleDateString()}
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Not specified</span>
                          )}
                        </td>
                        <td className="py-4 px-2 align-top text-right font-bold text-lg text-slate-900">
                          {formatCurrency(receiptPreview.data.amount_paid)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Move inclusions to a small "Terms" section */}
                <div className="mb-8 relative z-10 p-4 bg-slate-50 rounded border border-slate-100">
                   <p className="text-xs font-bold text-slate-500 uppercase mb-2">Package Inclusions & Notes</p>
                   <p className="text-xs text-slate-600 leading-relaxed">
                     {receiptPreview.data.package_tier === 'Use of Address' 
                       ? "Includes use of address for Business Registration and Mail Handling (if applicable by branch)." 
                       : "Includes 10 days use of coworking desk per month, business address registration, mail handling, high-speed internet, and access to lounge/pantry during operating hours."}
                   </p>
                </div>

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

      {viewModal.show && viewModal.payment && (() => {
        const payment = viewModal.payment;
        const client = clients.find(c => c.id === payment.virtual_office_id) || {};

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Transaction Overview</h3>
                  <p className="text-sm text-slate-500">{payment.company_name} ({client.branch || payment.branch || 'N/A'})</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${
                      payment.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      payment.status === 'Verified' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {payment.status === 'Pending' ? 'Pending Verification' : payment.status}
                  </span>
                  <button onClick={() => setViewModal({ show: false, payment: null })} className="text-slate-400 hover:text-red-500 font-bold text-2xl transition-colors">&times;</button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-8 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">

                  {/* LEFT COLUMN: The Payment */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide text-xs flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Payment Details
                      </h4>
                      
                      {/* Highlighted Amount */}
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-5 text-center">
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount Paid</p>
                         <p className={`text-4xl font-black ${payment.status === 'Voided' ? 'text-slate-400 line-through' : 'text-blue-700'}`}>
                           {formatCurrency(payment.amount_paid)}
                         </p>
                      </div>

                      <div className="grid grid-cols-2 gap-y-5 text-sm">
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500 mb-1">Payment For (Type)</p>
                          <p className="font-semibold text-slate-800 bg-slate-100 inline-block px-3 py-1 rounded-md">{payment.payment_type || 'Standard Billing'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500 mb-1">Coverage Period</p>
                          <p className="font-semibold text-slate-800">
                            {payment.coverage_start_date ? `${new Date(payment.coverage_start_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})} to ${new Date(payment.coverage_end_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}` : 'Not Specified'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Date Paid</p>
                          <p className="font-semibold text-slate-800">{new Date(payment.payment_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Mode</p>
                          <p className="font-semibold text-slate-800">{payment.mode_of_payment}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500 mb-1">Reference No.</p>
                          <p className="font-mono font-medium text-slate-700">{payment.reference_number || 'None provided'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Client & Audit */}
                  <div className="space-y-8">
                    <div>
                      <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide text-xs flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Contract Snapshot
                      </h4>
                      {client.id ? (
                        <div className="grid grid-cols-2 gap-y-4 text-sm bg-slate-50 p-5 rounded-xl border border-slate-100">
                          <div className="col-span-2">
                            <p className="text-xs text-slate-500">Package Tier</p>
                            <p className="font-semibold text-slate-800 truncate" title={client.package_tier}>{client.package_tier}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Agreed Rate</p>
                            <p className="font-semibold text-slate-800">{formatCurrency(client.rate_per_month)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Terms</p>
                            <p className="font-semibold text-slate-800 uppercase text-xs">{client.payment_terms}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-slate-500">Contract Duration</p>
                            <p className="font-semibold text-slate-800">{client.duration} <span className="font-normal text-slate-500 ml-1">({client.date_started ? new Date(client.date_started).toLocaleDateString() : ''} - {client.end_date ? new Date(client.end_date).toLocaleDateString() : ''})</span></p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-4 rounded-lg text-slate-500 text-xs italic text-center">
                          Client record unavailable. It may have been deleted.
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide text-xs flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Audit & Accounting
                      </h4>
                      <div className="grid grid-cols-2 gap-y-4 text-sm">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Encoded By (Maker)</p>
                          <p className="font-semibold text-slate-800">{payment.recorded_by_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Verified By (Checker)</p>
                          <p className="font-semibold text-slate-800">{payment.verified_by_name || '—'}</p>
                        </div>
                        <div className="col-span-2 border-t border-slate-100 pt-3"></div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">System Record ID</p>
                          <p className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded">REC-{payment.id.toString().padStart(5, '0')}</p>
                        </div>
                        
                        {/* Only show OR/SI if verified */}
                        {payment.status === 'Verified' && (
                          <>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Official Receipt (OR)</p>
                              <p className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 inline-block px-2 py-0.5 rounded">{payment.official_receipt_number || 'N/A'}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-xs text-slate-500 mb-1">Sales Invoice (SI)</p>
                              <p className="font-mono text-sm font-bold text-slate-800">{payment.si_number || 'Pending SI'}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
              
              {/* Quick Actions Footer for Managers */}
              {canVerify && payment.status === 'Pending' && (
                 <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                    <button 
                      onClick={() => { setViewModal({show: false, payment: null}); setConfirmAction({ show: true, type: 'DELETE', paymentId: payment.id }); }} 
                      className="px-5 py-2.5 rounded-lg text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                    >
                      Delete Draft
                    </button>
                    <button 
                      onClick={() => { setViewModal({show: false, payment: null}); setConfirmAction({ show: true, type: 'VERIFY', paymentId: payment.id }); }} 
                      className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Verify Payment
                    </button>
                 </div>
              )}
            </div>
          </div>
        );
      })()}

      {showRecordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Record Payment</h3>
                <p className="text-xs text-slate-500 mt-1">Auto-calculated based on client contract terms.</p>
              </div>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-2xl transition-colors">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
              <div className="flex flex-col lg:flex-row gap-8">
                
                {/* LEFT SIDE: Input Form */}
                <form onSubmit={handleSubmitPayment} className="flex-1 space-y-5 lg:pr-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-widest">Select Client *</label>
                    <select required className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-[#d2f34c] focus:border-[#b8d839] outline-none transition-all shadow-sm" value={formData.virtual_office_id} onChange={handleClientSelect}>
                      <option value="" disabled>-- Choose a Company --</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.company_name} ({client.branch})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5 mt-5">
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-widest flex justify-between">
                        Payment For (Type) * <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">Auto-filled</span>
                      </label>
                      <select required className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white text-sm font-semibold text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer" value={formData.payment_type} onChange={handlePaymentTypeChange}>
                        <option value="" disabled>-- Select Payment Type --</option>
                        <option value="Initial Prorated Payment">Initial Prorated Payment</option>
                        <option value="Regular Installment">Regular Installment {selectedClient ? `(${selectedClient.payment_terms})` : ''}</option>
                        <option value="Final Prorated Payment">Final Prorated Payment</option>
                        <option value="Full Contract (Upfront)">Full Contract (Upfront)</option>
                        <option value="Remaining Contract Balance">Remaining Contract Balance</option>
                        <option value="Security Deposit / Others">Security Deposit / Others</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-widest">Coverage Start</label>
                      <input type="date" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 font-medium focus:bg-white transition-colors outline-none" value={formData.coverage_start_date} onChange={(e) => setFormData({...formData, coverage_start_date: e.target.value})} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-widest">Coverage End</label>
                      <input type="date" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm bg-slate-50 font-medium focus:bg-white transition-colors outline-none" value={formData.coverage_end_date} onChange={(e) => setFormData({...formData, coverage_end_date: e.target.value})} />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between items-end mb-1.5">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest">
                        Amount Paid (₱) *
                      </label>
                      <div className="flex items-center gap-2">
                        {/* THE NEW SMART HELPER TEXT */}
                        {(formData.payment_type === 'Remaining Contract Balance' || formData.payment_type === 'Full Contract (Upfront)') && getMonthsLeft() && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            Covers remaining ~{getMonthsLeft()} months
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Auto-calculated</span>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                      <input required type="number" step="0.01" className="w-full rounded-xl border border-blue-300 bg-blue-50/50 pl-8 pr-4 py-3 font-black text-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all shadow-sm" value={formData.amount_paid} onChange={(e) => setFormData({...formData, amount_paid: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-5 mt-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-widest">Mode of Payment *</label>
                      <select required className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white text-sm font-semibold text-slate-700 shadow-sm focus:ring-2 focus:ring-[#d2f34c] outline-none cursor-pointer" value={formData.mode_of_payment} onChange={(e) => setFormData({...formData, mode_of_payment: e.target.value})}>
                        <option value="" disabled>-- Select Method --</option>
                        <option value="Cash">Cash</option>
                        <option value="GCash">GCash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Check">Check</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-widest">Date of Payment *</label>
                      <input required type="date" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-[#d2f34c] outline-none" value={formData.payment_date} onChange={(e) => setFormData({...formData, payment_date: e.target.value})} />
                    </div>
                  </div>

                  <div className="pb-4">
                    <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-widest">
                      {formData.mode_of_payment === 'Cash' ? 'Physical OR Number (Optional)' : 'Reference Number *'}
                    </label>
                    <input 
                      type="text" required={formData.mode_of_payment !== 'Cash'}
                      placeholder={formData.mode_of_payment === 'Cash' ? "e.g. OR-1234 or leave blank" : "e.g. 100234958"} 
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm text-slate-800 shadow-sm focus:ring-2 focus:ring-[#d2f34c] outline-none" 
                      value={formData.reference_number} onChange={(e) => setFormData({...formData, reference_number: e.target.value})} 
                    />
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                    {formData.isFullyPaid && (
                      <div className="mr-auto flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                        <span className="text-xs font-bold uppercase tracking-wider">Contract Fully Paid</span>
                      </div>
                    )}
                    
                    <button type="button" onClick={() => setShowRecordModal(false)} className="rounded-xl px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm">Cancel</button>
                    <button type="submit" disabled={isSubmitting || formData.isFullyPaid} className="rounded-xl bg-[#d2f34c] px-8 py-3 font-black text-slate-900 hover:bg-[#b8d839] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-[#d2f34c]/20 transition-all text-sm uppercase tracking-wide">
                      {isSubmitting ? 'Saving...' : 'Save Record'}
                    </button>
                  </div>
                </form>

                {/* RIGHT SIDE: Smart Billing Assistant */}
                <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 pt-8 lg:pt-0 lg:pl-8">
                  <div className="sticky top-0">
                    <h4 className="font-black text-slate-800 border-b border-slate-200 pb-3 mb-5 flex items-center gap-2 uppercase tracking-wide text-xs">
                      <span className="text-lg">📊</span> Billing Assistant
                    </h4>

                    {selectedClient ? (() => {
                      const rate = parseFloat(selectedClient.rate_per_month) || 0;
                      const startObj = new Date(selectedClient.date_started);
                      const endObj = new Date(selectedClient.end_date);
                      
                      const daysInStartMonth = new Date(startObj.getFullYear(), startObj.getMonth() + 1, 0).getDate();
                      const daysInEndMonth = new Date(endObj.getFullYear(), endObj.getMonth() + 1, 0).getDate();
                      
                      let firstMonthAmount = rate;
                      let finalMonthAmount = rate;
                      
                      if (startObj.getDate() !== 1) {
                        firstMonthAmount = (rate / daysInStartMonth) * (daysInStartMonth - startObj.getDate() + 1);
                        finalMonthAmount = (rate / daysInEndMonth) * endObj.getDate();
                      }

                      let stdAmount = rate;
                      if (selectedClient.payment_terms === 'Quarterly') stdAmount = rate * 3;
                      if (selectedClient.payment_terms === 'Semi-Annual') stdAmount = rate * 6;
                      if (selectedClient.payment_terms === 'Annually' || selectedClient.payment_terms === 'Annual') stdAmount = rate * 12;

                      return (
                        <div className="space-y-4 animate-fade-in">
                          {/* Contract Overview Box */}
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contract Data</p>
                            <p className="font-black text-slate-800 text-base truncate mb-3" title={selectedClient.company_name}>{selectedClient.company_name}</p>
                            <div className="space-y-2 text-xs font-medium">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">Tier:</span>
                                <span className="font-bold text-slate-700 truncate max-w-[140px]" title={selectedClient.package_tier}>{selectedClient.package_tier}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">Rate:</span>
                                <span className="font-bold text-slate-800">{formatCurrency(rate)} <span className="text-slate-400 font-normal">/mo</span></span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">Term:</span>
                                <span className="font-black text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">{selectedClient.payment_terms}</span>
                              </div>
                            </div>
                          </div>

                          {/* Mathematical Breakdown Box */}
                          <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-sm text-slate-300 relative overflow-hidden">
                            <div className="absolute -right-12 -top-12 w-32 h-32 bg-[#d2f34c] rounded-full blur-[60px] opacity-10 pointer-events-none"></div>
                            
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Proration Guide</p>
                            
                            <div className="space-y-3.5 border-b border-slate-700/50 pb-5 mb-5">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Initial Prorated</span>
                                <span className="font-semibold text-white">{formatCurrency(firstMonthAmount)}</span>
                              </div>
                              <div className="flex justify-between items-center bg-slate-800/80 p-3 rounded-xl border border-slate-700 shadow-inner">
                                <div>
                                  <span className="text-white font-bold block">Regular Installment</span>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{selectedClient.payment_terms}</span>
                                </div>
                                <span className="font-black text-lg text-[#d2f34c]">{formatCurrency(stdAmount)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Final Prorated</span>
                                <span className="font-semibold text-white">{formatCurrency(finalMonthAmount)}</span>
                              </div>
                            </div>

                            {(() => {
                               let fullMonthsBetweenUI = (endObj.getFullYear() - startObj.getFullYear()) * 12 + (endObj.getMonth() - startObj.getMonth()) - 1;
                               if (fullMonthsBetweenUI < 0) fullMonthsBetweenUI = 0;
                               if (startObj.getDate() === 1) fullMonthsBetweenUI += 1;
                               const tcv = firstMonthAmount + finalMonthAmount + (fullMonthsBetweenUI * rate);
                               
                               // LOOPHOLE FIXED: Ensure strict String matching and account for Pending processing!
                               const pastPayments = payments.filter(p => String(p.virtual_office_id) === String(selectedClient.id) && p.status === 'Verified');
                               const pendingPayments = payments.filter(p => String(p.virtual_office_id) === String(selectedClient.id) && p.status === 'Pending');
                               
                               const paidSoFar = pastPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
                               const pendingSoFar = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
                               const remBal = tcv - paidSoFar - pendingSoFar;

                               return (
                                 <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Account Ledger</p>
                                    <div className="flex justify-between text-xs mb-2">
                                      <span className="text-slate-400">Total Contract Value:</span>
                                      <span className="font-semibold text-white">{formatCurrency(tcv)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs mb-2">
                                      <span className="text-slate-400">Total Paid (Verified):</span>
                                      <span className="font-semibold text-emerald-400">{formatCurrency(paidSoFar)}</span>
                                    </div>
                                    
                                    {/* Prevent Double Billing */}
                                    {pendingSoFar > 0 && (
                                      <div className="flex justify-between text-xs mb-2">
                                        <span className="text-slate-400">Processing (Pending):</span>
                                        <span className="font-semibold text-amber-400">-{formatCurrency(pendingSoFar)}</span>
                                      </div>
                                    )}

                                    <div className="flex justify-between items-center pt-3 border-t border-slate-800 mt-2">
                                      <span className="text-slate-300 font-bold text-xs uppercase tracking-wider">Balance:</span>
                                      <span className="font-black text-base text-white">{formatCurrency(remBal > 0 ? remBal : 0)}</span>
                                    </div>
                                 </div>
                               );
                            })()}
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="h-64 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-slate-50/50">
                        <svg className="w-10 h-10 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-[200px]">Select a company on the left to load the billing calculator.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

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
            {confirmAction.type === 'VERIFY' && (
              <div className="mb-6 text-left">
                <label className="block text-sm font-bold text-slate-700 mb-2">Sales Invoice (SI) Number *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. SI-100255" 
                  className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  value={siNumberInput}
                  onChange={(e) => setSiNumberInput(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Found on the physical, BIR-registered invoice.</p>
              </div>
            )}
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