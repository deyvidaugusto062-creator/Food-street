import { applyEasing, createId, type AnimatableProp, type Clip, type Easing, type Keyframe } from '@framestudio/shared';

/** Interpola uma lista de keyframes (ordenada) num frame relativo ao clipe. */
export function evaluateKeyframes(kfs: readonly Keyframe[] | undefined, localFrame: number, fallback: number): number {
  if (!kfs || kfs.length === 0) return fallback;
  const first = kfs[0]!;
  if (localFrame <= first.frame) return first.value;
  const last = kfs[kfs.length - 1]!;
  if (localFrame >= last.frame) return last.value;
  // Busca binária pelo segmento.
  let lo = 0;
  let hi = kfs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (kfs[mid]!.frame <= localFrame) lo = mid;
    else hi = mid;
  }
  const a = kfs[lo]!;
  const b = kfs[hi]!;
  const span = b.frame - a.frame;
  if (span <= 0) return b.value;
  const p = applyEasing(a.easing, (localFrame - a.frame) / span);
  return a.value + (b.value - a.value) * p;
}

/** Valor de uma propriedade animável do clipe no frame ABSOLUTO da timeline. */
export function animatedValue(clip: Clip, prop: AnimatableProp, frame: number, base: number): number {
  return evaluateKeyframes(clip.keyframes[prop], frame - clip.start, base);
}

export function hasKeyframes(clip: Clip, prop: AnimatableProp): boolean {
  return (clip.keyframes[prop]?.length ?? 0) > 0;
}

/** Insere ou substitui o keyframe no frame local informado (mutação sobre draft). */
export function upsertKeyframe(clip: Clip, prop: AnimatableProp, localFrame: number, value: number, easing: Easing = 'ease-in-out'): Keyframe {
  const list = (clip.keyframes[prop] ??= []);
  const f = Math.max(0, Math.min(clip.duration - 1, Math.round(localFrame)));
  const existing = list.find((k) => k.frame === f);
  if (existing) {
    existing.value = value;
    return existing;
  }
  const kf: Keyframe = { id: createId('kf_'), frame: f, value, easing };
  list.push(kf);
  list.sort((a, b) => a.frame - b.frame);
  return kf;
}

export function removeKeyframe(clip: Clip, prop: AnimatableProp, keyframeId: string): void {
  const list = clip.keyframes[prop];
  if (!list) return;
  const i = list.findIndex((k) => k.id === keyframeId);
  if (i >= 0) list.splice(i, 1);
  if (list.length === 0) delete clip.keyframes[prop];
}

/**
 * Desloca os keyframes quando o início do clipe muda (trim de entrada / divisão).
 * `delta` positivo significa que o clipe passou a começar mais tarde dentro do conteúdo.
 * Keyframes fora de [0, duration) são descartados, mas o valor nas bordas é preservado
 * com um keyframe sintético para que a animação continue igual na parte restante.
 */
export function shiftKeyframes(clip: Clip, delta: number, newDuration: number): void {
  const lastLocal = newDuration - 1;
  for (const prop of Object.keys(clip.keyframes) as AnimatableProp[]) {
    const list = clip.keyframes[prop]!;
    if (list.length === 0) continue;
    const inside = list.filter((k) => k.frame >= delta && k.frame <= delta + lastLocal).map((k) => ({ ...k, frame: k.frame - delta }));
    const hasBefore = list.some((k) => k.frame < delta);
    const hasAfter = list.some((k) => k.frame > delta + lastLocal);
    if (hasBefore && !inside.some((k) => k.frame === 0)) {
      const prev = [...list].reverse().find((k) => k.frame < delta)!;
      inside.unshift({ id: createId('kf_'), frame: 0, value: evaluateKeyframes(list, delta, 0), easing: prev.easing });
    }
    if (hasAfter && !inside.some((k) => k.frame === lastLocal)) {
      inside.push({ id: createId('kf_'), frame: lastLocal, value: evaluateKeyframes(list, delta + lastLocal, 0), easing: 'linear' });
    }
    if (inside.length === 0) {
      // Todos os keyframes estavam fora: mantém o valor constante equivalente.
      inside.push({ id: createId('kf_'), frame: 0, value: evaluateKeyframes(list, delta, 0), easing: 'linear' });
    }
    clip.keyframes[prop] = inside;
  }
}

/** Reescala os keyframes quando a duração muda por alteração de velocidade. */
export function scaleKeyframes(clip: Clip, factor: number): void {
  for (const prop of Object.keys(clip.keyframes) as AnimatableProp[]) {
    const list = clip.keyframes[prop]!;
    for (const k of list) k.frame = Math.round(k.frame * factor);
  }
}
