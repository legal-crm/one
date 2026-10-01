// src/constants/consultStatus.ts
var CONSULT_STATUS_META = {
  requested: { label: "\uC2E0\uADDC \uC694\uCCAD", group: "intake" },
  responding: { label: "\uC81C\uC548 \uAC80\uD1A0\uC911", group: "intake" },
  comparing: { label: "\uBE44\uAD50 \uC0C1\uB2F4\uC911", group: "comparing" },
  counseling: { label: "\uC0C1\uB2F4 \uC9C4\uD589\uC911", group: "counseling" },
  contracted: { label: "\uC218\uC784 \uACC4\uC57D", group: "retained" },
  document: { label: "\uC11C\uB958 \uC900\uBE44", group: "retained" },
  filed: { label: "\uC811\uC218 \uC644\uB8CC", group: "retained" },
  commenced: { label: "\uAC1C\uC2DC \uACB0\uC815", group: "retained" },
  repaying: { label: "\uBCC0\uC81C \uC911", group: "retained" },
  discharged: { label: "\uBA74\uCC45 \uD655\uC815", group: "discharged" },
  closed: { label: "\uC0C1\uB2F4 \uC885\uB8CC", group: "closed" },
  cancelled: { label: "\uC694\uCCAD \uCDE8\uC18C", group: "closed" }
};
var UNKNOWN_STATUS = { label: "\uC0C1\uB2F4\uC911", group: "intake" };
function getConsultStatusMeta(status) {
  if (!status) return UNKNOWN_STATUS;
  return CONSULT_STATUS_META[status] || UNKNOWN_STATUS;
}
function isClosedConsultStatus(status) {
  return getConsultStatusMeta(status).group === "closed";
}

// src/components/client/consultFlow.ts
var LAWYER_REQUEST_RECEIVED_NOTICE = "\uC758\uB8B0\uC778\uC73C\uB85C\uBD80\uD130 1:1 \uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC804 \uC9C4\uB2E8 \uB9AC\uD3EC\uD2B8\uB97C \uAC80\uD1A0\uD558\uACE0 \uC0C1\uB2F4\uC744 \uC9C4\uD589\uD574 \uC8FC\uC138\uC694.";
var PENDING_LAWYER_REQUEST_TTL_MS = 30 * 60 * 1e3;
var OPEN_REQUEST_CLIENT_NOTICE = "\uACF5\uAC1C \uC694\uCCAD\uC744 \uC62C\uB838\uC2B5\uB2C8\uB2E4. \uB4F1\uB85D\xB7\uC2B9\uC778\uB41C \uBCC0\uD638\uC0AC\uAC00 \uC694\uCCAD\uC744 \uD655\uC778\uD558\uACE0 \uC81C\uC548\uC11C\uB97C \uBCF4\uB0B4\uBA74 \uC774\uACF3\uC5D0\uC11C \uBE44\uAD50\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
function buildClientRequestNotice(lawyerNames, count) {
  const who = lawyerNames.length === count && count > 0 ? `${lawyerNames.join(", ")} \uBCC0\uD638\uC0AC\uB2D8` : `\uC120\uD0DD\uD558\uC2E0 \uBCC0\uD638\uC0AC ${count}\uBA85`;
  return `${who}\uC5D0\uAC8C \uC0C1\uB2F4 \uC694\uCCAD\uC744 \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4. \uBCC0\uD638\uC0AC\uAC00 \uCC44\uBB34 \uD604\uD669\uC744 \uAC80\uD1A0\uD55C \uB4A4 \uC81C\uC548\uC11C\uB97C \uBCF4\uB0B4 \uB4DC\uB9AC\uBA70, \uC81C\uC548\uC11C\uB97C \uD655\uC778\uD55C \uB4A4 1:1 \uC0C1\uB2F4\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`;
}

// src/services/consultMessageSchema.ts
var targetLawyerColumnState = "unknown";
function getTargetLawyerColumnState() {
  return targetLawyerColumnState;
}
function setTargetLawyerColumnState(state) {
  targetLawyerColumnState = state;
}

// src/components/lawyer/requestScope.ts
var RETAINED = ["contracted", "document", "filed", "commenced", "repaying", "discharged"];
function hasProposalFrom(r, lawyerId) {
  return !!lawyerId && (r.proposals || []).some((p) => p?.lawyerId === lawyerId);
}
function isChatOpenWithLawyer(r, lawyerId) {
  if (!lawyerId) return false;
  if ((r.acceptedLawyerIds || []).includes(lawyerId)) return true;
  if (r.selectedLawyerId === lawyerId) return true;
  if (r.createdByLawyerId === lawyerId) return true;
  if (RETAINED.includes(r.status) && (r.assignedLawyerId === lawyerId || !r.assignedLawyerId)) return true;
  return false;
}

// src/components/lawyer/chat/chatFormat.ts
var timeFormatter = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
var fullFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit"
});

