import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateReceipt = (payment) => {
  const doc = new jsPDF();

  // 1. SET UP THE HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Dark Slate
  doc.text("LAUNCHPAD COWORKING", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); 
  doc.text("Official Acknowledgement Receipt", 14, 28);
  doc.text(`Branch: ${payment.branch || 'Headquarters'}`, 14, 34);

  // 2. PAYMENT & CLIENT DETAILS
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  
  doc.text(`Receipt No: REC-${payment.id.toString().padStart(5, '0')}`, 14, 50);
  const paymentDate = new Date(payment.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Date: ${paymentDate}`, 14, 56);

  doc.text(`Billed To:`, 120, 50);
  doc.setFont("helvetica", "bold");
  doc.text(payment.company_name, 120, 56);
  doc.setFont("helvetica", "normal");

  // 3. AUTOMATED INCLUSIONS LOGIC
  let inclusions = "";
  let descriptionName = payment.package_tier || '';

  const fullVirtualOfficeInclusions = 
    "• 10 days use of coworking desk per month\n" +
    "• Access during operating hours: Monday-Friday, 9:00 am - 7:00 pm; Sat 10:00 am-5:00 pm\n" +
    "• Receptionist during operating hours\n" +
    "• Air-conditioning, lighting, and furniture\n" +
    "• Unlimited coffee and filtered water\n" +
    "• High speed internet access\n" +
    "• Access to printer/ scanner/ photocopier (print 10 pages/day)\n" +
    "• Access to lounge and pantry\n" +
    "• Free 3-hour parking (P10.00 in every succeeding hour)\n" +
    "• Access to Launchpad-hosted events (i.e. Mission Mondays, Pitch Night)\n" +
    "• Use of address for Business Registration\n" +
    "• Mail handling\n" +
    "• Renewal every 12 months at a discounted price";

  if (descriptionName === "Use of Address") {
      // BRANCH-SPECIFIC LOGIC ADDED HERE!
      if (payment.branch === 'LPC') {
          inclusions = "• Use of address for Business Registration only";
      } else {
          // LPOG gets mail handling included
          inclusions = "• Use of address for Business Registration\n• Mail handling";
      }
  } 
  else if (descriptionName.startsWith("Custom:")) {
      // Strips the "Custom: " tag and prints exactly what the staff typed
      const customInput = descriptionName.replace("Custom: ", "").trim();
      descriptionName = customInput;
      inclusions = customInput; 
  } 
  else {
      // If it's the main package, automate the detection and print the massive list!
      descriptionName = "Virtual Office Package";
      inclusions = fullVirtualOfficeInclusions;
  }

  // 4. DRAW THE ITEM TABLE
  autoTable(doc, {
    startY: 65,
    head: [['Description', 'Inclusions', 'Amount']],
    body: [
      [
        `Launchpad ${descriptionName}`,
        inclusions,
        `PHP ${Number(payment.amount_paid).toLocaleString('en-US', {minimumFractionDigits: 2})}`
      ]
    ],
    theme: 'striped',
    headStyles: { fillColor: [210, 243, 76], textColor: [30, 41, 59] }, // Launchpad Lime Green
    styles: { cellPadding: 6, fontSize: 9, valign: 'top' }, // Slightly smaller font to fit the long list elegantly
    columnStyles: { 
      0: { cellWidth: 45 },  // Description column
      1: { cellWidth: 105 }, // Given more width for the massive inclusion list
      2: { halign: 'right' } // Price column
    }
  });

  // 5. FOOTER & TOTALS
  const finalY = doc.lastAutoTable.finalY || 100;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total Paid: PHP ${Number(payment.amount_paid).toLocaleString('en-US', {minimumFractionDigits: 2})}`, 140, finalY + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Mode of Payment: ${payment.mode_of_payment}`, 14, finalY + 15);
  doc.text(`Reference No: ${payment.reference_number || 'N/A'}`, 14, finalY + 22);
  doc.text(`Verified By: ${payment.verified_by_name || 'Management'}`, 14, finalY + 29);

  // 6. DOWNLOAD
  doc.save(`Launchpad_Receipt_${payment.company_name.replace(/\s+/g, '_')}_${payment.id}.pdf`);
};