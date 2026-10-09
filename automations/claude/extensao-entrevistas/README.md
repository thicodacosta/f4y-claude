# Candydate · Recruiter (extensão Chrome)

Painel lateral do Chrome com oito ferramentas: registro de entrevistas,
construtor de currículos padronizados, comparativo de candidatos, pesquisa
salarial, painel de gestão, biblioteca de prompts, Shortlist no LinkedIn e
Chat com IA.

A aba "Entrevistas" grava e transcreve a entrevista feita no Google
Meet, Teams ou Zoom (no navegador) e, ao final, entrega um registro
estruturado nas 11 seções do schema `analyze_interview`: resumo executivo,
experiências, aderência a requisitos, competências, motivação,
disponibilidade, expectativa salarial, pontos positivos, pontos de atenção e
resumo final. Também aceita uma transcrição colada ou importada (.txt, .vtt,
.srt, .md). O registro é apoio à documentação, nunca avaliação, nota ou
decisão.

Login (`src/auth/`), IA (`claude.js`, `groq.js`), PDF (`src/pdf/`), tema e o
motor do Chat também são usados pela extensão JourneyLab · BP
(`../extensao-bp/`), que importa direto daqui: mudanças nesses arquivos
valem para as duas.

Independente do Candydate (`matchwork/chrome-extension/`): não tem login nem
backend. Chama as APIs direto do navegador com as chaves do próprio
recrutador. A captura reaproveita as soluções já validadas no Candydate
(PCM/WAV em vez de MediaRecorder, aba própria para a permissão do microfone).

## Como a gravação funciona

1. O recrutador abre a reunião, clica no ícone da extensão e em "Iniciar
   gravação". O Chrome só libera o áudio de uma aba depois do clique no
   ícone nela (`activeTab`); como o painel continua aberto ao trocar de aba,
   se faltar esse clique o painel guarda o pedido (`pendingStart`, 3 min) e o
   background inicia a gravação no próximo clique no ícone. O aviso mostra a imagem do ícone na barra
   do Chrome (`extension/icons/toolbar-hint.png`).
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

**Diagnóstico de nível:** durante a gravação, o painel mostra o nível medido
em cada bloco de 20s ("Nível do áudio · reunião: … · microfone: …", RMS × 100;
0 = silêncio). Na trilha da reunião, só o silêncio digital é descartado antes
da Whisper (o som da chamada pode chegar baixo); no microfone, o corte de
ruído continua em RMS 0,0015. O console do offscreen registra o RMS e as falas
transcritas de cada trecho.

**Aba que não é reunião:** a gravação só começa numa aba do Meet, Teams,
Zoom, Webex, Whereby, Jitsi, 8x8, Skype ou Discord (pelo endereço, liberado
pelo clique no ícone). Em outra aba, o painel explica o motivo e oferece
"gravar esta aba mesmo assim", para outras plataformas. Caso real
(08/10/2026): o Meet estava aberto como aplicativo (PWA, janela sem barra de
endereço, onde o ícone da extensão não aparece); o clique no ícone foi na
janela comum, na aba da Agenda, e a extensão gravou o silêncio dessa aba. O
teste em laboratório (Chrome 154 neste Mac) confirmou que a captura funciona em
áudio por elemento, Web Audio, WebRTC e saída em dispositivo específico
(`setSinkId`), e que o ToolsKit capta a fala de uma aba normalmente.

**Som da reunião em silêncio:** o painel mostra o título da aba gravada.
Se a trilha da reunião entregar silêncio digital (RMS < 0,0001) por 2 blocos
seguidos (40s) enquanto o microfone capta fala, o painel avisa na hora, com o
que conferir (gravação iniciada na aba da reunião, reunião no Chrome e não no
aplicativo, alto-falante do Meet/Teams no padrão do sistema). Se a gravação
terminar sem nenhuma fala do candidato, a transcrição registra que o áudio
dele não estava disponível e o resultado mostra um alerta: o registro reflete
só a fala do recrutador.

