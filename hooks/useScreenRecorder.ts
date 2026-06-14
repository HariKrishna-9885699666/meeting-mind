'use client';

import { useRef, useCallback, useState } from 'react';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped';

const SCRIPT_NODE_BUFFER_SIZE = 4096;
const PCM_DOWNSAMPLE_RATIO = 48000 / 16000; // 3 — AudioContext @48kHz → Whisper @16kHz

interface UseScreenRecorderReturn {
  state: RecorderState;
  stream: MediaStream | null;
  recordedBlob: Blob | null;
  elapsedSeconds: number;
  audioLevel: number;
  error: string | null;
  audioTrackMuted: boolean;
  startRecording: (resolution?: '1080p' | '4K') => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  /** Returns a blob of new audio-only chunks since the last call. */
  getPendingAudioChunksBlob: () => Blob | null;
  /** Returns a complete audio-only blob of all recorded audio (for final transcription). */
  getCompleteAudioBlob: () => Blob | null;
  /** Returns new raw PCM samples (16kHz mono) since last call, for live transcription. */
  getPendingAudioPCM: () => Float32Array | null;
  /** Returns all raw PCM samples (16kHz mono) captured so far. */
  getCompleteAudioPCM: () => Float32Array | null;
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
  // Separate audio-only MediaRecorder for live transcription chunks
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastTranscribedAudioChunkIndexRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  // Raw PCM capture for live transcription
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const pcmBufferRef = useRef<Float32Array>(new Float32Array(0));
  const pcmIndexRef = useRef<number>(0);
  const lastTranscribedPcmSampleRef = useRef<number>(0);

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

  const startRecording = useCallback(async (resolution: '1080p' | '4K' = '4K') => {
    try {
      setError(null);
      setRecordedBlob(null);
      setElapsedSeconds(0);
      setAudioLevel(0);
      setAudioTrackMuted(false);
      setState('requesting');

      console.log('[ScreenRecorder] Opening screen picker...');
      // Get display media (screen + system audio)
      const is4K = resolution === '4K';
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: is4K ? 3840 : 1920, max: is4K ? 3840 : 1920 },
          height: { ideal: is4K ? 2160 : 1080, max: is4K ? 2160 : 1080 },
          frameRate: { ideal: is4K ? 60 : 30, max: is4K ? 60 : 30 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 48000,
        },
      });
      console.log('[ScreenRecorder] Screen picker resolved, tracks:', displayStream.getTracks().length);

      // Check if system audio is available
      const audioTracks = displayStream.getAudioTracks();
      console.log('[ScreenRecorder] Audio tracks:', audioTracks.length);
      if (audioTracks.length === 0) {
        console.log('[ScreenRecorder] No system audio');
        setAudioTrackMuted(true);
      }

      // Try to get mic audio
      let micStream: MediaStream | null = null;
      try {
        console.log('[ScreenRecorder] Requesting mic...');
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[ScreenRecorder] Mic obtained');
      } catch {
        console.log('[ScreenRecorder] Mic denied or unavailable');
      }

