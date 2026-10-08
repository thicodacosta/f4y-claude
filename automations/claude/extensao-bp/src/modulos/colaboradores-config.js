/**
 * Cadastro da base de colaboradores (Configurações): um a um ou em massa pela
 * planilha modelo, com prévia antes de gravar, e a lista para editar/excluir.
 * O importador também é usado na aba Pessoas.
 */
import { atualizar, excluir, inserir, store } from "../core/db.js";
import { aplicar, baixarModelo, exportarBase, formatarTelefone, normalizarTelefone, planejar } from "../core/importacao.js";
import { lerPlanilha } from "../core/planilha.js";
import { FriendlyError, normalize } from "../core/toolskit.js";
import { campo, confirmar, encher, h, ocupado, toast } from "../core/ui.js";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Importador: escolher arquivo → prévia → importar. */
export function importador({ aoConcluir } = {}) {
  const raiz = h("div", { class: "importador" });
  const arquivo = h("input", { type: "file", accept: ".xlsx,.csv", hidden: true });

  function inicio(mensagem) {
    encher(
      raiz,
      h("ol", { class: "passos" }, h("li", {}, "Baixe o modelo e preencha uma pessoa por linha: ", h("strong", { text: "Nome, Cargo, Gestor, E-mail e Telefone" }), "."), h("li", { text: "Importe a planilha (.xlsx ou .csv). Você confere a prévia antes de gravar." }), h("li", { text: "E-mails já cadastrados atualizam a pessoa, sem duplicar." })),
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "btn btn--ghost", onclick: baixarModelo }, "Baixar modelo (Excel)"),
        h("button", { type: "button", class: "btn btn--primary btn--auto", onclick: () => arquivo.click() }, "Importar planilha"),
      ),
      mensagem ? h("p", { class: "hint", role: "status", text: mensagem }) : null,
      arquivo,
    );
  }

  function previa(plano, nomeArquivo) {
    const total = plano.novos.length + plano.atualizados.length;
    const importar = h("button", { type: "button", class: "btn btn--primary btn--auto", disabled: !total }, total ? `Importar ${total} colaborador(es)` : "Nada para importar");
    const status = h("p", { class: "hint", role: "status" });
    importar.addEventListener("click", () =>
      ocupado(importar, "Gravando…", async () => {
        try {
          const r = await aplicar(plano, (n) => (status.textContent = `${n} de ${total} gravados…`));
          const msg = `Importação concluída: ${r.criados} novo(s) e ${r.atualizados} atualizado(s)${plano.erros.length ? `; ${plano.erros.length} linha(s) com erro ficaram de fora` : ""}.`;
          toast(msg);
          inicio(msg);
          aoConcluir?.(r);
        } catch (e) {
          console.error(e);
          status.textContent = /duplicate|23505/.test(`${e.message} ${e.code}`) ? "Um dos e-mails já pertence a outra pessoa. Revise a planilha." : "Não foi possível gravar. Nada foi perdido; tente de novo.";
        }
      }),
    );
    const tabela = (titulo, itens, colunas, linha) =>
      itens.length
        ? h("details", { class: "previa__grupo", open: titulo.startsWith("Com erro") || itens.length <= 8 }, h("summary", { text: `${titulo} (${itens.length})` }), h("table", { class: "tabela" }, h("thead", {}, h("tr", {}, colunas.map((c) => h("th", { text: c })))), h("tbody", {}, itens.slice(0, 300).map((x) => h("tr", {}, linha(x).map((v) => h("td", { text: v ?? "—" })))))))
        : null;
    encher(
      raiz,
      h("p", { class: "note__title", text: `Prévia de "${nomeArquivo}"` }),
      h("div", { class: "kpis kpis--4" }, [["Novos", plano.novos.length], ["Atualizados", plano.atualizados.length], ["Sem mudança", plano.iguais.length], ["Com erro", plano.erros.length]].map(([r, v]) => h("div", { class: `kpi${r === "Com erro" && v ? " kpi--perigo" : ""}` }, h("span", { class: "kpi__rotulo", text: r }), h("strong", { class: "kpi__valor", text: String(v) })))),
      tabela("Com erro — não serão importados", plano.erros, ["Linha", "Nome", "Motivo"], (x) => [String(x.n), x.nome, x.motivo]),
      tabela("Novos", plano.novos, ["Linha", "Nome", "Cargo", "Gestor", "E-mail", "Telefone"], (x) => [String(x.n), x.campos.nome, x.campos.cargo, x.campos.gestor, x.campos.email, formatarTelefone(x.campos.telefone)]),
      tabela("Atualizados", plano.atualizados, ["Linha", "Nome", "O que muda"], (x) => [String(x.n), x.nome, Object.keys(x.campos).join(", ")]),
      h("div", { class: "actions" }, importar, h("button", { type: "button", class: "btn btn--ghost", onclick: () => inicio() }, "Cancelar")),
      status,
    );
  }

  arquivo.addEventListener("change", async () => {
    const file = arquivo.files[0];
    arquivo.value = "";
    if (!file) return;
    try {
      const plano = planejar(await lerPlanilha(file));
      if (plano.erroGeral) return inicio(plano.erroGeral);
      previa(plano, file.name);
    } catch (e) {
      console.error(e);
      inicio(e.message === "formato" ? "Use um arquivo .xlsx ou .csv (no Excel: Arquivo > Salvar como > Pasta de Trabalho do Excel)." : "Não consegui ler o arquivo. Confira se ele foi salvo a partir do modelo.");
    }
  });

  inicio();
  return raiz;
}

