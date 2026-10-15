import { Button, Dialog, Field, NumberField, Select, Switch, TextInput } from '@framestudio/ui';
import { useSettings, type PreviewQuality, type Theme } from '../../services/settings.ts';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useSettings();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Configurações" description="Preferências salvas neste dispositivo." size="lg" footer={<Button onClick={() => onOpenChange(false)}>Fechar</Button>}>
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tema">
            <Select<Theme>
              value={s.theme}
              onChange={(theme) => s.set({ theme })}
              options={[
                { value: 'system', label: 'Seguir o sistema' },
                { value: 'dark', label: 'Escuro' },
                { value: 'light', label: 'Claro' },
              ]}
            />
          </Field>
          <Field label="Qualidade do preview" hint="Afeta só a visualização; a exportação usa sempre a resolução final.">
            <Select<PreviewQuality>
              value={s.previewQuality}
              onChange={(previewQuality) => s.set({ previewQuality })}
              options={[
                { value: 'high', label: 'Alta qualidade' },
                { value: 'balanced', label: 'Equilibrado' },
                { value: 'performance', label: 'Desempenho' },
              ]}
            />
          </Field>
          <Field label="Tamanho máximo por arquivo (GB)" hint="Limite de segurança para importação.">
            <NumberField value={s.maxFileSizeGb} onChange={(maxFileSizeGb) => s.set({ maxFileSizeGb })} min={0.1} max={64} step={0.5} suffix="GB" />
          </Field>
          <Field label="Modelo de transcrição (Whisper)" hint="Maior = mais preciso e mais lento. Baixado somente com seu consentimento.">
            <Select
              value={s.whisperModel}
              onChange={(whisperModel) => s.set({ whisperModel })}
              options={[
                { value: 'tiny', label: 'Tiny (~40 MB)' },
                { value: 'base', label: 'Base (~80 MB)' },
                { value: 'small', label: 'Small (~250 MB)' },
              ]}
            />
          </Field>
          <Field label="Servidor de modelos de IA" hint="Hugging Face por padrão. Pode apontar para um espelho próprio (mesma estrutura de pastas).">
            <TextInput value={s.modelHost} onChange={(e) => s.set({ modelHost: e.target.value })} />
          </Field>
        </section>
        <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <Switch checked={s.snapping} onChange={(snapping) => s.set({ snapping })} label="Snap magnético na timeline" />
          <Switch checked={s.useProxies} onChange={(useProxies) => s.set({ useProxies })} label="Usar proxies no preview quando disponíveis" />
          <Switch checked={s.showSafeArea} onChange={(showSafeArea) => s.set({ showSafeArea })} label="Mostrar área segura no preview" />
        </section>
        <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <div>
            <p className="text-sm font-medium text-fg">Provedor de IA opcional</p>
            <p className="mt-1 text-xs text-fg-muted">
              Usado apenas para interpretar comandos complexos do assistente e para tradução de legendas. O texto do comando (e das legendas, ao traduzir) é enviado ao provedor; seus vídeos nunca são enviados. Todas as funções básicas funcionam sem isso.
            </p>
          </div>
          <Switch checked={s.ai.enabled} onChange={(enabled) => s.set({ ai: { ...s.ai, enabled } })} label="Ativar provedor externo" />
          {s.ai.enabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <Select
                  value={s.ai.provider}
                  onChange={(provider) => s.set({ ai: { ...s.ai, provider, baseUrl: provider === 'anthropic' ? 'https://api.anthropic.com' : s.ai.baseUrl } })}
                  options={[
                    { value: 'anthropic', label: 'Anthropic (Claude)' },
                    { value: 'openai-compatible', label: 'Compatível com OpenAI (ex.: servidor local)' },
                  ]}
                />
              </Field>
              <Field label="Modelo">
                <TextInput value={s.ai.model} onChange={(e) => s.set({ ai: { ...s.ai, model: e.target.value } })} />
              </Field>
              <Field label="URL base">
                <TextInput value={s.ai.baseUrl} onChange={(e) => s.set({ ai: { ...s.ai, baseUrl: e.target.value } })} />
              </Field>
              <Field label="Chave de API" hint="Armazenada apenas neste navegador.">
                <TextInput type="password" value={s.ai.apiKey} onChange={(e) => s.set({ ai: { ...s.ai, apiKey: e.target.value } })} autoComplete="off" />
              </Field>
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}
