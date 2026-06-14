import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: 'MeetMind — Screen Recording with AI Transcripts',
  description:
    'Record your screen with system audio and get automatic transcripts — all in your browser, zero uploads. Powered by ffmpeg.wasm and Whisper AI.',
  keywords: [
    'screen recording',
    'screen capture',
    'transcription',
    'whisper',
    'ffmpeg',
    'webm to mp4',
    'speech to text',
    'meeting recorder',
    'no upload',
    'privacy first',
  ],
  authors: [{ name: 'Hari Krishna' }],
  creator: 'Hari Krishna',
  publisher: 'MeetMind',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://github.com/HariKrishna-9885699666/meeting-mind',
    siteName: 'MeetMind',
    title: 'MeetMind — Screen Recording with AI Transcripts',
    description:
      'Record your screen with system audio and get automatic transcripts — all in your browser, zero uploads.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MeetMind - Record your screen. Keep your words.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MeetMind — Screen Recording with AI Transcripts',
    description:
      'Record your screen with system audio and get automatic transcripts — all in your browser, zero uploads.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://unpkg.com" />
        <link rel="preconnect" href="https://huggingface.co" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
      </head>
      <body className="antialiased min-h-screen bg-[#0c0c10] text-zinc-100">{children}</body>
    </html>
  );
}
