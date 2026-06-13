# PRD — ScreenScribe
**Product Requirements Document**
Version 1.0 | Next.js | Frontend-only | No backend

---

## 1. Overview

**ScreenScribe** is a browser-based screen recording tool built with Next.js (App Router) that captures the full screen with system audio and generates a live transcript — all without any backend server. Recordings are saved as high-quality `.mp4` files and transcripts are saved as `.txt` / `.srt` files, directly from the browser.

### Problem statement

Developers and content creators need a lightweight, zero-infrastructure tool to record their screen, capture system audio, and get an automatic transcript — without uploading anything to a server or paying for a SaaS subscription.

### Goals

- One-click screen + audio recording from the browser
- Real-time transcription running fully client-side
- High-quality `.mp4` export (1080p, high bitrate)
- Transcript export in `.txt` and `.srt` formats
- Zero backend — all processing in-browser via Web APIs and WASM

### Non-goals

- Cloud storage or sync
- User authentication
- Multi-participant recording
- Mobile support (desktop Chrome/Edge only)

---

## 2. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | File-based routing, no extra config |
| Language | TypeScript | Type safety across media APIs |
| Screen capture | `getDisplayMedia()` Web API | Native browser, no install |
| Audio capture | `getDisplayMedia({ audio: true })` + `getUserMedia()` | System audio + mic mix |
| Recording | `MediaRecorder` API (`video/webm; codecs=vp9,opus`) | Built-in, high quality |
| MP4 conversion | `ffmpeg.wasm` (`@ffmpeg/ffmpeg` + `@ffmpeg/util`) | In-browser ffmpeg, free, WASM |
| Transcription | `whisper.rn` or `@xenova/transformers` (Whisper base/small) | Runs fully in-browser via ONNX |
| Styling | Tailwind CSS v3 | Utility-first, no build complexity |
| State | React `useState` / `useRef` | No external store needed |

