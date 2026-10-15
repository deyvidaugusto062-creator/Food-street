import { describe, expect, it } from 'vitest';
import { parseCubeLut } from './lut.ts';

describe('parseCubeLut', () => {
  it('lê um LUT identidade 2³', () => {
    const lines = ['TITLE "id"', 'LUT_3D_SIZE 2'];
    for (let b = 0; b < 2; b++) for (let g = 0; g < 2; g++) for (let r = 0; r < 2; r++) lines.push(`${r} ${g} ${b}`);
    const lut = parseCubeLut(lines.join('\n'), 'id');
    expect(lut.size).toBe(2);
    expect(lut.data.slice(0, 6)).toEqual([0, 0, 0, 1, 0, 0]);
  });
  it('rejeita contagem errada', () => {
    expect(() => parseCubeLut('LUT_3D_SIZE 2\n0 0 0')).toThrow();
  });
});
