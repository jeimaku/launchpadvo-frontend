import { useState, useEffect, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell';

export default function LPOGVirtualOffice() {
  const [clients, setClients] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDuration, setFilterDuration] = useState('All');
  const [filterRate, setFilterRate] = useState('All');
  const [filterTerms, setFilterTerms] = useState('All');
  const [filterPackage, setFilterPackage] = useState('All'); 
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 

  const [editingId, setEditingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, actionType: '', clientId: null });

  const initialFormState = {
    company_name: '', contact_person_1: '', contact_person_2: '', email_1: '', email_2: '',
    date_started: '', duration: '', end_date: '', package_tier: '', custom_package_name: '', 
    rate_per_month: '', payment_info: '', payment_terms: '', contract_status: 'Active', remarks: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // NEW: Holds the auto-calculated breakdown for the UI preview
  const [paymentSchedule, setPaymentSchedule] = useState(null);

  const userRole = localStorage.getItem('userRole') || '';
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/virtual-offices?branch=LPOG`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching LPOG clients:', error);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const uniqueDurations = [...new Set(clients.map(c => c.duration))].filter(Boolean).sort();
  const uniqueRates = [...new Set(clients.map(c => Number(c.rate_per_month)))].filter(Boolean).sort((a,b) => a - b);
  const uniqueTerms = [...new Set(clients.map(c => c.payment_terms))].filter(Boolean).sort();
  const uniquePackages = [...new Set(clients.map(c => c.package_tier))].filter(Boolean).sort(); 

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (client.contact_person_1 && client.contact_person_1.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = filterStatus === 'All' || client.contract_status === filterStatus;
      const matchesDuration = filterDuration === 'All' || client.duration === filterDuration;
      const matchesRate = filterRate === 'All' || Number(client.rate_per_month) === Number(filterRate);
      const matchesTerms = filterTerms === 'All' || client.payment_terms === filterTerms;
      const matchesPackage = filterPackage === 'All' || client.package_tier === filterPackage; 

      return matchesSearch && matchesStatus && matchesDuration && matchesRate && matchesTerms && matchesPackage;
    });
  }, [clients, searchTerm, filterStatus, filterDuration, filterRate, filterTerms, filterPackage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterDuration, filterRate, filterTerms, filterPackage, itemsPerPage]);


  // ==========================================
  // SMART DATE & AUTO-CALCULATION ENGINE
  // ==========================================
  useEffect(() => {
    const { date_started, end_date, rate_per_month } = formData;

    // --- PART 1: CALCULATE DURATION (Only needs Dates) ---
    if (date_started && end_date) {
      const startObj = new Date(date_started);
      const endObj = new Date(end_date);

      if (endObj > startObj) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const totalDays = Math.round((endObj - startObj) / msPerDay) + 1;
        const calculatedMonths = Math.round(totalDays / 30.44); 
        const newDurationString = `${calculatedMonths} mos`;
        
        if (formData.duration !== newDurationString) {
            setFormData(prev => ({ ...prev, duration: newDurationString }));
        }
      }
    }

    // --- PART 2: CALCULATE FINANCIALS (Needs Dates, Rate, and Terms) ---
    const rate = parseFloat(rate_per_month);
    const terms = formData.payment_terms; 
    
    if (date_started && end_date && !isNaN(rate) && rate > 0) {
      const startObj = new Date(date_started);
      const endObj = new Date(end_date);

      if (endObj <= startObj) {
          setPaymentSchedule(null);
          return;
      }

      const startYear = startObj.getFullYear();
      const startMonth = startObj.getMonth();
      const startDay = startObj.getDate();
      const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate();

      const endYear = endObj.getFullYear();
      const endMonth = endObj.getMonth();
      const endDay = endObj.getDate();
      const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate();

      let firstMonthAmount = rate;
      let finalMonthAmount = rate;
      let isProrated = false;

      let fullMonthsBetween = (endYear - startYear) * 12 + (endMonth - startMonth) - 1;
      if (fullMonthsBetween < 0) fullMonthsBetween = 0;

      if (startDay !== 1 || endDay !== daysInEndMonth) {
        isProrated = true;
        
        const activeDaysFirstMonth = daysInStartMonth - startDay + 1;
        firstMonthAmount = (rate / daysInStartMonth) * activeDaysFirstMonth;

        finalMonthAmount = (rate / daysInEndMonth) * endDay;
        
        if (startYear === endYear && startMonth === endMonth) {
            const activeDays = endDay - startDay + 1;
            firstMonthAmount = (rate / daysInStartMonth) * activeDays;
            finalMonthAmount = 0;
            fullMonthsBetween = 0;
        }
      }

      const totalValue = firstMonthAmount + finalMonthAmount + (fullMonthsBetween * rate);

      // Calculate the recurring installment amount based on terms
      let installmentAmount = rate;
      let installmentLabel = "Monthly";

      if (terms === 'Quarterly') {
          installmentAmount = rate * 3;
          installmentLabel = "Quarterly";
      } else if (terms === 'Semi-Annual') {
          installmentAmount = rate * 6;
          installmentLabel = "Semi-Annual";
      } else if (terms === 'Annual') {
          installmentAmount = rate * 12;
          installmentLabel = "Annual";
      } else if (terms === 'Full Payment') {
          installmentAmount = totalValue; 
          installmentLabel = "Upfront";
      }

      setPaymentSchedule({
        isProrated,
        firstMonthAmount,
        recurringAmount: rate,
        finalMonthAmount,
        totalContractValue: totalValue,
        monthsCount: fullMonthsBetween,
        installmentAmount,
        installmentLabel,
        terms 
      });

    } else {
      setPaymentSchedule(null);
    }
  }, [formData.date_started, formData.end_date, formData.rate_per_month, formData.payment_terms]);

  const actualItemsPerPage = itemsPerPage === 'All' ? filteredClients.length : Number(itemsPerPage);
  const totalPages = Math.ceil(filteredClients.length / (actualItemsPerPage || 1));
  const indexOfLastItem = currentPage * actualItemsPerPage;
  const indexOfFirstItem = indexOfLastItem - actualItemsPerPage;
  const currentItems = filteredClients.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (direction) => {
    if (direction === 'prev' && currentPage > 1) setCurrentPage(currentPage - 1);
    if (direction === 'next' && currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setErrorMessage('');
    setShowFormModal(true);
  };

  const handleEditClick = (client) => {
    setEditingId(client.id);
    let isCustom = client.package_tier.startsWith('Custom:');
    let baseTier = isCustom ? 'Custom' : client.package_tier;
    let customName = isCustom ? client.package_tier.replace('Custom: ', '') : '';

    setFormData({
      ...client,
      date_started: client.date_started ? client.date_started.split('T')[0] : '',
      end_date: client.end_date ? client.end_date.split('T')[0] : '',
      package_tier: baseTier,
      custom_package_name: customName
    });
    setErrorMessage('');
    setShowFormModal(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setConfirmModal({ show: true, actionType: editingId ? 'EDIT' : 'ADD', clientId: editingId });
  };

  const executeAction = async () => {
    const { actionType, clientId } = confirmModal;
    setConfirmModal({ show: false, actionType: '', clientId: null });

    if (actionType === 'DELETE') {
      try {
        const token = localStorage.getItem('token');
        // FIXED: Removed hardcoded IP
        await fetch(`http://${window.location.hostname}:5000/api/virtual-offices/${clientId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchClients();
      } catch (error) { console.error('Error deleting:', error); }
      return;
    }

    const finalPackageTier = formData.package_tier === 'Custom' 
      ? `Custom: ${formData.custom_package_name}` 
      : formData.package_tier;

    const payload = { ...formData, package_tier: finalPackageTier, branch: 'LPOG' };
    
    // FIXED: Removed hardcoded IP
    const url = actionType === 'EDIT' 
      ? `http://${window.location.hostname}:5000/api/virtual-offices/${clientId}` 
      : `http://${window.location.hostname}:5000/api/virtual-offices`;
      
    const method = actionType === 'EDIT' ? 'PUT' : 'POST';

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Action failed.');
      }

      await fetchClients();
      setShowFormModal(false);
      setFormData(initialFormState);
    } catch (error) {
      setErrorMessage(error.message);
      setShowFormModal(true);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />

      <div className="flex-1 p-8 overflow-hidden flex flex-col h-screen">
        <header className="mb-6 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">LPOG Virtual Office</h2>
            <p className="text-slate-500 mt-1">Manage all clients stationed at the One Griffinstone branch.</p>
          </div>
          <div className="flex items-center gap-4">
            {canViewNotifications && <NotificationBell />}
            <button 
              onClick={handleAddNew}
              className="rounded-lg bg-[#d2f34c] px-6 py-2.5 font-bold text-slate-900 transition-colors hover:bg-[#b8d839] shadow-sm"
            >
              + Add New Client
            </button>
          </div>
        </header>

        <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-slate-100 space-y-4 shrink-0">
          <div className="w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Search</label>
            <input 
              type="text" 
              placeholder="🔍 Search by Company Name or Contact Person..." 
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-[#b8d839] focus:ring-1 focus:ring-[#b8d839]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Status</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending Renewal">Pending Renewal</option>
                <option value="Expired">Expired</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Package Tier</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)}>
                <option value="All">All Packages</option>
                {uniquePackages.map(pkg => (
                  <option key={pkg} value={pkg}>{pkg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Duration</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterDuration} onChange={(e) => setFilterDuration(e.target.value)}>
                <option value="All">All Durations</option>
                {uniqueDurations.map(dur => <option key={dur} value={dur}>{dur}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Agreed Rate</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterRate} onChange={(e) => setFilterRate(e.target.value)}>
                <option value="All">All Rates</option>
                {uniqueRates.map(rate => <option key={rate} value={rate}>{formatCurrency(rate)}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Payment Terms</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 focus:bg-white" value={filterTerms} onChange={(e) => setFilterTerms(e.target.value)}>
                <option value="All">All Terms</option>
                {uniqueTerms.map(term => <option key={term} value={term}>{term}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col flex-1 overflow-hidden">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Company & Contacts</th>
                  <th className="px-6 py-4 font-semibold">Package & Emails</th>
                  <th className="px-6 py-4 font-semibold">Duration & Dates</th>
                  <th className="px-6 py-4 font-semibold">Rate & Terms</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.length > 0 ? (
                  currentItems.map(client => (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{client.company_name}</p>
                        {client.contact_person_1 && <p className="text-xs text-slate-500">1: {client.contact_person_1}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-1 mb-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded">{client.package_tier}</span>
                        <p className="text-xs text-slate-500">{client.email_1 || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-700">{client.duration}</p>
                        <p className="text-xs text-slate-500">{formatDate(client.date_started)} to {formatDate(client.end_date)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800">{formatCurrency(client.rate_per_month)} /mo</p>
                        <p className="text-xs font-bold text-[#b8d839] uppercase tracking-wide mt-0.5">{client.payment_terms}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          client.contract_status === 'Active' ? 'bg-[#d2f34c]/20 text-slate-800' : 
                          client.contract_status === 'Pending Renewal' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {client.contract_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEditClick(client)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Edit"
                        >✏️</button>
                        <button 
                          onClick={() => setConfirmModal({ show: true, actionType: 'DELETE', clientId: client.id })}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete"
                        >🗑️</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      No records match your search or filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex flex-col md:flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <span className="text-sm text-slate-500">
                Showing <span className="font-bold text-slate-700">{filteredClients.length === 0 ? 0 : indexOfFirstItem + 1}</span> to <span className="font-bold text-slate-700">{Math.min(indexOfLastItem, filteredClients.length)}</span> of <span className="font-bold text-slate-700">{filteredClients.length}</span> entries
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

      {showFormModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-7xl rounded-2xl bg-white p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Client Record' : 'Register LPOG Client'}</h3>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>

            {errorMessage && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200">
                <p className="text-sm font-bold text-red-600">⚠️ {errorMessage}</p>
              </div>
            )}

<form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-8">
               
               {/* COLUMN 1: Client Details */}
               <div className="space-y-4">
                <h4 className="font-bold text-slate-800 border-b pb-2">Client Details</h4>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Company Name *</label>
                  <input required type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Contact Person 1</label>
                  <input type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.contact_person_1} onChange={(e) => setFormData({...formData, contact_person_1: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Contact Person 2 <span className="text-slate-400 font-normal ml-1">(Optional)</span>
                  </label>
                  <input type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.contact_person_2} onChange={(e) => setFormData({...formData, contact_person_2: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address 1</label>
                  <input type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.email_1} onChange={(e) => setFormData({...formData, email_1: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Email Address 2 <span className="text-slate-400 font-normal ml-1">(Optional)</span>
                  </label>
                  <input type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.email_2} onChange={(e) => setFormData({...formData, email_2: e.target.value})} />
                </div>
              </div>

              {/* COLUMN 2: Contract Info */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 border-b pb-2">Contract Info</h4>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Date Started *</label>
                  <input required type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.date_started} onChange={(e) => setFormData({...formData, date_started: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">End Date *</label>
                  <input required type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 flex justify-between">
                    Calculated Duration <span className="text-blue-500 font-normal">Auto-filled</span>
                  </label>
                  <input type="text" readOnly placeholder="Select dates above..." className="w-full rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-sm text-slate-600 cursor-not-allowed" value={formData.duration} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Remarks / Notes</label>
                  <textarea rows="4" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})}></textarea>
                </div>
              </div>

              {/* COLUMN 3: Billing & Status */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 border-b pb-2">Billing & Status</h4>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Package Tier *</label>
                  <select 
                    required 
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    value={formData.package_tier} 
                    onChange={(e) => {
                      const selected = e.target.value;
                      let autoRate = ''; 
                      // LPOG DEFAULT RATE IS 4500
                      if (selected === 'Virtual Office Package') autoRate = 4500; 
                      setFormData({
                          ...formData, package_tier: selected, rate_per_month: autoRate,
                          custom_package_name: selected === 'Custom' ? formData.custom_package_name : '' 
                      });
                    }}
                  >
                    <option value="" disabled>-- Select Package --</option>
                    <option value="Virtual Office Package">Virtual Office Package (₱4,500/mo)</option>
                    <option value="Use of Address">Use of Address (Staff to encode)</option>
                    <option value="Custom">Custom Package (Staff to encode)</option>
                  </select>
                </div>

                {formData.package_tier === 'Custom' && (
                  <div className="animate-fade-in">
                    <label className="mb-1 block text-xs font-semibold text-blue-700">Specify Custom Package *</label>
                    <input 
                      required type="text" placeholder="e.g. Virtual Office + 5 Days Desk"
                      className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm"
                      value={formData.custom_package_name} onChange={(e) => setFormData({...formData, custom_package_name: e.target.value})} 
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Agreed Rate (₱) *</label>
                  <input required type="number" step="0.01" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" value={formData.rate_per_month} onChange={(e) => setFormData({...formData, rate_per_month: e.target.value})} />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Current Status *</label>
                  <select required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" value={formData.contract_status} onChange={(e) => setFormData({...formData, contract_status: e.target.value})}>
                    <option value="Active">Active</option>
                    <option value="Pending Renewal">Pending Renewal</option>
                    <option value="Expired">Expired</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Terms *</label>
                  <select required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" value={formData.payment_terms} onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}>
                    <option value="" disabled>-- Select Term --</option>
                    <option value="Full Payment">Full Payment</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annual">Semi-Annual</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </div>

              {/* COLUMN 4: Formal Financial Summary */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 border-b pb-2">Financial Summary</h4>
                
                {paymentSchedule ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm animate-fade-in flex flex-col h-[calc(100%-2rem)]">
                    <h5 className="text-sm font-bold text-slate-800 mb-1">Contract Valuation</h5>
                    <p className="text-[11px] text-slate-500 mb-5 leading-relaxed">
                      Calculated based on the selected dates and monthly rate. Prorated amounts apply when starting or ending mid-month.
                    </p>

                    <div className="space-y-3 text-sm flex-1">
                      {paymentSchedule.isProrated ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">First Month (Prorated):</span>
                            <span className="font-semibold text-slate-800">{formatCurrency(paymentSchedule.firstMonthAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Standard Months ({paymentSchedule.monthsCount}x):</span>
                            <span className="font-semibold text-slate-800">{formatCurrency(paymentSchedule.recurringAmount)}/mo</span>
                          </div>
                          <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                            <span className="text-slate-600">Final Month (Prorated):</span>
                            <span className="font-semibold text-slate-800">{formatCurrency(paymentSchedule.finalMonthAmount)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                          <span className="text-slate-600">Standard Billing ({paymentSchedule.monthsCount}x):</span>
                          <span className="font-semibold text-slate-800">{formatCurrency(paymentSchedule.recurringAmount)}/mo</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center pt-2 mb-4">
                        <span className="font-bold text-slate-800">Total Contract Value:</span>
                        <span className="text-xl font-black text-blue-700">{formatCurrency(paymentSchedule.totalContractValue)}</span>
                      </div>

                      {/* Dynamic Billing Schedule Indicator */}
                      {paymentSchedule.terms && (
                        <div className="mt-auto bg-slate-800 text-white p-3 rounded-lg border border-slate-700 shadow-inner">
                           <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Billing Schedule</p>
                           {paymentSchedule.terms === 'Full Payment' ? (
                             <p className="text-sm font-medium">
                               <span className="font-bold text-[#d2f34c]">100% Upfront</span>. No recurring invoices.
                             </p>
                           ) : (
                             <div className="flex justify-between items-center">
                               <span className="text-sm font-medium">{paymentSchedule.installmentLabel} Installments:</span>
                               <span className="text-lg font-bold text-[#d2f34c]">{formatCurrency(paymentSchedule.installmentAmount)}</span>
                             </div>
                           )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 h-[calc(100%-2rem)] flex flex-col items-center justify-center text-center">
                    <svg className="w-8 h-8 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    <p className="text-xs text-slate-500 font-medium">Enter Start Date, End Date, and Rate to view the financial breakdown.</p>
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS: Spanning all 4 columns */}
              <div className="col-span-1 md:col-span-4 mt-2 flex justify-end gap-3 border-t pt-5">
                <button type="button" onClick={() => setShowFormModal(false)} className="rounded-lg px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                <button type="submit" className="rounded-lg bg-[#d2f34c] px-8 py-2.5 font-bold text-slate-900 hover:bg-[#b8d839] transition-colors shadow-sm">
                  {editingId ? 'Update Client' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Are you sure?</h3>
            <p className="text-slate-500 mb-6 text-sm">
              {confirmModal.actionType === 'DELETE' ? "This will permanently delete this client's record. You cannot undo this." : 
               confirmModal.actionType === 'EDIT' ? "You are about to modify an existing client's official record." : 
               "Please confirm that all details are correct before adding this new client."}
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmModal({ show: false, actionType: '', clientId: null })} className="rounded-lg px-6 py-2 font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
              <button 
                onClick={executeAction} 
                className={`rounded-lg px-6 py-2 font-bold text-white shadow-sm transition-colors ${confirmModal.actionType === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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