/**
 * Flat list for category pickers: main categories, then their subs (indented name),
 * then orphans (type matches but not reachable via main→sub tree).
 *
 * @param {Array<object>} allCategories — mapped frontend categories ({ id, name, type, parentId, archived, ... })
 * @param {'expense'|'income'} transactionType
 * @returns {Array<object>} items suitable for CategorySelector (spread preserves icon/color; `name` is display label)
 */
export function flattenCategoriesForPicker(allCategories, transactionType) {
  if (!Array.isArray(allCategories) || allCategories.length === 0) return []

  const mains = allCategories.filter(
    c => c.type === transactionType && !c.parentId && !c.archived
  )
  const result = []
  const seen = new Set()

  for (const cat of mains) {
    result.push({ ...cat, name: cat.name, isMain: true })
    seen.add(cat.id)

    const subs = allCategories.filter(
      c =>
        !c.archived &&
        c.parentId === cat.id &&
        c.type === transactionType
    )

    for (const sub of subs) {
      result.push({
        ...sub,
        name: `  ${sub.name}`,
        isMain: false,
        parentName: cat.name
      })
      seen.add(sub.id)
    }
  }

  const orphans = allCategories.filter(
    c =>
      !c.archived &&
      c.type === transactionType &&
      !seen.has(c.id)
  )

  for (const c of orphans) {
    const parent = c.parentId
      ? allCategories.find(p => p.id === c.parentId)
      : null
    const label =
      parent && !parent.archived ? `${parent.name} > ${c.name}` : c.name
    result.push({
      ...c,
      name: label,
      isMain: !c.parentId
    })
    seen.add(c.id)
  }

  return result
}
