/**
 * Análise de áudio pura (sem Web Audio): formas de onda, envelope RMS, detecção de silêncio,
 * loudness integrado (ITU-R BS.1770-4) e redução de ruído por gating espectral.
 */

export interface PcmData {
  sampleRate: number;
  channels: Float32Array[];
}

export function fromAudioBuffer(b: AudioBuffer): PcmData {
  const channels: Float32Array[] = [];
  for (let c = 0; c < b.numberOfChannels; c++) channels.push(b.getChannelData(c));
  return { sampleRate: b.sampleRate, channels };
}

export function toMono(pcm: PcmData): Float32Array {
  const n = pcm.channels[0]?.length ?? 0;
  if (pcm.channels.length === 1) return pcm.channels[0]!;
  const out = new Float32Array(n);
  const k = 1 / pcm.channels.length;
  for (const ch of pcm.channels) for (let i = 0; i < n; i++) out[i]! += ch[i]! * k;
  return out;
}

/** Picos (min/max) por bloco: `buckets` pares intercalados [min0,max0,min1,max1,...]. */
export function computePeaks(pcm: PcmData, buckets: number): Float32Array {
  const mono = toMono(pcm);
  const out = new Float32Array(buckets * 2);
  const per = mono.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const s = Math.floor(b * per);
    const e = Math.min(mono.length, Math.max(s + 1, Math.floor((b + 1) * per)));
    let mn = 0;
    let mx = 0;
    for (let i = s; i < e; i++) {
      const v = mono[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    out[b * 2] = mn;
    out[b * 2 + 1] = mx;
  }
  return out;
}

export function toDb(v: number): number {
  return v <= 1e-10 ? -200 : 20 * Math.log10(v);
}
export function fromDb(db: number): number {
  return Math.pow(10, db / 20);
}

/** Envelope RMS em dBFS com janelas de `windowSec`. */
export function rmsEnvelope(pcm: PcmData, windowSec = 0.02): { times: Float32Array; db: Float32Array; windowSec: number } {
  const mono = toMono(pcm);
  const win = Math.max(1, Math.round(pcm.sampleRate * windowSec));
  const n = Math.ceil(mono.length / win);
  const db = new Float32Array(n);
  const times = new Float32Array(n);
  for (let w = 0; w < n; w++) {
    let sum = 0;
    const s = w * win;
    const e = Math.min(mono.length, s + win);
    for (let i = s; i < e; i++) sum += mono[i]! * mono[i]!;
    db[w] = toDb(Math.sqrt(sum / Math.max(1, e - s)));
    times[w] = s / pcm.sampleRate;
  }
  return { times, db, windowSec: win / pcm.sampleRate };
}

export interface SilenceOptions {
  /** Abaixo deste nível (dBFS) é silêncio. Use 'auto' para estimar pelo ruído de fundo. */
  thresholdDb: number | 'auto';
  /** Duração mínima de um silêncio para ser considerado (s). */
  minSilence: number;
  /** Margem preservada antes/depois da fala (s). */
  padding: number;
}

export interface Interval {
  start: number;
  end: number;
}

/** Estima o limiar: piso de ruído (percentil 10) + 12 dB, limitado a [-60, -25]. */
export function estimateSilenceThreshold(db: Float32Array): number {
  const finite = Array.from(db).filter((v) => v > -150).sort((a, b) => a - b);
  if (finite.length === 0) return -50;
  const floor = finite[Math.floor(finite.length * 0.1)]!;
  return Math.max(-60, Math.min(-25, floor + 12));
}

/** Detecta intervalos de silêncio (em segundos relativos ao início do áudio). */
export function detectSilences(pcm: PcmData, opts: SilenceOptions): { silences: Interval[]; thresholdDb: number } {
  const env = rmsEnvelope(pcm, 0.02);
  const threshold = opts.thresholdDb === 'auto' ? estimateSilenceThreshold(env.db) : opts.thresholdDb;
  const total = (pcm.channels[0]?.length ?? 0) / pcm.sampleRate;
  const raw: Interval[] = [];
  let runStart = -1;
  for (let i = 0; i < env.db.length; i++) {
    const silent = env.db[i]! < threshold;
    if (silent && runStart < 0) runStart = env.times[i]!;
    if (!silent && runStart >= 0) {
      raw.push({ start: runStart, end: env.times[i]! });
      runStart = -1;
    }
  }
  if (runStart >= 0) raw.push({ start: runStart, end: total });
  const silences: Interval[] = [];
  for (const r of raw) {
    // A margem só é aplicada do lado onde há fala.
    const start = r.start <= 0 ? 0 : r.start + opts.padding;
    const end = r.end >= total - 1e-6 ? total : r.end - opts.padding;
    if (end - start >= opts.minSilence) silences.push({ start, end });
  }
  return { silences, thresholdDb: threshold };
}

/** Intervalos com fala = complemento dos silêncios. */
export function invertIntervals(silences: Interval[], total: number): Interval[] {
  const out: Interval[] = [];
  let t = 0;
  for (const s of silences) {
    if (s.start > t) out.push({ start: t, end: s.start });
    t = Math.max(t, s.end);
  }
  if (t < total) out.push({ start: t, end: total });
  return out;
}

// ─────────────────────────── Loudness ───────────────────────────

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** Coeficientes do filtro K (BS.1770) para qualquer taxa (fórmulas de pré-distorção usadas por libebur128). */
function kWeighting(rate: number): [Biquad, Biquad] {
  // Estágio 1: high-shelf
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / rate);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Estágio 2: high-pass RLB
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / rate);
  a0 = 1 + K / Q + K * K;
  const hp: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, hp];
}

