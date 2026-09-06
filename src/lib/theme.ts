/**
 * Tema visual (papel / tinta / automático). Este módulo NO es cliente: lo importa
 * el root layout (server) para inyectar el script de arranque, y ThemeToggle
 * (cliente) para leer/escribir la preferencia.
 */
export type ThemePreference = "auto" | "light" | "dark";

export const THEME_STORAGE_KEY = "ensenia.theme";

/**
 * Script inline para el <head>: aplica la preferencia guardada ANTES del primer
 * paint (evita el destello de tema equivocado). Chico y sin dependencias.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
