/**
 * Normalize a tag value from API or legacy shapes for forms (string or { name }).
 */
export function normalizeTagForForm(tag) {
  if (!tag) return ''
  if (typeof tag === 'object' && tag !== null) return String(tag.name ?? '').trim()
  return String(tag).trim()
}

/**
 * Coerce tags field into a clean string[] for controlled inputs (never use raw string — Array.includes vs String.includes).
 */
export function coerceFormTagList(tags) {
  if (tags == null || tags === '') return []
  if (Array.isArray(tags)) return tags.map(normalizeTagForForm).filter(Boolean)
  if (typeof tags === 'string') {
    const s = tags.trim()
    return s ? [s] : []
  }
  return []
}
