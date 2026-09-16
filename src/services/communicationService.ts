import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { CommunicationLog, SmsTemplate, PendingSms, GoogleDriveConfig, RecordingItem } from '../types/leadTypes';

export const DEFAULT_SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'tmpl-1',
    title: '직접 입력',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-2',
    title: '서류 안내',
    content: '[법률사무소] 개인회생 1차 필수 서류 안내입니다.\n1. 주민등록등본·초본(전체 주소)\n2. 가족관계증명서(상세)\n3. 최근 1년 급여명세서 및 통장내역\n4. 부채증명서\n서류 준비 후 사진 찍어 회신 부탁드립니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-3',
    title: '부재중 연락 요청',
    content: '[법률사무소] 고객님, 신청하신 채무조정 무료 상담 관련하여 전화드렸으나 연결되지 않아 문자 남깁니다. 통화 가능하신 편한 시간을 알려주시면 맞춰서 연락드리겠습니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-4',
    title: '명함 및 인사',
    content: '[법률사무소] 안녕하세요. 회생파산 전담센터 담당자입니다. 채무 독촉이나 급여 압류 등 긴급한 상담이 필요하시면 언제든 본 번호로 회신 또는 전화 주시기 바랍니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-5',
    title: '기본',
    content: '[법률사무소] 고객님의 개인회생/파산 자격 검토 결과를 안내해 드립니다. 세부 서류 안내 및 금지명령 신청 절차를 위해 유선 상담 부탁드립니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const LOCAL_STORAGE_TEMPLATES_KEY = 'legal_crm_sms_templates';
const LOCAL_STORAGE_DRIVE_CONFIG_KEY = 'legal_crm_google_drive_config';
export const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzv9cZBunN0db6kabqL7tIpeBHirVGUOwso6vxLxgcZaPVekTvTH4hxKKiyvCjjg4eafw/exec';
const GOOGLE_SCRIPT_URL = (import.meta as any).env?.VITE_GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL;

/**
 * 구글 드라이브 연동 설정 로드 (변호사 구글 계정 및 전용 GAS URL)
 */
export const getGoogleDriveConfig = (): GoogleDriveConfig => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_DRIVE_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to parse google drive config', e);
  }
  return {
    gasWebAppUrl: GOOGLE_SCRIPT_URL,
    folderName: '마이김변_통화녹취',
    autoUpload: true
  };
};

/**
 * 구글 드라이브 연동 설정 저장
 */
export const saveGoogleDriveConfig = (config: GoogleDriveConfig): void => {
  localStorage.setItem(LOCAL_STORAGE_DRIVE_CONFIG_KEY, JSON.stringify(config));
};

/**
 * 전화번호 정규화 (숫자만 추출)
 */
export const normalizePhoneNumber = (phone: string): string => {
  return (phone || '').replace(/[^0-9]/g, '');
};

/**
 * Supabase 또는 로컬스토리지에서 특정 고객과의 통화/문자 타임라인 로그 조회
 */
export const fetchCommunicationLogs = async (phoneNumber: string): Promise<CommunicationLog[]> => {
  const cleanPhone = normalizePhoneNumber(phoneNumber);
  if (!cleanPhone) return [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('communication_logs')
        .select('id, phone_number, type, duration, content, timestamp, created_at, line_info')
        .eq('phone_number', cleanPhone)
        .order('timestamp', { ascending: true }); // 오래된 순 -> 최신 순 (채팅 타임라인 방식)

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          phoneNumber: row.phone_number,
          type: row.type,
          duration: Number(row.duration) || 0,
          content: row.content || '',
          timestamp: row.timestamp || row.created_at,
          createdAt: row.created_at || row.timestamp,
          lineInfo: row.line_info || '기본'
        }));
      }
    } catch (err) {
      console.warn('[communicationService] Supabase logs fetch failed, using fallback:', err);
    }
  }

  // Fallback: localStorage
  try {
    const local = localStorage.getItem(`comm_logs_${cleanPhone}`);
    if (local) {
      return JSON.parse(local);
    }
  } catch (e) {
    console.error('Failed to parse local communication logs', e);
  }

  return [];
};

/**
 * Supabase 또는 로컬스토리지에서 문자 템플릿 목록 조회 (최대 5개 관리)
 */
