/** Bundled UI version from package.json (injected by Vite — see vite.config.js). */
export const APP_BUNDLED_VERSION =
  String(import.meta.env.VITE_APP_VERSION || '1.0.0')
