/* eslint-disable no-undef */
/// <reference lib="webworker" />

/**
 * Whisper Web Worker — runs @xenova/transformers inference off the main thread
 * so the UI stays responsive during transcription.
 *
 * Message protocol (main → worker):
 *   { id, type: 'LOAD' }
 *   { id, type: 'TRANSCRIBE', data: { audio: Float32Array } }
 *   { id, type: 'TRANSCRIBE_PARTIAL', data: { audio: Float32Array, chunkIndex: number } }
 *
 * Message protocol (worker → main):
 *   { id, type: 'LOAD_PROGRESS', data: { status: string, progress: number } }
 *   { id, type: 'RESULT', data: { chunks: Array, text: string } }
 *   { id, type: 'PARTIAL_RESULT', data: { chunkIndex: number, chunks: Array, text: string } }
 *   { id, type: 'ERROR', data: string }
 */

// We need to import the library dynamically since workers use importScripts,
// but @xenova/transformers is a module. We'll use a self-executing setup.
let pipeline = null;
let env = null;
let transcriber = null;
let modelsLoaded = false;

// Dynamically import the library
async function loadLibrary() {
  if (modelsLoaded) return;

  try {
    // Import the transformers library
    const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm');
    pipeline = transformers.pipeline;
    env = transformers.env;

    // Configure for local models
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    // Use default modelsPath which prepends /models/ — model lives at public/models/whisper-model/
    env.backends.onnx.wasm.proxy = false;

    modelsLoaded = true;
  } catch (err) {
    throw new Error(`Failed to load transformers library: ${err.message}`);
  }
}

async function ensureModel(onProgress) {
  if (transcriber) return transcriber;

  await loadLibrary();

  transcriber = await pipeline(
    'automatic-speech-recognition',
    'whisper-model', // resolves to /models/whisper-model/
    {
      progress_callback: onProgress,
    },
  );

  return transcriber;
}

/** Parse raw Whisper result into structured segments. */
function parseResult(result) {
  const segments = [];

  if (result.chunks) {
    for (const chunk of result.chunks) {
      if (chunk.timestamp && chunk.timestamp[0] !== undefined) {
        segments.push({
          timestamp: [
            chunk.timestamp[0],
            chunk.timestamp[1] ?? chunk.timestamp[0] + 1,
          ],
          text: (chunk.text || '').trim(),
        });
      }
    }
  }

  if (segments.length === 0 && result.text) {
    segments.push({
      timestamp: [0, 1],
      text: result.text.trim(),
    });
  }

  return segments;
}

self.onmessage = async (event) => {
  const { id, type, data } = event.data;

  try {
    switch (type) {
      case 'LOAD': {
        await ensureModel((progress) => {
          self.postMessage({
            id,
            type: 'LOAD_PROGRESS',
            data: {
              status: progress.status || 'loading',
              progress: progress.progress || 0,
            },
          });
        });
        self.postMessage({ id, type: 'RESULT', data: { loaded: true } });
        break;
      }

      case 'TRANSCRIBE': {
        const model = await ensureModel();
        const audioData = data.audio;

        const result = await model(audioData, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });

        const segments = parseResult(result);
        self.postMessage({
          id,
          type: 'RESULT',
          data: { chunks: segments, text: result.text || '' },
        });
        break;
      }

      case 'TRANSCRIBE_PARTIAL': {
        const model = await ensureModel();
        const audioData = data.audio;
        const chunkIndex = data.chunkIndex;

        const result = await model(audioData, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });

        const segments = parseResult(result);
        self.postMessage({
          id,
          type: 'PARTIAL_RESULT',
          data: {
            chunkIndex,
            chunks: segments,
            text: result.text || '',
          },
        });
        break;
      }

      default:
        self.postMessage({
          id,
          type: 'ERROR',
          data: `Unknown message type: ${type}`,
        });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'ERROR',
      data: err instanceof Error ? err.message : String(err),
    });
  }
};
