const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_DIR = path.resolve(__dirname, '..');
const FORMS_DIR = path.join(BASE_DIR, '법원양식');

const files = [
  '진술서(D5105).hwpx',
  '개인회생채권자목록(D5106).hwpx',
  '변제계획안(가용소득만으로 변제하는 경우)(D5110) (1).hwpx',
  '금지명령 신청서(D5114).hwpx'
];

async function parseHwpx(fileName) {
  const filePath = path.join(FORMS_DIR, fileName);
  console.log('\n============================================================');
  console.log('FILE: ' + fileName);
  console.log('============================================================\n');

  if (!fs.existsSync(filePath)) {
    console.error('File not found: ' + filePath);
    return;
  }

  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const sectionFiles = Object.keys(zip.files).filter(n => n.startsWith('Contents/section') && n.endsWith('.xml')).sort();
  
  for (const sectionPath of sectionFiles) {
    console.log(`\n>>> Section: ${sectionPath} <<<`);
    const xml = await zip.file(sectionPath).async('string');
    
    // 1. Full text content
    const textMatches = xml.match(/<hp:t>([^<]*)<\/hp:t>/g) || [];
    const allText = textMatches.map(m => m.replace(/<\/?hp:t>/g, '')).join('\n');
    console.log('\n=== TEXT CONTENT ===');
    console.log(allText);

    // Form fields (누름틀)
    const fieldMatches = [...xml.matchAll(/<hp:fieldBegin\b[^>]*name="([^"]+)"[^>]*>/g)].map(m => m[1]);
    if (fieldMatches.length > 0) {
      console.log('\n=== FORM FIELDS (누름틀) ===');
      console.log(fieldMatches.join(', '));
    }
    
    // 2. Tables
    const tableCount = (xml.match(/<hp:tbl\b/g) || []).length;
    console.log('\n=== TABLES: ' + tableCount + ' ===');
    
    const tables = xml.split(/<hp:tbl\b/);
    tables.shift();
    tables.forEach((tbl, i) => {
      const endTagIdx = tbl.indexOf('>');
      const tblAttrs = tbl.substring(0, endTagIdx);
      const rowCntMatch = tblAttrs.match(/rowCnt="(\d+)"/);
      const colCntMatch = tblAttrs.match(/colCnt="(\d+)"/);
      const rowCnt = rowCntMatch ? rowCntMatch[1] : '?';
      const colCnt = colCntMatch ? colCntMatch[1] : '?';

      const rows = tbl.split(/<hp:tr\b[^>]*>/);
      console.log(`\nTable ${i+1}: Defined Rows=${rowCnt}, Cols=${colCnt} (Parsed rows: ${rows.length - 1})`);
      rows.forEach((row, ri) => {
        if (ri === 0) return;
        const cellTexts = row.match(/<hp:t>([^<]*)<\/hp:t>/g) || [];
        const cells = cellTexts.map(m => m.replace(/<\/?hp:t>/g, ''));
        if (cells.length > 0) {
          console.log(`  Row ${ri}: [${cells.join(' | ')}]`);
        }
      });
    });

    // 3. Section/Chapter Headings
    console.log('\n=== SECTION / CHAPTER HEADINGS ===');
    const pRegex = /<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/g;
    let pMatch;
    const headingPatterns = [
      /^[【\[][^\]】]+[\]】]/,
      /^[0-9]+[\.\s]/,
      /^[가-힣]\.\s/,
      /^[IVXLCDM]+\./,
      /^제\s*[0-9가-힣]+\s*[조장호항]/,
      /신청인|채무자|대리인|신청\s*취지|신청\s*이유|첨부\s*서류|목록|작성요령/
    ];
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pContent = pMatch[1];
      const pTexts = [...pContent.matchAll(/<hp:t>([^<]*)<\/hp:t>/g)].map(m => m[1]).join('').trim();
      if (pTexts.length > 0 && pTexts.length < 80) {
        if (headingPatterns.some(pat => pat.test(pTexts))) {
          console.log(`  - ${pTexts}`);
        }
      }
    }
  }
}

(async () => {
  for (const f of files) {
    await parseHwpx(f);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
