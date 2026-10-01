const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Export competitions to CSV
const exportCompetitionsCSV = (competitions, res) => {
  try {
    const fields = ['id', 'name', 'date', 'location', 'status', 'description', 'prize_pool', 'entry_fee', 'entries'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(competitions);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=competitions.csv');
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'CSV export failed' });
  }
};

// Export orders to CSV
const exportOrdersCSV = (orders, res) => {
  try {
    const fields = ['id', 'user_id', 'total', 'status', 'order_type', 'created_at'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(orders);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'CSV export failed' });
  }
};

// Export users to CSV
const exportUsersCSV = (users, res) => {
  try {
    const fields = ['id', 'email', 'name', 'role', 'created_at'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(users);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'CSV export failed' });
  }
};

// Export to PDF
const exportPDF = (title, data, fields, res) => {
  try {
    const doc = new PDFDocument();
    const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    const filepath = path.join(__dirname, `../exports/${filename}`);
    
    // Create exports directory if it doesn't exist
    const dir = path.join(__dirname, '../exports');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    
    // Header
    doc.fontSize(20).text(title, 100, 50).moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 100, 85).moveDown(2);
    
    // Table
    const tableTop = 120;
    const col1 = 50;
    const col2 = 150;
    const col3 = 250;
    const col4 = 350;
    const col5 = 450;
    const rowHeight = 20;
    
    doc.fontSize(10).font('Helvetica-Bold');
    fields.forEach((field, i) => {
      const x = [col1, col2, col3, col4, col5][i];
      doc.text(field, x, tableTop);
    });
    
    doc.font('Helvetica');
    let y = tableTop + rowHeight;
    
    data.forEach((item, index) => {
      let row = [];
      fields.forEach(field => {
        row.push(item[field] || '');
      });
      
      row.forEach((text, i) => {
        const x = [col1, col2, col3, col4, col5][i];
        doc.text(String(text).substring(0, 30), x, y);
      });
      
      y += rowHeight;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    });
    
    doc.end();
    
    stream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.sendFile(filepath, (err) => {
        if (err) console.error('PDF send error:', err);
        // Delete file after sending
        setTimeout(() => {
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        }, 1000);
      });
    });
    
    stream.on('error', (err) => {
      console.error('PDF stream error:', err);
      res.status(500).json({ error: 'PDF export failed' });
    });
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'PDF export failed' });
  }
};

module.exports = {
  exportCompetitionsCSV,
  exportOrdersCSV,
  exportUsersCSV,
  exportPDF
};
