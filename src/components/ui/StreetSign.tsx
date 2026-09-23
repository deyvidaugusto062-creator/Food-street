import { business } from '../../data/business';
import './StreetSign.css';

/**
 * Placa de rua no desenho das placas paulistanas, nas cores da casa.
 * Informação real: logradouro, número, bairro e CEP.
 */
export function StreetSign({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const { address } = business;
  return (
    <div className={`street-sign street-sign--${size}`} role="img" aria-label={`${address.street}, ${address.number}, ${address.neighborhood}, CEP ${address.postalCode}`}>
      <div className="street-sign__plate">
        <span className="street-sign__kind">R.</span>
        <span className="street-sign__name">Augusta</span>
        <span className="street-sign__number tnum">{address.number}</span>
      </div>
      <div className="street-sign__foot">
        <span>{address.neighborhood}</span>
        <span className="tnum">CEP {address.postalCode}</span>
      </div>
    </div>
  );
}
