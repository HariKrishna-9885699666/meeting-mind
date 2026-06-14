'use client';

import React, { useState, useEffect, useRef } from 'react';

interface InfoItem {
  label: string;
  value: string;
  href?: string;
  icon?: React.ReactNode;
}

const personalInfo: InfoItem[] = [
  { label: 'Name', value: 'Hari Krishna Anem' },
  { label: 'Education', value: 'B.Tech (CSIT)' },
  { label: 'Location', value: 'Hyderabad, India' },
];

const contactInfo: InfoItem[] = [
  { label: 'Phone', value: '+91 9885699666', href: 'tel:+919885699666' },
  { label: 'Email', value: 'anemharikrishna@gmail.com', href: 'mailto:anemharikrishna@gmail.com' },
];

const socialLinks: { platform: string; url: string; icon: React.ReactNode }[] = [
  {
    platform: 'GitHub',
    url: 'https://github.com/HariKrishna-9885699666',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    platform: 'LinkedIn',
    url: 'https://linkedin.com/in/anemharikrishna',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    platform: 'Blog',
    url: 'https://hashnode.com/@HariKrishna-9885699666',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.539 8.242c-.142-.364-.466-.656-.896-.76l-5.732-1.432c-.43-.108-.912-.072-1.255.137l-11.037 6.8c-.461.284-.64.85-.464 1.354.142.364.466.656.896.76l5.732 1.432c.43.105.912.064 1.255-.137l11.037-6.8c.461-.284.64-.85.464-1.354zm-6.874 3.835l-7.97-1.992 1.132-1.138 5.802 1.45c.428.107.886.08 1.253-.097l3.163-1.625c.254-.131.536.024.598.269.063.256-.1.562-.357.725l-3.621 2.308zm-2.217 2.682L6.468 12.98l1.132-1.138 5.802 1.45c.428.107.886.08 1.253-.097l3.163-1.625c.254-.131.536.024.598.269.063.256-.1.562-.357.725l-3.621 2.308zm-1.665 2.47l-3.622-1.044 1.132-1.138 2.49.622z" />
      </svg>
    ),
  },
  {
    platform: 'Portfolio',
    url: 'https://harikrishna.is-a-good.dev',
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
  },
];

export default function FloatingInfoButton() {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full 
                   bg-gradient-to-br from-blue-500 to-purple-600 
                   hover:from-blue-400 hover:to-purple-500 
                   shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40
                   flex items-center justify-center
                   transition-all duration-200 active:scale-90
                   border border-white/10"
        title="About the creator"
      >
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </button>

      {/* Modal backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={modalRef}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl 
                       overflow-hidden animate-modal-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">About the Creator</h2>
                  <p className="text-[11px] text-zinc-500">Built with ❤️ by Hari Krishna</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
              >
                <svg
                  className="w-4 h-4 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Personal Information */}
              <section>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Personal Information
                </h3>
                <div className="space-y-2.5">
                  {personalInfo.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">{item.label}</span>
                      <span className="text-sm text-zinc-200 font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Contact Details */}
              <section>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  Contact Details
                </h3>
                <div className="space-y-2.5">
                  {contactInfo.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">{item.label}</span>
                      {item.href ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <span className="text-sm text-zinc-200 font-medium">{item.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Social Links */}
              <section>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  Social &amp; Professional Links
                </h3>
                <div className="space-y-2">
                  {socialLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 
                                 border border-zinc-700/50 hover:border-zinc-600/50 transition-all duration-200 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-zinc-700/50 flex items-center justify-center text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {link.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 transition-colors">
                          {link.platform}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {link.url.replace(/^https?:\/\//, '')}
                        </p>
                      </div>
                      <svg
                        className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-zinc-800">
              <p className="text-[10px] text-zinc-700 text-center">
                MeetMind v1.0 · Built with Next.js, ffmpeg.wasm &amp; Whisper AI
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
