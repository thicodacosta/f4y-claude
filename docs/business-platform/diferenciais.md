# Diferenciais Competitivos

Primeira seção reorganiza o que já foi pedido; segunda seção soma
funcionalidades adicionais que a maioria dos ATS/CRM do mercado (Bullhorn,
Vincere, Recruit CRM, Crelate, JobAdder, Zoho Recruit) não oferece nativamente.

## Do pedido original (consolidado)

- IA para prever probabilidade de fechamento de vaga/oportunidade
- Score automático de candidato (aderência técnica + comportamental)
- Resumo automático de currículo
- Geração automática de Job Description
- Matching inteligente candidato↔vaga
- Dashboard executivo com insights acionáveis e alertas
- Detecção de gargalo no pipeline comercial e de recrutamento
- Automações estilo n8n/Make/Zapier
- Timeline unificada de interações (cliente e candidato)
- Painel de produtividade por consultor/recrutador
- Metas, comissões e gamificação
- Portal do cliente (acompanhamento de vaga em tempo real)
- Portal do candidato (acompanhamento do processo seletivo)
- Integrações: LinkedIn Recruiter, WhatsApp Business, Google Calendar,
  Microsoft 365, Zoom, Teams, Slack, APIs de IA

## Adicionais propostos

### 1. Assistente de intake de vaga por conversa
Em vez de só um formulário, um chat guiado (usando Claude) que extrai os
campos da vaga a partir de uma call transcrita ou de um briefing solto em
texto/áudio do cliente — reduz o retrabalho de "reunião de kickoff → depois
alguém preenche o formulário".

### 2. Radar de reativação de cliente inativo
Cliente que não abre vaga há N meses (configurável) entra automaticamente em
uma lista de "reativação" no Dashboard Comercial, com sugestão de abordagem
baseada no histórico (última vaga, ticket médio, tecnologia mais buscada) —
transforma `docs/clientes/` (hoje mantido manualmente) em sinal acionável.

### 3. Benchmark salarial vivo
Ao abrir uma vaga, a plataforma sugere faixa salarial com base no histórico
interno de vagas fechadas com cargo/stack/senioridade/cidade similares —
evita propor faixa fora de mercado sem depender de fonte externa paga.

### 4. Alerta de risco de perda de candidato em processo
Sinal (tempo parado numa etapa acima da média, silêncio do candidato) que
aponta risco de o candidato desistir ou aceitar outra proposta antes que o
recrutador perceba — comum em Executive Search onde o ciclo é longo.

### 5. "Por que este candidato" — explicabilidade do matching
Toda sugestão de IA (matching, score) vem com justificativa legível, não só
um número — decisão de contratação nunca deve parecer uma caixa-preta para o
recrutador ou para o cliente.

### 6. Simulador de comissão para o consultor
Antes de fechar, o consultor vê a projeção de comissão em tempo real
conforme move o card — reforça o incentivo certo no momento certo, em vez de
só no fechamento do mês.

### 7. Reaproveitamento de banco de talentos entre verticais
Um candidato avaliado para Recrutamento pode aparecer automaticamente como
sugestão para uma vaga de Alocação Tech compatível (e vice-versa) — a maioria
dos ATS trata cada vertical como silo; aqui o pool é único, filtrado por
contexto.

### 8. Modo "apresentação ao cliente"
Um modo de tela cheia, sem elementos de edição, para abrir durante uma
reunião com o cliente (Kanban da vaga ou shortlist) sem risco de mexer em
algo sem querer nem mostrar dado interno (valor, comissão).

### 9. Auditoria de decisão de IA
Todo output de IA persistido com o prompt/contexto usado (ver
`modelagem-dados.md`) — permite responder "por que o sistema sugeriu isso"
meses depois, requisito crescente de governança de IA em RH.

### 10. Health score do cliente
Um score composto (frequência de vagas, tempo médio de resposta, taxa de
aprovação de shortlist, NPS) que resume a saúde do relacionamento numa única
métrica visível no perfil da empresa — não apenas cards soltos de KPI.
