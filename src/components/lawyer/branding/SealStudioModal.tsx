import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Upload, Check, Stamp, Image as ImageIcon,
  Trash2, Sparkles, Download, RefreshCw, Sliders, Palette, PenTool,
  Type, CheckCircle2, RotateCcw, ArrowRight, Layers, FileSignature, Eye
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
  isInline?: boolean; // When rendered inline inside settings tab
}

type StudioTab = 'generator' | 'background-remover' | 'signature' | 'settings';

// 5대 전문 도장 폰트 프리셋
interface FontPreset {
  id: string;
  name: string;
  category: string;
  fontFamily: string;
  fontWeight: string;
  description: string;
  badge: string;
}

const FONT_PRESETS: FontPreset[] = [
  {
    id: 'jeonseo',
    name: '정통 전서·전각체',
    category: '고전 인장',
    fontFamily: '"Nanum Myeongjo", "Batang", "Gungsuh", serif',
    fontWeight: '900',
    description: '전통 인장·도장에 사용되는 가장 권위 있고 격식 있는 전각 서체 스타일',
    badge: '정통 추천',
  },
  {
    id: 'gungsuh',
    name: '해서·궁서체',
    category: '정통 붓글씨',
    fontFamily: '"Gungsuh", "GungsuhChe", "Batang", serif',
    fontWeight: 'bold',
    description: '법원 제출 서류 및 공문서에 가장 널리 쓰이는 유려하고 엄숙한 궁서 붓글씨',
    badge: '법원 표준',
  },
  {
    id: 'panbon',
    name: '훈민정음·고판본체',
    category: '목판 인쇄',
    fontFamily: '"Batang", "Nanum Myeongjo", serif',
    fontWeight: '900',
    description: '조선시대 훈민정음 해례본의 각진 획을 재현한 중후하고 강건한 전통 목판 서체',
    badge: '고풍스러움',
  },
  {
    id: 'myeongjo',
    name: '바탕·정갈 명조체',
    category: '현대 명조',
    fontFamily: '"Nanum Myeongjo", "BatangChe", "Batang", serif',
    fontWeight: '700',
    description: '신뢰감을 주며 현대적이면서도 단정하고 세련된 정통 명조체',
    badge: '현대적 신뢰',
  },
  {
    id: 'gothic',
    name: '볼드 고딕·헤드라인',
    category: '현대 고딕',
    fontFamily: '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    fontWeight: '900',
    description: '전자문서 모바일 화면에서도 가독성이 매우 뛰어난 또렷한 현대식 인장',
    badge: '높은 시인성',
  },
];

// 도장 형태 프리셋
type SealShape = 'round' | 'square' | 'oval';

// 테두리 스타일
type BorderStyle = 'double' | 'single' | 'heavy';

