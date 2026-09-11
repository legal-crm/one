/**
 * 브라우저 Web Speech Synthesis API를 활용한 자연스러운 한국어 TTS 음성 재생 유틸리티
 */

class BrowserSpeechSynthesizer {
  private isSupported: boolean;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (this.isSupported) {
      this.initVoice();
    }
  }

  private initVoice() {
    if (!this.isSupported) return;

    const findKoreanVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // 1순위: Google 한국어, 2순위: Microsoft Heami/Yuna, 3순위: ko-KR 언어 코드 매칭
      const koVoice = voices.find(v => v.lang.includes('ko') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural')))
        || voices.find(v => v.lang.includes('ko') || v.lang.includes('KO'))
        || null;
      this.selectedVoice = koVoice;
    };

    findKoreanVoice();
    if (typeof window !== 'undefined' && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findKoreanVoice;
    }
  }

  /**
   * 텍스트를 음성으로 재생
   */
  speak(
    text: string,
    options: {
      rate?: number; // 속도 (기본 0.95 - 안정적이고 따뜻한 톤)
      pitch?: number; // 높낮이 (기본 1.0)
      volume?: number; // 음량 (0.0 ~ 1.0)
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    } = {}
  ): void {
    if (!this.isSupported) {
      console.warn('[SpeechSynthesis] Browser does not support speech synthesis.');
      return;
    }

    this.stop(); // 이전 음성 즉시 중단

    const cleanText = text.replace(/[*#_~`\[\]]/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';
    utterance.rate = options.rate ?? 0.95;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    if (options.onStart) utterance.onstart = options.onStart;
    if (options.onEnd) utterance.onend = options.onEnd;
    if (options.onError) utterance.onerror = options.onError;

    this.currentUtterance = utterance;
    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[SpeechSynthesis speak error]', e);
    }
  }

  /**
   * 음성 재생 즉시 중단
   */
  stop(): void {
    if (!this.isSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    this.currentUtterance = null;
  }

  /**
   * 현재 음성이 재생 중인지 확인
   */
  isSpeaking(): boolean {
    if (!this.isSupported) return false;
    return window.speechSynthesis.speaking;
  }
}

export const speechSynthesizer = new BrowserSpeechSynthesizer();
