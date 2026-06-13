# ScreenScribe

A zero-backend, browser-based screen recorder that captures your screen with system audio, converts recordings to high-quality MP4 using ffmpeg.wasm, and generates transcripts with Whisper AI — all running locally in your browser. No uploads, no cloud, no subscriptions.

![ScreenScribe Preview](https://raw.githubusercontent.com/HariKrishna-9885699666/meeting-mind/main/public/og-image.png)

## Features

- **One-click recording** — Capture screen + system audio + microphone with a single button
- **4K & 1080p resolution selector** — Choose Ultra HD (3840×2160 @ 60fps) or Full HD (1920×1080 @ 30fps)
- **Native MP4 recording** — Chrome/Edge can record directly to MP4 (H.264/AAC), skipping FFmpeg conversion entirely
- **High-quality MP4 export** — Falls back to 1080p WebM → MP4 via in-browser ffmpeg.wasm (CRF 18, 20 Mbps)
- **Live transcription** — Real-time speech-to-text using Whisper (base) running entirely client-side via ONNX Runtime Web
- **Dual audio capture** — Mixes system audio + microphone using Web Audio API
- **Multiple export formats** — Download transcripts as `.txt` or `.srt` (subtitle) files
- **Keyboard shortcuts** — Press `Escape` to stop recording
- **Zero infrastructure** — All processing happens in your browser; no data ever leaves your machine
- **Privacy-first** — No analytics, no telemetry, no external API calls after initial model/WASM load
- **PWA ready** — Installable web app with offline-capable caching
- **About modal** — Floating info button with creator details and social links

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Screen Capture | `getDisplayMedia()` Web API |
| Audio Capture | `getDisplayMedia({ audio: true })` + `getUserMedia()` |
| Audio Mixing | Web Audio API (`AudioContext` + `MediaStreamAudioDestinationNode`) |
| Recording | `MediaRecorder` API (dual: video + audio-only for transcription) |
| Video Codecs | MP4 (H.264/AAC) preferred, WebM (VP9/Opus) fallback |
| MP4 Conversion | `@ffmpeg/ffmpeg` + `@ffmpeg/util` (WASM) |
| Transcription | `@xenova/transformers` (Whisper base via ONNX) |
| Styling | Tailwind CSS v3 + custom CSS (glassmorphism, animations) |
| State | React `useState` / `useRef` / `useCallback` |

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome 94+ or Edge 94+ (required for system audio capture + WASM SIMD + MP4 recording)

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
    ┌─────────────────────────────────┐
    │                                 │
MediaRecorder (video)          MediaRecorder (audio-only)
    │                                 │
    ▼                                 ▼
WebM/MP4 chunks              WebM audio chunks
    │                                 │
    ▼                                 ▼
┌─────────────────────────┐     ┌──────────────────┐
│  Native MP4?            │     │  Live transcription │
│  Yes → Show immediately │     │  (every 12s)       │
│  No  → FFmpeg WASM      │     │                    │
│       (webm → mp4)      │     └────────┬─────────┘
└─────────────────────────┘              ▼
         │                    Whisper ONNX pipeline
         ▼                    (transcribePartial)
    Download .mp4              │
                               ▼
                    Transcript segments (timestamped)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
               Download .txt         Download .srt
```

## Browser Support

| Browser | Supported | Notes |
|---------|-----------|-------|
| Chrome 94+ | ✅ Full support | Native MP4 recording, system audio, WASM SIMD |
| Edge 94+ | ✅ Full support | Native MP4 recording, system audio, WASM SIMD |
| Firefox | ❌ No system audio | `getDisplayMedia` lacks system audio support |
| Safari | ❌ No support | No `getDisplayMedia` system audio, no SharedArrayBuffer |
| Mobile | ❌ Desktop only | Requires desktop browser APIs |

> **macOS note:** Chrome on macOS cannot capture system audio due to OS restrictions. ScreenScribe will fall back to microphone-only with a visible warning.

## Project Structure

```
app/
  layout.tsx              # Metadata, COOP/COEP headers, font preconnects
  page.tsx                # Main recorder page (client component)
  globals.css             # Tailwind + custom glassmorphism, animations
  favicon.svg             # Animated SVG favicon

components/
  RecordButton.tsx        # Animated button with pulsing rings, feature badges
  AudioMeter.tsx          # 28-bar audio visualizer with glow effects
  Timer.tsx               # Large mono timer with pulsing REC indicator
  ProgressPanel.tsx       # FFmpeg + Whisper + model download progress bars
  VideoPreview.tsx        # <video> element with download link (optimized URL handling)
  TranscriptPanel.tsx     # Scrollable transcript + TXT/SRT download
  KeyboardHandler.tsx     # Escape key listener for stop recording
  FloatingInfoButton.tsx  # About modal with creator info & social links

hooks/
  useScreenRecorder.ts    # Dual MediaRecorder (video + audio), 4K/1080p, audio mixing
  useFFmpeg.ts            # FFmpeg WASM init, webm→mp4 conversion
  useTranscription.ts     # @xenova/transformers Whisper pipeline (live + full)

lib/
  srtFormatter.ts         # Timestamp segments → valid .srt string
  audioExtractor.ts       # Blob → Float32Array PCM for Whisper

public/
  favicon.svg             # Animated recording dot + sound waves
  site.webmanifest        # PWA manifest

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
- **Background transcription** — After recording stops, full transcription runs in background (shows "Transcribing audio..." spinner if not complete)

## License

MIT

## Author

**Hari Krishna Anem**  
B.Tech (CSIT) | Hyderabad, India  
- GitHub: [@HariKrishna-9885699666](https://github.com/HariKrishna-9885699666)
- LinkedIn: [anemharikrishna](https://linkedin.com/in/anemharikrishna)
- Blog: [@HariKrishna-9885699666](https://hashnode.com/@HariKrishna-9885699666)
- Portfolio: [harikrishna.is-a-good.dev](https://harikrishna.is-a-good.dev)