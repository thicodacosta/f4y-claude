/**
 * Tela de acesso das páginas da extensão: senha + código de 6 dígitos enviado
 * por e-mail (2 etapas), "Manter conectado" e "Esqueci a senha". Bloqueia a
 * página até o usuário entrar.
 */
import { authConfigured, currentUser, setRemember, signOut, supabase } from "./client.js";

const RESEND_SECONDS = 60;

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

/** Mensagens claras para os erros do Supabase Auth. */
function friendly(error) {
  const msg = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  if (/invalid login credentials|invalid_credentials/.test(msg)) return "E-mail ou senha incorretos.";
  if (/token has expired|otp_expired|invalid.*otp|token.*invalid/.test(msg)) return "Código inválido ou expirado. Peça um novo código.";
  if (/rate limit|too many|over_email_send_rate_limit|security purposes/.test(msg)) return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
  if (/signups not allowed|user not found|otp_disabled/.test(msg)) return "Este e-mail não tem acesso ao ToolsKit. Fale com o administrador.";
  if (/password should be|weak_password/.test(msg)) return "A nova senha precisa ter pelo menos 8 caracteres, com letras e números.";
  if (/failed to fetch|network/.test(msg)) return "Sem conexão com o servidor. Verifique sua internet.";
  return "Não foi possível concluir agora. Tente novamente.";
}

function buildScreen() {
  const status = el("p", { class: "auth__error", role: "alert", hidden: true });
  const info = el("p", { class: "auth__info", role: "status" });
  const box = el("div", { class: "auth__box" });
  const card = el(
    "div",
    { class: "auth__card" },
    el("img", { src: "icons/journeylab-logo.png", alt: "JourneyLab", class: "auth__logo" }),
    el("p", { class: "eyebrow auth__eyebrow", text: "ToolsKit" }),
    box,
    status,
  );
  const screen = el("div", { class: "auth", role: "dialog", "aria-modal": "true", "aria-label": "Acesso ao ToolsKit" }, card);
  return { screen, box, status, info };
}

/**
 * Bloqueia a página até haver sessão válida. Devolve o usuário. Se `onFirst`
 * for informado, é chamado quando o login acontece nesta tela.
 */
