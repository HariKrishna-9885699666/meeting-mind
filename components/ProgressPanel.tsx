'use client';

import React from 'react';

interface ProgressPanelProps {
  ffmpegProgress: number;
  ffmpegState: string;
  transcriptionState: string;
  transcriptionProgress: number;
  modelProgress: {
    status: string;
    file: string;
    progress: number;
    loaded: number;
    total: number;
  } | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export default function ProgressPanel({
  ffmpegProgress,
  ffmpegState,
  transcriptionState,
  transcriptionProgress,
  modelProgress,
}: ProgressPanelProps) {
  const isConverting = ffmpegState === 'converting';
  const isBurning = ffmpegState === 'burning';
  const isLoadingModel = transcriptionState === 'loading-model';
  const isTranscribing = transcriptionState === 'transcribing';
  const show = isConverting || isBurning || isLoadingModel || isTranscribing;

  if (!show) return null;

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* FFmpeg conversion progress */}
      {isConverting && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">
              Converting to MP4
            </span>
            <span className="text-sm text-zinc-500 tabular-nums">
              {ffmpegProgress}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${ffmpegProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Model download progress */}
      {isLoadingModel && modelProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">
              Downloading Whisper model
            </span>
            <span className="text-sm text-zinc-500 tabular-nums">
              {modelProgress.total > 0
                ? `${formatBytes(modelProgress.loaded)} / ${formatBytes(modelProgress.total)}`
                : `${modelProgress.status}...`}
            </span>
          </div>
          {modelProgress.total > 0 && (
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.round((modelProgress.loaded / modelProgress.total) * 100)}%`,
                }}
              />
            </div>
          )}
          {modelProgress.total === 0 && (
            <div className="flex items-center gap-2 text-zinc-500">
              <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Preparing download...</span>
            </div>
          )}
        </div>
      )}

      {/* Transcription progress */}
      {isTranscribing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">
              Transcribing audio
            </span>
            <span className="text-sm text-zinc-500 tabular-nums">
              {transcriptionProgress}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(transcriptionProgress, 5)}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Processing segments...</span>
          </div>
        </div>
      )}

      {/* Subtitle burning progress */}
      {isBurning && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-300">
              Burning subtitles into video
            </span>
            <span className="text-sm text-zinc-500 tabular-nums">
              {ffmpegProgress}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${ffmpegProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary when both are done */}
      {ffmpegState === 'done' && transcriptionState === 'done' && (
        <div className="flex items-center gap-2 text-emerald-400">
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-sm font-medium">Processing complete</span>
        </div>
      )}
    </div>
  );
}
