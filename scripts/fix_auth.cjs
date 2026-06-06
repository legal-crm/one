const fs = require('fs');
const f = 'src/components/ClientRole.tsx';
const lines = fs.readFileSync(f, 'utf8').split('\n');

// 1. Add imports for RemedyModal and NewsDetailModal
const mobileGNBImport = lines.findIndex(l => l.includes("import MobileGNB from"));
if (mobileGNBImport >= 0) {
  lines.splice(mobileGNBImport + 1, 0,
    "import RemedyModal from './client/RemedyModal';",
    "import NewsDetailModal from './client/NewsDetailModal';"
  );
}

// Re-find lines after import insertion
const remedyStart = lines.findIndex(l => l.includes('8대 채무 맞춤 솔루션 모달'));
const newsStart = lines.findIndex(l => l.includes('9. Global Legal News Detail Modal'));

// Find block ends using brace counting
function findBlockEnd(startIdx) {
  let depth = 0, started = false;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{' || ch === '(') { depth++; started = true; }
      if (ch === '}' || ch === ')') depth--;
    }
    if (started && depth <= 0) return i;
  }
  return -1;
}

// Replace NewsDetailModal first (it's after RemedyModal, so replace bottom-up)
if (newsStart >= 0) {
  const newsEnd = findBlockEnd(newsStart + 1); // +1 because the {selectedArticle && starts on next line
  const newsRep = [
    '      {selectedArticle && (<NewsDetailModal article={selectedArticle} lawyers={lawyers} onClose={() => setSelectedArticle(null)} onConsultWithLawyer={(lawyerId, lawyerName, articleTitle) => { setRequestType(\'direct\'); setSelectedLawyerId(lawyerId); setIncome(230); setDebtTotal(6500); setTitle(`[법률칼럼 지정상담] ${lawyerName}`); setContent(`안녕하세요, ${lawyerName} 변호사님이 집필하신 법률 칼럼 [${articleTitle}]을 깊이 감명 깊게 정독하고 상담을 접수합니다.\\n\\n칼럼에 실린 법률 가이드 내용에 의거하여, 저의 소득과 채무 상황에서 최우선적인 압류 방어 대책 및 개인회생 금지명령 개시 가능성을 1:1로 직접 정밀 진단받고 싶습니다.`); setRequestStep(2); setActiveTab(\'request\'); setSelectedArticle(null); window.scrollTo({ top: 0, behavior: \'smooth\' }); }} />)}'
  ];
  lines.splice(newsStart, newsEnd - newsStart + 1, ...newsRep);
  console.log('NewsDetail:', newsStart+1, '-', newsEnd+1, '(' + (newsEnd - newsStart + 1) + ' lines)');
}

// Replace RemedyModal (find again after news replacement)
const remedyStart2 = lines.findIndex(l => l.includes('8대 채무 맞춤 솔루션 모달'));
if (remedyStart2 >= 0) {
  const remedyEnd = findBlockEnd(remedyStart2 + 1);
  const remedyRep = [
    '      {activeRemedyCategory && remedyData[activeRemedyCategory] && (<RemedyModal activeRemedyCategory={activeRemedyCategory} remedyData={remedyData} renderRemedyIcon={renderRemedyIcon} onClose={() => setActiveRemedyCategory(null)} onApply={handleApplyRemedy} />)}'
  ];
  lines.splice(remedyStart2, remedyEnd - remedyStart2 + 1, ...remedyRep);
  console.log('RemedyModal:', remedyStart2+1, '-', remedyEnd+1, '(' + (remedyEnd - remedyStart2 + 1) + ' lines)');
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Done. Lines:', lines.length);
