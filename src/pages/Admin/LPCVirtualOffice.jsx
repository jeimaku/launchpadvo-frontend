import { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import NotificationBell from '../../components/NotificationBell'; 

// --- NEW: EXCEL-LIKE DRAGGABLE COLUMN HEADER ---
const ResizableHeader = ({ title, defaultWidth }) => {
  const [width, setWidth] = useState(defaultWidth);

  const startResize = (e) => {
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent) => {
      // Apply a minimum width of 80px so columns don't disappear
      const newWidth = Math.max(80, startWidth + (moveEvent.clientX - startX));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <th 
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }} 
      className="px-4 py-3 font-bold relative group bg-slate-100 overflow-hidden border-r border-slate-200 last:border-r-0"
    >
      <span className="truncate block select-none pr-2">{title}</span>
      {/* The invisible drag handle on the right edge */}
      <div
        onMouseDown={startResize}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 z-20 transition-colors"
        title="Drag to resize"
      />
    </th>
  );
};


export default function LPCVirtualOffice() {
  const [clients, setClients] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [customAttachment, setCustomAttachment] = useState(null);
  
// --- TIER 1: ORIGINAL FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDuration, setFilterDuration] = useState('All');
  const [filterRate, setFilterRate] = useState('All');
  const [filterTerms, setFilterTerms] = useState('All');
  const [filterPackage, setFilterPackage] = useState('All');

  // --- TIER 2: ADVANCED OPERATIONAL FILTERS ---
  const [filterExpiration, setFilterExpiration] = useState('All');
  const [filterTenure, setFilterTenure] = useState('All'); 
  const [filterAutoEmail, setFilterAutoEmail] = useState('All'); 
  // NOTE: filterKYC has been completely removed

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 
  
  const [editingId, setEditingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, actionType: '', clientId: null });

  // --- ADD THESE TWO LINES ---
  const [docRequestModal, setDocRequestModal] = useState({ show: false, client: null });
  const [actionAlert, setActionAlert] = useState({ show: false, message: '', isError: false });

  // --- ADD THIS MISSING LINE! ---
  const [isSendingDoc, setIsSendingDoc] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  
  // FIXED: Added missing import states to prevent ReferenceErrors!
  const [importSummary, setImportSummary] = useState({ total: 0, valid: 0, invalid: 0 });
  const [importStep, setImportStep] = useState(1);

  const initialFormState = {
    company_name: '', contact_person_1: '', contact_person_2: '', email_1: '', email_2: '',
    date_started: '', duration: '', end_date: '', package_tier: '', custom_package_name: '', 
    rate_per_month: '', payment_info: '', payment_terms: '', contract_status: 'Active', remarks: '',
    auto_email_enabled: true, // NEW: Defaults to ON
    documents_submitted: false // NEW: Defaults to OFF
  };

  const [formData, setFormData] = useState(initialFormState);

  // Holds the auto-calculated breakdown for the UI preview
  const [paymentSchedule, setPaymentSchedule] = useState(null);

  const userRole = localStorage.getItem('userRole') || '';
  const canViewNotifications = ['admin', 'manager', 'staff'].includes(userRole.toLowerCase());

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/virtual-offices?branch=LPC`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching LPC clients:', error);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const uniqueDurations = [...new Set(clients.map(c => c.duration))].filter(Boolean).sort();
  const uniqueRates = [...new Set(clients.map(c => Number(c.rate_per_month)))].filter(Boolean).sort((a,b) => a - b);
  const uniqueTerms = [...new Set(clients.map(c => c.payment_terms))].filter(Boolean).sort();
  const uniquePackages = [...new Set(clients.map(c => c.package_tier))].filter(Boolean).sort();

  // --- COMBINED FILTER LOGIC ---
  const filteredClients = clients.filter(client => {
    
    // 1. Original Matches
    const matchesSearch = 
      (client.company_name && client.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.email_1 && client.email_1.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'All' || client.contract_status === filterStatus;
    const matchesDuration = filterDuration === 'All' || client.duration === filterDuration;
    const matchesRate = filterRate === 'All' || String(client.rate_per_month) === String(filterRate);
    const matchesTerms = filterTerms === 'All' || client.payment_terms === filterTerms;
    const matchesPackage = filterPackage === 'All' || client.package_tier === filterPackage;

    // 2. Expiration Match (Time Left)
    let matchesExpiration = true;
    if (filterExpiration !== 'All' && client.end_date) {
      const today = new Date();
      const expiryDate = new Date(client.end_date);
      today.setHours(0,0,0,0);
      expiryDate.setHours(0,0,0,0);
      const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

      // Note: The logic matches the values, but the display text in the dropdown will be longer
      if (filterExpiration === 'Expiring Soon') matchesExpiration = daysUntilExpiry >= 0 && daysUntilExpiry <= 60;
      if (filterExpiration === 'Expired') matchesExpiration = daysUntilExpiry < 0;
    } else if (filterExpiration !== 'All' && !client.end_date) {
      matchesExpiration = false; 
    }

    // 3. Tenure Match (Client Age)
    let matchesTenure = true;
    if (filterTenure !== 'All' && client.date_started) {
      const start = new Date(client.date_started);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      
      if (filterTenure === 'New') matchesTenure = monthsDiff <= 3;
      if (filterTenure === 'Established') matchesTenure = monthsDiff > 3 && monthsDiff <= 12;
      if (filterTenure === 'Long-Term') matchesTenure = monthsDiff > 12;
    } else if (filterTenure !== 'All' && !client.date_started) {
      matchesTenure = false;
    }

    // 4. Auto-Email Match
    let matchesAutoEmail = true;
    if (filterAutoEmail === 'Enabled') matchesAutoEmail = client.auto_email_enabled === 1 || client.auto_email_enabled === true;
    if (filterAutoEmail === 'Disabled') matchesAutoEmail = !client.auto_email_enabled;

    // NOTE: matchesKYC removed from the return statement
    return matchesSearch && matchesStatus && matchesDuration && matchesRate && matchesTerms && matchesPackage && matchesExpiration && matchesTenure && matchesAutoEmail;
  });

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

      // Only calculate if End Date is after Start Date
      if (endObj > startObj) {
        const msPerDay = 1000 * 60 * 60 * 24;
        const totalDays = Math.round((endObj - startObj) / msPerDay) + 1;
        const calculatedMonths = Math.round(totalDays / 30.44); 
        const newDurationString = `${calculatedMonths} mos`;
        
        // Auto-fill the duration field safely
        if (formData.duration !== newDurationString) {
            setFormData(prev => ({ ...prev, duration: newDurationString }));
        }
      }
    }

    // --- PART 2: CALCULATE FINANCIALS (Needs Dates AND a valid Rate) ---
    const rate = parseFloat(rate_per_month);
    const terms = formData.payment_terms; // Get the selected terms
    
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
        
        // STEP 1: Calculate the exact daily rate and force it to 2 decimal places (e.g., 3500 / 30 = 116.67)
        const dailyRateFirstMonth = Number((rate / daysInStartMonth).toFixed(2));
        const dailyRateFinalMonth = Number((rate / daysInEndMonth).toFixed(2));
        
        // STEP 2: Multiply the rounded daily rate by the active days
        const activeDaysFirstMonth = daysInStartMonth - startDay + 1;
        firstMonthAmount = dailyRateFirstMonth * activeDaysFirstMonth;

        finalMonthAmount = dailyRateFinalMonth * endDay;
        
        // Edge Case: If the contract starts and ends within the exact same month
        if (startYear === endYear && startMonth === endMonth) {
            const activeDays = endDay - startDay + 1;
            firstMonthAmount = dailyRateFirstMonth * activeDays;
            finalMonthAmount = 0;
            fullMonthsBetween = 0;
        }
      }

      // STEP 3: Prevent JavaScript floating-point glitches (e.g., stopping 1983.39 turning into 1983.3900000000001)
      firstMonthAmount = Number(firstMonthAmount.toFixed(2));
      finalMonthAmount = Number(finalMonthAmount.toFixed(2));
      
      const totalValue = Number((firstMonthAmount + finalMonthAmount + (fullMonthsBetween * rate)).toFixed(2));

// NEW: Calculate the recurring installment amount and exact invoice breakdowns
      
      // Calculate total months for invoice division
      const msPerDay = 1000 * 60 * 60 * 24;
      const totalDays = Math.round((endObj - startObj) / msPerDay) + 1;
      const calculatedMonths = Math.max(1, Math.round(totalDays / 30.44));

      let installmentAmount = rate;
      let installmentLabel = "Monthly";
      let termMultiplier = 1; 

      if (terms === 'Quarterly') {
          termMultiplier = 3;
          installmentAmount = rate * termMultiplier;
          installmentLabel = "Quarterly";
      } else if (terms === 'Semi-Annual') {
          termMultiplier = 6;
          installmentAmount = rate * termMultiplier;
          installmentLabel = "Semi-Annual";
      } else if (terms === 'Annually') {
          termMultiplier = fullMonthsBetween; 
          installmentAmount = totalValue; 
          installmentLabel = "Total Upfront Payment";
      }

      // --- SMART INVOICE COUNTER ---
      let totalInvoices = 1;
      if (terms === 'Monthly') totalInvoices = calculatedMonths;
      else if (terms === 'Quarterly') totalInvoices = Math.max(1, Math.round(calculatedMonths / 3));
      else if (terms === 'Semi-Annual') totalInvoices = Math.max(1, Math.round(calculatedMonths / 6));

      // If prorated, the First and Final invoices take up 2 slots. The remainder are Standard.
      let standardInvoiceCount = isProrated ? Math.max(0, totalInvoices - 2) : totalInvoices;

      // Calculate exact invoices by adding the standard months to the prorated fraction
      let firstInvoiceAmount = firstMonthAmount + (rate * (termMultiplier - 1));
      let finalInvoiceAmount = finalMonthAmount + (rate * (termMultiplier - 1));
      
      if (firstInvoiceAmount > totalValue) firstInvoiceAmount = totalValue;
      if (finalInvoiceAmount > totalValue) finalInvoiceAmount = totalValue;

      setPaymentSchedule({
        isProrated,
        firstMonthAmount,
        recurringAmount: rate,
        finalMonthAmount,
        totalContractValue: totalValue,
        monthsCount: fullMonthsBetween,
        installmentAmount,
        installmentLabel,
        termMultiplier,
        firstInvoiceAmount,
        finalInvoiceAmount,
        totalInvoices,
        standardInvoiceCount,
        terms 
      });

    } else {
      setPaymentSchedule(null);
    }
  }, [formData.date_started, formData.end_date, formData.rate_per_month, formData.payment_terms]);

  

  const actualItemsPerPage = itemsPerPage === 'All' ? filteredClients.length : Number(itemsPerPage);
  // --- PAGINATION MATH FIX ---
  // Safely convert "All" into the actual total number of clients before doing math
  const safeItemsPerPage = itemsPerPage === 'All' ? (filteredClients.length || 1) : Number(itemsPerPage);
  
  const indexOfLastItem = currentPage * safeItemsPerPage;
  const indexOfFirstItem = indexOfLastItem - safeItemsPerPage;
  const currentItems = filteredClients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredClients.length / safeItemsPerPage);

  // ==========================================
  // PHASE 1: EXPORT & TEMPLATE ENGINE
  // ==========================================
  const exportToCSV = (data, filename) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
            // Escape double quotes and wrap in quotes to handle commas inside text
            return `"${val.replace(/"/g, '""')}"`; 
        });
        csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // ==========================================
  // PHASE 2: SMART IMPORT LOGIC ENGINE
  // ==========================================
  const [importStaging, setImportStaging] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef(null);

  // 1. The Bulletproof CSV Parser (Handles commas inside text)
  const parseCSV = (str) => {
    const result = [];
    let row = [];
    let inQuotes = false;
    let val = '';
    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (char === '"' && str[i+1] === '"') {
            val += '"'; i++; 
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(val.trim()); val = '';
        } else if (char === '\n' && !inQuotes) {
            row.push(val.trim()); result.push(row); row = []; val = '';
        } else if (char !== '\r') {
            val += char;
        }
    }
    row.push(val.trim());
    if (row.length > 0 || val !== '') result.push(row);
    return result;
  };

