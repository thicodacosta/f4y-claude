import type { PeopleAnalytics } from "./indicadores";
import { compararReferencia, REFERENCIAS, valorReferencia, type ChaveReferencia } from "./referencias";
import { nomeMotivo } from "@/lib/offboarding/motivos";
import { formatarNumero } from "@/lib/formato";

/**
 * Inteligência do People Analytics: regras explícitas (auditáveis) que leem os
 * indicadores e devolvem insights, ações necessárias e o comparativo com as
 * referências. Nada aqui é "caixa-preta": cada insight diz de onde veio.
 */

export type Severidade = "critico" | "atencao" | "positivo" | "info";
export type Insight = { id: string; severidade: Severidade; tema: string; titulo: string; texto: string; recomendacao: string; href?: string; rotuloLink?: string };
export type AcaoNecessaria = { id: string; prioridade: 1 | 2 | 3; titulo: string; detalhe: string; href: string };

const n1 = (v: number) => formatarNumero(v, 1);

export function gerarInsights(d: PeopleAnalytics): Insight[] {
  const out: Insight[] = [];
  const ref = (k: ChaveReferencia) => valorReferencia(d.config, k);
  const t = d.turnover;

  // Turnover x referência
  if (t.turnoverAnualizado !== null && d.pessoas.headcount >= 3) {
    const r = ref("turnoverAnual");
    if (t.turnoverAnualizado > r * 1.2)
      out.push({
        id: "turnover-alto",
        severidade: "critico",
        tema: "Turnover",
        titulo: `Turnover anualizado de ${n1(t.turnoverAnualizado)}% está acima da referência (${r}%)`,
        texto: `No período foram ${t.saidas} saída(s) para um headcount médio de ${n1(t.hcMedio)}. ${t.voluntarias} foram voluntárias.`,
        recomendacao: "Priorize as áreas e gestores com mais saídas e trate os motivos reais apontados nas entrevistas de desligamento.",
        href: "/retencao",
        rotuloLink: "Abrir Retenção",
      });
    else if (t.turnoverAnualizado <= r * 0.8 && t.saidas > 0)
      out.push({
        id: "turnover-bom",
        severidade: "positivo",
        tema: "Turnover",
        titulo: `Turnover anualizado de ${n1(t.turnoverAnualizado)}% abaixo da referência (${r}%)`,
        texto: "A organização retém melhor do que a referência configurada.",
        recomendacao: "Documente as práticas das áreas com menor turnover e replique-as.",
      });
  }
  // Tendência da série
  if (d.serie.length >= 6 && d.tendencia > 0.4)
    out.push({
      id: "tendencia-alta",
      severidade: "atencao",
      tema: "Tendência",
      titulo: "Turnover mensal em tendência de alta",
      texto: `A taxa mensal sobe em média ${n1(d.tendencia)} ponto(s) por mês na série analisada.`,
      recomendacao: "Antecipe conversas de permanência com as pessoas em risco alto e revise mudanças recentes (liderança, metas, remuneração).",
      href: "/retencao/risco",
      rotuloLink: "Ver risco de saída",
    });
  // Voluntário predominante
  if (t.saidas >= 3 && t.voluntarias / t.saidas >= 0.6)
    out.push({
      id: "voluntario",
      severidade: "atencao",
      tema: "Turnover",
      titulo: `${Math.round((t.voluntarias / t.saidas) * 100)}% das saídas foram por iniciativa do colaborador`,
      texto: "Saídas voluntárias são, em geral, as mais evitáveis e as que mais custam em conhecimento perdido.",
      recomendacao: "Cruze com os motivos reais das entrevistas e monte ações de retenção por fator (liderança, carreira, remuneração).",
      href: "/retencao/acoes",
      rotuloLink: "Planejar ações",
    });
  // Saída precoce
  if (t.saidas >= 2) {
    const p = (t.precoces / t.saidas) * 100;
    if (p > ref("saidaPrecoce"))
      out.push({
        id: "precoce",
        severidade: p >= ref("saidaPrecoce") * 2 ? "critico" : "atencao",
        tema: "Atração e integração",
        titulo: `${Math.round(p)}% das saídas aconteceram nos primeiros 90 dias`,
        texto: `Referência: até ${ref("saidaPrecoce")}%. Saídas precoces indicam desalinhamento de expectativa na seleção ou falhas na integração.`,
        recomendacao: "Revise a descrição das vagas e as entrevistas (fit com o papel) e acompanhe os marcos 30/60/90 do onboarding.",
        href: "/onboarding",
        rotuloLink: "Abrir Onboarding",
      });
  }
  // Perdas lamentadas
  if (t.lamentadas > 0)
    out.push({
      id: "lamentadas",
      severidade: t.lamentadas >= 2 ? "critico" : "atencao",
      tema: "Talentos",
      titulo: `${t.lamentadas} perda(s) lamentada(s) no período`,
      texto: "Saídas que a empresa gostaria de ter evitado — geralmente de pessoas de alto desempenho ou difíceis de repor.",
      recomendacao: "Identifique talentos-chave com risco médio/alto e faça conversas de permanência (stay interviews) nas próximas duas semanas.",
      href: "/retencao/risco",
      rotuloLink: "Talentos em risco",
    });
  // Áreas fora da curva
  const base = t.turnoverAnualizado ?? 0;
  for (const a of d.porArea.filter((x) => x.saidas >= 2 && x.turnoverAnualizado !== null && base > 0 && x.turnoverAnualizado >= base * 1.5).slice(0, 2))
    out.push({
      id: `area-${a.id}`,
      severidade: "atencao",
      tema: "Áreas",
      titulo: `${a.nome}: turnover de ${n1(a.turnoverAnualizado!)}% (${n1(a.turnoverAnualizado! / base)}× a média)`,
      texto: `${a.saidas} saída(s) no período, ${a.voluntarias} voluntária(s), para ${a.headcount} pessoa(s) hoje.`,
      recomendacao: "Converse com a liderança da área, rode um Pulse focado e acompanhe o plano de ação.",
      href: `/people-analytics?area=${a.id}&periodo=${d.periodo.chave}`,
      rotuloLink: "Filtrar pela área",
    });
  // Gestores com saídas recorrentes
  for (const g of d.porGestor.slice(0, 2))
    out.push({
      id: `gestor-${g.id}`,
      severidade: "atencao",
      tema: "Liderança",
      titulo: `${g.saidasVoluntarias} saídas voluntárias na equipe de ${g.nome} em 12 meses`,
      texto: "Saídas concentradas sob a mesma liderança costumam indicar estilo de gestão, sobrecarga ou falta de perspectiva na equipe.",
      recomendacao: "Inclua a liderança em desenvolvimento (feedback, 1:1, gestão de pessoas) e acompanhe o clima da equipe.",
      href: "/retencao/acoes",
      rotuloLink: "Criar ação",
    });
  // Motivos reais
  if (d.saida && d.saida.principaisReais.length) {
    const top = d.saida.principaisReais[0];
    out.push({
      id: "motivo-real",
      severidade: "info",
      tema: "Motivos de saída",
      titulo: `Principal motivo real de saída: ${nomeMotivo(top.chave)}`,
      texto: `Apontado como principal em ${top.n} de ${d.saida.entrevistadas} entrevista(s) de desligamento.`,
      recomendacao: "Use o playbook do fator em Retenção › Ações para montar o plano.",
      href: "/retencao/acoes",
      rotuloLink: "Ver playbook",
    });
    if (d.saida.divergencia !== null && d.saida.divergencia >= 40)
      out.push({
        id: "divergencia",
        severidade: "atencao",
        tema: "Motivos de saída",
        titulo: `Em ${Math.round(d.saida.divergencia)}% dos casos o motivo real difere do informado no desligamento`,
        texto: "O motivo registrado na saída nem sempre é o verdadeiro — a entrevista confidencial revela o que pesou de fato.",
        recomendacao: "Garanta a entrevista em todas as saídas voluntárias e conduza-a com alguém que não seja o gestor direto.",
        href: "/offboarding",
        rotuloLink: "Abrir Offboarding",
      });
    const pior = d.saida.experiencia.find((e) => e.media !== null);
    if (pior && pior.media! < 3)
      out.push({
        id: "experiencia",
        severidade: "atencao",
        tema: "Experiência",
        titulo: `Pior avaliação na saída: ${pior.nome} (${n1(pior.media!)} de 5)`,
        texto: "Média das notas dadas por quem saiu, em todas as entrevistas do período.",
        recomendacao: "Trate este tema também com quem fica: inclua-o no próximo Pulse e nas conversas de 1:1.",
      });
    if (d.saida.enps !== null && d.saida.enps < ref("enpsSaida"))
      out.push({
        id: "enps-saida",
        severidade: "atencao",
        tema: "Marca empregadora",
        titulo: `eNPS de saída negativo (${d.saida.enps})`,
        texto: "Quem sai tende a não recomendar a empresa — impacto direto na marca empregadora e na atração.",
        recomendacao: "Cuide da experiência de desligamento (comunicação, acerto, carta de referência) e acompanhe avaliações públicas.",
      });
  }
  // Feedback
  if (d.feedback && d.feedback.cobertura90d !== null && d.feedback.cobertura90d < ref("coberturaFeedback"))
    out.push({
      id: "feedback",
      severidade: d.feedback.cobertura90d < ref("coberturaFeedback") / 2 ? "critico" : "atencao",
      tema: "Desenvolvimento",
      titulo: `Só ${Math.round(d.feedback.cobertura90d)}% das pessoas tiveram feedback nos últimos 90 dias`,
      texto: `Referência: ${ref("coberturaFeedback")}%. Ausência de feedback é um dos sinais mais consistentes de risco de saída.`,
      recomendacao: "Peça aos gestores para regularizar a cadência e registre os feedbacks no módulo.",
      href: "/feedback#cadencia",
      rotuloLink: "Ver cadência",
    });
  if (d.feedback && d.feedback.mediaGeral !== null && d.feedback.mediaAnterior !== null && d.feedback.mediaAnterior - d.feedback.mediaGeral >= 0.3)
    out.push({
      id: "feedback-queda",
      severidade: "atencao",
      tema: "Desempenho",
      titulo: `Média geral dos feedbacks caiu de ${n1(d.feedback.mediaAnterior)} para ${n1(d.feedback.mediaGeral)}`,
      texto: "Comparação com o período anterior de mesma duração.",
      recomendacao: "Investigue causas (metas, carga, mudanças de liderança) antes que virem saídas.",
    });
  // PDI
  if (d.pdi && d.pdi.cobertura !== null && d.pdi.cobertura < ref("coberturaPdi"))
    out.push({
      id: "pdi",
      severidade: "atencao",
      tema: "Carreira",
      titulo: `${Math.round(d.pdi.cobertura)}% das pessoas têm PDI ativo (referência ${ref("coberturaPdi")}%)`,
      texto: "Falta de perspectiva de crescimento é um dos motivos de saída mais citados no mercado.",
      recomendacao: "Comece pelos talentos-chave e por quem está há mais de 1 ano sem plano.",
      href: "/pdi",
      rotuloLink: "Abrir PDI",
    });
  if (d.riscos) {
    const talentos = d.riscos.filter((r) => r.talentoChave && r.nivel !== "baixo");
    if (talentos.length)
      out.push({
        id: "talentos-risco",
        severidade: "critico",
        tema: "Talentos",
        titulo: `${talentos.length} talento(s)-chave com risco médio ou alto de saída`,
        texto: "Pessoas com feedback verde e média ≥ 4 que acumulam sinais de risco.",
        recomendacao: "Converse individualmente, alinhe próximos passos de carreira e registre uma ação de retenção para cada uma.",
        href: "/retencao/risco?nivel=alto",
        rotuloLink: "Ver pessoas",
      });
  }
  // Atração
  if (d.atracao) {
    const a = d.atracao;
    if (a.timeToFill !== null && a.timeToFill > ref("timeToFill"))
      out.push({
        id: "ttf",
        severidade: "atencao",
        tema: "Atração",
        titulo: `Vagas levam ${Math.round(a.timeToFill)} dias para fechar (referência ${ref("timeToFill")})`,
        texto: "Tempo de vaga aberta pressiona as equipes e aumenta a carga — fator de saída por si só.",
        recomendacao: "Use o Pipeline de Vagas para destravar etapas paradas e defina prazos por prioridade.",
        href: "/pipeline-vagas",
        rotuloLink: "Abrir Pipeline",
      });
    if (a.vagasAtrasadas > 0)
      out.push({
        id: "vagas-atrasadas",
        severidade: "atencao",
        tema: "Atração",
        titulo: `${a.vagasAtrasadas} vaga(s) com prazo de fechamento vencido`,
        texto: "Vagas abertas além do prazo combinado com a área.",
        recomendacao: "Revise o perfil, amplie as fontes (Página de Carreiras, indicação) ou repactue o prazo.",
        href: "/pipeline-vagas",
        rotuloLink: "Ver vagas",
      });
    const ent = a.funil.find((f) => f.etapa === "Entrevista")?.n ?? 0;
    if (ent >= 5 && a.contratacoes / ent < 0.1)
      out.push({
        id: "funil",
        severidade: "info",
        tema: "Atração",
        titulo: "Baixa conversão de entrevista para contratação",
        texto: `${a.contratacoes} contratação(ões) para ${ent} candidaturas que chegaram à entrevista.`,
        recomendacao: "Calibre o perfil com o gestor e revise a proposta de valor (remuneração, modelo de trabalho).",
      });
  }
  if (d.onboarding && d.onboarding.noPrazo !== null && d.onboarding.noPrazo < ref("onboardingNoPrazo"))
    out.push({
      id: "onboarding",
      severidade: "atencao",
      tema: "Integração",
      titulo: `${Math.round(d.onboarding.noPrazo)}% dos onboardings concluídos no prazo`,
      texto: `Referência: ${ref("onboardingNoPrazo")}%. ${d.onboarding.tarefasAtrasadas} tarefa(s) atrasada(s) em onboardings em andamento.`,
      recomendacao: "Cobre os responsáveis das tarefas atrasadas — integração ruim antecipa saídas.",
      href: "/onboarding?visao=painel",
      rotuloLink: "Ver alertas",
    });
  if (d.pulse && d.pulse.adesao !== null && d.pulse.adesao < ref("adesaoPulse"))
    out.push({
      id: "pulse-adesao",
      severidade: "info",
      tema: "Escuta",
      titulo: `Adesão média às pesquisas de ${Math.round(d.pulse.adesao)}%`,
      texto: `Referência: ${ref("adesaoPulse")}%. Baixa adesão costuma refletir desconfiança no anonimato ou falta de retorno sobre resultados anteriores.`,
      recomendacao: "Comunique o que mudou a partir da última pesquisa antes de lançar a próxima.",
    });
  if (d.pulse && d.pulse.enps !== null && d.pulse.enps < ref("enps"))
    out.push({
      id: "pulse-enps",
      severidade: d.pulse.enps < 0 ? "critico" : "atencao",
      tema: "Clima",
      titulo: `eNPS de clima em ${d.pulse.enps} (referência ${ref("enps")})`,
      texto: `Pesquisa: ${d.pulse.enpsPesquisa}.`,
      recomendacao: "Analise os comentários da pesquisa e defina 2 ou 3 compromissos visíveis com as equipes.",
      href: "/pulse",
      rotuloLink: "Abrir Pulse",
    });
  if (d.nr1 && d.nr1.riscosAltos > 0)
    out.push({
      id: "nr1",
      severidade: d.nr1.acoesAtrasadas ? "critico" : "atencao",
      tema: "Saúde",
      titulo: `${d.nr1.riscosAltos} risco(s) psicossocial(is) de prioridade alta em aberto`,
      texto: `${d.nr1.acoesAtrasadas} medida(s) do plano de ação atrasada(s).`,
      recomendacao: "Riscos psicossociais altos elevam afastamentos e saídas — acompanhe o plano com SST e lideranças.",
      href: "/nr1",
      rotuloLink: "Abrir NR-1",
    });
  if (d.custo && d.turnover.saidas)
    out.push({
      id: "custo",
      severidade: "info",
      tema: "Custo",
      titulo: `Custo estimado do turnover: ${d.custo.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`,
      texto: `${d.turnover.saidas} saída(s) × ${d.custo.porSaida.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} por reposição (premissas da organização).`,
      recomendacao: "Use o valor para dimensionar o investimento em ações de retenção.",
    });
  const ordem: Record<Severidade, number> = { critico: 0, atencao: 1, info: 2, positivo: 3 };
  return out.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}

