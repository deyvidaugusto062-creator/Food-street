import { current, isDraft } from 'immer';

/** Cópia profunda que funciona tanto com objetos comuns quanto com rascunhos do immer. */
export function deepClone<T>(v: T): T {
  return structuredClone(isDraft(v) ? (current(v as never) as T) : v);
}
