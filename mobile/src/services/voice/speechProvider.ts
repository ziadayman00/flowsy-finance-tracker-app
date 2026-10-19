/**
 * Speech Recognition Provider Abstraction for Flowsy.
 *
 * Wraps native speech recognition (iOS SFSpeechRecognizer, Android SpeechRecognizer,
 * and Web Speech API fallback) via expo-speech-recognition with runtime capability checks,
 * locale negotiation, on-device availability checks, and non-sensitive error reporting.
 */

export type SpeechPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'blocked';

export type SpeechEngineState =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'recognizing'
  | 'stopping'
  | 'error';

export interface SpeechLocaleInfo {
  locales: string[];
  installedLocales: string[];
  selectedLocale: string;
  supportsOnDevice: boolean;
}

export interface SpeechRecognitionCallbacks {
  onStateChange?: (state: SpeechEngineState) => void;
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (errorMessage: string, isRecoverable: boolean) => void;
}

export interface ISpeechRecognitionProvider {
  isAvailableAsync(): Promise<boolean>;
  getPermissionsAsync(): Promise<SpeechPermissionStatus>;
  requestPermissionsAsync(): Promise<SpeechPermissionStatus>;
  getLocaleInfoAsync(): Promise<SpeechLocaleInfo>;
  start(callbacks: SpeechRecognitionCallbacks): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  getState(): SpeechEngineState;
}

// Dynamically import expo-speech-recognition to gracefully support dev builds, web & tests
let ExpoSpeechRecognitionModule: any = null;
try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
} catch {
  ExpoSpeechRecognitionModule = null;
}

export class NativeSpeechRecognitionProvider implements ISpeechRecognitionProvider {
  private currentState: SpeechEngineState = 'idle';
  private subscriptions: { remove: () => void }[] = [];
  private callbacks: SpeechRecognitionCallbacks = {};
  private activeLocale: string = 'ar-EG';
  private webRecognitionInstance: any = null;

  getState(): SpeechEngineState {
    return this.currentState;
  }

  private setState(state: SpeechEngineState) {
    this.currentState = state;
    this.callbacks.onStateChange?.(state);
  }

  private hasWebSpeech(): boolean {
    return (
      typeof window !== 'undefined' &&
      (typeof (window as any).webkitSpeechRecognition !== 'undefined' ||
        typeof (window as any).SpeechRecognition !== 'undefined')
    );
  }

  async isAvailableAsync(): Promise<boolean> {
    if (this.hasWebSpeech()) return true;
    if (!ExpoSpeechRecognitionModule) return false;
    try {
      if (typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function') {
        return await ExpoSpeechRecognitionModule.isRecognitionAvailable();
      }
      return true;
    } catch {
      return false;
    }
  }

  async getPermissionsAsync(): Promise<SpeechPermissionStatus> {
    if (this.hasWebSpeech()) return 'granted';
    if (!ExpoSpeechRecognitionModule) return 'denied';
    try {
      const res = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (res.granted) return 'granted';
      if (res.canAskAgain === false) return 'blocked';
      return res.status === 'denied' ? 'denied' : 'undetermined';
    } catch {
      return 'denied';
    }
  }

  async requestPermissionsAsync(): Promise<SpeechPermissionStatus> {
    if (this.hasWebSpeech()) return 'granted';
    if (!ExpoSpeechRecognitionModule) return 'denied';
    try {
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (res.granted) return 'granted';
      if (res.canAskAgain === false) return 'blocked';
      return 'denied';
    } catch {
      return 'denied';
    }
  }

  async getLocaleInfoAsync(): Promise<SpeechLocaleInfo> {
    let locales: string[] = [];
    let installedLocales: string[] = [];
    let supportsOnDevice = false;

    if (ExpoSpeechRecognitionModule) {
      try {
        if (typeof ExpoSpeechRecognitionModule.supportsOnDeviceRecognition === 'function') {
          supportsOnDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
        }
        if (typeof ExpoSpeechRecognitionModule.getSupportedLocales === 'function') {
          const res = await ExpoSpeechRecognitionModule.getSupportedLocales({});
          locales = res.locales || [];
          installedLocales = res.installedLocales || [];
        }
      } catch {
        // Fallback
      }
    }

    let selected = 'ar-EG';
    if (locales.length > 0) {
      if (locales.includes('ar-EG')) {
        selected = 'ar-EG';
      } else {
        const anyArabic = locales.find((l) => l.startsWith('ar'));
        if (anyArabic) selected = anyArabic;
      }
    }
    this.activeLocale = selected;

    return {
      locales,
      installedLocales,
      selectedLocale: selected,
      supportsOnDevice,
    };
  }

