import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = true;
env.allowRemoteModels = true;
env.backends.onnx.wasm.wasmPaths = '/wasm/';
env.backends.onnx.wasm.proxy = false;

let transcriber: any = null;

async function ensureModel() {
  if (transcriber) return;
  transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-base',
  );
}

function parseResult(result: any): Array<{ timestamp: [number, number]; text: string }> {
  const segments: Array<{ timestamp: [number, number]; text: string }> = [];
  if (result.chunks) {
    for (const chunk of result.chunks) {
      if (chunk.timestamp && chunk.timestamp[0] !== undefined) {
        segments.push({
          timestamp: [
            chunk.timestamp[0] as number,
            (chunk.timestamp[1] as number) ?? (chunk.timestamp[0] as number) + 1,
          ],
          text: (chunk.text as string || '').trim(),
        });
      }
    }
  }
  if (segments.length === 0 && result.text) {
    segments.push({ timestamp: [0, 1], text: (result.text as string).trim() });
  }
  return segments;
}

self.onmessage = async (event: MessageEvent) => {
  const { id, type, data } = event.data;

  try {
    switch (type) {
      case 'LOAD': {
        await ensureModel();
        self.postMessage({ id, type: 'RESULT', data: { loaded: true } });
        break;
      }

      case 'TRANSCRIBE_PARTIAL': {
        await ensureModel();
        const result = await transcriber!(data.audio, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });
        const segments = parseResult(result);
        self.postMessage({
          id,
          type: 'PARTIAL_RESULT',
          data: { chunkIndex: data.chunkIndex, chunks: segments },
        });
        break;
      }

      case 'TRANSCRIBE': {
        await ensureModel();
        const result = await transcriber!(data.audio, {
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

      default:
        self.postMessage({ id, type: 'ERROR', data: `Unknown message type: ${type}` });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'ERROR',
      data: err instanceof Error ? err.message : String(err),
    });
  }
};
