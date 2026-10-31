// 개인회생채권자목록 부속서류 1~4 (DC-14) — 해당 채권이 있는 부속서류만 쪽을 만든다
import type React from 'react';
import type { AnnexRows } from '../../../../services/documents/creditorAnnex';

const won = (v?: number) => (typeof v === 'number' ? `${v.toLocaleString('ko-KR')}원` : '');
const dot = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd.slice(0, 4)}. ${Number(ymd.slice(5, 7))}. ${Number(ymd.slice(8, 10))}.` : '');
const th = 'border border-black p-1.5 font-semibold text-center';
const td = 'border border-black p-1.5';

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="court-page bg-white pt-[120px] pb-[113px] px-[60px] w-[210mm] min-w-[210mm] max-w-[210mm] min-h-[297mm] mx-auto text-black font-serif text-[13px] leading-[1.7] box-border shadow-lg print:shadow-none print:border-none" style={{ pageBreakBefore: 'always' }}>
      <h2 className="text-center text-[18px] font-bold mb-6">{title}</h2>
      {children}
    </div>
  );
}

export default function CreditorAnnexPages({ annex }: { annex: AnnexRows }) {
  return (
    <>
      {annex.secured.length > 0 && (
        <Page title="부속서류 1. 별제권부 채권 및 이에 준하는 채권의 내역">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr>
                <th className={th}>채권번호</th><th className={th}>채권자</th><th className={th}>담보권 종류·순위</th><th className={th}>목적물</th>
                <th className={th}>채권최고액</th><th className={th}>선순위 담보액</th><th className={th}>목적물 평가액</th>
                <th className={th}>별제권 행사로 변제받을 예상액</th><th className={th}>예정부족액</th>
              </tr>
            </thead>
            <tbody>
              {annex.secured.map(r => (
                <tr key={`s-${r.no}-${r.name}`}>
                  <td className={`${td} text-center`}>{r.no}</td><td className={td}>{r.name}</td><td className={td}>{[r.right, r.rank].filter(Boolean).join(' ')}</td>
                  <td className={td}>{r.collateral}</td><td className={`${td} text-right`}>{won(r.maxAmount)}</td><td className={`${td} text-right`}>{won(r.prior)}</td>
                  <td className={`${td} text-right`}>{won(r.appraisal)}</td><td className={`${td} text-right`}>{won(r.expectedRecovery)}</td><td className={`${td} text-right`}>{won(r.shortage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Page>
      )}
      {annex.disputed.length > 0 && (
        <Page title="부속서류 2. 다툼이 있거나 예상되는 채권의 내역">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr><th className={th}>채권번호</th><th className={th}>채권자</th><th className={th}>채권자 주장액</th><th className={th}>신청인 주장액</th><th className={th}>다툼의 내용</th><th className={th}>소송 진행</th></tr>
            </thead>
            <tbody>
              {annex.disputed.map(r => (
                <tr key={`d-${r.no}-${r.name}`}>
                  <td className={`${td} text-center`}>{r.no}</td><td className={td}>{r.name}</td><td className={`${td} text-right`}>{won(r.creditorClaim)}</td>
                  <td className={`${td} text-right`}>{won(r.debtorClaim)}</td><td className={td}>{r.reason}</td><td className={td}>{r.lawsuits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Page>
      )}
      {annex.assignment.length > 0 && (
        <Page title="부속서류 3. 전부명령의 내역">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr><th className={th}>채권번호</th><th className={th}>채권자</th><th className={th}>법원·사건번호</th><th className={th}>결정일</th><th className={th}>제3채무자 송달일</th><th className={th}>제3채무자</th><th className={th}>전부금액</th></tr>
            </thead>
            <tbody>
              {annex.assignment.map(r => (
                <tr key={`a-${r.no}-${r.name}`}>
                  <td className={`${td} text-center`}>{r.no}</td><td className={td}>{r.name}</td><td className={td}>{r.courtCase}</td><td className={td}>{dot(r.decidedOn)}</td>
                  <td className={td}>{dot(r.servedOn)}</td><td className={td}>{r.garnishee}</td><td className={`${td} text-right`}>{won(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Page>
      )}
      {annex.other.length > 0 && (
        <Page title="부속서류 4. 기타 (신청인이 보증인인 경우의 주채무 내용 등)">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr><th className={th}>채권번호</th><th className={th}>채권자</th><th className={th}>주채무자</th><th className={th}>보증한 금액</th><th className={th}>보증일</th><th className={th}>내용</th></tr>
            </thead>
            <tbody>
              {annex.other.map(r => (
                <tr key={`o-${r.no}-${r.name}`}>
                  <td className={`${td} text-center`}>{r.no}</td><td className={td}>{r.name}</td><td className={td}>{r.principalDebtor}</td>
                  <td className={`${td} text-right`}>{won(r.amount)}</td><td className={td}>{dot(r.date)}</td><td className={td}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Page>
      )}
    </>
  );
}