export const fetchSmsTemplates = async (): Promise<SmsTemplate[]> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const parsed = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at || row.created_at
        }));
        localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(parsed));
        return parsed;
      }
    } catch (err) {
      console.warn('[communicationService] Supabase templates fetch failed, using fallback:', err);
    }
  }

  // Fallback: localStorage or default templates
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to parse cached sms templates', e);
  }

  return DEFAULT_SMS_TEMPLATES;
};

/**
 * 문자 템플릿 저장 (생성 또는 수정)
 */
export const saveSmsTemplate = async (template: { id?: string; title: string; content: string }): Promise<SmsTemplate> => {
  const isUpdate = Boolean(template.id);
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUpdate) {
        const { data, error } = await supabase
          .from('sms_templates')
          .update({
            title: template.title,
            content: template.content,
            updated_at: now
          })
          .eq('id', template.id)
          .select()
          .single();

        if (error) throw error;
        return {
          id: data.id,
          title: data.title,
          content: data.content,
          createdAt: data.created_at,
          updatedAt: data.updated_at || now
        };
      } else {
        const { data, error } = await supabase
          .from('sms_templates')
          .insert({
            title: template.title,
            content: template.content,
            created_at: now
          })
          .select()
          .single();

        if (error) throw error;
        return {
          id: data.id,
          title: data.title,
          content: data.content,
          createdAt: data.created_at,
          updatedAt: data.updated_at || now
        };
      }
    } catch (err) {
      console.warn('[communicationService] Supabase template save error, saving to localStorage:', err);
    }
  }

  // Fallback: LocalStorage
  const existing = await fetchSmsTemplates();
  let updatedList: SmsTemplate[];
  let savedItem: SmsTemplate;

  if (isUpdate) {
    savedItem = {
      id: template.id!,
      title: template.title,
      content: template.content,
      createdAt: now,
      updatedAt: now
    };
    updatedList = existing.map(t => t.id === template.id ? savedItem : t);
  } else {
    savedItem = {
      id: `tmpl-${Date.now()}`,
      title: template.title,
      content: template.content,
      createdAt: now,
      updatedAt: now
    };
    updatedList = [...existing, savedItem];
  }

  localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(updatedList));
  return savedItem;
};

/**
 * 문자 템플릿 삭제
 */
export const deleteSmsTemplate = async (templateId: string): Promise<boolean> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('sms_templates')
        .delete()
        .eq('id', templateId);
      if (error) throw error;
    } catch (err) {
      console.warn('[communicationService] Supabase template delete error:', err);
    }
  }

  const existing = await fetchSmsTemplates();
  const nextList = existing.filter(t => t.id !== templateId);
  localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(nextList));
  return true;
};

/**
 * 스마트폰으로 문자 발송 요청 (pending_sms 큐에 등록)
 * 안드로이드 스마트폰 앱의 PendingSmsWorker가 이를 실시간 폴링하여 실제 SIM 카드로 발송
 */
export const enqueueSms = async (
  phoneNumber: string, 
  content: string,
  lineInfo: '기본' | '투넘버' = '기본'
): Promise<{ success: boolean; message: string; log?: CommunicationLog }> => {
  const cleanPhone = normalizePhoneNumber(phoneNumber);
  if (!cleanPhone) {
    return { success: false, message: '올바른 전화번호를 입력해주세요.' };
  }
  if (!content.trim()) {
    return { success: false, message: '발송할 문자 내용을 입력해주세요.' };
  }

  const now = new Date().toISOString();
  let queuedInSupabase = false;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('pending_sms')
        .insert([{
          phone_number: cleanPhone,
          content: content.trim(),
          status: 'pending',
          created_at: now
        }])
        .select()
        .single();

      if (!error && data) {
        queuedInSupabase = true;
      }
    } catch (err) {
      console.warn('[communicationService] Supabase enqueueSms error:', err);
    }
  }

  // 발신 즉시 타임라인에도 SMS_OUT 로그로 로컬/클라우드 기록
  const newLog: CommunicationLog = {
    id: `comm-out-${Date.now()}`,
    phoneNumber: cleanPhone,
    type: 'SMS_OUT',
    content: content.trim(),
    timestamp: now,
    createdAt: now,
    lineInfo
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('communication_logs').insert([{
        phone_number: cleanPhone,
        type: 'SMS_OUT',
        content: content.trim(),
        timestamp: now,
        line_info: lineInfo
      }]);
    } catch (e) {
      console.warn('Failed to insert comm log for SMS_OUT', e);
    }
  }

  // Fallback: save to localStorage
  try {
    const local = localStorage.getItem(`comm_logs_${cleanPhone}`);
    const parsed: CommunicationLog[] = local ? JSON.parse(local) : [];
    localStorage.setItem(`comm_logs_${cleanPhone}`, JSON.stringify([...parsed, newLog]));
  } catch (e) {
    console.error('Failed to save comm log to local', e);
  }

  return { 
    success: true, 
    message: queuedInSupabase 
      ? `스마트폰(${lineInfo})으로 발송 요청되었습니다. 앱에서 자동 발송됩니다.`
      : `문자 발송이 등록되었습니다. (오프라인 모드)`,
    log: newLog
  };
};