**Tradução do registro:** só os textos vão para a IA, numerados e sem os
nomes dos campos (`src/translate.js`); a estrutura é remontada na extensão.
Antes, o JSON inteiro ia para tradução e o modelo traduzia também as chaves
(ex.: `competenciasComportamentais` → `competenciasComportamentales` em
espanhol), e a resposta era recusada. Também ficou mais rápido (~1,5s).

**Nível ao vivo:** o nível de cada trilha é medido a cada 2s (não só a cada
bloco de 20s); com som chegando, "Áudio da reunião" mostra "recebendo som,
transcrevendo…" antes da primeira transcrição. O aviso de som em silêncio sai
do painel quando o som volta.

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
3. gerado sob demanda em PDF (pdfmake) e Word (docx), com o logo, a cor da
   empresa e "Apresentado por …" no rodapé. O **cargo da vaga** (campo
   opcional do painel) aparece logo abaixo do nome do candidato; sem ele, vai
   o título profissional do próprio currículo.

**Modelo de currículo** (Configurações → Currículos padronizados, opcional):
o usuário envia o currículo no formato que a empresa prefere (PDF ou Word) e
a extensão reconhece e aplica o padrão (`src/cv/model.js`, guardado em
`cvModelo`):

- **PDF:** a 1ª página vira imagem (pdf.js + canvas) e o modelo de visão da
  Groq (Qwen) descreve o visual; o gpt-oss junta essa descrição ao texto e
  monta o layout estruturado;
- **Word:** o HTML do documento (mammoth: títulos, negrito, listas) faz o
  papel da imagem.

O layout (`src/cv/layout.js`) cobre: posição do logo (esquerda, centro,
direita) e linha do cabeçalho; alinhamento e caixa-alta do nome; alinhamento
do cargo e da localização; estilo dos títulos (pequenos com linha, grandes em
negrito, negrito com linha), caixa-alta e cor; ordem e títulos das seções;
experiência em blocos ou em linha única ("Empresa — Cargo | Período"),
atividades em tópicos ou parágrafo; formação em blocos ou em lista;
competências em linha ou tópicos; e orientações de escrita, que vão para a
padronização. Configurações mostra o que foi reconhecido, para conferir.
Seções que o modelo não tem entram no fim, com o título padrão, para não
perder conteúdo. Os dados da pessoa do modelo nunca são usados. Fontes não
são copiadas: o PDF usa Roboto e o Word, Arial.

**Nome do arquivo:** `Nome da Empresa - Cargo ｜ Nome do Candidato.pdf` (ou
`.docx`; partes vazias são omitidas). O Chrome troca "|" por "_" em nomes de
arquivo, então a barra é a "｜" (U+FF5C), visualmente igual. O título interno
do PDF e do Word usa o mesmo texto, com "|".

Até 3 currículos são processados ao mesmo tempo, com cerca de 15s cada. A
identidade é aplicada no momento do download, então trocar o logo vale
também para os currículos já processados. Formato `.doc` antigo não é
suportado: salve como `.docx` ou PDF. O painel precisa ficar aberto
enquanto os arquivos são processados.

## Comparativo de candidatos (aba "Comparativo")

Roda na **Groq** (`openai/gpt-oss-120b`, saída estruturada estrita), em
cerca de 5 a 10s. A JD (colada ou importada em PDF, .docx ou .txt) e de 2 a 5
currículos têm o texto extraído no próprio navegador (pdf.js para PDF,
mammoth para Word) e vão numa única chamada, para que todos sejam avaliados
com o mesmo critério. **PDFs escaneados (imagem) não funcionam**: a Groq não
lê imagem, e a extensão avisa qual arquivo não tem texto.

