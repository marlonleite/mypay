#!/usr/bin/env node

/**
 * Script de migração do Organizze para myPay
 *
 * Uso: node scripts/migrate-organizze.js
 *
 * Inclui download de anexos e upload para MinIO/S3
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// ============================================
// CONFIGURAÇÃO
// ============================================

const ORGANIZZE_EMAIL = process.env.VITE_ORGANIZZE_EMAIL
const ORGANIZZE_API_KEY = process.env.VITE_ORGANIZZE_API_KEY

// MinIO/S3 Config
const S3_CONFIG = {
  endpoint: process.env.VITE_S3_ENDPOINT_URL,
  accessKeyId: process.env.VITE_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.VITE_S3_SECRET_ACCESS_KEY,
  bucket: process.env.VITE_S3_BUCKET_NAME,
  region: process.env.VITE_S3_REGION || 'us-east-1',
}

// Período para migrar
const START_DATE = '2022-01-01'
const END_DATE = new Date().toISOString().split('T')[0]

// Baixar anexos?
const DOWNLOAD_ATTACHMENTS = true

const BASE_URL = 'https://api.organizze.com.br/rest/v2'

// ============================================
// S3/MINIO CLIENT
// ============================================

let s3Client = null

function initS3() {
  if (!S3_CONFIG.endpoint || !S3_CONFIG.accessKeyId) {
    console.log('  ⚠️  S3/MinIO não configurado, anexos serão ignorados')
    return false
  }

  s3Client = new S3Client({
    endpoint: S3_CONFIG.endpoint,
    region: S3_CONFIG.region,
    credentials: {
      accessKeyId: S3_CONFIG.accessKeyId,
      secretAccessKey: S3_CONFIG.secretAccessKey,
    },
    forcePathStyle: true,
  })

  return true
}

async function downloadAndUploadAttachment(url, transactionId) {
  if (!s3Client || !url) return null

  try {
    // Baixar arquivo do Organizze
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    // Determinar extensão
    const ext = url.split('.').pop()?.split('?')[0] || 'jpg'
    const fileName = `comprovantes/organizze_${transactionId}_${Date.now()}.${ext}`

    // Upload para MinIO
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    }))

    const publicUrl = `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/${fileName}`
    return { url: publicUrl, fileName, contentType }
  } catch (error) {
    console.log(`     ⚠️  Erro ao migrar anexo: ${error.message}`)
    return null
  }
}

// ============================================
// API DO ORGANIZZE
// ============================================

async function fetchOrganizze(endpoint) {
  const credentials = Buffer.from(`${ORGANIZZE_EMAIL}:${ORGANIZZE_API_KEY}`).toString('base64')

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'User-Agent': `myPay Migration (${ORGANIZZE_EMAIL})`,
    },
  })

  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

async function getAccounts() {
  console.log('  📁 Buscando contas...')
  return fetchOrganizze('/accounts')
}

async function getCategories() {
  console.log('  📂 Buscando categorias...')
  return fetchOrganizze('/categories')
}

async function getCreditCards() {
  console.log('  💳 Buscando cartões...')
  return fetchOrganizze('/credit_cards')
}

async function getTransactions(startDate, endDate) {
  console.log(`  📄 Buscando transações de ${startDate} a ${endDate}...`)
  return fetchOrganizze(`/transactions?start_date=${startDate}&end_date=${endDate}`)
}

// ============================================
// CONVERSÃO DE DADOS
// ============================================

function mapAccountType(type) {
  const map = { 'checking': 'checking', 'savings': 'savings', 'other': 'wallet' }
  return map[type] || 'wallet'
}

function mapCardBrand(network) {
  const map = {
    'visa': 'Visa', 'mastercard': 'Mastercard', 'amex': 'American Express',
    'elo': 'Elo', 'hipercard': 'Hipercard', 'diners': 'Diners',
  }
  return map[network?.toLowerCase()] || network || 'Outro'
}

function getCardColor(network) {
  const colors = {
    'visa': 'blue', 'mastercard': 'red', 'amex': 'slate',
    'elo': 'orange', 'hipercard': 'red', 'nubank': 'purple',
  }
  return colors[network?.toLowerCase()] || 'slate'
}

function convertData(organizzeData) {
  const { accounts, categories, creditCards, transactions } = organizzeData

  // Mapas para lookup
  const categoryMap = {}
  categories.forEach(cat => {
    categoryMap[cat.id] = cat.name
  })

  // Converter contas
  const myPayAccounts = accounts
    .filter(acc => !acc.archived)
    .map(acc => ({
      name: acc.name,
      type: mapAccountType(acc.type),
      balance: 0,
      isActive: true,
    }))

  // Converter cartões
  const myPayCards = creditCards
    .filter(card => !card.archived)
    .map(card => ({
      name: card.name,
      brand: mapCardBrand(card.card_network),
      limit: (card.limit_cents || 0) / 100,
      closingDay: card.closing_day,
      dueDay: card.due_day,
      color: getCardColor(card.card_network),
      isActive: true,
    }))

  // Mapa de cartões por ID
  const cardMap = {}
  creditCards.forEach(card => {
    cardMap[card.id] = card.name
  })

  // Separar transações normais e de cartão
  const normalTransactions = []
  const cardExpenses = []

  transactions.forEach(t => {
    const isIncome = t.amount_cents > 0
    const categoryName = categoryMap[t.category_id] || 'Outros'
    const categoryId = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')

    const base = {
      description: t.description,
      amount: Math.abs(t.amount_cents) / 100,
      type: isIncome ? 'income' : 'expense',
      category: categoryId,
      date: t.date,
      isPending: !t.paid,
      notes: t.notes || '',
      tags: t.tags || [],
      _organizzeId: t.id,
      _attachments: t.attachments || [],
    }

    if (t.credit_card_id) {
      cardExpenses.push({
        ...base,
        cardName: cardMap[t.credit_card_id] || 'Cartão',
        installment: t.installment || 1,
        totalInstallments: t.total_installments || 1,
      })
    } else {
      normalTransactions.push(base)
    }
  })

  // Extrair categorias únicas
  const uniqueCategories = [...new Set(transactions.map(t => categoryMap[t.category_id]).filter(Boolean))]

  return {
    accounts: myPayAccounts,
    cards: myPayCards,
    transactions: normalTransactions,
    cardExpenses,
    categories: uniqueCategories,
    stats: {
      accounts: myPayAccounts.length,
      cards: myPayCards.length,
      transactions: normalTransactions.length,
      cardExpenses: cardExpenses.length,
      categories: uniqueCategories.length,
      totalIncome: normalTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: normalTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      attachments: [...normalTransactions, ...cardExpenses].filter(t => t._attachments?.length > 0).length,
    }
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 Migração Organizze → myPay\n')
  console.log('='.repeat(50))

  // Validar configuração
  if (!ORGANIZZE_EMAIL || !ORGANIZZE_API_KEY) {
    console.error('❌ Configure VITE_ORGANIZZE_EMAIL e VITE_ORGANIZZE_API_KEY no .env')
    process.exit(1)
  }

  console.log(`📧 Email: ${ORGANIZZE_EMAIL}`)
  console.log(`📅 Período: ${START_DATE} a ${END_DATE}`)
  console.log('='.repeat(50))

  try {
    // 1. Buscar dados do Organizze
    console.log('\n📥 Buscando dados do Organizze...')

    const accounts = await getAccounts()
    const categories = await getCategories()
    const creditCards = await getCreditCards()
    const transactions = await getTransactions(START_DATE, END_DATE)

    const organizzeData = { accounts, categories, creditCards, transactions }

    // 2. Converter dados
    console.log('\n🔄 Convertendo dados...')
    const converted = convertData(organizzeData)

    // 3. Mostrar resumo
    console.log('\n' + '='.repeat(50))
    console.log('📊 RESUMO DOS DADOS')
    console.log('='.repeat(50))
    console.log(`   Contas:           ${converted.stats.accounts}`)
    console.log(`   Cartões:          ${converted.stats.cards}`)
    console.log(`   Categorias:       ${converted.stats.categories}`)
    console.log(`   Transações:       ${converted.stats.transactions}`)
    console.log(`   Despesas Cartão:  ${converted.stats.cardExpenses}`)
    console.log(`   📎 Com anexos:    ${converted.stats.attachments}`)
    console.log('='.repeat(50))
    console.log(`   💰 Receitas:      R$ ${converted.stats.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    console.log(`   💸 Despesas:      R$ ${converted.stats.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    console.log(`   📊 Saldo:         R$ ${(converted.stats.totalIncome - converted.stats.totalExpense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    console.log('='.repeat(50))

    // 4. Mostrar contas
    console.log('\n📁 CONTAS:')
    converted.accounts.forEach(acc => {
      console.log(`   • ${acc.name} (${acc.type})`)
    })

    // 5. Mostrar cartões
    console.log('\n💳 CARTÕES:')
    converted.cards.forEach(card => {
      console.log(`   • ${card.name} - ${card.brand} (fecha dia ${card.closingDay}, vence dia ${card.dueDay})`)
    })

    // 6. Mostrar categorias
    console.log('\n📂 CATEGORIAS:')
    converted.categories.slice(0, 15).forEach(cat => {
      console.log(`   • ${cat}`)
    })
    if (converted.categories.length > 15) {
      console.log(`   ... e mais ${converted.categories.length - 15} categorias`)
    }

    // 7. Processar anexos (baixar do Organizze e fazer upload para MinIO)
    if (DOWNLOAD_ATTACHMENTS && converted.stats.attachments > 0) {
      console.log('\n📎 PROCESSANDO ANEXOS...')
      const s3Ready = initS3()

      if (s3Ready) {
        const allItems = [...converted.transactions, ...converted.cardExpenses]
        const itemsWithAttachments = allItems.filter(t => t._attachments?.length > 0)
        let processed = 0
        let success = 0

        for (const item of itemsWithAttachments) {
          for (const attachment of item._attachments) {
            processed++
            process.stdout.write(`\r   ${processed}/${converted.stats.attachments} anexos...`)

            const uploaded = await downloadAndUploadAttachment(attachment.url, item._organizzeId)
            if (uploaded) {
              item.comprovante = uploaded
              success++
            }
          }
        }
        console.log(`\n   ✅ ${success} anexos migrados para MinIO`)
      }
    }

    // 8. Limpar campos internos antes de salvar
    const cleanData = {
      ...converted,
      transactions: converted.transactions.map(({ _organizzeId, _attachments, ...rest }) => rest),
      cardExpenses: converted.cardExpenses.map(({ _organizzeId, _attachments, ...rest }) => rest),
    }

    // 9. Salvar JSON para importação
    const outputFile = 'scripts/organizze-export.json'
    fs.writeFileSync(outputFile, JSON.stringify(cleanData, null, 2))
    console.log(`\n✅ Dados exportados para: ${outputFile}`)

    console.log('\n' + '='.repeat(50))
    console.log('📋 PRÓXIMOS PASSOS:')
    console.log('='.repeat(50))
    console.log('   1. Revise o arquivo organizze-export.json')
    console.log('   2. Execute: node scripts/import-to-firebase.js')
    console.log('='.repeat(50))

  } catch (error) {
    console.error('\n❌ Erro:', error.message)
    process.exit(1)
  }
}

main()
