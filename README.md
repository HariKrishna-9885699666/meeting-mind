# MeetMind

A zero-backend, browser-based screen recorder that captures your screen with system audio, mixes in microphone input, and generates AI-powered transcripts — all running locally in your browser. No uploads, no cloud, no subscriptions.

![MeetMind Preview](https://raw.githubusercontent.com/HariKrishna-9885699666/meeting-mind/main/public/og-image.png)

## Features

- **One-click recording** — Click Record, choose a screen/window, and you're live
- **4K & 1080p resolution selector** — Toggle between Ultra HD (3840×2160 @ 60fps) and Full HD (1920×1080 @ 30fps) before recording
- **Native MP4 recording** — Chrome/Edge can record directly to MP4 (H.264/AAC), skipping FFmpeg conversion entirely. Instant playback after stopping
- **FFmpeg WASM fallback** — If MP4 isn't supported, records WebM (VP9/VP8) and converts to MP4 in-browser via ffmpeg.wasm (CRF 18, 192 kbps AAC audio)
- **Resolution-based bitrate** — 12 Mbps for 4K, 6 Mbps for 1080p — balanced quality without bloated files
- **Dual audio capture** — Mixes system audio + microphone via Web Audio API into a single recording
- **Live transcription** — Real-time speech-to-text every 12 seconds using Whisper (base) running entirely client-side via ONNX Runtime Web
- **Background transcription** — When recording stops, the video appears instantly while Whisper transcribes the full audio in the background
- **Multiple export formats** — Download transcripts as `.txt` or `.srt` (subtitle) files, plus the `.mp4` video
- **Keyboard shortcuts** — Press `Escape` to stop recording with visual "Esc to stop" indicator
- **VEED.io-inspired UI** — Clean dark theme with glassmorphism effects, animated record button, audio visualizer, and feature cards
- **Privacy-first** — No analytics, no telemetry, no external API calls after initial model/WASM download
- **PWA ready** — Installable web app with manifest
- **About modal** — Floating info button (bottom-right) with creator details and social links

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Screen Capture | `getDisplayMedia()` Web API |
| Audio Capture | `getDisplayMedia({ audio: true })` + `getUserMedia()` |
| Audio Mixing | Web Audio API (`AudioContext` + `MediaStreamAudioDestinationNode`) |
| Recording | `MediaRecorder` API (dual: video + audio-only for live transcription) |
| Video Codecs | MP4 (H.264/AAC) preferred, WebM (VP9 → VP8) fallback |
| FFmpeg Conversion | `@ffmpeg/ffmpeg` + `@ffmpeg/util` (WASM, self-hosted from `/ffmpeg/`) |
| Transcription | `@xenova/transformers` (Whisper base via ONNX Runtime Web) |
| Styling | Tailwind CSS v3 + custom CSS (glassmorphism, shimmer, modal animations) |
| State | React `useState` / `useRef` / `useCallback` |

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome 94+ or Edge 94+ (required for system audio capture + WASM SIMD + native MP4 recording)

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
    ┌─────────────────────────────────────┐
    │      Parallel MediaRecorders        │
    ├──────────────────┬──────────────────┤
    │   Video Recorder │  Audio Recorder  │
    │  (combined AV)   │  (audio-only)    │
    │  chunks @ 1s     │  chunks @ 1s     │
    └────────┬─────────┴────────┬─────────┘
             │                  │
             ▼                  ▼
    ┌────────────────┐   ┌──────────────────┐
    │  Native MP4?   │   │ Live transcription│
    │  Yes → Done    │   │ (every 12s via   │
    │  No → FFmpeg   │   │ transcribePartial)│
    │       WASM     │   └────────┬─────────┘
    │  (webm → mp4)  │            │
    └────────┬───────┘            ▼
             │           Whisper ONNX pipeline
             ▼           (incremental chunks)
    Show video +               │
    start background    Accumulated live segments
    transcription              │
    (deferred 1s)              ▼
             │        When recording stops:
             │        Full transcribe() runs
             │        in background (no UI block)
             ▼
    ┌────────────────────┐
    │  Done State        │
    │  ┌──────────────┐  │
    │  │ Video player │  │
    │  │ + Download   │  │
    │  │   MP4 button │  │
    │  ├──────────────┤  │
    │  │ Transcript   │  │
    │  │ (TXT / SRT   │  │
    │  │  download)   │  │
    │  └──────────────┘  │
    │  [Record Again]    │
    └────────────────────┘
```

## App States

| State | UI |
|---|---|
| `idle` | Resolution toggle pill (1080p / 4K), large Record button with pulsing glow ring, 3 feature cards (resolution, system audio, AI transcript), header with logo + "All local · No uploads" badge |
| `requesting` | Spinner + "Waiting for screen selection..." — system picker is open |
| `recording` | Glass recording bar with REC indicator + timer + audio visualizer, Stop button with "Esc to stop" hint, live transcript panel (updates every 12s) |
| `processing` | (WebM fallback only) Spinner + FFmpeg conversion progress bar + model download / transcription progress — MP4 path skips this entirely |
| `done` | Video player with download MP4 button, transcript panel with TXT/SRT download buttons, "Record Another Video" button |
| `error` | Inline red banner with error message + "Try again →" button |

## Browser Support

| Browser | Supported | Notes |
|---------|-----------|-------|
| Chrome 94+ | ✅ Full support | Native MP4 recording, system audio, WASM SIMD |
| Edge 94+ | ✅ Full support | Native MP4 recording, system audio, WASM SIMD |
| Firefox | ❌ No system audio | `getDisplayMedia` lacks system audio support |
| Safari | ❌ No support | No `getDisplayMedia` system audio, no SharedArrayBuffer |
| Mobile | ❌ Desktop only | Requires desktop browser APIs |

> **macOS note:** Chrome on macOS cannot capture system audio due to OS restrictions. MeetMind will fall back to microphone-only with a visible warning ("No system audio" badge in the audio meter).

## Project Structure

```
app/
  layout.tsx              # Metadata, font preconnects
  page.tsx                # Main recorder page (client component ~500 lines)
  globals.css             # Tailwind + glassmorphism, shimmer, modal animations

components/
  RecordButton.tsx        # Animated button with pulsing glow ring, feature badges
  AudioMeter.tsx          # 28-bar audio visualizer with color zones (green/yellow/red)
  Timer.tsx               # Large mono timer (HH:MM:SS) with pulsing REC indicator
  ProgressPanel.tsx       # FFmpeg conversion + Whisper model download + transcription bars
  VideoPreview.tsx        # <video> element with download MP4 button (ref-based URL management)
  TranscriptPanel.tsx     # Scrollable transcript + TXT/SRT download buttons
  KeyboardHandler.tsx     # Escape key listener for stop recording (mounted only during recording)
  FloatingInfoButton.tsx  # Bottom-right floating button → modal with creator info & social links

hooks/
  useScreenRecorder.ts    # Dual MediaRecorder (video + audio), 4K/1080p, Web Audio mixer, audio level meter
  useFFmpeg.ts            # FFmpeg WASM init (self-hosted from /ffmpeg/), webm→mp4 conversion
  useTranscription.ts     # @xenova/transformers Whisper pipeline (live transcribePartial + full transcribe)

lib/
  srtFormatter.ts         # TranscriptSegment[] → valid .srt + .txt strings
  audioExtractor.ts       # WebM/MP4 blob → Float32Array PCM @ 16kHz mono for Whisper

public/
  favicon.svg             # Camera + animated record dot (blue→purple gradient)
  site.webmanifest        # PWA manifest

next.config.mjs           # COOP/COEP headers, webpack WASM/node config
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

### FFmpeg WASM Self-Hosting

FFmpeg core files are served from `/ffmpeg/` (the `public/ffmpeg/` directory) to avoid COEP issues with CDN loading. Copy the files from `node_modules/@ffmpeg/core/dist/esm/` or `unpkg` into `public/ffmpeg/` before building:

```bash
mkdir -p public/ffmpeg
cp node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js public/ffmpeg/
cp node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm public/ffmpeg/
```

## Known Limitations

- **First load downloads** — Whisper model (~145 MB) downloads on first use, then caches in IndexedDB. FFmpeg core (~25 MB) is self-hosted at `/ffmpeg/`
- **Long recordings** — Sessions >20 minutes may risk OOM; chunked recording recommended
- **Accents/noise** — Whisper base has ~10% WER on English; accuracy varies with audio quality
- **No Firefox/Safari** — Missing required Web APIs (system audio, SharedArrayBuffer)
- **Background transcription** — After recording stops (MP4 path), the video appears immediately and transcription runs in the background. Shows "Transcribing audio..." spinner until complete
- **4K resolution** — Actual resolution depends on the user's display; selecting 4K on a 1080p monitor will record at 1080p

## License

MIT

## Author

**Hari Krishna Anem**  
B.Tech (CSIT) | Hyderabad, India  
- GitHub: [@HariKrishna-9885699666](https://github.com/HariKrishna-9885699666)
- LinkedIn: [anemharikrishna](https://linkedin.com/in/anemharikrishna)
- Blog: [@HariKrishna-9885699666](https://hashnode.com/@HariKrishna-9885699666)
- Portfolio: [harikrishna.is-a-good.dev](https://harikrishna.is-a-good.dev)