O modelo extrai de 6 a 10 requisitos da JD (obrigatórios e desejáveis) e
classifica cada candidato em cada requisito como atende, parcial ou não
evidenciado, sempre com a evidência. A compatibilidade de 0% a 100% **não é
dada pelo modelo**: é calculada em `src/compare/evaluate.js` (atende = 1,
parcial = 0,5, não evidenciado = 0; obrigatórios pesam 2, desejáveis 1). As
regras de equidade proíbem considerar nome, idade, gênero e outras
características pessoais. O resultado traz ranking, matriz requisito ×
candidato, pontos fortes, lacunas e perguntas sugeridas, e pode ser copiado ou
baixado em Markdown.

## Pesquisa salarial (aba "Salários")

Roda na **Groq** em duas etapas (`src/salary/research.js`), porque a busca na
web da Groq não aceita saída estruturada:

1. `gpt-oss-120b` com a ferramenta `browser_search`: uma busca por fonte
   (LinkedIn, Glassdoor, Robert Half e Hays, via `site:`), anotando valor e
   URL;
2. `gpt-oss-20b` organiza as notas no formato do painel (referências por
   fonte, faixa CLT, estimativa PJ, fatores de variação e fontes sem dado),
   descartando outras fontes e sem inventar números.

A busca da Groq não restringe domínios pela API: a restrição vem do prompt e
da segunda etapa. Leva de 40s a 1 min. **No plano gratuito da Groq**, o limite
de 8.000 tokens por minuto do `gpt-oss-120b` faz a extensão esperar entre
chamadas seguidas; o plano Dev Tier remove esse gargalo.

## Gestão (aba "Gestão")

Substituiu a calculadora de turnover (v1.25.0). Painel com tudo o que o
recrutador fez na plataforma, com histórico:

- **Registro das atividades** (`src/atividades.js`): cada funcionalidade
  anota o que fez em `chrome.storage.local` (chave `atividades`, até 5.000
  eventos, só metadados, nunca o conteúdo): entrevista transcrita (gravada ou
  colada, com a duração), registro traduzido, registro em PDF, currículo
  padronizado e baixado, comparativo (candidatos e melhor compatibilidade),
  pesquisa salarial, Shortlist (pedidos, encontrados, perfis analisados),
  pergunta no Chat e prompt copiado. Fica neste navegador.
- **Painel** (`src/gestao/`): filtros de período (7, 30, 90 dias, 12 meses,
  todo o histórico ou datas livres) e de funcionalidade; 8 indicadores;
  gráfico de atividades por dia, semana ou mês (conforme o período) e por
  funcionalidade; histórico com busca. Atualiza ao vivo.
- **Baixar PDF** (`src/gestao/pdf.js`): período e filtros, indicadores,
  destaques, gráficos e o histórico completo do período, com a identidade da
  empresa (`src/pdf/branded.js`).
- **Criar Motion**: apresentação animada do período. Reaproveita o motor e o
  roteirista da extensão BP (`../extensao-bp/src/motion`: `engine.js`,
  `roteiro.js`, `opcoes.js`), empacotados direto de lá pelo esbuild: a IA
  (Claude; sem crédito, Groq; sem IA, roteiro-base) escreve o roteiro só com
  os números do relatório (`src/gestao/dados.js`), e `motion.html` toca,
  troca o formato (16:9, 9:16, 1:1), abre em tela cheia e exporta o vídeo
  (MP4 ou WebM). Público, tom e duração escolhidos no diálogo.

`src/turnover/calc.js` continua no repositório porque a extensão BP o usa.

## Biblioteca de prompts (aba "Prompts")

50 prompts em 10 categorias (5 cada) em `src/prompts/library.js`, com busca
sem acento e tolerante a plural e gênero, e filtro por categoria. A ☆ de cada
prompt o marca como **favorito** (`chrome.storage.local`, chave
`promptFavoritos`); a categoria "★ Favoritos" fica depois de "Desligamento e
retenção". Os favoritos alimentam o Chat.

