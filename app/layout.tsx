import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScreenScribe — Screen Recording with AI Transcripts",
  description:
    "Record your screen with system audio and get automatic transcripts — all in your browser, zero uploads.",
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
      </head>
      <body className="antialiased min-h-screen bg-[#0a0a0f] text-zinc-100">
        {children}
      </body>
    </html>
  );
}
