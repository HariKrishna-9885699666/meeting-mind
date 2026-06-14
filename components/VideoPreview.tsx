'use client';

import React, { useRef, useEffect, useState } from 'react';

interface VideoPreviewProps {
  blob: Blob;
}

export default function VideoPreview({ blob }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const newUrl = URL.createObjectURL(blob);
    setUrl(newUrl);
    return () => {
      URL.revokeObjectURL(newUrl);
    };
  }, [blob]);

  const handleDownload = () => {
    // Create a fresh URL for download to ensure it works even if urlRef is somehow stale
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `screen-recording-${timestamp}.mp4`;
    a.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800 shadow-2xl">
        {url ? (
          <video
            ref={videoRef}
            src={url}
            controls
            className="w-full max-h-[480px] object-contain"
            preload="auto"
          />
        ) : (
          <div className="w-full h-64 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <button
        onClick={handleDownload}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 
                   bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 
                   text-white font-semibold rounded-xl transition-all duration-200
                   shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-[0.98]"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download MP4
      </button>
    </div>
  );
}
