'use client';

import React from 'react';

interface AudioMeterProps {
  level: number;
  audioTrackMuted: boolean;
}

export default function AudioMeter({ level, audioTrackMuted }: AudioMeterProps) {
  const numBars = 20;
  const activeBars = Math.round(level * numBars);

  if (audioTrackMuted) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-400 font-medium">
          ⚠ No system audio
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500 font-medium w-10">Audio</span>
      <div className="flex items-center gap-[2px]">
        {Array.from({ length: numBars }).map((_, i) => (
          <div
            key={i}
            className={`w-[6px] rounded-full transition-all duration-75 ${
              i < activeBars
                ? i < numBars * 0.5
                  ? 'bg-green-400'
                  : i < numBars * 0.75
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                : 'bg-zinc-700'
            }`}
            style={{
              height: `${8 + (i / numBars) * 16}px`,
              opacity: i < activeBars ? 1 : 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}
