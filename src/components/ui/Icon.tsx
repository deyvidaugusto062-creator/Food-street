import type { SVGProps } from 'react';

/** Ícones lineares desenhados para o site (traço 1.5, cor herdada). */
const paths = {
  arrowRight: <path d="M4 12h15m-5-5 5 5-5 5" />,
  arrowLeft: <path d="M20 12H5m5-5-5 5 5 5" />,
  arrowUpRight: <path d="M7 17 17 7M9 7h8v8" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  phone: (
    <path d="M6.6 3.5h2.6l1.4 4.1-1.9 1.3a11 11 0 0 0 6.4 6.4l1.3-1.9 4.1 1.4v2.6a2 2 0 0 1-2.2 2A16.4 16.4 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  menu: <path d="M4 8h16M4 16h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  burger: (
    <>
      <path d="M4.5 10.5a7.5 5 0 0 1 15 0Z" />
      <path d="M4 13.5h16" />
      <path d="M5 16.5c1.3 0 1.3.8 2.6.8s1.3-.8 2.6-.8 1.3.8 2.6.8 1.3-.8 2.6-.8 1.3.8 2.6.8" />
      <path d="M5 19.5h14" />
    </>
  ),
  glass: (
    <>
      <path d="M6 5h12l-1.4 13.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8Z" />
      <path d="M6.6 10.5h10.8" />
      <path d="M14.5 5 17 2.5" />
    </>
  ),
  street: (
    <>
      <path d="M8 21 10 3M16 21 14 3" />
      <path d="M12 5v2M12 11v2M12 17v2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 14.3A4.5 4.5 0 0 1 20.5 18.5" />
    </>
  ),
  star: <path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7Z" />,
  whatsapp: (
    <>
      <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.2 18.6Z" />
      <path d="M9.2 8.8c.2 2.8 2.3 5 5.2 5.6l1.1-1.2-1.7-.9-.8.8a4 4 0 0 1-2.1-2.1l.8-.8-.9-1.7Z" />
    </>
  ),
  drag: <path d="M8 9 5 12l3 3M16 9l3 3-3 3M5 12h14" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