/** Ações necessárias, priorizadas (1 = esta semana). */
export function gerarAcoesNecessarias(d: PeopleAnalytics, pendencias: { entrevistasPendentes: number }): AcaoNecessaria[] {
  const out: AcaoNecessaria[] = [];
  if (d.riscos) {
    const alto = d.riscos.filter((r) => r.nivel === "alto" && r.acoesAbertas === 0);
    if (alto.length) out.push({ id: "risco", prioridade: 1, titulo: `Criar ação de retenção para ${alto.length} pessoa(s) em risco alto`, detalhe: alto.slice(0, 3).map((r) => r.nome).join(", ") + (alto.length > 3 ? "…" : ""), href: "/retencao/risco?nivel=alto" });
  }
  if (pendencias.entrevistasPendentes)
    out.push({ id: "entrevistas", prioridade: 1, titulo: `Conduzir ${pendencias.entrevistasPendentes} entrevista(s) de desligamento pendente(s)`, detalhe: "Quanto mais perto da saída, mais fiel o relato.", href: "/offboarding?entrevista=pendente" });
  if (d.acoesRetencao?.atrasadas) out.push({ id: "acoes-atrasadas", prioridade: 1, titulo: `${d.acoesRetencao.atrasadas} ação(ões) de retenção atrasada(s)`, detalhe: "Atualize a situação ou repactue o prazo.", href: "/retencao/acoes?situacao=atrasadas" });
  if (d.nr1?.acoesAtrasadas) out.push({ id: "nr1", prioridade: 1, titulo: `${d.nr1.acoesAtrasadas} medida(s) do plano NR-1 atrasada(s)`, detalhe: "Exigência legal de gerenciamento de riscos.", href: "/nr1" });
  if (d.feedback && d.feedback.cobertura90d !== null && d.feedback.cobertura90d < 80) out.push({ id: "feedback", prioridade: 2, titulo: "Regularizar a cadência de feedback", detalhe: `Cobertura de ${Math.round(d.feedback.cobertura90d)}% nos últimos 90 dias.`, href: "/feedback#cadencia" });
  if (d.atracao?.vagasAtrasadas) out.push({ id: "vagas", prioridade: 2, titulo: `Destravar ${d.atracao.vagasAtrasadas} vaga(s) com prazo vencido`, detalhe: "Revise etapa, perfil e fontes no Pipeline.", href: "/pipeline-vagas" });
  if (d.onboarding?.tarefasAtrasadas) out.push({ id: "onboarding", prioridade: 2, titulo: `${d.onboarding.tarefasAtrasadas} tarefa(s) de onboarding atrasada(s)`, detalhe: "Integração em dia reduz saídas precoces.", href: "/onboarding?visao=painel" });
  if (d.pdi?.emRisco) out.push({ id: "pdi", prioridade: 3, titulo: `${d.pdi.emRisco} PDI(s) com ações vencidas`, detalhe: "Retome nos próximos 1:1.", href: "/pdi?status=em_risco" });
  return out.sort((a, b) => a.prioridade - b.prioridade);
}

