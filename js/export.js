/* ============================================
   EASYBILL — Export Module (PDF, Word, Print)
   ============================================ */

const ExportModule = {
  // Generate the invoice HTML for preview / export
  generateInvoiceHTML(invoice, customer, settings) {
    const halfGst = (invoice.totalGst || 0) / 2;
    const isSameState = true; // Default to same state (CGST + SGST)

    return `
      <div class="invoice-preview" id="invoice-printable">
        <!-- Header -->
        <div class="inv-header">
          <div class="inv-logo-area">
            ${settings.logo ? `<img src="${Utils.escapeHtml(Cloud.assetUrl(settings.logo))}" alt="Logo" style="max-height: 60px; max-width: 180px; margin-bottom: 8px;">` : ''}
            <h2>${Utils.escapeHtml(settings.businessName || 'Your Business Name')}</h2>
            <p>
              ${settings.address ? Utils.escapeHtml(settings.address) + '<br>' : ''}
              ${settings.phone ? 'Phone: ' + Utils.escapeHtml(settings.phone) + '<br>' : ''}
              ${settings.email ? 'Email: ' + Utils.escapeHtml(settings.email) + '<br>' : ''}
              ${settings.gstin ? 'GSTIN: ' + Utils.escapeHtml(settings.gstin) : ''}
            </p>
          </div>
          <div class="inv-title-area">
            <h1>INVOICE</h1>
            <div class="inv-meta">
              <p><strong>Invoice #:</strong> ${Utils.escapeHtml(invoice.invoiceNumber || '')}</p>
              <p><strong>Date:</strong> ${Utils.formatDate(invoice.invoiceDate)}</p>
              ${invoice.dueDate ? `<p><strong>Due Date:</strong> ${Utils.formatDate(invoice.dueDate)}</p>` : ''}
            </div>
          </div>
        </div>

        <!-- Bill To -->
        <div class="inv-parties">
          <div class="inv-party">
            <h4>Bill To</h4>
            ${customer ? `
              <strong>${Utils.escapeHtml(customer.name)}</strong>
              <p>
                ${customer.address ? Utils.escapeHtml(customer.address) + '<br>' : ''}
                ${customer.phone ? 'Phone: ' + Utils.escapeHtml(customer.phone) + '<br>' : ''}
                ${customer.email ? 'Email: ' + Utils.escapeHtml(customer.email) + '<br>' : ''}
                ${customer.gstin ? 'GSTIN: ' + Utils.escapeHtml(customer.gstin) : ''}
              </p>
            ` : `<strong>${Utils.escapeHtml(invoice.customerName || 'Walk-in Customer')}</strong><p style="color: #999;">${invoice.paymentMethod ? `Paid by ${Utils.escapeHtml(invoice.paymentMethod)}` : 'Walk-in sale'}</p>`}
          </div>
          <div class="inv-party">
            <h4>Payment Info</h4>
            <p>
              <strong>Status:</strong> 
              <span style="color: ${invoice.status === 'paid' ? '#22c55e' : invoice.status === 'partial' ? '#f59e0b' : '#ef4444'};">
                ${(invoice.status || 'unpaid').charAt(0).toUpperCase() + (invoice.status || 'unpaid').slice(1)}
              </span>
              ${invoice.dueDate ? `<br><strong>Due:</strong> ${Utils.formatDate(invoice.dueDate)}` : ''}
            </p>
          </div>
        </div>

        <!-- Items Table -->
        <table class="inv-items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item Description</th>
              <th>HSN/SAC</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>GST</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || []).map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${Utils.escapeHtml(item.name || '')}</strong></td>
                <td>${Utils.escapeHtml(item.hsn || '-')}</td>
                <td>${item.quantity || 0}</td>
                <td>${Utils.formatCurrency(item.rate || 0)}</td>
                <td>${item.gstRate || 0}%</td>
                <td style="text-align: right;">${Utils.formatCurrency(item.amount || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="inv-totals">
          <div class="inv-totals-table">
            <div class="inv-totals-row">
              <span>Subtotal</span>
              <span>${Utils.formatCurrency(invoice.subtotal || 0)}</span>
            </div>
            ${(invoice.totalDiscount || 0) > 0 ? `
              <div class="inv-totals-row" style="color: #22c55e;">
                <span>Discount</span>
                <span>-${Utils.formatCurrency(invoice.totalDiscount)}</span>
              </div>
            ` : ''}
            ${isSameState ? `
              <div class="inv-totals-row">
                <span>CGST</span>
                <span>${Utils.formatCurrency(halfGst)}</span>
              </div>
              <div class="inv-totals-row">
                <span>SGST</span>
                <span>${Utils.formatCurrency(halfGst)}</span>
              </div>
            ` : `
              <div class="inv-totals-row">
                <span>IGST</span>
                <span>${Utils.formatCurrency(invoice.totalGst || 0)}</span>
              </div>
            `}
            <div class="inv-totals-row total">
              <span>Grand Total</span>
              <span>${Utils.formatCurrency(invoice.grandTotal || 0)}</span>
            </div>
          </div>
        </div>

        <!-- Amount in Words -->
        <p style="font-size: 13px; color: #555; margin-bottom: 24px;">
          <strong>Amount in words:</strong> ${Utils.numberToWords(Math.round(invoice.grandTotal || 0))} Rupees Only
        </p>

        <!-- Notes & Terms -->
        <div class="inv-footer">
          ${invoice.notes ? `
            <h4>Notes</h4>
            <p>${Utils.escapeHtml(invoice.notes)}</p>
          ` : ''}
          ${invoice.terms ? `
            <h4 style="margin-top: 12px;">Terms & Conditions</h4>
            <p>${Utils.escapeHtml(invoice.terms)}</p>
          ` : ''}
          <p class="inv-thank-you">Thank you for your business!</p>
        </div>
      </div>
    `;
  },

  // Show preview modal with export options
  showPreview(invoice, customer, settings) {
    const overlay = document.getElementById('modal-overlay');
    const html = this.generateInvoiceHTML(invoice, customer, settings);

    overlay.innerHTML = `
      <div class="modal modal-xl">
        <div class="modal-header">
          <h3 class="modal-title">Invoice Preview — ${Utils.escapeHtml(invoice.invoiceNumber || '')}</h3>
          <button class="modal-close" onclick="ExportModule.closePreview()">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body" style="padding: 16px; background: #f5f5f5; max-height: 65vh; overflow-y: auto;">
          ${html}
        </div>
        <div class="modal-footer" style="flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="ExportModule.closePreview()">Close</button>
          <button class="btn btn-primary" onclick="ExportModule.printInvoice()">
            <i data-lucide="printer"></i> Print Bill
          </button>
          <button class="btn btn-secondary" onclick="ExportModule.exportToWord()">
            <i data-lucide="file-text"></i> Word (.docx)
          </button>
          <button class="btn btn-primary" onclick="ExportModule.exportToPDF()">
            <i data-lucide="file-down"></i> Download PDF
          </button>
        </div>
      </div>
    `;

    overlay.classList.add('active');
    if (window.lucide) lucide.createIcons();

    // Store current invoice data for export
    this._currentInvoice = invoice;
    this._currentCustomer = customer;
    this._currentSettings = settings;
  },

  closePreview() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  // Export to PDF using html2canvas + jsPDF
  async exportToPDF() {
    const element = document.getElementById('invoice-printable');
    if (!element) {
      Utils.toast('No invoice to export', 'error');
      return;
    }

    Utils.toast('Generating PDF...', 'info', 2000);

    try {
      if (!window.html2canvas || !window.jspdf?.jsPDF) {
        throw new Error('PDF libraries are unavailable');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);
      const renderedHeight = canvas.height * contentWidth / canvas.width;
      const pixelsPerPage = Math.floor(canvas.height * contentHeight / renderedHeight);
      let offset = 0;
      let pageNumber = 0;

      while (offset < canvas.height) {
        const sliceHeight = Math.min(pixelsPerPage, canvas.height - offset);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pageContext = pageCanvas.getContext('2d');
        pageContext.fillStyle = '#ffffff';
        pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageContext.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        if (pageNumber > 0) pdf.addPage();
        const sliceHeightMm = sliceHeight * contentWidth / canvas.width;
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, contentWidth, sliceHeightMm);
        pageNumber += 1;
        offset += sliceHeight;
      }

      const fileName = `invoice-${this._currentInvoice?.invoiceNumber || 'export'}.pdf`;
      pdf.save(fileName);
      Utils.toast('PDF downloaded!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      Utils.toast('PDF could not be generated. Try Print > Save as PDF.', 'error');
    }
  },

  // Export to Word (.docx)
  exportToWord() {
    const element = document.getElementById('invoice-printable');
    if (!element) {
      Utils.toast('No invoice to export', 'error');
      return;
    }

    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Calibri', Arial, sans-serif; font-size: 12pt; color: #333; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #0d9488; color: white; }
            h1, h2, h3, h4 { color: #0d9488; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
        </html>
      `;

      // Use html-docx-js if available, otherwise fallback to Blob
      if (window.htmlDocx) {
        const converted = htmlDocx.asBlob(htmlContent);
        const url = URL.createObjectURL(converted);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${this._currentInvoice?.invoiceNumber || 'export'}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Fallback: save as HTML with .doc extension (Word can open it)
        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${this._currentInvoice?.invoiceNumber || 'export'}.doc`;
        a.click();
        URL.revokeObjectURL(url);
      }
      Utils.toast('Word document downloaded!', 'success');
    } catch (err) {
      console.error('Word export error:', err);
      Utils.toast('Failed to export Word document.', 'error');
    }
  },

  // Print invoice
  printInvoice() {
    const element = document.getElementById('invoice-printable');
    if (!element) return;

    const invoiceNumber = this._currentInvoice?.invoiceNumber || 'Bill';
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.width = '1px';
    printFrame.style.height = '1px';
    printFrame.style.opacity = '0';
    printFrame.style.pointerEvents = 'none';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const cleanup = () => {
      if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
    };

    printFrame.onload = () => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    };
    printFrame.contentWindow.onafterprint = cleanup;

    const printDocument = printFrame.contentDocument;
    printDocument.open();
    printDocument.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${Utils.escapeHtml(invoiceNumber)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Inter', Arial, sans-serif; 
            padding: 20px;
            color: #1a1a1a;
          }
          .invoice-preview { max-width: 800px; margin: 0 auto; }
          .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #0d9488; }
          .inv-logo-area h2 { font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800; color: #0d9488; margin-bottom: 4px; }
          .inv-logo-area p { font-size: 13px; color: #666; line-height: 1.6; }
          .inv-title-area { text-align: right; }
          .inv-title-area h1 { font-family: 'Outfit', sans-serif; font-size: 36px; font-weight: 800; color: #0d9488; letter-spacing: -1px; }
          .inv-meta p { font-size: 13px; color: #666; }
          .inv-meta strong { color: #333; }
          .inv-parties { display: flex; gap: 40px; margin-bottom: 32px; }
          .inv-party { flex: 1; }
          .inv-party h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #0d9488; font-weight: 600; margin-bottom: 8px; }
          .inv-party p { font-size: 13px; color: #555; line-height: 1.6; }
          .inv-party strong { font-size: 15px; color: #1a1a1a; display: block; margin-bottom: 2px; }
          .inv-items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .inv-items-table thead { background: #0d9488; color: white; }
          .inv-items-table th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
          .inv-items-table th:last-child, .inv-items-table td:last-child { text-align: right; }
          .inv-items-table td { padding: 12px 16px; font-size: 13px; color: #555; border-bottom: 1px solid #eee; }
          .inv-totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
          .inv-totals-table { width: 280px; }
          .inv-totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #555; }
          .inv-totals-row.total { border-top: 2px solid #0d9488; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 700; color: #1a1a1a; }
          .inv-footer { border-top: 1px solid #eee; padding-top: 20px; }
          .inv-footer h4 { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
          .inv-footer p { font-size: 12px; color: #888; line-height: 1.6; }
          .inv-thank-you { text-align: center; margin-top: 24px; font-size: 14px; font-weight: 600; color: #0d9488; }
          img { max-height: 60px; max-width: 180px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
      </html>
    `);
    printDocument.close();
  }
};