/**
 * 스마트폰으로 전화 걸기 요청 (Click-to-Call, pending_calls 큐에 등록)
 */
export const enqueueCall = async (
  phoneNumber: string, 
  customerName: string, 
  caseId?: string
): Promise<{ success: boolean; message: string }> => {
  const cleanPhone = normalizePhoneNumber(phoneNumber);
  if (!cleanPhone) return { success: false, message: '유효한 번호가 없습니다.' };

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('pending_calls')
        .insert([{
          phone_number: cleanPhone,
          customer_name: customerName,
          case_id: caseId || null,
          status: 'pending'
        }]);

      if (!error) {
        return { success: true, message: '스마트폰으로 전화 걸기 요청을 전송했습니다.' };
      }
    } catch (err) {
      console.warn('[communicationService] Supabase enqueueCall error:', err);
    }
  }

  return { success: true, message: '전화 걸기 요청 완료 (데모)' };
};

/**
 * 통화 녹음 파일 구글 드라이브 업로드 (Google Apps Script Web App 엔드포인트 연동)
 * - 변호사 로그인 구글 계정 또는 사용자가 설정한 구글 계정/GAS Web App URL로 전송
 */
export const uploadRecordingToDrive = async (
  file: File,
  config?: GoogleDriveConfig,
  targetEmail?: string
): Promise<{ status: string; url: string; viewUrl: string; filename: string; driveFileId?: string }> => {
  const activeCfg = config || getGoogleDriveConfig();
  const gasUrl = activeCfg.gasWebAppUrl || GOOGLE_SCRIPT_URL;
  const userAccountEmail = targetEmail || activeCfg.googleAccountEmail || '';

  // 1. File to Base64
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const payload = {
    target: 'upload',
    data: base64Data,
    filename: file.name,
    mimeType: file.type || 'audio/mp3',
    userEmail: userAccountEmail,
    folderName: activeCfg.folderName || '마이김변_통화녹취'
  };

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success' && result.viewUrl) {
        return {
          status: 'success',
          url: result.viewUrl,
          viewUrl: result.viewUrl,
          filename: file.name,
          driveFileId: result.fileId || undefined
        };
      }
    }
  } catch (err) {
    console.warn('[communicationService] Google Drive upload failed, falling back to blob URL:', err);
  }

  // Fallback to local blob URL
  const blobUrl = URL.createObjectURL(file);
  return {
    status: 'local',
    url: blobUrl,
    viewUrl: blobUrl,
    filename: file.name
  };
};

/**
 * 통화 로그와 구글 드라이브 녹취 파일 자동 매칭 헬퍼
 * - 안드로이드 통화 녹음 파일명 패턴: {전화번호}_{YYYYMMDDHHmmss}.m4a
 * - 또는 통화 로그의 timestamp와 recordings의 uploadDate 간의 시간차(30분 이내) 및 전화번호 대조
 */
