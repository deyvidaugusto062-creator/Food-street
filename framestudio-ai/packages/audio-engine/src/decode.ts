import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';
import { FrameStudioError } from '@framestudio/shared';
import { spectralDenoise } from './analysis.ts';

/**
 * Decodifica todo o áudio de um arquivo para PCM na taxa do projeto.
 * Primeiro tenta `decodeAudioData` (rápido e reamostrado pelo navegador); se falhar, usa WebCodecs.
 */
export async function decodeAudio(blob: Blob, sampleRate = 48000): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate });
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    return decodeWithWebCodecs(blob, sampleRate);
  }
}

async function decodeWithWebCodecs(blob: Blob, sampleRate: number): Promise<AudioBuffer> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new FrameStudioError('UNSUPPORTED_FILE', 'O arquivo não tem faixa de áudio.');
    if (!(await track.canDecode())) throw new FrameStudioError('UNSUPPORTED_CODEC', 'O codec de áudio não é suportado por este navegador.');
    const duration = await input.computeDuration([track]);
    const channels = Math.min(2, await track.getNumberOfChannels());
    const srcRate = await track.getSampleRate();
    const length = Math.max(1, Math.ceil(duration * srcRate));
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    const sink = new AudioBufferSink(track);
    for await (const { buffer, timestamp } of sink.buffers()) {
      const offset = Math.round(timestamp * srcRate);
      for (let c = 0; c < channels; c++) {
        const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
        const dst = data[c]!;
        const n = Math.min(src.length, dst.length - offset);
        if (n > 0 && offset >= 0) dst.set(src.subarray(0, n), offset);
      }
    }
    // Reamostra via OfflineAudioContext.
    const tmp = new OfflineAudioContext({ numberOfChannels: channels, length, sampleRate: srcRate });
    const raw = tmp.createBuffer(channels, length, srcRate);
    data.forEach((d, i) => raw.copyToChannel(d, i));
    if (srcRate === sampleRate) return raw;
    const outLen = Math.ceil(duration * sampleRate);
    const off = new OfflineAudioContext({ numberOfChannels: channels, length: outLen, sampleRate });
    const s = off.createBufferSource();
    s.buffer = raw;
    s.connect(off.destination);
    s.start();
    return await off.startRendering();
  } finally {
    input.dispose();
  }
}

function createBufferLike(source: AudioBuffer): AudioBuffer {
  return new AudioBuffer({ numberOfChannels: source.numberOfChannels, length: source.length, sampleRate: source.sampleRate });
}

export function reverseBuffer(b: AudioBuffer): AudioBuffer {
  const out = createBufferLike(b);
  for (let c = 0; c < b.numberOfChannels; c++) {
    const src = b.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i]!;
  }
  return out;
}

export function denoiseBuffer(b: AudioBuffer, amount: number): AudioBuffer {
  const out = createBufferLike(b);
  for (let c = 0; c < b.numberOfChannels; c++) out.copyToChannel(spectralDenoise(b.getChannelData(c), amount) as Float32Array<ArrayBuffer>, c);
  return out;
}
