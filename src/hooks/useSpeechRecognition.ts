import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  setTranscript: (val: string | ((prev: string) => string)) => void;
}

export function useSpeechRecognition({
  lang = 'ko-KR',
  continuous = true,
  interimResults = true,
  onResult,
  onError
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef(false);

  // 브라우저 Web Speech API 지원 여부 확인
  const isSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  // 인식기 초기화
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMessage(null);
    };

    recognition.onresult = (event: any) => {
      let finalStr = '';
      let interimStr = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0].transcript;
        if (item.isFinal) {
          finalStr += text + ' ';
        } else {
          interimStr += text;
        }
      }

      if (finalStr) {
        setTranscript(prev => {
          const next = (prev ? prev.trim() + ' ' : '') + finalStr.trim();
          if (onResult) onResult(next);
          return next;
        });
      }
      setInterimTranscript(interimStr);
    };

    recognition.onerror = (event: any) => {
      console.warn('[SpeechRecognition Error]', event.error);
      let msg = '음성 인식 중 오류가 발생했습니다.';
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        msg = '마이크 권한이 차단되었습니다. 브라우저 설정에서 마이크를 허용해주세요.';
      } else if (event.error === 'no-speech') {
        // 음성이 감지되지 않은 경우는 치명적 오류 아님
        return;
      } else if (event.error === 'network') {
        msg = '네트워크 연결이 불안정하여 음성 인식이 중단되었습니다.';
      }
      setErrorMessage(msg);
      if (onError) onError(msg);
      setIsListening(false);
    };

    recognition.onend = () => {
      setInterimTranscript('');
      // 연속 모드인데 사용자가 명시적으로 중단하지 않은 경우 재시작
      if (!isManuallyStoppedRef.current && continuous) {
        try {
          // 일시적 대기 후 재시작 시도 (사파리/크롬 대응)
          if (isListening) {
            recognition.start();
            return;
          }
        } catch {
          // ignore
        }
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    };
  }, [isSupported, lang, continuous, interimResults, onResult, onError]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setErrorMessage('이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트 입력을 이용해 주세요.');
      return;
    }
    setErrorMessage(null);
    isManuallyStoppedRef.current = false;
    try {
      recognitionRef.current?.start();
    } catch (e: any) {
      // 이미 시작된 경우 무시
      if (e.name !== 'InvalidStateError') {
        console.warn('[Speech start failed]', e);
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      console.warn('[Speech stop failed]', e);
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    setTranscript
  };
}
