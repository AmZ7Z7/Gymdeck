/** Thème de l'appli : sombre uniquement (le thème clair de la v11 a été retiré). */
export function applyTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = "dark";
  try { localStorage.removeItem("gymdeck:theme"); } catch { /* ignoré */ }
}
