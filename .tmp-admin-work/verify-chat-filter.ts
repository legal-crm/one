/**
 * 변호사 채팅 필터(filterAndSanitizeMessagesForLawyer) 문구 규칙 확인 — 실제 저장 문구로 검사한다.
 *
 * 실행 (저장소 루트):
 *   npx esbuild .tmp-admin-work/verify-chat-filter.ts --bundle --platform=node --format=esm --outfile=.tmp-admin-work/verify-chat-filter.mjs
 *   node .tmp-admin-work/verify-chat-filter.mjs
 *
 * 비교용 이전 코드: .tmp-admin-work/old-head/ (git HEAD 86aeecb의 chatSelectors.ts 사본)
 */
import type { ConsultMessage, ConsultRequest, User } from '../src/types';
import {
  CLIENT_REQUEST_NOTICE_TAIL,
  buildLawyerChatThreads,
  classifySystemText,
  filterAndSanitizeMessagesForLawyer,
} from '../src/components/lawyer/chat/chatSelectors';
import { filterAndSanitizeMessagesForLawyer as oldFilter } from './old-head/src/components/lawyer/chat/chatSelectors';
import {
  LAWYER_REQUEST_RECEIVED_NOTICE,
  OPEN_REQUEST_CLIENT_NOTICE,
  buildClientRequestNotice,
} from '../src/components/client/consultFlow';
import { getTargetLawyerColumnState, setTargetLawyerColumnState } from '../src/services/consultMessageSchema';

// ── 실제 저장 문구 (ChatView.tsx · ClientRole.tsx · LawyerRole.tsx에서 그대로 가져옴) ──
const PHONE = '[System] 📞 의뢰인이 전화상담을 요청했습니다. 채팅으로 통화 가능한 시간을 조율해 주세요.';
const CHOSEN = '[System] 🎉 의뢰인이 귀하를 전담 변호사로 선임하였습니다!';
const OTHER_CHOSEN = '[System] 📋 의뢰인이 다른 변호사를 전담으로 선임하였습니다. 상담에 참여해 주셔서 감사합니다.';
const compareStart = (name: string) => `${name} 변호사님과 비교 상담을 시작합니다.`;
const accepted = (name: string) => `${name} 변호사님의 제안서를 수락하셨습니다. 이제 1:1 전담 상담을 시작할 수 있습니다.`;
const cancelOne = (name: string) => `의뢰인이 ${name} 변호사님에 대한 상담 요청을 취소하였습니다.`;
const CANCEL_ALL = '의뢰인이 모든 변호사에 대한 상담 요청을 취소하였습니다.';
const joined = (name: string) => `[System] ${name} 변호사가 상담에 참여하였습니다.`;

const A: User = { id: 'lawyer-a', name: '김우진', role: 'LAWYER' } as unknown as User;
const B: User = { id: 'lawyer-b', name: '이소민', role: 'LAWYER' } as unknown as User;
const C: User = { id: 'lawyer-c', name: '박성현', role: 'LAWYER' } as unknown as User;