function filter(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = f.b0 * xi + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    y[i] = yi;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
  }
  return y;
}

/** Loudness integrado em LUFS (BS.1770-4, com gating absoluto e relativo). */
export function integratedLoudness(pcm: PcmData): number {
  const [shelf, hp] = kWeighting(pcm.sampleRate);
  const weighted = pcm.channels.slice(0, 2).map((ch) => filter(filter(ch, shelf), hp));
  const block = Math.round(0.4 * pcm.sampleRate);
  const step = Math.round(0.1 * pcm.sampleRate);
  const n = weighted[0]?.length ?? 0;
  const powers: number[] = [];
  for (let s = 0; s + block <= n; s += step) {
    let z = 0;
    for (const ch of weighted) {
      let sum = 0;
      for (let i = s; i < s + block; i++) sum += ch[i]! * ch[i]!;
      z += sum / block;
    }
    powers.push(z);
  }
  if (powers.length === 0) return -70;
  const lufs = (z: number) => -0.691 + 10 * Math.log10(Math.max(z, 1e-12));
  const abs = powers.filter((z) => lufs(z) > -70);
  if (abs.length === 0) return -70;
  const meanAbs = abs.reduce((a, b) => a + b, 0) / abs.length;
  const relGate = lufs(meanAbs) - 10;
  const rel = abs.filter((z) => lufs(z) > relGate);
  const mean = rel.reduce((a, b) => a + b, 0) / Math.max(1, rel.length);
  return lufs(mean);
}

export function peakDb(pcm: PcmData): number {
  let mx = 0;
  for (const ch of pcm.channels) for (let i = 0; i < ch.length; i++) mx = Math.max(mx, Math.abs(ch[i]!));
  return toDb(mx);
}

/** Ganho (dB) para atingir `targetLufs` sem ultrapassar `ceilingDb` de pico. */
export function normalizationGain(pcm: PcmData, targetLufs = -14, ceilingDb = -1): number {
  const l = integratedLoudness(pcm);
  if (l <= -69) return 0;
  const gain = targetLufs - l;
  const pk = peakDb(pcm);
  return Math.min(gain, ceilingDb - pk);
}

// ─────────────────────── Redução de ruído ────────────────────────

function fft(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k]!;
        const ai = im[i + k]!;
        const br = re[i + k + len / 2]! * cr - im[i + k + len / 2]! * ci;
        const bi = re[i + k + len / 2]! * ci + im[i + k + len / 2]! * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {
    re[i]! /= n;
    im[i]! /= n;
  }
}

/**
 * Redução de ruído por gating espectral (STFT 2048, hop 512, janela de Hann).
 * O perfil de ruído é estimado pelos 10% de quadros de menor energia. `amount` 0..1.
 */
export function spectralDenoise(input: Float32Array, amount: number): Float32Array {
  const N = 2048;
  const H = 512;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const frames = Math.max(1, Math.ceil((input.length - N) / H) + 1);
  const mags: Float64Array[] = [];
  const energies: number[] = [];
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < N; i++) re[i] = (input[f * H + i] ?? 0) * win[i]!;
    fft(re, im, false);
    const m = new Float64Array(N / 2 + 1);
    let e = 0;
    for (let k = 0; k <= N / 2; k++) {
      m[k] = Math.hypot(re[k]!, im[k]!);
      e += m[k]!;
    }
    mags.push(m);
    energies.push(e);
  }
  const order = energies.map((e, i) => [e, i] as const).sort((a, b) => a[0] - b[0]);
  const quiet = order.slice(0, Math.max(1, Math.floor(frames * 0.1))).map((x) => x[1]);
  const noise = new Float64Array(N / 2 + 1);
  for (const q of quiet) for (let k = 0; k <= N / 2; k++) noise[k]! += mags[q]![k]! / quiet.length;
  const out = new Float64Array(input.length + N);
  const norm = new Float64Array(input.length + N);
  const over = 1 + 1.5 * amount;
  const minGain = 1 - amount * 0.9;
  for (let f = 0; f < frames; f++) {
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < N; i++) re[i] = (input[f * H + i] ?? 0) * win[i]!;
    fft(re, im, false);
    for (let k = 0; k < N; k++) {
      const bin = k <= N / 2 ? k : N - k;
      const mag = mags[f]![bin]!;
      const gain = mag > 0 ? Math.max(minGain, (mag - over * noise[bin]!) / mag) : minGain;
      re[k]! *= gain;
      im[k]! *= gain;
    }
    fft(re, im, true);
    for (let i = 0; i < N; i++) {
      out[f * H + i]! += re[i]! * win[i]!;
      norm[f * H + i]! += win[i]! * win[i]!;
    }
  }
  const res = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) res[i] = norm[i]! > 1e-6 ? out[i]! / norm[i]! : 0;
  return res;
}
