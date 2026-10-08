/**
 * Modelos de pesquisa do Pulso (5 tipos) e a entrevista de desligamento do
 * Offboarding (baseada em journeylab/lib/offboarding/questionario.ts).
 *
 * Pergunta: { id, tipo, texto, dimensao, obrigatoria, opcoes? }
 *   likert  1–5 (Discordo totalmente … Concordo totalmente)
 *   escala  1–5 com rótulos próprios nas pontas (minimo/maximo)
 *   nps     0–10
 *   escolha uma opção ({ id, rotulo, valor 1–5 opcional })
 *   multipla várias opções
 *   simnao  sim/não
 *   texto   resposta aberta
 * O mesmo formato é lido pela página pública (public/responder.html) e
 * validado no banco (bp_responder_pesquisa só aceita ids de perguntas da pesquisa).
 */

export const TIPOS_PERGUNTA = {
  likert: "Concordância (1 a 5)",
  escala: "Escala de 1 a 5",
  nps: "Recomendação (0 a 10)",
  escolha: "Escolha única",
  multipla: "Múltipla escolha",
  simnao: "Sim ou não",
  texto: "Resposta aberta",
};

let seq = 0;
const id = () => `q${++seq}`;
const likert = (texto, dimensao) => ({ id: id(), tipo: "likert", texto, dimensao, obrigatoria: true });
const nps = (texto = "Em uma escala de 0 a 10, o quanto você recomendaria a empresa como um bom lugar para trabalhar?") => ({ id: id(), tipo: "nps", texto, dimensao: "eNPS", obrigatoria: true });
const texto = (t, dimensao = "Comentários", obrigatoria = false) => ({ id: id(), tipo: "texto", texto: t, dimensao, obrigatoria });
const opcoes = (lista, comValor = false) => lista.map((rotulo, i) => ({ id: `o${i + 1}`, rotulo, ...(comValor ? { valor: lista.length - i } : {}) }));
const escolha = (t, dimensao, lista, comValor = true) => ({ id: id(), tipo: "escolha", texto: t, dimensao, obrigatoria: true, opcoes: opcoes(lista, comValor) });
const multipla = (t, dimensao, lista) => ({ id: id(), tipo: "multipla", texto: t, dimensao, obrigatoria: false, opcoes: opcoes(lista) });
const simnao = (t, dimensao) => ({ id: id(), tipo: "simnao", texto: t, dimensao, obrigatoria: true });

function modelo(fn) {
  seq = 0;
  return fn();
}

