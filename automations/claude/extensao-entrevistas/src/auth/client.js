/**
 * Cliente das contas de acesso (Supabase Auth). As contas são criadas só pelo
 * administrador; o cadastro público fica desligado no projeto.
 *
 * "Manter conectado": a sessão fica em chrome.storage.local (sobrevive ao
 * fechar o Chrome); sem a opção, em chrome.storage.session (apagada ao fechar).
 */
import { createClient } from "@supabase/supabase-js";

const URL = __SUPABASE_URL__;
const KEY = __SUPABASE_PUBLISHABLE_KEY__;
export const authConfigured = Boolean(URL && KEY);

const REMEMBER = "authManterConectado";

async function remember() {
  return (await chrome.storage.local.get(REMEMBER))[REMEMBER] ?? true;
}

export async function setRemember(value) {
  await chrome.storage.local.set({ [REMEMBER]: value });
}

// Guarda a sessão no armazenamento escolhido e limpa o outro.
const storage = {
  async getItem(key) {
    const local = (await chrome.storage.local.get(key))[key];
    return local ?? (await chrome.storage.session.get(key))[key] ?? null;
  },
  async setItem(key, value) {
    const keep = await remember();
    await (keep ? chrome.storage.local : chrome.storage.session).set({ [key]: value });
    await (keep ? chrome.storage.session : chrome.storage.local).remove(key);
  },
  async removeItem(key) {
    await chrome.storage.local.remove(key);
    await chrome.storage.session.remove(key);
  },
};

export const supabase = authConfigured
  ? createClient(URL, KEY, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

export async function currentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export async function signOut() {
  await supabase?.auth.signOut({ scope: "local" });
}
