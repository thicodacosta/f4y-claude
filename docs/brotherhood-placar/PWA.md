# Brotherhood Placar — plano da etapa PWA

Status: **arquitetura pronta, service worker ainda desligado** (v1.0, nov/2026).

## O que já está pronto

| Requisito PWA | Situação na v1 |
|---|---|
| Funcionar sem backend | ✅ 100% client-side; nenhuma chamada de rede depois do carregamento |
| Persistência local | ✅ `localStorage` gravado de forma síncrona a cada ação (`src/storage/repository.ts`) |
| Lógica separada da UI | ✅ `src/domain/` é TypeScript puro (sem React/DOM), coberto por testes |
| Web App Manifest | ✅ `public/manifest.webmanifest`, já linkado no `index.html` |
| Ícones | ✅ 32, 180 (apple-touch), 192 e 512 px (este último também `maskable`) em `public/icons/` |
| Meta tags mobile | ✅ `theme-color`, `apple-mobile-web-app-*`, `viewport-fit=cover` + safe-area no placar |
| Assets offline-friendly | ✅ fontes empacotadas (`@fontsource`), sons sintetizados (WebAudio), sem CDN |
| Roteamento compatível com SW | ✅ rotas por hash: o SW só precisa servir `index.html` |
| Ponto de registro do SW | ✅ `src/pwa/registerServiceWorker.ts` (flag `ENABLED = false`) |
| Tela acesa durante o jogo | ✅ Wake Lock API no placar e no Telão |

## Passos para ativar

1. `npm i -D vite-plugin-pwa` e adicionar o plugin no `vite.config.ts` com
   `registerType: 'prompt'`, `manifest: false` (usar o arquivo existente) e
   `workbox.globPatterns: ['**/*.{js,css,html,woff2,png,jpg,webmanifest}']`.
2. Trocar o registro manual pelo `virtual:pwa-register` dentro de
   `registerServiceWorker.ts` e definir `ENABLED = true`.
3. Estratégia de atualização: **nunca recarregar sozinho durante uma partida**.
   Mostrar um aviso "Nova versão disponível" e só aplicar quando
   `store.getState().match?.status` for `finished`, `not_started` ou nulo.
4. Gerar ícone maskable dedicado (logo com 20% de margem segura) em vez de
   reaproveitar o 512.
5. Testar: Lighthouse PWA, instalação no Android (Chrome) e no iOS
   (Safari → Compartilhar → Adicionar à Tela de Início), modo avião durante uma
   partida, e recarregamento com o SW ativo.

## Pontos de atenção

- **iOS** não tem Fullscreen API em páginas comuns: instalado na tela inicial, o
  modo `standalone` já remove a barra do Safari, o que resolve o Modo Telão no iPhone.
- **Cota de armazenamento**: o histórico guarda até 60 partidas e reduz
  automaticamente se a cota estourar. Para histórico ilimitado, migrar
  `repository.ts` para IndexedDB; a interface `KV`/`Repository` já isola isso.
- `navigator.storage.persist()` deve ser pedido após a instalação para evitar que o
  navegador apague os dados por falta de espaço.
- Sincronização entre dispositivos (ex.: operador no celular, telão em outra TV)
  exige backend (WebSocket/Supabase Realtime). Hoje o Telão em outra janela
  sincroniza só no mesmo navegador, via evento `storage`.
