/**
 * Assinatura provisória (wordmark). Substituir pelo logotipo oficial da Ótica Vetor
 * quando for fornecido — basta trocar este componente.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="10" cy="13" r="7.2" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="34" cy="13" r="7.2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M17.2 11.5c1.6-1.6 8-1.6 9.6 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M36 2.5h5.5V8" stroke="var(--logo-accent, var(--accent-300))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M41.5 2.5 37 7" stroke="var(--logo-accent, var(--accent-300))" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark className="logo__mark" />
      <span className="logo__word">
        Ótica <strong>Vetor</strong>
      </span>
    </span>
  );
}
