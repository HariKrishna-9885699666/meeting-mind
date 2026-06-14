import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractAudioPCM } from './audioExtractor';

function createMockAudioBuffer(
  sampleRate: number,
  channels: number,
  length: number,
  channelData?: Float32Array[],
): AudioBuffer {
  const data = channelData ?? [
    new Float32Array(length).fill(channels === 1 ? 0.5 : 0.25),
    ...(channels > 1 ? [new Float32Array(length).fill(0.75)] : []),
  ];
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: channels,
    getChannelData: (ch: number) => data[ch] ?? new Float32Array(length),
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as AudioBuffer;
}

function mockWebAudioAPI() {
  const mockDecode = vi.fn();
  const mockClose = vi.fn();
  const mockConnect = vi.fn();
  const mockStart = vi.fn();
  const mockGetChannelData = vi.fn();
  const mockCreateBuffer = vi.fn();
  const mockCreateBufferSource = vi.fn();
  const mockStartRendering = vi.fn();

  const MockAudioContext = vi.fn().mockImplementation(function () {
    return {
      decodeAudioData: mockDecode,
      close: mockClose,
      sampleRate: 48000,
    };
  });

  const MockOfflineAudioContext = vi.fn().mockImplementation(function (
    _channels: number,
    _length: number,
    _sampleRate: number,
  ) {
    return {
      createBuffer: mockCreateBuffer,
      createBufferSource: mockCreateBufferSource,
      destination: {},
      startRendering: mockStartRendering,
    };
  });

  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);

  return {
    mockDecode,
    mockClose,
    mockConnect,
    mockStart,
    mockGetChannelData,
    mockCreateBuffer,
    mockCreateBufferSource,
    mockStartRendering,
  };
}

function createBlob(data?: ArrayBuffer, type?: string): Blob {
  const content = data ?? new ArrayBuffer(1024);
  return {
    arrayBuffer: () => Promise.resolve(content),
    size: content.byteLength,
    type: type ?? 'audio/webm',
  } as Blob;
}

describe('extractAudioPCM', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts mono audio at 16kHz from a mono source', async () => {
    const mocks = mockWebAudioAPI();

    const FRAMES = 48000;
    const monoBuffer = createMockAudioBuffer(48000, 1, FRAMES);
    mocks.mockDecode.mockResolvedValue(monoBuffer);

    const createdBuffer = createMockAudioBuffer(1, 1, FRAMES);
    const createdChannel = new Float32Array(FRAMES).fill(0.5);
    createdBuffer.getChannelData = () => createdChannel;
    mocks.mockCreateBuffer.mockReturnValue(createdBuffer);

    const renderedBuffer = new Float32Array(16000).fill(0.5);
    mocks.mockStartRendering.mockResolvedValue({
      getChannelData: () => renderedBuffer,
    } as AudioBuffer);

    mocks.mockCreateBufferSource.mockReturnValue({
      connect: mocks.mockConnect,
      start: mocks.mockStart,
      buffer: null,
    });

    const result = await extractAudioPCM(createBlob());

    expect(mocks.mockDecode).toHaveBeenCalledTimes(1);
    expect(mocks.mockClose).toHaveBeenCalledTimes(1);
    expect(result).toBe(renderedBuffer);
    expect(result.length).toBe(16000);
  });

  it('converts stereo to mono by averaging channels', async () => {
    const mocks = mockWebAudioAPI();

    const FRAMES = 48000;
    const stereoBuffer = createMockAudioBuffer(48000, 2, FRAMES, [
      new Float32Array(FRAMES).fill(0.5),
      new Float32Array(FRAMES).fill(0.3),
    ]);
    mocks.mockDecode.mockResolvedValue(stereoBuffer);

    const createdBuffer = createMockAudioBuffer(1, 1, FRAMES);
    const createdChannel = new Float32Array(FRAMES).fill(0.4);
    createdBuffer.getChannelData = () => createdChannel;
    mocks.mockCreateBuffer.mockReturnValue(createdBuffer);

    const renderedBuffer = new Float32Array(16000).fill(0.4);
    mocks.mockStartRendering.mockResolvedValue({
      getChannelData: () => renderedBuffer,
    } as AudioBuffer);

    mocks.mockCreateBufferSource.mockReturnValue({
      connect: mocks.mockConnect,
      start: mocks.mockStart,
      buffer: null,
    });

    const result = await extractAudioPCM(createBlob());

    expect(mocks.mockDecode).toHaveBeenCalledTimes(1);
    expect(result).toBe(renderedBuffer);
  });

  it('throws when decodeAudioData fails', async () => {
    const mocks = mockWebAudioAPI();
    mocks.mockDecode.mockRejectedValue(new DOMException('Decoding failed'));

    await expect(extractAudioPCM(createBlob())).rejects.toThrow('Decoding failed');

    expect(mocks.mockClose).not.toHaveBeenCalled();
  });

  it('throws when blob.arrayBuffer() fails', async () => {
    const badBlob = {
      arrayBuffer: () => Promise.reject(new Error('Blob error')),
      size: 0,
      type: 'audio/webm',
    } as Blob;

    await expect(extractAudioPCM(badBlob)).rejects.toThrow('Blob error');
  });
});
