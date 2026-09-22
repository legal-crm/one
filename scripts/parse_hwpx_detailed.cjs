const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_DIR = 'c:/Users/JSH/Downloads/legal-crm---회생파산-상담-플랫폼';
const FORMS_DIR = path.join(BASE_DIR, '법원양식');

const files = [
  '개인회생절차 개시신청서(2021.4.20.시행)(D5100).hwpx',
  '재산목록(D5101).hwpx',
  '수입 및 지출에 관한 목록(D5103).hwpx'
];

async function parseHwpxFile(fileName) {
  const filePath = path.join(FORMS_DIR, fileName);
  console.log(`\n================================================================================`);
  console.log(`FILE: ${fileName}`);
  console.log(`================================================================================\n`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  // Check header.xml for styles/fonts if needed
  if (zip.file('Contents/header.xml')) {
    const headerXml = await zip.file('Contents/header.xml').async('string');
    // Extract font faces
    const fontMatches = [...headerXml.matchAll(/<hh:font face="([^"]+)"/g)].map(m => m[1]);
    const uniqueFonts = [...new Set(fontMatches)];
    console.log(`[FONTS]: ${uniqueFonts.join(', ')}`);
  }

  const sectionFiles = Object.keys(zip.files)
    .filter(n => n.startsWith('Contents/section') && n.endsWith('.xml'))
    .sort();

  console.log(`Found ${sectionFiles.length} section(s): ${sectionFiles.join(', ')}`);

  for (const sectionPath of sectionFiles) {
    console.log(`\n--- Processing ${sectionPath} ---`);
    const xml = await zip.file(sectionPath).async('string');

    // 1. Full text extraction in exact order
    console.log('\n=== 1. FULL EXTRACTED TEXT (ALL <hp:t> IN ORDER) ===\n');
    
    // Let's parse paragraph by paragraph or text tags
    // A paragraph is <hp:p>...</hp:p>
    // Within <hp:p>, text is in <hp:t>
    const pRegex = /<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/g;
    let pMatch;
    let pIndex = 0;
    const allParagraphs = [];
    const fullTextList = [];

    // Also look for fieldBegin tags
    const fieldMatches = [...xml.matchAll(/<hp:fieldBegin\b[^>]*name="([^"]+)"[^>]*>/g)].map(m => m[1]);
    if (fieldMatches.length > 0) {
      console.log(`[Form Fields (누름틀)]: ${fieldMatches.join(', ')}\n`);
    }

    // Let's also extract text tags directly
    const tRegex = /<hp:t>([^<]*)<\/hp:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(xml)) !== null) {
      if (tMatch[1].trim()) {
        fullTextList.push(tMatch[1]);
      }
    }

    // Let's print paragraph by paragraph
    while ((pMatch = pRegex.exec(xml)) !== null) {
      pIndex++;
      const pContent = pMatch[1];
      const pTexts = [...pContent.matchAll(/<hp:t>([^<]*)<\/hp:t>/g)].map(m => m[1]).join('');
      if (pTexts.trim().length > 0) {
        allParagraphs.push({ index: pIndex, text: pTexts });
      }
    }

    allParagraphs.forEach(p => {
      console.log(`[P${p.index}] ${p.text}`);
    });

    // 2. Table structure analysis
    console.log('\n=== 2. TABLE STRUCTURE ANALYSIS ===\n');
    
    // Find all tables <hp:tbl ...> ... </hp:tbl>
    // Note: Tables might have nested tables, but in HWPX usually they are regular
    const tblRegex = /<hp:tbl\b([^>]*)>([\s\S]*?)<\/hp:tbl>/g;
    let tblMatch;
    let tblIndex = 0;

    while ((tblMatch = tblRegex.exec(xml)) !== null) {
      tblIndex++;
      const tblAttrs = tblMatch[1];
      const tblContent = tblMatch[2];

      // Extract attributes like rowCnt, colCnt
      const rowCntMatch = tblAttrs.match(/rowCnt="(\d+)"/);
      const colCntMatch = tblAttrs.match(/colCnt="(\d+)"/);
      const rowCnt = rowCntMatch ? rowCntMatch[1] : 'unknown';
      const colCnt = colCntMatch ? colCntMatch[1] : 'unknown';

      console.log(`\n------------------------------------------------------------`);
      console.log(`Table ${tblIndex}: Rows=${rowCnt}, Cols=${colCnt}`);
      console.log(`------------------------------------------------------------`);

      // Extract rows <hp:tr ...> ... </hp:tr>
      const trRegex = /<hp:tr\b[^>]*>([\s\S]*?)<\/hp:tr>/g;
      let trMatch;
      let rowIndex = 0;

      while ((trMatch = trRegex.exec(tblContent)) !== null) {
        rowIndex++;
        const rowContent = trMatch[1];
        
        // Extract cells <hp:tc ...> ... </hp:tc>
        const tcRegex = /<hp:tc\b([^>]*)>([\s\S]*?)<\/hp:tc>/g;
        let tcMatch;
        let cellIndex = 0;
        const rowCells = [];

        while ((tcMatch = tcRegex.exec(rowContent)) !== null) {
          cellIndex++;
          const tcAttrs = tcMatch[1];
          const tcContent = tcMatch[2];

          // Check colSpan, rowSpan
          const colSpanMatch = tcAttrs.match(/colSpan="(\d+)"/);
          const rowSpanMatch = tcAttrs.match(/rowSpan="(\d+)"/);
          const spanInfo = [];
          if (colSpanMatch && colSpanMatch[1] !== '1') spanInfo.push(`colSpan=${colSpanMatch[1]}`);
          if (rowSpanMatch && rowSpanMatch[1] !== '1') spanInfo.push(`rowSpan=${rowSpanMatch[1]}`);
          const spanStr = spanInfo.length > 0 ? ` (${spanInfo.join(', ')})` : '';

          // Cell text
          const cellTexts = [...tcContent.matchAll(/<hp:t>([^<]*)<\/hp:t>/g)].map(m => m[1]).join(' ').trim();
          rowCells.push(`[Cell ${cellIndex}${spanStr}]: "${cellTexts}"`);
        }

        console.log(`  Row ${rowIndex} (${rowCells.length} cells): ${rowCells.join(' | ')}`);
      }
    }

    console.log(`\nTotal tables found in ${sectionPath}: ${tblIndex}`);

    // 3. Headings / Structure detection
    console.log('\n=== 3. SECTION / CHAPTER HEADINGS FOUND ===\n');
    const headingPatterns = [
      /^[【\[][^\]】]+[\]】]/,
      /^[0-9]+[\.\s]/,
      /^[가-힣]\.\s/,
      /^[IVXLCDM]+\./,
      /^제\s*[0-9가-힣]+\s*[조장호항]/,
      /신청인|채무자|대리인|신청\s*취지|신청\s*이유|첨부\s*서류|목록|작성요령/
    ];

    allParagraphs.forEach(p => {
      const trimmed = p.text.trim();
      const isHeading = headingPatterns.some(pat => pat.test(trimmed));
      if (isHeading && trimmed.length < 80) {
        console.log(`  - ${trimmed}`);
      }
    });
  }
}

async function main() {
  for (const f of files) {
    await parseHwpxFile(f);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
