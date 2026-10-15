import { describe, expect, it } from 'vitest';
import { computePeaks, detectSilences, integratedLoudness, invertIntervals, normalizationGain, peakDb, spectralDenoise, type PcmData } from './analysis.ts';

const SR = 48000;
function sine(freq: number, amp: number, secs: number): Float32Array {
  const out = new Float32Array(Math.round(SR * secs));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}
const pcm = (...ch: Float32Array[]): PcmData => ({ sampleRate: SR, channels: ch });

describe('loudness (BS.1770)', () => {
  it('seno de 997 Hz a 0 dBFS em um canal ≈ −3,01 LUFS', () => {
    const s = sine(997, 1, 5);
    expect(integratedLoudness(pcm(s))).toBeCloseTo(-3.01, 0);
  });
  it('estéreo soma a energia dos canais (+3 dB)', () => {
    const s = sine(997, 0.5, 5);
    const mono = integratedLoudness(pcm(s));
    const stereo = integratedLoudness(pcm(s, s));
    expect(stereo - mono).toBeCloseTo(3.01, 1);
  });
  it('normalização respeita o teto de pico', () => {
    const s = sine(997, 0.9, 3);
    const g = normalizationGain(pcm(s), -14, -1);
    expect(peakDb(pcm(s)) + g).toBeLessThanOrEqual(-1 + 1e-6);
  });
});

describe('silêncio', () => {
  it('encontra os intervalos de silêncio com margem', () => {
    const tone = sine(440, 0.5, 1);
    const silence = new Float32Array(SR * 1.5);
    const data = new Float32Array(tone.length * 2 + silence.length);
    data.set(tone, 0);
    data.set(silence, tone.length);
    data.set(tone, tone.length + silence.length);
    const { silences } = detectSilences(pcm(data), { thresholdDb: -40, minSilence: 0.3, padding: 0.1 });
    expect(silences).toHaveLength(1);
    expect(silences[0]!.start).toBeCloseTo(1.1, 1);
    expect(silences[0]!.end).toBeCloseTo(2.4, 1);
    const speech = invertIntervals(silences, 3.5);
    expect(speech).toHaveLength(2);
  });
  it('limiar automático pelo ruído de fundo', () => {
    const noise = new Float32Array(SR * 2).map((_, i) => 0.001 * Math.sin(i * 1.7));
    const data = new Float32Array(SR * 3);
    data.set(noise, 0);
    data.set(sine(300, 0.4, 1), SR * 2);
    const { silences, thresholdDb } = detectSilences(pcm(data), { thresholdDb: 'auto', minSilence: 0.5, padding: 0 });
    expect(thresholdDb).toBeLessThan(-25);
    expect(silences[0]!.end).toBeCloseTo(2, 1);
  });
});

describe('picos e redução de ruído', () => {
  it('picos min/max por bloco', () => {
    const p = computePeaks(pcm(sine(10, 0.8, 1)), 10);
    expect(p).toHaveLength(20);
    expect(Math.max(...p)).toBeCloseTo(0.8, 1);
  });
  it('reduz o ruído preservando o sinal', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const n = SR * 2;
    const noisy = new Float32Array(n);
    const clean = sine(440, 0.5, 2);
    for (let i = 0; i < n; i++) noisy[i] = (i > SR ? clean[i]! : 0) + 0.05 * rnd();
    const out = spectralDenoise(noisy, 0.9);
    const rms = (a: Float32Array, s: number, e: number) => Math.sqrt(a.subarray(s, e).reduce((x, y) => x + y * y, 0) / (e - s));
    // Trecho só de ruído fica bem mais baixo.
    expect(rms(out, 2048, SR - 2048)).toBeLessThan(rms(noisy, 2048, SR - 2048) * 0.4);
    // Trecho com tom mantém a maior parte da energia.
    expect(rms(out, SR + 4096, n - 4096)).toBeGreaterThan(rms(clean, SR + 4096, n - 4096) * 0.8);
  });
});
