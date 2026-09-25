# Find4You · Ferramentas de RH (extensão Chrome)

Painel lateral do Chrome com seis ferramentas: registro de entrevistas,
construtor de currículos padronizados, comparativo de candidatos, pesquisa
salarial, calculadora de turnover e biblioteca de prompts para RH.

A aba "Entrevistas" grava e transcreve a entrevista feita no Google
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

## Construtor de currículos (aba "Currículos")

O recrutador configura uma vez, em Configurações, o logo (PNG/JPG até
1 MB), o nome da empresa, a cor de destaque e se os contatos do candidato
devem ser ocultados (padrão: sim). Depois, arrasta um ou vários currículos
em PDF ou Word (.docx) para o painel. Cada um é:

1. lido: PDF vai direto ao Claude, que lê inclusive PDFs escaneados; Word
   tem o texto extraído com o mammoth;
2. padronizado pelo Claude em uma estrutura única (resumo, experiências,
   formação, idiomas, competências, certificações), sem inventar nada e
   sem dados sensíveis (idade, estado civil, documentos, endereço,
   pretensão salarial);
3. gerado sob demanda em PDF (pdfmake) e Word (docx), com o logo no
   cabeçalho, a cor da empresa e "Apresentado por …" no rodapé.

Até 3 currículos são processados ao mesmo tempo, com cerca de 15s cada. A
identidade é aplicada no momento do download, então trocar o logo vale
também para os currículos já processados. Formato `.doc` antigo não é
suportado: salve como `.docx` ou PDF. O painel precisa ficar aberto
enquanto os arquivos são processados.

## Comparativo de candidatos (aba "Comparativo")

A JD (colada ou importada em PDF, .docx ou .txt) e de 2 a 5 currículos (PDF
ou .docx) vão numa única chamada ao Claude, para que todos sejam avaliados
com o mesmo critério. O Claude extrai de 6 a 12 requisitos da JD
(obrigatórios e desejáveis) e classifica cada candidato em cada requisito
como atende, parcial ou não evidenciado, sempre com a evidência.

A compatibilidade de 0% a 100% **não é dada pelo modelo**: é calculada em
`src/compare/evaluate.js` (atende = 1, parcial = 0,5, não evidenciado = 0;
obrigatórios pesam 2, desejáveis 1). Assim a nota é transparente e
reproduzível. As regras de equidade proíbem considerar nome, idade, gênero e
outras características pessoais. O resultado traz ranking, matriz
requisito × candidato, pontos fortes, lacunas e perguntas sugeridas para
a entrevista, e pode ser copiado ou baixado em Markdown. Leva de 30 a 90s.

## Pesquisa salarial (aba "Salários")

O Claude pesquisa na web com busca e leitura de páginas **restritas aos
domínios** do LinkedIn, Glassdoor, Robert Half e Hays
(`src/salary/research.js`). Devolve referências por fonte (com link),
faixa CLT consolidada, estimativa PJ, fatores de variação e as fontes em
que não achou dado público. Os guias da Hays, por exemplo, exigem
cadastro. Nenhum número é aceito sem fonte. Leva de 1 a 4 minutos.

Requer a busca na web habilitada na organização da Anthropic (Console →
Settings → Privacy). Cada pesquisa usa até 12 buscas e 6 leituras de
página, cobradas à parte pela Anthropic.

## Calculadora de turnover (aba "Turnover")

Cálculo local, sem IA (`src/turnover/calc.js`):

- **Taxa do período:** ((admissões + desligamentos) / 2) / headcount médio, e
  taxa de desligamento.
- **Custo de um desligamento CLT** (dispensa sem justa causa, aviso
  indenizado, sem férias vencidas): aviso prévio (30 dias + 3 por ano, até
  90), férias proporcionais + 1/3, 13º proporcional, multa de 40% do FGTS
  sobre saldo estimado (8% × salário × meses) e FGTS sobre aviso e 13º.
- **Custo PJ:** aviso contratual indenizado e multa contratual informados.
- **Reposição (ambos):** recrutamento, treinamento, vaga em aberto e rampa
  do substituto, com 50% de produtividade perdida sobre o custo mensal (CLT:
  salário × 1,7).

## Biblioteca de prompts (aba "Prompts")

50 prompts em 10 categorias (5 cada) em `src/prompts/library.js`, com busca
sem acento e tolerante a plural e gênero, e filtro por categoria.

## O que existe aqui

| Caminho | Conteúdo |
|---|---|
| `src/schema.js` | Definição canônica `analyze_interview` e conversão para saída estruturada |
| `src/prompt.js` | Regras do registro (system prompt) e montagem da mensagem |
| `src/claude.js` | Chamada comum ao Claude (`claude-opus-5`, saída estruturada, raciocínio adaptativo, streaming, fallback em recusa) |
| `src/analyze.js` | Registro de entrevista a partir da transcrição |
| `src/cv/` | Construtor de currículos: schema, leitura e padronização, geração de PDF/Word e a aba do painel |
| `src/compare/` | Comparativo de candidatos: avaliação pelo Claude, cálculo da compatibilidade e a aba do painel |
| `src/salary/` | Pesquisa salarial com busca web restrita às fontes e a aba do painel |
| `src/turnover/` | Cálculos de taxa e custo de turnover e a aba do painel |
| `src/prompts/` | Biblioteca de 50 prompts e a aba de busca |
| `src/ui.js` | Utilitários de interface compartilhados |
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
