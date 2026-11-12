# Brotherhood Placar

Placar digital de voleibol pensado para o celular: pontuação, sets, saque automático,
tempos técnicos, desfazer, histórico, exportação de resultado e Modo Telão.

```bash
npm install
npm run dev      # http://localhost:5190
npm test         # regras, desfazer e persistência
npm run build
```

## Estrutura

```
src/
  domain/      regras puras do voleibol (sem React/DOM) + testes
    types.ts       modelo: MatchState, ações, regras
    rules.ts       reduceMatch(estado, ação, agora) · snapshots do desfazer
    selectors.ts   set point, match point, tempos restantes, rótulos
    clock.ts       cronômetro baseado em timestamps (sobrevive a recarregar)
  storage/     repository.ts — localStorage com fallback e tolerância a cota
  state/       matchStore.ts (store sem React, testado) · store.ts (hooks) · effects.ts
  screens/     Início, Nova partida, Placar, Telão, Histórico, Resumo, Configurações
  components/  UI reutilizável (botões, diálogo, painel do time, card de exportação)
  lib/         roteador por hash, sons WebAudio, fullscreen, wake lock, exportação
  pwa/         registro do service worker e aviso de atualização
```

## Decisões principais

- **Regras como função pura.** Toda mudança passa por `reduceMatch`; ação inválida
  devolve o mesmo objeto, então nada é gravado nem empilhado no desfazer.
- **Desfazer completo e leve.** Cada ação guarda um snapshot sem logos e sem o log de
  eventos (o log só cresce; o desfazer o trunca). Restaura placar, set, sets, saque,
  tempos e histórico. O cronômetro mantém o tempo real.
- **Gravação imediata.** O store grava no `localStorage` antes de atualizar a tela.
- **Proteção contra toque acidental.** Trava de 350 ms por botão de ponto, "−" separado
  do "+", confirmação para encerrar/reiniciar/avançar set e para desfazer uma partida
  finalizada.
- **Celular primeiro.** Em pé: times empilhados e botão "+" grande à direita (polegar).
  Deitado (altura ≤ 520 px): modo compacto sem cabeçalho, com o cronômetro no centro.
- **Telão em outra janela.** Menu → "Telão em outra janela" abre uma janela somente
  leitura que acompanha o placar pelo evento `storage` (ideal para TV via HDMI).

## Atalhos (notebook)

`←`/`A` ponto do Time A · `→`/`L` ponto do Time B · `Z` desfazer · `P` pausar · `F` tela cheia

Plano da etapa PWA: [`docs/brotherhood-placar/PWA.md`](../docs/brotherhood-placar/PWA.md).