## Chat (aba "Chat")

Conversa com IA no estilo Claude/ChatGPT (`src/chat/`):

- **Prompts favoritos:** digitar `/` (com filtro pelo que vier depois, setas e
  Enter) ou o botão **+ → Prompts favoritos** insere o prompt no campo e já
  seleciona o primeiro `[CAMPO]` para preencher.
- **Anexos:** botão **+ → Documento** (PDF, Word, texto, CSV, até 20 MB) ou
  **Imagem** (PNG, JPG, WEBP, GIF, até 5 MB), ou arrastar para a conversa; até
  5 por mensagem. Vídeo não é aceito.
- **Provedor:** Claude (lê PDF inclusive escaneado e imagens, esforço médio);
  sem crédito/chave na Anthropic, Groq automaticamente: `gpt-oss-120b` para
  texto e documentos (texto extraído no navegador) e `qwen3.8-27b` quando há
  imagem. Cada resposta indica quem respondeu.
- **Objetivo e atualizado:** responde com a informação em si, sabe a data de
  hoje e usa **busca na web** para dados que mudam (cotações, jogos, notícias,
  leis, índices). As fontes aparecem como links abaixo da resposta (uma por
  site). Se o modelo buscar e não escrever a resposta, a extensão tenta de novo.
  Com imagem anexada (Qwen na Groq), não há busca na web.
- Resposta em streaming, com botão para parar, Markdown sanitizado (DOMPurify)
  e botão Copiar. A conversa (texto e nomes dos anexos) fica em
  `chrome.storage.session`; o conteúdo dos anexos, só em memória.

## Acesso (login)

**Acesso por produto:** a conta precisa ter `recruiter` em
`app_metadata.produtos` (o BP usa `bp`). Liberar e revogar pelo SQL Editor:
`select public.conceder_produto('email', 'recruiter');` — ver
`../extensao-bp/README.md` › "Acesso por produto".

Nada do ToolsKit abre sem login (`src/auth/`), no painel, nas Configurações e
na aba de permissão do microfone:

1. **E-mail e senha**: o administrador cria a conta e envia a senha inicial
   ao usuário por mensagem;
2. **Primeiro login**: antes de qualquer outra tela, o usuário cria a própria
   senha (mín. 8 caracteres, letras e números). Quem já criou fica marcado em
   `user_metadata.senhaPropria`;
3. **Manter conectado** (padrão ligado): a sessão sobrevive ao fechar o
   Chrome; desligado, dura até o Chrome ser fechado;
4. **Esqueci a senha**: chega por e-mail uma **senha provisória** (o código de
   recuperação do Supabase, `{{ .Token }}`). O usuário a digita no campo Senha
   do login e em seguida cria uma nova senha.

No **primeiro login de cada usuário**, as Configurações abrem em modo de
boas-vindas (identidade da empresa e integração com o LinkedIn). "Sair" fica
no topo do painel e em Configurações → Conta.

Contas no Supabase (`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` em
`.env.local`). Configuração do projeto, feita uma vez no painel do Supabase:

| Onde | O quê |
|---|---|
| Authentication → Sign In / Providers | Desligar **Allow new users to sign up** (só o admin cria contas) |
| Authentication → Sign In / Providers → **Email** | **Minimum password length** = 8 (igual à regra da extensão) |
| Authentication → Emails → Templates → **Reset Password** | Corpo com a senha provisória: `Sua senha provisória do ToolsKit: {{ .Token }}` (sem link) |
| Authentication → Emails → SMTP Settings | SMTP próprio (ex.: Resend): o envio padrão do Supabase permite poucos e-mails por hora |
| Authentication → Users → **Add user → Create new user** | E-mail + senha inicial, com **Auto Confirm User** marcado |

**Limite de segurança:** o login controla quem usa a extensão, mas as chaves
de IA ainda vão no pacote. A proteção completa é mover as chamadas de IA para
uma Edge Function do Supabase que só responde a sessões válidas.