// src/components/lawyer/chat/chatSelectors.ts
var CLIENT_REQUEST_NOTICE_TAIL = "\uC5D0\uAC8C \uC0C1\uB2F4 \uC694\uCCAD\uC744 \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4. \uBCC0\uD638\uC0AC\uAC00 \uCC44\uBB34 \uD604\uD669\uC744 \uAC80\uD1A0\uD55C \uB4A4";
function leadingSentence(text) {
  const end = text.indexOf(". ");
  return end > 0 ? text.slice(0, end + 1) : text;
}
var OPEN_REQUEST_NOTICE_HEAD = leadingSentence(OPEN_REQUEST_CLIENT_NOTICE);
var LAWYER_REQUEST_NOTICE_HEAD = leadingSentence(LAWYER_REQUEST_RECEIVED_NOTICE);
function stripSystemPrefix(text) {
  return text.replace(/^\[System\]\s*/i, "").trim();
}
function isClientOnlyNoticeText(raw) {
  const text = stripSystemPrefix(String(raw || ""));
  if (!text) return false;
  if (OPEN_REQUEST_NOTICE_HEAD && text.startsWith(OPEN_REQUEST_NOTICE_HEAD)) return true;
  if (text.includes(CLIENT_REQUEST_NOTICE_TAIL)) return true;
  return text.includes("\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC120\uD0DD\uD558\uC2E0") || text.includes("\uBCC0\uD638\uC0AC\uAC00 \uACE0\uAC1D\uB2D8\uC758 \uCC44\uBB34 \uD604\uD669\uC744 \uAC80\uD1A0\uD55C \uB4A4");
}
function isLawyerRequestReceivedText(raw) {
  const text = stripSystemPrefix(String(raw || ""));
  return Boolean(LAWYER_REQUEST_NOTICE_HEAD) && text.startsWith(LAWYER_REQUEST_NOTICE_HEAD);
}
function soleCounselingLawyerId(request) {
  if (!request) return void 0;
  if (request.selectedLawyerId) return request.selectedLawyerId;
  const accepted2 = Array.from(new Set((request.acceptedLawyerIds || []).filter(Boolean)));
  return accepted2.length === 1 ? accepted2[0] : void 0;
}
function isSystemChatMessage(m) {
  return m.senderType === "system" || m.senderId === "system" || m.senderName === "\uC2DC\uC2A4\uD15C \uC548\uB0B4" || m.senderName === "System" || m.senderType === "admin" || Boolean(m.message?.startsWith("[System]"));
}
var filterAndSanitizeMessagesForLawyer = (rawMessages, lawyer, request, options) => {
  if (!rawMessages || rawMessages.length === 0) return [];
  const result = [];
  const seenSystemTexts = /* @__PURE__ */ new Set();
  const hideUntargetedClient = options?.hideUntargetedClientMessagesWhenMultiple ?? getTargetLawyerColumnState() === "present";
  const acceptedCount = new Set((request?.acceptedLawyerIds || []).filter(Boolean)).size;
  const pushOnce = (m, key) => {
    if (seenSystemTexts.has(key)) return;
    seenSystemTexts.add(key);
    result.push(m);
  };
  for (const m of rawMessages) {
    const isSystem = m.senderType === "system" || m.senderId === "system" || m.senderName === "\uC2DC\uC2A4\uD15C \uC548\uB0B4" || m.senderName === "System" || m.senderType === "admin" || m.message?.startsWith("[System]");
    if (m.senderType === "lawyer" && !isSystem) {
      if (m.senderId !== lawyer.id) {
        continue;
      }
      result.push(m);
      continue;
    }
    if (m.senderType === "client" && !isSystem) {
      if (m.targetLawyerId && m.targetLawyerId !== lawyer.id) {
        continue;
      }
      if (!m.targetLawyerId && hideUntargetedClient && acceptedCount >= 2) {
        continue;
      }
      result.push(m);
      continue;
    }
    if (isSystem) {
      if (m.targetLawyerId) {
        if (m.targetLawyerId === "client-only") {
          continue;
        }
        if (m.targetLawyerId !== lawyer.id) {
          continue;
        }
        result.push(m);
        continue;
      }
      const text = m.message || m.content || "";
      const plain = stripSystemPrefix(text);
      if (isClientOnlyNoticeText(plain)) {
        continue;
      }
      if (plain.includes("\uC758\uB8B0\uC778\uC774 \uC804\uD654\uC0C1\uB2F4\uC744 \uC694\uCCAD")) {
        if (!lawyer.id || soleCounselingLawyerId(request) !== lawyer.id) continue;
        const prev = result[result.length - 1];
        if (prev && isSystemChatMessage(prev) && stripSystemPrefix(prev.message || "") === plain) continue;
        result.push(m);
        continue;
      }
      if (plain.includes("\uC758\uB8B0\uC778\uC774 \uADC0\uD558\uB97C \uC804\uB2F4 \uBCC0\uD638\uC0AC\uB85C \uC120\uC784")) {
        if (!lawyer.id || request?.selectedLawyerId !== lawyer.id) continue;
        pushOnce(m, plain);
        continue;
      }
      if (plain.includes("\uB2E4\uB978 \uBCC0\uD638\uC0AC\uB97C \uC804\uB2F4\uC73C\uB85C \uC120\uC784\uD558\uC600\uC2B5\uB2C8\uB2E4")) {
        if (request?.selectedLawyerId === lawyer.id) continue;
        pushOnce(m, plain);
        continue;
      }
      if (isLawyerRequestReceivedText(plain)) {
        const requestedMe = Boolean(lawyer.id) && (request?.selectedLawyerId === lawyer.id || (request?.selectedLawyerIds || []).includes(lawyer.id));
        if (!requestedMe) continue;
        pushOnce(m, LAWYER_REQUEST_NOTICE_HEAD);
        continue;
      }
      const isConsultRequestNotice = text.includes("\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC804\uB2EC\uB418\uC5C8\uC2B5\uB2C8\uB2E4") || text.includes("\uC0C1\uB2F4\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4") || text.includes("\uBB34\uB8CC \uC0C1\uB2F4\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4");
      if (isConsultRequestNotice) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        const isDirectlySelected = Boolean(
          request?.selectedLawyerId === lawyer.id || (request?.selectedLawyerIds || []).includes(lawyer.id)
        );
        if (!mentionsMe && !isDirectlySelected) {
          continue;
        }
        const sanitizedText = "\uC758\uB8B0\uC778\uC73C\uB85C\uBD80\uD130 \uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC804 \uC9C4\uB2E8 \uB9AC\uD3EC\uD2B8\uB97C \uAC80\uD1A0\uD558\uACE0 \uC0C1\uB2F4\uC744 \uC9C4\uD589\uD574 \uC8FC\uC138\uC694.";
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: "system",
          senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4",
          message: sanitizedText
        });
        continue;
      }
      if (text.includes("\uBE44\uAD50 \uC0C1\uB2F4\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4")) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
        const sanitizedText = "\uC758\uB8B0\uC778\uACFC\uC758 1:1 \uBE44\uAD50 \uC0C1\uB2F4\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.";
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: "system",
          senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4",
          message: sanitizedText
        });
        continue;
      }
      if (text.includes("\uC81C\uC548\uC11C\uB97C \uC218\uB77D\uD558\uC168\uC2B5\uB2C8\uB2E4")) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
        const sanitizedText = "\uC758\uB8B0\uC778\uC774 \uBCC0\uD638\uC0AC\uB2D8\uC758 \uC81C\uC548\uC11C\uB97C \uC218\uB77D\uD558\uC168\uC2B5\uB2C8\uB2E4. \uC774\uC81C 1:1 \uC804\uB2F4 \uC0C1\uB2F4\uC744 \uC9C4\uD589\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: "system",
          senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4",
          message: sanitizedText
        });
        continue;
      }
      if (text.includes("\uC0C1\uB2F4 \uC694\uCCAD\uC744 \uCDE8\uC18C\uD558\uC600\uC2B5\uB2C8\uB2E4")) {
        if (text.includes("\uBAA8\uB4E0 \uBCC0\uD638\uC0AC")) {
          result.push(m);
          continue;
        }
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
        const sanitizedText = "\uC758\uB8B0\uC778\uC774 \uC0C1\uB2F4 \uC694\uCCAD\uC744 \uCDE8\uC18C\uD558\uC600\uC2B5\uB2C8\uB2E4.";
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: "system",
          senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4",
          message: sanitizedText
        });
        continue;
      }
      if (text.includes("\uBCC0\uD638\uC0AC\uB2D8") || text.includes("\uBCC0\uD638\uC0AC\uAC00")) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
      }
      if (seenSystemTexts.has(text)) continue;
      seenSystemTexts.add(text);
      result.push(m);
    }
  }
  return result;
};
var ACTIVE_THREAD_STATUSES = ["comparing", "counseling", "contracted", "document", "filed", "commenced", "repaying", "discharged"];
function groupMessagesByRequest(messages) {
  const map = /* @__PURE__ */ new Map();
  for (const m of messages) {
    const list = map.get(m.consultRequestId);
    if (list) list.push(m);
    else map.set(m.consultRequestId, [m]);
  }
  return map;
}
function toTime(value) {
  return value ? new Date(value).getTime() : NaN;
}
function summarizeThread(request, visible, lawyerId) {
  const lastMessage = visible[visible.length - 1];
  let lastConversationMessage;
  for (let i = visible.length - 1; i >= 0; i--) {
    if (!isSystemChatMessage(visible[i])) {
      lastConversationMessage = visible[i];
      break;
    }
  }
  let needsReply = false;
  let waitingSince;
  if (!isClosedConsultStatus(request.status)) {
    if (lastMessage && isSystemChatMessage(lastMessage) && classifySystemText(lastMessage.message) === "attention") {
      needsReply = true;
      waitingSince = lastMessage.createdAt;
    } else if (lastConversationMessage && lastConversationMessage.senderType === "client") {
      needsReply = true;
      for (let i = visible.length - 1; i >= 0; i--) {
        const m = visible[i];
        if (isSystemChatMessage(m)) continue;
        if (m.senderType === "client") waitingSince = m.createdAt;
        else if (m.senderId === lawyerId || m.senderType === "lawyer") break;
      }
    }
  }
  const lastTime = lastMessage ? toTime(lastMessage.createdAt) : toTime(request.createdAt);
  return {
    id: request.id,
    request,
    messages: visible,
    lastMessage,
    lastConversationMessage,
    lastActivityAt: lastTime,
    needsReply,
    waitingSince,
    chatOpen: isChatOpenWithLawyer(request, lawyerId),
    hasMyProposal: hasProposalFrom(request, lawyerId)
  };
}
function buildLawyerChatThreads(requests, messages, lawyer) {
  const byRequest = groupMessagesByRequest(messages);
  const threads = [];
  for (const r of requests) {
    if (r.isSoftDeleted) continue;
    const visible = filterAndSanitizeMessagesForLawyer(byRequest.get(r.id) || [], lawyer, r);
    const hasMyProposal = (r.proposals || []).some((p) => p.lawyerId === lawyer.id);
    const isAccepted = (r.acceptedLawyerIds || []).includes(lawyer.id);
    const isSelected = r.selectedLawyerId === lawyer.id || (r.selectedLawyerIds || []).includes(lawyer.id);
    const hasMyMessages = visible.some((m) => m.senderId === lawyer.id || m.targetLawyerId === lawyer.id || m.senderType === "client");
    const isCounselingOrActive = ACTIVE_THREAD_STATUSES.includes(r.status);
    if (!(hasMyProposal || isAccepted || isSelected || hasMyMessages && isCounselingOrActive)) continue;
    threads.push(summarizeThread(r, visible, lawyer.id));
  }
  return threads.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}