### Key packages

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
npm install @xenova/transformers
npm install next typescript tailwindcss
```

> **Note on Whisper in-browser:** `@xenova/transformers` runs OpenAI Whisper (base ~145 MB) via ONNX Runtime Web. First load downloads the model and caches it in IndexedDB. Subsequent runs are instant. Transcription is chunked — each 30s audio segment is processed after recording stops.

---

## 3. User stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-01 | User | Click a single Record button | Recording starts without any configuration dialogs beyond the system screen-picker |
| US-02 | User | See a live timer and audio level indicator while recording | I know the session is active |
| US-03 | User | Click Stop | Recording stops, processing begins immediately |
| US-04 | User | See a progress indicator during MP4 conversion and transcription | I know the app isn't frozen |
| US-05 | User | Preview my recording inline | I can verify before saving |
| US-06 | User | Download the `.mp4` file | I have a portable, high-quality video |
| US-07 | User | Download the transcript as `.txt` | I have a plain text copy |
| US-08 | User | Download the transcript as `.srt` | I can attach subtitles to my video |
| US-09 | User | See real-time transcription text appearing during recording | I get live feedback |
| US-10 | User | Record again without refreshing | The UI resets cleanly |

---

## 4. Functional requirements

### 4.1 Screen + audio capture

- **FR-01** — Call `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` to capture the screen with system audio.
- **FR-02** — Call `navigator.mediaDevices.getUserMedia({ audio: true })` to optionally capture microphone audio alongside system audio.
- **FR-03** — Mix both audio tracks using the Web Audio API (`AudioContext` + `MediaStreamAudioSourceNode` + `MediaStreamDestinationNode`) into a single combined stream before passing to `MediaRecorder`.
- **FR-04** — If the user denies system audio access, fall back to microphone-only audio with a visible warning.
- **FR-05** — Video constraints: `{ width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }`.

### 4.2 Recording

- **FR-06** — Use `MediaRecorder` with `mimeType: 'video/webm;codecs=vp9,opus'` (fallback: `video/webm`).
- **FR-07** — Collect chunks via `ondataavailable` at 1-second intervals.
- **FR-08** — On stop, concatenate all chunks into a single `Blob` of type `video/webm`.
- **FR-09** — Display elapsed recording time (MM:SS) updating every second.
- **FR-10** — Display a live audio level meter using `AnalyserNode` from Web Audio API.

### 4.3 MP4 conversion

- **FR-11** — After recording stops, convert the `.webm` blob to `.mp4` using `@ffmpeg/ffmpeg` (WASM build).
- **FR-12** — FFmpeg command: `ffmpeg -i input.webm -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k output.mp4`
  - `crf 18` = near-lossless quality (0–51 scale; lower = better)
  - `preset fast` = good speed/quality balance
- **FR-13** — Show a progress bar during conversion using `ffmpeg.on('progress', ...)`.
- **FR-14** — On completion, trigger a browser download for `screen-recording-<timestamp>.mp4`.
- **FR-15** — The ffmpeg WASM core must be loaded from CDN (`unpkg` or `jsdelivr`) on first use, with a loading state shown to the user.

> **COOP/COEP headers required:** FFmpeg WASM uses `SharedArrayBuffer`. Next.js `next.config.js` must set:
> ```js
> headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
>           { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }]
> ```

### 4.4 Transcription

- **FR-16** — Extract audio from the recorded `.webm` blob as a `Float32Array` PCM buffer (16 kHz, mono) using `AudioContext.decodeAudioData()`.
- **FR-17** — Load `Xenova/whisper-base` (or `whisper-small` for higher accuracy) via `@xenova/transformers` `pipeline('automatic-speech-recognition', ...)`.
- **FR-18** — Run transcription with `{ return_timestamps: true }` to generate word-level or segment-level timestamps.
- **FR-19** — Display the transcript text in a scrollable panel after processing.
- **FR-20** — Export `.txt`: plain concatenated transcript text.
- **FR-21** — Export `.srt`: generate properly formatted SRT with index, timestamp (`HH:MM:SS,mmm --> HH:MM:SS,mmm`), and text per segment.
- **FR-22** — Show model download progress (first run only) with a progress bar and size indicator (e.g. "Downloading model… 87 MB / 145 MB").
- **FR-23** *(stretch)* — Show live partial transcript during recording using Whisper's streaming chunked mode at 10–15 second intervals.

### 4.5 UI states

| State | UI |
|---|---|
| `idle` | Record button (large, centered), permission note |
| `requesting` | Spinner, "Waiting for screen selection…" |
| `recording` | Red pulsing dot, timer, audio level bar, Stop button |
| `processing` | Progress bar (MP4 conversion %) + transcription spinner |
| `done` | Video preview, transcript panel, download buttons |
| `error` | Inline error message with retry option |

---

## 5. Non-functional requirements

- **NFR-01 Performance** — MP4 conversion of a 10-minute 1080p recording must complete within 3 minutes on a modern laptop (M1/i7).
- **NFR-02 Quality** — Output `.mp4` must be visually lossless at target resolution (CRF 18).
- **NFR-03 Privacy** — No data leaves the browser. No analytics, no telemetry, no API calls except model/WASM downloads on first run.
- **NFR-04 Browser support** — Chrome 94+ and Edge 94+ only (required for `getDisplayMedia` with system audio + WASM SIMD).
- **NFR-05 Transcript accuracy** — Whisper base achieves ~10% WER on English speech; acceptable for meeting notes use case.
- **NFR-06 First load** — Model download (145 MB) is shown to the user with a clear progress indicator. Cached after first download via IndexedDB.
- **NFR-07 No SSR for media** — All `MediaRecorder`, `AudioContext`, and `@xenova/transformers` code runs client-side only (`'use client'` directive; dynamic imports with `ssr: false`).

---

## 6. Architecture

```
/app
  layout.tsx              ← COOP/COEP headers set in next.config.js
  page.tsx                ← Main recorder page (client component)

/components
  RecordButton.tsx        ← Idle / recording toggle
  AudioMeter.tsx          ← Live AnalyserNode visualiser
  Timer.tsx               ← Elapsed time display
  ProgressPanel.tsx       ← FFmpeg + Whisper progress bars
  VideoPreview.tsx        ← <video> element with download link
  TranscriptPanel.tsx     ← Scrollable text + SRT/TXT download

/hooks
  useScreenRecorder.ts    ← getDisplayMedia, MediaRecorder, chunk collection
  useAudioMixer.ts        ← AudioContext mixing (system + mic)
  useFFmpeg.ts            ← FFmpeg WASM init, webm→mp4 conversion
  useTranscription.ts     ← @xenova/transformers Whisper pipeline

/lib
  srtFormatter.ts         ← Timestamp segments → valid .srt string
  audioExtractor.ts       ← Blob → Float32Array PCM for Whisper

next.config.js            ← COOP/COEP headers, webpack config for WASM
```

### Data flow

```
getDisplayMedia() + getUserMedia()
        ↓
   AudioContext mixer
        ↓
   MediaRecorder (webm chunks)
        ↓ (on stop)
   ┌────────────────────────┐
   │                        │
ffmpeg.wasm             audioExtractor
(webm → mp4)           (blob → PCM Float32)
   │                        │
Download .mp4         Whisper ONNX pipeline
                            │
                    Transcript segments
                            │
                   Download .txt / .srt
