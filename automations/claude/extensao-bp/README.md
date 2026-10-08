# Candydate · BP (extensão Chrome)

Painel lateral de gestão de pessoas, no mesmo modelo da
[Candydate · ToolsKit](../extensao-entrevistas/): mesmo login, mesma
identidade visual, mesmos provedores de IA. Visual no design system **Candy
Studio** (`design-system/candy-studio/`) com o logo Candydate
(`design-system/assets/candydate-*`). Funcionalidades:

| Aba | O que faz | Base no JourneyLab |
|---|---|---|
| **Onboarding** | 30/60/90 com fases, marcos, tarefas por responsável (RH, gestor, colaborador), progresso e conclusão automáticos, alerta de fase atrasada | Onboarding v2 |
| **Produtividade** | Avaliação de 1 a 5 nos 8 critérios de performance, média, semáforo, focos de PDI sugeridos, evolução e tendência | Feedback 1:1 (dimensão Performance) |
| **Cultura** | Mesma mecânica nos 8 pilares de cultura | Feedback 1:1 (dimensão Cultura) |
| **Turnover** | Turnover 12 meses (geral e voluntário), custo estimado das saídas, motivos, saída precoce, risco de saída indicativo por pessoa e saídas esperadas | People Analytics + Retenção + calculadora da ToolsKit |
| **Pulso** | 5 tipos de pesquisa com link público e respostas de volta na plataforma (ver abaixo) | Pulse |
| **Offboarding** | Registro do desligamento (fotografia do vínculo, custo), checklist de saída e entrevista de desligamento por link de uso único | Offboarding |
| **Gestão** | Cenário de agora, histórico de 12 meses e projeção de 6 meses; análise preditiva com IA guardada no histórico | People Analytics |
| **Chat** | Chat com IA (motor da ToolsKit) que lê os dados da empresa, com foco opcional em uma pessoa; conversas guardadas | Chat da ToolsKit |
| **Pessoas** | Base de colaboradores (cadastro, importação CSV) e a ficha de cada um com a **linha do tempo completa** | Colaboradores |

Em **toda** funcionalidade (e na ficha de cada pessoa) há **Baixar PDF** e
**Gerar Motion**.

## Configurações › Colaboradores

A base de pessoas é alimentada nas **Configurações** (e também pela aba
Pessoas):

- **Um a um:** Nome (obrigatório), Cargo, Gestor, E-mail e Telefone, com
  "Salvar e cadastrar outro" para lançar vários em sequência.
- **Em massa:** "Baixar modelo (Excel)" gera um `.xlsx` com as colunas Nome,
  Cargo, Gestor, E-mail e Telefone (telefone como texto) e uma aba de
  instruções. A importação aceita `.xlsx` ou `.csv` e mostra uma **prévia**
  (novos, atualizados, sem mudança e linhas com erro e o motivo) antes de
  gravar. E-mail já cadastrado atualiza a pessoa, sem duplicar.
- **Lista** com busca, edição, exclusão e "Exportar planilha" no mesmo
  formato do modelo (para editar e reimportar).

Planilhas são lidas e geradas sem bibliotecas externas (`src/core/planilha.js`);
regras de importação em `src/core/importacao.js`. Telefone é guardado só com
dígitos (com `+` quando há DDI) e aparece na ficha com link para o WhatsApp.

## Pulso: 5 tipos de pesquisa

| Tipo | Perguntas | Foco |
|---|---|---|
| Pulso de Engajamento | 15 | eNPS, orgulho, clareza, reconhecimento, carga, liderança, recursos, crescimento, segurança psicológica, permanência |
| Bem-estar e eNPS | 15 | Equilíbrio, pressão, respeito, autonomia, estresse e esgotamento, iniciativas de bem-estar |
| Clima Organizacional | 30 | Liderança, comunicação, reconhecimento, desenvolvimento, ambiente, processos, remuneração, cultura, eNPS |
| Liderança, Cultura e Desenvolvimento | 30 | Liderança direta (8), os 8 pilares de cultura, carreira, clareza de performance |
| Personalizada | até 40 | O usuário escreve as perguntas e escolhe o tipo de resposta (concordância, escala, 0–10, escolha única/múltipla, sim/não, aberta); "Sugerir perguntas com IA" é opcional |

