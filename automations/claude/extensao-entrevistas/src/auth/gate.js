/**
 * Tela de acesso das páginas da extensão. Bloqueia a página até o usuário
 * entrar.
 *
 * - O administrador cria a conta e envia a senha inicial ao usuário.
 * - No primeiro login, o usuário cria a própria senha antes de continuar.
 * - "Esqueci a senha": chega por e-mail uma senha provisória (o código de
 *   recuperação do Supabase), usada no campo Senha do login; em seguida o
 *   usuário cria uma nova senha.
 *
 * `user_metadata.senhaPropria` marca quem já criou a própria senha.
 */
import { authConfigured, currentUser, setRemember, signOut, supabase } from "./client.js";

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

const maskEmail = (email) => email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${"•".repeat(Math.min(b.length, 6))}${c}`);

// Senha provisória enviada por e-mail: o código numérico de recuperação.
const PROVISIONAL = /^\d{6,10}$/;

const hasOwnPassword = (user) => user?.user_metadata?.senhaPropria === true;

// Nome do produto nas mensagens da tela (a mesma tela serve a outras extensões
// JourneyLab, ex.: BP).
let produto = "ToolsKit";

/** Mensagens claras para os erros do Supabase Auth. */
function friendly(error) {
  const msg = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  if (/invalid login credentials|invalid_credentials/.test(msg)) return "E-mail ou senha incorretos.";
  if (/token has expired|otp_expired|invalid.*otp|token.*invalid/.test(msg)) return "Senha provisória inválida ou expirada. Peça uma nova em \"Esqueci a senha\".";
  if (/rate limit|too many|over_email_send_rate_limit|security purposes/.test(msg)) return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
  if (/signups not allowed|user not found/.test(msg)) return `Este e-mail não tem acesso ao ${produto}. Fale com o administrador.`;
  if (/same_password|should be different/.test(msg)) return "A nova senha precisa ser diferente da senha atual.";
  if (/password should be|weak_password/.test(msg)) return "A nova senha precisa ter pelo menos 8 caracteres, com letras e números.";
  if (/reauthentication/.test(msg)) return "Por segurança, saia e entre de novo antes de trocar a senha.";
  if (/failed to fetch|network/.test(msg)) return "Sem conexão com o servidor. Verifique sua internet.";
  return "Não foi possível concluir agora. Tente novamente.";
}

function buildScreen() {
  const status = el("p", { class: "auth__error", role: "alert", hidden: true });
  const box = el("div", { class: "auth__box" });
  const card = el(
    "div",
    { class: "auth__card" },
    el("img", { src: "icons/journeylab-logo.png", alt: "JourneyLab", class: "auth__logo" }),
    el("p", { class: "eyebrow auth__eyebrow", text: produto }),
    box,
    status,
  );
  const screen = el("div", { class: "auth", role: "dialog", "aria-modal": "true", "aria-label": `Acesso ao ${produto}` }, card);
  return { screen, box, status };
}

/**
 * Bloqueia a página até haver sessão válida com senha própria. Devolve o
 * usuário. `onLogin` é chamado quando o acesso é liberado nesta tela.
 */
export async function requireAuth({ onLogin, nomeProduto } = {}) {
  if (nomeProduto) produto = nomeProduto;
  if (!authConfigured) return null; // pacote de desenvolvimento sem login configurado
  const existing = await currentUser();
  if (existing && hasOwnPassword(existing)) {
    watchSignOut();
    return existing;
  }

  document.documentElement.classList.add("is-locked");
  const ui = buildScreen();
  document.body.append(ui.screen);

  // Sessão aberta sem senha própria (ex.: fechou o painel antes de criá-la).
  const user = await new Promise((resolve) => runFlow(ui, resolve, existing));
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

function runFlow(ui, done, pendingUser) {
  let email = pendingUser?.email ?? "";

  const setError = (message) => {
    ui.status.textContent = message ?? "";
    ui.status.hidden = !message;
  };
  const busy = (button, on, label) => {
    button.disabled = on;
    if (label) button.textContent = on ? "Aguarde…" : label;
  };
  const field = (id, label, attrs) =>
    el("div", { class: "field" }, el("label", { for: id, text: label }), el("input", { id, ...attrs }));

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

  // ---- Login ----------------------------------------------------------------
  function showLogin(notice) {
    setError(null);
    const remember = el("input", { type: "checkbox", id: "auth-remember", checked: true });
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Entrar" });
    const forgot = el("button", { type: "button", class: "btn-link", text: "Esqueci a senha" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Entrar" }),
      el("p", {
        class: "lead auth__lead",
        role: notice ? "status" : null,
        text: notice ?? "Use o e-mail e a senha que você recebeu do administrador.",
      }),
      field("auth-email", "E-mail", { type: "email", autocomplete: "username", required: true, value: email }),
      field("auth-password", "Senha", { type: "password", autocomplete: "current-password", required: true }),
      el("div", { class: "auth__row" }, el("label", { class: "consent" }, remember, el("span", { text: "Manter conectado" })), forgot),
      submit,
    );
    ui.box.replaceChildren(form);
    form.querySelector(email ? "#auth-password" : "#auth-email").focus();

    forgot.addEventListener("click", () => {
      email = form.querySelector("#auth-email").value.trim();
      showForgot();
    });
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
        if (!hasOwnPassword(user)) return showCreatePassword({ reason: "first" });
        done(user);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Entrar");
      }
    });
  }

  // ---- Criar a própria senha (1º acesso ou após a senha provisória) ---------
  function showCreatePassword({ reason }) {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Salvar senha e entrar" });
    const leave = el("button", { type: "button", class: "btn-link", text: "Sair" });
    const lead =
      reason === "first"
        ? `Bem-vindo ao ${produto}. Antes de continuar, crie a sua senha pessoal. A senha recebida do administrador deixa de valer.`
        : "Crie uma nova senha. A senha provisória deixa de valer.";
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: reason === "first" ? "Crie sua senha" : "Criar nova senha" }),
      el("p", { class: "lead auth__lead", text: lead }),
      field("auth-new", "Nova senha", { type: "password", autocomplete: "new-password", minlength: "8", required: true }),
      field("auth-confirm", "Confirmar nova senha", { type: "password", autocomplete: "new-password", minlength: "8", required: true }),
      el("p", { class: "hint", text: "Mínimo de 8 caracteres, com letras e números." }),
      submit,
      el("div", { class: "auth__row" }, leave),
    );
    ui.box.replaceChildren(form);
    form.querySelector("#auth-new").focus();

    leave.addEventListener("click", async () => {
      await signOut();
      showLogin();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = form.querySelector("#auth-new").value;
      if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
        return setError("A nova senha precisa ter pelo menos 8 caracteres, com letras e números.");
      }
      if (password !== form.querySelector("#auth-confirm").value) return setError("As senhas não conferem.");
      setError(null);
      busy(submit, true, "Salvar senha e entrar");
      try {
        const { data, error } = await supabase.auth.updateUser({ password, data: { senhaPropria: true } });
        if (error) throw error;
        done(data.user);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Salvar senha e entrar");
      }
    });
  }

  // ---- Esqueci a senha ------------------------------------------------------
  function showForgot() {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Enviar senha provisória" });
    const back = el("button", { type: "button", class: "btn-link", text: "Voltar para o login" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Esqueci a senha" }),
      el("p", { class: "lead auth__lead", text: "Informe seu e-mail. Enviaremos uma senha provisória para você entrar e criar uma nova." }),
      field("auth-email", "E-mail", { type: "email", autocomplete: "username", required: true, value: email }),
      submit,
      el("div", { class: "auth__row" }, back),
    );
    ui.box.replaceChildren(form);
    form.querySelector("#auth-email").focus();
    back.addEventListener("click", () => showLogin());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      email = form.querySelector("#auth-email").value.trim().toLowerCase();
      if (!email) return setError("Informe o e-mail.");
      setError(null);
      busy(submit, true, "Enviar senha provisória");
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        showLogin(`Se ${maskEmail(email)} tiver acesso, enviamos uma senha provisória para ele. Use-a no campo Senha; ela vale por pouco tempo.`);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Enviar senha provisória");
      }
    });
  }

  if (pendingUser) showCreatePassword({ reason: "first" });
  else showLogin();
}