## Interface

Segue a estrutura do design system **Candy Studio** (`design-system/candy-studio/`)
com o azul e os neutros da marca Candydate (candydate-vert.vercel.app): azul
`#28AAF0` nos destaques sem texto, `#0E7AB8` nos botões com texto branco e
`#166F9F` em textos e links (contraste AA), fundo `#F6F8FA`, texto `#383A47`,
verde/âmbar/vermelho só para status, Geist nos títulos e Inter no corpo,
bordas de 1px com sombras mínimas, botões em pílula, raios de 8/12/16px, foco
como anel de 4px e barra superior clara e translúcida. Tokens em
`extension/styles.css` (o BP copia este arquivo no build). Marca: logo Candydate
(`extension/icons/candydate-logo.png` e ícones do monograma "C", gerados a
partir de `design-system/assets/`).

## Provedores de IA e limites

| Ferramenta | Provedor |
|---|---|
| Registro de entrevista | Claude; se a Anthropic estiver sem crédito, chave ou cota, **Groq automaticamente** (mesmo prompt e schema) |
| Currículos padronizados | Claude (lê PDF escaneado); na falta, **Groq** com texto extraído no navegador |
| Transcrição da gravação | Groq (Whisper) |
| Comparativo, pesquisa salarial, tradução e Shortlist | Groq |
| Chat | Claude; sem crédito na Anthropic, Groq (Qwen para imagens) |

Plano gratuito da Groq (limites da conta inteira, por modelo): **8.000 tokens
por minuto** e **200.000 tokens por dia**. Na prática: currículos e
comparativos cabem com folga; entrevistas de até ~15 minutos cabem numa
chamada; entrevistas mais longas e uso diário por uma equipe pedem créditos
na Anthropic ou o plano Dev Tier da Groq. Quando um limite é atingido, a
extensão explica o motivo na hora (sem esperas longas) e, na gravação,
preserva a transcrição para tentar de novo.

## Identidade, primeiro acesso, tema e idiomas

- **Marca da plataforma:** Candydate. O ícone da extensão (monograma "C") e o
  nome "Candydate · ToolsKit" vêm do manifest; cores e tipografia seguem o
  design system Candy Studio (ver Interface). Arquivos em
  `design-system/assets/candydate-*` (originais, wordmark limpo e ícones).
- **Logo no topo do painel:** é o logo da empresa do usuário, escolhido em
  Configurações (Currículos padronizados), o mesmo usado nos currículos. Sem
  logo, aparece o nome da empresa; sem nada configurado, o logo Candydate.
- **Primeiro acesso:** na instalação, Configurações abre em modo de
  boas-vindas ("Configure sua empresa"). Enquanto a identidade não é salva, o
  painel mostra um aviso e abre Configurações uma vez por sessão. Ao salvar,
  `onboardingDone` é gravado e o fluxo não aparece mais. Quando houver login e
  compra de pacote, este gatilho passa a ser o primeiro login.
- **Tema:** Automático (sistema), Claro ou Escuro, em Configurações →
  Aparência, ou pelo botão no topo do painel. Fica em `chrome.storage.local`
  e é espelhado em `localStorage` para o `theme-init.js` aplicar antes da
  página pintar.
- **Tradução do registro de entrevista:** no resultado, "Idioma do registro"
  alterna entre português, inglês e espanhol. A tradução roda na Groq
  (`src/translate.js`, cerca de 2s), mantém a estrutura, nomes, siglas e
  valores, e fica guardada junto do registro. Copiar e baixar usam o idioma
  exibido.
- **PDF do registro:** o registro de entrevista é baixado em PDF com a
  identidade configurada (logo, cor e nome da empresa), no idioma exibido
  (`src/interview-pdf.js`, sobre a mesma base dos currículos em
  `src/pdf/branded.js`). "Copiar" continua disponível para colar em ATS ou
  e-mail.

