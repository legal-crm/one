const fs = require('fs');
const JSZip = require('jszip');

async function parseHwpx(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  
  // Get all section files
  const sectionFiles = Object.keys(zip.files).filter(n => n.startsWith('Contents/section') && n.endsWith('.xml'));
  
  for (const sectionPath of sectionFiles) {
    const xml = await zip.file(sectionPath).async('string');
    
    // Extract ALL text
    const textMatches = xml.match(/<hp:t>([^<]*)<\/hp:t>/g) || [];
    const allText = textMatches.map(m => m.replace(/<\/?hp:t>/g, '')).join('\n');
    console.log('=== TEXT CONTENT ===');
    console.log(allText);
    
    // Count tables
    const tableCount = (xml.match(/<hp:tbl /g) || []).length;
    console.log('\n=== TABLES: ' + tableCount + ' ===');
    
    // Extract table cell text
    // Split by table tags to analyze each table
    const tables = xml.split(/<hp:tbl /);
    tables.shift(); // remove pre-table content
    tables.forEach((tbl, i) => {
      const rows = tbl.split(/<hp:tr>/);
      console.log(`Table ${i+1}: ${rows.length - 1} rows`);
      rows.forEach((row, ri) => {
        if (ri === 0) return;
        const cellTexts = row.match(/<hp:t>([^<]*)<\/hp:t>/g) || [];
        const cells = cellTexts.map(m => m.replace(/<\/?hp:t>/g, ''));
        if (cells.length > 0) console.log(`  Row ${ri}: [${cells.join(' | ')}]`);
      });
    });
  }
}

// Parse files
const files = [
  '법원양식/개인회생절차 개시신청서(2021.4.20.시행)(D5100).hwpx',
  '법원양식/재산목록(D5101).hwpx',
  '법원양식/수입 및 지출에 관한 목록(D5103).hwpx',
];

(async () => {
  for (const f of files) {
    console.log('\n\n============================');
    console.log('FILE: ' + f);
    console.log('============================');
    try {
      await parseHwpx(f);
    } catch (e) {
      console.error(`Error parsing ${f}:`, e);
    }
  }
})();
