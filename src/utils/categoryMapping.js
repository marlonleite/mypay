// Mapeamento de categorias AI (inglês) para palavras-chave em português
export const AI_CATEGORY_MAPPING = {
  // Despesas
  food: ['alimentação', 'comida', 'refeição', 'restaurante', 'mercado'],
  transport: ['transporte', 'uber', 'combustível', 'gasolina', 'ônibus'],
  housing: ['moradia', 'aluguel', 'condomínio', 'casa', 'tributos', 'iptu', 'água', 'luz', 'energia'],
  health: ['saúde', 'médico', 'remédio', 'farmácia', 'hospital', 'plano'],
  leisure: ['lazer', 'entretenimento', 'cinema', 'streaming', 'jogos'],
  education: ['educação', 'curso', 'escola', 'faculdade', 'livro'],
  other: ['outros', 'geral'],
  // Receitas
  salary: ['salário', 'remuneração', 'pagamento'],
  freelance: ['freelance', 'serviço', 'trabalho', 'autônomo'],
  investments: ['investimento', 'rendimento', 'dividendo', 'juros'],
}

/**
 * Normaliza string para comparação: lowercase + remove acentos + colapsa espaços.
 */
function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Encontra a melhor categoria Firestore com base na categoria sugerida pela IA.
 *
 * Backend (Wave 8) instrui o LLM a retornar EXATAMENTE o nome da categoria do user
 * (`mypay-api/src/infra/ai/prompts.py`), incluindo subcategorias. Por isso a busca:
 *   1) considera main + sub (sem filtrar `!c.parentId`);
 *   2) tenta match exato por nome normalizado primeiro;
 *   3) só então tenta keyword/substring;
 *   4) retorna `null` quando nada bate (sem fallback cego para [0]).
 */
export function findBestCategory(aiCategory, firestoreCategories, type) {
  if (!aiCategory || !firestoreCategories?.length) return null

  const aiCatNorm = normalizeName(aiCategory)
  if (!aiCatNorm) return null

  const categoriesOfType = firestoreCategories.filter(c => c.type === type)
  if (!categoriesOfType.length) return null

  // 1) Match exato por nome normalizado (caminho principal).
  for (const cat of categoriesOfType) {
    if (normalizeName(cat.name) === aiCatNorm) {
      return cat.id
    }
  }

  // 2) Keyword mapping (mantido para nomes em inglês legados do LLM antigo).
  const keywords = AI_CATEGORY_MAPPING[aiCatNorm] || []
  for (const cat of categoriesOfType) {
    const catNameNorm = normalizeName(cat.name)
    for (const keyword of keywords) {
      if (catNameNorm.includes(normalizeName(keyword))) {
        return cat.id
      }
    }
  }

  // 3) Substring match bidirecional (último recurso antes de desistir).
  for (const cat of categoriesOfType) {
    const catNameNorm = normalizeName(cat.name)
    if (catNameNorm.includes(aiCatNorm) || aiCatNorm.includes(catNameNorm)) {
      return cat.id
    }
  }

  return null
}