function classifySystemText(text) {
  const t = String(text || "");
  if (t.includes("\uB2E4\uB978 \uBCC0\uD638\uC0AC\uB97C \uC804\uB2F4\uC73C\uB85C \uC120\uC784")) return "neutral";
  if (t.includes("\uCDE8\uC18C")) return "neutral";
  if (t.includes("\uC804\uD654\uC0C1\uB2F4\uC744 \uC694\uCCAD")) return "attention";
  if (/수락|전담 변호사로 선임|서명.{0,6}완료|계약.{0,6}(체결|완료)/.test(t)) return "success";
  return "neutral";
}
var GROUP_GAP_MS = 5 * 60 * 1e3;

// .tmp-admin-work/old-head/src/components/lawyer/chat/chatFormat.ts
var timeFormatter2 = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
var fullFormatter2 = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit"
});

// .tmp-admin-work/old-head/src/components/lawyer/chat/chatSelectors.ts
var filterAndSanitizeMessagesForLawyer2 = (rawMessages, lawyer, request) => {
  if (!rawMessages || rawMessages.length === 0) return [];
  const result = [];
  const seenSystemTexts = /* @__PURE__ */ new Set();
  for (const m of rawMessages) {
    const isSystem = m.senderType === "system" || m.senderId === "system" || m.senderName === "\uC2DC\uC2A4\uD15C \uC548\uB0B4" || m.senderName === "System" || m.senderType === "admin" || m.message?.startsWith("[System]");
    if (m.senderType === "lawyer" && !isSystem) {
      if (m.senderId !== lawyer.id) {
        continue;
      }
      result.push(m);
      continue;
    }
    if (m.senderType === "client" && !isSystem) {
      if (m.targetLawyerId && m.targetLawyerId !== lawyer.id) {
        continue;
      }
      result.push(m);
      continue;
    }
    if (isSystem) {
      if (m.targetLawyerId) {
        if (m.targetLawyerId === "client-only") {
          continue;
        }
        if (m.targetLawyerId !== lawyer.id) {
          continue;
        }
        result.push(m);
        continue;
      }
      const text = m.message || m.content || "";
      if (text.includes("\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC120\uD0DD\uD558\uC2E0") || text.includes("\uBCC0\uD638\uC0AC\uAC00 \uACE0\uAC1D\uB2D8\uC758 \uCC44\uBB34 \uD604\uD669\uC744 \uAC80\uD1A0\uD55C \uB4A4")) {
        continue;
      }
      const isConsultRequestNotice = text.includes("\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC804\uB2EC\uB418\uC5C8\uC2B5\uB2C8\uB2E4") || text.includes("\uC0C1\uB2F4\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4") || text.includes("\uBB34\uB8CC \uC0C1\uB2F4\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4");
      if (isConsultRequestNotice) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        const isDirectlySelected = Boolean(
          request?.selectedLawyerId === lawyer.id || (request?.selectedLawyerIds || []).includes(lawyer.id)
        );
        if (!mentionsMe && !isDirectlySelected) {
          continue;
        }
        const sanitizedText = "\uC758\uB8B0\uC778\uC73C\uB85C\uBD80\uD130 \uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC804 \uC9C4\uB2E8 \uB9AC\uD3EC\uD2B8\uB97C \uAC80\uD1A0\uD558\uACE0 \uC0C1\uB2F4\uC744 \uC9C4\uD589\uD574 \uC8FC\uC138\uC694.";
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: "system",
          senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4",
          message: sanitizedText
        });
        continue;
      }
      if (text.includes("\uBE44\uAD50 \uC0C1\uB2F4\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4")) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
        const sanitizedText = "\uC758\uB8B0\uC778\uACFC\uC758 1:1 \uBE44\uAD50 \uC0C1\uB2F4\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.";
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: "system",
          senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4",
          message: sanitizedText
        });
        continue;
      }
      if (text.includes("\uC81C\uC548\uC11C\uB97C \uC218\uB77D\uD558\uC168\uC2B5\uB2C8\uB2E4")) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
        const sanitizedText = "\uC758\uB8B0\uC778\uC774 \uBCC0\uD638\uC0AC\uB2D8\uC758 \uC81C\uC548\uC11C\uB97C \uC218\uB77D\uD558\uC168\uC2B5\uB2C8\uB2E4. \uC774\uC81C 1:1 \uC804\uB2F4 \uC0C1\uB2F4\uC744 \uC9C4\uD589\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: "system",
          senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4",
          message: sanitizedText
        });
        continue;
      }
      if (text.includes("\uC0C1\uB2F4 \uC694\uCCAD\uC744 \uCDE8\uC18C\uD558\uC600\uC2B5\uB2C8\uB2E4")) {
        if (text.includes("\uBAA8\uB4E0 \uBCC0\uD638\uC0AC")) {
          result.push(m);
          continue;
        }
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
        const sanitizedText = "\uC758\uB8B0\uC778\uC774 \uC0C1\uB2F4 \uC694\uCCAD\uC744 \uCDE8\uC18C\uD558\uC600\uC2B5\uB2C8\uB2E4.";
        if (seenSystemTexts.has(sanitizedText)) continue;
        seenSystemTexts.add(sanitizedText);
        result.push({
          ...m,
          senderType: "system",
          senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4",
          message: sanitizedText
        });
        continue;
      }
      if (text.includes("\uB2E4\uB978 \uBCC0\uD638\uC0AC\uB97C \uC804\uB2F4\uC73C\uB85C \uC120\uC784\uD558\uC600\uC2B5\uB2C8\uB2E4")) {
        if (request?.selectedLawyerId === lawyer.id) {
          continue;
        }
        result.push(m);
        continue;
      }
      if (text.includes("\uBCC0\uD638\uC0AC\uB2D8") || text.includes("\uBCC0\uD638\uC0AC\uAC00")) {
        const mentionsMe = Boolean(lawyer.name && text.includes(lawyer.name));
        if (!mentionsMe) {
          continue;
        }
      }
      if (seenSystemTexts.has(text)) continue;
      seenSystemTexts.add(text);
      result.push(m);
    }
  }
  return result;
};
var GROUP_GAP_MS2 = 5 * 60 * 1e3;

