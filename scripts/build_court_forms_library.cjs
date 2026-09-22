/**
 * HWPX → HTML 변환 빌드 스크립트
 * 법원양식/ 폴더의 모든 HWPX 파일을 파싱하여 편집 가능한 HTML 구조로 변환 후 JSON으로 저장
 * 
 * 출력: public/court-forms-library.json
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const FORMS_DIR = path.join(__dirname, '..', '법원양식');
const OUTPUT = path.join(__dirname, '..', 'public', 'court-forms-library.json');

// 제외 문서 (참고용, 편집 불필요)
const EXCLUDE_FILES = [
  '간이양식에 의한 개인회생절차 신청서류 작성요령',
  '파산 및 면책 동시신청 안내문(2020.1.20.시행)',
  '변제계획안의 작성요령',
];

// 카테고리 분류
function categorize(fileName) {
  if (fileName.includes('파산') || fileName.includes('D41') || fileName.includes('D45')) return '파산';
  if (fileName.includes('면책') || fileName.includes('면제') || fileName.includes('복권')) return '면책';
  if (fileName.includes('간이')) return '간이양식';
  if (fileName.includes('채권자') || fileName.includes('D512') || fileName.includes('D513')) return '채권자관련';
  if (fileName.includes('변제계획') || fileName.includes('D511') || fileName.includes('D512')) return '변제계획';
  if (fileName.includes('신청서') || fileName.includes('D510')) return '개인회생신청';
  if (fileName.includes('진술서') || fileName.includes('재산') || fileName.includes('수입')) return '개인회생신청';
  if (fileName.includes('금지') || fileName.includes('중지')) return '보전처분';
  return '기타';
}

// D코드 추출
function extractDCode(fileName) {
  const match = fileName.match(/\(?(D\d{4})\)?/);
  return match ? match[1] : null;
}

// HWPX XML → HTML 변환
function xmlToHtml(xml) {
  let html = '';
  
  // 테이블 변환
  const processedXml = xml;
  
  // 단락 텍스트 추출 (테이블 외부)
  const paragraphs = [];
  
  // <hp:p> 단락 단위 처리
  const pRegex = /<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/g;
  let pMatch;
  let insideTable = false;
  let tableHtml = '';
  let tableRows = [];
  
  // 간단한 접근: 텍스트와 테이블 추출
  const textLines = (xml.match(/<hp:t>([^<]*)<\/hp:t>/g) || [])
    .map(m => m.replace(/<\/?hp:t>/g, '').trim())
    .filter(t => t);
  
  // 테이블 구조 추출
  const tables = [];
  const tableParts = xml.split(/<hp:tbl /);
  tableParts.shift();
  
  tableParts.forEach((tblXml) => {
    const tblEnd = tblXml.indexOf('</hp:tbl>');
    if (tblEnd === -1) return;
    const tblContent = tblXml.substring(0, tblEnd);
    
    const rows = [];
    const rowParts = tblContent.split(/<hp:tr>/);
    rowParts.shift();
    
    rowParts.forEach((rowXml) => {
      const cells = [];
      const cellParts = rowXml.split(/<hp:tc>/);
      cellParts.shift();
      
      cellParts.forEach((cellXml) => {
        const cellTexts = (cellXml.match(/<hp:t>([^<]*)<\/hp:t>/g) || [])
          .map(m => m.replace(/<\/?hp:t>/g, '').trim())
          .filter(t => t);
        
        // colSpan 추출
        const colSpanMatch = cellXml.match(/colSpan="(\d+)"/);
        const colSpan = colSpanMatch ? parseInt(colSpanMatch[1]) : 1;
        
        // rowSpan 추출  
        const rowSpanMatch = cellXml.match(/rowSpan="(\d+)"/);
        const rowSpan = rowSpanMatch ? parseInt(rowSpanMatch[1]) : 1;
        
        cells.push({
          text: cellTexts.join('\n'),
          colSpan,
          rowSpan,
        });
      });
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    });
    
    if (rows.length > 0) {
      tables.push(rows);
    }
  });
  
  // HTML 생성
  let tableIndex = 0;
  let textIndex = 0;
  
  // 간단한 순차적 렌더링: 텍스트 블록 사이에 테이블 삽입
  // 실제 위치는 XML 순서로 결정
  
  // 모든 요소를 순서대로 추출
  const elements = [];
  
  // XML에서 <hp:p>와 <hp:tbl> 순서 파악
  const allElements = xml.match(/<hp:(?:p\b|tbl\b)[^>]*>/g) || [];
  let tblIdx = 0;
  let currentTexts = [];
  
  // 텍스트를 라인별로 분배
  for (const el of allElements) {
    if (el.startsWith('<hp:tbl')) {
      // 현재까지의 텍스트를 단락으로 추가
      if (currentTexts.length > 0) {
        elements.push({ type: 'text', lines: [...currentTexts] });
        currentTexts = [];
      }
      if (tblIdx < tables.length) {
        elements.push({ type: 'table', data: tables[tblIdx] });
        tblIdx++;
      }
    }
  }
  
  // 나머지 텍스트
  // 텍스트 라인을 테이블에 속하지 않는 것만 필터링
  const tableTexts = new Set();
  tables.forEach(tbl => {
    tbl.forEach(row => {
      row.forEach(cell => {
        cell.text.split('\n').forEach(t => tableTexts.add(t));
      });
    });
  });
  
  const nonTableTexts = textLines.filter(t => !tableTexts.has(t));
  
  // HTML 구성
  // 제목 (첫 번째 텍스트 중 짧은 것)
  let titleFound = false;
  
  for (const text of nonTableTexts) {
    if (!titleFound && text.length < 30 && !text.startsWith('[') && !text.startsWith('※')) {
      html += `<h2 class="text-center text-[20px] font-bold mb-4 tracking-widest">${escapeHtml(text)}</h2>\n`;
      titleFound = true;
    } else if (text.startsWith('[신청서') || text.startsWith('[별지') || text.startsWith('[전산양식')) {
      html += `<div class="text-left text-[14px] mb-2">${escapeHtml(text)}</div>\n`;
    } else if (text.startsWith('※')) {
      html += `<div class="text-[12px] text-gray-700 mt-1">${escapeHtml(text)}</div>\n`;
    } else if (/^[IⅠⅡⅢⅣⅤⅥVᅵ]+\.\s|^\d+\.\s/.test(text)) {
      html += `<div class="font-bold mt-4 mb-2">${escapeHtml(text)}</div>\n`;
    } else {
      html += `<p class="mb-1">${escapeHtml(text)}</p>\n`;
    }
  }
  
  // 테이블 HTML
  for (const table of tables) {
    html += '<table class="w-full border-collapse border border-black text-[14px] my-4">\n<tbody>\n';
    for (const row of table) {
      html += '<tr>\n';
      for (const cell of row) {
        const attrs = [];
        if (cell.colSpan > 1) attrs.push(`colSpan="${cell.colSpan}"`);
        if (cell.rowSpan > 1) attrs.push(`rowSpan="${cell.rowSpan}"`);
        
        const isHeader = cell.text.length < 15 && !cell.text.includes('원') && !/\d{3,}/.test(cell.text);
        const cls = isHeader ? 'border border-black p-2 bg-gray-50 font-semibold text-center' : 'border border-black p-2';
        
        const content = cell.text
          ? cell.text.split('\n').map(line => {
              if (line.includes('□') || line.includes('☑') || line.includes('☐')) {
                return `<span class="whitespace-pre">${escapeHtml(line)}</span>`;
              }
              return escapeHtml(line);
            }).join('<br/>')
          : '<span class="text-gray-300 editable-field" contenteditable="true">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>';
        
        html += `  <td class="${cls}" ${attrs.join(' ')}>${content}</td>\n`;
      }
      html += '</tr>\n';
    }
    html += '</tbody>\n</table>\n';
  }
  
  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function processHwpxFile(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  
  const sections = [];
  const sectionFiles = Object.keys(zip.files)
    .filter(n => n.startsWith('Contents/section') && n.endsWith('.xml'))
    .sort();
  
  for (const secPath of sectionFiles) {
    const xml = await zip.file(secPath).async('string');
    const html = xmlToHtml(xml);
    sections.push(html);
  }
  
  return sections.join('\n<div style="page-break-after: always;"></div>\n');
}

(async () => {
  const hwpxFiles = fs.readdirSync(FORMS_DIR)
    .filter(f => f.endsWith('.hwpx'))
    .filter(f => !EXCLUDE_FILES.some(ex => f.includes(ex)))
    .sort();
  
  console.log(`Found ${hwpxFiles.length} HWPX files (excluding ${EXCLUDE_FILES.length} reference docs)`);
  
  const library = [];
  
  for (const file of hwpxFiles) {
    const filePath = path.join(FORMS_DIR, file);
    const name = file.replace('.hwpx', '');
    const dCode = extractDCode(name);
    const category = categorize(name);
    
    try {
      const html = await processHwpxFile(filePath);
      library.push({
        id: dCode || name.substring(0, 20),
        name,
        dCode,
        category,
        fileName: file,
        html,
      });
      console.log(`  ✅ ${dCode || '--'} ${name.substring(0, 40)}`);
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`);
    }
  }
  
  // 카테고리별 정렬
  library.sort((a, b) => {
    const catOrder = ['개인회생신청', '채권자관련', '변제계획', '보전처분', '간이양식', '면책', '파산', '기타'];
    const aCat = catOrder.indexOf(a.category);
    const bCat = catOrder.indexOf(b.category);
    if (aCat !== bCat) return aCat - bCat;
    return a.name.localeCompare(b.name, 'ko');
  });
  
  fs.writeFileSync(OUTPUT, JSON.stringify(library, null, 2), 'utf8');
  
  // 통계
  const categories = {};
  library.forEach(f => { categories[f.category] = (categories[f.category] || 0) + 1; });
  
  console.log(`\n=== 변환 완료: ${library.length}종 ===`);
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}종`);
  });
  console.log(`\n저장: ${OUTPUT}`);
})();