/** Seção completa das Configurações. */
export function secaoColaboradores() {
  const raiz = h("div");
  let editando = null;
  let busca = "";

  const f = {
    nome: h("input", { autocomplete: "off", maxlength: "160" }),
    cargo: h("input", { autocomplete: "off" }),
    gestor: h("input", { autocomplete: "off", list: "cfg-gestores" }),
    email: h("input", { type: "email", autocomplete: "off" }),
    telefone: h("input", { type: "tel", autocomplete: "off", placeholder: "(11) 98765-4321" }),
  };
  const erro = h("p", { class: "error", role: "alert", hidden: true });
  const salvar = h("button", { type: "submit", class: "btn btn--primary btn--auto", value: "salvar" }, "Salvar");
  const outro = h("button", { type: "submit", class: "btn btn--ghost", value: "outro" }, "Salvar e cadastrar outro");
  const cancelar = h("button", { type: "button", class: "btn-link", hidden: true }, "Cancelar edição");
  const tituloForm = h("p", { class: "note__title", text: "Novo colaborador" });
  const gestores = h("datalist", { id: "cfg-gestores" });

  function limpar() {
    editando = null;
    for (const c of Object.values(f)) c.value = "";
    tituloForm.textContent = "Novo colaborador";
    salvar.textContent = "Salvar";
    outro.hidden = false;
    cancelar.hidden = true;
    erro.hidden = true;
  }

  function editar(c) {
    editando = c;
    f.nome.value = c.nome;
    f.cargo.value = c.cargo ?? "";
    f.gestor.value = c.gestor ?? "";
    f.email.value = c.email ?? "";
    f.telefone.value = formatarTelefone(c.telefone);
    tituloForm.textContent = `Editando ${c.nome}`;
    salvar.textContent = "Salvar alterações";
    outro.hidden = true;
    cancelar.hidden = false;
    f.nome.focus();
    form.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const form = h(
    "form",
    {
      class: "form-colaborador",
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const continuar = e.submitter?.value === "outro";
        const tel = normalizarTelefone(f.telefone.value);
        const email = f.email.value.trim().toLowerCase();
        const falha = !f.nome.value.trim() ? "Informe o nome." : email && !EMAIL.test(email) ? "Confira o e-mail." : tel.erro;
        if (falha) return Object.assign(erro, { textContent: falha, hidden: false });
        const dados = { nome: f.nome.value.trim(), cargo: f.cargo.value.trim() || null, gestor: f.gestor.value.trim() || null, email: email || null, telefone: tel.valor };
        await ocupado(e.submitter ?? salvar, "Salvando…", async () => {
          try {
            if (editando) await atualizar("bp_colaboradores", editando.id, dados, "salvar o colaborador");
            else await inserir("bp_colaboradores", dados, "salvar o colaborador");
            toast(editando ? "Cadastro atualizado." : `${dados.nome} cadastrado(a).`);
            limpar();
            if (continuar) f.nome.focus();
          } catch (err) {
            Object.assign(erro, { textContent: err instanceof FriendlyError ? err.message : "Não foi possível salvar.", hidden: false });
          }
        });
      },
    },
    tituloForm,
    campo("Nome completo *", f.nome),
    h("div", { class: "field-grid" }, campo("Cargo", f.cargo), campo("Gestor(a)", f.gestor), campo("E-mail", f.email), campo("Telefone (com DDD)", f.telefone)),
    gestores,
    erro,
    h("div", { class: "actions" }, salvar, outro, cancelar),
  );
  cancelar.addEventListener("click", limpar);

  const lista = h("div");
  function desenharLista() {
    gestores.replaceChildren(...[...new Set(store.colaboradores.map((c) => c.gestor).filter(Boolean))].map((g) => h("option", { value: g })));
    const termos = normalize(busca).split(/\s+/).filter(Boolean);
    const ativos = store.colaboradores.filter((c) => c.status === "ativo");
    const filtrados = ativos.filter((c) => termos.every((t) => normalize(`${c.nome} ${c.cargo ?? ""} ${c.gestor ?? ""} ${c.email ?? ""}`).includes(t)));
    encher(
      lista,
      h("div", { class: "lista-topo" }, h("p", { class: "note__title", text: `Colaboradores ativos (${ativos.length})` }), ativos.length ? h("button", { type: "button", class: "btn-link", onclick: exportarBase }, "Exportar planilha") : null),
      ativos.length > 5 ? h("input", { type: "search", placeholder: "Buscar por nome, cargo, gestor ou e-mail", value: busca, "aria-label": "Buscar colaboradores", oninput: (e) => { busca = e.target.value; desenharLista(); lista.querySelector("input[type=search]")?.focus(); } }) : null,
      ativos.length
        ? h(
            "div",
            { class: "tabela-rolagem" },
            h(
              "table",
              { class: "tabela tabela--colaboradores" },
              h("thead", {}, h("tr", {}, ["Nome", "Cargo", "Gestor", "E-mail", "Telefone", ""].map((t) => h("th", { text: t })))),
              h(
                "tbody",
                {},
                filtrados.map((c) =>
                  h(
                    "tr",
                    {},
                    h("td", { text: c.nome }),
                    h("td", { text: c.cargo ?? "—" }),
                    h("td", { text: c.gestor ?? "—" }),
                    h("td", { text: c.email ?? "—" }),
                    h("td", { class: "num", text: formatarTelefone(c.telefone) || "—" }),
                    h(
                      "td",
                      { class: "acoes-celula" },
                      h("button", { type: "button", class: "btn-link", onclick: () => editar(c) }, "Editar"),
                      h("button", { type: "button", class: "btn-link btn--danger", onclick: async () => { if (await confirmar(`Excluir ${c.nome} e todo o histórico dessa pessoa? Não dá para desfazer.`, "Excluir")) { await excluir("bp_colaboradores", c.id, "excluir o colaborador"); toast("Colaborador excluído."); } } }, "Excluir"),
                    ),
                  ),
                ),
              ),
            ),
          )
        : h("p", { class: "hint", text: "Nenhum colaborador ainda. Cadastre acima ou importe a planilha." }),
    );
  }

  raiz.append(h("div", { class: "card card--suave" }, h("p", { class: "note__title", text: "Importar em massa" }), importador()), form, lista);
  desenharLista();
  return { raiz, desenharLista };
}
