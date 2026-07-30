# Roadmap de Implementação

Datas em duração relativa (sprints de 2 semanas), não em datas de calendário
fixas — o início real depende da aprovação deste documento e de disponibilidade
de time, que este documento não controla. Assume 1 squad pequeno (não define
tamanho de time — `[TODO] Definir com Thiago`).

| Fase | Sprints estimados | Depende de |
|---|---|---|
| 0 — Fundação | 1–2 | Aprovação deste documento |
| 1 — Pipeline Comercial | 3–4 | Fase 0 |
| 2 — ATS (Vagas + Candidatos) | 4–5 | Fase 0 (pode rodar em paralelo à Fase 1 com time maior) |
| 3 — Dashboard e Forecast | 2–3 | Fases 1 e 2 (precisa de dado real para os KPIs terem sentido) |
| 4 — Financeiro | 2 | Fases 1 e 2 |
| 5 — Automações | 2 | Fases 1–4 (precisa de etapas/eventos reais para automatizar) |
| 6 — Verticais especializadas | 2–3 | Fase 2 |
| 7 — Portais externos | 2–3 | Fase 2 (Cliente) / Fase 6 (Candidato, se depender de contrato) |
| 8 — IA | 3–4 | Fase 2 (matching/score precisam da base de candidatos/vagas) |
| 9 — Integrações | contínuo, incremental | Não bloqueante — entra a qualquer momento após Fase 0 |
| 10 — Polimento/diferenciais avançados | contínuo | Após MVP (Fases 0–4) estabilizado em uso real |

## Marcos de negócio (não técnicos)

1. **MVP interno utilizável** — fim da Fase 4: CRM + ATS + Dashboard +
   Financeiro rodando, substituindo planilhas/ferramentas atuais para o
   dia a dia operacional.
2. **Plataforma completa para todas as verticais** — fim da Fase 6.
3. **Plataforma orientada a cliente/candidato** — fim da Fase 7.
4. **Diferencial competitivo de IA ativo** — fim da Fase 8.

## Risco principal a monitorar

Migrar o time de "planilha/ferramenta atual" para a plataforma nova é uma
mudança de hábito, não só de software — cada fase deve ter um "critério de
pronto" validado por quem realmente vai usar (ver `plano-modulos.md`), não só
por revisão técnica, sob risco de a plataforma ficar pronta e não ser
adotada.