// --- PHASE 1: Process CSV and Staging Data ---
  const processImportData = (rawRows) => {
    setImportStep(3); // Go to staging/review

    if (!rawRows || rawRows.length < 2) return; // Ensure there's data to process

    // 1. Helper to find column index from keywords
    const headers = rawRows[0].map(h => h ? String(h).toLowerCase().replace(/[^a-z0-9]/g, '') : '');
    const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    // 2. Helper to safely parse dates from CSV
    const parseCsvDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    };

    // --- NEW: 3. Smart Payment Terms Parser ---
    // Scans the messy Excel text for keywords and forces it into our strict system options
    const parsePaymentTerms = (rawTerm) => {
        if (!rawTerm) return '';
        const t = String(rawTerm).toLowerCase();
        
        if (t.includes('month')) return 'Monthly';
        if (t.includes('quarter')) return 'Quarterly';
        if (t.includes('semi')) return 'Semi-Annual';
        // If it says "Full", "Fully Paid", or "Annual", it defaults to Annually
        if (t.includes('full') || t.includes('annual') || t.includes('year')) return 'Annually';
        
        return rawTerm.trim(); // Fallback if it completely doesn't recognize the word
    };

    // Dictionary: Maps keywords to their column index
    const colMap = {
        company: findCol(['company', 'business']),
        contact1: findCol(['contactperson1', 'person1', 'contact1', 'primarycontact']),
        contact2: findCol(['contactperson2', 'person2', 'contact2', 'secondarycontact']),
        email1: findCol(['email1', 'primaryemail', 'emailaddress1', 'email']), 
        email2: findCol(['email2', 'secondaryemail', 'emailaddress2']),
        start: findCol(['start']),
        end: findCol(['end', 'expiry']),
        pkg: findCol(['package', 'tier', 'service']),
        rate: findCol(['rate', 'agreed', 'price']),
        terms: findCol(['term', 'payment']), 
        status: findCol(['status', 'state']), 
        remarks: findCol(['remark', 'note'])
    };

    let idCounter = 1;
    let validCount = 0;
    let invalidCount = 0;

    // Skip the header row (index 0) and process the actual data
    const rowData = rawRows.slice(1).map(row => {
        // Skip completely empty rows
        if (!row.some(cell => cell && String(cell).trim() !== '')) return null;

        const rawPackage = row[colMap.pkg] ? String(row[colMap.pkg]).trim() : '';
        const isCustomInCsv = rawPackage.toLowerCase().startsWith('custom:');
        
        const startDate = row[colMap.start] ? parseCsvDate(row[colMap.start]) : '';
        const endDate = row[colMap.end] ? parseCsvDate(row[colMap.end]) : '';

        // Auto-calculate Duration
        let calculatedDuration = '';
        if (startDate && endDate) {
            const sDate = new Date(startDate);
            const eDate = new Date(endDate);
            const msPerDay = 1000 * 60 * 60 * 24;
            const totalDays = Math.round((eDate - sDate) / msPerDay) + 1;
            const months = Math.max(1, Math.round(totalDays / 30.44));
            calculatedDuration = `${months} mos`;
        }
        
        const stagingRow = {
          id: idCounter++,
          company_name: row[colMap.company] ? String(row[colMap.company]).trim() : '',
          contact_person_1: row[colMap.contact1] ? String(row[colMap.contact1]).trim() : '',
          contact_person_2: row[colMap.contact2] ? String(row[colMap.contact2]).trim() : '',
          email_1: row[colMap.email1] ? String(row[colMap.email1]).trim() : '',
          email_2: row[colMap.email2] ? String(row[colMap.email2]).trim() : '',
          date_started: startDate,
          end_date: endDate,
          duration: calculatedDuration, 
          package_tier: isCustomInCsv ? 'Custom' : rawPackage,
          custom_package_name: isCustomInCsv ? rawPackage.substring(7).trim() : '', 
          rate_per_month: row[colMap.rate] ? parseFloat(String(row[colMap.rate]).replace(/[^0-9.]/g, '')) || '' : '',
          
          // --- UPDATED: Pass the raw CSV cell through the Smart Parser ---
          payment_terms: row[colMap.terms] ? parsePaymentTerms(row[colMap.terms]) : '',
          
          contract_status: row[colMap.status] ? String(row[colMap.status]).trim() : 'Active',
          remarks: row[colMap.remarks] ? String(row[colMap.remarks]).trim() : ''
        };

        // Inline validation
        stagingRow.hasErrors = !stagingRow.company_name || !stagingRow.date_started || !stagingRow.end_date || !stagingRow.rate_per_month;
        
        if (!stagingRow.hasErrors) validCount++; else invalidCount++;
        return stagingRow;
    }).filter(row => row !== null); // Remove the skipped empty rows

    // Save directly to state
    setImportStaging(rowData);
    setImportSummary({ total: rowData.length, valid: validCount, invalid: invalidCount });
  };