export const MODELOS = {
  engajamento15: {
    nome: "Pulso de Engajamento",
    resumo: "15 perguntas · 5 minutos. Termômetro de engajamento, clareza, reconhecimento e intenção de permanência.",
    tamanho: 15,
    descricao: "Pesquisa rápida para entender como você está vivendo o trabalho hoje. Leva cerca de 5 minutos.",
    perguntas: modelo(() => [
      nps(),
      likert("Sinto orgulho de trabalhar nesta empresa.", "Engajamento"),
      likert("Tenho clareza sobre o que se espera do meu trabalho.", "Clareza"),
      likert("Meu trabalho é reconhecido de forma justa.", "Reconhecimento"),
      likert("Minha carga de trabalho é sustentável.", "Bem-estar"),
      likert("Recebo apoio da minha liderança quando preciso.", "Liderança"),
      likert("Recebo feedbacks que me ajudam a evoluir.", "Liderança"),
      likert("Tenho as ferramentas e os recursos necessários para trabalhar bem.", "Recursos"),
      likert("A comunicação entre as áreas funciona bem.", "Comunicação"),
      likert("Vejo oportunidades reais de crescimento aqui.", "Desenvolvimento"),
      likert("Sinto que posso expressar opiniões sem receio.", "Segurança psicológica"),
      likert("Pretendo continuar na empresa pelos próximos 12 meses.", "Permanência"),
      escolha("Como você descreve sua energia no trabalho nas últimas semanas?", "Bem-estar", ["Muito alta", "Alta", "Moderada", "Baixa", "Muito baixa"]),
      multipla("O que mais contribui para a sua motivação hoje?", "Motivadores", ["Time", "Liderança", "Propósito do trabalho", "Remuneração", "Aprendizado", "Flexibilidade", "Reconhecimento"]),
      texto("O que a empresa poderia fazer, a partir de agora, para melhorar a sua experiência?"),
    ]),
  },
  bemestar15: {
    nome: "Bem-estar e eNPS",
    resumo: "15 perguntas · 5 minutos. Equilíbrio, pressão, respeito, segurança psicológica e recomendação da empresa.",
    tamanho: 15,
    descricao: "Queremos entender como o trabalho tem impactado o seu bem-estar. Responda com sinceridade.",
    perguntas: modelo(() => [
      nps(),
      likert("Consigo equilibrar o trabalho e a vida pessoal.", "Equilíbrio"),
      likert("Raramente preciso trabalhar além do meu horário.", "Equilíbrio"),
      likert("O nível de pressão no trabalho é saudável.", "Pressão"),
      likert("Sinto-me respeitado(a) pelas pessoas com quem trabalho.", "Respeito"),
      likert("Sei a quem recorrer diante de uma situação de assédio ou desrespeito.", "Respeito"),
      likert("Minha liderança se preocupa com o meu bem-estar.", "Liderança"),
      likert("Tenho autonomia para organizar a minha rotina.", "Autonomia"),
      likert("Sinto-me seguro(a) para falar sobre dificuldades que afetam o meu trabalho.", "Segurança psicológica"),
      likert("O ambiente de trabalho (físico ou remoto) favorece a minha concentração.", "Ambiente"),
      escolha("Com que frequência você termina o dia esgotado(a)?", "Pressão", ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]),
      escolha("Como você avalia o seu nível de estresse no último mês?", "Pressão", ["Muito baixo", "Baixo", "Moderado", "Alto", "Muito alto"]),
      simnao("Você conhece os benefícios de saúde e bem-estar oferecidos pela empresa?", "Benefícios"),
      multipla("Quais iniciativas mais apoiariam o seu bem-estar?", "Iniciativas", ["Flexibilidade de horário", "Trabalho remoto ou híbrido", "Apoio psicológico", "Atividade física", "Pausas programadas", "Redistribuição de demandas", "Programas de saúde"]),
      texto("Há algo afetando o seu bem-estar que a empresa deveria saber?"),
    ]),
  },
  clima30: {
    nome: "Clima Organizacional",
    resumo: "30 perguntas · 10 minutos. Diagnóstico completo: liderança, comunicação, reconhecimento, desenvolvimento, ambiente, processos, remuneração e cultura.",
    tamanho: 30,
    descricao: "Diagnóstico completo do clima da empresa. Leva cerca de 10 minutos e as respostas são tratadas de forma agregada.",
    perguntas: modelo(() => [
      likert("Minha liderança comunica com clareza as prioridades do time.", "Liderança"),
      likert("Minha liderança está disponível quando preciso.", "Liderança"),
      likert("Recebo feedbacks frequentes e úteis da minha liderança.", "Liderança"),
      likert("Minha liderança trata todos do time com justiça.", "Liderança"),
      likert("Confio nas decisões da minha liderança.", "Liderança"),
      likert("Sou informado(a) a tempo sobre as mudanças que me afetam.", "Comunicação"),
      likert("A comunicação entre as áreas é clara e colaborativa.", "Comunicação"),
      likert("Entendo a estratégia e os objetivos da empresa.", "Comunicação"),
      likert("Meu trabalho é reconhecido de forma justa.", "Reconhecimento"),
      likert("As conquistas do time são celebradas.", "Reconhecimento"),
      likert("Os critérios de promoção e mérito são claros.", "Reconhecimento"),
      likert("Tenho oportunidades reais de aprender e me desenvolver.", "Desenvolvimento"),
      likert("Vejo um caminho de carreira possível para mim aqui.", "Desenvolvimento"),
      likert("Recebo treinamento adequado para a minha função.", "Desenvolvimento"),
      likert("Meu potencial é bem aproveitado.", "Desenvolvimento"),
      likert("Tenho um bom relacionamento com os colegas do time.", "Ambiente e relações"),
      likert("Existe espírito de cooperação entre as pessoas.", "Ambiente e relações"),
      likert("Sinto-me à vontade para ser quem eu sou no trabalho.", "Ambiente e relações"),
      likert("Posso discordar e propor ideias sem receio.", "Ambiente e relações"),
      likert("Tenho as ferramentas e os sistemas de que preciso.", "Processos e recursos"),
      likert("Os processos da empresa facilitam o meu trabalho.", "Processos e recursos"),
      likert("Minha carga de trabalho é adequada.", "Processos e recursos"),
      likert("Minha remuneração é compatível com as minhas responsabilidades.", "Remuneração e benefícios"),
      likert("Os benefícios oferecidos atendem às minhas necessidades.", "Remuneração e benefícios"),
      likert("Os valores da empresa são praticados no dia a dia.", "Cultura e valores"),
      likert("Tenho orgulho de trabalhar aqui.", "Cultura e valores"),
      likert("A empresa age com ética e transparência.", "Cultura e valores"),
      nps(),
      likert("Pretendo continuar na empresa pelos próximos 12 meses.", "Permanência"),
      texto("Se você pudesse mudar uma única coisa na empresa, o que seria?"),
    ]),
  },
  lideranca30: {
    nome: "Liderança, Cultura e Desenvolvimento",
    resumo: "30 perguntas · 10 minutos. Avaliação da liderança direta, dos 8 pilares de cultura e das oportunidades de carreira.",
    tamanho: 30,
    descricao: "Avaliação da liderança, da cultura e das oportunidades de desenvolvimento. Leva cerca de 10 minutos.",
    perguntas: modelo(() => [
      likert("Minha liderança define metas claras e alcançáveis.", "Liderança direta"),
      likert("Minha liderança me dá autonomia para executar o trabalho.", "Liderança direta"),
      likert("Minha liderança reconhece as minhas entregas.", "Liderança direta"),
      likert("Recebo feedback estruturado com regularidade.", "Liderança direta"),
      likert("Minha liderança apoia o meu desenvolvimento.", "Liderança direta"),
      likert("Minha liderança é exemplo dos valores da empresa.", "Liderança direta"),
      likert("Minha liderança lida bem com conflitos no time.", "Liderança direta"),
      likert("Tenho conversas individuais (1:1) produtivas com a minha liderança.", "Liderança direta"),
      likert("Aqui há espaço para propor e testar novas ideias.", "Criatividade"),
      likert("As pessoas cumprem os acordos e agem com transparência.", "Confiança"),
      likert("O time é comprometido com o resultado final.", "Compromisso com o resultado"),
      likert("As pessoas assumem responsabilidade além do próprio escopo.", "Senso de dono"),
      likert("A empresa lida bem com mudanças de contexto.", "Adaptabilidade"),
      likert("Diante de obstáculos, o time segue em frente com equilíbrio.", "Resiliência"),
      likert("As decisões consideram o longo prazo, não só o imediato.", "Visão de longo prazo"),
      likert("As pessoas se ajudam e somam esforços entre as áreas.", "Colaboração"),
      likert("Tenho um plano de desenvolvimento claro.", "Desenvolvimento e carreira"),
      likert("Conheço os caminhos de carreira possíveis aqui.", "Desenvolvimento e carreira"),
      likert("Tenho tempo, no horário de trabalho, para aprender.", "Desenvolvimento e carreira"),
      likert("As oportunidades internas são abertas e justas.", "Desenvolvimento e carreira"),
      likert("Recebo desafios compatíveis com o meu potencial.", "Desenvolvimento e carreira"),
      likert("Vejo-me crescendo na empresa nos próximos dois anos.", "Desenvolvimento e carreira"),
      likert("Sei como o meu trabalho contribui para os resultados da empresa.", "Performance e clareza"),
      likert("Os indicadores do meu trabalho são claros.", "Performance e clareza"),
      likert("As prioridades do time são estáveis o suficiente para eu planejar.", "Performance e clareza"),
      likert("O retrabalho no meu dia a dia é baixo.", "Performance e clareza"),
      likert("Tenho os recursos necessários para entregar com qualidade.", "Performance e clareza"),
      nps(),
      multipla("Em quais temas você mais gostaria de se desenvolver?", "Interesses de desenvolvimento", ["Liderança", "Comunicação", "Técnico da função", "Gestão de projetos", "Dados e tecnologia", "Negócios e estratégia", "Inteligência emocional"]),
      texto("O que a sua liderança poderia fazer diferente para apoiar você?"),
    ]),
  },
  personalizada: {
    nome: "Personalizada",
    resumo: "Você escolhe e escreve as perguntas (até 40), com os tipos de resposta que quiser.",
    tamanho: null,
    descricao: "",
    perguntas: [],
  },
};

