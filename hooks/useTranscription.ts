'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { extractAudioPCM } from '@/lib/audioExtractor';
import type { TranscriptSegment } from '@/lib/srtFormatter';

// @xenova/transformers is dynamically imported to avoid crashing during SSR
// since it uses browser-only APIs (Web Audio, Web Workers, etc.)

type TranscriptionState = 'idle' | 'loading-model' | 'transcribing' | 'done' | 'error';

interface UseTranscriptionReturn {
  state: TranscriptionState;
  segments: TranscriptSegment[];
  transcriptionProgress: number;
  error: string | null;
  transcribe: (blob: Blob) => Promise<TranscriptSegment[]>;
  reset: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const [state, setState] = useState<TranscriptionState>('idle');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const transcriberRef = useRef<((audio: Float32Array, options: any) => Promise<any>) | null>(null);

  /** Ensures the Whisper model is loaded, returning the transcriber function. */
  const ensureModel = useCallback(async () => {
    if (transcriberRef.current) return;

    setState('loading-model');

    // Dynamic import to avoid loading browser-only APIs during SSR
    const { pipeline, env } = await import('@xenova/transformers');

    // Load models from local /models/whisper-model/ folder served by Next.js
    env.allowLocalModels = true;
    env.allowRemoteModels = false;

    // Use single thread to avoid web worker issues with bundler process polyfill
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.numThreads = 1;
    }

    const transcriber = await pipeline('automatic-speech-recognition' as const, 'whisper-model');

    transcriberRef.current = transcriber;
  }, []);

  /** Pre-load the Whisper model on mount so it's ready when recording stops. */
  useEffect(() => {
    ensureModel();
  }, [ensureModel]);

  /** Parse the raw Whisper result into TranscriptSegment[]. */
  const parseResult = useCallback((result: any): TranscriptSegment[] => {
    const parsed: TranscriptSegment[] = [];

    if (result.chunks) {
      for (const chunk of result.chunks) {
        if (chunk.timestamp && chunk.timestamp[0] !== undefined) {
          parsed.push({
            timestamp: [
              chunk.timestamp[0] as number,
              (chunk.timestamp[1] as number) ?? (chunk.timestamp[0] as number) + 1,
            ],
            text: (chunk.text as string).trim(),
          });
        }
      }
    }

    // Fallback if no timestamped chunks
    if (parsed.length === 0 && result.text) {
      parsed.push({
        timestamp: [0, 1],
        text: result.text.trim(),
      });
    }

    return parsed;
  }, []);

  const transcribe = useCallback(
    async (blob: Blob): Promise<TranscriptSegment[]> => {
      try {
        setError(null);
        setSegments([]);
        setTranscriptionProgress(0);

        // Ensure model is loaded
        if (!transcriberRef.current) {
          await ensureModel();
        }

        setState('transcribing');

        // Extract audio PCM from blob
        const audioPCM = await extractAudioPCM(blob);

        const SAMPLE_RATE = 16000;
        const CHUNK_SECONDS = 30;
        const CHUNK_SIZE = CHUNK_SECONDS * SAMPLE_RATE;
        const totalChunks = Math.ceil(audioPCM.length / CHUNK_SIZE);
        const allSegments: TranscriptSegment[] = [];
        let processedSamples = 0;

        setTranscriptionProgress(0);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, audioPCM.length);
          const chunk = audioPCM.slice(start, end);

          // Transcribe this chunk
          const result = await transcriberRef.current!(chunk, {
            return_timestamps: true,
          });

          // Offset timestamps by the chunk's start time (in seconds)
          const offsetSeconds = start / SAMPLE_RATE;
          for (const seg of parseResult(result)) {
            allSegments.push({
              timestamp: [
                seg.timestamp[0] + offsetSeconds,
                seg.timestamp[1] + offsetSeconds,
              ],
              text: seg.text,
            });
          }

          processedSamples += chunk.length;

          // Update real progress (percentage of audio processed)
          const pct = Math.min(95, Math.round((processedSamples / audioPCM.length) * 95));
          setTranscriptionProgress(pct);

          // Yield to the event loop so the UI can repaint and handle clicks
          await new Promise<void>((r) => setTimeout(r, 0));
        }

        setSegments(allSegments);
        setTranscriptionProgress(100);
        setState('done');
        return allSegments;
      } catch (err) {
        const message =
          err instanceof Error ? `Transcription failed: ${err.message}` : 'Transcription failed.';
        setError(message);
        setTranscriptionProgress(0);
        setState('error');
        return [];
      }
    },
    [ensureModel, parseResult],
  );

  const reset = useCallback(() => {
    setState('idle');
    setSegments([]);
    setTranscriptionProgress(0);
    setError(null);
    // Keep the model in cache for next use
  }, []);

  return {
    state,
    segments,
    transcriptionProgress,
    error,
    transcribe,
    reset,
  };
}
