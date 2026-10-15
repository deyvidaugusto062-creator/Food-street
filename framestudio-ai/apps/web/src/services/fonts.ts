import '@fontsource-variable/inter';
import '@fontsource-variable/montserrat';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/oswald';
import '@fontsource-variable/roboto-mono';
import '@fontsource/bebas-neue';
import '@fontsource/anton';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/800.css';
import '@fontsource/permanent-marker';

/** Fontes empacotadas com o app (todas com licença livre: OFL-1.1 / Apache-2.0). */
export const FONT_CATALOG: { label: string; family: string }[] = [
  { label: 'Inter', family: '"Inter Variable", Inter, sans-serif' },
  { label: 'Montserrat', family: '"Montserrat Variable", Montserrat, sans-serif' },
  { label: 'Poppins', family: 'Poppins, sans-serif' },
  { label: 'Oswald', family: '"Oswald Variable", Oswald, sans-serif' },
  { label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { label: 'Anton', family: 'Anton, sans-serif' },
  { label: 'Playfair Display', family: '"Playfair Display Variable", serif' },
  { label: 'Roboto Mono', family: '"Roboto Mono Variable", monospace' },
  { label: 'Permanent Marker', family: '"Permanent Marker", cursive' },
  { label: 'Sistema', family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
];

export function fontLabel(family: string): string {
  return FONT_CATALOG.find((f) => f.family === family)?.label ?? family.split(',')[0]!.replace(/"/g, '');
}
