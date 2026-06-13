'use client';

import React from 'react';

interface TimerProps {
  elapsedSeconds: number;
}

export default function Timer({ elapsedSeconds }: TimerProps) {
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
          REC
        </span>
      </div>
      <span className="text-2xl font-mono font-bold text-zinc-100 tabular-nums tracking-wider">
        {timeString}
      </span>
    </div>
  );
}