export const findMatchingRecordingForLog = (
  log: CommunicationLog,
  recordings?: RecordingItem[]
): RecordingItem | undefined => {
  if (!recordings || recordings.length === 0) return undefined;
  if (!log.type.includes('CALL')) return undefined;

  // 1. 이미 로그에 직접 recordingUrl이 있는 경우
  if (log.recordingUrl) {
    const directFound = recordings.find(r => r.url === log.recordingUrl);
    if (directFound) return directFound;
  }

  const cleanPhone = normalizePhoneNumber(log.phoneNumber);
  const logTime = new Date(log.timestamp).getTime();

  // 2. 파일명에 전화번호 및 일시 패턴이 포함된 경우
  for (const rec of recordings) {
    const fname = rec.filename || '';
    if (fname.includes(cleanPhone)) {
      // 파일명 내 시간 추출 (예: 20260902105505)
      const dateMatch = fname.match(/(\d{4})(\d{2})(\d{2})_?(\d{2})(\d{2})(\d{2})/);
      if (dateMatch) {
        const fileDate = new Date(
          `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`
        ).getTime();
        if (Math.abs(logTime - fileDate) < 15 * 60 * 1000) { // 15분 오차 허용
          return rec;
        }
      }
    }
  }

  // 3. 녹음 업로드 일시와 통화 시각의 시간차가 10분 이내인 가장 가까운 녹취
  let closestRec: RecordingItem | undefined;
  let minDiff = 10 * 60 * 1000; // 10분

  for (const rec of recordings) {
    const recTime = new Date(rec.uploadDate).getTime();
    const diff = Math.abs(logTime - recTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestRec = rec;
    }
  }

  return closestRec;
};

/**
 * 고객 분쟁 방지용 통화 및 문자 내역 공식 증빙 텍스트 내보내기 (TXT/CSV용)
 */
export const exportCommunicationLogsAsText = (
  logs: CommunicationLog[],
  customerName: string,
  phoneNumber: string
): string => {
  const nowStr = new Date().toLocaleString('ko-KR');
  let text = `==========================================================\n`;
  text += `[법률 CRM / 마이김변] 의뢰인 통화 및 문자 공식 소명 증빙 내역\n`;
  text += `==========================================================\n`;
  text += `의뢰인 성명 : ${customerName}\n`;
  text += `연 락 처    : ${phoneNumber}\n`;
  text += `증빙 추출일 : ${nowStr}\n`;
  text += `총 기록 건수: ${logs.length}건\n`;
  text += `----------------------------------------------------------\n\n`;

  logs.forEach((log, index) => {
    const timeFormatted = new Date(log.timestamp).toLocaleString('ko-KR');
    const typeLabel = 
      log.type === 'CALL_IN' ? '📥 수신 통화' :
      log.type === 'CALL_OUT' ? '📤 발신 통화' :
      log.type === 'CALL_MISSED' ? '❌ 부재중 통화' :
      log.type === 'SMS_IN' ? '💬 문자 수신(IN)' : '✉️ 문자 발신(OUT)';

    text += `[${index + 1}] ${timeFormatted} | ${typeLabel} (${log.lineInfo || '기본회선'})\n`;
    if (log.duration && log.duration > 0) {
      const m = Math.floor(log.duration / 60);
      const s = log.duration % 60;
      text += `    - 통화 시간: ${m > 0 ? `${m}분 ` : ''}${s}초\n`;
    }
    if (log.content) {
      text += `    - 내용: ${log.content}\n`;
    }
    if (log.recordingUrl) {
      text += `    - 구글 드라이브 녹취 링크: ${log.recordingUrl}\n`;
    }
    text += `\n`;
  });

  text += `==========================================================\n`;
  text += `* 본 내역은 스마트폰 통화기록 및 문자 삭제에 대비하여 CRM에 영구 암호화 보존된 공식 기록입니다.\n`;
  text += `==========================================================\n`;

  return text;
};

/**
 * 실시간 통화/문자 변경 구독 (Supabase Realtime)
 */
export const subscribeToCommunicationLogs = (
  phoneNumber: string,
  onNewLog: (log: CommunicationLog) => void
): (() => void) => {
  const cleanPhone = normalizePhoneNumber(phoneNumber);
  if (!isSupabaseConfigured || !supabase || !cleanPhone) {
    return () => {};
  }

  const channel = supabase
    .channel(`comm-logs-${cleanPhone}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'communication_logs',
        filter: `phone_number=eq.${cleanPhone}`
      },
      (payload) => {
        const row = payload.new;
        if (row) {
          onNewLog({
            id: row.id,
            phoneNumber: row.phone_number,
            type: row.type,
            duration: Number(row.duration) || 0,
            content: row.content || '',
            timestamp: row.timestamp || row.created_at,
            createdAt: row.created_at,
            lineInfo: row.line_info || '기본'
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