export async function requireAuth({ onLogin } = {}) {
  if (!authConfigured) return null; // pacote de desenvolvimento sem login configurado
  const existing = await currentUser();
  if (existing) {
    watchSignOut();
    return existing;
  }

  document.documentElement.classList.add("is-locked");
  const ui = buildScreen();
  document.body.append(ui.screen);

  const user = await new Promise((resolve) => runFlow(ui, resolve));
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

function runFlow(ui, done) {
  let email = "";
  let resendTimer = null;

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

  // ---- 1. E-mail e senha ----------------------------------------------------
  function showLogin() {
    setError(null);
    const remember = el("input", { type: "checkbox", id: "auth-remember", checked: true });
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Entrar" });
    const forgot = el("button", { type: "button", class: "btn-link", text: "Esqueci a senha" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Entrar" }),
      el("p", { class: "lead auth__lead", text: "Use o e-mail e a senha criados pelo administrador." }),
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
        // 1ª etapa: confere a senha e descarta essa sessão; o acesso só é
        // liberado com o código enviado por e-mail (2ª etapa).
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await supabase.auth.signOut({ scope: "local" });
        await sendCode();
        showCode();
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Entrar");
      }
    });
  }

  async function sendCode() {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) throw error;
  }

  function startResendTimer(button) {
    let left = RESEND_SECONDS;
    clearInterval(resendTimer);
    button.disabled = true;
    const tick = () => {
      button.textContent = left > 0 ? `Reenviar código (${left}s)` : "Reenviar código";
      button.disabled = left > 0;
      left -= 1;
      if (left < -1) clearInterval(resendTimer);
    };
    tick();
    resendTimer = setInterval(tick, 1000);
  }

  // ---- 2. Código por e-mail -------------------------------------------------
  function showCode() {
    setError(null);
    const code = el("input", {
      id: "auth-code",
      class: "auth__code",
      inputmode: "numeric",
      autocomplete: "one-time-code",
      maxlength: "6",
      pattern: "[0-9]{6}",
      "aria-describedby": "auth-code-hint",
    });
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Verificar e entrar" });
    const resend = el("button", { type: "button", class: "btn-link" });
    const back = el("button", { type: "button", class: "btn-link", text: "Voltar" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Verificação em 2 etapas" }),
      el("p", { class: "lead auth__lead", id: "auth-code-hint", text: `Enviamos um código de 6 dígitos para ${maskEmail(email)}. Ele vale por alguns minutos.` }),
      el("div", { class: "field" }, el("label", { for: "auth-code", text: "Código" }), code),
      submit,
      el("div", { class: "auth__row" }, back, resend),
    );
    ui.box.replaceChildren(form);
    code.focus();
    startResendTimer(resend);

    code.addEventListener("input", () => {
      code.value = code.value.replace(/\D/g, "").slice(0, 6);
      if (code.value.length === 6) form.requestSubmit();
    });
    back.addEventListener("click", () => {
      clearInterval(resendTimer);
      showLogin();
    });
    resend.addEventListener("click", async () => {
      setError(null);
      try {
        await sendCode();
        startResendTimer(resend);
      } catch (error) {
        setError(friendly(error));
      }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (code.value.length !== 6) return setError("Digite os 6 dígitos do código.");
      setError(null);
      busy(submit, true, "Verificar e entrar");
      try {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code.value, type: "email" });
        if (error) throw error;
        clearInterval(resendTimer);
        done(data.user);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
        code.select();
      } finally {
        busy(submit, false, "Verificar e entrar");
      }
    });
  }

  // ---- Esqueci a senha ------------------------------------------------------
  function showForgot() {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Enviar código" });
    const back = el("button", { type: "button", class: "btn-link", text: "Voltar para o login" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Esqueci a senha" }),
      el("p", { class: "lead auth__lead", text: "Informe seu e-mail. Enviaremos um código para você criar uma nova senha." }),
      field("auth-email", "E-mail", { type: "email", autocomplete: "username", required: true, value: email }),
      submit,
      el("div", { class: "auth__row" }, back),
    );
    ui.box.replaceChildren(form);
    form.querySelector("#auth-email").focus();
    back.addEventListener("click", showLogin);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      email = form.querySelector("#auth-email").value.trim().toLowerCase();
      if (!email) return setError("Informe o e-mail.");
      setError(null);
      busy(submit, true, "Enviar código");
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        showNewPassword();
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Enviar código");
      }
    });
  }

  function showNewPassword() {
    setError(null);
    const submit = el("button", { type: "submit", class: "btn btn--primary", text: "Salvar nova senha e entrar" });
    const back = el("button", { type: "button", class: "btn-link", text: "Voltar para o login" });
    const form = el(
      "form",
      { novalidate: true },
      el("h1", { class: "title auth__title", text: "Criar nova senha" }),
      el("p", { class: "lead auth__lead", text: `Se ${maskEmail(email)} tiver acesso, enviamos um código de 6 dígitos para ele.` }),
      field("auth-reset-code", "Código", { inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6" }),
      field("auth-new", "Nova senha", { type: "password", autocomplete: "new-password", minlength: "8" }),
      field("auth-confirm", "Confirmar nova senha", { type: "password", autocomplete: "new-password", minlength: "8" }),
      el("p", { class: "hint", text: "Mínimo de 8 caracteres, com letras e números." }),
      submit,
      el("div", { class: "auth__row" }, back),
    );
    ui.box.replaceChildren(form);
    form.querySelector("#auth-reset-code").focus();
    back.addEventListener("click", showLogin);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = form.querySelector("#auth-reset-code").value.replace(/\D/g, "");
      const password = form.querySelector("#auth-new").value;
      if (token.length !== 6) return setError("Digite os 6 dígitos do código.");
      if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
        return setError("A nova senha precisa ter pelo menos 8 caracteres, com letras e números.");
      }
      if (password !== form.querySelector("#auth-confirm").value) return setError("As senhas não conferem.");
      setError(null);
      busy(submit, true, "Salvar nova senha e entrar");
      try {
        // O código de recuperação comprova o e-mail; com ele a senha é trocada.
        const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
        if (error) throw error;
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        done(data.user);
      } catch (error) {
        console.error(error);
        setError(friendly(error));
      } finally {
        busy(submit, false, "Salvar nova senha e entrar");
      }
    });
  }

  showLogin();
}