      console.log('[ScreenRecorder] Setting up audio mixing...');
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      console.log('[ScreenRecorder] AudioContext state:', audioCtx.state);
      // Ensure AudioContext is running (may be suspended after async getDisplayMedia)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
        console.log('[ScreenRecorder] AudioContext resumed:', audioCtx.state);
      }

      const dest = audioCtx.createMediaStreamDestination();

      // Device both audio sources directly to the destination (recording path).
      // Separately, connect them through a ScriptProcessorNode for PCM capture
      // (live transcription). The ScriptProcessorNode output goes through a
      // muted GainNode so it does NOT affect the recording audio.

      // Reset PCM buffer
      pcmBufferRef.current = new Float32Array(0);
      pcmIndexRef.current = 0;
      lastTranscribedPcmSampleRef.current = 0;

      const pcmScriptNode = audioCtx.createScriptProcessor(SCRIPT_NODE_BUFFER_SIZE, 1, 1);
      scriptNodeRef.current = pcmScriptNode;

      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;

      pcmScriptNode.connect(muteGain);
      muteGain.connect(dest);

      pcmScriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
        const input = e.inputBuffer.getChannelData(0);

        // Downsample from 48kHz → 16kHz for live transcription
        const outLen = Math.ceil(input.length / PCM_DOWNSAMPLE_RATIO);
        const buffer = pcmBufferRef.current;
        const newLen = pcmIndexRef.current + outLen;
        if (newLen > buffer.length) {
          const grow = Math.max(newLen, buffer.length * 1.5) + 32768;
          const newBuffer = new Float32Array(grow);
          newBuffer.set(buffer.subarray(0, pcmIndexRef.current));
          pcmBufferRef.current = newBuffer;
        }
        for (let i = 0; i < outLen; i++) {
          pcmBufferRef.current[pcmIndexRef.current + i] =
            input[Math.floor(i * PCM_DOWNSAMPLE_RATIO)];
        }
        pcmIndexRef.current = newLen;
      };

      let hasAudio = false;

      if (audioTracks.length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(displayStream);
        sysSource.connect(dest);           // Recording path
        sysSource.connect(pcmScriptNode);  // PCM capture path
        hasAudio = true;
        console.log('[ScreenRecorder] System audio added to mix');
      }

      if (micStream) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);           // Recording path
        micSource.connect(pcmScriptNode);  // PCM capture path
        hasAudio = true;
        console.log('[ScreenRecorder] Mic audio added to mix');
      }

      // Wire the PCM capture chain only when there's audio
      if (hasAudio) {
        pcmScriptNode.connect(muteGain);
        muteGain.connect(dest);
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
      console.log('[ScreenRecorder] Combined stream tracks:', combinedStream.getTracks().length);

      // Set up audio level meter
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

      // --- Main video MediaRecorder ---
      // Determine best mime type — prefer MP4 (Chrome supports it natively)
      let videoMimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
        videoMimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        console.log('[ScreenRecorder] Browser supports MP4 recording, skipping FFmpeg');
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        videoMimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        videoMimeType = 'video/webm;codecs=vp8,opus';
      }
      mimeTypeRef.current = videoMimeType;
      console.log('[ScreenRecorder] Selected video mimeType:', videoMimeType);

      const videoRecorder = new MediaRecorder(combinedStream, {
        mimeType: videoMimeType,
        videoBitsPerSecond: is4K ? 8_000_000 : 4_000_000, // 8 Mbps for 4K, 4 Mbps for 1080p — lower to avoid encoder backpressure that causes stuttering
        audioBitsPerSecond: 192_000,
      });
      mediaRecorderRef.current = videoRecorder;
      chunksRef.current = [];

      videoRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // --- Audio-only MediaRecorder for live transcription ---
      let audioRecorder: MediaRecorder | null = null;
      if (hasAudio) {
        const audioStream = new MediaStream(dest.stream.getAudioTracks());
        const audioMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        console.log('[ScreenRecorder] Audio recorder mimeType:', audioMimeType);

        audioRecorder = new MediaRecorder(audioStream, { mimeType: audioMimeType });
        audioRecorderRef.current = audioRecorder;
        audioChunksRef.current = [];
        lastTranscribedAudioChunkIndexRef.current = 0;

        audioRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        audioRecorder.onerror = () => {
          console.warn('[ScreenRecorder] Audio recorder error, treating as stopped');
          audioRecorderStopped = true;
          checkBothStopped();
        };
      }

      // --- Stop handler for both recorders ---
      let recorderStopped = false;
      let audioRecorderStopped = !hasAudio; // mark done if no audio

      const checkBothStopped = () => {
        if (recorderStopped && audioRecorderStopped) {
          console.log('[ScreenRecorder] Both recorders stopped, creating final blob. Chunks:', chunksRef.current.length);
          clearTimer();
          stopAudioLevelMeter();
          // Disconnect scriptNode and its mute gain
          if (scriptNodeRef.current) {
            try { scriptNodeRef.current.disconnect(); } catch {}
            scriptNodeRef.current = null;
          }
          displayStream.getTracks().forEach((t) => t.stop());
          micStream?.getTracks().forEach((t) => t.stop());
          if (audioCtx.state !== 'closed') {
            audioCtx.close();
          }

          const blob = new Blob(chunksRef.current, { type: videoMimeType });
          console.log('[ScreenRecorder] Final blob size:', blob.size, 'bytes');
          setRecordedBlob(blob);
          setState('stopped');
        }
      };

      videoRecorder.onstop = () => {
        console.log('[ScreenRecorder] Video MediaRecorder stopped');
        recorderStopped = true;
        checkBothStopped();
      };

      if (audioRecorder) {
        audioRecorder.onstop = () => {
          console.log('[ScreenRecorder] Audio MediaRecorder stopped');
          audioRecorderStopped = true;
          checkBothStopped();
        };
      }

      videoRecorder.start(1000);
      console.log('[ScreenRecorder] Video MediaRecorder started, state:', videoRecorder.state);

      if (audioRecorder) {
        audioRecorder.start(1000);
        console.log('[ScreenRecorder] Audio MediaRecorder started, state:', audioRecorder.state);
      }

      setStream(combinedStream);

      // Start timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      console.log('[ScreenRecorder] Setting state to recording');
      setState('recording');

      // Handle user stopping via browser UI
      videoTrack.onended = () => {
        console.log('[ScreenRecorder] Video track ended (user stopped sharing)');
        if (videoRecorder.state === 'recording') {
          videoRecorder.stop();
        }
        if (audioRecorder && audioRecorder.state === 'recording') {
          audioRecorder.stop();
        }
      };
    } catch (err) {
      console.error('[ScreenRecorder] Error in startRecording:', err);
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
    // Stop video recorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
    // Stop audio recorder
    if (
      audioRecorderRef.current &&
      audioRecorderRef.current.state === 'recording'
    ) {
      audioRecorderRef.current.stop();
    }
  }, []);

  const getPendingAudioChunksBlob = useCallback((): Blob | null => {
    const chunks = audioChunksRef.current;
    const fromIndex = lastTranscribedAudioChunkIndexRef.current;

    if (fromIndex >= chunks.length) {
      return null;
    }

    const newChunks = chunks.slice(fromIndex);
    lastTranscribedAudioChunkIndexRef.current = chunks.length;

    // Use best audio mime type
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    return new Blob(newChunks, { type: mimeType });
  }, []);

  const getCompleteAudioBlob = useCallback((): Blob | null => {
    const chunks = audioChunksRef.current;
    if (chunks.length === 0) return null;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    return new Blob(chunks, { type: mimeType });
  }, []);

  /** Returns new raw 16kHz mono PCM samples since the last call. */
  const getPendingAudioPCM = useCallback((): Float32Array | null => {
    const totalSamples = pcmIndexRef.current;
    const fromSample = lastTranscribedPcmSampleRef.current;
    if (fromSample >= totalSamples) return null;

    const newSamples = totalSamples - fromSample;
    const result = new Float32Array(newSamples);
    result.set(pcmBufferRef.current.subarray(fromSample, totalSamples));
    lastTranscribedPcmSampleRef.current = totalSamples;
    return result;
  }, []);

  /** Returns all raw 16kHz mono PCM samples captured so far. */
  const getCompleteAudioPCM = useCallback((): Float32Array | null => {
    const totalSamples = pcmIndexRef.current;
    if (totalSamples === 0) return null;
    const result = new Float32Array(totalSamples);
    result.set(pcmBufferRef.current.subarray(0, totalSamples));
    return result;
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
    audioChunksRef.current = [];
    lastTranscribedAudioChunkIndexRef.current = 0;
    // Reset PCM buffer
    pcmBufferRef.current = new Float32Array(0);
    pcmIndexRef.current = 0;
    lastTranscribedPcmSampleRef.current = 0;
    scriptNodeRef.current = null;
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
    getCompleteAudioBlob,
    getPendingAudioPCM,
    getCompleteAudioPCM,
  };
}