// 인주 색상
const INK_COLORS = [
  { name: '정통 인주 레드', hex: '#DC2626', bg: 'bg-red-600' },
  { name: '선명한 다홍 레드', hex: '#EF4444', bg: 'bg-red-500' },
  { name: '근엄한 심홍 버건디', hex: '#991B1B', bg: 'bg-red-800' },
  { name: '인주 블랙/차콜', hex: '#1E293B', bg: 'bg-slate-800' },
  { name: '딥 네이비', hex: '#1E3A8A', bg: 'bg-blue-900' },
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
  const [activeTab, setActiveTab] = useState<StudioTab>('generator');

  // 종합 직인 정보 상태
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

  // -------------------------------------------------------------
  // TAB 1: 전자 직인/도장 생성기 상태
  // -------------------------------------------------------------
  const defaultText = lawyerName ? (lawyerName.endsWith('인') ? lawyerName : `${lawyerName}인`) : '홍길동인';
  const [genText, setGenText] = useState(defaultText);
  const [genShape, setGenShape] = useState<SealShape>('round');
  const [genFont, setGenFont] = useState<string>('jeonseo');
  const [genColor, setGenColor] = useState<string>('#DC2626');
  const [genBorder, setGenBorder] = useState<BorderStyle>('double');
  const [genLayoutOrder, setGenLayoutOrder] = useState<'traditional' | 'modern'>('traditional');
  const [genInkTexture, setGenInkTexture] = useState<boolean>(true); // 실제 인주 질감 효과

  const genCanvasRef = useRef<HTMLCanvasElement>(null);

  // -------------------------------------------------------------
  // TAB 2: 누끼따기(배경 제거) 상태
  // -------------------------------------------------------------
  const [uploadedRawImg, setUploadedRawImg] = useState<string | null>(null);
  const [rawImgType, setRawImgType] = useState<'seal' | 'logo'>('seal');
  const [threshold, setThreshold] = useState<number>(200); // 종이 배경 밝기 임계값
  const [redSensitivity, setRedSensitivity] = useState<number>(28); // 인주 붉은색 감도
  const [colorEnhance, setColorEnhance] = useState<boolean>(true); // 인주 색상 선명화
  const [edgeSmooth, setEdgeSmooth] = useState<number>(2); // 가장자리 부드럽게
  const rawCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // TAB 3: 서명(싸인) 그리기 패드 상태
  // -------------------------------------------------------------
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signPenColor, setSignPenColor] = useState<string>('#1E293B');
  const [signPenWidth, setSignPenWidth] = useState<number>(4);
  const [hasSignature, setHasSignature] = useState(false);

  // -------------------------------------------------------------
  // TAB 1: 도장 캔버스 렌더링 엔진
  // -------------------------------------------------------------
  const renderSealCanvas = useCallback(() => {
    const canvas = genCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 600; // 고해상도 600x600 캔버스
    canvas.width = size;
    canvas.height = size;

    // 투명 배경 초기화
    ctx.clearRect(0, 0, size, size);

    const preset = FONT_PRESETS.find(p => p.id === genFont) || FONT_PRESETS[0];
    const center = size / 2;

    ctx.save();
    ctx.strokeStyle = genColor;
    ctx.fillStyle = genColor;

    // 1. 테두리 그리기
    if (genShape === 'round') {
      const radius = size * 0.44;
      if (genBorder === 'double') {
        // 이중 원 (외곽 두꺼움 + 내부 얇음)
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(center, center, radius - 18, 0, Math.PI * 2);
        ctx.stroke();
      } else if (genBorder === 'heavy') {
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (genShape === 'square') {
      const boxSize = size * 0.84;
      const x = (size - boxSize) / 2;
      const y = (size - boxSize) / 2;
      const cornerRadius = 16;

      const drawRoundedRect = (bx: number, by: number, bsize: number, cr: number) => {
        ctx.beginPath();
        ctx.moveTo(bx + cr, by);
        ctx.lineTo(bx + bsize - cr, by);
        ctx.quadraticCurveTo(bx + bsize, by, bx + bsize, by + cr);
        ctx.lineTo(bx + bsize, by + bsize - cr);
        ctx.quadraticCurveTo(bx + bsize, by + bsize, bx + bsize - cr, by + bsize);
        ctx.lineTo(bx + cr, by + bsize);
        ctx.quadraticCurveTo(bx, by + bsize, bx, by + bsize - cr);
        ctx.lineTo(bx, by + cr);
        ctx.quadraticCurveTo(bx, by, bx + cr, by);
        ctx.closePath();
      };

      if (genBorder === 'double') {
        ctx.lineWidth = 15;
        drawRoundedRect(x, y, boxSize, cornerRadius);
        ctx.stroke();

        ctx.lineWidth = 4;
        drawRoundedRect(x + 18, y + 18, boxSize - 36, cornerRadius - 4);
        ctx.stroke();
      } else if (genBorder === 'heavy') {
        ctx.lineWidth = 24;
        drawRoundedRect(x, y, boxSize, cornerRadius);
        ctx.stroke();
      } else {
        ctx.lineWidth = 16;
        drawRoundedRect(x, y, boxSize, cornerRadius);
        ctx.stroke();
      }
    } else if (genShape === 'oval') {
      // 타원형
      const radiusX = size * 0.34;
      const radiusY = size * 0.44;

      if (genBorder === 'double') {
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.ellipse(center, center, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(center, center, radiusX - 16, radiusY - 16, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.ellipse(center, center, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 2. 글자 렌더링
    const cleanText = genText.trim() || '홍길동인';
    const chars = cleanText.split('');
    const charCount = chars.length;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (charCount === 4) {
      // 4글자 인장
      // traditional: 1열 우측 상단(0), 1열 우측 하단(1), 2열 좌측 상단(2), 2열 좌측 하단(3) - 한국 정통 인장 순서!
      // modern: 1열 좌측 상단(0), 1열 우측 상단(1), 2열 좌측 하단(2), 2열 우측 하단(3)
      let slot0 = chars[0];
      let slot1 = chars[1];
      let slot2 = chars[2];
      let slot3 = chars[3];

      let pos0 = { x: 0, y: 0 };
      let pos1 = { x: 0, y: 0 };
      let pos2 = { x: 0, y: 0 };
      let pos3 = { x: 0, y: 0 };

      const offset = size * 0.19;
      if (genLayoutOrder === 'traditional') {
        // [좌상: slot2] [우상: slot0]
        // [좌하: slot3] [우하: slot1]
        pos0 = { x: center + offset, y: center - offset }; // 우상
        pos1 = { x: center + offset, y: center + offset }; // 우하
        pos2 = { x: center - offset, y: center - offset }; // 좌상
        pos3 = { x: center - offset, y: center + offset }; // 좌하
      } else {
        pos0 = { x: center - offset, y: center - offset }; // 좌상
        pos1 = { x: center + offset, y: center - offset }; // 우상
        pos2 = { x: center - offset, y: center + offset }; // 좌하
        pos3 = { x: center + offset, y: center + offset }; // 우하
      }

      const fontSize = size * 0.32;
      ctx.font = `${preset.fontWeight} ${fontSize}px ${preset.fontFamily}`;

      ctx.fillText(slot0, pos0.x, pos0.y);
      ctx.fillText(slot1, pos1.x, pos1.y);
      ctx.fillText(slot2, pos2.x, pos2.y);
      ctx.fillText(slot3, pos3.x, pos3.y);

    } else if (charCount === 3) {
      // 3글자 세로 일렬 배치
      const fontSize = size * 0.26;
      ctx.font = `${preset.fontWeight} ${fontSize}px ${preset.fontFamily}`;
      const gap = size * 0.25;
      ctx.fillText(chars[0], center, center - gap);
      ctx.fillText(chars[1], center, center);
      ctx.fillText(chars[2], center, center + gap);

    } else if (charCount === 2) {
      // 2글자 세로 배치
      const fontSize = size * 0.34;
      ctx.font = `${preset.fontWeight} ${fontSize}px ${preset.fontFamily}`;
      const gap = size * 0.20;
      ctx.fillText(chars[0], center, center - gap);
      ctx.fillText(chars[1], center, center + gap);

    } else if (charCount <= 9) {
      // 5~9글자 법인 직인 (격자 배열)
      const cols = charCount <= 6 ? 2 : 3;
      const rows = Math.ceil(charCount / cols);
      const fontSize = (size * 0.65) / Math.max(rows, cols);
      ctx.font = `${preset.fontWeight} ${fontSize}px ${preset.fontFamily}`;

      const xStep = (size * 0.55) / cols;
      const yStep = (size * 0.55) / rows;
      const startX = center - ((cols - 1) * xStep) / 2;
      const startY = center - ((rows - 1) * yStep) / 2;

      for (let i = 0; i < charCount; i++) {
        let col = 0;
        let row = 0;
        if (genLayoutOrder === 'traditional') {
          // 우측 세로열부터 위에서 아래로
          col = cols - 1 - Math.floor(i / rows);
          row = i % rows;
        } else {
          // 가로 좌에서 우로
          col = i % cols;
          row = Math.floor(i / cols);
        }
        const px = startX + col * xStep;
        const py = startY + row * yStep;
        ctx.fillText(chars[i], px, py);
      }
    } else {
      // 10자 이상
      const fontSize = size * 0.12;
      ctx.font = `${preset.fontWeight} ${fontSize}px ${preset.fontFamily}`;
      ctx.fillText(cleanText.slice(0, 8), center, center - 40);
      ctx.fillText(cleanText.slice(8, 16), center, center + 40);
    }

    // 3. 실제 인주 질감 효과 (Realistic Ink Texture)
    if (genInkTexture) {
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      // 미세 노이즈 및 공극 시뮬레이션
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 40) {
          const rand = Math.random();
          // 인주 번짐 및 작은 섬유 공극
          if (rand < 0.07) {
            data[i + 3] = Math.max(0, alpha - 90); // 미세 구멍
          } else if (rand > 0.95) {
            // 인주 뭉침 효과
            data[i] = Math.min(255, data[i] + 15);
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    ctx.restore();
  }, [genText, genShape, genFont, genColor, genBorder, genLayoutOrder, genInkTexture]);

  useEffect(() => {
    if (activeTab === 'generator') {
      renderSealCanvas();
    }
  }, [activeTab, renderSealCanvas]);

  // -------------------------------------------------------------
  // TAB 1 액션: PNG 다운로드 및 공인직인 즉시 등록
  // -------------------------------------------------------------
  const handleDownloadGeneratedSeal = () => {
    const canvas = genCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${genText || '변호사직인'}_전자도장.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('투명 배경 도장 PNG 파일이 다운로드되었습니다.');
  };

  const handleApplyAsOfficialSeal = () => {
    const canvas = genCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const updated: LawyerSealInfo = {
      ...sealInfo,
      lawyerSealUrl: url,
      updatedAt: new Date().toISOString(),
    };
    setSealInfo(updated);
    localStorage.setItem(`legal_crm_lawyer_seal_${lawyerId}`, JSON.stringify(updated));
    onSaveSealInfo(updated);
    toast.success('✨ 생성된 도장이 변호사 공인 직인으로 즉시 등록되었습니다!');
  };

  // -------------------------------------------------------------
  // TAB 2: 누끼따기(배경 제거) 엔진
  // -------------------------------------------------------------
  const processImageBackgroundRemoval = useCallback(() => {
    if (!uploadedRawImg) return;
    const rawCanvas = rawCanvasRef.current;
    const outCanvas = processedCanvasRef.current;
    if (!rawCanvas || !outCanvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 캔버스 크기 맞춤
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

      // 픽셀 순회 누끼 알고리즘
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue;

        // 종이 밝기 (Luminance)
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (rawImgType === 'seal') {
          // 인주 도장 누끼 모드: 붉은색 성분 보존 + 종이 배경 투명화
          const isRedTone = r > 75 && (r - g) > redSensitivity && (r - b) > redSensitivity;

          if (isRedTone) {
            // 붉은 인주 부분
            if (colorEnhance) {
              // 붉은 색상 생생하게 부스트
              data[i] = Math.min(245, Math.max(r, 190));
              data[i + 1] = Math.max(15, Math.min(g, 45));
              data[i + 2] = Math.max(15, Math.min(b, 45));
            }
            // 경계선 안티앨리어싱
            data[i + 3] = 255;
          } else if (lum >= threshold - 30) {
            // 밝은 종이 배경 제거
            data[i + 3] = 0;
          } else {
            // 그림자나 어두운 종이 얼룩 제거
            // 붉은 기가 전혀 없으면 투명화
            const redGap = r - Math.max(g, b);
            if (redGap < redSensitivity / 2) {
              data[i + 3] = 0;
            } else {
              // 중간 그라데이션
              data[i + 3] = Math.max(0, 255 - lum);
            }
          }
        } else {
          // 로고 누끼 모드: 흰색/밝은 배경 날리기
          if (lum >= threshold) {
            data[i + 3] = 0;
          } else if (lum > threshold - 25) {
            // 부드러운 가장자리
            const ratio = (threshold - lum) / 25;
            data[i + 3] = Math.round(a * ratio);
          }
        }
      }

      outCtx.putImageData(imgData, 0, 0);
    };
    img.src = uploadedRawImg;
  }, [uploadedRawImg, rawImgType, threshold, redSensitivity, colorEnhance, edgeSmooth]);

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
      toast.success('이미지가 로드되었습니다. 배경 제거 슬라이더로 정밀 조정하세요.');
    };
    reader.readAsDataURL(file);
  };

  // 테스트용 종이 도장 샘플 생성
  const handleLoadSampleSeal = () => {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 400;
    sampleCanvas.height = 400;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return;

    // 흰색/약간 누런 종이 배경 + 그림자
    ctx.fillStyle = '#F5F4EE';
    ctx.fillRect(0, 0, 400, 400);

    // 종이 질감 미세 얼룩
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(220, 215, 200, ${Math.random() * 0.4})`;
      ctx.fillRect(Math.random() * 400, Math.random() * 400, 2, 2);
    }

    // 도장 날인 (빨간 인주)
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
    toast.success('샘플 종이 도장이 로드되었습니다. 누끼 결과를 확인해 보세요!');
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
    toast.success('투명 PNG 파일이 성공적으로 다운로드되었습니다.');
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
    toast.success(`✨ 누끼 딴 이미지가 ${target === 'firmLogoUrl' ? '법무법인 로고' : '변호사 공인 직인'}으로 등록되었습니다!`);
  };

  // -------------------------------------------------------------
  // TAB 3: 전자 서명 패드
  // -------------------------------------------------------------
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

  const stopDrawing = () => {
    setIsDrawing(false);
  };

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
      toast.error('먼저 패드에 서명을 그려주세요.');
      return;
    }
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lawyerName || '변호사'}_전자서명.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('투명 전자서명 PNG 파일이 다운로드되었습니다.');
  };

  const handleApplySignature = () => {
    const canvas = signCanvasRef.current;
    if (!canvas || !hasSignature) {
      toast.error('먼저 패드에 서명을 그려주세요.');
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
    toast.success('✨ 변호사 전자서명이 성공적으로 등록되었습니다!');
  };

  // -------------------------------------------------------------
  // TAB 4: 전체 설정 저장
  // -------------------------------------------------------------
  const handleSaveAllSettings = () => {
    const updated: LawyerSealInfo = {
      ...sealInfo,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`legal_crm_lawyer_seal_${lawyerId}`, JSON.stringify(updated));
    onSaveSealInfo(updated);
    toast.success('브랜딩 및 자동 날인 연동 설정이 안전하게 저장되었습니다.');
    if (!isInline && onClose) {
      onClose();
    }
  };

  // -------------------------------------------------------------
  // 콘텐츠 렌더링
  // -------------------------------------------------------------
  const content = (
    <div className="bg-white w-full rounded-3xl border border-slate-200 overflow-hidden shadow-xl text-slate-800">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md">
            <Stamp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                직인·도장 & 브랜딩 스튜디오
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30">
                PRO 전자날인
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {firmName} {lawyerName} 변호사 · 법률 전자문서 공인 날인 및 투명 PNG 제작 센터
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

      {/* 4대 메인 탭바 */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 pt-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'generator' as const, label: '✨ 전자 도장 자동 생성기', icon: Stamp, desc: '모두사인 스타일' },
          { id: 'background-remover' as const, label: '✂️ 사진·로고 누끼따기', icon: Sliders, desc: '종이 배경 투명화' },
          { id: 'signature' as const, label: '✍️ 자필 서명 패드', icon: PenTool, desc: '전자싸인 그리기' },
          { id: 'settings' as const, label: '⚙️ 현재 직인 & 자동날인 설정', icon: Layers, desc: 'PDF 문서 연동' },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-3.5 sm:px-4 flex items-center gap-2 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] ${
                isActive
                  ? 'border-indigo-600 text-indigo-700 bg-white/80 rounded-t-xl shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-xl'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 본문 영역 */}
      <div className="p-4 sm:p-6 max-h-[calc(85vh-130px)] overflow-y-auto">
        
        {/* ========================================================= */}
        {/* TAB 1: 전자 직인/도장 자동 생성기 (모두사인 스타일) */}
        {/* ========================================================= */}
        {activeTab === 'generator' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">전자 직인·인장 생성기 (모두사인 스타일)</p>
                <p className="text-indigo-800 leading-relaxed">
                  성함이나 법인명을 입력하고 서체(전서체, 궁서체, 판본체 등)를 선택하면 고해상도 투명 PNG 도장을 즉시 제작할 수 있습니다. 
                  다운로드하여 자유롭게 사용하시거나, 클릭 한 번으로 수임계약서 및 법원 보정서에 공인 직인으로 연동할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 좌측: 컨트롤 패널 (7열) */}
              <div className="lg:col-span-7 space-y-5">
                
                {/* 1. 문구 입력 */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                  <label className="text-xs font-black text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-indigo-600" />
                      도장 각인 문구
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      권장: 4글자 (예: {lawyerName}인)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={genText}
                      onChange={e => setGenText(e.target.value)}
                      placeholder="도장에 새길 이름 (예: 홍길동인)"
                      maxLength={12}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {!genText.endsWith('인') && (
                      <button
                        type="button"
                        onClick={() => setGenText(prev => `${prev}인`)}
                        className="px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                        title="뒤에 '인' 붙이기"
                      >
                        + '인' 추가
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      `${lawyerName || '홍길동'}인`,
                      `${lawyerName || '홍길동'}의인`,
                      `${firmName || '법무법인'}인`,
                      '변호사직인',
                    ].map((presetText, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setGenText(presetText)}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 text-[11px] text-slate-600 hover:text-indigo-700 font-medium transition-colors cursor-pointer"
                      >
                        {presetText}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. 서체(폰트) 디자인 선택 - 5대 서체 */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-indigo-600" />
                      직인 서체(폰트) 디자인 선택
                    </label>
                    <span className="text-[11px] text-indigo-600 font-bold">5가지 전문 도장 서체</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {FONT_PRESETS.map(preset => {
                      const isSelected = genFont === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => setGenFont(preset.id)}
                          className={`p-3 rounded-xl border-2 transition-all cursor-pointer text-left relative ${
                            isSelected
                              ? 'border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {preset.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {preset.description}
                          </p>
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">{preset.category}</span>
                            <span 
                              className="text-sm font-bold text-red-600 tracking-wider"
                              style={{ fontFamily: preset.fontFamily, fontWeight: preset.fontWeight as any }}
                            >
                              印章 {genText.slice(0, 2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 형태 및 테두리 옵션 */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5">
                  <span className="text-xs font-black text-slate-700 block">형태 및 테두리 스타일</span>
                  
                  {/* 형태 */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'round' as const, label: '원형 인장', desc: '개인/변호사 표준' },
                      { id: 'square' as const, label: '정사각형 직인', desc: '법무법인/사무소 직인' },
                      { id: 'oval' as const, label: '타원형 계인', desc: '간인 및 결재용' },
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setGenShape(s.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          genShape === s.id
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs">{s.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* 테두리 및 순서 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] font-bold text-slate-600 block mb-1.5">테두리 굵기</span>
                      <div className="flex gap-1.5">
                        {[
                          { id: 'double' as const, label: '이중 테두리 (추천)' },
                          { id: 'single' as const, label: '단선 테두리' },
                          { id: 'heavy' as const, label: '볼드 중후' },
                        ].map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setGenBorder(b.id)}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] border font-medium cursor-pointer ${
                              genBorder === b.id
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-600 block mb-1.5">4자 배열 순서</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setGenLayoutOrder('traditional')}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] border font-medium cursor-pointer ${
                            genLayoutOrder === 'traditional'
                              ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                          title="전통 인장 순서: 우측열 위→아래, 좌측열 위→아래"
                        >
                          전통 인장순 (우→좌)
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenLayoutOrder('modern')}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] border font-medium cursor-pointer ${
                            genLayoutOrder === 'modern'
                              ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                          title="현대 가로읽기 순서: 좌상, 우상, 좌하, 우하"
                        >
                          현대 순서 (좌→우)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 색상 및 질감 토글 */}
                  <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-slate-600 block mb-1.5">인주 색상</span>
                      <div className="flex items-center gap-2">
                        {INK_COLORS.map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setGenColor(c.hex)}
                            className={`w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                              genColor === c.hex ? 'ring-3 ring-indigo-400 ring-offset-2 scale-110' : 'opacity-85 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          >
                            {genColor === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200">
                      <input 
                        type="checkbox"
                        checked={genInkTexture}
                        onChange={e => setGenInkTexture(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>실제 인주 질감 효과 (번짐·공극 재현)</span>
                    </label>
                  </div>

                </div>

              </div>

              {/* 우측: 실시간 고해상도 프리뷰 및 액션 (5열) */}
              <div className="lg:col-span-5 flex flex-col items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5">
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    실시간 투명 PNG 미리보기
                  </span>
                  <button
                    type="button"
                    onClick={renderSealCanvas}
                    className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    새로고침
                  </button>
                </div>

                {/* 캔버스 프리뷰 컨테이너 (체커보드 투명 배경) */}
                <div className="relative w-64 h-64 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center p-4 bg-white shadow-inner overflow-hidden">
                  {/* 투명 체커보드 배경 패턴 */}
                  <div 
                    className="absolute inset-0 opacity-40 pointer-events-none" 
                    style={{
                      backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                      backgroundSize: '12px 12px',
                    }}
                  />
                  <canvas 
                    ref={genCanvasRef}
                    className="w-56 h-56 object-contain relative z-10 drop-shadow-sm transition-transform hover:scale-105"
                  />
                </div>

                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    600 x 600px 고해상도 투명 PNG 인장
                  </p>
                  <p className="text-[11px] text-slate-500">
                    배경이 투명하여 어떤 전자문서나 양식에도 깔끔하게 인쇄됩니다.
                  </p>
                </div>

                {/* 다운로드 및 공인직인 즉시 등록 버튼 */}
                <div className="w-full space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleApplyAsOfficialSeal}
                    className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>변호사 공인 직인으로 즉시 등록</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadGeneratedSeal}
                    className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>투명 PNG 파일 다운로드 (PC 저장)</span>
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: 사진·로고 누끼따기 (투명 PNG 추출기) */}
        {/* ========================================================= */}
        {activeTab === 'background-remover' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">스마트 종이 배경 제거 (누끼따기) 엔진</p>
                <p className="text-amber-900 leading-relaxed">
                  흰 종이에 도장을 찍어 스마트폰으로 촬영하거나 스캔한 이미지, 또는 배경이 흰색인 로고 이미지를 올려주세요.
                  인공지능 색상 추출 엔진이 종이 배경을 완전히 투명화하고 인주 색상을 또렷하게 살려 투명 PNG 파일로 변환해 드립니다.
                </p>
              </div>
            </div>

            {/* 상단 컨트롤 바 */}
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

            {/* 비교 프리뷰 영역 (좌: 원본, 우: 누끼 결과) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 좌측: 원본 업로드 */}
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
                      <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WebP 사진 지원</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측: 누끼 딴 투명 PNG 결과 */}
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
                  {/* 체커보드 패턴 */}
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
                      <p className="text-xs text-slate-500 font-medium">좌측에 이미지를 업로드하면 실시간으로 누끼가 추출됩니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 미세 조정 슬라이더 */}
            {uploadedRawImg && (
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
                <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  누끼 정밀 튜닝 컨트롤러
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* 종이 배경 제거 밝기 */}
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
                    <p className="text-[11px] text-slate-400">값이 낮을수록 어두운 종이 그림자까지 투명화합니다.</p>
                  </div>

                  {/* 인주 색상 감도 */}
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
                      <p className="text-[11px] text-slate-400">흐릿하거나 옅은 인주 도장도 선명하게 잡아냅니다.</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={colorEnhance}
                      onChange={e => setColorEnhance(e.target.checked)}
                      className="rounded accent-red-600"
                    />
                    <span>인주 색상 보정 (바랜 색상을 생생한 정통 인주 레드로 복원)</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setThreshold(200);
                      setRedSensitivity(28);
                      setColorEnhance(true);
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    기본값 복원
                  </button>
                </div>

                {/* 저장 및 적용 액션 */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadProcessedPng}
                    className="flex-1 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>누끼 딴 투명 PNG 파일 다운로드</span>
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
        {/* TAB 3: 전자 서명(싸인) 그리기 패드 */}
        {/* ========================================================= */}
        {activeTab === 'signature' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-start gap-3 text-xs text-blue-950">
              <FileSignature className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">전자 서명(Sign) 직접 그리기 패드</p>
                <p className="text-blue-900 leading-relaxed">
                  마우스 또는 터치펜, 스마트폰 화면 터치를 이용해 자필 서명을 직접 그려보세요.
                  투명 배경의 벡터 스타일 PNG로 자동 추출되어, 직인 외에 자필 서명이 필요한 서식에 편리하게 활용할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 패드 영역 (8열) */}
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-blue-600" />
                    서명 캔버스 (마우스 또는 터치로 서명하세요)
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
                  {/* 중앙 기준 안내선 */}
                  <div className="absolute inset-x-8 top-1/2 border-b border-dashed border-slate-200 pointer-events-none" />
                  <div className="absolute bottom-3 right-4 text-[10px] text-slate-300 pointer-events-none font-bold">
                    my김변 전자서명 캔버스
                  </div>

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

                <p className="text-[11px] text-slate-400">
                  💡 스마트폰이나 태블릿으로 접속 시 터치펜으로 더욱 정교한 자필 서명을 생성할 수 있습니다.
                </p>
              </div>

              {/* 옵션 및 등록 액션 (4열) */}
              <div className="lg:col-span-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <span className="text-xs font-black text-slate-700 block">펜 도구 설정</span>
                  
                  {/* 펜 색상 */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600 block">펜 색상</span>
                    <div className="flex gap-2">
                      {[
                        { hex: '#0F172A', label: '딥 차콜 블랙' },
                        { hex: '#1E3A8A', label: '정통 인디고 블루' },
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

                  {/* 펜 굵기 */}
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
        {/* TAB 4: 현재 등록된 직인 & 자동날인 설정 */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-xs text-slate-800">
              <Layers className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">현재 등록된 브랜딩 에셋 및 법률 문서 자동 날인</p>
                <p className="text-slate-600 leading-relaxed">
                  등록된 로고, 공인 직인, 자필 서명은 플랫폼 내에서 발급되는 각종 서식에 법적 규격에 맞춰 자동 배치됩니다.
                </p>
              </div>
            </div>

            {/* 3대 에셋 카드 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 1. 법무법인 로고 */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center text-center space-y-3">
                <span className="text-xs font-bold text-slate-700">법무법인/사무소 로고</span>
                <div className="w-32 h-24 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 shadow-xs">
                  {sealInfo.firmLogoUrl ? (
                    <img src={sealInfo.firmLogoUrl} alt="로고" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="text-slate-300 flex flex-col items-center">
                      <ImageIcon className="w-6 h-6 mb-1" />
                      <span className="text-[10px]">미등록 (상단 탭에서 등록)</span>
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

              {/* 2. 변호사 공인 직인 */}
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

              {/* 3. 변호사 자필 서명 */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center text-center space-y-3">
                <span className="text-xs font-bold text-slate-700">변호사 자필 서명 (싸인)</span>
                <div className="w-32 h-24 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 shadow-xs">
                  {sealInfo.signUrl ? (
                    <img src={sealInfo.signUrl} alt="서명" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="text-slate-300 flex flex-col items-center">
                      <FileSignature className="w-6 h-6 mb-1" />
                      <span className="text-[10px]">미등록 (서명 탭에서 작성)</span>
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

            {/* 자동 날인 연동 토글 */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
              <span className="text-xs font-black text-slate-900 block">
                전자문서 발급 시 자동 날인 옵션
              </span>
              <div className="space-y-2.5 text-xs text-slate-700">
                <label className="flex items-center gap-2.5 cursor-pointer font-medium p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox"
                    checked={sealInfo.autoSealContract ?? true}
                    onChange={e => setSealInfo(prev => ({ ...prev, autoSealContract: e.target.checked }))}
                    className="rounded accent-indigo-600 w-4 h-4"
                  />
                  <span><strong>수임계약서</strong>: 의뢰인 계약 체결 및 전자서명 완료 시 변호사 직인 자동 날인</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-medium p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox"
                    checked={sealInfo.autoSealPetition ?? true}
                    onChange={e => setSealInfo(prev => ({ ...prev, autoSealPetition: e.target.checked }))}
                    className="rounded accent-indigo-600 w-4 h-4"
                  />
                  <span><strong>소송위임장 및 사실조회신청서</strong>: 사건 접수 및 조회서 출력 시 대리인 직인 자동 날인</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer font-medium p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox"
                    checked={sealInfo.autoSealCorrection ?? true}
                    onChange={e => setSealInfo(prev => ({ ...prev, autoSealCorrection: e.target.checked }))}
                    className="rounded accent-indigo-600 w-4 h-4"
                  />
                  <span><strong>법원 보정서 및 소명서</strong>: 보정서 표지, 사실확인서, 대리인 제출란에 자동 날인</span>
                </label>
              </div>
            </div>

            {/* 하단 저장 버튼 */}
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

  // 인라인 모드: 설정 탭 페이지 내에 직접 삽입
  if (isInline) {
    return content;
  }

  // 모달 모드: 모달 포털로 팝업 렌더링
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
