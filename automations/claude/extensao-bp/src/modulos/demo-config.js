/** Configurações › Cenário de demonstração: gerar e remover (ver core/demo.js). */
import { existeDemo, gerarDemo, removerDemo } from "../core/demo.js";
import { FriendlyError } from "../core/toolskit.js";
import { confirmar, encher, h, ocupado, toast } from "../core/ui.js";

export function secaoDemo() {
  const raiz = h("div");
  const status = h("p", { class: "hint", role: "status" });

  async function desenhar() {
    let ativo = false;
    try {
      ativo = await existeDemo();
    } catch (e) {
      return encher(raiz, h("p", { class: "error", text: e instanceof FriendlyError ? e.message : "Não foi possível verificar o cenário." }));
    }
    const gerar = h("button", { type: "button", class: "btn btn--primary btn--auto" }, "Gerar cenário fictício");
    const remover = h("button", { type: "button", class: "btn btn--ghost btn--danger" }, "Remover cenário");
    gerar.addEventListener("click", async () => {
      if (!(await confirmar("Gerar o cenário fictício sobre os seus colaboradores? Os cadastros reais não perdem nada: só os campos vazios são preenchidos, e tudo pode ser removido depois.", "Gerar cenário"))) return;
      await ocupado(gerar, "Gerando…", async () => {
        try {
          const r = await gerarDemo((m) => (status.textContent = m));
          status.textContent = "";
          toast(`Cenário criado: ${r.avaliacoes} avaliações, ${r.onboardings} onboardings, ${r.desligamentos} desligamentos e 2 pesquisas de Pulso.`);
        } catch (e) {
          console.error(e);
          status.textContent = e instanceof FriendlyError ? e.message : "Não foi possível gerar o cenário. Remova o que foi criado e tente de novo.";
        }
      });
      desenhar();
    });
    remover.addEventListener("click", async () => {
      if (!(await confirmar("Remover o cenário? Avaliações, onboardings, desligamentos, pesquisas e eventos fictícios são apagados, e os cadastros voltam a ser como eram.", "Remover cenário"))) return;
      await ocupado(remover, "Removendo…", async () => {
        try {
          await removerDemo((m) => (status.textContent = m));
          status.textContent = "";
          toast("Cenário removido. Os cadastros voltaram ao original.");
        } catch (e) {
          console.error(e);
          status.textContent = "Não foi possível remover tudo. Tente de novo.";
        }
      });
      desenhar();
    });
    encher(
      raiz,
      ativo
        ? h("div", { class: "banner banner--info" }, h("strong", { text: "Cenário de demonstração ativo. " }), "Os indicadores mostram dados fictícios junto da sua base.")
        : null,
      h(
        "ul",
        { class: "list" },
        h("li", { text: "Completa área, admissão e remuneração de quem não tem (os seus dados preenchidos ficam como estão)." }),
        h("li", { text: "12 meses de avaliações de Produtividade e Cultura: Comercial em queda, Tecnologia forte com dois talentos em queda, Operações em recuperação." }),
        h("li", { text: "5 pessoas em onboarding (uma com fase atrasada)." }),
        h("li", { text: "6 ex-colaboradores fictícios com desligamento, custo e entrevista respondida (3 saídas do mesmo gestor no Comercial)." }),
        h("li", { text: "2 pesquisas de Pulso respondidas: Engajamento há 3 meses e Clima no mês passado." }),
      ),
      h("div", { class: "actions" }, ativo ? remover : gerar),
      status,
    );
  }

  desenhar();
  return { raiz, desenhar };
}
