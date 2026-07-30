# Fluxos de Usuário

Cada fluxo abaixo cobre o caminho completo — não só a tela, mas o que
acontece antes e depois (dados atualizados, automações disparadas,
notificações enviadas). Papéis conforme `arquitetura.md`.

## 1. Consultor Comercial — nova oportunidade até fechamento

1. Cria oportunidade em `/crm/pipeline-comercial` (botão "Nova oportunidade"
   ou direto no Kanban, coluna "Lead") preenchendo empresa, contato, origem,
   valor estimado, produto/serviço.
2. Move o card entre etapas por drag-and-drop; cada mudança de etapa dispara
   automação configurável (ex.: "Qualificação → Diagnóstico" cria tarefa de
   agendar reunião).
3. Registra atividades (ligação, e-mail, reunião, nota) direto no painel
   lateral do card sem sair do Kanban.
4. Anexa proposta gerada pela skill `propostas-comerciais` como arquivo do
   card.
5. Ao mover para "Ganho": sistema pede confirmação de valor final e data de
   fechamento → atualiza Forecast automaticamente → se o produto for
   Alocação Tech ou Recrutamento, oferece criar a vaga correspondente em
   `/vagas/nova` já pré-preenchida com dados do cliente.
6. Ao mover para "Perdido": exige motivo de perda (campo obrigatório,
   alimenta KPI "Motivos de perda" do Forecast).

## 2. Recrutador — vaga aberta até posição preenchida

1. Vaga chega de duas formas: criada manualmente em `/vagas/nova`, ou
   auto-criada a partir de uma oportunidade "Ganho" no CRM (fluxo 1, passo 5).
2. Recrutador completa a ficha completa da vaga (JD, stack, senioridade,
   modelo de trabalho, salário/faixa, gestor/contato do cliente) — pode usar
   "Gerar Job Description com IA" (ver `diferenciais.md`) a partir de
   cargo + stack + senioridade.
3. Sourcing: busca candidatos existentes na base (`/candidatos/busca`) e/ou
   importa via LinkedIn Recruiter. Sistema sugere candidatos por matching
   inteligente contra a vaga.
4. Move candidatos pelo Kanban da vaga: Abertas → Análise RH → CV Enviado →
   Entrevista Cliente → Forecast → Fechada/Perdida. Cada candidato tem seu
   próprio card dentro da vaga (não confundir com o Pipeline de Vagas, que
   move a vaga inteira — aqui o Kanban é por candidato dentro da vaga, ver
   `wireframes.md`).
5. Ao mover candidato para "CV Enviado", sistema notifica automaticamente o
   contato do cliente (se Portal do Cliente ativo) e registra na timeline.
6. Ao fechar a última posição da vaga, sistema pergunta se fecha a vaga
   inteira, dispara cálculo de comissão (`financeiro/comissoes`) e atualiza
   KPI "Tempo médio de fechamento".

## 3. Executive Search — mapeamento até shortlist confidencial

1. Vaga é criada com flag `confidencial = true` (`consultor_executive_search`
   apenas) — nome do cliente e detalhes só visíveis a quem tem o papel.
2. Mapeamento de mercado registrado em `/executive-search/mapeamento`:
   lista de empresas/alvos e candidatos identificados, sem publicar vaga.
3. Abordagem confidencial registrada como atividade no perfil do candidato
   (não gera notificação pública nem aparece na busca padrão de candidatos).
4. Shortlist apresentada ao cliente via relatório exportável (PDF) — mesma
   estrutura de "relatório de posição" já usada pela skill `executive-search`,
   agora gerada a partir dos dados da plataforma em vez de documento manual.

## 4. Alocação Tech — matching até renovação de contrato

1. Vaga/contrato criado com campos específicos: rate, prazo, modelo
   (remoto/híbrido/presencial), a partir de `/alocacao`.
2. Recrutador busca no pool de talentos (`/alocacao/pool` — candidatos com
   `disponibilidade = disponível` e stack compatível).
3. Ao confirmar alocação, sistema cria registro de contrato com data de
   início/fim e agenda automaticamente um lembrete de renovação (ex.:
   30 dias antes do fim do contrato) — automação nativa, não manual.
4. Ciclo de renovação: sistema notifica consultor e recrutador antes do
   vencimento; decisão (renovar/encerrar/estender) atualiza o contrato e o
   pool de disponibilidade do profissional automaticamente.

## 5. Financeiro — faturamento e comissões

1. Fechamento de oportunidade (fluxo 1) ou de vaga (fluxo 2) gera lançamento
   pendente em `/financeiro/faturamento`.
2. Financeiro concilia contra nota fiscal emitida (fora do sistema, por ora
   — [TODO] Definir com Thiago se há integração contábil futura).
3. Comissão calculada automaticamente por regra configurável por consultor/
   vertical em `/configuracoes/automacoes` → aparece em `/financeiro/comissoes`
   para aprovação antes do pagamento.
4. Receita recorrente (contratos de Alocação Tech em andamento) alimenta o
   card "Receita Recorrente" do Dashboard mês a mês sem lançamento manual.

## 6. Diretoria — visão executiva

1. Acessa `/dashboard/diretoria` — visão agregada, sem ações operacionais
   (não move cards, não edita registros; pode comentar/marcar follow-up).
2. Usa filtros globais para recortar por período/consultor/segmento.
3. Recebe alertas automáticos de gargalo (ver `diferenciais.md`: detecção de
   gargalo de pipeline) sem precisar caçar o dado manualmente.
4. Exporta qualquer dashboard como PDF para reunião de board.

## 7. Portal do Cliente — acompanhamento de vaga

1. Cliente recebe convite por e-mail (magic link) para `/portal-cliente`.
2. Vê apenas vagas da própria empresa, com status simplificado (sem etapas
   internas como "Análise RH" — só "Em andamento", "Shortlist disponível",
   "Fechada").
3. Aprova/reprova candidato da shortlist com comentário — ação gera
   atividade na timeline interna e notifica o recrutador responsável.
4. Não vê valor da vaga, comissão, nem dados de outros clientes (RLS).

## 8. Portal do Candidato — acompanhamento do processo

1. Candidato recebe convite por e-mail ao ser incluído em um processo.
2. Vê etapa atual do próprio processo, sem visibilidade de outros candidatos
   concorrentes nem de dados internos (score, observações do recrutador).
3. Pode atualizar próprio currículo/disponibilidade — mudança gera revisão
   pendente do recrutador antes de refletir no perfil interno (evita que o
   candidato sobrescreva avaliação do recrutador sem revisão).

## 9. Admin — configuração de pipeline

1. Acessa `/configuracoes/pipelines`.
2. Cria/renomeia/exclui/reordena etapa; define cor, SLA, probabilidade
   padrão e obrigatoriedade de campos por etapa (ex.: "Perdido" exige motivo).
3. Mudança reflete imediatamente no Kanban de todos os usuários (realtime) —
   oportunidades/vagas já existentes em uma etapa removida são migradas para
   uma etapa de destino escolhida pelo admin no momento da exclusão (nunca
   perdidas silenciosamente).
