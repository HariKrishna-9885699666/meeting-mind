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
        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-blue-400 text-lg font-medium">
          Waiting for screen selection...
        </p>
      </div>
    );
  }

  if (state === 'recording') {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        onClick={onClick}
        className="group relative w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-red-600 
                   hover:from-red-400 hover:to-red-500 active:scale-95 transition-all duration-200
                   shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
      >
        <div className="absolute inset-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white" />
        </div>
      </button>
      <span className="text-sm font-medium text-zinc-400">Click to Record</span>
    </div>
  );
}