let seq = 0;
const at = (min: number) => new Date(Date.UTC(2026, 5, 1, 9, min)).toISOString();
/** 서버에서 온 메시지처럼 대상 정보 없이 만든다 (target을 주면 대상 칸이 있는 서버·같은 기기 메시지) */
function sys(message: string, target?: string, extra: Partial<ConsultMessage> = {}): ConsultMessage {
  seq += 1;
  return { id: `m${seq}`, consultRequestId: 'req-x', senderType: 'system', senderId: 'system', senderName: '시스템 안내', message, createdAt: at(seq), ...(target ? { targetLawyerId: target } : {}), ...extra };
}
function client(message: string, target?: string): ConsultMessage {
  seq += 1;
  return { id: `m${seq}`, consultRequestId: 'req-x', senderType: 'client', senderId: 'client-temp', senderName: '의뢰인 (본인)', message, createdAt: at(seq), ...(target ? { targetLawyerId: target } : {}) };
}
function lawyerMsg(l: User, message: string): ConsultMessage {
  seq += 1;
  return { id: `m${seq}`, consultRequestId: 'req-x', senderType: 'lawyer', senderId: l.id, senderName: l.name, message, createdAt: at(seq) };
}
function req(patch: Partial<ConsultRequest>): ConsultRequest {
  return { id: 'req-x', clientId: 'client-1', clientName: '의뢰인', phone: '', requestType: 'direct_multi', status: 'requested', createdAt: at(0), title: '상담', content: '', ...patch } as ConsultRequest;
}

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? `\n      → ${JSON.stringify(detail)}` : ''}`);
}
const texts = (list: ConsultMessage[]) => list.map(m => m.message);
const show = (label: string, list: ConsultMessage[]) => console.log(`      ${label}: ${JSON.stringify(texts(list))}`);

console.log('── 0. 문구 상수 ──');
const namedNotice = buildClientRequestNotice(['김우진', '이소민'], 2);
const countNotice = buildClientRequestNotice([], 2);
check('buildClientRequestNotice(이름형)에 꼬리 상수가 들어 있다', namedNotice.includes(CLIENT_REQUEST_NOTICE_TAIL), namedNotice);
check('buildClientRequestNotice(인원형)에 꼬리 상수가 들어 있다', countNotice.includes(CLIENT_REQUEST_NOTICE_TAIL), countNotice);

console.log('\n── 1. 의뢰인 전용 안내 (대상 정보 없음) ──');
{
  const r = req({ selectedLawyerIds: [A.id, B.id] });
  const msgs = [sys(namedNotice), sys(countNotice), sys(OPEN_REQUEST_CLIENT_NOTICE), sys('상담 요청이 선택하신 변호사님께 전달되었습니다.'), sys(LAWYER_REQUEST_RECEIVED_NOTICE), sys(LAWYER_REQUEST_RECEIVED_NOTICE)];
  const beforeA = oldFilter(msgs, A, r);
  const afterA = filterAndSanitizeMessagesForLawyer(msgs, A, r);
  const afterB = filterAndSanitizeMessagesForLawyer(msgs, B, r);
  const afterC = filterAndSanitizeMessagesForLawyer(msgs, C, r);
  show('이전 A', beforeA);
  show('이후 A', afterA);
  check('이전 코드: A에게 이름형 안내가 다른 변호사 이름(이소민)과 함께 보였다(재현)', beforeA.some(m => m.message.includes('이소민')));
  check('A: 의뢰인 전용 안내 3종이 모두 숨겨진다', !afterA.some(m => m.message.includes('보냈습니다') || m.message.includes('공개 요청을 올렸습니다') || m.message.includes('선택하신')), texts(afterA));
  check('A: 요청 접수 안내는 1회만', texts(afterA).filter(t => t === LAWYER_REQUEST_RECEIVED_NOTICE).length === 1, texts(afterA));
  check('B: 요청 접수 안내 1회, 다른 이름 노출 없음', texts(afterB).length === 1 && texts(afterB)[0] === LAWYER_REQUEST_RECEIVED_NOTICE, texts(afterB));
  check('C(요청받지 않음): 아무것도 보이지 않는다', afterC.length === 0, texts(afterC));
}

console.log('\n── 2. 전화상담 요청 (대상 정보 없음) ──');
{
  const r = req({ status: 'counseling', selectedLawyerId: A.id, selectedLawyerIds: [A.id, B.id], acceptedLawyerIds: [A.id, B.id] });
  const msgs = [client('안녕하세요'), sys(PHONE)];
  const beforeA = oldFilter(msgs, A, r);
  const beforeB = oldFilter(msgs, B, r);
  const afterA = filterAndSanitizeMessagesForLawyer(msgs, A, r);
  const afterB = filterAndSanitizeMessagesForLawyer(msgs, B, r);
  show('이전 A', beforeA);
  show('이전 B', beforeB);
  show('이후 A', afterA);
  show('이후 B', afterB);
  check('이전 코드: A에게 일반 접수 안내로 바뀌어 attention이 아니었다(재현)', classifySystemText(beforeA[beforeA.length - 1]?.message) !== 'attention');
  check('A(상담 변호사): 원문 그대로, attention', afterA[afterA.length - 1]?.message === PHONE && classifySystemText(PHONE) === 'attention');
  check('B(선임되지 않음): 전화상담 요청이 보이지 않는다', !afterB.some(m => m.message.includes('전화상담')), texts(afterB));
  const [threadA] = buildLawyerChatThreads([r], msgs, A);
  check('A 스레드: needsReply = true', threadA?.needsReply === true, threadA && { needsReply: threadA.needsReply });

  const r1 = req({ status: 'comparing', acceptedLawyerIds: [A.id] });
  check('selectedLawyerId 없음 + 대화 중 변호사 A 한 명: A에게 보인다', filterAndSanitizeMessagesForLawyer([sys(PHONE)], A, r1).length === 1);
  check('selectedLawyerId 없음 + 대화 중 변호사 A 한 명: B에게는 안 보인다', filterAndSanitizeMessagesForLawyer([sys(PHONE)], B, r1).length === 0);
  const r2 = req({ status: 'comparing', acceptedLawyerIds: [A.id, B.id, A.id] });
  check('selectedLawyerId 없음 + 대화 중 2명: 누구에게도 안 보인다', filterAndSanitizeMessagesForLawyer([sys(PHONE)], A, r2).length === 0 && filterAndSanitizeMessagesForLawyer([sys(PHONE)], B, r2).length === 0);
  check('대상 지정(targetLawyerId=B)이면 B에게 보인다(3-1 규칙)', filterAndSanitizeMessagesForLawyer([sys(PHONE, B.id)], B, r).length === 1);

  const dup = filterAndSanitizeMessagesForLawyer([sys(PHONE), sys(PHONE)], A, r);
  check('연달아 저장된 같은 요청은 1회', dup.length === 1, texts(dup));
  const again = [sys(PHONE), lawyerMsg(A, '내일 오후 3시 괜찮으세요?'), sys(PHONE)];
  const againA = filterAndSanitizeMessagesForLawyer(again, A, r);
  const [threadAgain] = buildLawyerChatThreads([r], again, A);
  check('답변 뒤 다시 요청하면 다시 보이고 needsReply가 켜진다', againA.length === 3 && threadAgain?.needsReply === true, texts(againA));
}

console.log('\n── 3. 전담 선임 안내 (대상 정보 없음) ──');
{
  const r = req({ status: 'counseling', selectedLawyerId: A.id, acceptedLawyerIds: [A.id, B.id, C.id] });
  const msgs = [sys(CHOSEN), sys(OTHER_CHOSEN), sys(OTHER_CHOSEN)];
  const beforeB = oldFilter(msgs, B, r);
  const afterA = filterAndSanitizeMessagesForLawyer(msgs, A, r);
  const afterB = filterAndSanitizeMessagesForLawyer(msgs, B, r);
  show('이전 B', beforeB);
  show('이후 A', afterA);
  show('이후 B', afterB);
  check('이전 코드: B에게 "귀하를 전담 변호사로 선임"이 보였다(재현)', beforeB.some(m => m.message.includes('귀하를')));
  check('A(선임됨): "귀하를 선임"만 1회, "다른 변호사" 안내 없음', afterA.length === 1 && afterA[0].message === CHOSEN, texts(afterA));
  check('B(선임되지 않음): "다른 변호사를 전담으로 선임" 1회만', afterB.length === 1 && afterB[0].message === OTHER_CHOSEN, texts(afterB));
}

console.log('\n── 4. 요청 접수 안내 — 요청받지 않은 변호사 ──');
{
  // 공개 요청에 C가 제안서를 보냄 (C는 selectedLawyerIds에 없음)
  const r = req({ requestType: 'open', selectedLawyerIds: [A.id], proposals: [{ lawyerId: C.id } as any] });
  const msgs = [sys(LAWYER_REQUEST_RECEIVED_NOTICE)];
  check('이전 코드: C에게도 보였다(재현)', oldFilter(msgs, C, r).length === 1);
  check('C: 보이지 않는다', filterAndSanitizeMessagesForLawyer(msgs, C, r).length === 0);
  check('A(요청받음): 보인다', filterAndSanitizeMessagesForLawyer(msgs, A, r).length === 1);
  check('selectedLawyerId만 A여도 보인다', filterAndSanitizeMessagesForLawyer(msgs, A, req({ selectedLawyerId: A.id })).length === 1);
}

console.log('\n── 5. 대상 정보 없는 의뢰인 대화 메시지 (비교 상담 2명 이상) ──');
{
  const multi = req({ status: 'comparing', acceptedLawyerIds: [A.id, B.id] });
  const single = req({ status: 'comparing', acceptedLawyerIds: [A.id] });
  const msgs = [client('대상 없는 과거 메시지'), client('A에게', A.id), client('B에게', B.id)];
  setTargetLawyerColumnState('unknown');
  const unknownA = filterAndSanitizeMessagesForLawyer(msgs, A, multi);
  check("칸 확인 전('unknown'): 대상 없는 메시지를 숨기지 않는다", texts(unknownA).join('|') === '대상 없는 과거 메시지|A에게', texts(unknownA));
  setTargetLawyerColumnState('missing');
  check("칸 없음('missing'): 숨기지 않는다", filterAndSanitizeMessagesForLawyer(msgs, A, multi).length === 2);
  setTargetLawyerColumnState('present');
  const presentA = filterAndSanitizeMessagesForLawyer(msgs, A, multi);
  const presentB = filterAndSanitizeMessagesForLawyer(msgs, B, multi);
  check("칸 있음('present') + 2명: A에게 대상 없는 메시지 숨김, 자기 대상만", texts(presentA).join('|') === 'A에게', texts(presentA));
  check("칸 있음('present') + 2명: B도 자기 대상만", texts(presentB).join('|') === 'B에게', texts(presentB));
  check("칸 있음('present') + 1명: 대상 없는 메시지도 보인다", filterAndSanitizeMessagesForLawyer(msgs, A, single).length === 2);
  check('옵션 false로 끄면 숨기지 않는다', filterAndSanitizeMessagesForLawyer(msgs, A, multi, { hideUntargetedClientMessagesWhenMultiple: false }).length === 2);
  setTargetLawyerColumnState('unknown');
  check('옵션 true로 켜면 칸 확인 전에도 숨긴다', filterAndSanitizeMessagesForLawyer(msgs, A, multi, { hideUntargetedClientMessagesWhenMultiple: true }).length === 1);
  check('상태 되돌림 확인', getTargetLawyerColumnState() === 'unknown');
}

console.log('\n── 6. 기존 규칙 유지 (대상 정보 없음) ──');
{
  const r = req({ status: 'comparing', selectedLawyerIds: [A.id, B.id], acceptedLawyerIds: [A.id, B.id] });
  const msgs = [
    sys(compareStart('김우진')), sys(compareStart('이소민')),
    sys(accepted('김우진')),
    sys(cancelOne('이소민')), sys(CANCEL_ALL),
    sys(joined('김우진'), undefined, { senderType: 'lawyer', senderName: 'System' }),
    sys('client-only 대상 안내', 'client-only'),
  ];
  const oldA = texts(oldFilter(msgs, A, r));
  const oldB = texts(oldFilter(msgs, B, r));
  const newA = texts(filterAndSanitizeMessagesForLawyer(msgs, A, r));
  const newB = texts(filterAndSanitizeMessagesForLawyer(msgs, B, r));
  console.log(`      이후 A: ${JSON.stringify(newA)}`);
  console.log(`      이후 B: ${JSON.stringify(newB)}`);
  check('A: 이전 코드와 결과가 같다', JSON.stringify(oldA) === JSON.stringify(newA), { oldA, newA });
  check('B: 이전 코드와 결과가 같다', JSON.stringify(oldB) === JSON.stringify(newB), { oldB, newB });
}

console.log('\n── 7. 대화 열림 여부 (스레드 요약) ──');
{
  const proposedOnly = req({ status: 'requested', selectedLawyerIds: [A.id], proposals: [{ lawyerId: A.id } as any] });
  const [t1] = buildLawyerChatThreads([proposedOnly], [], A);
  check("제안서만 보냄: chatOpen=false, hasMyProposal=true", t1?.chatOpen === false && t1?.hasMyProposal === true, t1 && { chatOpen: t1.chatOpen, hasMyProposal: t1.hasMyProposal });
  const started = req({ status: 'comparing', selectedLawyerIds: [A.id], acceptedLawyerIds: [A.id], proposals: [{ lawyerId: A.id } as any] });
  const [t2] = buildLawyerChatThreads([started], [], A);
  check("의뢰인이 '상담 시작'을 누름: chatOpen=true", t2?.chatOpen === true);
  const requestedOnly = req({ status: 'requested', selectedLawyerIds: [A.id] });
  const [t3] = buildLawyerChatThreads([requestedOnly], [], A);
  check('요청만 받음(제안서 전): chatOpen=false, hasMyProposal=false', t3?.chatOpen === false && t3?.hasMyProposal === false);
}

console.log(`\n결과: ${pass}건 통과, ${fail}건 실패`);
if (fail > 0) process.exitCode = 1;
