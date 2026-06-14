import { describe, it, expect } from 'vitest';
import { formatSRT, formatTXT, type TranscriptSegment } from './srtFormatter';

describe('formatSRT', () => {
  it('returns empty string for empty segments', () => {
    expect(formatSRT([])).toBe('');
  });

  it('formats a single segment correctly', () => {
    const segments: TranscriptSegment[] = [{ timestamp: [0, 1.5], text: 'Hello world' }];
    const result = formatSRT(segments);
    expect(result).toBe('1\n00:00:00,000 --> 00:00:01,500\nHello world\n');
  });

  it('formats multiple segments sequentially', () => {
    const segments: TranscriptSegment[] = [
      { timestamp: [0, 1.5], text: 'Hello world' },
      { timestamp: [1.5, 3.0], text: 'How are you?' },
    ];
    const result = formatSRT(segments);
    expect(result).toBe(
      '1\n00:00:00,000 --> 00:00:01,500\nHello world\n\n2\n00:00:01,500 --> 00:00:03,000\nHow are you?\n',
    );
  });

  it('trims whitespace from segment text', () => {
    const segments: TranscriptSegment[] = [{ timestamp: [0, 1], text: '  leading and trailing  ' }];
    const result = formatSRT(segments);
    expect(result).toContain('\nleading and trailing\n');
  });

  it('handles timestamps beyond one hour', () => {
    const segments: TranscriptSegment[] = [{ timestamp: [3661, 3721], text: 'Long recording' }];
    const result = formatSRT(segments);
    expect(result).toContain('01:01:01,000 --> 01:02:01,000');
  });

  it('handles fractional seconds correctly', () => {
    const segments: TranscriptSegment[] = [{ timestamp: [0.123, 0.789], text: 'fractional' }];
    const result = formatSRT(segments);
    expect(result).toContain('00:00:00,123 --> 00:00:00,789');
  });

  it('rounds milliseconds correctly (0.9999 → 1000 → 00:00:01,000)', () => {
    const segments: TranscriptSegment[] = [{ timestamp: [0.9999, 1.0001], text: 'boundary' }];
    const result = formatSRT(segments);
    expect(result).toContain('00:00:01,000');
  });

  it('handles zero timestamps', () => {
    const segments: TranscriptSegment[] = [{ timestamp: [0, 0], text: 'instant' }];
    const result = formatSRT(segments);
    expect(result).toContain('00:00:00,000 --> 00:00:00,000');
  });
});

describe('formatTXT', () => {
  it('returns empty string for empty segments', () => {
    expect(formatTXT([])).toBe('');
  });

  it('joins segment texts with newlines', () => {
    const segments: TranscriptSegment[] = [
      { timestamp: [0, 1], text: 'First sentence.' },
      { timestamp: [1, 2], text: 'Second sentence.' },
    ];
    expect(formatTXT(segments)).toBe('First sentence.\nSecond sentence.');
  });

  it('trims whitespace from each segment text', () => {
    const segments: TranscriptSegment[] = [{ timestamp: [0, 1], text: '  spaced  ' }];
    expect(formatTXT(segments)).toBe('spaced');
  });

  it('handles a single segment', () => {
    const segments: TranscriptSegment[] = [{ timestamp: [0, 5], text: 'Just one line.' }];
    expect(formatTXT(segments)).toBe('Just one line.');
  });
});
