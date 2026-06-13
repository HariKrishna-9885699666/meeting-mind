'use client';

import React from 'react';

interface RecordButtonProps {
  state: 'idle' | 'requesting' | 'recording';
  onClick: () => void;
}

export default function RecordButton({ state, onClick }: RecordButtonProps) {
  if (state === 'requesting') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-pulse" />
          <div className="relative w-full h-full rounded-full bg-blue-500/20 flex items-center justify-center">
            <div className="w-12 h-12 border-[3px] border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-blue-400 text-base font-semibold">
            Waiting for screen selection...
          </p>
          <p className="text-zinc-500 text-sm mt-1">
            Choose a screen or window to share
          </p>
        </div>
      </div>
    );
  }

  if (state === 'recording') {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        onClick={onClick}
        className="group relative w-32 h-32 rounded-full transition-transform duration-200 active:scale-95"
      >
        {/* Outer glow ring */}
        <div className="absolute inset-[-8px] rounded-full bg-red-500/10 group-hover:bg-red-500/20 transition-all duration-300" />
        {/* Pulsing ring */}
        <div className="absolute inset-[-4px] rounded-full border-2 border-red-500/20 group-hover:border-red-500/30 animate-pulse" />
        {/* Button body */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-red-500 to-red-600 
                       shadow-xl shadow-red-500/25 group-hover:shadow-red-500/40 
                       group-hover:from-red-400 group-hover:to-red-500 transition-all duration-300
                       flex items-center justify-center">
          <div className="absolute inset-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors" />
          <div className="relative w-14 h-14 rounded-full bg-white shadow-lg" />
        </div>
      </button>
      
      <div className="text-center space-y-2">
        <p className="text-zinc-100 text-lg font-semibold">Click to Record</p>
        <div className="flex items-center justify-center gap-3 text-sm text-zinc-500">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            4K Ultra HD
          </span>
          <span className="w-1 h-1 rounded-full bg-zinc-700" />
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            System Audio
          </span>
          <span className="w-1 h-1 rounded-full bg-zinc-700" />
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            No uploads
          </span>
        </div>
      </div>
    </div>
  );
}
