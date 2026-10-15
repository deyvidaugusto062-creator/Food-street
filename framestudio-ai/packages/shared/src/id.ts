/** Gera identificadores únicos curtos e ordenáveis por tempo de criação. */
let counter = 0;
export function createId(prefix = ''): string {
  counter = (counter + 1) % 0x10000;
  const time = Date.now().toString(36);
  const rand =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${time}${counter.toString(36).padStart(3, '0')}${rand}`;
}
