export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="fs-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8257FF" />
          <stop offset="1" stopColor="#4F8CFF" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#fs-logo-g)" />
      <path d="M22 18h22v7H30v6h11v7H30v10h-8z" fill="#fff" />
      <circle cx="46" cy="45" r="4" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <LogoMark />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-fg">
          FrameStudio <span className="bg-gradient-to-r from-accent to-blue bg-clip-text text-transparent">AI</span>
        </span>
      )}
    </div>
  );
}
