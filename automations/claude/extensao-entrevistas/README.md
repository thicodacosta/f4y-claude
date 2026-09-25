# Find4You · Registro de Entrevistas (extensão Chrome)

Painel lateral do Chrome que grava e transcreve a entrevista feita no Google
Meet, Teams ou Zoom (no navegador) e, ao final, entrega um registro
estruturado nas 11 seções do schema `analyze_interview`: resumo executivo,
experiências, aderência a requisitos, competências, motivação,
disponibilidade, expectativa salarial, pontos positivos, pontos de atenção e
resumo final. Também aceita uma transcrição colada ou importada (.txt, .vtt,
.srt, .md). O registro é apoio à documentação, nunca avaliação, nota ou
decisão.

Independente do Candydate (`matchwork/chrome-extension/`): não tem login nem
backend. Chama as APIs direto do navegador com as chaves do próprio
recrutador. A captura reaproveita as soluções já validadas no Candydate
(PCM/WAV em vez de MediaRecorder, aba própria para a permissão do microfone).

## Como a gravação funciona

1. O recrutador abre a reunião, clica no ícone da extensão e em "Iniciar
   gravação".
2. O offscreen document captura duas trilhas separadas: o áudio da aba
   (rotulado "Candidato") e o microfone ("Recrutador"). O áudio da aba
   continua tocando normalmente.
3. A cada 20s, cada trilha vira um bloco WAV (16 kHz) transcrito pela
   Whisper na Groq. Blocos em silêncio não são enviados, e alucinações
   típicas da Whisper são filtradas. O áudio fica só em memória, até ser
   transcrito.
4. Ao finalizar (ou se a aba da reunião fechar), as falas são ordenadas por
   horário e enviadas ao Claude, que gera o registro.
5. Se a geração falhar, a transcrição não se perde: o painel volta no modo
   "Colar transcrição" com o texto preenchido para tentar de novo.

A gravação continua com o painel fechado ou em outra aba. Durante a
gravação o painel mostra só o tempo, pausa e se cada trilha está captando
fala, não o texto. A transcrição completa aparece junto do registro.

## O que existe aqui

| Caminho | Conteúdo |
|---|---|
| `src/schema.js` | Definição canônica `analyze_interview` e conversão para saída estruturada |
| `src/prompt.js` | Regras do registro (system prompt) e montagem da mensagem |
| `src/analyze.js` | Chamada ao Claude (`claude-opus-5`, raciocínio adaptativo, streaming, fallback em recusa) |
| `src/audio.js` | Captura PCM, reamostragem e montagem dos blocos WAV |
| `src/transcribe.js` | Transcrição de um bloco via Groq (Whisper), com novas tentativas e filtro de alucinação |
| `src/transcript.js` | Montagem da transcrição final com rótulos e horários |
| `src/offscreen.js` | Motor da gravação: captura, transcrição e geração do registro |
| `src/sidepanel.js`, `src/render.js` | Painel lateral, exibição e exportação do registro |
| `src/options.js`, `src/permission.js` | Configurações (chaves) e aba de permissão do microfone |
| `extension/background.js` | Coordena painel e offscreen; guarda o estado em `chrome.storage.session` |
| `extension/` | Pasta carregada no Chrome (manifest, HTML, CSS, ícones, `dist/` gerado) |

## Instalação

```bash
npm install
npm run build
```

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione a pasta `extension/`.
3. Na tela de configurações, que abre sozinha, cole as chaves:
   - **Anthropic** (console.anthropic.com → API Keys): gera o registro.
   - **Groq** (console.groq.com → API Keys): transcreve a gravação. Não é
     necessária para colar transcrição.
4. Abra a reunião e clique no ícone da extensão **com a aba da reunião
   ativa**: o Chrome só libera o áudio da aba em que a extensão foi aberta.
5. Na primeira gravação, uma aba pede a permissão do microfone.

Após alterar algo em `src/`, rode `npm run build` (ou `npm run watch`) e
clique em recarregar no card da extensão em `chrome://extensions`.

## Limitações conhecidas

- Só captura reuniões abertas no navegador. Apps desktop de Zoom e Teams não
  são abas e não podem ser capturados.
- Sem fone de ouvido, o microfone também capta a voz do candidato saindo
  pelo alto-falante. O registro trata falas duplicadas como eco, mas o
  resultado é melhor com fone.
- Todos os participantes remotos aparecem como "Candidato".
- A camada gratuita da Groq limita a quantidade de áudio por hora. Entrevistas
  longas podem ter trechos marcados como "[trecho não transcrito]"; um plano
  pago na Groq resolve.

## Diagnóstico

- Painel: botão direito no painel → Inspecionar.
- Gravação: `chrome://extensions` → card da extensão → "offscreen.html" (só
  aparece durante uma gravação).
- Background: `chrome://extensions` → card da extensão → "service worker".

## Privacidade e segurança

- As chaves ficam em `chrome.storage.local`, só no navegador do recrutador.
  Use chaves dedicadas, com limite de gasto definido em cada serviço.
- O áudio nunca é salvo: cada bloco fica em memória até ser transcrito.
- A transcrição vai para a Anthropic ao gerar o registro.
- Estado da gravação, rascunho e último registro ficam em
  `chrome.storage.session`, que o Chrome apaga quando é fechado.