```

---

## 7. Screen & component spec

### Main page (idle state)

```
┌──────────────────────────────────────────┐
│                                          │
│           ScreenScribe                   │
│    Record your screen. Keep your words.  │
│                                          │
│              ⬤  Record                  │
│                                          │
│   Works in Chrome & Edge · No uploads   │
│                                          │
└──────────────────────────────────────────┘
```

### Recording state

```
┌──────────────────────────────────────────┐
│  ● REC   00:03:47                        │
│  ████░░░░░░  (audio level)               │
│                                          │
│  [  ■  Stop Recording  ]                 │
│                                          │
│  Live transcript:                        │
│  "...so if we look at the dashboard,     │
│   you can see the metrics are..."        │
└──────────────────────────────────────────┘
```

### Done state

```
┌──────────────────────────────────────────┐
│  ┌─────────────────────────┐             │
│  │   video preview         │             │
│  └─────────────────────────┘             │
│                                          │
│  [↓ Download MP4]  [↓ TXT]  [↓ SRT]    │
│                                          │
│  Transcript                              │
│  ┌─────────────────────────┐             │
│  │ 00:00:12 → 00:00:18     │             │
│  │ So let me walk you...   │             │
│  │ 00:00:19 → 00:00:26     │             │
│  │ You can see here that.. │             │
│  └─────────────────────────┘             │
│                                          │
│  [↺ Record Again]                        │
└──────────────────────────────────────────┘
```

---

## 8. Key implementation notes

### FFmpeg WASM setup

```ts
// hooks/useFFmpeg.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();
const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

await ffmpeg.load({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
});
```

### Whisper setup

```ts
// hooks/useTranscription.ts
import { pipeline } from '@xenova/transformers';

const transcriber = await pipeline(
  'automatic-speech-recognition',
  'Xenova/whisper-base',
  { progress_callback: (p) => setModelProgress(p.progress) }
);

const result = await transcriber(audioFloat32, {
  return_timestamps: true,
  chunk_length_s: 30,
  stride_length_s: 5,
});
```

### Audio mixing

```ts
// hooks/useAudioMixer.ts
const ctx = new AudioContext();
const dest = ctx.createMediaStreamDestination();

const sysSource = ctx.createMediaStreamSource(systemStream);
const micSource = ctx.createMediaStreamSource(micStream);

sysSource.connect(dest);
micSource.connect(dest);

// dest.stream → MediaRecorder
```

### next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      ],
    }];
  },
};
module.exports = nextConfig;
```

---

## 9. Known constraints & mitigations

| Constraint | Impact | Mitigation |
|---|---|---|
| System audio capture not supported on macOS Chrome | No system audio on Mac | Show clear warning; fall back to mic; suggest OBS as alternative |
| FFmpeg WASM is ~25 MB download | Slow first load | Lazy-load only after recording stops; show progress |
| Whisper base model is ~145 MB | Very slow first run | Cache in IndexedDB; show download progress; explain one-time cost |
| `SharedArrayBuffer` requires COOP/COEP | Breaks if deployed without headers | Document required headers; provide Vercel `vercel.json` config |
| Long recordings (>30 min) may OOM | Browser tab crash | Warn user at 20 min; suggest chunked recording for long sessions |
| Whisper accuracy degrades with heavy accents | Poor transcript quality | Document limitation; allow users to copy-edit transcript before saving |

---

## 10. Out of scope (v1)

- Cloud save / Google Drive integration
- Real-time collaborative transcript editing
- Speaker diarisation (who said what)
- Webcam overlay / picture-in-picture
- Trim / cut video before export
- Custom output resolution selection
- Firefox support (`getDisplayMedia` system audio not available)

---

## 11. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-01 | Clicking Record opens the native screen picker within 1 second |
| AC-02 | Recording starts immediately after screen selection |
| AC-03 | Timer increments every second accurately |
| AC-04 | Stopping recording triggers MP4 conversion with a visible progress % |
| AC-05 | Downloaded `.mp4` plays correctly in VLC and Chrome |
| AC-06 | Downloaded `.mp4` is visually equivalent to the original screen capture |
| AC-07 | Whisper transcript is generated and displayed after processing |
| AC-08 | `.srt` file is valid and loads correctly in VLC / Handbrake |
| AC-09 | No network requests are made after initial model/WASM download |
| AC-10 | The page works after clicking "Record Again" without a browser refresh |
| AC-11 | An appropriate error message is shown if screen permission is denied |
| AC-12 | The app loads and functions correctly on Chrome 94+ and Edge 94+ |

---

## 12. Milestones

| Milestone | Deliverable | Est. effort |
|---|---|---|
| M1 | Screen capture + MediaRecorder working, webm download | 1 day |
| M2 | FFmpeg WASM integration, webm → mp4 conversion | 1 day |
| M3 | Audio mixing (system + mic) | 0.5 day |
| M4 | Whisper transcription pipeline, txt/srt export | 1.5 days |
| M5 | UI polish, all states, error handling | 1 day |
| M6 | Live partial transcript during recording (stretch) | 1 day |
| **Total** | | **~6 days** |

---

*Document owner: Hari · Last updated: June 2026*
