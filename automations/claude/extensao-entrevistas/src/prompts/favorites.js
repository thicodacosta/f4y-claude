/** Prompts favoritos do usuário (ids), em chrome.storage.local. */
import { PROMPTS } from "./library.js";

export async function getFavoriteIds() {
  return (await chrome.storage.local.get("promptFavoritos")).promptFavoritos ?? [];
}

export async function toggleFavorite(id) {
  const ids = await getFavoriteIds();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  await chrome.storage.local.set({ promptFavoritos: next });
  return next;
}

/** Prompts favoritos, na ordem da biblioteca. */
export async function getFavoritePrompts() {
  const ids = new Set(await getFavoriteIds());
  return PROMPTS.filter((p) => ids.has(p.id));
}

export function onFavoritesChange(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "promptFavoritos" in changes) callback(changes.promptFavoritos.newValue ?? []);
  });
}
