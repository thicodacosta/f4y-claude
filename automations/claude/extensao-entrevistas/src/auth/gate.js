/**
 * Tela de acesso das extensões Candydate (Recruiter e BP). Bloqueia a página
 * até a pessoa entrar e ter o produto.
 *
 * - Entrar: e-mail e senha, ou Google / LinkedIn.
 * - Criar conta: Google / LinkedIn, ou nome, e-mail e senha digitada duas
 *   vezes (sem confirmação por e-mail).
 * - Esqueci a senha: chega por e-mail um código (senha provisória), usado no
 *   campo Senha; em seguida a pessoa cria uma nova senha.
 * - Esqueci o e-mail: pelo CPF, mostra o e-mail da conta parcialmente oculto.
 * - Conta sem o produto: completa o cadastro (nome, CPF, telefone) e começa o
 *   teste gratuito (3 dias ou 100 mil tokens), ou assina. Teste encerrado ou
 *   assinatura inativa: tela de assinatura.
 *
 * Acesso por produto: `app_metadata.produtos` ("recruiter", "bp"), que só o
 * servidor altera. `user_metadata.senhaPropria` marca quem já criou a própria
 * senha (contas criadas pelo checkout recebem a senha provisória por e-mail).
 */
import { authConfigured, currentUser, setRemember, signOut, supabase, SUPABASE_URL } from "./client.js";
import { consultarPlano, linkAssinatura } from "./plano.js";

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

