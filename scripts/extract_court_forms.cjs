/**
 * 법원 HWPX 7종 핵심 양식의 전체 텍스트 + 테이블 구조를 추출하여 JSON으로 저장
 */
const fs = require('fs');
const JSZip = require('jszip');
const path = require('path');

const BASE = path.join(__dirname, '..', '법원양식');
const OUTPUT = path.join(__dirname, '..', 'src', 'services', 'court', 'courtFormSchemas.json');

const CORE_FORMS = [
  { code: 'D5100', file: '개인회생절차 개시신청서(2021.4.20.시행)(D5100).hwpx' },
  { code: 'D5101', file: '재산목록(D5101).hwpx' },
  { code: 'D5103', file: '수입 및 지출에 관한 목록(D5103).hwpx' },
  { code: 'D5105', file: '진술서(D5105).hwpx' },
  { code: 'D5106', file: '개인회생채권자목록(D5106).hwpx' },
  { code: 'D5110', file: '변제계획안(가용소득만으로 변제하는 경우)(D5110) (1).hwpx' },
  { code: 'D5114', file: '금지명령 신청서(D5114).hwpx' },
];

async function extractSectionXml(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const sections = {};
  
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith('Contents/section') && name.endsWith('.xml')) {
      sections[name] = await zip.file(name).async('string');
    }
  }
  
  // Also extract header.xml for font info
  const header = zip.file('Contents/header.xml');
  if (header) {
    sections['header'] = await header.async('string');
  }
  
  return sections;
}

function extractText(xml) {
  const matches = xml.match(/<hp:t>([^<]*)<\/hp:t>/g) || [];
  return matches.map(m => m.replace(/<\/?hp:t>/g, '')).filter(t => t.trim());
}

function extractTableStructure(xml) {
  const tables = [];
  // Split by table tags
  const parts = xml.split(/<hp:tbl /);
  parts.shift(); // remove pre-table content
  
  parts.forEach((tblXml, tblIdx) => {
    const rows = [];
    const rowParts = tblXml.split(/<hp:tr>/);
    rowParts.shift();
    
    rowParts.forEach((rowXml) => {
      const cellTexts = (rowXml.match(/<hp:t>([^<]*)<\/hp:t>/g) || [])
        .map(m => m.replace(/<\/?hp:t>/g, '').trim())
        .filter(t => t);
      
      // Extract colSpan info
      const colSpans = (rowXml.match(/colSpan="(\d+)"/g) || [])
        .map(m => parseInt(m.match(/\d+/)[0]));
      
      if (cellTexts.length > 0) {
        rows.push({ cells: cellTexts, colSpans });
      }
    });
    
    if (rows.length > 0) {
      tables.push({ tableIndex: tblIdx + 1, rows });
    }
  });
  
  return tables;
}

function extractFieldNames(xml) {
  const fields = [];
  const matches = xml.match(/name="([^"]+)"/g) || [];
  matches.forEach(m => {
    const name = m.match(/name="([^"]+)"/)[1];
    if (name && !name.includes(':') && !name.includes('/')) {
      fields.push(name);
    }
  });
  return [...new Set(fields)];
}

(async () => {
  const result = {};
  
  for (const form of CORE_FORMS) {
    const filePath = path.join(BASE, form.file);
    if (!fs.existsSync(filePath)) {
      console.error(`NOT FOUND: ${form.file}`);
      continue;
    }
    
    console.log(`Parsing ${form.code}...`);
    const sections = await extractSectionXml(filePath);
    
    const formData = {
      code: form.code,
      fileName: form.file,
      sections: []
    };
    
    for (const [secName, xml] of Object.entries(sections)) {
      if (secName === 'header') continue;
      
      formData.sections.push({
        name: secName,
        textLines: extractText(xml),
        tables: extractTableStructure(xml),
        fieldNames: extractFieldNames(xml),
      });
    }
    
    result[form.code] = formData;
    console.log(`  ${form.code}: ${formData.sections.reduce((s, sec) => s + sec.textLines.length, 0)} text lines, ${formData.sections.reduce((s, sec) => s + sec.tables.length, 0)} tables`);
  }
  
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nSaved to ${OUTPUT}`);
})();
