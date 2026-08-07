import { getSessionUsuario } from "@/lib/auth";
import { isRoleAllowed, ROLE_LABEL } from "@/lib/nav";
import { PAPEIS_CRM, PAPEIS_ATS, PAPEIS_INTERNOS } from "@/lib/roles";
import {
  getKpisGerais,
  getKpisComercial,
  getFunilComercial,
  getForecast,
  getReceitaMensal,
  getTopEmpresas,
  getTopConsultores,
  getKpisRecrutamento,
  getFunilVagas,
  getFunilCandidatos,
  getTopTecnologias,
  getTopRecrutadores,
  getAlertasExecutivos,
} from "@/modules/dashboard/queries";
import { getMinhasMetas } from "@/modules/metas/queries";
import { verificarSlasVencidos } from "@/modules/automacoes/sla";
import { verificarRenovacoesPendentes } from "@/modules/alocacao/renovacao";
import { getMinhasTarefas } from "@/modules/tarefas/queries";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const usuario = await getSessionUsuario();
  const papel = usuario?.papel ?? null;

  if (!papel) {
    return (
      <div className="flex flex-1 flex-col gap-2 px-4 py-8 sm:px-6">
        <h1 className="font-heading text-2xl font-bold">Bem-vindo(a){usuario?.nome ? `, ${usuario.nome}` : ""}.</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Sua conta ainda não tem um papel atribuído em usuarios — fale com um administrador.
        </p>
      </div>
    );
  }

  const podeGeral = isRoleAllowed(PAPEIS_INTERNOS, papel);
  const podeComercial = isRoleAllowed(PAPEIS_CRM, papel);
  const podeRecrutamento = isRoleAllowed(PAPEIS_ATS, papel);

  // Verificação oportunista de SLA (Fase 5) — sem cron real, roda a cada
  // carregamento do Dashboard por um papel interno. `await`ada (não
  // fire-and-forget) pra garantir que termina antes da resposta fechar;
  // nunca deve derrubar a página em si.
  if (podeGeral) {
    try {
      await verificarSlasVencidos();
    } catch (err) {
      console.error("Falha ao verificar SLAs vencidos:", err);
    }
  }
  if (podeRecrutamento) {
    try {
      await verificarRenovacoesPendentes();
    } catch (err) {
      console.error("Falha ao verificar renovações de contrato:", err);
    }
  }

  const [geral, comercial, recrutamento, tarefas, alertas, minhasMetas] = await Promise.all([
    podeGeral ? getKpisGerais() : null,
    podeComercial
      ? Promise.all([
          getKpisComercial(),
          getFunilComercial(),
          getForecast(),
          getReceitaMensal(),
          getTopEmpresas(),
          getTopConsultores(),
        ]).then(([kpis, funil, forecast, receitaMensal, topEmpresas, topConsultores]) => ({
          kpis,
          funil,
          forecast,
          receitaMensal,
          topEmpresas,
          topConsultores,
        }))
      : null,
    podeRecrutamento
      ? Promise.all([
          getKpisRecrutamento(),
          getFunilVagas(),
          getFunilCandidatos(),
          getTopTecnologias(),
          getTopRecrutadores(),
        ]).then(([kpis, funilVagas, funilCandidatos, topTecnologias, topRecrutadores]) => ({
          kpis,
          funilVagas,
          funilCandidatos,
          topTecnologias,
          topRecrutadores,
        }))
      : null,
    getMinhasTarefas(),
    podeGeral ? getAlertasExecutivos() : null,
    getMinhasMetas(),
  ]);

  if (!geral && !comercial && !recrutamento) {
    return (
      <div className="flex flex-1 flex-col gap-2 px-4 py-8 sm:px-6">
        <h1 className="font-heading text-2xl font-bold">Bem-vindo(a){usuario?.nome ? `, ${usuario.nome}` : ""}.</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Você está autenticado como {ROLE_LABEL[papel]}. Ainda não há um dashboard configurado para este papel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo(a){usuario?.nome ? `, ${usuario.nome}` : ""}.</p>
      </div>
      <DashboardView
        geral={geral}
        comercial={comercial}
        recrutamento={recrutamento}
        tarefas={tarefas}
        alertas={alertas}
        minhasMetas={minhasMetas}
      />
    </div>
  );
}
