export interface TranscriptSegment {
  timestamp: [number, number]; // [startSeconds, endSeconds]
  text: string;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const millis = Math.round((s - Math.floor(s)) * 1000);
  const wholeS = Math.floor(s);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(wholeS).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function formatSRT(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, index) => {
      const start = formatTimestamp(seg.timestamp[0]);
      const end = formatTimestamp(seg.timestamp[1]);
      return `${index + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

export function formatTXT(segments: TranscriptSegment[]): string {
  return segments.map((seg) => seg.text.trim()).join('\n');
}
