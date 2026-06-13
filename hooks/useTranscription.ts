'use client';

import { useState, useCallback, useRef } from 'react';
import { pipeline, env } from '@xenova/transformers';
import { extractAudioPCM } from '@/lib/audioExtractor';
import type { TranscriptSegment } from '@/lib/srtFormatter';

// Force loading models from Hugging Face CDN (not localhost)
env.allowLocalModels = false;

type TranscriptionState =
  | 'idle'
  | 'loading-model'
  | 'transcribing'
  | 'done'
  | 'error';

interface ModelProgress {
  status: string;
  file: string;
  progress: number;
  loaded: number;
  total: number;
}

interface UseTranscriptionReturn {
  state: TranscriptionState;
  segments: TranscriptSegment[];
  modelProgress: ModelProgress | null;
  transcriptionProgress: number;
  error: string | null;
  transcribe: (blob: Blob) => Promise<TranscriptSegment[]>;
  /** Transcribe a short audio chunk and return its segments (for live use). */
  transcribePartial: (blob: Blob) => Promise<TranscriptSegment[]>;
  /** Accumulated live transcript segments from partial transcriptions. */
  liveSegments: TranscriptSegment[];
  /** Whether a live transcription is currently running. */
  isLiveTranscribing: boolean;
  reset: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const [state, setState] = useState<TranscriptionState>('idle');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [modelProgress, setModelProgress] = useState<ModelProgress | null>(
    null
  );
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>([]);
  const [isLiveTranscribing, setIsLiveTranscribing] = useState(false);
  const isLiveTranscribingRef = useRef(false);
  const transcriberRef = useRef<((audio: Float32Array, options: any) => Promise<any>) | null>(null);

  /** Ensures the Whisper model is loaded, returning the transcriber function. */
  const ensureModel = useCallback(async () => {
    if (transcriberRef.current) return;

    setState('loading-model');

    const transcriber = await pipeline(
      'automatic-speech-recognition' as const,
      'Xenova/whisper-base',
      {
        progress_callback: (p: {
          status: string;
          file?: string;
          progress?: number;
          loaded?: number;
          total?: number;
        }) => {
          if (p.status === 'progress' || p.status === 'download') {
            setModelProgress({
              status: p.status,
              file: p.file || '',
              progress: p.progress || 0,
              loaded: p.loaded || 0,
              total: p.total || 0,
            });
          }
        },
      }
    );

    transcriberRef.current = transcriber;
  }, []);

  /** Parse the raw Whisper result into TranscriptSegment[]. */
  const parseResult = useCallback((result: any): TranscriptSegment[] => {
    const parsed: TranscriptSegment[] = [];

    if (result.chunks) {
      for (const chunk of result.chunks) {
        if (chunk.timestamp && chunk.timestamp[0] !== undefined) {
          parsed.push({
            timestamp: [
              chunk.timestamp[0] as number,
              (chunk.timestamp[1] as number) ??
                (chunk.timestamp[0] as number) + 1,
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

  const transcribe = useCallback(async (blob: Blob): Promise<TranscriptSegment[]> => {
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

      // Run transcription with timestamps
      const result = await transcriberRef.current!(audioPCM, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      const rawSegments = parseResult(result);

      setSegments(rawSegments);
      setTranscriptionProgress(100);
      setState('done');
      return rawSegments;
    } catch (err) {
      const message =
        err instanceof Error
          ? `Transcription failed: ${err.message}`
          : 'Transcription failed.';
      setError(message);
      setState('error');
      return [];
    }
  }, [ensureModel, parseResult]);

  const transcribePartial = useCallback(
    async (blob: Blob): Promise<TranscriptSegment[]> => {
      // Guard: skip if already transcribing (ref-based to avoid dependency churn)
      if (isLiveTranscribingRef.current) return [];

      try {
        isLiveTranscribingRef.current = true;
        setIsLiveTranscribing(true);

        // Ensure model is loaded before processing
        if (!transcriberRef.current) {
          await ensureModel();
        }

        // Extract audio PCM from the short chunk
        const audioPCM = await extractAudioPCM(blob);

        // Skip if insufficient audio data (less than ~1 second)
        if (audioPCM.length < 16000) {
          isLiveTranscribingRef.current = false;
          setIsLiveTranscribing(false);
          return [];
        }

        // Run transcription with timestamps
        const result = await transcriberRef.current!(audioPCM, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });

        const newSegments = parseResult(result);

        // Accumulate into liveSegments (timestamp-based dedup)
        if (newSegments.length > 0) {
          setLiveSegments((prev) => {
            const lastEnd = prev.length > 0 ? prev[prev.length - 1].timestamp[1] : 0;
            // Only keep segments that start after the last segment's end time
            const distinct = newSegments.filter(
              (seg) => seg.timestamp[0] >= lastEnd - 0.5 // 0.5s overlap tolerance
            );
            return distinct.length > 0 ? [...prev, ...distinct] : prev;
          });
        }

        isLiveTranscribingRef.current = false;
        setIsLiveTranscribing(false);
        return newSegments;
      } catch (err) {
        console.error('Live transcription error:', err);
        isLiveTranscribingRef.current = false;
        setIsLiveTranscribing(false);
        return [];
      }
    },
    [ensureModel, parseResult]
  );

  const reset = useCallback(() => {
    setState('idle');
    setSegments([]);
    setLiveSegments([]);
    setModelProgress(null);
    setTranscriptionProgress(0);
    setError(null);
    // Keep the model in cache for next use
  }, []);

  return {
    state,
    segments,
    modelProgress,
    transcriptionProgress,
    error,
    transcribe,
    transcribePartial,
    liveSegments,
    isLiveTranscribing,
    reset,
  };
}