## Shortlist no LinkedIn (aba "Shortlist")

Identifica e ranqueia candidatos a partir da JD. **Só lê o LinkedIn:** não
clica em Conectar, não envia convites nem mensagens (o código de convite foi
removido na v1.23.0, para não travar a aba nem arriscar restrição da conta).

1. Ao abrir a aba, a extensão abre o LinkedIn (busca de pessoas), se ainda não
   houver uma aba dele.
2. A recrutadora cola a JD. "Sugerir termos de busca" sugere buscas (cargo +
   cidade) que abrem direto no LinkedIn.
3. Ela faz a busca de pessoas, aplica filtros e deixa a página de resultados
   aberta.
4. Escolhe quantos candidatos encontrar (1 a 10) e a compatibilidade mínima
   (padrão 70%, ajustável em Configurações) e clica em **Iniciar Shortlist**.
5. A extensão lê os resultados (cada cartão é identificado pelo seu único
   botão de ação, sem depender das classes do LinkedIn), faz a triagem pelos
   cartões e abre os perfis mais promissores **um a um**, avaliando cada um
   até encontrar a quantidade pedida com a compatibilidade mínima. Limites: 4
   perfis por candidato pedido (máx. 40) e 5 páginas da busca; pausa de 4 a
   8s entre perfis. Perfil que não carrega é pulado, sem derrubar a busca. No
   limite por minuto da Groq, espera e tenta de novo.
6. **Pausar busca** para no próximo ponto seguro e libera a aba do LinkedIn
   até **Retomar busca**; **Finalizar** encerra antes da quantidade escolhida
   e mostra o ranking encontrado até ali.
7. Resultado: ranking de 0 a 100% com o link de cada perfil, título, resumo e
   a avaliação por requisito; os perfis abaixo do mínimo ficam numa lista
   recolhida. **Copiar ranking** e **Baixar planilha** (.csv com ";", abre no
   Excel).

**Mesma análise do Comparativo.** Os dois usam `src/compare/method.js`:
mesmos prompts, schemas e cálculo (`score.js`). Os requisitos de uma JD ficam
guardados (`requisitosPorJd`, últimas 20 JDs, comparadas sem diferença de
espaços e maiúsculas) e são reaproveitados pelas duas telas, e a avaliação
roda com temperatura 0. Teste: o mesmo perfil de QA Engineer tirou 85% em 3
execuções no Comparativo e 85% em 3 na Shortlist.

**Leitura do perfil completo:** a página principal do perfil mostra só
alguns itens de cada seção e os carrega aos poucos. Por isso, para cada
perfil, a extensão lê:

1. a página principal: nome, título, localização e "Sobre";
2. as páginas de detalhes, que trazem cada seção inteira:
   `/details/experience/`, `/details/education/`, `/details/certifications/` e
   `/details/skills/`.

Em cada página, rola até o fim (a janela e o contêiner interno com rolagem
própria, que é onde o LinkedIn atual carrega o conteúdo) e só conclui quando a
página não cresce mais. Tira o texto duplicado para leitores de tela e os
botões ("Exibir mais", "Voltar"). Limites de texto por seção (experiência
6.000 caracteres; formação e certificações 1.200; competências 1.500), para o
perfil inteiro caber num pedido do plano gratuito da Groq. Página de detalhe
que não abre é pulada; o resto do perfil segue para a avaliação. Leva cerca de
20 a 40 segundos por perfil.

**Configurações → Integração com o LinkedIn:** conectar (confirma o login na
sessão do LinkedIn aberta no Chrome) e a compatibilidade mínima padrão.

## O que existe aqui