export type LinhaComparativo = { chave: ChaveReferencia; nome: string; unidade: string; valor: number | null; referencia: number; leitura: "melhor" | "em_linha" | "pior" | null; ajuda: string };

/** Comparativo com as referências (de mercado ou metas internas configuradas). */
export function comparativo(d: PeopleAnalytics): LinhaComparativo[] {
  const t12 = d.turnover12m;
  const valores: Partial<Record<ChaveReferencia, number | null>> = {
    turnoverAnual: t12.turnoverAnualizado,
    turnoverVoluntarioAnual: t12.turnoverVoluntarioAnualizado,
    saidaPrecoce: t12.saidas ? Math.round((t12.precoces / t12.saidas) * 1000) / 10 : null,
    retencao12m: d.pessoas.retencao12m,
    timeToFill: d.atracao?.timeToFill ?? null,
    coberturaFeedback: d.feedback?.cobertura90d ?? null,
    onboardingNoPrazo: d.onboarding?.noPrazo ?? null,
    coberturaPdi: d.pdi?.cobertura ?? null,
    adesaoPulse: d.pulse?.adesao ?? null,
    enps: d.pulse?.enps ?? null,
    enpsSaida: d.saida?.enps ?? null,
  };
  return (Object.keys(REFERENCIAS) as ChaveReferencia[]).map((k) => {
    const valor = valores[k] ?? null;
    const referencia = valorReferencia(d.config, k);
    return { chave: k, nome: REFERENCIAS[k].nome, unidade: REFERENCIAS[k].unidade, valor, referencia, leitura: compararReferencia(k, valor, referencia)?.leitura ?? null, ajuda: REFERENCIAS[k].ajuda };
  });
}
