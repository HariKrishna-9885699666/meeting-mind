'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import RecordButton from '@/components/RecordButton';
import AudioMeter from '@/components/AudioMeter';
import Timer from '@/components/Timer';
import ProgressPanel from '@/components/ProgressPanel';
import VideoPreview from '@/components/VideoPreview';
import TranscriptPanel from '@/components/TranscriptPanel';
import KeyboardHandler from '@/components/KeyboardHandler';
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
  const [selectedResolution, setSelectedResolution] = useState<'1080p' | '4K'>('4K');

  // Refs to avoid stale closures
  const ffmpegRef = useRef(ffmpeg);
  const transcriptionRef = useRef(transcription);
  const recorderRef = useRef(recorder);
  ffmpegRef.current = ffmpeg;
  transcriptionRef.current = transcription;
  recorderRef.current = recorder;

  const liveTranscriptionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTranscriptionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (liveTranscriptionTimerRef.current) {
        clearInterval(liveTranscriptionTimerRef.current);
        liveTranscriptionTimerRef.current = null;
      }
      if (pendingTranscriptionRef.current) {
        clearTimeout(pendingTranscriptionRef.current);
        pendingTranscriptionRef.current = null;
      }
    };
  }, []);

  // React to recorder state changes
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
          handleRecordingStopped(recorder.recordedBlob);
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
    if (liveTranscriptionTimerRef.current) {
      clearInterval(liveTranscriptionTimerRef.current);
    }
    liveTranscriptionTimerRef.current = setInterval(async () => {
      const rec = recorderRef.current;
      const trans = transcriptionRef.current;
      if (trans.isLiveTranscribing) return;
      const blob = rec.getPendingAudioChunksBlob();
      if (!blob) return;
      await trans.transcribePartial(blob);
    }, LIVE_TRANSCRIPT_INTERVAL_SECONDS * 1000);
  }, []);

  const stopLiveTranscription = useCallback(() => {
    if (liveTranscriptionTimerRef.current) {
      clearInterval(liveTranscriptionTimerRef.current);
      liveTranscriptionTimerRef.current = null;
    }
  }, []);

  // Called directly when recording stops — no ref/useEffect indirection
  const handleRecordingStopped = useCallback(async (blob: Blob) => {
    const ffm = ffmpegRef.current;
    const trans = transcriptionRef.current;

    try {
      setErrorMessage(null);

      if (blob.type.startsWith('video/mp4')) {
        // MP4 is ready immediately — show video right away, no processing state
        console.log('[Process] MP4 ready, showing video');
        setMp4Blob(blob);
        setAppState('done');

        // Defer transcription to let React render the video first
        if (trans.liveSegments.length === 0) {
          const rec = recorderRef.current;
          const audioBlob = rec.getCompleteAudioBlob();
          if (audioBlob) {
            console.log('[Process] Deferring transcription...');
            pendingTranscriptionRef.current = setTimeout(async () => {
              pendingTranscriptionRef.current = null;
              try {
                await trans.transcribe(audioBlob);
              } catch (e) {
                console.error('[Process] Background transcription failed:', e);
              }
            }, 50);
          }
        }
      } else {
        // WebM — need processing state while FFmpeg converts
        setAppState('processing');
        if (ffm.state === 'idle') {
          await ffm.loadFFmpeg();
        }
        const outputBlob = await ffm.convertToMP4(blob);

        if (trans.liveSegments.length === 0) {
          const rec = recorderRef.current;
          const audioBlob = rec.getCompleteAudioBlob();
          if (audioBlob) {
            setTimeout(async () => {
              try {
                await trans.transcribe(audioBlob);
              } catch (e) {
                console.error('[Process] Background transcription failed:', e);
              }
            }, 50);
          }
        }

        setMp4Blob(outputBlob);
        setAppState('done');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed.';
      setErrorMessage(message);
      setAppState('error');
    }
  }, []);

  const handleStartRecording = useCallback(async () => {
    // Clear any pending background transcription
    if (pendingTranscriptionRef.current) {
      clearTimeout(pendingTranscriptionRef.current);
      pendingTranscriptionRef.current = null;
    }
    setErrorMessage(null);
    setMp4Blob(null);
    ffmpeg.reset();
    transcription.reset();
    await recorder.startRecording(selectedResolution);
  }, [recorder, ffmpeg, transcription, selectedResolution]);

  const handleStopRecording = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleRecordAgain = useCallback(() => {
    // Clear any pending background transcription
    if (pendingTranscriptionRef.current) {
      clearTimeout(pendingTranscriptionRef.current);
      pendingTranscriptionRef.current = null;
    }
    setAppState('idle');
    setMp4Blob(null);
    setErrorMessage(null);
    ffmpeg.reset();
    transcription.reset();
    recorder.reset();
  }, [ffmpeg, transcription, recorder]);

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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-zinc-100 tracking-tight">ScreenScribe</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-zinc-600 bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-700/50">
            All local · No uploads
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Error Banner */}
        {appState === 'error' && errorMessage && (
          <div className="w-full max-w-lg mx-auto mb-8 p-4 bg-red-900/15 border border-red-800/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-red-300">{errorMessage}</p>
                <button
                  onClick={handleRecordAgain}
                  className="mt-3 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                >
                  Try again →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IDLE STATE — VEED.io inspired record screen */}
        {appState === 'idle' && (
          <div className="flex flex-col items-center">
            {/* Resolution selector */}
            <div className="flex items-center gap-1 mb-8 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-1">
              {(['1080p', '4K'] as const).map((res) => (
                <button
                  key={res}
                  onClick={() => setSelectedResolution(res)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    selectedResolution === res
                      ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {res === '4K' && (
                      <span className="text-[10px] font-bold text-blue-400">4K</span>
                    )}
                    {res === '1080p' && (
                      <span className="text-[10px] font-bold text-emerald-400">HD</span>
                    )}
                    {res === '4K' ? 'Ultra HD' : 'Full HD'}
                  </span>
                </button>
              ))}
            </div>

            <RecordButton state="idle" onClick={handleStartRecording} />

            {/* Feature cards */}
            <div className="grid grid-cols-3 gap-3 mt-12 w-full max-w-lg">
              {[
                { icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', label: selectedResolution === '4K' ? 'Ultra HD' : 'Full HD', desc: selectedResolution === '4K' ? '4K recording' : '1080p recording' },
                { icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', label: 'System Audio', desc: 'Mix mic + speakers' },
                { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'AI Transcript', desc: 'Powered by Whisper' },
              ].map((feat, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center mb-2">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feat.icon} />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-zinc-300">{feat.label}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTING STATE */}
        {appState === 'requesting' && (
          <RecordButton state="requesting" onClick={() => {}} />
        )}

        {/* RECORDING STATE */}
        {appState === 'recording' && (
          <div className="w-full max-w-xl mx-auto">
            {/* Recording bar */}
            <div className="glass glass-border rounded-2xl px-6 py-4 mb-6">
              <div className="flex items-center justify-between">
                <Timer elapsedSeconds={recorder.elapsedSeconds} />
                <AudioMeter level={recorder.audioLevel} audioTrackMuted={recorder.audioTrackMuted} />
              </div>
            </div>

            {/* Stop button */}
            <button
              onClick={handleStopRecording}
              className="group w-full flex items-center justify-center gap-3 px-6 py-4 
                         bg-red-600 hover:bg-red-500 text-white font-semibold rounded-2xl 
                         transition-all duration-200 shadow-xl shadow-red-600/20 
                         hover:shadow-red-500/30 active:scale-[0.99]
                         border border-red-400/20 hover:border-red-400/30"
            >
              <span className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center">
                <span className="w-3 h-3 rounded-sm bg-white" />
              </span>
              <span className="text-base">Stop Recording</span>
              <span className="text-xs text-red-200 ml-auto">
                Esc to stop
              </span>
            </button>

            {/* Keyboard listener for Escape */}
            <KeyboardHandler onEscape={handleStopRecording} />

            {/* Live transcript */}
            <div className="mt-6 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 max-h-52 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Live Transcript</p>
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
                <div className="space-y-1.5">
                  {displaySegments.map((seg, i) => (
                    <div key={i} className="flex gap-2.5 text-sm">
                      <span className="text-[11px] font-mono text-zinc-600 whitespace-nowrap pt-0.5 min-w-[40px]">
                        {formatTime(seg.timestamp[0])}
                      </span>
                      <p className="text-zinc-300 leading-relaxed">{seg.text}</p>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 pt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
                    <span className="text-[10px] text-zinc-600">listening...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROCESSING STATE */}
        {appState === 'processing' && (
          <div className="w-full max-w-lg mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-zinc-200 mb-1">Processing your recording</p>
            <p className="text-sm text-zinc-500 mb-8">This should only take a moment</p>

            <ProgressPanel
              ffmpegProgress={ffmpeg.progress}
              ffmpegState={ffmpeg.state}
              transcriptionState={transcription.state}
              transcriptionProgress={transcription.transcriptionProgress}
              modelProgress={transcription.modelProgress}
            />

            {transcription.liveSegments.length > 0 && (
              <div className="mt-8 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 max-h-40 overflow-y-auto text-left">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Transcript</p>
                <div className="space-y-1.5">
                  {transcription.liveSegments.map((seg, i) => (
                    <div key={i} className="flex gap-2.5 text-sm">
                      <span className="text-[11px] font-mono text-zinc-600 whitespace-nowrap pt-0.5 min-w-[40px]">
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

        {/* DONE STATE */}
        {appState === 'done' && mp4Blob && (
          <div className="w-full max-w-2xl mx-auto space-y-8">
            <VideoPreview blob={mp4Blob} />
            {displaySegments.length > 0 && (
              <TranscriptPanel segments={displaySegments} />
            )}

            <div className="flex justify-center">
              <button
                onClick={handleRecordAgain}
                className="group flex items-center gap-2.5 px-6 py-3.5 bg-zinc-800/80 hover:bg-zinc-700/80 
                           text-zinc-300 font-medium rounded-2xl transition-all duration-200
                           border border-zinc-700/50 hover:border-zinc-600/50 active:scale-[0.99]
                           shadow-lg"
              >
                <svg className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Record Another Video
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-zinc-800/30">
        <p className="text-[11px] text-zinc-700 text-center">
          All processing happens locally in your browser. Nothing is ever uploaded.
        </p>
      </footer>
    </div>
  );
}