| Caminho | Conteúdo |
|---|---|
| `src/schema.js` | Definição canônica `analyze_interview` e conversão para saída estruturada |
| `src/prompt.js` | Regras do registro (system prompt) e montagem da mensagem |
| `src/claude.js` | Chamada comum ao Claude (`claude-opus-5`, saída estruturada, raciocínio adaptativo, streaming, fallback em recusa): registro de entrevista e currículos |
| `src/groq.js` | Chamadas à Groq (saída estruturada e busca na web): comparativo e pesquisa salarial |
| `src/text-extract.js` | Texto de PDF (pdf.js) e Word (mammoth) extraído no navegador |
| `src/analyze.js` | Registro de entrevista a partir da transcrição |
| `src/cv/` | Construtor de currículos: schema, leitura e padronização, geração de PDF/Word e a aba do painel |
| `src/compare/` | Comparativo de candidatos: avaliação pelo Claude, cálculo da compatibilidade e a aba do painel |
| `src/salary/` | Pesquisa salarial com busca web restrita às fontes e a aba do painel |
| `src/turnover/calc.js` | Cálculos de custo de turnover (usados pela extensão BP) |
| `src/atividades.js`, `src/gestao/` | Histórico de atividades e aba Gestão (painel, PDF, Motion) |
| `src/prompts/` | Biblioteca de 50 prompts e a aba de busca |
| `src/ui.js` | Utilitários de interface compartilhados |
| `src/theme.js`, `extension/theme-init.js` | Tema claro/escuro/automático |
| `src/header.js` | Logo da empresa no cabeçalho |
| `src/translate.js` | Tradução do registro para inglês e espanhol |
| `src/chat/` | Chat: motor (Claude/Groq, anexos) e a aba |
| `src/prompts/favorites.js` | Prompts favoritos |
| `src/shortlist/` | Shortlist no LinkedIn: IA (Groq), orquestração, script da página, configurações e a aba |
| `src/compare/score.js` | Cálculo da aderência (Comparativo e Shortlist) |
| `src/audio.js` | Captura PCM, reamostragem e montagem dos blocos WAV |
| `src/transcribe.js` | Transcrição de um bloco via Groq (Whisper), com novas tentativas e filtro de alucinação |
| `src/transcript.js` | Montagem da transcrição final com rótulos e horários |
| `src/offscreen.js` | Motor da gravação: captura, transcrição e geração do registro |
| `src/sidepanel.js`, `src/render.js` | Painel lateral, exibição e exportação do registro |
| `src/options.js`, `src/permission.js` | Configurações (chaves) e aba de permissão do microfone |
| `src/background.js` | Coordena painel e offscreen; guarda o estado em `chrome.storage.session` |
| `src/keys.js` | Chaves efetivas: as do navegador ou as embutidas pelo build |
| `extension/` | Pasta carregada no Chrome (manifest, HTML, CSS, ícones, `dist/` gerado) |

## Instalação

```bash
cp .env.example .env.local   # preencha as chaves (opcional, ver abaixo)
npm install
npm run build
```

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e selecione a pasta `extension/`.
3. Abra a reunião e clique no ícone da extensão **com a aba da reunião
   ativa**: o Chrome só libera o áudio da aba em que a extensão foi aberta.
4. Na primeira gravação, uma aba pede a permissão do microfone.

### Chaves embutidas ou por usuário

- **Com `.env.local` preenchido** (ANTHROPIC_API_KEY e GROQ_API_KEY), o build
  embute as chaves no pacote. A equipe só instala e usa, e a seção de chaves
  não aparece em Configurações.
- **Sem `.env.local`**, cada usuário informa as chaves em Configurações.

`.env.local` e `extension/dist/` não vão para o git. Qualquer pessoa com o
pacote gerado consegue extrair as chaves embutidas: distribua só para a
equipe, use chaves dedicadas com limite de gasto e troque a chave se o
pacote vazar. Para eliminar esse risco, o caminho é um servidor
intermediário que guarde as chaves.

Para distribuir, gere o `.zip` da pasta `extension/` (sem os `.map`) depois
do build.

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
