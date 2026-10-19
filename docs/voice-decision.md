# Flowsy Voice Expense Entry & Speech Recognition Decision Record

## 1. Context & Objective

The objective is to provide a reliable, privacy-first Egyptian Arabic voice expense entry workflow within Flowsy without depending on cloud LLM APIs, while running seamlessly on device platforms (Android, iOS, Web).

---

## 2. Speech-to-Text Engine Selection

### Evaluated Options:
1. **Cloud Generative AI / Speech APIs (Whisper, Gemini)**:
   - *Pros*: Flexible NL understanding.
   - *Cons*: Network latency, ongoing operational cost, privacy risk of streaming financial speech to 3rd-party servers, uncalibrated financial hallucinations.
2. **`expo-speech`**:
   - Provides Text-to-Speech only; lacks speech-to-text capabilities.
3. **`expo-speech-recognition` (Selected Engine)**:
   - *Architecture*: Directly bridges native platform speech engines:
     - Android: `android.speech.SpeechRecognizer`
     - iOS: `SFSpeechRecognizer`
     - Web: `webkitSpeechRecognition` (Web Speech API)
   - *Offline/On-Device*: Supports on-device recognition where available.
   - *Locales*: Negotiates runtime locale (`ar-EG`, `ar-SA`, `ar`).

---

## 3. Provider Abstraction Architecture

The speech engine is encapsulated behind an interface in `mobile/src/services/voice/speechProvider.ts`:

```typescript
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
```

### Key Safety Invariants:
1. **Dynamic Module Resolution**: `expo-speech-recognition` is imported dynamically. If running in environments without the native module (e.g. standard Node test runner or unsupported browsers), it gracefully reports `isAvailableAsync() = false` without throwing.
2. **Permission Handling**: Explicit checks for `granted`, `denied`, and `blocked`. When blocked, user is guided calmly without crashes.
3. **Deterministic Parser**: Speech transcripts are parsed strictly by deterministic regex and dictionary matchers (`expenseParser.ts`, `amountParser.ts`, `dateParser.ts`, `categoryMatcher.ts`).
4. **Human Review Mandatory**: Voice-parsed candidates are **never** committed directly to the database. They feed S12 (`QuickEntryReviewSheet`), allowing the user to review, edit, or delete candidates before batch submission.
