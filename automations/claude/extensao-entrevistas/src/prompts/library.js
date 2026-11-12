/**
 * Biblioteca de prompts para RH. Trechos entre [colchetes] são campos para o
 * usuário preencher antes de usar o prompt em qualquer assistente de IA.
 */

export const CATEGORIES = [
  "Recrutamento",
  "Entrevistas",
  "Executive Search",
  "Onboarding",
  "Desempenho",
  "Remuneração",
  "Desenvolvimento",
  "Clima e engajamento",
  "People Analytics",
  "Desligamento e retenção",
];

export const PROMPTS = [
  // ---- Recrutamento ---------------------------------------------------------
  {
    id: "rec-01",
    categoria: "Recrutamento",
    titulo: "Descrição de vaga consultiva",
    descricao: "Redige uma JD completa, atrativa e sem vieses a partir de poucas informações.",
    prompt: `Atue como consultor sênior de Recruitment. Escreva uma descrição de vaga para [CARGO], na empresa [EMPRESA / SETOR / PORTE], modelo [PRESENCIAL/HÍBRIDO/REMOTO] em [CIDADE].

Contexto da posição: [POR QUE A VAGA EXISTE, PARA QUEM REPORTA, TAMANHO DO TIME]
Principais entregas nos primeiros 12 meses: [ENTREGAS]
Requisitos obrigatórios: [LISTA]
Diferenciais: [LISTA]

Estruture em: sobre a empresa, o desafio, responsabilidades, o que buscamos (obrigatório x desejável), o que oferecemos. Use linguagem inclusiva e neutra em gênero, evite jargões e requisitos que não sejam realmente necessários, e mantenha tom consultivo e sofisticado.`,
  },
  {
    id: "rec-02",
    categoria: "Recrutamento",
    titulo: "String de busca booleana",
    descricao: "Cria strings de busca para LinkedIn Recruiter e Google X-Ray.",
    prompt: `Crie 3 strings de busca booleana para encontrar profissionais de [CARGO] com experiência em [COMPETÊNCIAS-CHAVE], em [LOCALIDADE].

1. Versão ampla para LinkedIn Recruiter.
2. Versão restrita (alta precisão) para LinkedIn Recruiter.
3. Versão Google X-Ray (site:linkedin.com/in).

Inclua sinônimos e variações de título em português e inglês, termos a excluir (ex.: estagiário, vendedor) e explique em uma linha a lógica de cada string.`,
  },
  {
    id: "rec-03",
    categoria: "Recrutamento",
    titulo: "Mapa de empresas-alvo para sourcing",
    descricao: "Lista empresas onde buscar talentos para uma posição.",
    prompt: `Estou recrutando [CARGO] para [EMPRESA / SETOR]. Liste 20 empresas-alvo no Brasil onde é provável encontrar esse perfil, agrupadas em: concorrentes diretos, empresas de setores adjacentes e empresas com cultura/processo semelhantes.

Para cada grupo, explique por que os profissionais de lá seriam aderentes e que riscos observar (ex.: diferença salarial, cultura). Sinalize quando a informação for uma suposição a validar.`,
  },
  {
    id: "rec-04",
    categoria: "Recrutamento",
    titulo: "Mensagem de abordagem a candidato passivo",
    descricao: "Mensagens curtas e personalizadas para InMail ou e-mail.",
    prompt: `Escreva 3 versões de mensagem de primeira abordagem para [NOME], hoje [CARGO ATUAL] na [EMPRESA ATUAL], para a posição de [CARGO] em [EMPRESA CLIENTE OU "empresa confidencial do setor X"].

Pontos de conexão com o perfil: [O QUE NO PERFIL DELE(A) CHAMOU ATENÇÃO]
Atrativos da oportunidade: [ESCOPO, DESAFIO, CRESCIMENTO]

Regras: até 600 caracteres, tom consultivo e respeitoso, sem exageros, com uma pergunta final que facilite a resposta. Uma versão mais direta, uma mais relacional e uma para follow-up após 5 dias sem resposta.`,
  },
  {
    id: "rec-05",
    categoria: "Recrutamento",
    titulo: "Critérios de triagem de currículos",
    descricao: "Transforma a JD em uma matriz objetiva de triagem.",
    prompt: `A partir da descrição de vaga abaixo, crie uma matriz de triagem de currículos com:
- critérios eliminatórios (no máximo 4);
- critérios classificatórios com peso de 1 a 3;
- o que conta como evidência de cada critério no currículo;
- sinais de alerta que merecem validação (não eliminação).

Garanta que nenhum critério discrimine por idade, gênero, origem ou outras características pessoais.

Descrição da vaga:
[COLE A JD]`,
  },

  // ---- Entrevistas ------------------------------------------------------------
  {
    id: "ent-01",
    categoria: "Entrevistas",
    titulo: "Roteiro de entrevista por competências",
    descricao: "Perguntas comportamentais (STAR) alinhadas às competências da vaga.",
    prompt: `Monte um roteiro de entrevista de 60 minutos para [CARGO], avaliando as competências: [COMPETÊNCIA 1], [COMPETÊNCIA 2], [COMPETÊNCIA 3], [COMPETÊNCIA 4].

Para cada competência: 2 perguntas comportamentais no formato STAR, 1 pergunta de aprofundamento e o que caracteriza uma resposta forte x fraca. Inclua abertura (5 min), perguntas técnicas sobre [TEMA TÉCNICO] e fechamento com espaço para perguntas do candidato.`,
  },
  {
    id: "ent-02",
    categoria: "Entrevistas",
    titulo: "Estudo de caso para entrevista",
    descricao: "Cria um case prático realista e sua rubrica de avaliação.",
    prompt: `Crie um estudo de caso para avaliar candidatos a [CARGO] em [SETOR], resolvível em [TEMPO] minutos.

Inclua: contexto da empresa fictícia, dados necessários (tabela simples, se fizer sentido), a pergunta central, entregável esperado e uma rubrica de avaliação com 4 critérios e 3 níveis (abaixo, dentro e acima do esperado). O caso deve medir [HABILIDADES A AVALIAR] e não exigir conhecimento específico da nossa empresa.`,
  },
  {
    id: "ent-03",
    categoria: "Entrevistas",
    titulo: "Perguntas para validar lacunas do currículo",
    descricao: "Perguntas objetivas para esclarecer pontos em aberto.",
    prompt: `Analise o currículo abaixo frente aos requisitos da vaga de [CARGO] e liste os pontos que precisam ser validados em entrevista (lacunas, informações vagas, trocas de emprego, escopo pouco claro).

Para cada ponto, sugira uma pergunta aberta, neutra e respeitosa, sem presumir nada negativo. Não aborde temas pessoais (idade, família, saúde, religião).

Requisitos: [LISTA]
Currículo: [COLE O CURRÍCULO]`,
  },
  {
    id: "ent-04",
    categoria: "Entrevistas",
    titulo: "Parecer de entrevista estruturado",
    descricao: "Organiza anotações soltas em um parecer claro para o gestor.",
    prompt: `Transforme minhas anotações de entrevista em um parecer estruturado para o gestor da vaga de [CARGO].

Estrutura: resumo do perfil (3 linhas), aderência aos requisitos (atende / parcial / não evidenciado, com evidência), competências observadas (em linguagem de evidência, nunca traço de personalidade), motivação, disponibilidade e pretensão (se abordados), pontos de atenção a validar e recomendação de próximos passos.

Use apenas o que está nas anotações. Não invente informações.

Anotações: [COLE AS ANOTAÇÕES]`,
  },
  {
    id: "ent-05",
    categoria: "Entrevistas",
    titulo: "Checagem de referências",
    descricao: "Roteiro de conversa com ex-gestores e pares.",
    prompt: `Crie um roteiro de checagem de referências (15 minutos) para o candidato [NOME] à vaga de [CARGO], a ser feito com [EX-GESTOR / PAR / LIDERADO].

Inclua: abertura explicando o propósito e a confidencialidade, perguntas para confirmar período e escopo, perguntas sobre [COMPETÊNCIAS CRÍTICAS] com pedido de exemplos concretos, pergunta sobre pontos de desenvolvimento e a pergunta "você o(a) recontrataria? por quê?". Evite perguntas sobre vida pessoal ou saúde.`,
  },

  // ---- Executive Search -------------------------------------------------------
  {
    id: "exe-01",
    categoria: "Executive Search",
    titulo: "Relatório de posição (position spec)",
    descricao: "Documento executivo que apresenta a posição a candidatos C-level.",
    prompt: `Redija um relatório de posição (position specification) para [CARGO C-LEVEL] na [EMPRESA / SETOR / FATURAMENTO APROXIMADO].

Seções: a empresa e o momento estratégico, a oportunidade, principais desafios dos primeiros 18 meses, responsabilidades, perfil buscado (experiências, competências de liderança), estrutura de reporte e time, e o que torna a posição atraente. Tom sofisticado e confidencial, adequado a executivos seniores. Informações disponíveis: [CONTEXTO]`,
  },
  {
    id: "exe-02",
    categoria: "Executive Search",
    titulo: "Mapeamento de mercado executivo",
    descricao: "Estrutura um market map para uma busca executiva.",
    prompt: `Estruture um mapeamento de mercado para a busca de [CARGO EXECUTIVO] em [SETOR], no Brasil e [OUTROS PAÍSES, SE HOUVER].

Defina: universo de empresas-alvo (por segmento e porte), títulos equivalentes a buscar, critérios de priorização dos nomes, campos da planilha de mapeamento (empresa, nome, cargo, tempo no cargo, escopo, status de contato, observações) e uma forma de apresentar o resultado ao cliente em um slide. Não invente nomes de pessoas.`,
  },
  {
    id: "exe-03",
    categoria: "Executive Search",
    titulo: "Abordagem confidencial a executivo",
    descricao: "Mensagem discreta para executivos sem revelar o cliente.",
    prompt: `Escreva uma mensagem de abordagem confidencial para um(a) [CARGO ATUAL] de [TIPO DE EMPRESA], convidando para uma conversa sobre uma posição de [CARGO] em "uma empresa líder do setor [SETOR]", sem revelar o nome do cliente.

A mensagem deve: transmitir discrição e credibilidade da consultoria, citar 2 elementos do desafio que tornam a posição relevante ([ELEMENTOS]), propor uma conversa de 20 minutos e ter no máximo 700 caracteres.`,
  },
  {
    id: "exe-04",
    categoria: "Executive Search",
    titulo: "Apresentação de shortlist ao cliente",
    descricao: "Resumo comparativo dos finalistas para o comitê.",
    prompt: `Monte a apresentação da shortlist para a posição de [CARGO] no cliente [EMPRESA]. Para cada finalista: trajetória em 4 linhas, principais realizações relevantes, aderência aos critérios da busca, motivação para a mudança, pontos a explorar na entrevista com o cliente, pretensão e disponibilidade.

Feche com uma visão comparativa em tabela (critério x candidato) e a recomendação da consultoria sobre a ordem das entrevistas.

Dados dos finalistas: [COLE AS INFORMAÇÕES]`,
  },
  {
    id: "exe-05",
    categoria: "Executive Search",
    titulo: "Avaliação de fit de liderança",
    descricao: "Perguntas para avaliar estilo de liderança em entrevistas executivas.",
    prompt: `Crie um roteiro para avaliar o estilo de liderança de candidatos a [CARGO EXECUTIVO] em uma empresa que está em [MOMENTO: TURNAROUND / CRESCIMENTO / IPO / SUCESSÃO / INTEGRAÇÃO PÓS-M&A].

Inclua perguntas sobre: construção e renovação de times, decisões difíceis, relação com conselho e acionistas, gestão de crise e transformação cultural. Para cada tema, indique que evidências de resposta indicam aderência ao momento da empresa.`,
  },

  // ---- Onboarding -------------------------------------------------------------
  {
    id: "onb-01",
    categoria: "Onboarding",
    titulo: "Plano de onboarding 30-60-90",
    descricao: "Plano de integração com metas por fase.",
    prompt: `Crie um plano de onboarding 30-60-90 dias para [CARGO] na área de [ÁREA], reportando a [GESTOR].

Para cada fase: objetivos, atividades (reuniões, treinamentos, entregas), pessoas-chave para conhecer e indicadores de que a fase foi bem-sucedida. Inclua um checklist da primeira semana e os pontos de check-in com o gestor e o RH.`,
  },
  {
    id: "onb-02",
    categoria: "Onboarding",
    titulo: "E-mail de boas-vindas",
    descricao: "Mensagem de boas-vindas acolhedora e informativa.",
    prompt: `Escreva um e-mail de boas-vindas para [NOME], que começa em [DATA] como [CARGO].

Inclua: mensagem calorosa do gestor [NOME DO GESTOR], agenda do primeiro dia ([HORÁRIO, LOCAL OU LINK]), o que levar/preparar, quem será o buddy ([NOME]) e um parágrafo sobre a cultura da empresa: [VALORES]. Tom acolhedor e profissional, em até 250 palavras.`,
  },
  {
    id: "onb-03",
    categoria: "Onboarding",
    titulo: "Guia do buddy",
    descricao: "Orienta o colega padrinho durante a integração.",
    prompt: `Crie um guia de 1 página para quem será buddy (padrinho/madrinha) de um novo colaborador em [ÁREA].

Inclua: o papel do buddy (e o que não é papel dele), checklist por semana no primeiro mês, perguntas para puxar conversa e identificar dificuldades cedo, e quando acionar o gestor ou o RH.`,
  },
  {
    id: "onb-04",
    categoria: "Onboarding",
    titulo: "Pesquisa de onboarding (30 e 90 dias)",
    descricao: "Questionário curto para medir a experiência de integração.",
    prompt: `Crie duas pesquisas curtas de experiência de onboarding, uma para 30 e outra para 90 dias, com no máximo 8 perguntas cada (escala de 1 a 5 e 2 perguntas abertas).

Avalie: clareza do papel, recursos e acessos, relação com gestor e time, cultura e expectativa x realidade da vaga. Sugira como analisar os resultados e quais indicadores acompanhar.`,
  },
  {
    id: "onb-05",
    categoria: "Onboarding",
    titulo: "Trilha de integração por área",
    descricao: "Conteúdos e treinamentos essenciais para novos colaboradores.",
    prompt: `Monte uma trilha de integração para novos colaboradores da área de [ÁREA] em [EMPRESA / SETOR].

Organize em módulos: institucional, processos e ferramentas ([FERRAMENTAS]), compliance e políticas obrigatórias, conhecimento técnico da função e cultura. Para cada módulo: objetivo, formato (vídeo, leitura, shadowing, workshop), duração estimada e responsável.`,
  },

  // ---- Desempenho --------------------------------------------------------------
  {
    id: "des-01",
    categoria: "Desempenho",
    titulo: "Metas SMART e OKRs",
    descricao: "Converte objetivos genéricos em metas mensuráveis.",
    prompt: `Transforme os objetivos abaixo em metas SMART e, em seguida, em 2 OKRs (objetivo + 3 resultados-chave cada) para [CARGO] em [ÁREA], no período [PERÍODO].

Objetivos: [LISTA]

Para cada resultado-chave, indique a fonte do dado e a frequência de acompanhamento.`,
  },
  {
    id: "des-02",
    categoria: "Desempenho",
    titulo: "Roteiro de feedback difícil",
    descricao: "Prepara uma conversa de feedback com estrutura SCI.",
    prompt: `Ajude-me a preparar uma conversa de feedback com [CARGO DO COLABORADOR] sobre [SITUAÇÃO / COMPORTAMENTO].

Use a estrutura Situação, Comportamento, Impacto. Inclua: frase de abertura, descrição objetiva dos fatos (sem julgamentos), perguntas para ouvir a perspectiva da pessoa, como construir juntos um plano de ação e possíveis reações com sugestões de como responder a cada uma.`,
  },
  {
    id: "des-03",
    categoria: "Desempenho",
    titulo: "Avaliação de desempenho escrita",
    descricao: "Redige a avaliação a partir de anotações do gestor.",
    prompt: `Com base nas anotações abaixo, escreva a avaliação de desempenho anual de [CARGO].

Estrutura: principais entregas (com resultados), competências demonstradas (com exemplos), pontos de desenvolvimento (em linguagem construtiva) e prioridades para o próximo ciclo. Use apenas fatos das anotações e evite adjetivos vagos.

Anotações do gestor: [COLE AS ANOTAÇÕES]`,
  },
  {
    id: "des-04",
    categoria: "Desempenho",
    titulo: "Plano de melhoria de performance (PIP)",
    descricao: "Estrutura um PIP justo, claro e documentado.",
    prompt: `Estruture um Plano de Melhoria de Performance de [30/60/90] dias para [CARGO], cujo desempenho está abaixo do esperado em: [PONTOS].

Inclua: expectativas claras e mensuráveis, apoio que a empresa oferecerá, rituais de acompanhamento, critérios de sucesso e consequências em linguagem respeitosa. Aponte cuidados trabalhistas de documentação a validar com o jurídico.`,
  },
  {
    id: "des-05",
    categoria: "Desempenho",
    titulo: "Calibração de avaliações",
    descricao: "Prepara a reunião de calibração entre gestores.",
    prompt: `Prepare a condução de uma reunião de calibração de desempenho com [NÚMERO] gestores da área de [ÁREA], com [NÚMERO] colaboradores avaliados.

Inclua: pauta com tempos, regras de discussão, critérios comuns por nível da escala [DESCREVA A ESCALA], perguntas para testar vieses (recência, leniência, halo, afinidade) e modelo de registro das decisões.`,
  },

  // ---- Remuneração --------------------------------------------------------------
  {
    id: "rem-01",
    categoria: "Remuneração",
    titulo: "Estrutura de faixas salariais",
    descricao: "Desenha grades e faixas a partir de pesquisa de mercado.",
    prompt: `Tenho os seguintes dados de mercado (mediana mensal) para cargos da área de [ÁREA]: [CARGO: VALOR, ...].

Proponha uma estrutura de faixas salariais com [NÚMERO] grades, amplitude de [EX.: 40%] entre mínimo e máximo, e posicionamento de mercado [P50 / P75]. Mostre a tabela, a lógica de enquadramento e como tratar quem está abaixo do mínimo ou acima do máximo.`,
  },
  {
    id: "rem-02",
    categoria: "Remuneração",
    titulo: "Comparação de propostas CLT x PJ",
    descricao: "Explica ao candidato a diferença entre os regimes.",
    prompt: `Compare para um candidato duas propostas para [CARGO]: CLT com salário de R$ [VALOR] e benefícios [LISTA], e PJ com R$ [VALOR] mensais.

Mostre, de forma simplificada: remuneração anual total em cada regime (13º, férias + 1/3, FGTS, benefícios), impostos e custos do PJ (estimativa por regime tributário [SIMPLES / LUCRO PRESUMIDO]), riscos e vantagens de cada modelo. Deixe claro que é uma estimativa e que o candidato deve validar com um contador.`,
  },
  {
    id: "rem-03",
    categoria: "Remuneração",
    titulo: "Política de bônus e PLR",
    descricao: "Rascunho de política de remuneração variável.",
    prompt: `Rascunhe uma política de remuneração variável (bônus / PLR) para [EMPRESA / PORTE / SETOR].

Inclua: elegibilidade, gatilho de lucro ou meta mínima, métricas corporativas e individuais com pesos, múltiplos de salário por nível ([NÍVEIS]), regras para admitidos e desligados no ano e calendário de pagamento. Indique os pontos que exigem acordo com o sindicato no caso de PLR.`,
  },
  {
    id: "rem-04",
    categoria: "Remuneração",
    titulo: "Argumentação para contraproposta",
    descricao: "Prepara a conversa quando o candidato recebe contraproposta.",
    prompt: `Um candidato aprovado para [CARGO] recebeu contraproposta da empresa atual: [DETALHES]. Nossa proposta: [DETALHES].

Prepare a conversa consultiva com o candidato: perguntas para entender o que motivou a busca por mudança, argumentos baseados em carreira (não só dinheiro), dados sobre o risco de aceitar contrapropostas e margens de negociação possíveis. Tom ético, sem pressão.`,
  },
  {
    id: "rem-05",
    categoria: "Remuneração",
    titulo: "Comunicação de reajuste ou promoção",
    descricao: "Carta ou roteiro para comunicar mudança salarial.",
    prompt: `Escreva um roteiro de conversa e uma carta formal para comunicar a [NOME] [PROMOÇÃO PARA CARGO X / REAJUSTE DE Y%], a partir de [DATA].

Destaque o reconhecimento por [CONQUISTAS], as novas responsabilidades (se houver) e as expectativas para o próximo ciclo. Tom valorizador e objetivo.`,
  },

  // ---- Desenvolvimento ------------------------------------------------------------
  {
    id: "dev-01",
    categoria: "Desenvolvimento",
    titulo: "Plano de desenvolvimento individual (PDI)",
    descricao: "PDI no modelo 70-20-10 a partir de gaps identificados.",
    prompt: `Crie um PDI de 12 meses para [CARGO], com foco em desenvolver: [COMPETÊNCIAS / GAPS], considerando a aspiração de carreira [ASPIRAÇÃO].

Use o modelo 70-20-10 (experiências práticas, aprendizado com outros, cursos). Para cada ação: prazo, responsável, recursos necessários e como medir o progresso.`,
  },
  {
    id: "dev-02",
    categoria: "Desenvolvimento",
    titulo: "Levantamento de necessidades de treinamento",
    descricao: "Diagnóstico estruturado de necessidades (LNT).",
    prompt: `Estruture um levantamento de necessidades de treinamento para a área de [ÁREA], com [NÚMERO] pessoas.

Inclua: fontes de diagnóstico (avaliação de desempenho, metas, entrevistas com gestores), questionário para gestores (8 perguntas) e colaboradores (8 perguntas), matriz de priorização (impacto no negócio x urgência) e modelo de relatório final.`,
  },
  {
    id: "dev-03",
    categoria: "Desenvolvimento",
    titulo: "Programa de desenvolvimento de líderes",
    descricao: "Desenho de programa para novos gestores.",
    prompt: `Desenhe um programa de desenvolvimento de 6 meses para novos gestores em [EMPRESA / SETOR], com turma de [NÚMERO] pessoas.

Módulos sugeridos: transição de especialista para gestor, feedback e conversas difíceis, gestão de desempenho, delegação, liderança de times híbridos e aspectos trabalhistas básicos. Para cada módulo: objetivo, formato, carga horária e atividade prática entre encontros. Inclua como medir o impacto do programa.`,
  },
  {
    id: "dev-04",
    categoria: "Desenvolvimento",
    titulo: "Plano de sucessão",
    descricao: "Mapeia sucessores e prontidão para posições críticas.",
    prompt: `Ajude-me a montar um plano de sucessão para a posição de [CARGO CRÍTICO].

Defina: competências e experiências críticas da posição, critérios de prontidão (pronto agora, 1-2 anos, 3+ anos), modelo de avaliação de potenciais sucessores, ações de desenvolvimento por nível de prontidão e riscos da posição (ex.: conhecimento concentrado).

Candidatos internos considerados: [PERFIS RESUMIDOS, SEM DADOS PESSOAIS]`,
  },
  {
    id: "dev-05",
    categoria: "Desenvolvimento",
    titulo: "Trilha de carreira",
    descricao: "Define níveis, expectativas e critérios de progressão.",
    prompt: `Crie uma trilha de carreira para [FAMÍLIA DE CARGOS, ex.: Engenharia de Dados] com os níveis [JÚNIOR, PLENO, SÊNIOR, ESPECIALISTA / GESTÃO].

Para cada nível: escopo de atuação, autonomia, impacto esperado, competências técnicas e comportamentais e critérios objetivos para promoção. Inclua a bifurcação entre carreira técnica e gerencial.`,
  },

  // ---- Clima e engajamento ------------------------------------------------------------
  {
    id: "cli-01",
    categoria: "Clima e engajamento",
    titulo: "Pesquisa de clima",
    descricao: "Questionário de clima organizacional por dimensões.",
    prompt: `Crie uma pesquisa de clima organizacional com 30 perguntas em escala de 1 a 5, agrupadas nas dimensões: liderança, reconhecimento, desenvolvimento, comunicação, colaboração, bem-estar e orgulho de pertencer. Inclua 3 perguntas abertas e uma pergunta de eNPS.

Adicione orientações para garantir anonimato, um cronograma de aplicação e como devolver os resultados às equipes.`,
  },
  {
    id: "cli-02",
    categoria: "Clima e engajamento",
    titulo: "Análise de comentários abertos",
    descricao: "Agrupa comentários de pesquisas em temas e sentimentos.",
    prompt: `Analise os comentários abaixo, de uma pesquisa de [CLIMA / ENGAJAMENTO / ONBOARDING].

Agrupe em até 8 temas, com: quantidade aproximada de menções, sentimento predominante, 2 citações representativas (sem identificar pessoas) e uma recomendação de ação por tema. Termine com os 3 temas prioritários.

Comentários: [COLE OS COMENTÁRIOS]`,
  },
  {
    id: "cli-03",
    categoria: "Clima e engajamento",
    titulo: "Plano de ação pós-pesquisa",
    descricao: "Converte resultados de clima em ações concretas.",
    prompt: `Os piores resultados da pesquisa de clima na área de [ÁREA] foram: [DIMENSÕES E NOTAS]. Os melhores: [DIMENSÕES E NOTAS].

Crie um plano de ação de 6 meses com: 3 a 5 ações priorizadas, responsáveis, prazos, indicadores de acompanhamento e como comunicar o plano ao time para gerar credibilidade.`,
  },
  {
    id: "cli-04",
    categoria: "Clima e engajamento",
    titulo: "Programa de reconhecimento",
    descricao: "Desenha um programa de reconhecimento de baixo custo.",
    prompt: `Desenhe um programa de reconhecimento para uma empresa de [NÚMERO] colaboradores, com orçamento anual de R$ [VALOR].

Inclua reconhecimentos entre pares, de liderança e institucionais, critérios ligados aos valores [VALORES], rituais e frequência, e como evitar que o programa vire formalidade ou gere percepção de injustiça.`,
  },
  {
    id: "cli-05",
    categoria: "Clima e engajamento",
    titulo: "Comunicado interno sensível",
    descricao: "Comunicados sobre mudanças que afetam o time.",
    prompt: `Escreva um comunicado interno sobre [MUDANÇA: REESTRUTURAÇÃO, MUDANÇA DE POLÍTICA, NOVO MODELO DE TRABALHO etc.].

Contexto: [O QUE MUDA, POR QUÊ, A PARTIR DE QUANDO, QUEM É AFETADO]

O texto deve ser transparente, empático e objetivo, antecipar as principais dúvidas (inclua um FAQ com 5 perguntas) e indicar canais para conversar. Evite eufemismos.`,
  },

  // ---- People Analytics -----------------------------------------------------------------
  {
    id: "ana-01",
    categoria: "People Analytics",
    titulo: "Dashboard de indicadores de RH",
    descricao: "Define os KPIs de RH, fórmulas e periodicidade.",
    prompt: `Defina um conjunto de 12 indicadores de RH para um dashboard executivo de uma empresa de [PORTE / SETOR].

Para cada indicador: fórmula, fonte de dados, periodicidade, o que um aumento ou queda sinaliza e uma pergunta de negócio que ele responde. Cubra atração, retenção, desenvolvimento, engajamento, diversidade e custo de pessoal.`,
  },
  {
    id: "ana-02",
    categoria: "People Analytics",
    titulo: "Diagnóstico de turnover",
    descricao: "Investiga causas do turnover a partir dos dados.",
    prompt: `Nossa taxa de turnover foi de [X%] nos últimos 12 meses, contra [Y%] no ano anterior. Dados disponíveis: [DESLIGAMENTOS POR ÁREA, TEMPO DE CASA, MOTIVO, GESTOR, VOLUNTÁRIO/INVOLUNTÁRIO].

Proponha um roteiro de análise: recortes a fazer, hipóteses a testar, perguntas para entrevistas de desligamento e como separar o turnover saudável do problemático. Sugira ações por causa provável.`,
  },
  {
    id: "ana-03",
    categoria: "People Analytics",
    titulo: "Funil de recrutamento",
    descricao: "Analisa as conversões do processo seletivo.",
    prompt: `Analise o funil de recrutamento abaixo e identifique gargalos:

[ETAPA: QUANTIDADE, ex.: Candidaturas: 800; Triados: 120; Entrevista RH: 40; Entrevista gestor: 15; Proposta: 4; Contratados: 3]
Tempo médio por etapa: [DIAS]

Calcule as taxas de conversão, compare com referências de mercado quando fizer sentido (indicando que são aproximadas) e recomende 3 ações para reduzir o tempo de contratação sem perder qualidade.`,
  },
  {
    id: "ana-04",
    categoria: "People Analytics",
    titulo: "Análise de equidade salarial",
    descricao: "Roteiro para investigar diferenças salariais.",
    prompt: `Estruture uma análise de equidade salarial para [NÚMERO] colaboradores, considerando cargo, nível, tempo de casa, desempenho e localidade.

Explique: como organizar a base de dados, que comparações fazer (mesma função e nível), como identificar diferenças não justificadas, cuidados com amostras pequenas e privacidade, e como priorizar correções dentro de um orçamento de R$ [VALOR]. Considere as exigências da Lei 14.611/2023 (igualdade salarial).`,
  },
  {
    id: "ana-05",
    categoria: "People Analytics",
    titulo: "Business case para o RH",
    descricao: "Justificativa financeira para um investimento em pessoas.",
    prompt: `Monte um business case para aprovar [INICIATIVA: ex.: programa de retenção, novo ATS, programa de liderança] com investimento de R$ [VALOR].

Estruture: problema e custo atual (ex.: custo do turnover), objetivo, premissas, benefícios esperados quantificados, retorno estimado e payback, riscos e indicadores de sucesso. Deixe claras as premissas usadas nos cálculos.`,
  },

  // ---- Desligamento e retenção --------------------------------------------------------------
  {
    id: "ret-01",
    categoria: "Desligamento e retenção",
    titulo: "Entrevista de desligamento",
    descricao: "Roteiro para entender as causas reais da saída.",
    prompt: `Crie um roteiro de entrevista de desligamento (20 minutos) para desligamentos voluntários.

Inclua: abertura que gere segurança para respostas honestas, perguntas sobre motivos da saída, liderança, desenvolvimento, remuneração e cultura, o que poderia tê-lo(a) mantido, e uma forma de categorizar as respostas para análise posterior.`,
  },
  {
    id: "ret-02",
    categoria: "Desligamento e retenção",
    titulo: "Stay interview",
    descricao: "Conversa de retenção com talentos-chave.",
    prompt: `Prepare um roteiro de "stay interview" para gestores conversarem com talentos-chave da área de [ÁREA].

Inclua: 10 perguntas sobre o que mantém a pessoa na empresa, o que a faria sair, ambições de carreira e reconhecimento; como registrar os compromissos assumidos; e como dar retorno em até 30 dias.`,
  },
  {
    id: "ret-03",
    categoria: "Desligamento e retenção",
    titulo: "Roteiro de desligamento respeitoso",
    descricao: "Prepara o gestor para comunicar uma demissão.",
    prompt: `Prepare um roteiro para o gestor comunicar o desligamento de [CARGO], motivo [MOTIVO: reestruturação / desempenho / outro].

Inclua: preparação prévia (documentos, acessos, apoio do RH), a mensagem de abertura (clara e direta, nos primeiros 2 minutos), como responder a reações emocionais, informações práticas (verbas, benefícios, próximos passos) e comunicação ao time depois. Tom humano e respeitoso.`,
  },
  {
    id: "ret-04",
    categoria: "Desligamento e retenção",
    titulo: "Mapa de risco de saída",
    descricao: "Identifica talentos com risco de deixar a empresa.",
    prompt: `Crie um modelo simples de mapa de risco de saída para [NÚMERO] colaboradores-chave.

Critérios sugeridos: tempo sem promoção ou reajuste, posição na faixa salarial, resultado da última avaliação, sinais de desengajamento, demanda de mercado pelo perfil e dependência do negócio. Para cada nível de risco (alto, médio, baixo), sugira ações de retenção e quem deve conduzi-las.`,
  },
  {
    id: "ret-05",
    categoria: "Desligamento e retenção",
    titulo: "Programa de outplacement",
    descricao: "Estrutura apoio de recolocação a desligados.",
    prompt: `Estruture um programa de outplacement para [NÚMERO] profissionais desligados em uma reestruturação, com níveis [OPERACIONAL / GESTÃO / EXECUTIVO].

Inclua: serviços por nível (revisão de currículo e LinkedIn, preparação para entrevistas, mapeamento de mercado, apoio emocional), duração, formato (individual ou grupo), indicadores de sucesso e como comunicar o benefício de forma cuidadosa.`,
  },
];
