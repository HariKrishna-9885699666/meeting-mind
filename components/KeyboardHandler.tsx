'use client';

import { useEffect } from 'react';

interface KeyboardHandlerProps {
  onEscape: () => void;
}

export default function KeyboardHandler({ onEscape }: KeyboardHandlerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);

  return null;
}