const maskEmail = (email) => email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${"•".repeat(Math.min(b.length, 6))}${c}`);
const digitos = (v) => String(v ?? "").replace(/\D/g, "");

// Senha provisória enviada por e-mail: o código numérico de recuperação.
const PROVISIONAL = /^\d{6,10}$/;
const SENHA_OK = (s) => s.length >= 8 && /[a-z]/i.test(s) && /\d/.test(s);

// Nome e chave do produto (a mesma tela serve às extensões Candydate).
let produto = "Recruiter";
let chaveProduto = "recruiter";

const temProduto = (user) => Array.isArray(user?.app_metadata?.produtos) && user.app_metadata.produtos.includes(chaveProduto);
// Quem entrou com Google/LinkedIn não tem senha a criar.
const hasOwnPassword = (user) =>
  user?.user_metadata?.senhaPropria === true || (user?.identities ?? []).some((i) => i.provider && i.provider !== "email") || (user?.app_metadata?.provider && user.app_metadata.provider !== "email");
const nomeDe = (user) => user?.user_metadata?.nome ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "";

/** Usuário com os dados atuais do servidor (a sessão guardada pode estar antiga). */
async function usuarioAtual(fallback) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return fallback;
    // Produto liberado depois do login: renova a sessão para o banco enxergar.
    if (temProduto(data.user) && !temProduto(fallback)) await supabase.auth.refreshSession();
    return data.user;
  } catch {
    return fallback; // sem conexão: vale a sessão guardada
  }
}

/** Mensagens claras para os erros do Supabase Auth. */
function friendly(error) {
  const msg = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  if (/invalid login credentials|invalid_credentials/.test(msg)) return "E-mail ou senha incorretos.";
  if (/user already registered|already been registered|user_already_exists|email_exists/.test(msg)) return "Este e-mail já tem conta. Entre com a sua senha ou use \"Esqueci a senha\".";
  if (/email not confirmed|email_not_confirmed/.test(msg)) return "Confirme o seu e-mail pelo link que enviamos e entre de novo.";
  if (/banned|user_banned/.test(msg)) return `Seu acesso ao ${produto} está suspenso. Fale com a Candydate.`;
  if (/token has expired|otp_expired|invalid.*otp|token.*invalid/.test(msg)) return "Código inválido ou expirado. Peça um novo em \"Esqueci a senha\".";
  if (/rate limit|too many|over_email_send_rate_limit|security purposes/.test(msg)) return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
  if (/signups not allowed|signup.*disabled/.test(msg)) return "O cadastro está fechado no momento. Fale com a Candydate.";
  if (/provider is not enabled|unsupported provider|validation_failed.*provider/.test(msg)) return "Este login ainda não está disponível. Use e-mail e senha.";
  if (/same_password|should be different/.test(msg)) return "A nova senha precisa ser diferente da senha atual.";
  if (/password should be|weak_password/.test(msg)) return "A senha precisa ter pelo menos 8 caracteres, com letras e números.";
  if (/reauthentication/.test(msg)) return "Por segurança, saia e entre de novo antes de trocar a senha.";
  if (/user (closed|cancel)|did not approve|authorization page could not be loaded/.test(msg)) return "Login cancelado.";
  if (/failed to fetch|network/.test(msg)) return "Sem conexão com o servidor. Verifique sua internet.";
  const code = error?.code || error?.status || error?.name;
  return `Não foi possível concluir agora. Tente novamente.${code ? ` (código: ${code})` : ""}`;
}

function buildScreen() {
  const status = el("p", { class: "auth__error", role: "alert", hidden: true });
  const box = el("div", { class: "auth__box" });
  const card = el(
    "div",
    { class: "auth__card" },
    el("img", { src: "icons/candydate-logo.png", alt: "Candydate", class: "auth__logo" }),
    el("p", { class: "eyebrow auth__eyebrow", text: produto }),
    box,
    status,
  );
  const screen = el("div", { class: "auth", role: "dialog", "aria-modal": "true", "aria-label": `Acesso ao ${produto}` }, card);
  return { screen, box, status };
}

/**
 * Bloqueia a página até haver sessão com senha própria (ou login social) e o
 * produto liberado. Devolve o usuário.
 */
export async function requireAuth({ onLogin, nomeProduto, chave } = {}) {
  if (nomeProduto) produto = nomeProduto;
  if (chave) chaveProduto = chave;
  if (!authConfigured) return null; // pacote de desenvolvimento sem login configurado
  const existing = await currentUser();
  let atual = null;
  if (existing) {
    atual = await usuarioAtual(existing);
    if (temProduto(atual) && hasOwnPassword(atual)) {
      watchSignOut();
      return atual;
    }
  }

  document.documentElement.classList.add("is-locked");
  const ui = buildScreen();
  document.body.append(ui.screen);
  const user = await new Promise((resolve) => runFlow(ui, resolve, atual));
  ui.screen.remove();
  document.documentElement.classList.remove("is-locked");
  watchSignOut();
  await onLogin?.(user);
  return user;
}

/** Se a sessão acabar (ex.: "Sair" em outra página), volta à tela de acesso. */
function watchSignOut() {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") location.reload();
  });
}

export async function logout() {
  await signOut();
  location.reload();
}

/** Login com Google ou LinkedIn pela janela do Chrome (chrome.identity). */
async function entrarCom(provider) {
  if (!chrome.identity?.launchWebAuthFlow) throw new Error("provider is not enabled");
  const redirectTo = chrome.identity.getRedirectURL();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  const retorno = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  const url = new URL(retorno);
  const hash = new URLSearchParams(url.hash.slice(1));
  const erro = url.searchParams.get("error_description") ?? hash.get("error_description");
  if (erro) throw new Error(erro);
  const code = url.searchParams.get("code");
  if (code) {
    const r = await supabase.auth.exchangeCodeForSession(code);
    if (r.error) throw r.error;
    return r.data.user;
  }
  const r = await supabase.auth.setSession({ access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token") });
  if (r.error) throw r.error;
  return r.data.user;
}

function runFlow(ui, done, sessaoUser) {
  let email = sessaoUser?.email ?? "";

  const setError = (message) => {
    ui.status.textContent = message ?? "";
    ui.status.hidden = !message;
  };
  const busy = (button, on, label) => {
    button.disabled = on;
    if (label) button.textContent = on ? "Aguarde…" : label;
  };
  const field = (id, label, attrs) => el("div", { class: "field" }, el("label", { for: id, text: label }), el("input", { id, ...attrs }));
  const link = (texto, onclick) => el("button", { type: "button", class: "btn-link", text: texto, onclick });
  const sair = () => link("Sair", async () => {
    await signOut();
    email = "";
    showLogin();
  });

  // Botões de login social (Google e LinkedIn).
  function sociais(rotulo) {
    const botao = (provider, nome) =>
      el(
        "button",
        {
          type: "button",
          class: "btn btn--ghost auth__social",
          onclick: async (e) => {
            setError(null);
            const b = e.currentTarget;
            busy(b, true);
            try {
              await setRemember(true);
              await seguir(await entrarCom(provider));
            } catch (error) {
              console.error(error);
              setError(friendly(error));
            } finally {
              busy(b, false);
              b.textContent = `${rotulo} com ${nome}`;
            }
          },
        },
        `${rotulo} com ${nome}`,
      );
    return el("div", { class: "auth__sociais" }, botao("google", "Google"), botao("linkedin_oidc", "LinkedIn"), el("p", { class: "auth__ou", text: "ou" }));
  }

  /** Depois de autenticar: senha própria → produto → teste/assinatura. */
  async function seguir(user) {
    email = user?.email ?? email;
    if (!hasOwnPassword(user)) return showCreatePassword({ reason: "first" });
    const atual = await usuarioAtual(user);
    if (temProduto(atual)) return done(atual);
    const plano = await consultarPlano(chaveProduto).catch(() => null);
    if (plano && ["teste_encerrado", "assinatura_inativa"].includes(plano.motivo)) return showAssinar(plano);
    return showCadastro(atual);
  }

  // Senha normal; se não conferir e parecer a senha provisória do e-mail,
  // tenta como código de recuperação.
  async function signIn(password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { user: data.user, provisional: false };
    if (!PROVISIONAL.test(password)) throw error;
    const recovery = await supabase.auth.verifyOtp({ email, token: password, type: "recovery" });
    if (recovery.error) throw error;
    return { user: recovery.data.user, provisional: true };
  }

  // ---- Entrar -----------------------------------------------------------------
  function showLogin(notice) {
    setError(null);
    const remember = el("input", { type: "checkbox", id: "auth-remember", checked: true });
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Entrar" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Entrar" }),
      notice ? el("p", { class: "lead auth__lead", role: "status", text: notice }) : null,
      sociais("Entrar"),
      field("auth-email", "E-mail", { type: "email", autocomplete: "username", required: true, value: email }),
      field("auth-password", "Senha", { type: "password", autocomplete: "current-password", required: true }),
      el("div", { class: "auth__row" }, el("label", { class: "consent" }, remember, el("span", { text: "Manter conectado" }))),
      submit,
      el("div", { class: "auth__row" }, link("Esqueci a senha", () => {
        email = form.querySelector("#auth-email").value.trim();
        showForgot();
      }), link("Esqueci o e-mail", () => showForgotEmail())),
      el("p", { class: "auth__rodape" }, "Ainda não tem conta? ", link("Criar conta", () => showSignup())),
    );
    ui.box.replaceChildren(form);
    form.querySelector(email ? "#auth-password" : "#auth-email").focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError(null);
      email = form.querySelector("#auth-email").value.trim().toLowerCase();
      const password = form.querySelector("#auth-password").value;
      if (!email || !password) return setError("Informe o e-mail e a senha.");
      busy(submit, true, "Entrar");
      try {
        await setRemember(remember.checked);
        const { user, provisional } = await signIn(password);
        if (provisional) {
          // Até criar a nova senha, a conta volta a exigir a troca.
          await supabase.auth.updateUser({ data: { senhaPropria: false } });
          return showCreatePassword({ reason: "recovery" });
        }
        await seguir(user);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Entrar");
      }
    });
  }

  // ---- Criar conta ------------------------------------------------------------
  function showSignup() {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Criar conta" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Criar conta" }),
      el("p", { class: "lead auth__lead", text: `Comece com 3 dias grátis no ${produto}.` }),
      sociais("Continuar"),
      field("auth-nome", "Nome completo", { type: "text", autocomplete: "name", maxlength: "160", required: true }),
      field("auth-email", "E-mail", { type: "email", autocomplete: "username", required: true, value: email }),
      field("auth-new", "Senha", { type: "password", autocomplete: "new-password", minlength: "8", required: true }),
      field("auth-confirm", "Confirmar senha", { type: "password", autocomplete: "new-password", minlength: "8", required: true }),
      el("p", { class: "hint", text: "Mínimo de 8 caracteres, com letras e números." }),
      submit,
      el("p", { class: "auth__rodape" }, "Já tem conta? ", link("Entrar", () => showLogin())),
    );
    ui.box.replaceChildren(form);
    form.querySelector("#auth-nome").focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError(null);
      const nome = form.querySelector("#auth-nome").value.trim().replace(/\s+/g, " ");
      email = form.querySelector("#auth-email").value.trim().toLowerCase();
      const password = form.querySelector("#auth-new").value;
      if (nome.split(" ").length < 2) return setError("Informe o nome completo.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Informe um e-mail válido.");
      if (!SENHA_OK(password)) return setError("A senha precisa ter pelo menos 8 caracteres, com letras e números.");
      if (password !== form.querySelector("#auth-confirm").value) return setError("As senhas não conferem.");
      busy(submit, true, "Criar conta");
      try {
        await setRemember(true);
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nome, senhaPropria: true } } });
        if (error) throw error;
        // Projeto com confirmação de e-mail ligada: sem sessão até confirmar.
        if (!data.session) return showLogin("Conta criada. Confirme o e-mail pelo link enviado e entre aqui.");
        // E-mail já cadastrado devolve um usuário sem identidades.
        if (!data.user?.identities?.length) return setError(friendly({ message: "user already registered" }));
        await seguir(data.user);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Criar conta");
      }
    });
  }

  // ---- Completar o cadastro e começar o teste ----------------------------------
  function showCadastro(user) {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Começar o teste grátis" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Complete o seu cadastro" }),
      el("p", { class: "lead auth__lead", text: `Teste o ${produto} grátis por 3 dias (até 100 mil tokens de IA), sem cartão. Uma vez por pessoa.` }),
      field("auth-nome", "Nome completo", { type: "text", autocomplete: "name", maxlength: "160", required: true, value: nomeDe(user) }),
      field("auth-cpf", "CPF", { type: "text", inputmode: "numeric", maxlength: "14", placeholder: "000.000.000-00", required: true }),
      field("auth-tel", "Telefone (com DDD)", { type: "text", inputmode: "tel", autocomplete: "tel", maxlength: "16", placeholder: "(11) 98765-4321", required: true }),
      submit,
      el("div", { class: "auth__row" }, el("a", { class: "btn-link", href: linkAssinatura(user?.email ?? email, chaveProduto), target: "_blank", rel: "noopener", text: "Prefiro assinar agora" }), sair()),
    );
    ui.box.replaceChildren(form);
    const cpf = form.querySelector("#auth-cpf");
    cpf.addEventListener("input", () => {
      const d = digitos(cpf.value).slice(0, 11);
      cpf.value = d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    });
    form.querySelector(nomeDe(user) ? "#auth-cpf" : "#auth-nome").focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError(null);
      const nome = form.querySelector("#auth-nome").value.trim().replace(/\s+/g, " ");
      if (nome.split(" ").length < 2) return setError("Informe o nome completo.");
      if (digitos(cpf.value).length !== 11) return setError("Informe um CPF válido.");
      if (![10, 11].includes(digitos(form.querySelector("#auth-tel").value).length)) return setError("Informe um telefone com DDD.");
      busy(submit, true, "Começar o teste grátis");
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "teste", plano: chaveProduto, nome, email: user.email, cpf: digitos(cpf.value), telefone: digitos(form.querySelector("#auth-tel").value) }),
        });
        const d = await r.json().catch(() => ({}));
        if (!d.ok) {
          // Teste já usado (e-mail ou CPF): segue para a assinatura.
          if (r.status === 409 && /teste gratuito já foi utilizado/i.test(d.motivo ?? "")) return showAssinar(null, d.motivo);
          return setError(d.motivo ?? "Não foi possível começar o teste agora.");
        }
        await supabase.auth.refreshSession();
        const atual = await usuarioAtual(user);
        if (temProduto(atual)) return done(atual);
        setError("Teste liberado, mas a sessão não atualizou. Saia e entre de novo.");
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Começar o teste grátis");
      }
    });
  }

  // ---- Assinar (teste encerrado, assinatura inativa ou teste já usado) ---------
  function showAssinar(plano, texto) {
    setError(null);
    const titulo = plano?.motivo === "teste_encerrado" ? "Seu teste gratuito terminou" : "Assine para continuar";
    const mensagem =
      texto ??
      (plano?.motivo === "teste_encerrado"
        ? `O teste gratuito do ${produto} terminou. Assine para continuar: o seu histórico e os seus dados continuam guardados.`
        : `A sua assinatura do ${produto} não está ativa. Assine para voltar a usar.`);
    const verificar = el("button", { type: "button", class: "btn btn--ghost", text: "Já assinei · verificar" });
    verificar.addEventListener("click", async () => {
      busy(verificar, true, "Já assinei · verificar");
      try {
        await supabase.auth.refreshSession();
        const { data } = await supabase.auth.getUser();
        if (temProduto(data.user)) return done(data.user);
        setError("O pagamento ainda não foi confirmado. Pode levar alguns instantes.");
      } finally {
        busy(verificar, false, "Já assinei · verificar");
      }
    });
    ui.box.replaceChildren(
      el("h1", { class: "title auth__title", text: titulo }),
      el("p", { class: "lead auth__lead", text: mensagem }),
      el("a", { class: "btn btn--primary", href: linkAssinatura(email, chaveProduto), target: "_blank", rel: "noopener", text: `Assinar o ${produto}` }),
      el("div", { class: "auth__row" }, verificar, sair()),
    );
  }

  // ---- Criar a própria senha (1º acesso ou após a senha provisória) ------------
  function showCreatePassword({ reason }) {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Salvar senha e entrar" });
    const lead = reason === "first" ? `Bem-vindo ao ${produto}. Antes de continuar, crie a sua senha pessoal.` : "Crie uma nova senha. O código recebido deixa de valer.";
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: reason === "first" ? "Crie sua senha" : "Criar nova senha" }),
      el("p", { class: "lead auth__lead", text: lead }),
      field("auth-new", "Nova senha", { type: "password", autocomplete: "new-password", minlength: "8", required: true }),
      field("auth-confirm", "Confirmar nova senha", { type: "password", autocomplete: "new-password", minlength: "8", required: true }),
      el("p", { class: "hint", text: "Mínimo de 8 caracteres, com letras e números." }),
      submit,
      el("div", { class: "auth__row" }, sair()),
    );
    ui.box.replaceChildren(form);
    form.querySelector("#auth-new").focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = form.querySelector("#auth-new").value;
      if (!SENHA_OK(password)) return setError("A nova senha precisa ter pelo menos 8 caracteres, com letras e números.");
      if (password !== form.querySelector("#auth-confirm").value) return setError("As senhas não conferem.");
      setError(null);
      busy(submit, true, "Salvar senha e entrar");
      try {
        const { data, error } = await supabase.auth.updateUser({ password, data: { senhaPropria: true } });
        if (error) throw error;
        await seguir(data.user);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Salvar senha e entrar");
      }
    });
  }

  // ---- Esqueci a senha ----------------------------------------------------------
  function showForgot() {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Enviar código" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Esqueci a senha" }),
      el("p", { class: "lead auth__lead", text: "Informe o seu e-mail. Enviaremos um código para você entrar e criar uma nova senha." }),
      field("auth-email", "E-mail", { type: "email", autocomplete: "username", required: true, value: email }),
      submit,
      el("div", { class: "auth__row" }, link("Voltar para o login", () => showLogin()), link("Esqueci o e-mail", () => showForgotEmail())),
    );
    ui.box.replaceChildren(form);
    form.querySelector("#auth-email").focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      email = form.querySelector("#auth-email").value.trim().toLowerCase();
      if (!email) return setError("Informe o e-mail.");
      setError(null);
      busy(submit, true, "Enviar código");
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        showLogin(`Se ${maskEmail(email)} tiver conta, enviamos um código para ele. Digite o código no campo Senha; ele vale por pouco tempo.`);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Enviar código");
      }
    });
  }

  // ---- Esqueci o e-mail (pelo CPF) -------------------------------------------------
  function showForgotEmail() {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Procurar" });
    const resultado = el("div", { role: "status" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Esqueci o e-mail" }),
      el("p", { class: "lead auth__lead", text: "Informe o CPF do cadastro. Mostramos o e-mail da conta parcialmente oculto, para você reconhecer." }),
      field("auth-cpf", "CPF", { type: "text", inputmode: "numeric", maxlength: "14", placeholder: "000.000.000-00", required: true }),
      submit,
      resultado,
      el("div", { class: "auth__row" }, link("Voltar para o login", () => showLogin())),
    );
    ui.box.replaceChildren(form);
    form.querySelector("#auth-cpf").focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError(null);
      const cpf = digitos(form.querySelector("#auth-cpf").value);
      if (cpf.length !== 11) return setError("Informe um CPF válido.");
      busy(submit, true, "Procurar");
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/lembrar-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cpf }) });
        const d = await r.json().catch(() => ({}));
        if (!d.ok) return setError(d.motivo ?? "Não foi possível procurar agora.");
        resultado.replaceChildren(
          d.emails.length
            ? el("p", { class: "lead auth__lead", text: `Conta encontrada: ${d.emails.join(", ")}. Entre com esse e-mail; se não lembrar a senha, use "Esqueci a senha".` })
            : el("p", { class: "lead auth__lead", text: "Nenhuma conta com esse CPF. Crie uma conta." }),
        );
      } catch (error) {
        setError(friendly(error));
      } finally {
        busy(submit, false, "Procurar");
      }
    });
  }

  if (sessaoUser) seguir(sessaoUser).catch((e) => setError(friendly(e)));
  else showLogin();
}
