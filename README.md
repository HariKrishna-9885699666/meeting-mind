# ScreenScribe

A zero-backend, browser-based screen recorder that captures your screen with system audio, converts recordings to high-quality MP4 using ffmpeg.wasm, and generates transcripts with Whisper AI — all running locally in your browser. No uploads, no cloud, no subscriptions.

## Features

- **One-click recording** — Capture screen + system audio + microphone with a single button
- **High-quality MP4 export** — 1080p, near-lossless (CRF 18) via in-browser ffmpeg.wasm
- **Live transcription** — Real-time speech-to-text using Whisper (base/small) running entirely client-side via ONNX Runtime Web
- **Multiple export formats** — Download transcripts as `.txt` or `.srt` (subtitle) files
- **Zero infrastructure** — All processing happens in your browser; no data ever leaves your machine
- **Privacy-first** — No analytics, no telemetry, no external API calls after initial model/WASM load

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Screen Capture | `getDisplayMedia()` Web API |
| Audio Capture | `getDisplayMedia({ audio: true })` + `getUserMedia()` |
| Recording | `MediaRecorder` API (`video/webm; codecs=vp9,opus`) |
| MP4 Conversion | `@ffmpeg/ffmpeg` + `@ffmpeg/util` (WASM) |
| Transcription | `@xenova/transformers` (Whisper base/small via ONNX) |
| Styling | Tailwind CSS v3 |

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome 94+ or Edge 94+ (required for system audio capture + WASM SIMD)

### Installation

```bash
git clone https://github.com/HariKrishna-9885699666/meeting-mind.git
cd meeting-mind
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge.

### Build for Production

```bash
npm run build
npm start
```

## How It Works

```
getDisplayMedia() + getUserMedia()
         ↓
    AudioContext mixer (system + mic)
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

## Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome 94+ | ✅ Full support |
| Edge 94+ | ✅ Full support |
| Firefox | ❌ No system audio via `getDisplayMedia` |
| Safari | ❌ No `getDisplayMedia` system audio, no SharedArrayBuffer |
| Mobile | ❌ Desktop only |

> **macOS note:** Chrome on macOS cannot capture system audio due to OS restrictions. ScreenScribe will fall back to microphone-only with a visible warning.

## Project Structure

```
app/
  layout.tsx              # COOP/COEP headers for SharedArrayBuffer
  page.tsx                # Main recorder page (client component)

components/
  RecordButton.tsx        # Idle / recording toggle
  AudioMeter.tsx          # Live AnalyserNode visualiser
  Timer.tsx               # Elapsed time display
  ProgressPanel.tsx       # FFmpeg + Whisper progress bars
  VideoPreview.tsx        # <video> element with download link
  TranscriptPanel.tsx     # Scrollable text + SRT/TXT download

hooks/
  useScreenRecorder.ts    # getDisplayMedia, MediaRecorder, chunk collection
  useAudioMixer.ts        # AudioContext mixing (system + mic)
  useFFmpeg.ts            # FFmpeg WASM init, webm→mp4 conversion
  useTranscription.ts     # @xenova/transformers Whisper pipeline

lib/
  srtFormatter.ts         # Timestamp segments → valid .srt string
  audioExtractor.ts       # Blob → Float32Array PCM for Whisper

next.config.mjs           # COOP/COEP headers, webpack config for WASM
```

## Configuration

### Required Headers (COOP/COEP)

FFmpeg WASM requires `SharedArrayBuffer`, which needs cross-origin isolation headers. These are configured in `next.config.mjs`:

```js
headers: [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
]
```

### Vercel Deployment

Add `vercel.json` for proper headers on Vercel:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

## Known Limitations

- **First load downloads** — FFmpeg core (~25 MB) and Whisper model (~145 MB) download on first use, then cache in IndexedDB
- **Long recordings** — Sessions >20 minutes may risk OOM; chunked recording recommended
- **Accents/noise** — Whisper base has ~10% WER on English; accuracy varies with audio quality
- **No Firefox/Safari** — Missing required Web APIs

## License

MIT