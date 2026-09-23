import { formatBRL } from '../../utils/format';

export function Price({ value, className }: { value?: number; className?: string }) {
  if (value === undefined) return null;
  return <span className={`tnum ${className ?? ''}`.trim()}>{formatBRL(value)}</span>;
}
