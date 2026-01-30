import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '../firebase/config'

// Configuração do cliente S3 (Cloudflare R2)
const s3Client = new S3Client({
  endpoint: import.meta.env.VITE_S3_ENDPOINT_URL,
  region: import.meta.env.VITE_S3_REGION || 'auto',
  credentials: {
    accessKeyId: import.meta.env.VITE_S3_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_S3_SECRET_ACCESS_KEY
  }
})

const BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME
// URL pública para acesso aos arquivos (R2 public URL ou custom domain)
const PUBLIC_URL = import.meta.env.VITE_S3_PUBLIC_URL
// Prefixo de path para organizar arquivos no bucket
const PATH_PREFIX = import.meta.env.VITE_S3_PATH_PREFIX || ''

/**
 * Faz upload de um arquivo para o Cloudflare R2
 * @param {File} file - Arquivo do comprovante
 * @returns {Promise<{url: string, fileName: string, size: number, type: string}>}
 */
export async function uploadComprovante(file) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  // Limite de 10MB
  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    throw new Error(`Arquivo muito grande. Máximo: 10MB`)
  }

  // Gera nome único com prefixo
  const timestamp = Date.now()
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const basePath = PATH_PREFIX ? `${PATH_PREFIX}/comprovantes` : 'comprovantes'
  const key = `${basePath}/${user.uid}/${timestamp}_${safeFileName}`

  try {
    // Converte File para ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Upload para R2
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type
    }))

    // Monta URL pública do arquivo
    const url = `${PUBLIC_URL}/${key}`

    return {
      url,
      key,
      fileName: file.name,
      size: file.size,
      type: file.type
    }
  } catch (error) {
    console.error('Erro no upload:', error)

    // Identifica tipo de erro para mensagem mais útil
    if (error.name === 'NetworkError' || error.message?.includes('Failed to fetch')) {
      throw new Error('Erro de conexão com o servidor de arquivos. Verifique sua internet.')
    }
    if (error.name === 'CredentialsProviderError' || error.Code === 'InvalidAccessKeyId') {
      throw new Error('Credenciais de acesso inválidas.')
    }
    if (error.Code === 'NoSuchBucket') {
      throw new Error('Bucket de armazenamento não encontrado.')
    }
    if (error.Code === 'AccessDenied') {
      throw new Error('Sem permissão para fazer upload.')
    }

    throw new Error(`Erro ao fazer upload: ${error.message || 'erro desconhecido'}`)
  }
}

/**
 * Faz download de um arquivo de uma URL e upload para o Cloudflare R2
 * @param {string} sourceUrl - URL do arquivo original
 * @param {string} fileName - Nome do arquivo
 * @returns {Promise<{url: string, fileName: string, size: number, type: string}>}
 */
export async function uploadFromUrl(sourceUrl, fileName = 'attachment') {
  const user = auth.currentUser

  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  try {
    // Baixar o arquivo da URL de origem
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      throw new Error(`Erro ao baixar arquivo: ${response.status}`)
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    // Limite de 10MB
    const MAX_SIZE = 10 * 1024 * 1024
    if (blob.size > MAX_SIZE) {
      console.warn(`Arquivo muito grande (${blob.size} bytes), pulando: ${fileName}`)
      return null
    }

    // Gera nome único com prefixo
    const timestamp = Date.now()
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const basePath = PATH_PREFIX ? `${PATH_PREFIX}/comprovantes` : 'comprovantes'
    const key = `${basePath}/${user.uid}/${timestamp}_${safeFileName}`

    // Upload para R2
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(arrayBuffer),
      ContentType: blob.type || 'application/octet-stream'
    }))

    // Monta URL pública do arquivo
    const url = `${PUBLIC_URL}/${key}`

    return {
      url,
      key,
      fileName,
      size: blob.size,
      type: blob.type || 'application/octet-stream'
    }
  } catch (error) {
    console.error('Erro ao migrar arquivo:', error)
    return null // Retorna null em vez de throw para não interromper a migração
  }
}

export default { uploadComprovante, uploadFromUrl }
