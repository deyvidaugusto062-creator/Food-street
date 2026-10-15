import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { Button, Section, Select, Slider, Switch, toast } from '@framestudio/ui';
import { fromAudioBuffer, normalizationGain, type PcmData } from '@framestudio/audio-engine';
import { errorMessage, type AudioClip, type VideoClip } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import { audioStore } from '../../services/media.ts';
import { AnimSlider, Row, db, pct, secs } from './controls.tsx';

type AClip = AudioClip | VideoClip;

const upd = (clip: AClip, audio: Record<string, unknown>, key: string) => useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { audio } }, { coalesce: `audio-${key}:${clip.id}` });

/** Recorta o trecho do clipe no buffer decodificado. */
function clipPcm(buf: AudioBuffer, clip: AClip, fps: number): PcmData {
  const full = fromAudioBuffer(buf);
  const s = Math.floor(clip.sourceIn * buf.sampleRate);
  const e = Math.min(buf.length, Math.ceil((clip.sourceIn + (clip.duration / fps) * clip.speed) * buf.sampleRate));
  return { sampleRate: buf.sampleRate, channels: full.channels.map((c) => c.subarray(s, e)) };
}

export function AudioSection({ clip }: { clip: AClip }) {
  const fps = useEditor((s) => s.project!.settings.fps);
  const hasAudio = useEditor((s) => (clip.type === 'audio' ? true : !!s.project!.assets[clip.assetId]?.hasAudio));
  const [busy, setBusy] = useState(false);
  const a = clip.audio;
  const maxFade = clip.duration / fps / 2;
  if (!hasAudio) return <Section title="Áudio"><p className="text-[11px] text-fg-subtle">Este vídeo não possui faixa de áudio.</p></Section>;

  const normalize = async () => {
    setBusy(true);
    try {
      const buf = await audioStore.get(clip.assetId);
      if (!buf) throw new Error('Não foi possível decodificar o áudio.');
      const gain = normalizationGain(clipPcm(buf, clip, fps), -14, -1);
      upd(clip, { normalizeGainDb: Math.round(gain * 10) / 10 }, 'norm');
      toast({ kind: 'success', title: 'Áudio normalizado', description: `Ganho aplicado: ${db(gain)} (alvo −14 LUFS, pico −1 dBFS).` });
    } catch (e) {
      toast({ kind: 'error', title: 'Falha na normalização', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="Áudio">
        <Switch checked={!a.muted} onChange={(on) => upd(clip, { muted: !on }, 'mute')} label="Som ativado" />
        <AnimSlider clip={clip} prop="volume" label="Volume" min={0} max={4} format={(v) => (v <= 0 ? '−∞ dB' : db(20 * Math.log10(v)))} defaultValue={1} />
        <Row>
          <Slider label="Fade in" value={a.fadeIn} min={0} max={Math.max(0.1, maxFade)} onChange={(v) => upd(clip, { fadeIn: v }, 'fi')} format={secs} onCommit={() => useEditor.getState().seal()} defaultValue={0} />
          <Slider label="Fade out" value={a.fadeOut} min={0} max={Math.max(0.1, maxFade)} onChange={(v) => upd(clip, { fadeOut: v }, 'fo')} format={secs} onCommit={() => useEditor.getState().seal()} defaultValue={0} />
        </Row>
        <Slider label="Pan (esq. ↔ dir.)" value={a.pan} min={-1} max={1} onChange={(v) => upd(clip, { pan: v }, 'pan')} format={(v) => (Math.abs(v) < 0.01 ? 'Centro' : v < 0 ? `E ${pct(-v)}` : `D ${pct(v)}`)} defaultValue={0} />
        <Select
          value={a.channelMode ?? 'stereo'}
          onChange={(channelMode) => upd(clip, { channelMode }, 'ch')}
          ariaLabel="Canais"
          options={[
            { value: 'stereo', label: 'Estéreo' },
            { value: 'mono', label: 'Mono (soma)' },
            { value: 'left', label: 'Somente canal esquerdo' },
            { value: 'right', label: 'Somente canal direito' },
          ]}
        />
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" icon={<Gauge size={13} />} loading={busy} onClick={() => void normalize()}>
            Normalizar (LUFS)
          </Button>
          {a.normalizeGainDb !== undefined && (
            <button className="text-[11px] text-fg-subtle hover:text-fg" onClick={() => upd(clip, { normalizeGainDb: undefined }, 'norm-x')}>
              {db(a.normalizeGainDb)} · remover
            </button>
          )}
        </div>
      </Section>
      <Section title="Equalizador" defaultOpen={false}>
        {(['low', 'mid', 'high'] as const).map((band) => (
          <Slider
            key={band}
            label={{ low: 'Graves (200 Hz)', mid: 'Médios (1 kHz)', high: 'Agudos (4 kHz)' }[band]}
            value={a.eq?.[band] ?? 0}
            min={-18}
            max={18}
            step={0.5}
            format={db}
            defaultValue={0}
            onChange={(v) => upd(clip, { eq: { low: 0, mid: 0, high: 0, ...a.eq, [band]: v } }, `eq-${band}`)}
            onCommit={() => useEditor.getState().seal()}
          />
        ))}
      </Section>
      <Section title="Dinâmica" defaultOpen={false}>
        <Switch checked={!!a.compressor?.enabled} onChange={(enabled) => upd(clip, { compressor: { threshold: -24, ratio: 4, attack: 0.01, release: 0.25, ...a.compressor, enabled } }, 'comp')} label="Compressor" />
        {a.compressor?.enabled && (
          <>
            <Slider label="Limiar" value={a.compressor.threshold} min={-60} max={0} step={1} format={(v) => `${v} dB`} onChange={(threshold) => upd(clip, { compressor: { ...a.compressor, threshold } }, 'comp-t')} />
            <Slider label="Razão" value={a.compressor.ratio} min={1} max={20} step={0.5} format={(v) => `${v}:1`} onChange={(ratio) => upd(clip, { compressor: { ...a.compressor, ratio } }, 'comp-r')} />
            <p className="text-[10px] text-fg-subtle">Com razão alta (≥ 12:1) e limiar perto de 0 dB funciona como limiter.</p>
          </>
        )}
        <Switch checked={!!a.noiseReduction?.enabled} onChange={(enabled) => upd(clip, { noiseReduction: { amount: 0.6, ...a.noiseReduction, enabled } }, 'nr')} label="Redução de ruído (espectral)" />
        {a.noiseReduction?.enabled && (
          <>
            <Slider label="Intensidade" value={a.noiseReduction.amount} min={0.05} max={1} format={pct} onChange={(amount) => upd(clip, { noiseReduction: { ...a.noiseReduction, amount } }, 'nr-a')} onCommit={() => useEditor.getState().seal()} />
            <p className="text-[10px] text-fg-subtle">Estima o perfil de ruído pelos trechos mais silenciosos. O processamento roda localmente e pode levar alguns segundos em áudios longos.</p>
          </>
        )}
      </Section>
    </>
  );
}
