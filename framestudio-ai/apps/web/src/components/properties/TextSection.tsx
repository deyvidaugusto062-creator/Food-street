import { useEffect, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react';
import { ColorInput, NumberField, Section, Select, Slider, Switch } from '@framestudio/ui';
import type { CaptionClip, TextAnimation, TextClip, TextStyle } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import { FONT_CATALOG } from '../../services/fonts.ts';
import { TEXT_PRESETS } from '../../services/presets.ts';
import { Row, Segmented } from './controls.tsx';

type TClip = TextClip | CaptionClip;

const upd = (clip: TClip, text: Record<string, unknown>, key: string) => useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { text } }, { coalesce: `text-${key}:${clip.id}` });

const ANIMS: { value: TextAnimation; label: string }[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Deslizar ↑' },
  { value: 'slide-down', label: 'Deslizar ↓' },
  { value: 'slide-left', label: 'Deslizar ←' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Máquina de escrever' },
  { value: 'blur-in', label: 'Desfoque' },
];

export function TextSection({ clip }: { clip: TClip }) {
  const s = clip.text;
  const fps = useEditor((st) => st.project!.settings.fps);
  const [content, setContent] = useState(s.content);
  useEffect(() => setContent(s.content), [s.content, clip.id]);
  const commitContent = () => content !== s.content && upd(clip, { content }, 'content');
  const fontOptions = FONT_CATALOG.some((f) => f.family === s.fontFamily) ? FONT_CATALOG : [{ label: s.fontFamily.split(',')[0]!.replace(/"/g, ''), family: s.fontFamily }, ...FONT_CATALOG];
  return (
    <>
      <Section title={clip.type === 'caption' ? 'Legenda' : 'Texto'}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={commitContent}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitContent();
          }}
          rows={3}
          className="w-full resize-y rounded-lg border border-line bg-bg-2 p-2 text-sm text-fg outline-none focus:border-accent"
          aria-label="Conteúdo do texto"
          data-testid="text-content"
        />
        {clip.type === 'text' && (
          <Select
            value=""
            onChange={(id) => {
              const p = TEXT_PRESETS.find((x) => x.id === id);
              if (p) upd(clip, { ...p.style, content: s.content }, 'preset');
            }}
            ariaLabel="Estilos de título"
            options={[{ value: '', label: 'Aplicar estilo de título…', disabled: true }, ...TEXT_PRESETS.map((p) => ({ value: p.id, label: p.label }))]}
          />
        )}
        <Select value={s.fontFamily} onChange={(fontFamily) => upd(clip, { fontFamily }, 'font')} ariaLabel="Fonte" options={fontOptions.map((f) => ({ value: f.family, label: <span style={{ fontFamily: f.family }}>{f.label}</span> }))} />
        <Row>
          <NumberField label="Tam." value={s.fontSize} min={4} max={1000} onChange={(fontSize) => upd(clip, { fontSize }, 'size')} suffix="px" />
          <Select
            value={String(s.fontWeight)}
            onChange={(v) => upd(clip, { fontWeight: Number(v) }, 'weight')}
            ariaLabel="Peso"
            className="h-8 text-xs"
            options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: { 300: 'Leve', 400: 'Regular', 500: 'Médio', 600: 'Semibold', 700: 'Negrito', 800: 'Extra', 900: 'Black' }[w]! }))}
          />
        </Row>
        <div className="flex items-center gap-2">
          <Segmented<TextStyle['align']>
            value={s.align}
            onChange={(align) => upd(clip, { align }, 'align')}
            options={[
              { value: 'left', label: <AlignLeft size={13} />, title: 'Esquerda' },
              { value: 'center', label: <AlignCenter size={13} />, title: 'Centro' },
              { value: 'right', label: <AlignRight size={13} />, title: 'Direita' },
            ]}
          />
          <button onClick={() => upd(clip, { italic: !s.italic }, 'italic')} aria-pressed={s.italic} className={`flex size-7 items-center justify-center rounded-md border ${s.italic ? 'border-accent text-fg' : 'border-line text-fg-muted'}`} aria-label="Itálico">
            <Italic size={13} />
          </button>
          <button onClick={() => upd(clip, { fontWeight: s.fontWeight >= 700 ? 400 : 700 }, 'bold')} aria-pressed={s.fontWeight >= 700} className={`flex size-7 items-center justify-center rounded-md border ${s.fontWeight >= 700 ? 'border-accent text-fg' : 'border-line text-fg-muted'}`} aria-label="Negrito">
            <Bold size={13} />
          </button>
        </div>
        <ColorInput label="Cor" value={s.color} onChange={(color) => upd(clip, { color }, 'color')} />
        <Row>
          <NumberField label="Linha" value={s.lineHeight} min={0.5} max={4} step={0.05} precision={2} onChange={(lineHeight) => upd(clip, { lineHeight }, 'lh')} />
          <NumberField label="Espaço" value={s.letterSpacing} min={-50} max={200} step={0.5} onChange={(letterSpacing) => upd(clip, { letterSpacing }, 'ls')} suffix="px" />
        </Row>
        <NumberField label="Largura máx." value={s.boxWidth} min={0} max={20000} step={10} onChange={(boxWidth) => upd(clip, { boxWidth }, 'bw')} suffix="px" />
        <p className="-mt-1 text-[10px] text-fg-subtle">0 = sem quebra automática de linha. Clique duplo no preview para editar o texto no lugar.</p>
      </Section>
      {clip.type === 'caption' && (
        <Section title="Destaque de palavras">
          <Switch checked={clip.caption.highlightWords} onChange={(highlightWords) => useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { caption: { highlightWords } } })} label="Destacar palavra falada" />
          <Switch checked={clip.caption.wordByWord} onChange={(wordByWord) => useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { caption: { wordByWord } } })} label="Uma palavra por vez" />
          <ColorInput label="Cor do destaque" value={clip.caption.highlightColor} onChange={(highlightColor) => useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { caption: { highlightColor } } }, { coalesce: `hc:${clip.id}` })} />
          {clip.words.length === 0 && <p className="text-[10px] text-fg-subtle">Sem tempos por palavra: gere legendas pelo AI Studio para usar o destaque.</p>}
        </Section>
      )}
      <Section title="Contorno, sombra e fundo" defaultOpen={false}>
        <Switch checked={s.stroke.enabled} onChange={(enabled) => upd(clip, { stroke: { enabled } }, 'stroke-on')} label="Contorno" />
        {s.stroke.enabled && (
          <Row>
            <ColorInput value={s.stroke.color} onChange={(color) => upd(clip, { stroke: { color } }, 'stroke-c')} />
            <NumberField label="Esp." value={s.stroke.width} min={0} max={100} onChange={(width) => upd(clip, { stroke: { width } }, 'stroke-w')} suffix="px" />
          </Row>
        )}
        <Switch checked={s.shadow.enabled} onChange={(enabled) => upd(clip, { shadow: { enabled } }, 'shadow-on')} label="Sombra" />
        {s.shadow.enabled && (
          <>
            <ColorInput value={s.shadow.color} onChange={(color) => upd(clip, { shadow: { color } }, 'shadow-c')} />
            <Row cols={3}>
              <NumberField label="Desf." value={s.shadow.blur} min={0} max={200} onChange={(blur) => upd(clip, { shadow: { blur } }, 'shadow-b')} />
              <NumberField label="X" value={s.shadow.x} min={-200} max={200} onChange={(x) => upd(clip, { shadow: { x } }, 'shadow-x')} />
              <NumberField label="Y" value={s.shadow.y} min={-200} max={200} onChange={(y) => upd(clip, { shadow: { y } }, 'shadow-y')} />
            </Row>
          </>
        )}
        <Switch checked={s.background.enabled} onChange={(enabled) => upd(clip, { background: { enabled } }, 'bg-on')} label="Fundo" />
        {s.background.enabled && (
          <>
            <ColorInput value={s.background.color} onChange={(color) => upd(clip, { background: { color } }, 'bg-c')} />
            <Row>
              <NumberField label="Margem" value={s.background.padding} min={0} max={400} onChange={(padding) => upd(clip, { background: { padding } }, 'bg-p')} />
              <NumberField label="Raio" value={s.background.radius} min={0} max={400} onChange={(radius) => upd(clip, { background: { radius } }, 'bg-r')} />
            </Row>
          </>
        )}
      </Section>
      <Section title="Animação de entrada e saída">
        <Row>
          <Select<TextAnimation> value={s.animationIn} onChange={(animationIn) => upd(clip, { animationIn }, 'ain')} ariaLabel="Entrada" options={ANIMS} className="h-8 text-xs" />
          <Select<TextAnimation> value={s.animationOut} onChange={(animationOut) => upd(clip, { animationOut }, 'aout')} ariaLabel="Saída" options={ANIMS} className="h-8 text-xs" />
        </Row>
        <Slider label="Duração" value={s.animationDuration} min={1} max={Math.max(2, Math.floor(clip.duration / 2))} step={1} onChange={(animationDuration) => upd(clip, { animationDuration }, 'adur')} format={(v) => `${(v / fps).toFixed(2)} s`} onCommit={() => useEditor.getState().seal()} />
      </Section>
    </>
  );
}
