import { useConfirm } from '../components/confirm';
import { PageShell, Section, Toggle } from '../components/layout';
import { RulesFields } from '../components/RulesFields';
import { Button } from '../components/ui';
import { sounds } from '../lib/sound';
import { store, useHistory, useSettings } from '../state/store';

export function SettingsScreen() {
  const settings = useSettings();
  const history = useHistory();
  const confirm = useConfirm();

  return (
    <PageShell title="Configurações">
      <div className="flex flex-col gap-5">
        <Section title="Regras padrão" description="Usadas como ponto de partida em cada nova partida. Podem ser ajustadas na configuração do jogo.">
          <RulesFields value={settings.rules} onChange={(rules) => store.updateSettings({ rules })} />
        </Section>

        <Section title="Sons">
          <div className="divide-y divide-line">
            <Toggle
              checked={settings.sounds.point}
              onChange={(v) => {
                store.updateSettings({ sounds: { ...settings.sounds, point: v } });
                if (v) sounds.point();
              }}
              label="Pontos e tempos técnicos"
              description="Bipe curto a cada ponto e sinal duplo no tempo técnico."
            />
            <Toggle
              checked={settings.sounds.setEnd}
              onChange={(v) => {
                store.updateSettings({ sounds: { ...settings.sounds, setEnd: v } });
                if (v) sounds.setEnd();
              }}
              label="Fim de set e de partida"
              description="Vinheta ao encerrar um set e fanfarra na vitória."
            />
          </div>
        </Section>

        <Section title="Dados do dispositivo" description="Tudo fica salvo apenas neste navegador. Nenhum dado é enviado para a internet.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted">
              {history.length} {history.length === 1 ? 'partida salva' : 'partidas salvas'} no histórico
            </p>
            <Button
              variant="danger"
              disabled={history.length === 0}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Apagar histórico?',
                  message: 'Todas as partidas finalizadas serão removidas deste dispositivo. Esta ação não pode ser desfeita.',
                  confirmLabel: 'Apagar tudo',
                  tone: 'danger',
                });
                if (ok) store.clearHistory();
              }}
            >
              Apagar histórico
            </Button>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}
