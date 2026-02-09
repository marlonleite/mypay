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
 * Encontra a melhor categoria Firestore com base na categoria sugerida pela IA
 */
export function findBestCategory(aiCategory, firestoreCategories, type) {
  if (!aiCategory || !firestoreCategories?.length) return null

  const aiCatLower = aiCategory.toLowerCase()
  const keywords = AI_CATEGORY_MAPPING[aiCatLower] || []

  // Filtra categorias pelo tipo
  const categoriesOfType = firestoreCategories.filter(c => c.type === type && !c.parentId)

  // Procura por correspondência exata ou palavras-chave
  for (const cat of categoriesOfType) {
    const catNameLower = cat.name.toLowerCase()

    // Verifica se alguma palavra-chave está no nome da categoria
    for (const keyword of keywords) {
      if (catNameLower.includes(keyword)) {
        return cat.id
      }
    }

    // Verifica se o nome da categoria contém a categoria AI
    if (catNameLower.includes(aiCatLower)) {
      return cat.id
    }
  }

  // Se não encontrar, retorna a primeira categoria do tipo ou null
  return categoriesOfType[0]?.id || null
}