Bancos de perguntas em `src/core/pesquisas.js`. Cada pesquisa gera um **link
público** (sem login). As respostas entram pela função
`bp_responder_pesquisa` e aparecem na pesquisa: favorabilidade (% de 4 e 5),
eNPS, dimensões, resultado por pergunta, comentários e recorte por área (só com
3+ respostas, para proteger o anonimato). Pesquisas anônimas não pedem nome nem
e-mail; nas identificadas, o e-mail liga a resposta ao cadastro e ao histórico
da pessoa.

## Gerar Motion

1. O usuário descreve o que quer apresentar, para quem, o tom, a duração (30 s
   a 1min30) e o formato (16:9, 9:16 ou 1:1).
2. A IA (Claude; sem crédito/chave, Groq) escreve o **roteiro** a partir do
   relatório da tela — só com os números que estão nele (`src/motion/roteiro.js`).
   Sem IA disponível, o roteiro é montado direto dos dados.
3. A apresentação abre em `motion.html`: motor próprio em canvas
   (`src/motion/engine.js`) com 10 tipos de cena (abertura, números com
   contador, barras, evolução com projeção pontilhada, tópicos, destaque,
   citação, comparativo, etapas, encerramento), transição em cortina, logo e
   cores da empresa.
4. Ajuste títulos e duração de cada cena com prévia ao vivo, troque o formato
   e **Baixar vídeo** (MP4 quando o Chrome oferece; senão WebM). A gravação é
   em tempo real: mantenha a aba visível.

O roteiro fica guardado (`bp_documentos`) e pode ser reaberto.

## Gestão: presente, passado e projeção

- **Agora:** headcount, admissões/saídas em 90 dias, turnover, médias de
  Produtividade e Cultura, eNPS do último Pulso, risco de saída, onboardings.
- **Histórico:** série mensal de 12 meses (`serieMensal`).
- **Projeção (6 meses):** tendência linear (mínimos quadrados, com R²) para
  Produtividade e Cultura; saídas esperadas = Σ 1 − (1 − p)^meses, com p = taxa
  mensal histórica × multiplicador do risco de cada pessoa (alto 2,5 · médio
  1,4 · baixo 0,6; sem histórico, 1,5% ao mês); headcount = atual + ritmo de
  admissões − saídas esperadas.
- **Análise preditiva com IA:** leitura executiva, riscos, oportunidades e
  recomendações com prazo e impacto, com nível de confiança.

Risco e projeções são **indicativos**: servem para priorizar conversas e
ações, nunca para decidir sobre uma pessoa. Fórmulas em `src/core/indicadores.js`.

## Armazenamento e histórico

Tudo fica no Supabase (o mesmo projeto das contas da ToolsKit), em tabelas
`bp_*` isoladas por empresa com RLS (`supabase/migrations/`):

| Tabela | Conteúdo |
|---|---|
| `bp_empresas`, `bp_membros` | Empresa da conta (criada no 1º acesso) e quem participa |
| `bp_colaboradores` | Base de pessoas |
| `bp_onboardings`, `bp_avaliacoes`, `bp_desligamentos` | Onboarding, Produtividade/Cultura, Offboarding |
| `bp_pesquisas`, `bp_respostas` | Pulso e entrevistas de desligamento |
| `bp_documentos` | Motions, análises de IA e PDFs gerados |
| `bp_conversas` | Conversas do Chat (por usuário) |
| `bp_historico` | **Linha do tempo de cada colaborador** |

