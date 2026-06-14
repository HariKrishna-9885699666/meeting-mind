'use client';

import React from 'react';

interface AudioMeterProps {
  level: number;
  audioTrackMuted: boolean;
}

export default function AudioMeter({ level, audioTrackMuted }: AudioMeterProps) {
  const numBars = 28;
  const activeBars = Math.round(level * numBars);

  if (audioTrackMuted) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-full">
        <svg
          className="w-3.5 h-3.5 text-amber-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
          />
        </svg>
        <span className="text-xs text-amber-400 font-medium">No system audio</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-[2px] h-8">
        {Array.from({ length: numBars }).map((_, i) => {
          const isActive = i < activeBars;
          const intensity = activeBars > 0 ? i / Math.max(activeBars, 1) : 0;
          const height = 6 + (i / numBars) * 20;
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-all duration-75 ${
                isActive
                  ? intensity < 0.5
                    ? 'bg-emerald-400'
                    : intensity < 0.75
                      ? 'bg-yellow-400'
                      : 'bg-red-400'
                  : 'bg-zinc-700'
              }`}
              style={{
                height: `${height}px`,
                opacity: isActive ? 0.9 : 0.25,
                boxShadow: isActive
                  ? `0 0 4px ${
                      intensity < 0.5
                        ? 'rgba(52,211,153,0.4)'
                        : intensity < 0.75
                          ? 'rgba(250,204,21,0.4)'
                          : 'rgba(248,113,113,0.4)'
                    }`
                  : 'none',
              }}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider min-w-[32px]">
        Audio
      </span>
    </div>
  );
}
