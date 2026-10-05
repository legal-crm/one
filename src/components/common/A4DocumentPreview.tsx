import React from 'react';
import { Printer, ShieldCheck, FileCheck, CheckCircle2 } from 'lucide-react';
import { HighlightedDocumentViewer } from './HighlightedDocumentViewer';
import type { ContractDocType } from '../../types';
import { CONTRACT_DOC_TYPES } from '../../types';

interface A4DocumentPreviewProps {
  title: string;
  docType: ContractDocType;
  content: string;
  contractContext: {
    clientName: string;
    clientPhone: string;
    clientAddress?: string;
    lawyerName: string;
    lawFirmName: string;
    totalFee?: number;
    contractDate?: string;
  };
  signatureRequired?: 'client' | 'lawyer' | 'both' | 'none';
  requiredConfirmationText?: string;
  clientSignature?: string;
  lawyerSignature?: string;
  orderIndex?: number;
}

/**
 * A4DocumentPreview
 * 대한변호사협회 및 법원 제출용 표준 A4 공문서 규격(210mm × 297mm 비율)을 갖춘
 * 정식 법률 문서 뷰어 컴포넌트
 */
export const A4DocumentPreview: React.FC<A4DocumentPreviewProps> = ({
  title,
  docType,
  content,
  contractContext,
  signatureRequired = 'both',
  requiredConfirmationText,
  clientSignature,
  lawyerSignature,
  orderIndex = 0,
}) => {
  const docCfg = CONTRACT_DOC_TYPES[docType] || { label: title, emoji: '📄' };
  const clientName = contractContext.clientName || '의뢰인';
  const clientPhone = contractContext.clientPhone || '-';
  const clientAddress = contractContext.clientAddress || '기재 생략';
  const lawFirmName = contractContext.lawFirmName || '법무법인(유한)';
  const lawyerName = contractContext.lawyerName || '담당변호사';
  const contractDate = contractContext.contractDate || new Date().toISOString().slice(0, 10);

  // 한국어 날짜 포맷 (예: 2026년 10월 5일)
  const formatKoreanDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch {
      return dateStr;
    }
  };

  // 정식 문서 인쇄 핸들러
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
      return;
    }

    const safeEsc = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 본문 형광펜/볼드 파싱
    const formattedContent = content
      .split('\n')
      .map(line => {
        if (!line.trim()) return '<div style="height: 12px;"></div>';
        let parsed = safeEsc(line);
        // ==g:연두==
        parsed = parsed.replace(/==g:(.*?)==/g, '<mark style="background:#a7f3d0; padding:1px 4px; border-bottom:2px solid #10b981; font-weight:bold;">$1</mark>');
        // ==o:주황==
        parsed = parsed.replace(/==o:(.*?)==/g, '<mark style="background:#fed7aa; padding:1px 4px; border-bottom:2px solid #f97316; font-weight:bold;">$1</mark>');
        // ==노랑==
        parsed = parsed.replace(/==(.*?)==/g, '<mark style="background:#fef08a; padding:1px 4px; border-bottom:2px solid #eab308; font-weight:bold;">$1</mark>');
        // **볼드**
        parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:800; color:#0f172a;">$1</strong>');
        return `<p style="margin: 4px 0; line-height: 1.7; font-size: 13px;">${parsed}</p>`;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${safeEsc(title)} - ${safeEsc(clientName)}</title>
          <style>
            @page {
              size: A4;
              margin: 18mm 15mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Malgun Gothic', sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 0;
              line-height: 1.6;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .a4-sheet {
              width: 100%;
              max-width: 210mm;
              margin: 0 auto;
              padding: 10px 20px;
              box-sizing: border-box;
            }
            .doc-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 24px;
            }
            .firm-name {
              font-size: 13px;
              font-weight: 800;
              color: #1e3a5f;
              letter-spacing: -0.5px;
            }
            .meta-info {
              font-size: 11px;
              color: #64748b;
              font-family: monospace;
              text-align: right;
            }
            .doc-title {
              font-size: 24px;
              font-weight: 900;
              text-align: center;
              letter-spacing: 4px;
              margin: 20px 0 28px 0;
              color: #0f172a;
            }
            .parties-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
              font-size: 12px;
            }
            .parties-table th, .parties-table td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              text-align: left;
            }
            .parties-table th {
              background: #f8fafc;
              font-weight: bold;
              width: 22%;
              color: #334155;
            }
            .content-area {
              min-height: 380px;
              white-space: pre-wrap;
              font-size: 13px;
              line-height: 1.8;
              text-align: justify;
              word-break: keep-all;
            }
            .confirmation-box {
              background: #fffbeb;
              border: 1px solid #fde68a;
              border-radius: 6px;
              padding: 12px;
              margin: 20px 0;
              font-size: 12px;
            }
            .closing-statement {
              text-align: center;
              font-size: 13px;
              font-weight: 600;
              margin: 32px 0 16px 0;
              color: #334155;
            }
            .date-display {
              text-align: center;
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 28px;
            }
            .sign-grid {
              display: flex;
              justify-content: space-between;
              margin-top: 20px;
              gap: 20px;
            }
            .sign-box {
              flex: 1;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 12px;
              font-size: 12px;
            }
            .sign-stamp-area {
              height: 52px;
              border: 1px dashed #cbd5e1;
              margin-top: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #94a3b8;
              font-size: 11px;
            }
            .footer-note {
              margin-top: 40px;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="a4-sheet">
            <div class="doc-header">
              <div class="firm-name">${safeEsc(lawFirmName)} · ${safeEsc(lawyerName)} 변호사</div>
              <div class="meta-info">
                <span>[제${(orderIndex ?? 0) + 1}호 서식] ${safeEsc(docCfg.label)}</span>
              </div>
            </div>

            <div class="doc-title">${safeEsc(title)}</div>

            <table class="parties-table">
              <tr>
                <th>위임인 (갑)</th>
                <td><strong>${safeEsc(clientName)}</strong> (연락처: ${safeEsc(clientPhone)})</td>
                <th>수임인 (을)</th>
                <td><strong>${safeEsc(lawFirmName)}</strong> ${safeEsc(lawyerName)} 변호사</td>
              </tr>
            </table>

            <div class="content-area">
              ${formattedContent}
            </div>

            ${
              requiredConfirmationText
                ? `<div class="confirmation-box">
                    <strong>[필수 자필확약]</strong> 의뢰인은 본 서식의 중요 조항에 대해 설명을 듣고 이해하였음을 확인하며 다음 문구를 자필(전자서명)로 확약합니다:<br/>
                    <span style="display:inline-block; margin-top:6px; font-weight:800; color:#92400e; text-decoration:underline;">
                      "${safeEsc(requiredConfirmationText)}"
                    </span>
                  </div>`
                : ''
            }

            <div class="closing-statement">
              위 당사자는 상기 약정(계약)의 내용을 틀림없이 확인하였으며, 신의성실의 원칙에 따라 본 문서를 체결하고 이에 서명·날인합니다.
            </div>

            <div class="date-display">${formatKoreanDate(contractDate)}</div>

            <div class="sign-grid">
              ${
                signatureRequired !== 'lawyer'
                  ? `<div class="sign-box">
                      <div><strong>위임인 (갑):</strong> ${safeEsc(clientName)} (서명/날인)</div>
                      <div class="sign-stamp-area">(서명 또는 도장)</div>
                    </div>`
                  : ''
              }
              ${
                signatureRequired !== 'client'
                  ? `<div class="sign-box" style="text-align: right;">
                      <div><strong>수임인 (을):</strong> ${safeEsc(lawFirmName)} ${safeEsc(lawyerName)} (직인)</div>
                      <div class="sign-stamp-area" style="color:#ef4444; border-color:#fca5a5; margin-left:auto; width:130px;">(법률사무소 직인)</div>
                    </div>`
                  : ''
              }
            </div>

            <div class="footer-note">
              <span>* 본 문서는 전자문서 및 전자서명법 제3조에 따라 공인된 전자서식으로서 실물 계약서와 동일한 법적 효력을 갖습니다.</span>
              <span>페이지 1 / 1</span>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-3">
      {/* 1. 상단 툴바: 서식 규격 안내 및 즉시 인쇄 버튼 */}
      <div className="flex items-center justify-between px-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold">
            <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>대한변협 표준 A4 공문서 규격 (210mm × 297mm)</span>
          </span>
          <span className="hidden sm:inline-block text-slate-400 font-medium text-[11px]">
            인쇄 및 모바일 전자서명 시 실제 고객에게 노출되는 형태입니다
          </span>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          title="A4 표준 서식 그대로 인쇄 또는 PDF로 저장합니다"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>인쇄 / PDF 출력</span>
        </button>
      </div>

      {/* 2. 회색 데스크 배경 위의 실제 백색 A4 용지 렌더링 영역 */}
      <div className="bg-slate-200/80 p-3 sm:p-6 md:p-8 rounded-2xl flex justify-center overflow-y-auto max-h-[580px] shadow-inner border border-slate-300">
        <div className="w-full max-w-[660px] bg-white shadow-2xl border border-slate-300/80 p-6 sm:p-12 min-h-[880px] flex flex-col justify-between text-slate-900 font-sans relative select-text rounded-xs">
          
          {/* A4 상단 헤더 */}
          <div>
            <div className="flex items-end justify-between border-b-2 border-slate-900 pb-2 mb-6">
              <div>
                <span className="text-xs sm:text-sm font-extrabold text-[#1E3A5F] tracking-tight">
                  {lawFirmName}
                </span>
                <span className="text-[11px] text-slate-500 font-medium ml-2">
                  담당: {lawyerName} 변호사
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono text-right">
                <span className="font-bold text-slate-700">[제{(orderIndex ?? 0) + 1}호 서식]</span> {docCfg.label}
              </div>
            </div>

            {/* 정식 문서 대제목 */}
            <div className="my-6 text-center">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-widest leading-tight">
                {title}
              </h1>
              <div className="w-12 h-0.5 bg-slate-900 mx-auto mt-2" />
            </div>

            {/* 당사자 표시 테이블 */}
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-6 text-xs">
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 font-bold text-slate-700 w-24 p-2.5 border-r border-slate-200">
                      위임인 (갑)
                    </td>
                    <td className="p-2.5 text-slate-800">
                      <strong className="text-slate-900 font-bold">{clientName}</strong>
                      <span className="text-slate-500 ml-2">({clientPhone})</span>
                      {clientAddress && clientAddress !== '기재 생략' && (
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">{clientAddress}</div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 font-bold text-slate-700 w-24 p-2.5 border-r border-slate-200">
                      수임인 (을)
                    </td>
                    <td className="p-2.5 text-slate-800">
                      <strong className="text-slate-900 font-bold">{lawFirmName}</strong>
                      <span className="text-slate-500 ml-2">담당변호사 {lawyerName}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 본문 내용 (형광펜, 볼드, 조항 정렬 뷰어) */}
            <div className="text-xs sm:text-[13px] leading-relaxed text-slate-800 space-y-2 py-2">
              <HighlightedDocumentViewer content={content} />
            </div>

            {/* 고객 직접 자필 확약문구 (있을 경우) */}
            {requiredConfirmationText && (
              <div className="mt-6 p-4 bg-amber-50/90 border border-amber-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>[필수 자필확약 사항]</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  의뢰인은 본 계약의 중요 약정 사항을 충분히 숙지하였으며, 스마트폰 전자서명 시 아래 문구를 직접 자필로 기재(타이핑)하여 확인합니다:
                </p>
                <div className="mt-2 p-2 bg-white rounded border border-amber-300 font-bold text-amber-950 font-mono">
                  "{requiredConfirmationText}"
                </div>
              </div>
            )}
          </div>

          {/* A4 하단: 체결일자 및 서명 날인 블록 */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-center text-xs font-semibold text-slate-600 mb-3">
              위 당사자는 상기 약정(계약)의 내용을 틀림없이 확인하였으며, 신의성실의 원칙에 따라 본 문서를 체결하고 이에 서명·날인합니다.
            </p>
            <div className="text-center font-bold text-xs sm:text-sm text-slate-900 mb-6 font-mono">
              {formatKoreanDate(contractDate)}
            </div>

            {/* 2열 서명란 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {signatureRequired !== 'lawyer' && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  <div className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>위임인 (갑): <strong className="text-slate-900">{clientName}</strong></span>
                    <span className="text-[10px] text-slate-400">(인 / 서명)</span>
                  </div>
                  <div className="h-14 border border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-white">
                    {clientSignature ? (
                      <img src={clientSignature} alt="의뢰인 서명" className="max-h-12 object-contain" />
                    ) : (
                      <span className="text-[11px] text-slate-400 font-mono">
                        (모바일 전자서명 입력란)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {signatureRequired !== 'client' && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  <div className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>수임인 (을): <strong className="text-slate-900">{lawyerName}</strong></span>
                    <span className="text-[10px] text-rose-500 font-bold">(직인 날인)</span>
                  </div>
                  <div className="h-14 border border-dashed border-rose-300 rounded-lg flex items-center justify-center bg-white/80">
                    {lawyerSignature ? (
                      <img src={lawyerSignature} alt="변호사 직인" className="max-h-12 object-contain" />
                    ) : (
                      <span className="text-[11px] text-rose-500 font-serif font-bold tracking-widest">
                        [{lawFirmName} 직인]
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 공문서 최하단 워터마크/각주 */}
            <div className="mt-8 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>* 본 문서는 전자문서 및 전자서명법 제3조에 따라 공인된 전자서식으로서 실물 계약서와 동일한 법적 효력을 갖습니다.</span>
              <span className="font-mono">페이지 1 / 1</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
export default A4DocumentPreview;