O histórico é escrito por **gatilhos do banco** (não depende da interface):
cadastro e alterações (cargo, área, gestor, remuneração, status), início,
avanço e conclusão do onboarding, cada avaliação, resposta identificada do
Pulso, desligamento, entrevista respondida, Motion/PDF gerado sobre a pessoa e
anotações manuais do RH. A ficha (aba Pessoas) mostra tudo.

Para dar acesso de outra conta à mesma empresa, inclua uma linha em
`bp_membros` (painel do Supabase); cada conta nova cria a própria empresa.

## Instalação

```bash
cd ../extensao-entrevistas && npm install   # o BP usa as dependências da ToolsKit
cd ../extensao-bp && npm install
npm run build
```

O build usa as chaves de IA e o Supabase do `.env.local` da ToolsKit; um
`.env.local` aqui (ver `.env.example`) tem prioridade. Depois:
`chrome://extensions` → Modo do desenvolvedor → **Carregar sem compactação**
→ pasta `extension/`.

### Uma vez, no projeto Supabase

1. **Banco:** rode, em ordem, os arquivos de `supabase/migrations/` no SQL
   Editor do projeto (ou `supabase link` + `supabase db push`). Só cria objetos
   `bp_*`; não altera nada da ToolsKit.
2. **Página pública:** publique a pasta `public-dist/` (gerada pelo build) em
   qualquer hospedagem estática — Vercel, Netlify, GitHub Pages ou um
   subdomínio da empresa. Informe o endereço em `BP_PUBLIC_URL` no
   `.env.local` ou em Configurações da extensão. A página só usa a chave
   publicável e as duas funções públicas (`bp_pesquisa_publica`,
   `bp_responder_pesquisa`).

## Arquitetura

| Caminho | Conteúdo |
|---|---|
| `src/core/toolskit.js` | Único ponto de importação dos módulos da ToolsKit (login, IA, PDF, tema, Chat, cálculo de turnover) |
| `src/core/db.js` | Acesso ao Supabase e base em memória da empresa |
| `src/core/indicadores.js` | Critérios, regras, fórmulas, risco, projeção, agregação do Pulso |
| `src/core/pesquisas.js` | Modelos do Pulso e entrevista de desligamento |
| `src/core/relatorio.js`, `texto.js`, `acoes.js` | Relatório único de cada tela → PDF, Motion e contexto do Chat |
| `src/core/graficos.js` | Gráficos SVG (barras, linha com projeção, colunas, medidor) |
| `src/modulos/` | Uma tela por funcionalidade |
| `src/motion/` | Roteiro (IA), motor de animação e página do player |
| `public/responder.html` | Página pública de resposta (o build gera `public-dist/`) |
| `supabase/` | Migração e configuração do Supabase local (portas 547xx) |
| `scripts/e2e.mjs` | Teste ponta a ponta |

## Testes

```bash
supabase start -x realtime,imgproxy,edge-runtime,logflare,vector,supavisor,studio,postgres-meta,storage-api,mailpit
node scripts/e2e.mjs            # --fotos <pasta> salva capturas de tela
```

O teste gera um pacote apontando para o Supabase local (com chaves de IA
inválidas, para não gastar crédito: o Motion usa o roteiro-base), carrega a
extensão num Chrome headless e cobre: login, base com histórico, cadastro,
onboarding, avaliações, os 5 tipos de pesquisa, respostas pela página pública
(validação, área, identificação), resultados de volta, offboarding com
entrevista de uso único, turnover, linha do tempo, PDF, Motion (16:9 e 9:16),
isolamento entre empresas, acesso sem login e exclusão em cascata. No fim,
refaz o build com a configuração real.

## Limitações

- As chaves de IA vão no pacote, como na ToolsKit: distribua só para a equipe.
- O Chat envia os dados agregados da empresa (e, com foco, a ficha da pessoa)
  ao provedor de IA a cada pergunta.
- O vídeo do Motion é gravado em tempo real e sem áudio.
- Custos de desligamento são estimativas para gestão (premissas da
  calculadora da ToolsKit), não cálculo trabalhista.
