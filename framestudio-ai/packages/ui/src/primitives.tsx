import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Dialog as RDialog, Slider as RSlider, Switch as RSwitch, Tooltip as RTooltip, Select as RSelect, Tabs as RTabs, Progress as RProgress } from 'radix-ui';
import { Check, ChevronDown, X } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ───────────────────────────── Botões ─────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

const variantCls: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset] disabled:bg-accent/40',
  secondary: 'bg-panel-2 text-fg hover:bg-panel-3 border border-line',
  ghost: 'text-fg-muted hover:text-fg hover:bg-panel-2',
  danger: 'bg-danger/90 text-white hover:bg-danger',
  outline: 'border border-line text-fg hover:border-accent hover:text-fg',
};
const sizeCls: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px',
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: boolean;
  shortcut?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, active, size = 'md', className, children, tooltip = true, shortcut, ...rest }, ref) {
  const btn = (
    <button
      ref={ref}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center justify-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-40 disabled:cursor-not-allowed shrink-0',
        size === 'sm' ? 'size-7' : size === 'lg' ? 'size-11' : 'size-9',
        active ? 'bg-accent/20 text-accent-soft' : 'text-fg-muted hover:text-fg hover:bg-panel-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
  if (!tooltip) return btn;
  return <Tooltip content={shortcut ? `${label} (${shortcut})` : label}>{btn}</Tooltip>;
});

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex min-w-5 h-5 items-center justify-center rounded border border-line bg-panel-2 px-1 font-mono text-[10px] text-fg-muted">{children}</kbd>;
}

// ───────────────────────────── Tooltip ────────────────────────────

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={450} skipDelayDuration={150}>
      {children}
    </RTooltip.Provider>
  );
}

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="fs-pop z-[100] rounded-md bg-panel-3 px-2 py-1 text-xs text-fg shadow-lg border border-line">
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

// ───────────────────────────── Campos ─────────────────────────────

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        'h-9 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25',
        className,
      )}
      {...rest}
    />
  );
});

export function Field({ label, children, hint, htmlFor }: { label: ReactNode; children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

/** Número com arraste horizontal no rótulo e edição direta. */
export function NumberField({
  value,
  onChange,
  onCommit,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision,
  suffix,
  label,
  className,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  suffix?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const digits = precision ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
  const [text, setText] = useState(value.toFixed(digits));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(Number.isFinite(value) ? value.toFixed(digits) : '');
  }, [value, digits]);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(v)) onChange(clamp(v));
    else setText(value.toFixed(digits));
    onCommit?.();
  };
  const onDrag = (e: React.PointerEvent) => {
    if (disabled) return;
    const startX = e.clientX;
    const start = value;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      onChange(clamp(Number((start + Math.round(dx / 2) * step * mult).toFixed(digits + 1))));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      onCommit?.();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  return (
    <div className={cx('flex h-8 min-w-0 items-center rounded-md border border-line bg-bg-2 text-xs focus-within:border-accent', disabled && 'opacity-50', className)}>
      {label && (
        <span onPointerDown={onDrag} className="cursor-ew-resize select-none px-2 text-fg-subtle touch-none" title="Arraste para ajustar">
          {label}
        </span>
      )}
      <input
        className="w-0 min-w-0 flex-1 bg-transparent px-2 text-right tabular-nums text-fg outline-none"
        value={text}
        inputMode="decimal"
        disabled={disabled}
        aria-label={label}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(clamp(Number((value + d).toFixed(digits + 2))));
          }
        }}
      />
      {suffix && <span className="pr-2 text-fg-subtle">{suffix}</span>}
    </div>
  );
}

