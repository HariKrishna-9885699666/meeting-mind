'use client';

import React from 'react';

interface ProgressPanelProps {
  ffmpegProgress: number;
  ffmpegState: string;
}

export default function ProgressPanel({
  ffmpegProgress,
  ffmpegState,
}: ProgressPanelProps) {
  if (ffmpegState !== 'converting') return null;

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">Converting to MP4</span>
          <span className="text-sm text-zinc-500 tabular-nums">{ffmpegProgress}%</span>
        </div>
        <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${ffmpegProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
