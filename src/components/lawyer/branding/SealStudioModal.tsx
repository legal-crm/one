import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Upload, Check, Stamp, Image as ImageIcon,
  Trash2, Sparkles, Download, RefreshCw, Sliders, Palette, PenTool,
  Type, CheckCircle2, RotateCcw, ArrowRight, Layers, FileSignature, Eye,
  Building2, UserCheck, Star, Circle
} from 'lucide-react';
import { toast } from 'sonner';
import type { LawyerSealInfo } from '../../../types';
import ModalPortal from '../../common/ModalPortal';

interface SealStudioProps {
  isOpen?: boolean;
  onClose?: () => void;
  lawyerId: string;
  lawyerName: string;
  firmName?: string;
  initialSealInfo?: LawyerSealInfo;
  onSaveSealInfo: (newInfo: LawyerSealInfo) => void;
  isInline?: boolean;
}

type StudioTab = 'personal' | 'corporate' | 'background-remover' | 'signature' | 'settings';

// 한글 ➔ 법률 및 주요 인장 한자 자동 변환 사전
const HANJA_MAP: Record<string, string> = {
  '대표이사': '代表理事',
  '대표변호사': '代表辯護士',
  '변호사': '辯護士',
  '법무법인': '法務法人',
  '법률사무소': '法律事務所',
  '주식회사': '株式會社',
  '지배인': '支配人',
  '대표': '代表',
  '이사': '理事',
  '감사': '監事',
  '직인': '職印',
  '인장': '印章',
  '인': '印',
  '의인': '之印',
  // 주요 한국 성씨
  '김': '金', '이': '李', '박': '朴', '정': '鄭', '최': '崔',
  '조': '趙', '강': '姜', '윤': '尹', '장': '張', '임': '林',
  '한': '韓', '신': '申', '오': '吳', '서': '徐', '권': '權',
  '황': '黃', '안': '安', '송': '宋', '류': '柳', '전': '全',
  '홍': '洪', '고': '高', '문': '文', '양': '梁', '손': '孫',
  '배': '裵', '백': '白', '허': '許', '유': '劉', '남': '南',
  '심': '沈', '노': '盧', '하': '河', '곽': '郭', '성': '成',
  '차': '車', '주': '朱', '우': '禹', '구': '具', '라': '羅',
  '민': '閔', '진': '陳', '지': '池', '엄': '嚴', '채': '蔡',
  '원': '元', '천': '千', '방': '方', '공': '孔', '현': '玄',
  '변': '卞', '염': '廉', '길': '吉', '동': '東', '무': '武',
};

function convertToHanja(text: string): string {
  let res = text;
  const multiKeys = Object.keys(HANJA_MAP).sort((a, b) => b.length - a.length);
  for (const k of multiKeys) {
    if (res.includes(k)) {
      res = res.replaceAll(k, HANJA_MAP[k]);
    }
  }
  return res.split('').map(ch => HANJA_MAP[ch] || ch).join('');
}

// 인주 색상 프리셋
const INK_COLORS = [
  { name: '정통 인주 레드', hex: '#DC2626', bg: 'bg-red-600' },
  { name: '선명한 다홍 레드', hex: '#EF4444', bg: 'bg-red-500' },
  { name: '근엄한 심홍 버건디', hex: '#991B1B', bg: 'bg-red-800' },
  { name: '인주 블랙/차콜', hex: '#1E293B', bg: 'bg-slate-800' },
];

// 일반 도장 8대 프리셋 메타데이터
const PERSONAL_PRESETS = [
  { id: 0, name: '슬림 타원 성씨', desc: '해서 붓글씨 (성 1자)' },
  { id: 1, name: '타원 전서체', desc: '고전 인장 전각체 (3자)' },
  { id: 2, name: '타원 궁서체', desc: '유려한 정통 붓글씨 (3자)' },
  { id: 3, name: '원형 4자 전각체', desc: '정통 2x2 인장체 (추천)' },
  { id: 4, name: '정사각 고딕 직인', desc: '현대 볼드 2x2 직인' },
  { id: 5, name: '정사각 6자 직인', desc: '2열 3행 법률 표준' },
  { id: 6, name: '세로 직사각 직인', desc: '2열 다자 명조 직인' },
  { id: 7, name: '정사각 전각 인장', desc: '여백 꽉 찬 정통 전서' },
];

// 법인 도장 8대 프리셋 메타데이터
const CORPORATE_PRESETS = [
  { id: 0, name: '한글 볼드 고딕 (★)', desc: '시인성 뛰어난 현대 인감' },
  { id: 1, name: '한글 정통 전서체 (●)', desc: '고전 전각 원형 인감' },
  { id: 2, name: '한글 외경 + 한자 직함 (★)', desc: '내경 代表辯護士/代表理事' },
  { id: 3, name: '전서체 외경 + 한자 직함 (★)', desc: '전통 인장 전각 조합' },
  { id: 4, name: '한글 궁서 붓글씨 (●)', desc: '정통 법원 서식 스타일' },
  { id: 5, name: '정통 한자 법인인감 (★)', desc: '외경·내경 전체 한자 인장' },
  { id: 6, name: '이중 테두리 클래식 (★)', desc: '외곽 이중선 격식 인감' },
  { id: 7, name: '볼드 중후 인감 (●)', desc: '선 굵고 묵직한 대표 직인' },
];

