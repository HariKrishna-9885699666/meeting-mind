'use client';

import { useState, useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type FFmpegState = 'idle' | 'loading' | 'ready' | 'converting' | 'done' | 'error';

interface UseFFmpegReturn {
  state: FFmpegState;
  progress: number;
  error: string | null;
  loadFFmpeg: () => Promise<void>;
  convertToMP4: (webmBlob: Blob) => Promise<Blob>;
  reset: () => void;
}

export function useFFmpeg(): UseFFmpegReturn {
  const [state, setState] = useState<FFmpegState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = useCallback(async () => {
    try {
      setState('loading');
      setError(null);

      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      // Load from local /ffmpeg/ directory (self-hosted to avoid COEP issues)
      const baseURL = '/ffmpeg';

      ffmpeg.on('progress', ({ progress: p }) => {
        const percent = Math.min(Math.round(p * 100), 99);
        setProgress(percent);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setState('ready');
    } catch (err) {
      const message =
        err instanceof Error
          ? `Failed to load FFmpeg: ${err.message}`
          : 'Failed to load FFmpeg WASM module.';
      setError(message);
      setState('error');
    }
  }, []);

  const convertToMP4 = useCallback(async (webmBlob: Blob): Promise<Blob> => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !ffmpeg.loaded) {
      throw new Error('FFmpeg is not loaded yet.');
    }

    try {
      setState('converting');
      setProgress(0);

      await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

      await ffmpeg.exec([
        '-i',
        'input.webm',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '18',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        'output.mp4',
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const uint8 = data as Uint8Array;
      const mp4Blob = new Blob([uint8], { type: 'video/mp4' });

      // Cleanup temp files
      await ffmpeg.deleteFile('input.webm');
      await ffmpeg.deleteFile('output.mp4');

      setProgress(100);
      setState('done');
      return mp4Blob;
    } catch (err) {
      const message =
        err instanceof Error ? `MP4 conversion failed: ${err.message}` : 'MP4 conversion failed.';
      setError(message);
      setState('error');
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setError(null);
  }, []);

  return { state, progress, error, loadFFmpeg, convertToMP4, reset };
}