export const TIPOS_PULSO = ["engajamento15", "bemestar15", "clima30", "lideranca30", "personalizada"];

/** Entrevista de desligamento: questionário fixo, comparável entre pessoas e no tempo. */
export const ENTREVISTA_DESLIGAMENTO = modelo(() => [
  { ...multipla("Quais fatores pesaram na sua decisão de sair? (marque até 5)", "Motivos", ["Remuneração e benefícios", "Crescimento e carreira", "Liderança direta", "Cultura e ambiente", "Carga de trabalho e equilíbrio", "Reconhecimento", "Proposta de outra empresa", "Modelo de trabalho e flexibilidade", "Motivos pessoais", "Outro motivo"]), obrigatoria: true, maximo: 5 },
  escolha("Qual foi o principal motivo?", "Motivo principal", ["Remuneração e benefícios", "Crescimento e carreira", "Liderança direta", "Cultura e ambiente", "Carga de trabalho e equilíbrio", "Reconhecimento", "Proposta de outra empresa", "Modelo de trabalho e flexibilidade", "Motivos pessoais", "Outro motivo"], false),
  { ...escolha("Relação com a liderança direta", "Experiência", ["Muito satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito insatisfeito"]) },
  { ...escolha("Reconhecimento pelo trabalho", "Experiência", ["Muito satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito insatisfeito"]) },
  { ...escolha("Remuneração e benefícios", "Experiência", ["Muito satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito insatisfeito"]) },
  { ...escolha("Oportunidades de crescimento", "Experiência", ["Muito satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito insatisfeito"]) },
  { ...escolha("Carga de trabalho e equilíbrio", "Experiência", ["Muito satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito insatisfeito"]) },
  { ...escolha("Ambiente e relação com colegas", "Experiência", ["Muito satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito insatisfeito"]) },
  { ...escolha("Clareza do papel e das expectativas", "Experiência", ["Muito satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito insatisfeito"]) },
  { ...escolha("Integração (onboarding) ao chegar", "Experiência", ["Muito satisfeito", "Satisfeito", "Neutro", "Insatisfeito", "Muito insatisfeito"]) },
  escolha("Algo poderia ter evitado a sua saída?", "Evitável", ["Sim", "Talvez", "Não"], false),
  texto("Se sim, o que poderia ter evitado?", "Evitável"),
  nps("De 0 a 10, o quanto você recomendaria a empresa como lugar para trabalhar?"),
  escolha("Você voltaria a trabalhar na empresa?", "Recontratação", ["Sim", "Talvez", "Não"], false),
  escolha("Qual o seu próximo passo?", "Destino", ["Outra empresa do mesmo setor", "Empresa de outro setor", "Empreender", "Estudos", "Pausa na carreira", "Ainda não sei", "Prefiro não dizer"], false),
  texto("Que sugestões você deixa para a empresa?", "Sugestões"),
]);

/** Pergunta nova (editor da pesquisa personalizada). */
export function novaPergunta(tipo = "likert") {
  const base = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tipo, texto: "", dimensao: "Geral", obrigatoria: tipo !== "texto" };
  if (tipo === "escolha" || tipo === "multipla") base.opcoes = opcoes(["Opção 1", "Opção 2", "Opção 3"]);
  if (tipo === "escala") Object.assign(base, { minimo: "Muito baixo", maximo: "Muito alto" });
  return base;
}

/** Link público da pesquisa. */
export function linkPublico(base, token) {
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set("t", token);
  return url.toString();
}
