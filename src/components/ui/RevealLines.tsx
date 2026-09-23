import type { ReactNode } from 'react';

interface RevealLinesProps {
  as?: 'h1' | 'h2' | 'h3' | 'p';
  lines: ReactNode[];
  className?: string;
  id?: string;
}

/** Título dividido em linhas explícitas; o GSAP revela cada linha por máscara. */
export function RevealLines({ as: Tag = 'h2', lines, className, id }: RevealLinesProps) {
  return (
    <Tag className={className} id={id} data-reveal-lines="">
      {lines.map((line, i) => (
        <span className="line" key={i}>
          <span>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
