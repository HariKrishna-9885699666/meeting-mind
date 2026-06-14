/**
 * Extracts audio from a WebM blob and returns a Float32Array PCM buffer
 * at 16kHz, mono — suitable for Whisper transcription.
 *
 * Uses OfflineAudioContext to properly resample to the target sample rate.
 */
export async function extractAudioPCM(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();

  // Decode audio at its original sample rate
  const ctx = new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const originalSampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const originalLength = audioBuffer.length;
  await ctx.close();

  // Convert to mono by averaging channels
  const monoPCM = new Float32Array(originalLength);
  if (numChannels === 1) {
    monoPCM.set(audioBuffer.getChannelData(0));
  } else {
    for (let i = 0; i < originalLength; i++) {
      let sum = 0;
      for (let c = 0; c < numChannels; c++) {
        sum += audioBuffer.getChannelData(c)[i];
      }
      monoPCM[i] = sum / numChannels;
    }
  }

  // Resample to 16kHz using OfflineAudioContext for proper interpolation
  const targetSampleRate = 16000;
  const targetLength = Math.round((originalLength * targetSampleRate) / originalSampleRate);

  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const buffer = offlineCtx.createBuffer(1, monoPCM.length, originalSampleRate);
  buffer.getChannelData(0).set(monoPCM);

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}