  async start(callbacks: SpeechRecognitionCallbacks): Promise<void> {
    if (
      this.currentState === 'listening' ||
      this.currentState === 'recognizing' ||
      this.currentState === 'starting'
    ) {
      return;
    }

    this.callbacks = callbacks;
    this.setState('starting');

    // 1. If running on Web / browser with Web Speech API available (Chrome, Edge, Safari)
    if (this.hasWebSpeech()) {
      try {
        if (this.webRecognitionInstance) {
          try {
            this.webRecognitionInstance.abort();
          } catch {}
          this.webRecognitionInstance = null;
        }

        const SpeechClass =
          (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechClass) {
          this.setState('error');
          this.callbacks.onError?.('متصفحك لا يدعم التعرف الصوتي (Web Speech API). يرجى استخدام Google Chrome.', false);
          return;
        }

        this.webRecognitionInstance = new SpeechClass();
        this.webRecognitionInstance.lang = 'ar-EG';
        this.webRecognitionInstance.interimResults = true;
        this.webRecognitionInstance.continuous = false;

        this.webRecognitionInstance.onresult = (event: any) => {
          let interim = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            this.setState('idle');
            this.callbacks.onFinalResult?.(finalTranscript);
          } else {
            this.setState('recognizing');
            this.callbacks.onInterimResult?.(interim);
          }
        };

        this.webRecognitionInstance.onerror = (event: any) => {
          this.setState('error');
          const err = event.error || '';
          let msg = 'حدث خطأ أثناء التعرف الصوتي.';
          let isRecoverable = true;

          if (err === 'not-allowed' || err === 'service-not-allowed') {
            msg = 'تم حظر الميكروفون في المتصفح. يرجى الضغط على أيقونة القفل أو الكاميرا بجوار شريط العنوان والسماح بالميكروفون.';
            isRecoverable = false;
          } else if (err === 'no-speech') {
            msg = 'لم يتم سماع أي صوت، يرجى التحدث في الميكروفون بوضوح.';
          } else if (err === 'network') {
            msg = 'خدمة التعرف الصوتي في المتصفح تتطلب اتصالاً بالإنترنت.';
          } else if (err === 'audio-capture') {
            msg = 'لم يتم العثور على ميكروفون صالح في الجهاز.';
            isRecoverable = false;
          }

          this.callbacks.onError?.(msg, isRecoverable);
        };

        this.webRecognitionInstance.onend = () => {
          if (this.currentState === 'listening' || this.currentState === 'recognizing') {
            this.setState('idle');
          }
        };

        this.webRecognitionInstance.start();
        this.setState('listening');
        return;
      } catch (err: any) {
        this.setState('error');
        const detail = err?.message ? ` (${err.message})` : '';
        this.callbacks.onError?.(`تعذر بدء التعرف الصوتي في المتصفح${detail}.`, true);
        return;
      }
    }

    // 2. If running native Expo
    if (!ExpoSpeechRecognitionModule) {
      this.setState('error');
      this.callbacks.onError?.(
        'يتطلب التعرف على الصوت استخدام Native Development Build (npx expo run:android أو run:ios) أو متصفح الويب (Chrome/Edge)، لأنه غير مدعوم داخل تطبيق Expo Go الافتراضي.',
        false,
      );
      return;
    }

    // Check permissions
    const permission = await this.getPermissionsAsync();
    if (permission !== 'granted') {
      const requested = await this.requestPermissionsAsync();
      if (requested !== 'granted') {
        this.setState('error');
        this.callbacks.onError?.(
          'لم يتم منح صلاحية الميكروفون. يرجى تفعيلها من إعدادات الجهاز.',
          false,
        );
        return;
      }
    }

    // Clean up any stale native listeners
    this.cleanupListeners();

    // Query locale info
    const localeInfo = await this.getLocaleInfoAsync();
    const targetLocale = localeInfo.selectedLocale || 'ar-EG';

    // Register event listeners
    const onResultSub = ExpoSpeechRecognitionModule.addListener(
      'onResult',
      (event: any) => {
        const transcript = event.results?.[0]?.transcript || '';
        if (event.isFinal) {
          this.setState('idle');
          this.callbacks.onFinalResult?.(transcript);
        } else {
          this.setState('recognizing');
          this.callbacks.onInterimResult?.(transcript);
        }
      },
    );

    const onErrorSub = ExpoSpeechRecognitionModule.addListener(
      'onError',
      (event: any) => {
        this.setState('error');
        const errCode = event.error || 'unknown_error';
        const isRecoverable =
          errCode === 'no-speech' || errCode === 'network' || errCode === 'audio-capture';
        const userFriendlyMessage =
          errCode === 'no-speech'
            ? 'لم يتم التقاط أي صوت، يرجى المحاولة والتحدث بوضوح.'
            : errCode === 'network'
              ? 'حدث خطأ في الاتصال بالشبكة لخدمة التعرف الصوتي.'
              : 'حدث خطأ أثناء التعرف على الصوت. يمكنك تعديل النص أو الإدخال يدوياً.';

        this.callbacks.onError?.(userFriendlyMessage, isRecoverable);
      },
    );

    this.subscriptions.push(onResultSub, onErrorSub);

    try {
      await ExpoSpeechRecognitionModule.start({
        lang: targetLocale,
        interimResults: true,
        continuous: false,
      });
      this.setState('listening');
    } catch (err: any) {
      this.setState('error');
      this.callbacks.onError?.('تعذر بدء التسجيل الصوتي. حاول مرة أخرى.', true);
    }
  }

  async stop(): Promise<void> {
    if (this.currentState === 'idle') return;
    this.setState('stopping');

    if (this.webRecognitionInstance) {
      try {
        this.webRecognitionInstance.stop();
      } catch {}
      this.webRecognitionInstance = null;
    }

    if (ExpoSpeechRecognitionModule) {
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch {}
    }
    this.cleanupListeners();
    this.setState('idle');
  }

  async cancel(): Promise<void> {
    if (this.currentState === 'idle') return;

    if (this.webRecognitionInstance) {
      try {
        this.webRecognitionInstance.abort();
      } catch {}
      this.webRecognitionInstance = null;
    }

    if (ExpoSpeechRecognitionModule) {
      try {
        if (typeof ExpoSpeechRecognitionModule.abort === 'function') {
          await ExpoSpeechRecognitionModule.abort();
        } else {
          await ExpoSpeechRecognitionModule.stop();
        }
      } catch {}
    }
    this.cleanupListeners();
    this.setState('idle');
  }

  private cleanupListeners() {
    for (const sub of this.subscriptions) {
      try {
        sub.remove();
      } catch {}
    }
    this.subscriptions = [];
  }
}

export const speechProvider: ISpeechRecognitionProvider = new NativeSpeechRecognitionProvider();
