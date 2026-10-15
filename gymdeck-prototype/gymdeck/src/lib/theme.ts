/** Thème de l'appli (sombre par défaut, clair en option), gardé sur l'appareil. */
export type Theme = "dark" | "light";
const KEY = "gymdeck:theme";
let theme: Theme = "dark";
const listeners = new Set<() => void>();

try { if (localStorage.getItem(KEY) === "light") theme = "light"; } catch { /* ignoré */ }

export const getTheme = () => theme;
export const subscribeTheme = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function applyTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#eef1f7" : "#070a12");
}
export function setTheme(t: Theme) {
  theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* ignoré */ }
  applyTheme();
  listeners.forEach((f) => f());
}
