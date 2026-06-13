'use client';

import { useRef, useCallback, useState } from 'react';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped';

interface UseScreenRecorderReturn {
  state: RecorderState;
  stream: MediaStream | null;
  recordedBlob: Blob | null;
  elapsedSeconds: number;
  audioLevel: number;
  error: string | null;
  audioTrackMuted: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  /** Returns a blob of new audio chunks since the last call, or null if no new data. */
  getPendingAudioChunksBlob: () => Blob | null;
}

export function useScreenRecorder(): UseScreenRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioTrackMuted, setAudioTrackMuted] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('video/webm');
  const lastTranscribedChunkIndexRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAudioLevelMeter = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  const startAudioLevelMeter = useCallback(
    (audioCtx: AudioContext, source: MediaStreamAudioSourceNode) => {
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const update = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(update);
      };
      update();
    },
    []
  );

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setRecordedBlob(null);
      setElapsedSeconds(0);
      setAudioLevel(0);
      setAudioTrackMuted(false);
      setState('requesting');

      // Get display media (screen + system audio)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: true,
      });

      // Check if system audio is available
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        setAudioTrackMuted(true);
      }

      // Try to get mic audio
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Mic access denied, continue without mic
      }

      // Set up audio mixing
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const dest = audioCtx.createMediaStreamDestination();

      let hasAudio = false;

      if (audioTracks.length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(displayStream);
        sysSource.connect(dest);
        hasAudio = true;
      }

      if (micStream) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);
        hasAudio = true;
      }

      // Combine video from display with mixed audio
      const videoTrack = displayStream.getVideoTracks()[0];
      const combinedStream = new MediaStream([videoTrack]);

      if (hasAudio) {
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) {
          combinedStream.addTrack(audioTrack);
        }
      }

      // Set up audio level meter using original stream's audio
      if (hasAudio && audioTracks.length > 0) {
        const meterSource = audioCtx.createMediaStreamSource(
          new MediaStream([audioTracks[0]])
        );
        startAudioLevelMeter(audioCtx, meterSource);
      } else if (micStream) {
        const meterSource = audioCtx.createMediaStreamSource(
          new MediaStream([micStream.getAudioTracks()[0]])
        );
        startAudioLevelMeter(audioCtx, meterSource);
      }

      // Determine best mime type
      const mimeType = MediaRecorder.isTypeSupported(
        'video/webm;codecs=vp9,opus'
      )
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      lastTranscribedChunkIndexRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        stopAudioLevelMeter();
        displayStream.getTracks().forEach((t) => t.stop());
        micStream?.getTracks().forEach((t) => t.stop());
        if (audioCtx.state !== 'closed') {
          audioCtx.close();
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setState('stopped');
      };

      recorder.start(1000); // Collect chunks every second
      setStream(combinedStream);

      // Start timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      setState('recording');

      // Handle user stopping via browser UI
      videoTrack.onended = () => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      };
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Screen recording permission was denied. Please allow screen capture to record.'
          : err instanceof Error
            ? err.message
            : 'An unknown error occurred while starting recording.';
      setError(message);
      setState('idle');
    }
  }, [clearTimer, stopAudioLevelMeter, startAudioLevelMeter]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const getPendingAudioChunksBlob = useCallback((): Blob | null => {
    const chunks = chunksRef.current;
    const fromIndex = lastTranscribedChunkIndexRef.current;

    if (fromIndex >= chunks.length) {
      return null;
    }

    const newChunks = chunks.slice(fromIndex);
    lastTranscribedChunkIndexRef.current = chunks.length;

    return new Blob(newChunks, { type: mimeTypeRef.current });
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setStream(null);
    setRecordedBlob(null);
    setElapsedSeconds(0);
    setAudioLevel(0);
    setError(null);
    setAudioTrackMuted(false);
    chunksRef.current = [];
    lastTranscribedChunkIndexRef.current = 0;
  }, []);

  return {
    state,
    stream,
    recordedBlob,
    elapsedSeconds,
    audioLevel,
    error,
    audioTrackMuted,
    startRecording,
    stopRecording,
    reset,
    getPendingAudioChunksBlob,
  };
}
