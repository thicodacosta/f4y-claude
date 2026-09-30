// Dados puros (sem "server-only"): templates globais do JourneyLab (seed e aplicação).
import type { PerguntaDef } from "./perguntas";

type Tpl = { slug: string; nome: string; descricao: string; icone: string; cor: string; perguntas: PerguntaDef[] };

const p = (i: number, type: PerguntaDef["type"], text: string, extra: Partial<PerguntaDef> = {}, required = true): PerguntaDef => ({ id: `q${i}`, type, text, required, order: i, ...extra });
const nps = (i: number, text: string) => p(i, "nps", text, { scaleMin: 0, scaleMax: 10, scaleMinLabel: "Nada provável", scaleMaxLabel: "Muito provável" });
const likert = (i: number, text: string) => p(i, "likert", text);
const comentario = (i: number, text: string) => p(i, "long_text", text, {}, false);

export const MODELOS_GLOBAIS: Tpl[] = [
  {
    slug: "enps",
    nome: "eNPS",
    descricao: "Probabilidade de recomendar a empresa como lugar para trabalhar e o motivo.",
    icone: "Gauge",
    cor: "#14B8A6",
    perguntas: [nps(0, "Qual a probabilidade de você recomendar a empresa como lugar para trabalhar?"), comentario(1, "O que mais influenciou sua nota?")],
  },
  {
    slug: "pulso-mensal",
    nome: "Pulso Mensal",
    descricao: "Termômetro rápido do mês: energia, carga, reconhecimento e apoio.",
    icone: "Activity",
    cor: "#1E3A5F",
    perguntas: [
      p(0, "star_rating", "Como você avalia o seu mês de trabalho?", { scaleMax: 5 }),
      likert(1, "Minha carga de trabalho foi sustentável neste mês."),
      likert(2, "Recebi reconhecimento pelo meu trabalho."),
      p(3, "multiple_choice_multiple", "O que mais ajudou você neste mês?", {
        options: [
          { id: "o1", label: "Apoio da liderança" },
          { id: "o2", label: "Colaboração do time" },
          { id: "o3", label: "Clareza de prioridades" },
          { id: "o4", label: "Ferramentas e processos" },
        ],
      }, false),
      comentario(4, "Algo que devemos saber?"),
    ],
  },
  {
    slug: "clima-organizacional",
    nome: "Clima Organizacional",
    descricao: "Visão ampla do clima: liderança, relações, desenvolvimento e ambiente.",
    icone: "Building2",
    cor: "#0B7A70",
    perguntas: [
      p(0, "matrix_scale", "Avalie de 1 a 5:", { matrixRows: ["Liderança", "Relações no time", "Oportunidades de desenvolvimento", "Comunicação interna", "Ambiente de trabalho"], scaleMin: 1, scaleMax: 5 }),
      likert(1, "Tenho orgulho de trabalhar aqui."),
      likert(2, "Vejo futuro para mim na empresa."),
      nps(3, "Qual a probabilidade de você recomendar a empresa como lugar para trabalhar?"),
      comentario(4, "O que você mudaria primeiro?"),
    ],
  },
  {
    slug: "onboarding-dia-30",
    nome: "Onboarding (dia 30)",
    descricao: "Experiência dos primeiros 30 dias de quem acabou de chegar.",
    icone: "DoorOpen",
    cor: "#15A66B",
    perguntas: [
      p(0, "scale", "De 1 a 10, como foram seus primeiros 30 dias?", { scaleMin: 1, scaleMax: 10, scaleMinLabel: "Muito ruins", scaleMaxLabel: "Excelentes" }),
      p(1, "boolean", "Você recebeu os acessos e equipamentos a tempo?"),
      likert(2, "Entendo o que se espera de mim."),
      likert(3, "Meu gestor esteve disponível quando precisei."),
      comentario(4, "O que poderia ter sido melhor na sua chegada?"),
    ],
  },
  {
    slug: "satisfacao-lideranca",
    nome: "Satisfação com Liderança",
    descricao: "Percepção sobre a liderança direta: clareza, apoio, feedback e confiança.",
    icone: "Users",
    cor: "#E8A317",
    perguntas: [
      p(0, "matrix_star", "Avalie sua liderança direta:", { matrixRows: ["Clareza nas orientações", "Apoio no dia a dia", "Qualidade dos feedbacks", "Confiança"], scaleMax: 5 }),
      likert(1, "Recebo feedback com a frequência de que preciso."),
      p(2, "multiple_choice_single", "Com que frequência você conversa individualmente com sua liderança?", {
        options: [
          { id: "o1", label: "Semanalmente" },
          { id: "o2", label: "Quinzenalmente" },
          { id: "o3", label: "Mensalmente" },
          { id: "o4", label: "Raramente" },
        ],
      }),
      comentario(3, "O que sua liderança poderia fazer diferente?"),
    ],
  },
];