export function Slider({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  format,
  defaultValue,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  label?: ReactNode;
  format?: (v: number) => string;
  defaultValue?: number;
  disabled?: boolean;
}) {
  return (
    <div className={cx('flex flex-col gap-1', disabled && 'opacity-50')}>
      {label !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span
            className="text-fg-muted"
            onDoubleClick={() => {
              if (defaultValue !== undefined) {
                onChange(defaultValue);
                onCommit?.();
              }
            }}
            title={defaultValue !== undefined ? 'Clique duplo para restaurar' : undefined}
          >
            {label}
          </span>
          <span className="tabular-nums text-fg-subtle">{format ? format(value) : value.toFixed(step >= 1 ? 0 : 2)}</span>
        </div>
      )}
      <RSlider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0]!)}
        onValueCommit={() => onCommit?.()}
      >
        <RSlider.Track className="relative h-1 grow overflow-hidden rounded-full bg-panel-3">
          <RSlider.Range className="absolute h-full bg-accent" />
        </RSlider.Track>
        <RSlider.Thumb
          aria-label={typeof label === 'string' ? label : undefined}
          className="block size-3.5 rounded-full border-2 border-accent bg-fg shadow transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
        />
      </RSlider.Root>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('flex cursor-pointer items-center justify-between gap-3 text-xs text-fg-muted', disabled && 'opacity-50 cursor-not-allowed')}>
      {label}
      <RSwitch.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="relative h-5 w-9 shrink-0 rounded-full bg-panel-3 transition-colors data-[state=checked]:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <RSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </RSwitch.Root>
    </label>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <RSelect.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RSelect.Trigger
        aria-label={ariaLabel}
        className={cx(
          'inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg outline-none focus:border-accent data-[disabled]:opacity-50',
          className,
        )}
      >
        <RSelect.Value />
        <RSelect.Icon>
          <ChevronDown size={14} className="text-fg-subtle" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content position="popper" sideOffset={4} className="fs-pop z-[120] max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-panel-2 shadow-xl">
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex h-8 cursor-pointer select-none items-center rounded-md pl-7 pr-3 text-sm text-fg outline-none data-[highlighted]:bg-accent/20 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
              >
                <RSelect.ItemIndicator className="absolute left-2">
                  <Check size={14} />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : rgbaToHex(value);
  return (
    <label className="flex h-8 items-center gap-2 rounded-md border border-line bg-bg-2 px-2 text-xs text-fg-muted">
      <span className="relative size-5 overflow-hidden rounded border border-line" style={{ background: value }}>
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label ?? 'Cor'} />
      </span>
      <span className="font-mono text-fg">{hex.toUpperCase()}</span>
      {label && <span className="ml-auto">{label}</span>}
    </label>
  );
}

function rgbaToHex(v: string): string {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(v);
  if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

// ───────────────────────────── Diálogo ────────────────────────────

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const w = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : size === 'xl' ? 'max-w-4xl' : 'max-w-lg';
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fs-fade fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px]" />
        <RDialog.Content
          className={cx(
            'fs-dialog fixed left-1/2 top-1/2 z-[91] flex max-h-[92dvh] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-line bg-panel shadow-2xl outline-none',
            w,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <RDialog.Title className="text-base font-semibold text-fg">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-xs text-fg-muted">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
            </div>
            <RDialog.Close asChild>
              <IconButton label="Fechar" size="sm" tooltip={false}>
                <X size={16} />
              </IconButton>
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

// ───────────────────────────── Abas ───────────────────────────────

export const Tabs = RTabs.Root;
export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <RTabs.List className={cx('flex gap-1', className)}>{children}</RTabs.List>;
}
export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RTabs.Trigger
      value={value}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg data-[state=active]:bg-panel-3 data-[state=active]:text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        className,
      )}
    >
      {children}
    </RTabs.Trigger>
  );
}
export const TabsContent = RTabs.Content;

// ───────────────────────────── Progresso ──────────────────────────

export function ProgressBar({ value, className, indeterminate }: { value: number; className?: string; indeterminate?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <RProgress.Root value={indeterminate ? null : pct} className={cx('relative h-1.5 w-full overflow-hidden rounded-full bg-panel-3', className)}>
      <RProgress.Indicator
        className={cx('h-full rounded-full bg-gradient-to-r from-accent to-blue transition-[width] duration-200', indeterminate && 'fs-indeterminate w-1/3')}
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </RProgress.Root>
  );
}

// ───────────────────────────── Seção ──────────────────────────────

export function Section({ title, children, actions, defaultOpen = true }: { title: ReactNode; children: ReactNode; actions?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex items-center gap-2 px-3 py-2">
        <button className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted hover:text-fg" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronDown size={12} className={cx('transition-transform', !open && '-rotate-90')} />
          {title}
        </button>
        {actions}
      </div>
      {open && <div className="flex flex-col gap-3 px-3 pb-3">{children}</div>}
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="text-fg-subtle">{icon}</div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="text-xs text-fg-muted">{children}</div>}
    </div>
  );
}
