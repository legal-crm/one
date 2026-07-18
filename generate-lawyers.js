const fs = require('fs');

const regions = [
  { region: '서울', court: '서울회생법원', bar: '서울지방변호사회' },
  { region: '경기', court: '수원지방법원', bar: '경기중앙지방변호사회' },
  { region: '강원', court: '춘천지방법원', bar: '강원지방변호사회' },
  { region: '제주', court: '제주지방법원', bar: '제주지방변호사회' },
  { region: '인천', court: '인천지방법원', bar: '인천지방변호사회' },
  { region: '대구', court: '대구지방법원', bar: '대구지방변호사회' },
  { region: '충북', court: '청주지방법원', bar: '충북지방변호사회' },
  { region: '대전', court: '대전지방법원', bar: '대전지방변호사회' },
  { region: '전북', court: '전주지방법원', bar: '전북지방변호사회' },
  { region: '부산', court: '부산지방법원', bar: '부산지방변호사회' },
  { region: '광주', court: '광주지방법원', bar: '광주지방변호사회' },
];

const firstNames = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준우', '서연', '서윤', '지우', '서현', '하은', '하윤', '민서', '지유', '윤서', '지민', '채원', '수아', '지아', '다은', '예은', '수빈', '지윤', '은지', '민지', '예진', '수진', '유진', '재현', '동현', '성민', '준호', '민우', '현우', '승현', '정훈', '성현', '진우', '태윤', '승우', '승민', '정민', '진호', '민수', '영수', '영철', '영호', '동철', '동수', '동호', '상철', '상수', '상호', '명수', '명철', '명호', '경수', '경철', '경호'];
const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '유', '고', '문', '양', '손', '배', '조', '백', '허', '유', '남', '심', '노', '정', '하', '곽', '성', '차', '주', '우', '구', '신', '임', '나', '전', '민', '유', '진', '지', '엄', '채', '원', '천', '방', '공', '강', '현', '함', '변', '염', '양', '변', '여', '추', '노', '도', '소', '신', '석', '선', '설', '마', '길', '주', '연', '방', '위', '표', '명', '기', '반', '왕', '금', '옥', '육', '인', '맹', '제', '모', '장', '남', '탁', '국', '여', '진', '어', '은', '편', '구', '용'];

const fieldsPool = ['개인회생', '개인파산', '신용회복', '도산법전문', '보정명령대응', '채무조정', '급여압류해제', '전세사기피해', '사업자회생', '프리랜서회생', '고액채무', '소액회생', '면책심리'];
const unis = ['서울대학교', '고려대학교', '연세대학교', '성균관대학교', '한양대학교', '이화여자대학교', '서강대학교', '중앙대학교', '경희대학교', '한국외국어대학교', '서울시립대학교', '부산대학교', '경북대학교', '전남대학교', '충남대학교'];

const generatedNames = new Set();
function generateName() {
  let name = '';
  do {
    name = lastNames[Math.floor(Math.random() * lastNames.length)] + firstNames[Math.floor(Math.random() * firstNames.length)];
  } while (generatedNames.has(name));
  generatedNames.add(name);
  return name;
}

const lawyers = [];
let lawyerId = 1;

for (const r of regions) {
  for (let i = 0; i < 10; i++) {
    const name = generateName() + ' 변호사';
    const fields = [];
    while (fields.length < 3) {
      const f = fieldsPool[Math.floor(Math.random() * fieldsPool.length)];
      if (!fields.includes(f)) fields.push(f);
    }
    const specialties = [];
    while (specialties.length < 3) {
      const f = fieldsPool[Math.floor(Math.random() * fieldsPool.length)];
      if (!specialties.includes(f)) specialties.push(f);
    }
    
    const uni = unis[Math.floor(Math.random() * unis.length)];
    const year = 2010 + Math.floor(Math.random() * 14);
    const examNum = year - 2011;
    
    const avatarNum = Math.floor(Math.random() * 100) + 1; // dummy seed
    
    lawyers.push({
      id: \`free-lawyer-\${lawyerId++}\`,
      lawFirmId: \`firm-\${Math.floor(Math.random() * 3) + 1}\`,
      teamId: \`team-\${Math.floor(Math.random() * 3) + 1}\`,
      name: name,
      role: 'LAWYER',
      fields: fields,
      region: r.region,
      avatar: \`https://i.pravatar.cc/256?u=free\${lawyerId}\`, // Using pravatar for consistent unique avatars
      bio: \`\${r.region} 지역에서 다수의 \${fields[0]}, \${fields[1]} 사건을 성공적으로 이끌었습니다.\`,
      recentActivity: '최근 사건 보정명령 3일 내 완벽 대응',
      matchedCount: Math.floor(Math.random() * 51) + 10,
      catchphrase: '의뢰인의 새 출발을 위한 든든한 파트너',
      career: [\`前 \${r.bar} 소속 국선변호인\`, '현 대한변호사협회 등록 도산전문변호사'],
      education: \`\${uni} 법학전문대학원 졸업\`,
      certYear: \`제\${examNum}회 변호사시험 합격 (\${year}년)\`,
      barAssociation: r.bar,
      specialties: specialties,
      successRate: Math.floor(Math.random() * 10) + 88,
      totalCases: Math.floor(Math.random() * 171) + 80,
      avgRepaymentRate: Math.floor(Math.random() * 16) + 25,
      courtJurisdiction: r.court
    });
  }
}

const filePath = 'c:/Users/JSH/Downloads/legal-crm---회생파산-상담-플랫폼/src/data.ts';
let content = fs.readFileSync(filePath, 'utf8');

const strToAppend = ',\n' + lawyers.map(l => '  ' + JSON.stringify(l, null, 2).replace(/\n/g, '\n  ')).join(',\n');

content = content.replace(/  \}\n\];/g, '  }' + strToAppend + '\n];');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Lawyers added successfully.');
