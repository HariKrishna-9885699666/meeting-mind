'use client';

import React from 'react';
import type { TranscriptSegment } from '@/lib/srtFormatter';
import { formatTXT } from '@/lib/srtFormatter';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
}

export default function TranscriptPanel({ segments }: TranscriptPanelProps) {
  if (segments.length === 0) return null;

  const handleDownloadTXT = () => {
    const text = formatTXT(segments);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `transcript-${timestamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}`;
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-200">Transcript</h3>
        <button
          onClick={handleDownloadTXT}
          className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 
                     text-zinc-300 rounded-lg transition-colors border border-zinc-700"
        >
          Download TXT
        </button>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl max-h-80 overflow-y-auto">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="flex gap-3 px-4 py-3 border-b border-zinc-800 last:border-b-0 
                       hover:bg-zinc-800/30 transition-colors"
          >
            <span className="text-xs font-mono text-zinc-500 whitespace-nowrap pt-0.5 min-w-[64px]">
              {formatTime(seg.timestamp[0])}
            </span>
            <p className="text-sm text-zinc-300 leading-relaxed">{seg.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
