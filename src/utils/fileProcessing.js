import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE } from './constants'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const MIN_TEXT_LENGTH = 50

/**
 * Converte um arquivo para base64
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      // Remove o prefixo "data:image/jpeg;base64," para obter apenas o base64
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = (error) => reject(error)
  })
}

/**
 * Valida se o arquivo é de um tipo suportado e não excede o tamanho máximo
 */
export const validateFile = (file) => {
  const allSupportedTypes = [
    ...SUPPORTED_FILE_TYPES.images,
    ...SUPPORTED_FILE_TYPES.documents
  ]

  if (!allSupportedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de arquivo não suportado. Use JPG, PNG, WEBP, HEIC ou PDF.'
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Arquivo muito grande. Tamanho máximo: 10MB.'
    }
  }

  return { valid: true, error: null }
}

/**
 * Retorna o tipo simplificado do arquivo
 */
export const getFileType = (file) => {
  if (SUPPORTED_FILE_TYPES.images.includes(file.type)) {
    return 'image'
  }
  if (SUPPORTED_FILE_TYPES.documents.includes(file.type)) {
    return 'pdf'
  }
  return 'unknown'
}

/**
 * Formata o tamanho do arquivo para exibição
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Obtém a URL de preview do arquivo
 */
export const getFilePreviewUrl = (file) => {
  return URL.createObjectURL(file)
}

/**
 * Extrai texto de um PDF usando pdf.js
 * Retorna null se o PDF não contiver texto suficiente (escaneado/imagem)
 */
export const extractTextFromPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pageTexts = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map(item => item.str).join(' ')
    pageTexts.push(`--- Página ${i} ---\n${text}`)
  }

  const fullText = pageTexts.join('\n\n')

  if (fullText.replace(/[\s\-—]/g, '').length < MIN_TEXT_LENGTH) {
    return null
  }

  return fullText
}

/**
 * Libera a URL de preview do arquivo da memória
 */
export const revokeFilePreviewUrl = (url) => {
  URL.revokeObjectURL(url)
}
