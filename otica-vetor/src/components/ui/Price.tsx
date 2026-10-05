import { formatPrice } from '../../utils/format';

export function Price({ value, demo, className }: { value: number | null; demo?: boolean; className?: string }) {
  if (value === null) return <span className={`price price--ask ${className ?? ''}`}>Preço sob consulta</span>;
  return (
    <span className={`price ${className ?? ''}`}>
      <span className="price__value">{formatPrice(value)}</span>
      {demo && <span className="price__note">Preço ilustrativo</span>}
    </span>
  );
}