// .tmp-admin-work/verify-chat-filter.ts
var PHONE = "[System] \u{1F4DE} \uC758\uB8B0\uC778\uC774 \uC804\uD654\uC0C1\uB2F4\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4. \uCC44\uD305\uC73C\uB85C \uD1B5\uD654 \uAC00\uB2A5\uD55C \uC2DC\uAC04\uC744 \uC870\uC728\uD574 \uC8FC\uC138\uC694.";
var CHOSEN = "[System] \u{1F389} \uC758\uB8B0\uC778\uC774 \uADC0\uD558\uB97C \uC804\uB2F4 \uBCC0\uD638\uC0AC\uB85C \uC120\uC784\uD558\uC600\uC2B5\uB2C8\uB2E4!";
var OTHER_CHOSEN = "[System] \u{1F4CB} \uC758\uB8B0\uC778\uC774 \uB2E4\uB978 \uBCC0\uD638\uC0AC\uB97C \uC804\uB2F4\uC73C\uB85C \uC120\uC784\uD558\uC600\uC2B5\uB2C8\uB2E4. \uC0C1\uB2F4\uC5D0 \uCC38\uC5EC\uD574 \uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4.";
var compareStart = (name) => `${name} \uBCC0\uD638\uC0AC\uB2D8\uACFC \uBE44\uAD50 \uC0C1\uB2F4\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.`;
var accepted = (name) => `${name} \uBCC0\uD638\uC0AC\uB2D8\uC758 \uC81C\uC548\uC11C\uB97C \uC218\uB77D\uD558\uC168\uC2B5\uB2C8\uB2E4. \uC774\uC81C 1:1 \uC804\uB2F4 \uC0C1\uB2F4\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`;
var cancelOne = (name) => `\uC758\uB8B0\uC778\uC774 ${name} \uBCC0\uD638\uC0AC\uB2D8\uC5D0 \uB300\uD55C \uC0C1\uB2F4 \uC694\uCCAD\uC744 \uCDE8\uC18C\uD558\uC600\uC2B5\uB2C8\uB2E4.`;
var CANCEL_ALL = "\uC758\uB8B0\uC778\uC774 \uBAA8\uB4E0 \uBCC0\uD638\uC0AC\uC5D0 \uB300\uD55C \uC0C1\uB2F4 \uC694\uCCAD\uC744 \uCDE8\uC18C\uD558\uC600\uC2B5\uB2C8\uB2E4.";
var joined = (name) => `[System] ${name} \uBCC0\uD638\uC0AC\uAC00 \uC0C1\uB2F4\uC5D0 \uCC38\uC5EC\uD558\uC600\uC2B5\uB2C8\uB2E4.`;
var A = { id: "lawyer-a", name: "\uAE40\uC6B0\uC9C4", role: "LAWYER" };
var B = { id: "lawyer-b", name: "\uC774\uC18C\uBBFC", role: "LAWYER" };
var C = { id: "lawyer-c", name: "\uBC15\uC131\uD604", role: "LAWYER" };
var seq = 0;
var at = (min) => new Date(Date.UTC(2026, 5, 1, 9, min)).toISOString();
function sys(message, target, extra = {}) {
  seq += 1;
  return { id: `m${seq}`, consultRequestId: "req-x", senderType: "system", senderId: "system", senderName: "\uC2DC\uC2A4\uD15C \uC548\uB0B4", message, createdAt: at(seq), ...target ? { targetLawyerId: target } : {}, ...extra };
}
function client(message, target) {
  seq += 1;
  return { id: `m${seq}`, consultRequestId: "req-x", senderType: "client", senderId: "client-temp", senderName: "\uC758\uB8B0\uC778 (\uBCF8\uC778)", message, createdAt: at(seq), ...target ? { targetLawyerId: target } : {} };
}
function lawyerMsg(l, message) {
  seq += 1;
  return { id: `m${seq}`, consultRequestId: "req-x", senderType: "lawyer", senderId: l.id, senderName: l.name, message, createdAt: at(seq) };
}
function req(patch) {
  return { id: "req-x", clientId: "client-1", clientName: "\uC758\uB8B0\uC778", phone: "", requestType: "direct_multi", status: "requested", createdAt: at(0), title: "\uC0C1\uB2F4", content: "", ...patch };
}
var pass = 0;
var fail = 0;
function check(label, ok, detail) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail !== void 0 ? `
      \u2192 ${JSON.stringify(detail)}` : ""}`);
}
var texts = (list) => list.map((m) => m.message);
var show = (label, list) => console.log(`      ${label}: ${JSON.stringify(texts(list))}`);
console.log("\u2500\u2500 0. \uBB38\uAD6C \uC0C1\uC218 \u2500\u2500");
var namedNotice = buildClientRequestNotice(["\uAE40\uC6B0\uC9C4", "\uC774\uC18C\uBBFC"], 2);
var countNotice = buildClientRequestNotice([], 2);
check("buildClientRequestNotice(\uC774\uB984\uD615)\uC5D0 \uAF2C\uB9AC \uC0C1\uC218\uAC00 \uB4E4\uC5B4 \uC788\uB2E4", namedNotice.includes(CLIENT_REQUEST_NOTICE_TAIL), namedNotice);
check("buildClientRequestNotice(\uC778\uC6D0\uD615)\uC5D0 \uAF2C\uB9AC \uC0C1\uC218\uAC00 \uB4E4\uC5B4 \uC788\uB2E4", countNotice.includes(CLIENT_REQUEST_NOTICE_TAIL), countNotice);
console.log("\n\u2500\u2500 1. \uC758\uB8B0\uC778 \uC804\uC6A9 \uC548\uB0B4 (\uB300\uC0C1 \uC815\uBCF4 \uC5C6\uC74C) \u2500\u2500");
{
  const r = req({ selectedLawyerIds: [A.id, B.id] });
  const msgs = [sys(namedNotice), sys(countNotice), sys(OPEN_REQUEST_CLIENT_NOTICE), sys("\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uC120\uD0DD\uD558\uC2E0 \uBCC0\uD638\uC0AC\uB2D8\uAED8 \uC804\uB2EC\uB418\uC5C8\uC2B5\uB2C8\uB2E4."), sys(LAWYER_REQUEST_RECEIVED_NOTICE), sys(LAWYER_REQUEST_RECEIVED_NOTICE)];
  const beforeA = filterAndSanitizeMessagesForLawyer2(msgs, A, r);
  const afterA = filterAndSanitizeMessagesForLawyer(msgs, A, r);
  const afterB = filterAndSanitizeMessagesForLawyer(msgs, B, r);
  const afterC = filterAndSanitizeMessagesForLawyer(msgs, C, r);
  show("\uC774\uC804 A", beforeA);
  show("\uC774\uD6C4 A", afterA);
  check("\uC774\uC804 \uCF54\uB4DC: A\uC5D0\uAC8C \uC774\uB984\uD615 \uC548\uB0B4\uAC00 \uB2E4\uB978 \uBCC0\uD638\uC0AC \uC774\uB984(\uC774\uC18C\uBBFC)\uACFC \uD568\uAED8 \uBCF4\uC600\uB2E4(\uC7AC\uD604)", beforeA.some((m) => m.message.includes("\uC774\uC18C\uBBFC")));
  check("A: \uC758\uB8B0\uC778 \uC804\uC6A9 \uC548\uB0B4 3\uC885\uC774 \uBAA8\uB450 \uC228\uACA8\uC9C4\uB2E4", !afterA.some((m) => m.message.includes("\uBCF4\uB0C8\uC2B5\uB2C8\uB2E4") || m.message.includes("\uACF5\uAC1C \uC694\uCCAD\uC744 \uC62C\uB838\uC2B5\uB2C8\uB2E4") || m.message.includes("\uC120\uD0DD\uD558\uC2E0")), texts(afterA));
  check("A: \uC694\uCCAD \uC811\uC218 \uC548\uB0B4\uB294 1\uD68C\uB9CC", texts(afterA).filter((t) => t === LAWYER_REQUEST_RECEIVED_NOTICE).length === 1, texts(afterA));
  check("B: \uC694\uCCAD \uC811\uC218 \uC548\uB0B4 1\uD68C, \uB2E4\uB978 \uC774\uB984 \uB178\uCD9C \uC5C6\uC74C", texts(afterB).length === 1 && texts(afterB)[0] === LAWYER_REQUEST_RECEIVED_NOTICE, texts(afterB));
  check("C(\uC694\uCCAD\uBC1B\uC9C0 \uC54A\uC74C): \uC544\uBB34\uAC83\uB3C4 \uBCF4\uC774\uC9C0 \uC54A\uB294\uB2E4", afterC.length === 0, texts(afterC));
}
console.log("\n\u2500\u2500 2. \uC804\uD654\uC0C1\uB2F4 \uC694\uCCAD (\uB300\uC0C1 \uC815\uBCF4 \uC5C6\uC74C) \u2500\u2500");
{
  const r = req({ status: "counseling", selectedLawyerId: A.id, selectedLawyerIds: [A.id, B.id], acceptedLawyerIds: [A.id, B.id] });
  const msgs = [client("\uC548\uB155\uD558\uC138\uC694"), sys(PHONE)];
  const beforeA = filterAndSanitizeMessagesForLawyer2(msgs, A, r);
  const beforeB = filterAndSanitizeMessagesForLawyer2(msgs, B, r);
  const afterA = filterAndSanitizeMessagesForLawyer(msgs, A, r);
  const afterB = filterAndSanitizeMessagesForLawyer(msgs, B, r);
  show("\uC774\uC804 A", beforeA);
  show("\uC774\uC804 B", beforeB);
  show("\uC774\uD6C4 A", afterA);
  show("\uC774\uD6C4 B", afterB);
  check("\uC774\uC804 \uCF54\uB4DC: A\uC5D0\uAC8C \uC77C\uBC18 \uC811\uC218 \uC548\uB0B4\uB85C \uBC14\uB00C\uC5B4 attention\uC774 \uC544\uB2C8\uC5C8\uB2E4(\uC7AC\uD604)", classifySystemText(beforeA[beforeA.length - 1]?.message) !== "attention");
  check("A(\uC0C1\uB2F4 \uBCC0\uD638\uC0AC): \uC6D0\uBB38 \uADF8\uB300\uB85C, attention", afterA[afterA.length - 1]?.message === PHONE && classifySystemText(PHONE) === "attention");
  check("B(\uC120\uC784\uB418\uC9C0 \uC54A\uC74C): \uC804\uD654\uC0C1\uB2F4 \uC694\uCCAD\uC774 \uBCF4\uC774\uC9C0 \uC54A\uB294\uB2E4", !afterB.some((m) => m.message.includes("\uC804\uD654\uC0C1\uB2F4")), texts(afterB));
  const [threadA] = buildLawyerChatThreads([r], msgs, A);
  check("A \uC2A4\uB808\uB4DC: needsReply = true", threadA?.needsReply === true, threadA && { needsReply: threadA.needsReply });
  const r1 = req({ status: "comparing", acceptedLawyerIds: [A.id] });
  check("selectedLawyerId \uC5C6\uC74C + \uB300\uD654 \uC911 \uBCC0\uD638\uC0AC A \uD55C \uBA85: A\uC5D0\uAC8C \uBCF4\uC778\uB2E4", filterAndSanitizeMessagesForLawyer([sys(PHONE)], A, r1).length === 1);
  check("selectedLawyerId \uC5C6\uC74C + \uB300\uD654 \uC911 \uBCC0\uD638\uC0AC A \uD55C \uBA85: B\uC5D0\uAC8C\uB294 \uC548 \uBCF4\uC778\uB2E4", filterAndSanitizeMessagesForLawyer([sys(PHONE)], B, r1).length === 0);
  const r2 = req({ status: "comparing", acceptedLawyerIds: [A.id, B.id, A.id] });
  check("selectedLawyerId \uC5C6\uC74C + \uB300\uD654 \uC911 2\uBA85: \uB204\uAD6C\uC5D0\uAC8C\uB3C4 \uC548 \uBCF4\uC778\uB2E4", filterAndSanitizeMessagesForLawyer([sys(PHONE)], A, r2).length === 0 && filterAndSanitizeMessagesForLawyer([sys(PHONE)], B, r2).length === 0);
  check("\uB300\uC0C1 \uC9C0\uC815(targetLawyerId=B)\uC774\uBA74 B\uC5D0\uAC8C \uBCF4\uC778\uB2E4(3-1 \uADDC\uCE59)", filterAndSanitizeMessagesForLawyer([sys(PHONE, B.id)], B, r).length === 1);
  const dup = filterAndSanitizeMessagesForLawyer([sys(PHONE), sys(PHONE)], A, r);
  check("\uC5F0\uB2EC\uC544 \uC800\uC7A5\uB41C \uAC19\uC740 \uC694\uCCAD\uC740 1\uD68C", dup.length === 1, texts(dup));
  const again = [sys(PHONE), lawyerMsg(A, "\uB0B4\uC77C \uC624\uD6C4 3\uC2DC \uAD1C\uCC2E\uC73C\uC138\uC694?"), sys(PHONE)];
  const againA = filterAndSanitizeMessagesForLawyer(again, A, r);
  const [threadAgain] = buildLawyerChatThreads([r], again, A);
  check("\uB2F5\uBCC0 \uB4A4 \uB2E4\uC2DC \uC694\uCCAD\uD558\uBA74 \uB2E4\uC2DC \uBCF4\uC774\uACE0 needsReply\uAC00 \uCF1C\uC9C4\uB2E4", againA.length === 3 && threadAgain?.needsReply === true, texts(againA));
}
console.log("\n\u2500\u2500 3. \uC804\uB2F4 \uC120\uC784 \uC548\uB0B4 (\uB300\uC0C1 \uC815\uBCF4 \uC5C6\uC74C) \u2500\u2500");
{
  const r = req({ status: "counseling", selectedLawyerId: A.id, acceptedLawyerIds: [A.id, B.id, C.id] });
  const msgs = [sys(CHOSEN), sys(OTHER_CHOSEN), sys(OTHER_CHOSEN)];
  const beforeB = filterAndSanitizeMessagesForLawyer2(msgs, B, r);
  const afterA = filterAndSanitizeMessagesForLawyer(msgs, A, r);
  const afterB = filterAndSanitizeMessagesForLawyer(msgs, B, r);
  show("\uC774\uC804 B", beforeB);
  show("\uC774\uD6C4 A", afterA);
  show("\uC774\uD6C4 B", afterB);
  check('\uC774\uC804 \uCF54\uB4DC: B\uC5D0\uAC8C "\uADC0\uD558\uB97C \uC804\uB2F4 \uBCC0\uD638\uC0AC\uB85C \uC120\uC784"\uC774 \uBCF4\uC600\uB2E4(\uC7AC\uD604)', beforeB.some((m) => m.message.includes("\uADC0\uD558\uB97C")));
  check('A(\uC120\uC784\uB428): "\uADC0\uD558\uB97C \uC120\uC784"\uB9CC 1\uD68C, "\uB2E4\uB978 \uBCC0\uD638\uC0AC" \uC548\uB0B4 \uC5C6\uC74C', afterA.length === 1 && afterA[0].message === CHOSEN, texts(afterA));
  check('B(\uC120\uC784\uB418\uC9C0 \uC54A\uC74C): "\uB2E4\uB978 \uBCC0\uD638\uC0AC\uB97C \uC804\uB2F4\uC73C\uB85C \uC120\uC784" 1\uD68C\uB9CC', afterB.length === 1 && afterB[0].message === OTHER_CHOSEN, texts(afterB));
}
console.log("\n\u2500\u2500 4. \uC694\uCCAD \uC811\uC218 \uC548\uB0B4 \u2014 \uC694\uCCAD\uBC1B\uC9C0 \uC54A\uC740 \uBCC0\uD638\uC0AC \u2500\u2500");
{
  const r = req({ requestType: "open", selectedLawyerIds: [A.id], proposals: [{ lawyerId: C.id }] });
  const msgs = [sys(LAWYER_REQUEST_RECEIVED_NOTICE)];
  check("\uC774\uC804 \uCF54\uB4DC: C\uC5D0\uAC8C\uB3C4 \uBCF4\uC600\uB2E4(\uC7AC\uD604)", filterAndSanitizeMessagesForLawyer2(msgs, C, r).length === 1);
  check("C: \uBCF4\uC774\uC9C0 \uC54A\uB294\uB2E4", filterAndSanitizeMessagesForLawyer(msgs, C, r).length === 0);
  check("A(\uC694\uCCAD\uBC1B\uC74C): \uBCF4\uC778\uB2E4", filterAndSanitizeMessagesForLawyer(msgs, A, r).length === 1);
  check("selectedLawyerId\uB9CC A\uC5EC\uB3C4 \uBCF4\uC778\uB2E4", filterAndSanitizeMessagesForLawyer(msgs, A, req({ selectedLawyerId: A.id })).length === 1);
}
console.log("\n\u2500\u2500 5. \uB300\uC0C1 \uC815\uBCF4 \uC5C6\uB294 \uC758\uB8B0\uC778 \uB300\uD654 \uBA54\uC2DC\uC9C0 (\uBE44\uAD50 \uC0C1\uB2F4 2\uBA85 \uC774\uC0C1) \u2500\u2500");
{
  const multi = req({ status: "comparing", acceptedLawyerIds: [A.id, B.id] });
  const single = req({ status: "comparing", acceptedLawyerIds: [A.id] });
  const msgs = [client("\uB300\uC0C1 \uC5C6\uB294 \uACFC\uAC70 \uBA54\uC2DC\uC9C0"), client("A\uC5D0\uAC8C", A.id), client("B\uC5D0\uAC8C", B.id)];
  setTargetLawyerColumnState("unknown");
  const unknownA = filterAndSanitizeMessagesForLawyer(msgs, A, multi);
  check("\uCE78 \uD655\uC778 \uC804('unknown'): \uB300\uC0C1 \uC5C6\uB294 \uBA54\uC2DC\uC9C0\uB97C \uC228\uAE30\uC9C0 \uC54A\uB294\uB2E4", texts(unknownA).join("|") === "\uB300\uC0C1 \uC5C6\uB294 \uACFC\uAC70 \uBA54\uC2DC\uC9C0|A\uC5D0\uAC8C", texts(unknownA));
  setTargetLawyerColumnState("missing");
  check("\uCE78 \uC5C6\uC74C('missing'): \uC228\uAE30\uC9C0 \uC54A\uB294\uB2E4", filterAndSanitizeMessagesForLawyer(msgs, A, multi).length === 2);
  setTargetLawyerColumnState("present");
  const presentA = filterAndSanitizeMessagesForLawyer(msgs, A, multi);
  const presentB = filterAndSanitizeMessagesForLawyer(msgs, B, multi);
  check("\uCE78 \uC788\uC74C('present') + 2\uBA85: A\uC5D0\uAC8C \uB300\uC0C1 \uC5C6\uB294 \uBA54\uC2DC\uC9C0 \uC228\uAE40, \uC790\uAE30 \uB300\uC0C1\uB9CC", texts(presentA).join("|") === "A\uC5D0\uAC8C", texts(presentA));
  check("\uCE78 \uC788\uC74C('present') + 2\uBA85: B\uB3C4 \uC790\uAE30 \uB300\uC0C1\uB9CC", texts(presentB).join("|") === "B\uC5D0\uAC8C", texts(presentB));
  check("\uCE78 \uC788\uC74C('present') + 1\uBA85: \uB300\uC0C1 \uC5C6\uB294 \uBA54\uC2DC\uC9C0\uB3C4 \uBCF4\uC778\uB2E4", filterAndSanitizeMessagesForLawyer(msgs, A, single).length === 2);
  check("\uC635\uC158 false\uB85C \uB044\uBA74 \uC228\uAE30\uC9C0 \uC54A\uB294\uB2E4", filterAndSanitizeMessagesForLawyer(msgs, A, multi, { hideUntargetedClientMessagesWhenMultiple: false }).length === 2);
  setTargetLawyerColumnState("unknown");
  check("\uC635\uC158 true\uB85C \uCF1C\uBA74 \uCE78 \uD655\uC778 \uC804\uC5D0\uB3C4 \uC228\uAE34\uB2E4", filterAndSanitizeMessagesForLawyer(msgs, A, multi, { hideUntargetedClientMessagesWhenMultiple: true }).length === 1);
  check("\uC0C1\uD0DC \uB418\uB3CC\uB9BC \uD655\uC778", getTargetLawyerColumnState() === "unknown");
}
console.log("\n\u2500\u2500 6. \uAE30\uC874 \uADDC\uCE59 \uC720\uC9C0 (\uB300\uC0C1 \uC815\uBCF4 \uC5C6\uC74C) \u2500\u2500");
{
  const r = req({ status: "comparing", selectedLawyerIds: [A.id, B.id], acceptedLawyerIds: [A.id, B.id] });
  const msgs = [
    sys(compareStart("\uAE40\uC6B0\uC9C4")),
    sys(compareStart("\uC774\uC18C\uBBFC")),
    sys(accepted("\uAE40\uC6B0\uC9C4")),
    sys(cancelOne("\uC774\uC18C\uBBFC")),
    sys(CANCEL_ALL),
    sys(joined("\uAE40\uC6B0\uC9C4"), void 0, { senderType: "lawyer", senderName: "System" }),
    sys("client-only \uB300\uC0C1 \uC548\uB0B4", "client-only")
  ];
  const oldA = texts(filterAndSanitizeMessagesForLawyer2(msgs, A, r));
  const oldB = texts(filterAndSanitizeMessagesForLawyer2(msgs, B, r));
  const newA = texts(filterAndSanitizeMessagesForLawyer(msgs, A, r));
  const newB = texts(filterAndSanitizeMessagesForLawyer(msgs, B, r));
  console.log(`      \uC774\uD6C4 A: ${JSON.stringify(newA)}`);
  console.log(`      \uC774\uD6C4 B: ${JSON.stringify(newB)}`);
  check("A: \uC774\uC804 \uCF54\uB4DC\uC640 \uACB0\uACFC\uAC00 \uAC19\uB2E4", JSON.stringify(oldA) === JSON.stringify(newA), { oldA, newA });
  check("B: \uC774\uC804 \uCF54\uB4DC\uC640 \uACB0\uACFC\uAC00 \uAC19\uB2E4", JSON.stringify(oldB) === JSON.stringify(newB), { oldB, newB });
}
console.log("\n\u2500\u2500 7. \uB300\uD654 \uC5F4\uB9BC \uC5EC\uBD80 (\uC2A4\uB808\uB4DC \uC694\uC57D) \u2500\u2500");
{
  const proposedOnly = req({ status: "requested", selectedLawyerIds: [A.id], proposals: [{ lawyerId: A.id }] });
  const [t1] = buildLawyerChatThreads([proposedOnly], [], A);
  check("\uC81C\uC548\uC11C\uB9CC \uBCF4\uB0C4: chatOpen=false, hasMyProposal=true", t1?.chatOpen === false && t1?.hasMyProposal === true, t1 && { chatOpen: t1.chatOpen, hasMyProposal: t1.hasMyProposal });
  const started = req({ status: "comparing", selectedLawyerIds: [A.id], acceptedLawyerIds: [A.id], proposals: [{ lawyerId: A.id }] });
  const [t2] = buildLawyerChatThreads([started], [], A);
  check("\uC758\uB8B0\uC778\uC774 '\uC0C1\uB2F4 \uC2DC\uC791'\uC744 \uB204\uB984: chatOpen=true", t2?.chatOpen === true);
  const requestedOnly = req({ status: "requested", selectedLawyerIds: [A.id] });
  const [t3] = buildLawyerChatThreads([requestedOnly], [], A);
  check("\uC694\uCCAD\uB9CC \uBC1B\uC74C(\uC81C\uC548\uC11C \uC804): chatOpen=false, hasMyProposal=false", t3?.chatOpen === false && t3?.hasMyProposal === false);
}
console.log(`
\uACB0\uACFC: ${pass}\uAC74 \uD1B5\uACFC, ${fail}\uAC74 \uC2E4\uD328`);
if (fail > 0) process.exitCode = 1;
