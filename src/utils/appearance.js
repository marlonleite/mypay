/**
 * Appearance: accent/contrast persisted locally first; ThemeContext optionally syncs
 * matching fields via `/api/v1/settings` when the backend exposes columns (see AGENTS.md).
 */

export const STORAGE_KEY_ACCENT = 'mypay_accent_preset'

export const STORAGE_KEY_HIGH_CONTRAST = 'mypay_high_contrast'

/** When true, also enable high-contrast if the OS reports `(prefers-contrast: more)`. */
export const STORAGE_KEY_CONTRAST_FOLLOW_SYSTEM = 'mypay_contrast_follow_system'

export const PREFERS_CONTRAST_MORE_MEDIA = '(prefers-contrast: more)'

/** @typedef {'violet' | 'nubank' | 'aqua' | 'calm' | 'neon' | 'bank'} AccentPresetId */

export const ACCENT_PRESET_IDS = /** @type {const} */ ([
  'violet',
  'nubank',
  'aqua',
  'calm',
  'neon',
  'bank',
])

const VALID_ACCENTS = new Set(ACCENT_PRESET_IDS)

export const ACCENT_PRESETS = /** @type {const} */ ([
  { id: 'violet', label: 'Violeta', hint: 'Padrão atual' },
  { id: 'nubank', label: 'Roxo marca', hint: 'Tons próximos ao Nubank' },
  { id: 'aqua', label: 'Água-marinha', hint: 'Azul-esverdeado' },
  { id: 'calm', label: 'Calma', hint: 'Neutros quentes + índigo' },
  { id: 'neon', label: 'Neon', hint: 'Escuro profundo + teal' },
  { id: 'bank', label: 'Clássico', hint: 'Azul petróleo + arco frio' },
])

export const DEFAULT_ACCENT_PRESET = /** @type {AccentPresetId} */ ('violet')

/** @returns {AccentPresetId} */
export function readStoredAccentPreset() {
  if (typeof window === 'undefined') return DEFAULT_ACCENT_PRESET
  const raw = localStorage.getItem(STORAGE_KEY_ACCENT)
  return isAccentPresetId(raw) ? raw : DEFAULT_ACCENT_PRESET
}

/** @param {string | null | undefined} id */
export function isAccentPresetId(id) {
  return VALID_ACCENTS.has(id)
}

export function storeAccentPreset(accentId) {
  localStorage.setItem(STORAGE_KEY_ACCENT, accentId)
}

/** @param {AccentPresetId} accentId */
export function applyAccentToDocument(accentId) {
  if (typeof document === 'undefined') return
  const id = VALID_ACCENTS.has(accentId) ? accentId : DEFAULT_ACCENT_PRESET
  if (id === DEFAULT_ACCENT_PRESET) {
    document.documentElement.removeAttribute('data-accent')
  } else {
    document.documentElement.setAttribute('data-accent', id)
  }
}

export function readStoredHighContrast() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY_HIGH_CONTRAST) === '1'
}

export function storeHighContrast(enabled) {
  localStorage.setItem(STORAGE_KEY_HIGH_CONTRAST, enabled ? '1' : '0')
}

/** @param {boolean} enabled */
export function applyHighContrastToDocument(enabled) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('high-contrast', enabled)
}

export function readContrastFollowSystem() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY_CONTRAST_FOLLOW_SYSTEM) === '1'
}

export function storeContrastFollowSystem(enabled) {
  localStorage.setItem(STORAGE_KEY_CONTRAST_FOLLOW_SYSTEM, enabled ? '1' : '0')
}

/**
 * Resolved high-contrast class for `<html>`: manual checkbox OR OS preference when follow-system is on.
 * @param {{ manualHighContrast: boolean, followSystem: boolean }} p
 */
export function computeAppliedHighContrast(p) {
  if (typeof window === 'undefined') return p.manualHighContrast
  const osRequestsMore = window.matchMedia(PREFERS_CONTRAST_MORE_MEDIA).matches
  return Boolean(p.manualHighContrast || (p.followSystem && osRequestsMore))
}

export function bootstrapAppearanceDom() {
  if (typeof document === 'undefined') return
  const accent = readStoredAccentPreset()
  applyAccentToDocument(accent)
  applyHighContrastToDocument(
    computeAppliedHighContrast({
      manualHighContrast: readStoredHighContrast(),
      followSystem: readContrastFollowSystem(),
    }),
  )
}