export default function SealStudioModal({
  isOpen = true,
  onClose,
  lawyerId,
  lawyerName,
  firmName = '법무법인',
  initialSealInfo,
  onSaveSealInfo,
  isInline = false,
}: SealStudioProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>('personal');

  // 인주 색상 & 질감 공통
  const [inkColor, setInkColor] = useState<string>('#DC2626');
  const [inkTexture, setInkTexture] = useState<boolean>(true);

  // 1. 일반 도장 상태
  const [personalText, setPersonalText] = useState<string>(lawyerName || '홍길동');
  const [personalLang, setPersonalLang] = useState<'ko' | 'hanja'>('ko');
  const [selectedPersonalCard, setSelectedPersonalCard] = useState<number>(3); // 4자 원형 기본 선택
  const [personalDataUrls, setPersonalDataUrls] = useState<string[]>([]);

  // 2. 법인 도장 상태 (기본 상호명을 로펌 풀네임으로 매핑하여 모두사인과 동일한 7~8자 최적 둘레 제공)
  const [corpOuterText, setCorpOuterText] = useState<string>(() => {
    if (firmName && firmName !== '법무법인' && firmName.length > 3) return firmName;
    if (lawyerName) return `법무법인 ${lawyerName}`;
    return '법무법인 정의';
  });
  const [corpInnerText, setCorpInnerText] = useState<string>('대표변호사');
  const [corpSymbol, setCorpSymbol] = useState<'★' | '●'>('★');
  const [corpLang, setCorpLang] = useState<'ko' | 'hanja'>('ko');
  const [selectedCorpCard, setSelectedCorpCard] = useState<number>(0);
  const [corpDataUrls, setCorpDataUrls] = useState<string[]>([]);

  // 3. 사진/로고 누끼따기 상태
  const [uploadedRawImg, setUploadedRawImg] = useState<string | null>(null);
  const [rawImgType, setRawImgType] = useState<'seal' | 'logo'>('seal');
  const [threshold, setThreshold] = useState<number>(200);
  const [redSensitivity, setRedSensitivity] = useState<number>(28);
  const [colorEnhance, setColorEnhance] = useState<boolean>(true);
  const rawCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. 자필 서명 상태
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signPenColor, setSignPenColor] = useState<string>('#1E293B');
  const [signPenWidth, setSignPenWidth] = useState<number>(4);
  const [hasSignature, setHasSignature] = useState(false);

  // 종합 설정 상태
  const [sealInfo, setSealInfo] = useState<LawyerSealInfo>(() => {
    if (initialSealInfo) return initialSealInfo;
    try {
      const saved = localStorage.getItem(`legal_crm_lawyer_seal_${lawyerId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      autoSealContract: true,
      autoSealPetition: true,
      autoSealCorrection: true,
    };
  });

  // =============================================================
  // CANVAS 렌더링 엔진: 1. 일반 도장 (8종 디자인) - 모두사인 실물 규격 1:1 동기화
  // =============================================================
  const renderPersonalSealOnCanvas = useCallback((
    canvas: HTMLCanvasElement,
    designIdx: number,
    rawName: string,
    lang: 'ko' | 'hanja',
    color: string,
    texture: boolean
  ) => {
    const size = 500;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    const center = size / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let clean = rawName.replace(/\s+/g, '').trim() || '홍길동';
    if (lang === 'hanja') {
      clean = convertToHanja(clean);
    }

    if (designIdx === 0) {
      // 0. 슬림 세로 타원형 성씨 인장 (성 1자, 해서/궁서 붓글씨 - 모두사인 실물 규격)
      const rX = 72;
      const rY = 162;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.ellipse(center, center, rX, rY, 0, 0, Math.PI * 2);
      ctx.stroke();

      const char = clean[0] || '홍';
      ctx.font = 'bold 155px "Gungsuh", "GungsuhChe", "Batang", serif';
      ctx.fillText(char, center, center);

    } else if (designIdx === 1) {
      // 1. 세로 타원형 3글자 전서체 (고전 전각체 - 3글자가 타원을 단정하게 채움)
      const rX = 76;
      const rY = 166;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.ellipse(center, center, rX, rY, 0, 0, Math.PI * 2);
      ctx.stroke();

      const chars = clean.slice(0, 3).split('');
      ctx.font = '900 76px "Nanum Myeongjo", "Batang", "BatangChe", serif';
      const gap = 94;
      const startY = center - ((chars.length - 1) * gap) / 2;
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], center, startY + i * gap);
      }

    } else if (designIdx === 2) {
      // 2. 세로 타원형 3글자 궁서체 (유려한 정통 붓글씨)
      const rX = 76;
      const rY = 166;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.ellipse(center, center, rX, rY, 0, 0, Math.PI * 2);
      ctx.stroke();

      const chars = clean.slice(0, 3).split('');
      ctx.font = 'bold 78px "Gungsuh", "GungsuhChe", serif';
      const gap = 94;
      const startY = center - ((chars.length - 1) * gap) / 2;
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], center, startY + i * gap);
      }

    } else if (designIdx === 3) {
      // 3. 정통 원형 4글자 전각체 인장 (반경 178px, 102px 전각 폰트로 단정하게 채움)
      const radius = 178;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 4글자로 맞춤 (3자면 '인' 또는 '印' 추가)
      let fourText = clean;
      if (fourText.length === 3) {
        fourText += (lang === 'hanja' ? '印' : '인');
      } else if (fourText.length === 2) {
        fourText += (lang === 'hanja' ? '之印' : '의인');
      }
      const c = fourText.split('');

      // 전통 인장 순서: 우상(0), 우하(1), 좌상(2), 좌하(3)
      const offset = 72;
      ctx.font = '900 102px "Nanum Myeongjo", "Batang", "Gungsuh", serif';
      ctx.fillText(c[0] || '', center + offset, center - offset); // 우상
      ctx.fillText(c[1] || '', center + offset, center + offset); // 우하
      ctx.fillText(c[2] || '', center - offset, center - offset); // 좌상
      ctx.fillText(c[3] || '', center - offset, center + offset); // 좌하

    } else if (designIdx === 4) {
      // 4. 정사각형 4글자 볼드 고딕 직인 (340px 정사각형, 선 두께 14px, 108px 볼드 고딕)
      const bSize = 340;
      const bx = center - bSize / 2;
      const by = center - bSize / 2;
      ctx.lineWidth = 14;
      ctx.strokeRect(bx, by, bSize, bSize);

      let fourText = clean;
      if (fourText.length === 3) fourText += (lang === 'hanja' ? '印' : '인');
      else if (fourText.length === 2) fourText += (lang === 'hanja' ? '之印' : '직인');
      const c = fourText.split('');

      // 현대 순서: 좌상, 우상, 좌하, 우하
      const offset = 76;
      ctx.font = '900 108px "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      ctx.fillText(c[0] || '', center - offset, center - offset);
      ctx.fillText(c[1] || '', center + offset, center - offset);
      ctx.fillText(c[2] || '', center - offset, center + offset);
      ctx.fillText(c[3] || '', center + offset, center + offset);

    } else if (designIdx === 5) {
      // 5. 정사각형 6글자 직인 (2열 3행 궁서체 - 모두사인 실물 규격)
      const bSize = 340;
      const bx = center - bSize / 2;
      const by = center - bSize / 2;
      ctx.lineWidth = 14;
      ctx.strokeRect(bx, by, bSize, bSize);

      let sixText = clean;
      if (sixText.length < 6) {
        sixText = (lang === 'hanja' ? '辯護士' : '변호사') + clean;
      }
      const c = sixText.split('');

      ctx.font = 'bold 76px "Gungsuh", "Batang", serif';
      const colX1 = center + 75; // 우측열
      const colX2 = center - 75; // 좌측열
      const yStep = 96;

      // 우측열: 0, 1, 2
      ctx.fillText(c[0] || '', colX1, center - yStep);
      ctx.fillText(c[1] || '', colX1, center);
      ctx.fillText(c[2] || '', colX1, center + yStep);

      // 좌측열: 3, 4, 5
      ctx.fillText(c[3] || '', colX2, center - yStep);
      ctx.fillText(c[4] || '', colX2, center);
      ctx.fillText(c[5] || '', colX2, center + yStep);

    } else if (designIdx === 6) {
      // 6. 세로 직사각형 2열 다자 직인 (폭 280px, 높이 350px 명조 직인)
      const w = 280;
      const h = 350;
      const bx = center - w / 2;
      const by = center - h / 2;
      ctx.lineWidth = 14;
      ctx.strokeRect(bx, by, w, h);

      let multiText = clean;
      if (multiText.length < 6) {
        multiText = (lang === 'hanja' ? '法律事務所' : '법률사무소') + clean;
      }
      const half = Math.ceil(multiText.length / 2);
      const rightCol = multiText.slice(0, half).split('');
      const leftCol = multiText.slice(half).split('');

      const maxLen = Math.max(rightCol.length, leftCol.length);
      const fontSize = Math.min(68, Math.floor((h * 0.80) / maxLen));
      ctx.font = `900 ${fontSize}px "Nanum Myeongjo", "Batang", serif`;

      const gapR = (h * 0.74) / Math.max(1, rightCol.length - 1);
      const startYR = center - ((rightCol.length - 1) * gapR) / 2;
      for (let i = 0; i < rightCol.length; i++) {
        ctx.fillText(rightCol[i], center + 60, startYR + i * gapR);
      }

      const gapL = (h * 0.74) / Math.max(1, leftCol.length - 1);
      const startYL = center - ((leftCol.length - 1) * gapL) / 2;
      for (let i = 0; i < leftCol.length; i++) {
        ctx.fillText(leftCol[i], center - 60, startYL + i * gapL);
      }

    } else if (designIdx === 7) {
      // 7. 정사각형 꽉 찬 전각 인장 (고전 전서체 - 석각 전각 인장)
      const bSize = 340;
      const bx = center - bSize / 2;
      const by = center - bSize / 2;
      ctx.lineWidth = 16;
      ctx.strokeRect(bx, by, bSize, bSize);

      let fourText = clean;
      if (fourText.length === 3) fourText += (lang === 'hanja' ? '印' : '인');
      else if (fourText.length === 2) fourText += (lang === 'hanja' ? '之印' : '인장');
      const c = fourText.split('');

      // 고전 전각 배치 (우상, 우하, 좌상, 좌하)
      const offset = 72;
      ctx.font = '900 106px "Nanum Myeongjo", "Batang", serif';
      ctx.fillText(c[0] || '', center + offset, center - offset);
      ctx.fillText(c[1] || '', center + offset, center + offset);
      ctx.fillText(c[2] || '', center - offset, center - offset);
      ctx.fillText(c[3] || '', center - offset, center + offset);
    }

    // 인주 질감 효과
    if (texture) {
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 40) {
          const rand = Math.random();
          if (rand < 0.05) {
            data[i + 3] = Math.max(0, data[i + 3] - 90);
          } else if (rand > 0.96) {
            data[i] = Math.min(255, data[i] + 15);
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    ctx.restore();
  }, []);

  // =============================================================
  // CANVAS 렌더링 엔진: 2. 법인 도장 (8종 디자인) - 모두사인 실물 규격 1:1 일치
  // =============================================================
  const renderCorporateSealOnCanvas = useCallback((
    canvas: HTMLCanvasElement,
    designIdx: number,
    outerTextRaw: string,
    innerTextRaw: string,
    symbol: '★' | '●',
    lang: 'ko' | 'hanja',
    color: string,
    texture: boolean
  ) => {
    const size = 500;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    const center = size / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    // 디자인별 속성 매핑
    const isDouble = designIdx === 6;
    const isHeavy = designIdx === 7;
    const isSymbolDot = designIdx === 1 || designIdx === 4 || designIdx === 7 || symbol === '●';
    const finalSymbol = isSymbolDot ? '●' : '★';

    // 서체 분기
    let fontFamily = '"Pretendard", "Apple SD Gothic Neo", sans-serif';
    let fontWeight = '900';
    if (designIdx === 1 || designIdx === 3) {
      fontFamily = '"Nanum Myeongjo", "Batang", serif';
      fontWeight = '900';
    } else if (designIdx === 4) {
      fontFamily = '"Gungsuh", "GungsuhChe", serif';
      fontWeight = 'bold';
    } else if (designIdx === 6) {
      fontFamily = '"Nanum Myeongjo", serif';
      fontWeight = '900';
    }

    // 텍스트 한글/한자 변환
    let outerStr = outerTextRaw.replace(/\s+/g, '').trim() || '법무법인정의';
    let innerStr = innerTextRaw.replace(/\s+/g, '').trim() || '대표변호사';

    // 외경 상호명이 4자 이하(예: '법무법인', '정의')인 경우 한국 공인 인장 관례상 '의인'/'之印' 자동 보정하여 둘레 완성
    if (outerStr.length <= 4 && !outerStr.endsWith('인')) {
      outerStr += (lang === 'hanja' || designIdx === 5 ? '之印' : '의인');
    }

    if (designIdx === 2 || designIdx === 3) {
      // 내경만 한자
      innerStr = convertToHanja(innerStr);
    } else if (designIdx === 5 || lang === 'hanja') {
      // 전체 한자
      outerStr = convertToHanja(outerStr);
      innerStr = convertToHanja(innerStr);
    }

    // 1. 외곽 원 테두리 (outerR = 205px, 지름 410px로 모두사인과 동일한 82% 캔버스 비율)
    const outerR = 205;
    ctx.lineWidth = isHeavy ? 16 : (isDouble ? 11 : 12);
    ctx.beginPath();
    ctx.arc(center, center, outerR, 0, Math.PI * 2);
    ctx.stroke();

    if (isDouble) {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(center, center, outerR - 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. 내경 원 테두리 (innerR = 112px, 지름 224px - 모두사인과 1:1 트랙 비율)
    const innerR = 112;
    ctx.lineWidth = isHeavy ? 9 : 6;
    ctx.beginPath();
    ctx.arc(center, center, innerR, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 외경과 내경 사이의 중심 궤도 (트랙 너비 93px의 정중앙)
    const orbitR = (outerR + innerR) / 2; // ~158.5px

    // 4. 12시 방향 구분 기호 (★ 또는 ●)
    ctx.font = `${isHeavy ? 'bold 32px' : 'bold 28px'} sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-Math.PI / 2); // 12시
    ctx.fillText(finalSymbol, orbitR, 0);
    ctx.restore();

    // 5. 외경 시계방향 원형 호(Arc) 텍스트 렌더링 (모두사인과 동일하게 44~46px의 유려한 크기)
    const chars = outerStr.split('');
    const n = chars.length;
    if (n > 0) {
      const arcFont = Math.min(46, Math.max(30, Math.floor(660 / (n * 1.05))));
      ctx.font = `${fontWeight} ${arcFont}px ${fontFamily}`;

      // 1시 부근(-π/2 + 0.38)에서 출발하여 시계방향으로 11시 부근(3π/2 - 0.38)까지 균등 회전
      const startAngle = -Math.PI / 2 + 0.38;
      const endAngle = 3 * Math.PI / 2 - 0.38;
      const sweep = endAngle - startAngle;
      const step = sweep / n;

      for (let i = 0; i < n; i++) {
        const angle = startAngle + (i + 0.5) * step;
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillText(chars[i], 0, -orbitR);
        ctx.restore();
      }
    }

    // 6. 내경 중앙 직함 텍스트 (모두사인과 완벽히 동일한 여백 배분 및 가독성)
    let row1 = '';
    let row2 = '';
    let fSize1 = 64;
    let fSize2 = 64;
    let rowOffset = 32;

    if (innerStr.length <= 2) {
      row1 = innerStr[0] || '';
      row2 = innerStr[1] || '';
      fSize1 = 76;
      fSize2 = 76;
      rowOffset = 38;
    } else if (innerStr.length === 3) {
      row1 = innerStr.slice(0, 2);
      row2 = innerStr.slice(2);
      fSize1 = 58;
      fSize2 = 58;
      rowOffset = 30;
    } else if (innerStr.length === 4) {
      // 예: 代表理事, 대표이사
      row1 = innerStr.slice(0, 2);
      row2 = innerStr.slice(2, 4);
      fSize1 = 66;
      fSize2 = 66;
      rowOffset = 32;
    } else if (innerStr.length === 5) {
      // 예: 대표변호사 (3자 / 2자 분할)
      row1 = innerStr.slice(0, 3);
      row2 = innerStr.slice(3);
      fSize1 = 50;
      fSize2 = 56;
      rowOffset = 28;
    } else {
      const half = Math.ceil(innerStr.length / 2);
      row1 = innerStr.slice(0, half);
      row2 = innerStr.slice(half);
      fSize1 = 48;
      fSize2 = 48;
      rowOffset = 28;
    }

    ctx.font = `${fontWeight} ${fSize1}px ${fontFamily}`;
    ctx.fillText(row1, center, center - rowOffset);

    ctx.font = `${fontWeight} ${fSize2}px ${fontFamily}`;
    ctx.fillText(row2, center, center + rowOffset);

    // 7. 인주 질감 효과
    if (texture) {
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 40) {
          const rand = Math.random();
          if (rand < 0.05) {
            data[i + 3] = Math.max(0, data[i + 3] - 90);
          } else if (rand > 0.96) {
            data[i] = Math.min(255, data[i] + 15);
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    ctx.restore();
  }, []);

  // 8대 일반 도장 전체 일괄 생성
  const generateAllPersonalSeals = useCallback(() => {
    const urls: string[] = [];
    const tempCanvas = document.createElement('canvas');
    for (let i = 0; i < 8; i++) {
      renderPersonalSealOnCanvas(tempCanvas, i, personalText, personalLang, inkColor, inkTexture);
      urls.push(tempCanvas.toDataURL('image/png'));
    }
    setPersonalDataUrls(urls);
  }, [personalText, personalLang, inkColor, inkTexture, renderPersonalSealOnCanvas]);

  // 8대 법인 도장 전체 일괄 생성
  const generateAllCorporateSeals = useCallback(() => {
    const urls: string[] = [];
    const tempCanvas = document.createElement('canvas');
    for (let i = 0; i < 8; i++) {
      renderCorporateSealOnCanvas(tempCanvas, i, corpOuterText, corpInnerText, corpSymbol, corpLang, inkColor, inkTexture);
      urls.push(tempCanvas.toDataURL('image/png'));
    }
    setCorpDataUrls(urls);
  }, [corpOuterText, corpInnerText, corpSymbol, corpLang, inkColor, inkTexture, renderCorporateSealOnCanvas]);

  // 초기 로드 시 8개 도장 자동 생성
  useEffect(() => {
    generateAllPersonalSeals();
    generateAllCorporateSeals();
  }, [generateAllPersonalSeals, generateAllCorporateSeals]);

  // =============================================================
  // 액션: 선택된 도장 공인 직인 등록 & PNG 다운로드
  // =============================================================
  const handleApplySelectedSeal = () => {
    let targetUrl = '';
    let sealTitle = '';
    if (activeTab === 'personal') {
      targetUrl = personalDataUrls[selectedPersonalCard];
      sealTitle = PERSONAL_PRESETS[selectedPersonalCard]?.name || '일반 도장';
    } else if (activeTab === 'corporate') {
      targetUrl = corpDataUrls[selectedCorpCard];
      sealTitle = CORPORATE_PRESETS[selectedCorpCard]?.name || '법인 도장';
    }

    if (!targetUrl) {
      toast.error('먼저 도장을 생성하고 선택해 주세요.');
      return;
    }

    const updated: LawyerSealInfo = {
      ...sealInfo,
      lawyerSealUrl: targetUrl,
      updatedAt: new Date().toISOString(),
    };
    setSealInfo(updated);
    localStorage.setItem(`legal_crm_lawyer_seal_${lawyerId}`, JSON.stringify(updated));
    onSaveSealInfo(updated);
    toast.success(`✨ [${sealTitle}]이(가) 변호사 공인 직인으로 즉시 등록되었습니다!`);
    if (!isInline && onClose) {
      onClose();
    }
  };

  const handleDownloadSelectedSeal = () => {
    let targetUrl = '';
    let fileName = '';
    if (activeTab === 'personal') {
      targetUrl = personalDataUrls[selectedPersonalCard];
      fileName = `${personalText}_${PERSONAL_PRESETS[selectedPersonalCard]?.name || '도장'}.png`;
    } else if (activeTab === 'corporate') {
      targetUrl = corpDataUrls[selectedCorpCard];
      fileName = `${corpOuterText}_${CORPORATE_PRESETS[selectedCorpCard]?.name || '법인인감'}.png`;
    }

    if (!targetUrl) {
      toast.error('먼저 도장을 생성하고 선택해 주세요.');
      return;
    }

    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('투명 배경 도장 PNG 파일이 다운로드되었습니다.');
  };

  // =============================================================
  // 누끼따기(배경 투명화) 엔진
  // =============================================================
  const processImageBackgroundRemoval = useCallback(() => {
    if (!uploadedRawImg) return;
    const rawCanvas = rawCanvasRef.current;
    const outCanvas = processedCanvasRef.current;
    if (!rawCanvas || !outCanvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      rawCanvas.width = w;
      rawCanvas.height = h;
      outCanvas.width = w;
      outCanvas.height = h;

      const rawCtx = rawCanvas.getContext('2d');
      const outCtx = outCanvas.getContext('2d');
      if (!rawCtx || !outCtx) return;

      rawCtx.drawImage(img, 0, 0, w, h);
      const imgData = rawCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (rawImgType === 'seal') {
          const isRedTone = r > 75 && (r - g) > redSensitivity && (r - b) > redSensitivity;
          if (isRedTone) {
            if (colorEnhance) {
              data[i] = Math.min(245, Math.max(r, 190));
              data[i + 1] = Math.max(15, Math.min(g, 45));
              data[i + 2] = Math.max(15, Math.min(b, 45));
            }
            data[i + 3] = 255;
          } else if (lum >= threshold - 30) {
            data[i + 3] = 0;
          } else {
            const redGap = r - Math.max(g, b);
            if (redGap < redSensitivity / 2) {
              data[i + 3] = 0;
            } else {
              data[i + 3] = Math.max(0, 255 - lum);
            }
          }
        } else {
          if (lum >= threshold) {
            data[i + 3] = 0;
          } else if (lum > threshold - 25) {
            const ratio = (threshold - lum) / 25;
            data[i + 3] = Math.round(a * ratio);
          }
        }
      }

      outCtx.putImageData(imgData, 0, 0);
    };
    img.src = uploadedRawImg;
  }, [uploadedRawImg, rawImgType, threshold, redSensitivity, colorEnhance]);

  useEffect(() => {
    if (uploadedRawImg && activeTab === 'background-remover') {
      processImageBackgroundRemoval();
    }
  }, [uploadedRawImg, activeTab, processImageBackgroundRemoval]);

  const handleUploadRawImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('8MB 이하의 이미지만 업로드 가능합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedRawImg(reader.result as string);
      toast.success('이미지가 로드되었습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSampleSeal = () => {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 400;
    sampleCanvas.height = 400;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#F5F4EE';
    ctx.fillRect(0, 0, 400, 400);

    ctx.strokeStyle = '#B91C1C';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(200, 200, 130, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '900 68px "Nanum Myeongjo", "Batang", serif';
    ctx.fillStyle = '#B91C1C';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('김', 245, 155);
    ctx.fillText('변', 245, 245);
    ctx.fillText('호', 155, 155);
    ctx.fillText('인', 155, 245);

    setUploadedRawImg(sampleCanvas.toDataURL('image/jpeg'));
    toast.success('샘플 종이 도장이 로드되었습니다.');
  };

  const handleDownloadProcessedPng = () => {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `누끼추출_${rawImgType === 'seal' ? '직인' : '로고'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('투명 PNG 파일이 다운로드되었습니다.');
  };

  const handleApplyProcessedAsSeal = (target: 'firmLogoUrl' | 'lawyerSealUrl') => {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const updated: LawyerSealInfo = {
      ...sealInfo,
      [target]: url,
      updatedAt: new Date().toISOString(),
    };
    setSealInfo(updated);
    localStorage.setItem(`legal_crm_lawyer_seal_${lawyerId}`, JSON.stringify(updated));
    onSaveSealInfo(updated);
    toast.success(`✨ ${target === 'firmLogoUrl' ? '법무법인 로고' : '변호사 공인 직인'}으로 등록되었습니다!`);
  };

  // =============================================================
  // 자필 서명 핸들러
  // =============================================================
  useEffect(() => {
    if (activeTab === 'signature') {
      const canvas = signCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [activeTab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.strokeStyle = signPenColor;
    ctx.lineWidth = signPenWidth;
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleDownloadSignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas || !hasSignature) {
      toast.error('먼저 서명을 그려주세요.');
      return;
    }
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lawyerName || '변호사'}_전자서명.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('투명 서명 PNG 파일이 다운로드되었습니다.');
  };

  const handleApplySignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas || !hasSignature) {
      toast.error('먼저 서명을 그려주세요.');
      return;
    }
    const url = canvas.toDataURL('image/png');
    const updated: LawyerSealInfo = {
      ...sealInfo,
      signUrl: url,
      updatedAt: new Date().toISOString(),
    };
    setSealInfo(updated);
    localStorage.setItem(`legal_crm_lawyer_seal_${lawyerId}`, JSON.stringify(updated));
    onSaveSealInfo(updated);
    toast.success('✨ 변호사 전자서명이 등록되었습니다!');
  };

  // 전체 설정 저장
  const handleSaveAllSettings = () => {
    const updated: LawyerSealInfo = {
      ...sealInfo,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`legal_crm_lawyer_seal_${lawyerId}`, JSON.stringify(updated));
    onSaveSealInfo(updated);
    toast.success('브랜딩 및 자동 날인 연동 설정이 안전하게 저장되었습니다.');
    if (!isInline && onClose) onClose();
  };

  // =============================================================
  // 모달 메인 콘텐츠
  // =============================================================
  const content = (
    <div className="bg-white w-full rounded-3xl border border-slate-200 overflow-hidden shadow-2xl text-slate-800">
      
      {/* 1. 상단 타이틀바 (모두사인 스타일 헤더) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md">
            <Stamp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                도장 입력 & 브랜딩 스튜디오
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30">
                모두사인 규격 지원
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {firmName} {lawyerName} 변호사 전자서명·공인 직인 날인 센터
            </p>
          </div>
        </div>

        {!isInline && onClose && (
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. 메인 탭바 (모두사인 3대 탭: 일반 도장 | 법인 도장 | 업로드 + 서명/설정) */}
      <div className="bg-white border-b border-slate-200 px-6 pt-3 flex items-center gap-4 overflow-x-auto scrollbar-none">
        {[
          { id: 'personal' as const, label: '일반 도장', icon: Stamp },
          { id: 'corporate' as const, label: '법인 도장', icon: Building2 },
          { id: 'background-remover' as const, label: '업로드 (누끼)', icon: Upload },
          { id: 'signature' as const, label: '서명 패드', icon: PenTool },
          { id: 'settings' as const, label: '설정', icon: Layers },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-2 flex items-center gap-1.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-amber-500 text-amber-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. 본문 영역 */}
      <div className="p-5 sm:p-6 max-h-[calc(86vh-120px)] overflow-y-auto space-y-6">

        {/* ========================================================= */}
        {/* TAB 1: 일반 도장 (모두사인 Image 2 완벽 구현) */}
        {/* ========================================================= */}
        {activeTab === 'personal' && (
          <div className="space-y-5">
            {/* 상단 컨트롤 바 (모두사인 스타일: 언어 드롭다운 + 인풋 + 만들기 버튼) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* 언어 선택 드롭다운 */}
              <select
                value={personalLang}
                onChange={e => setPersonalLang(e.target.value as 'ko' | 'hanja')}
                className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer focus:ring-2 focus:ring-amber-500"
              >
                <option value="ko">한글</option>
                <option value="hanja">한자</option>
              </select>

              {/* 텍스트 입력창 */}
              <div className="flex-1 relative">
                <input 
                  type="text"
                  value={personalText}
                  onChange={e => setPersonalText(e.target.value)}
                  placeholder="이름을 입력하고 만들기 버튼을 눌러주세요."
                  maxLength={10}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* 인주 색상 선택 칩 */}
              <div className="flex items-center gap-1.5 px-2 bg-slate-50 border border-slate-200 rounded-xl py-1">
                {INK_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setInkColor(c.hex)}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-all flex items-center justify-center ${
                      inkColor === c.hex ? 'ring-2 ring-indigo-500 scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {inkColor === c.hex && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>

              {/* 만들기 버튼 (모두사인 스타일) */}
              <button
                type="button"
                onClick={generateAllPersonalSeals}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
              >
                만들기
              </button>
            </div>

            {/* 8대 프리셋 도장 그리드 (모두사인 카드 레이아웃) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {PERSONAL_PRESETS.map((preset, idx) => {
                const isSelected = selectedPersonalCard === idx;
                const dataUrl = personalDataUrls[idx];
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPersonalCard(idx)}
                    className={`relative p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-between bg-white text-center group ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-md ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-400 hover:shadow-xs'
                    }`}
                  >
                    {/* 선택 체크 뱃지 */}
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3" />
                      </div>
                    )}

                    {/* 도장 캔버스 이미지 미리보기 (기존 컴팩트 화면 크기 복원) */}
                    <div className="w-full h-36 flex items-center justify-center p-2 relative overflow-hidden">
                      {/* 투명 체커보드 패턴 */}
                      <div 
                        className="absolute inset-2 opacity-35 pointer-events-none rounded-xl" 
                        style={{
                          backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                          backgroundSize: '10px 10px',
                        }}
                      />
                      {dataUrl ? (
                        <img 
                          src={dataUrl} 
                          alt={preset.name} 
                          className="max-h-32 max-w-full object-contain relative z-10 drop-shadow-xs transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="text-slate-300 flex flex-col items-center">
                          <Stamp className="w-6 h-6 mb-1" />
                          <span className="text-[10px]">생성 중</span>
                        </div>
                      )}
                    </div>

                    {/* 카드 하단 캡션 */}
                    <div className="w-full pt-2 border-t border-slate-100 text-center">
                      <span className={`text-xs font-bold block ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {preset.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 하단 액션 바 (입력하기 / 다운로드) */}
            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium">
                선택된 도장: <strong className="text-indigo-700 font-bold">{PERSONAL_PRESETS[selectedPersonalCard]?.name}</strong>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadSelectedSeal}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>투명 PNG 다운로드</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplySelectedSeal}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>선택 도장 공인 직인으로 등록</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: 법인 도장 (모두사인 Image 1 완벽 구현: 외경 회전 원형 인감) */}
        {/* ========================================================= */}
        {activeTab === 'corporate' && (
          <div className="space-y-5">
            {/* 상단 컨트롤 바 */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* 언어 선택 드롭다운 */}
                <select
                  value={corpLang}
                  onChange={e => setCorpLang(e.target.value as 'ko' | 'hanja')}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ko">한글</option>
                  <option value="hanja">한자</option>
                </select>

                {/* 외경 상호명 입력란 */}
                <div className="flex-1">
                  <input 
                    type="text"
                    value={corpOuterText}
                    onChange={e => setCorpOuterText(e.target.value)}
                    placeholder="외경 상호명 (예: 법무법인 정의, 변호사 김무진 법률사무소)"
                    maxLength={20}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* 내경 직함 입력/선택 */}
                <div className="w-full sm:w-44">
                  <input 
                    type="text"
                    value={corpInnerText}
                    onChange={e => setCorpInnerText(e.target.value)}
                    placeholder="내경 직함 (예: 대표변호사)"
                    maxLength={8}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* 구분 기호 토글 (★ 또는 ●) */}
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setCorpSymbol('★')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      corpSymbol === '★' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorpSymbol('●')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      corpSymbol === '●' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    ●
                  </button>
                </div>

                {/* 만들기 버튼 */}
                <button
                  type="button"
                  onClick={generateAllCorporateSeals}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  만들기
                </button>
              </div>

              {/* 직함 빠른 선택 추천 칩 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 mr-1">직함 추천:</span>
                {['대표변호사', '변호사', '대표이사', '지배인', '인'].map((title, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCorpInnerText(title)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-amber-400 text-[11px] font-medium text-slate-700 hover:text-amber-700 transition-colors cursor-pointer"
                  >
                    {title}
                  </button>
                ))}
              </div>
            </div>

            {/* 8대 법인 도장 프리셋 그리드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {CORPORATE_PRESETS.map((preset, idx) => {
                const isSelected = selectedCorpCard === idx;
                const dataUrl = corpDataUrls[idx];
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedCorpCard(idx)}
                    className={`relative p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-between bg-white text-center group ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-md ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-400 hover:shadow-xs'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3" />
                      </div>
                    )}

                    {/* 도장 캔버스 이미지 미리보기 (기존 컴팩트 화면 크기 복원) */}
                    <div className="w-full h-36 flex items-center justify-center p-2 relative overflow-hidden">
                      <div 
                        className="absolute inset-2 opacity-35 pointer-events-none rounded-xl" 
                        style={{
                          backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                          backgroundSize: '10px 10px',
                        }}
                      />
                      {dataUrl ? (
                        <img 
                          src={dataUrl} 
                          alt={preset.name} 
                          className="max-h-32 max-w-full object-contain relative z-10 drop-shadow-xs transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="text-slate-300 flex flex-col items-center">
                          <Building2 className="w-6 h-6 mb-1" />
                          <span className="text-[10px]">생성 중</span>
                        </div>
                      )}
                    </div>

                    <div className="w-full pt-2 border-t border-slate-100 text-center">
                      <span className={`text-xs font-bold block ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {preset.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 하단 액션 바 */}
            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium">
                선택된 인감: <strong className="text-indigo-700 font-bold">{CORPORATE_PRESETS[selectedCorpCard]?.name}</strong>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadSelectedSeal}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>투명 PNG 다운로드</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplySelectedSeal}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>선택 도장 공인 직인으로 등록</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: 사진·로고 누끼따기 (종이 배경 투명화) */}
        {/* ========================================================= */}
        {activeTab === 'background-remover' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">스마트 종이 배경 제거 (누끼따기) 엔진</p>
                <p className="text-amber-900 leading-relaxed">
                  흰 종이에 도장을 찍어 스마트폰으로 촬영하거나 스캔한 이미지, 또는 배경이 흰색인 로고 이미지를 올려주세요.
                  종이 배경을 완전히 투명화하고 인주 색상을 또렷하게 살려 투명 PNG 파일로 변환해 드립니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">작업 모드:</span>
                <button
                  type="button"
                  onClick={() => setRawImgType('seal')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rawImgType === 'seal' 
                      ? 'bg-red-600 text-white shadow-xs' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  붉은 인주 도장 누끼 모드
                </button>
                <button
                  type="button"
                  onClick={() => setRawImgType('logo')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    rawImgType === 'logo' 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  일반 로고·직인 배경 제거
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleSeal}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                >
                  샘플 종이도장 불러오기
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleUploadRawImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>내 사진·이미지 업로드</span>
                </button>
              </div>
            </div>

            {/* 비교 뷰 (좌: 원본, 우: 누끼 결과) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col items-center">
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">1. 원본 촬영/스캔 이미지</span>
                  {uploadedRawImg && (
                    <button
                      type="button"
                      onClick={() => setUploadedRawImg(null)}
                      className="text-[11px] text-red-500 hover:underline cursor-pointer"
                    >
                      초기화
                    </button>
                  )}
                </div>

                <div className="w-full h-64 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 relative shadow-inner">
                  {uploadedRawImg ? (
                    <canvas ref={rawCanvasRef} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-full border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <Upload className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">도장 사진을 여기에 끌어놓거나 클릭</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WebP 지원</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 flex flex-col items-center">
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    2. 배경 투명화 추출 결과 (투명 PNG)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                    투명 체커보드 프리뷰
                  </span>
                </div>

                <div className="w-full h-64 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden p-2 relative shadow-inner bg-white">
                  <div 
                    className="absolute inset-0 opacity-45 pointer-events-none" 
                    style={{
                      backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                      backgroundSize: '12px 12px',
                    }}
                  />
                  {uploadedRawImg ? (
                    <canvas ref={processedCanvasRef} className="max-w-full max-h-full object-contain relative z-10 drop-shadow-sm" />
                  ) : (
                    <div className="relative z-10 text-slate-400 text-center p-4">
                      <Stamp className="w-8 h-8 mb-2 mx-auto text-slate-300" />
                      <p className="text-xs text-slate-500 font-medium">이미지를 업로드하면 실시간으로 누끼가 추출됩니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {uploadedRawImg && (
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
                <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  누끼 정밀 튜닝 컨트롤러
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-700">배경 제거 강도 (종이 밝기 감도)</span>
                      <span className="text-indigo-600 font-bold">{threshold}</span>
                    </div>
                    <input 
                      type="range" 
                      min="100" 
                      max="250" 
                      value={threshold} 
                      onChange={e => setThreshold(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  {rawImgType === 'seal' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-700">인주 붉은색 추출 민감도</span>
                        <span className="text-red-600 font-bold">{redSensitivity}</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="60" 
                        value={redSensitivity} 
                        onChange={e => setRedSensitivity(Number(e.target.value))}
                        className="w-full accent-red-600 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadProcessedPng}
                    className="flex-1 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>누끼 딴 투명 PNG 다운로드</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyProcessedAsSeal('lawyerSealUrl')}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    <Stamp className="w-4 h-4" />
                    <span>변호사 공인 직인으로 등록</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyProcessedAsSeal('firmLogoUrl')}
                    className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>법무법인 로고로 등록</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: 전자 서명 패드 */}
        {/* ========================================================= */}
        {activeTab === 'signature' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-start gap-3 text-xs text-blue-950">
              <FileSignature className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">전자 서명(Sign) 직접 그리기 패드</p>
                <p className="text-blue-900 leading-relaxed">
                  마우스 또는 터치펜으로 자필 서명을 직접 그려보세요. 투명 배경의 벡터 스타일 PNG로 자동 추출됩니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-blue-600" />
                    서명 캔버스
                  </span>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[11px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    지우고 다시 그리기
                  </button>
                </div>

                <div className="w-full h-72 rounded-2xl border-2 border-slate-300 bg-white relative overflow-hidden shadow-inner flex items-center justify-center">
                  <div className="absolute inset-x-8 top-1/2 border-b border-dashed border-slate-200 pointer-events-none" />
                  <canvas
                    ref={signCanvasRef}
                    width={700}
                    height={350}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full cursor-crosshair relative z-10 touch-none"
                  />
                </div>
              </div>

              <div className="lg:col-span-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <span className="text-xs font-black text-slate-700 block">펜 도구 설정</span>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600 block">펜 색상</span>
                    <div className="flex gap-2">
                      {[
                        { hex: '#0F172A', label: '차콜 블랙' },
                        { hex: '#1E3A8A', label: '인디고' },
                        { hex: '#DC2626', label: '인주 레드' },
                      ].map(c => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setSignPenColor(c.hex)}
                          className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            signPenColor === c.hex 
                              ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs' 
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: c.hex }} />
                          {c.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600">
                      <span>펜 굵기</span>
                      <span>{signPenWidth}px</span>
                    </div>
                    <div className="flex gap-2">
                      {[2, 4, 6].map(w => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setSignPenWidth(w)}
                          className={`flex-1 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                            signPenWidth === w 
                              ? 'bg-blue-600 text-white border-blue-600' 
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          {w === 2 ? '얇게' : w === 4 ? '보통' : '두껍게'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleApplySignature}
                    disabled={!hasSignature}
                    className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                      hasSignature 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>전자 서명으로 등록하기</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSignature}
                    disabled={!hasSignature}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                      hasSignature
                        ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                        : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>투명 PNG 서명 다운로드</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: 현재 등록된 직인 & 자동날인 설정 */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-xs text-slate-800">
              <Layers className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">현재 등록된 브랜딩 에셋 및 법률 문서 자동 날인</p>
                <p className="text-slate-600 leading-relaxed">
                  등록된 로고, 공인 직인, 자필 서명은 플랫폼 내에서 발급되는 각종 서식에 규격에 맞춰 자동 배치됩니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. 로고 */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center text-center space-y-3">
                <span className="text-xs font-bold text-slate-700">법무법인/사무소 로고</span>
                <div className="w-32 h-24 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 shadow-xs">
                  {sealInfo.firmLogoUrl ? (
                    <img src={sealInfo.firmLogoUrl} alt="로고" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="text-slate-300 flex flex-col items-center">
                      <ImageIcon className="w-6 h-6 mb-1" />
                      <span className="text-[10px]">미등록</span>
                    </div>
                  )}
                </div>
                {sealInfo.firmLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setSealInfo(prev => ({ ...prev, firmLogoUrl: undefined }))}
                    className="text-[11px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> 로고 삭제
                  </button>
                )}
              </div>

              {/* 2. 직인 */}
              <div className="p-4 rounded-2xl border-2 border-red-100 bg-red-50/30 flex flex-col items-center text-center space-y-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">변호사 공인 직인 (도장)</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-black">필수</span>
                </div>
                <div className="w-24 h-24 rounded-full bg-white border border-red-200 flex items-center justify-center overflow-hidden p-2 shadow-xs relative">
                  {sealInfo.lawyerSealUrl ? (
                    <img src={sealInfo.lawyerSealUrl} alt="직인" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-red-300 flex flex-col items-center">
                      <Stamp className="w-7 h-7 mb-1" />
                      <span className="text-[10px] font-bold">미등록</span>
                    </div>
                  )}
                </div>
                {sealInfo.lawyerSealUrl && (
                  <button
                    type="button"
                    onClick={() => setSealInfo(prev => ({ ...prev, lawyerSealUrl: undefined }))}
                    className="text-[11px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> 직인 삭제
                  </button>
                )}
              </div>

              {/* 3. 서명 */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center text-center space-y-3">
                <span className="text-xs font-bold text-slate-700">변호사 자필 서명 (싸인)</span>
                <div className="w-32 h-24 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 shadow-xs">
                  {sealInfo.signUrl ? (
                    <img src={sealInfo.signUrl} alt="서명" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="text-slate-300 flex flex-col items-center">
                      <FileSignature className="w-6 h-6 mb-1" />
                      <span className="text-[10px]">미등록</span>
                    </div>
                  )}
                </div>
                {sealInfo.signUrl && (
                  <button
                    type="button"
                    onClick={() => setSealInfo(prev => ({ ...prev, signUrl: undefined }))}
                    className="text-[11px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> 서명 삭제
                  </button>
                )}
              </div>
            </div>

            {/* 자동 날인 체크박스 */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
              <span className="text-xs font-black text-slate-900 block">
                전자문서 발급 시 자동 날인 연동 옵션
              </span>
              <div className="space-y-2.5 text-xs text-slate-700">
                <label className="flex items-center gap-2.5 cursor-pointer font-medium p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox"
                    checked={sealInfo.autoSealContract ?? true}
                    onChange={e => setSealInfo(prev => ({ ...prev, autoSealContract: e.target.checked }))}
                    className="rounded accent-indigo-600 w-4 h-4"
                  />
                  <span><strong>수임계약서</strong>: 계약 체결 시 변호사 직인 자동 날인</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-medium p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox"
                    checked={sealInfo.autoSealPetition ?? true}
                    onChange={e => setSealInfo(prev => ({ ...prev, autoSealPetition: e.target.checked }))}
                    className="rounded accent-indigo-600 w-4 h-4"
                  />
                  <span><strong>소송위임장 및 사실조회신청서</strong>: 사건 접수 문서에 대리인 직인 자동 날인</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-medium p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox"
                    checked={sealInfo.autoSealCorrection ?? true}
                    onChange={e => setSealInfo(prev => ({ ...prev, autoSealCorrection: e.target.checked }))}
                    className="rounded accent-indigo-600 w-4 h-4"
                  />
                  <span><strong>법원 보정서 표지 및 소명서</strong>: 대리인란에 자동 날인</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveAllSettings}
                className="py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                <span>브랜딩 및 자동날인 설정 저장</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  if (isInline) {
    return content;
  }

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {content}
        </div>
      </div>
    </ModalPortal>
  );
}