const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target.result;
        const parsedRows = parseCSV(text);
        
        // FIXED: We just trigger the engine. It handles all the data saving internally!
        processImportData(parsedRows);
        
        setShowImportModal(true); // Triggers Phase 3
        e.target.value = null; // Reset input so you can upload the same file again if needed
    };
    reader.readAsText(file);
  };

  // --- NEW: INLINE STAGING EDITOR ---
  const handleStagingEdit = (rowId, field, newValue) => {
    setImportStaging(prevStaging => 
      prevStaging.map(row => {
        if (row.id === rowId) {
          const updatedRow = { ...row, [field]: newValue };
          // Re-calculate errors instantly so rows can turn from red to green!
          updatedRow.hasErrors = !updatedRow.company_name || !updatedRow.date_started || !updatedRow.end_date || !updatedRow.rate_per_month;
          return updatedRow;
        }
        return row;
      })
    );
  };

  // 3. Execution Function (Sends valid rows to backend)
  const executeBulkImport = async () => {
    const validClients = importStaging.filter(c => !c.hasErrors);
    if (validClients.length === 0) return;

    // --- NEW: Sanitize Payload ---
    // Remove UI-only states (like id, errors, hasErrors) that cause strict backends to throw 400 Bad Request
    const cleanPayload = validClients.map(client => ({
      company_name: client.company_name,
      contact_person_1: client.contact_person_1,
      contact_person_2: client.contact_person_2,
      email_1: client.email_1,
      email_2: client.email_2,
      date_started: client.date_started,
      end_date: client.end_date,
      duration: client.duration,
      package_tier: client.package_tier,
      custom_package_name: client.custom_package_name,
      rate_per_month: client.rate_per_month,
      payment_terms: client.payment_terms,
      contract_status: client.contract_status,
      remarks: client.remarks,
      auto_email_enabled: true,
      documents_submitted: false
    }));

    setIsImporting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/virtual-offices/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        // IMPORTANT: Change 'LPOG' to 'LPC' when pasting this into the LPCVirtualOffice.jsx file!
        body: JSON.stringify({ clients: cleanPayload, branch: 'LPC' }) 
      });

      // Better Error Capture to show you exactly what the backend didn't like
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `Backend rejected the data (Error ${response.status}).`);
      }

      await fetchClients(); // Refresh the main table
      setShowImportModal(false);
      setImportStaging([]);
      setActionAlert({ show: true, message: `Successfully imported ${cleanPayload.length} clients!`, isError: false });
    } catch (err) {
      setActionAlert({ show: true, message: err.message, isError: true });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportData = () => {
    if (filteredClients.length === 0) {
      setActionAlert({ show: true, message: 'No data to export based on current filters.', isError: true });
      return;
    }

    // Clean and format the data before exporting
    const exportData = filteredClients.map(c => ({
      'Company Name': c.company_name || '',
      'Contact Person 1': c.contact_person_1 || '',
      'Contact Person 2': c.contact_person_2 || '',
      'Email 1': c.email_1 || '',
      'Email 2': c.email_2 || '',
      'Date Started': c.date_started ? c.date_started.split('T')[0] : '',
      'End Date': c.end_date ? c.end_date.split('T')[0] : '',
      'Duration': c.duration || '',
      'Package Tier': c.package_tier || '',
      'Agreed Rate': c.rate_per_month || '',
      'Payment Terms': c.payment_terms || '',
      'Current Status': c.contract_status || '',
      'Remarks': c.remarks || ''
    }));

    exportToCSV(exportData, `Launchpad_Clients_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleDownloadTemplate = () => {
    // The "Golden Template" with one dummy row to show them how to format it
    const templateData = [{
      'Company Name': 'Example Corp',
      'Contact Person 1': 'John Doe',
      'Contact Person 2': 'Jane Doe (Optional)',
      'Email 1': 'john@example.com',
      'Email 2': 'jane@example.com (Optional)',
      'Date Started (YYYY-MM-DD)': '2024-01-01',
      'End Date (YYYY-MM-DD)': '2025-01-01',
      'Package Tier': 'Virtual Office Package',
      'Agreed Rate': '3500',
      'Payment Terms': 'Monthly',
      'Current Status': 'Active',
      'Remarks': 'Notes go here'
    }];
    exportToCSV(templateData, 'Launchpad_Import_Template.csv');
  };


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

    setFormData({
       ...client,
       auto_email_enabled: client.auto_email_enabled === 1 || client.auto_email_enabled === true,
       documents_submitted: client.documents_submitted === 1 || client.documents_submitted === true
    });

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

    const payload = { ...formData, package_tier: finalPackageTier, branch: 'LPC' };
    
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

  // --- 1. TRIGGER THE CUSTOM MODAL ---
  const triggerDocRequest = (client) => {
    setDocRequestModal({ show: true, client });
  };

  // --- 2. EXECUTE THE ACTUAL SEND ---
  const executeDocRequest = async () => {
    const client = docRequestModal.client;
    if (!client) return;

    // Close the confirm modal immediately and start loading
    setDocRequestModal({ show: false, client: null });
    setIsSendingDoc(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://${window.location.hostname}:5000/api/emails/trigger-document-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ clientId: client.id, branch: 'LPC' }) // CHANGE TO 'LPOG' IN LPOG FILE!
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed tfo send email.');
      
      // THE NEW SUCCESS MESSAGE PROMPT
      setActionAlert({ 
        show: true, 
        message: "Document Request sent! Please check the 'Sent Emails' section in the Email Center to confirm.", 
        isError: false 
      });
    } catch (error) {
      setActionAlert({ show: true, message: error.message, isError: true });
    } finally {
      setIsSendingDoc(false);
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
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 p-8 overflow-hidden flex flex-col h-screen">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">LPC Virtual Office</h2>
            <p className="text-slate-500 mt-1">Manage all clients stationed at the Commercenter branch.</p>
          </div>
          <div className="flex items-center gap-4">
            {canViewNotifications && <NotificationBell />}
            
            {/* NEW EXPORT/IMPORT BUTTON GROUP */}
            <div className="flex bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden h-10">
              
              {/* HIDDEN FILE INPUT TRIGGERED BY THE IMPORT BUTTON */}
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                title="Smart Import Data from CSV"
                className="px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 border-r border-slate-200 flex items-center gap-2 transition-colors"
              >
                📂 Import
              </button>

              <button 
                onClick={handleExportData}
                title="Export Filtered Data to CSV"
                className="px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 border-r border-slate-200 flex items-center gap-2 transition-colors"
              >
                📥 Export
              </button>
              <button 
                onClick={handleDownloadTemplate}
                title="Download Blank CSV Template"
                className="px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                📄 Template
              </button>
            </div>

            <button 
              onClick={handleAddNew}
              className="h-10 rounded-lg bg-[#d2f34c] px-6 font-bold text-slate-900 transition-colors hover:bg-[#b8d839] shadow-sm flex items-center"
            >
              + Add New Client
            </button>
          </div>
        </header>

        {/* --- UNIFIED ORGANIZED FILTER SYSTEM --- */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col gap-5">
          
          {/* Top Row: Search & Reset */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-96 shrink-0">
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input 
                type="text" placeholder="Search companies or emails..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#d2f34c] transition-all"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {(searchTerm || filterStatus !== 'All' || filterDuration !== 'All' || filterRate !== 'All' || filterTerms !== 'All' || filterPackage !== 'All' || filterExpiration !== 'All' || filterTenure !== 'All' || filterAutoEmail !== 'All') && (
              <button 
                onClick={() => { setSearchTerm(''); setFilterStatus('All'); setFilterDuration('All'); setFilterRate('All'); setFilterTerms('All'); setFilterPackage('All'); setFilterExpiration('All'); setFilterTenure('All'); setFilterAutoEmail('All'); }}
                className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-4 py-2.5 rounded-lg transition-colors border border-rose-100 w-full sm:w-auto text-center"
              >
                Clear All Filters
              </button>
            )}
          </div>

          {/* Bottom Area: Filter Dropdowns */}
          <div className="flex flex-col gap-3 text-xs">
            
            {/* Group 1: Contract Details */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-400 uppercase tracking-widest w-full md:w-24 mb-1 md:mb-0">Contract:</span>
              <select className="border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 outline-none cursor-pointer" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="All">Status: All</option>
                <option value="Active">Active</option>
                <option value="Pending Renewal">Pending Renewal</option>
                <option value="Expired">Expired</option>
              </select>
              <select className="border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 outline-none cursor-pointer" value={filterDuration} onChange={(e) => setFilterDuration(e.target.value)}>
                <option value="All">Duration: All</option>
                {[...new Set(clients.map(c => c.duration))].filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 outline-none cursor-pointer" value={filterRate} onChange={(e) => setFilterRate(e.target.value)}>
                <option value="All">Rate: All</option>
                {[...new Set(clients.map(c => c.rate_per_month))].filter(Boolean).map(r => <option key={r} value={r}>₱{r}</option>)}
              </select>
              <select className="border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 outline-none cursor-pointer" value={filterTerms} onChange={(e) => setFilterTerms(e.target.value)}>
                <option value="All">Terms: All</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Semi-Annual">Semi-Annual</option>
                <option value="Annually">Annually</option>
              </select>
              <select className="border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 outline-none cursor-pointer max-w-[150px] truncate" value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)}>
                <option value="All">Package: All</option>
                {[...new Set(clients.map(c => c.package_tier))].filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Group 2: Operations */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
              <span className="font-bold text-slate-400 uppercase tracking-widest w-full md:w-24 mb-1 md:mb-0">Operations:</span>
              
              <select className="border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 outline-none cursor-pointer" value={filterExpiration} onChange={(e) => setFilterExpiration(e.target.value)}>
                 <option value="All">Time Left: All</option>
                 <option value="Expiring Soon">Expiring Soon (Under 60 Days)</option>
                 <option value="Expired">Expired (Action Required)</option>
              </select>
              
              <select className="border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 outline-none cursor-pointer" value={filterTenure} onChange={(e) => setFilterTenure(e.target.value)}>
                 <option value="All">Client Age: All</option>
                 <option value="New">New (Under 3 Months)</option>
                 <option value="Established">Established (3 to 12 Months)</option>
                 <option value="Long-Term">Long-Term (Over 1 Year)</option>
              </select>
              
              <select className="border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 outline-none cursor-pointer" value={filterAutoEmail} onChange={(e) => setFilterAutoEmail(e.target.value)}>
                 <option value="All">Auto-Email: All</option>
                 <option value="Enabled">System Enabled</option>
                 <option value="Disabled">Manually Paused</option>
              </select>
            </div>

          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-100 flex flex-col flex-1 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Company & Contacts</th>
                  <th className="px-6 py-4 font-semibold">Emails</th>
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
                      <td className="px-6 py-4 text-xs text-blue-500">
                        <p>{client.email_1 || '-'}</p>
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
                        {/* NEW QUICK ACTION BUTTON */}
                        <button 
                          onClick={() => triggerDocRequest(client)}
                          disabled={isSendingDoc || client.documents_submitted}
                          className={`p-1.5 rounded transition-colors ${client.documents_submitted ? 'text-slate-300 cursor-not-allowed' : 'text-amber-500 hover:bg-amber-50'}`} 
                          title={client.documents_submitted ? "Documents already submitted" : "Send Document Request Email"}
                        >
                          📄
                        </button>
                        
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
              <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Client Record' : 'Register LPC Client'}</h3>
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
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Service Type *</label>
              <select 
                    required 
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    value={formData.package_tier} 
                    onChange={(e) => {
                      const selected = e.target.value;
                      let autoRate = ''; 
                      if (selected === 'Virtual Office Package') autoRate = 3500; 
                      else if (selected === 'Use of Address') autoRate = 1375; // <-- NEW FIXED RATE
                      
                      setFormData({
                          ...formData, package_tier: selected, rate_per_month: autoRate,
                          custom_package_name: selected === 'Custom' ? formData.custom_package_name : '' 
                      });
                    }}
                  >
                    <option value="" disabled>-- Select Service --</option>
                    <option value="Virtual Office Package">Virtual Office (₱3,500/mo)</option>
                    <option value="Use of Address">Use of Address (₱1,375/mo)</option>
                    <option value="Custom">Custom Service (Staff to encode)</option>
                  </select>
                </div>

                {formData.package_tier === 'Custom' && (
                  <div className="animate-fade-in">
                    <label className="mb-1 block text-xs font-semibold text-blue-700">Specify Custom Service *</label>
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
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annual">Semi-Annual</option>
                    <option value="Annually">Annually (Full Payment)</option>
                  </select>
                </div>

                {/* NEW: Automation Controls */}
                <div className="pt-4 mt-2 border-t border-slate-200 space-y-3">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Automation</p>
                   
                   {/* Kill Switch Toggle */}
                   <label className="flex items-start gap-3 cursor-pointer group">
                     <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                       <input 
                         type="checkbox" 
                         className="peer sr-only" 
                         checked={formData.auto_email_enabled}
                         onChange={(e) => setFormData({...formData, auto_email_enabled: e.target.checked})}
                       />
                       <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#b8d839]"></div>
                     </div>
                     <div>
                       <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Enable Automated Emails</p>
                       <p className="text-[10px] text-slate-500 leading-tight mt-0.5">If unchecked, this client will NOT receive renewal or termination warnings.</p>
                     </div>
                   </label>

                   {/* Document Tracker Checkbox */}
                   <label className="flex items-start gap-3 cursor-pointer group pt-2">
                     <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                       <input 
                         type="checkbox" 
                         className="peer sr-only"
                         checked={formData.documents_submitted}
                         onChange={(e) => setFormData({...formData, documents_submitted: e.target.checked})}
                       />
                       <div className="w-5 h-5 bg-white border-2 border-slate-300 rounded flex items-center justify-center peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors">
                         <svg className={`w-3 h-3 text-white ${formData.documents_submitted ? 'opacity-100' : 'opacity-0'} transition-opacity`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                       </div>
                     </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Company Documents Submitted</p>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                        <strong className="text-emerald-600">Anti-Spam Lock:</strong> Check this once documents are surrendered. This instantly stops all automated document requests and disables the manual email button.
                      </p>
                    </div>
                   </label>
                </div>

              </div>

                {paymentSchedule ? (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm animate-fade-in flex flex-col h-[calc(100%-2rem)] overflow-hidden">
                    
                    {/* Header */}
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
                      <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Expected Billing Schedule</h5>
                    </div>

                    {/* Body */}
                    <div className="p-5 flex-1 flex flex-col gap-4 text-sm">
                      {paymentSchedule.terms === 'Annually' ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">One-Time Upfront Payment</span>
                          <span className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(paymentSchedule.totalContractValue)}</span>
                          {paymentSchedule.isProrated && (
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Includes all standard months and prorated days.</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {paymentSchedule.isProrated ? (
                            <>
                              <div className="flex justify-between items-end border-b border-slate-50 pb-3">
                                <span className="text-slate-600 font-medium">First {paymentSchedule.installmentLabel} <span className="text-[10px] text-slate-400 block">(Prorated)</span></span>
                                <span className="font-bold text-slate-800">{formatCurrency(paymentSchedule.firstInvoiceAmount)}</span>
                              </div>
                              
                              {/* Dynamically hides if there are 0 standard invoices (e.g., 12-mo Semi-Annual) */}
                              {paymentSchedule.standardInvoiceCount > 0 && (
                                <div className="flex justify-between items-end border-b border-slate-50 pb-3">
                                  <span className="text-slate-600 font-medium">
                                    Standard {paymentSchedule.installmentLabel} {paymentSchedule.standardInvoiceCount > 1 ? `(${paymentSchedule.standardInvoiceCount}x)` : ''}
                                  </span>
                                  <span className="font-bold text-slate-800">
                                    {formatCurrency(paymentSchedule.installmentAmount)}{paymentSchedule.terms === 'Monthly' ? '/mo' : ''}
                                  </span>
                                </div>
                              )}

                              {/* Only shows a Final invoice if there is more than 1 billing cycle */}
                              {paymentSchedule.totalInvoices > 1 && (
                                <div className="flex justify-between items-end pb-2">
                                  <span className="text-slate-600 font-medium">Final {paymentSchedule.installmentLabel} <span className="text-[10px] text-slate-400 block">(Prorated)</span></span>
                                  <span className="font-bold text-slate-800">{formatCurrency(paymentSchedule.finalInvoiceAmount)}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex justify-between items-center pb-2">
                              <span className="text-slate-600 font-medium">
                                Standard {paymentSchedule.installmentLabel} {paymentSchedule.standardInvoiceCount > 1 ? `(${paymentSchedule.standardInvoiceCount}x)` : ''}
                              </span>
                              <span className="font-bold text-slate-800">
                                {formatCurrency(paymentSchedule.installmentAmount)}{paymentSchedule.terms === 'Monthly' ? '/mo' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer - Dynamic based on Terms */}
                    {paymentSchedule.terms !== 'Annually' ? (
                      <div className="bg-slate-800 text-white px-5 py-4 mt-auto">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Total Contract Value</span>
                          <span className="text-lg font-black text-[#d2f34c]">{formatCurrency(paymentSchedule.totalContractValue)}</span>
                        </div>
                      </div>
                    ) : (
                       <div className="bg-slate-800 text-white px-5 py-4 mt-auto border-t border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Status</span>
                          <span className="text-sm font-bold text-[#d2f34c] uppercase tracking-wider">Fully Paid / Upfront</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 h-[calc(100%-2rem)] flex flex-col items-center justify-center text-center">
                    <svg className="w-8 h-8 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    <p className="text-xs text-slate-500 font-medium">Enter Start Date, End Date, Rate, and Terms to view the billing schedule.</p>
                  </div>
                )}

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

      {/* --- DOCUMENT REQUEST CONFIRMATION MODAL --- */}
      {docRequestModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-center animate-fade-in">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 mb-6 shadow-inner border border-blue-100">
              <span className="text-4xl">📄</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Send Document Request?</h3>
            <p className="text-slate-500 mb-8 text-base font-medium leading-relaxed">
              You are about to email <strong className="text-slate-800">{docRequestModal.client?.company_name}</strong> to officially request updated company documents.
            </p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setDocRequestModal({ show: false, client: null })} 
                className="flex-1 rounded-xl px-6 py-3 font-bold text-slate-600 hover:bg-slate-100 transition-colors bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={executeDocRequest} 
                className="flex-1 rounded-xl px-6 py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5"
              >
                Yes, Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ACTION ALERT (SUCCESS/ERROR) MODAL --- */}
      {actionAlert.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 animate-fade-in">
            <div className={`mx-auto flex items-center justify-center h-20 w-20 rounded-full mb-6 shadow-inner ${actionAlert.isError ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-500'}`}>
              <span className="text-4xl">{actionAlert.isError ? '❌' : '✅'}</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{actionAlert.isError ? 'Error' : 'Success'}</h3>
            <p className="text-slate-500 font-medium text-base mb-8 leading-relaxed">{actionAlert.message}</p>
            <button 
              onClick={() => setActionAlert({ show: false, message: '', isError: false })} 
              className="w-full px-5 py-3 rounded-xl font-bold text-slate-900 bg-[#d2f34c] hover:bg-[#b8d839] shadow-sm transition-all text-sm uppercase tracking-wide hover:-translate-y-0.5"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* --- PHASE 3: IMPORT STAGING / REVIEW MODAL --- */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <span>📥</span> Review Import Data
                </h3>
                <p className="text-slate-500 font-medium text-sm mt-1">
                  Please review the sanitized records below. Rows with missing required fields are highlighted in <strong className="text-rose-500">red</strong> and will be skipped.
                </p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-3xl">&times;</button>
            </div>

{/* The Editable Review Grid */}
            <div className="flex-1 p-6 bg-slate-50/50 overflow-hidden flex flex-col">
              <div className="border border-slate-200 rounded-xl shadow-sm bg-white flex flex-col flex-1 overflow-hidden">
                
                {/* NEW: Scrollable Wrapper for Horizontal & Vertical Scrolling */}
                <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap min-w-[1200px]">
{/* Excel-Style Draggable Headers */}
                    <thead className="bg-slate-100 text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-sm select-none">
                      <tr>
                        <ResizableHeader title="Status" defaultWidth={110} />
                        <ResizableHeader title="Company Name" defaultWidth={220} />
                        <ResizableHeader title="Contact Person 1" defaultWidth={180} />
                        <ResizableHeader title="Email" defaultWidth={220} />
                        <ResizableHeader title="Start Date" defaultWidth={130} />
                        <ResizableHeader title="End Date" defaultWidth={130} />
                        <ResizableHeader title="Service Type" defaultWidth={240} />
                        <ResizableHeader title="Rate" defaultWidth={140} />
                        <ResizableHeader title="Terms" defaultWidth={140} />
                        {/* --- NEW: ADD THESE TWO LINES --- */}
                        <ResizableHeader title="Contract Status" defaultWidth={140} />
                        <ResizableHeader title="Remarks" defaultWidth={250} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importStaging.map((row) => (
                        <tr key={row.id} className={`${row.hasErrors ? 'bg-rose-50/50' : 'hover:bg-slate-50'} transition-colors group`}>
                          
                          {/* Status */}
                          <td className="px-4 py-2">
                            {row.hasErrors ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded-md"><span className="text-sm">⚠️</span> Fix Errors</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md"><span className="text-sm">✅</span> Ready</span>
                            )}
                          </td>

                          {/* Editable Company Name */}
                          <td className="px-4 py-2">
                            <input 
                              type="text" 
                              value={row.company_name} 
                              onChange={(e) => handleStagingEdit(row.id, 'company_name', e.target.value)}
                              className={`w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 font-bold transition-all ${row.hasErrors && !row.company_name ? 'placeholder:text-rose-400 bg-rose-100/50 border-rose-200' : 'text-slate-800'}`}
                              placeholder="Required..."
                            />
                          </td>

                          {/* Editable Contact Person 1 */}
                          <td className="px-4 py-2">
                            <input 
                              type="text" 
                              value={row.contact_person_1 || ''} 
                              onChange={(e) => handleStagingEdit(row.id, 'contact_person_1', e.target.value)}
                              className="w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 transition-all"
                              placeholder="Optional..."
                            />
                          </td>

                          {/* Editable Email */}
                          <td className="px-4 py-2">
                            <input 
                              type="email" 
                              value={row.email_1} 
                              onChange={(e) => handleStagingEdit(row.id, 'email_1', e.target.value)}
                              className="w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 text-blue-600 transition-all"
                            />
                          </td>

                          {/* Editable Service Type & Conditional Custom Input (LPC) */}
                          <td className="px-4 py-2 min-w-56 align-top">
                            <div className="flex flex-col gap-1.5">
                              <select 
                                value={row.package_tier || ''} 
                                onChange={(e) => handleStagingEdit(row.id, 'package_tier', e.target.value)}
                                className="w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 transition-all text-sm"
                              >
                                <option value="" disabled>-- Select Service --</option>
                                <option value="Virtual Office Package">Virtual Office (₱3,500/mo)</option>
                                <option value="Use of Address">Use of Address (₱1,375/mo)</option>
                                <option value="Custom">Custom Service (Specify below)</option>
                              </select>
                              
                              {row.package_tier === 'Custom' && (
                                <input 
                                  type="text" 
                                  value={row.custom_package_name || ''} 
                                  onChange={(e) => handleStagingEdit(row.id, 'custom_package_name', e.target.value)}
                                  className="w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 transition-all text-sm"
                                  placeholder="Specify Custom Service..."
                                />
                              )}
                            </div>
                          </td>

                          {/* Editable Start Date */}
                          <td className="px-4 py-2">
                            <input 
                              type="date" 
                              value={row.date_started} 
                              onChange={(e) => handleStagingEdit(row.id, 'date_started', e.target.value)}
                              className={`w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 text-xs transition-all ${row.hasErrors && !row.date_started ? 'bg-rose-100/50 border-rose-200 text-rose-600' : 'text-slate-600'}`}
                            />
                          </td>

                          {/* Editable End Date */}
                          <td className="px-4 py-2">
                            <input 
                              type="date" 
                              value={row.end_date} 
                              onChange={(e) => handleStagingEdit(row.id, 'end_date', e.target.value)}
                              className={`w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 text-xs transition-all ${row.hasErrors && !row.end_date ? 'bg-rose-100/50 border-rose-200 text-rose-600' : 'text-slate-600'}`}
                            />
                          </td>

                          {/* Editable Rate */}
                          <td className="px-4 py-2">
                            <div className="relative flex items-center">
                              <span className="absolute left-2 text-slate-400 font-bold">₱</span>
                              <input 
                                type="number" 
                                value={row.rate_per_month} 
                                onChange={(e) => handleStagingEdit(row.id, 'rate_per_month', e.target.value)}
                                className={`w-full bg-transparent pl-6 pr-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 font-bold transition-all ${row.hasErrors && !row.rate_per_month ? 'placeholder:text-rose-400 bg-rose-100/50 border-rose-200' : 'text-slate-800'}`}
                                placeholder="0"
                              />
                            </div>
                          </td>

                          {/* Editable Terms */}
                          <td className="px-4 py-2">
                            <select 
                              value={row.payment_terms} 
                              onChange={(e) => handleStagingEdit(row.id, 'payment_terms', e.target.value)}
                              className="w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 transition-all cursor-pointer"
                            >
                              <option value="Monthly">Monthly</option>
                              <option value="Quarterly">Quarterly</option>
                              <option value="Semi-Annual">Semi-Annual</option>
                              <option value="Annually">Annually</option>
                            </select>
                          </td>

                          {/* --- NEW: Editable Contract Status --- */}
                          <td className="px-4 py-2 align-top">
                            <select 
                              value={row.contract_status || 'Active'} 
                              onChange={(e) => handleStagingEdit(row.id, 'contract_status', e.target.value)}
                              className="w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 transition-all text-sm"
                            >
                              <option value="Active">Active</option>
                              <option value="Expired">Expired</option>
                              <option value="Terminated">Terminated</option>
                            </select>
                          </td>

                          {/* --- NEW: Editable Remarks --- */}
                          <td className="px-4 py-2 align-top">
                            <input 
                              type="text" 
                              value={row.remarks || ''} 
                              onChange={(e) => handleStagingEdit(row.id, 'remarks', e.target.value)}
                              className="w-full bg-transparent px-2 py-1.5 rounded outline-none border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 font-medium text-slate-700 transition-all text-sm"
                              placeholder="No remarks..."
                            />
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer (Counters & Execution) */}
            <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.03)] z-10">
              <div className="flex gap-6">
                <div className="text-sm bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-lg flex flex-col items-center">
                   <span className="text-[10px] uppercase font-black text-emerald-600/70 tracking-wider">Valid Rows</span>
                   <span className="font-black text-emerald-600 text-xl">{importStaging.filter(r => !r.hasErrors).length}</span>
                </div>
                <div className="text-sm bg-rose-50 border border-rose-100 px-4 py-2 rounded-lg flex flex-col items-center">
                   <span className="text-[10px] uppercase font-black text-rose-500/70 tracking-wider">Skipped</span>
                   <span className="font-black text-rose-500 text-xl">{importStaging.filter(r => r.hasErrors).length}</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => setShowImportModal(false)} className="rounded-xl px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                <button 
                  onClick={executeBulkImport} 
                  disabled={isImporting || importStaging.filter(r => !r.hasErrors).length === 0}
                  className="rounded-xl bg-[#d2f34c] px-8 py-3 text-sm font-black text-slate-900 hover:bg-[#b8d839] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide flex items-center gap-2"
                >
                  {isImporting ? 'Importing...' : `Confirm & Import ${importStaging.filter(r => !r.hasErrors).length} Clients`}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}