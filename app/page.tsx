'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import RecordButton from '@/components/RecordButton';
import AudioMeter from '@/components/AudioMeter';
import Timer from '@/components/Timer';
import ProgressPanel from '@/components/ProgressPanel';
import VideoPreview from '@/components/VideoPreview';
import TranscriptPanel from '@/components/TranscriptPanel';
import { useScreenRecorder } from '@/hooks/useScreenRecorder';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { useTranscription } from '@/hooks/useTranscription';
import type { TranscriptSegment } from '@/lib/srtFormatter';

type AppState = 'idle' | 'requesting' | 'recording' | 'processing' | 'done' | 'error';

const LIVE_TRANSCRIPT_INTERVAL_SECONDS = 12;

export default function Home() {
  const recorder = useScreenRecorder();
  const ffmpeg = useFFmpeg();
  const transcription = useTranscription();

  const [appState, setAppState] = useState<AppState>('idle');
  const [mp4Blob, setMp4Blob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use refs to avoid stale closures in async processing
  const ffmpegRef = useRef(ffmpeg);
  const transcriptionRef = useRef(transcription);
  const recorderRef = useRef(recorder);
  ffmpegRef.current = ffmpeg;
  transcriptionRef.current = transcription;
  recorderRef.current = recorder;

  // Live transcription timer ref
  const liveTranscriptionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup live transcription interval on unmount
  useEffect(() => {
    return () => {
      if (liveTranscriptionTimerRef.current) {
        clearInterval(liveTranscriptionTimerRef.current);
        liveTranscriptionTimerRef.current = null;
      }
    };
  }, []);

  // Start/stop live transcription based on recorder state
  useEffect(() => {
    switch (recorder.state) {
      case 'requesting':
        setAppState('requesting');
        break;
      case 'recording':
        setAppState('recording');
        startLiveTranscription();
        break;
      case 'stopped':
        stopLiveTranscription();
        if (recorder.recordedBlob) {
          setAppState('processing');
          processRecordingRef.current(recorder.recordedBlob);
        }
        break;
    }

    if (recorder.error) {
      setErrorMessage(recorder.error);
      setAppState('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.state]);

  const startLiveTranscription = useCallback(() => {
    // Clear any existing timer
    if (liveTranscriptionTimerRef.current) {
      clearInterval(liveTranscriptionTimerRef.current);
    }

    // Start interval for live partial transcription
    liveTranscriptionTimerRef.current = setInterval(async () => {
      const rec = recorderRef.current;
      const trans = transcriptionRef.current;

      // Guard: skip if previous transcription is still running
      if (trans.isLiveTranscribing) return;

      // Get pending audio chunks
      const blob = rec.getPendingAudioChunksBlob();
      if (!blob) return;

      // Transcribe the new chunk (accumulates into liveSegments automatically)
      await trans.transcribePartial(blob);
    }, LIVE_TRANSCRIPT_INTERVAL_SECONDS * 1000);
  }, []);

  const stopLiveTranscription = useCallback(() => {
    if (liveTranscriptionTimerRef.current) {
      clearInterval(liveTranscriptionTimerRef.current);
      liveTranscriptionTimerRef.current = null;
    }
  }, []);

  const processRecording = useCallback(async (blob: Blob) => {
    const ffm = ffmpegRef.current;
    const trans = transcriptionRef.current;

    try {
      setErrorMessage(null);

      // If blob is already MP4 (Chrome native), skip FFmpeg entirely
      let outputBlob: Blob;
      if (blob.type.startsWith('video/mp4')) {
        console.log('[Process] Blob is already MP4, skipping FFmpeg');
        outputBlob = blob;
      } else {
        // Load FFmpeg if not loaded
        if (ffm.state === 'idle') {
          await ffm.loadFFmpeg();
        }
        outputBlob = await ffm.convertToMP4(blob);
      }

      // Fallback: if no live segments were captured (e.g. short recording),
      // run a full transcription on the audio-only blob (not the video blob)
      if (trans.liveSegments.length === 0) {
        const rec = recorderRef.current;
        const audioBlob = rec.getCompleteAudioBlob();
        if (audioBlob) {
          await trans.transcribe(audioBlob);
        }
      }

      setMp4Blob(outputBlob);
      setAppState('done');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Processing failed.';
      setErrorMessage(message);
      setAppState('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store in ref to avoid stale closures in useEffect
  const processRecordingRef = useRef(processRecording);
  processRecordingRef.current = processRecording;

  const handleStartRecording = useCallback(async () => {
    setErrorMessage(null);
    setMp4Blob(null);
    ffmpeg.reset();
    transcription.reset();
    await recorder.startRecording();
  }, [recorder, ffmpeg, transcription]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleRecordAgain = useCallback(() => {
    setAppState('idle');
    setMp4Blob(null);
    setErrorMessage(null);
    ffmpeg.reset();
    transcription.reset();
    recorder.reset();
  }, [ffmpeg, transcription, recorder]);

  // Determine which segments to display
  const displaySegments: TranscriptSegment[] =
    appState === 'recording'
      ? transcription.liveSegments
      : transcription.liveSegments.length > 0
        ? transcription.liveSegments
        : transcription.segments;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            ScreenScribe
          </span>
        </h1>
        <p className="mt-3 text-lg text-zinc-500">
          Record your screen. Keep your words.
        </p>
      </div>

      {/* Error state */}
      {appState === 'error' && errorMessage && (
        <div className="w-full max-w-lg mx-auto mb-8 p-4 bg-red-900/20 border border-red-800/40 rounded-xl">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-400 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-300">{errorMessage}</p>
              <button
                onClick={handleRecordAgain}
                className="mt-3 text-sm font-medium text-red-400 hover:text-red-300 underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Idle state */}
      {appState === 'idle' && (
        <div className="flex flex-col items-center gap-8">
          <RecordButton state="idle" onClick={handleStartRecording} />
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <span>Works in Chrome & Edge</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>No uploads</span>
          </div>
        </div>
      )}

      {/* Requesting state */}
      {appState === 'requesting' && (
        <div className="flex flex-col items-center gap-8">
          <RecordButton state="requesting" onClick={() => {}} />
        </div>
      )}

      {/* Recording state */}
      {appState === 'recording' && (
        <div className="w-full max-w-lg mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Timer elapsedSeconds={recorder.elapsedSeconds} />
            <AudioMeter
              level={recorder.audioLevel}
              audioTrackMuted={recorder.audioTrackMuted}
            />
          </div>

          <button
            onClick={handleStopRecording}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 
                       bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl 
                       transition-all duration-200 shadow-lg shadow-red-600/20 
                       hover:shadow-red-600/30 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop Recording
          </button>

          {/* Live transcript */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500 font-medium">Live transcript</p>
              {transcription.isLiveTranscribing && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-zinc-500">transcribing</span>
                </div>
              )}
            </div>
            {displaySegments.length === 0 ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
                <span className="text-sm text-zinc-600 italic">
                  {transcription.state === 'loading-model'
                    ? 'Loading transcription model...'
                    : 'Transcript will appear shortly...'}
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                {displaySegments.map((seg, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-[10px] font-mono text-zinc-600 whitespace-nowrap pt-0.5 min-w-[40px]">
                      {formatTime(seg.timestamp[0])}
                    </span>
                    <p className="text-zinc-300 leading-relaxed">{seg.text}</p>
                  </div>
                ))}
                {/* Pulse indicator that more is coming */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
                  <span className="text-[10px] text-zinc-600">listening...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing state */}
      {appState === 'processing' && (
        <div className="w-full max-w-lg mx-auto space-y-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-zinc-300">
              Processing your recording...
            </p>
          </div>

          <ProgressPanel
            ffmpegProgress={ffmpeg.progress}
            ffmpegState={ffmpeg.state}
            transcriptionState={transcription.state}
            transcriptionProgress={transcription.transcriptionProgress}
            modelProgress={transcription.modelProgress}
          />

          {/* Show accumulated live transcript while processing */}
          {transcription.liveSegments.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-zinc-500 font-medium mb-2">Transcript</p>
              <div className="space-y-1">
                {transcription.liveSegments.map((seg, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-[10px] font-mono text-zinc-600 whitespace-nowrap pt-0.5 min-w-[40px]">
                      {formatTime(seg.timestamp[0])}
                    </span>
                    <p className="text-zinc-300 leading-relaxed">{seg.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Done state */}
      {appState === 'done' && mp4Blob && (
        <div className="w-full max-w-2xl mx-auto space-y-8">
          <VideoPreview blob={mp4Blob} />
          {displaySegments.length > 0 && (
            <TranscriptPanel segments={displaySegments} />
          )}

          <div className="flex justify-center">
            <button
              onClick={handleRecordAgain}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 
                         text-zinc-300 font-medium rounded-xl transition-all duration-200
                         border border-zinc-700 hover:border-zinc-600 active:scale-[0.98]"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Record Again
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto pt-16 text-center">
        <p className="text-xs text-zinc-700">
          All processing happens locally in your browser. Nothing is uploaded.
        </p>
      </footer>
    </main>
  );
}
