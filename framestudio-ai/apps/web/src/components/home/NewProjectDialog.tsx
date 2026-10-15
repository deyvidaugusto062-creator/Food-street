import { useMemo, useState } from 'react';
import { ASPECT_PRESETS, FPS_OPTIONS, createProject, evenize, type Project } from '@framestudio/shared';
import { Button, ColorInput, Dialog, Field, NumberField, Select, TextInput, cx } from '@framestudio/ui';
import { OpfsBlobStore } from '@framestudio/project-storage';

const SIZES = [
  { id: '720', label: 'HD (720p)', short: 720 },
  { id: '1080', label: 'Full HD (1080p)', short: 1080 },
  { id: '1440', label: '2K (1440p)', short: 1440 },
  { id: '2160', label: '4K (2160p)', short: 2160 },
];

export function NewProjectDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (p: Project) => void }) {
  const [name, setName] = useState('Meu projeto');
  const [preset, setPreset] = useState('16:9');
  const [size, setSize] = useState('1080');
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [fps, setFps] = useState(30);
  const [bg, setBg] = useState('#000000');

  const dims = useMemo(() => {
    if (preset === 'custom') return { width: evenize(customW), height: evenize(customH) };
    const p = ASPECT_PRESETS.find((x) => x.id === preset)!;
    const short = SIZES.find((s) => s.id === size)!.short;
    const k = short / Math.min(p.width, p.height);
    return { width: evenize(p.width * k), height: evenize(p.height * k) };
  }, [preset, size, customW, customH]);

  const storage = OpfsBlobStore.isSupported() ? 'Armazenamento privado do navegador (OPFS)' : 'Banco de dados local do navegador (IndexedDB)';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Novo projeto"
      description="Defina formato, resolução e taxa de quadros. Tudo pode ser alterado depois."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            data-testid="create-project"
            onClick={() => onCreate(createProject({ name, width: dims.width, height: dims.height, fps, background: bg }))}
          >
            Criar projeto
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Nome" htmlFor="np-name">
          <TextInput id="np-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
        </Field>
        <div>
          <p className="mb-2 text-xs font-medium text-fg-muted">Formato</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[...ASPECT_PRESETS, { id: 'custom', label: 'Personalizado', description: 'Livre', width: 4, height: 3 }].map((p) => {
              const ar = p.width / p.height;
              return (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  aria-pressed={preset === p.id}
                  className={cx(
                    'flex flex-col items-center gap-2 rounded-xl border p-2.5 text-center transition-colors',
                    preset === p.id ? 'border-accent bg-accent/10' : 'border-line hover:border-fg-subtle',
                  )}
                >
                  <div className="flex h-12 items-center justify-center">
                    <div className={cx('rounded-[3px] border-2', preset === p.id ? 'border-accent' : 'border-fg-subtle', p.id === 'custom' && 'border-dashed')} style={{ width: ar >= 1 ? 40 : 40 * ar, height: ar >= 1 ? 40 / ar : 40 }} />
                  </div>
                  <span className="text-[11px] font-medium leading-tight text-fg">{p.id === 'custom' ? 'Livre' : p.id}</span>
                  <span className="text-[10px] leading-tight text-fg-subtle">{p.description}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {preset === 'custom' ? (
            <Field label="Resolução (px)">
              <div className="flex items-center gap-2">
                <NumberField value={customW} onChange={setCustomW} min={16} max={7680} label="L" />
                <NumberField value={customH} onChange={setCustomH} min={16} max={4320} label="A" />
              </div>
            </Field>
          ) : (
            <Field label="Resolução">
              <Select value={size} onChange={setSize} ariaLabel="Resolução" options={SIZES.map((s) => ({ value: s.id, label: s.label }))} />
            </Field>
          )}
          <Field label="Taxa de quadros">
            <Select value={String(fps)} onChange={(v) => setFps(Number(v))} ariaLabel="FPS" options={FPS_OPTIONS.map((f) => ({ value: String(f), label: `${f} fps` }))} />
          </Field>
          <Field label="Cor de fundo">
            <ColorInput value={bg} onChange={setBg} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg-2 px-4 py-3 text-xs">
          <span className="text-fg-muted">
            Saída: <span className="font-medium text-fg">{dims.width} × {dims.height}</span> · {fps} fps
          </span>
          <span className="text-fg-subtle" title="No app desktop será possível escolher uma pasta do sistema.">
            Local: {storage}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
