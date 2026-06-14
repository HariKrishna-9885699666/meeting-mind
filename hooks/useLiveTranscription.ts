'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { TranscriptSegment } from '@/lib/srtFormatter';

export function useLiveTranscription() {
  const workerRef = useRef<Worker | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const nextChunkIndexRef = useRef(0);
  const requestIdRef = useRef(1);
  const pendingCountRef = useRef(0);

  const init = useCallback(async (): Promise<void> => {
    if (workerRef.current) return;

    const worker = new Worker(
      new URL('./transcription.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { type, data } = event.data;

      switch (type) {
        case 'RESULT':
          if (data.loaded) {
            setIsReady(true);
          }
          break;

        case 'PARTIAL_RESULT': {
          pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
          if (pendingCountRef.current === 0) {
            setIsProcessing(false);
          }
          setSegments((prev) => {
            const existing = [...prev];
            for (const chunk of data.chunks) {
              const isDuplicate = existing.some(
                (s) =>
                  Math.abs(s.timestamp[0] - chunk.timestamp[0]) < 0.5 &&
                  s.text === chunk.text,
              );
              if (!isDuplicate) {
                existing.push(chunk);
              }
            }
            return existing.sort((a, b) => a.timestamp[0] - b.timestamp[0]);
          });
          break;
        }

        case 'ERROR':
          pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
          if (pendingCountRef.current === 0) {
            setIsProcessing(false);
          }
          console.error('[LiveTranscription] Worker error:', data);
          break;
      }
    };

    worker.onerror = (err) => {
      console.error('[LiveTranscription] Worker error event:', err);
    };

    worker.postMessage({ id: 0, type: 'LOAD' });
  }, []);

  const transcribeChunk = useCallback(
    (audioPCM: Float32Array): void => {
      const worker = workerRef.current;
      if (!worker || !isReady) return;

      const id = requestIdRef.current++;
      const chunkIndex = nextChunkIndexRef.current++;
      pendingCountRef.current += 1;
      setIsProcessing(true);

      worker.postMessage({
        id,
        type: 'TRANSCRIBE_PARTIAL',
        data: { audio: audioPCM, chunkIndex },
      });
    },
    [isReady],
  );

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsReady(false);
    setIsProcessing(false);
    setSegments([]);
    nextChunkIndexRef.current = 0;
    pendingCountRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  return {
    init,
    transcribeChunk,
    terminate,
    segments,
    isReady,
    isProcessing,
  };
}
