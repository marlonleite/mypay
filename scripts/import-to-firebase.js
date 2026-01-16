#!/usr/bin/env node

/**
 * Script para importar dados do Organizze no Firebase
 *
 * Uso: node scripts/import-to-firebase.js
 *
 * Requer:
 * - scripts/organizze-export.json (gerado pelo migrate-organizze.js)
 * - Variáveis Firebase no .env
 */

import 'dotenv/config'
import fs from 'fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import * as readline from 'readline'

// ============================================
// CONFIGURAÇÃO FIREBASE
// ============================================

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

// ============================================
// HELPERS
// ============================================

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🔥 Importação para Firebase\n')
  console.log('='.repeat(50))

  // 1. Carregar dados exportados
  const exportFile = 'scripts/organizze-export.json'
  if (!fs.existsSync(exportFile)) {
    console.error(`❌ Arquivo não encontrado: ${exportFile}`)
    console.log('   Execute primeiro: node scripts/migrate-organizze.js')
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(exportFile, 'utf-8'))
  console.log(`📄 Carregado: ${exportFile}`)
  console.log(`   - ${data.accounts.length} contas`)
  console.log(`   - ${data.cards.length} cartões`)
  console.log(`   - ${data.transactions.length} transações`)
  console.log(`   - ${data.cardExpenses.length} despesas de cartão`)
  console.log('='.repeat(50))

  // 2. Inicializar Firebase
  console.log('\n🔥 Conectando ao Firebase...')
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const auth = getAuth(app)

  // 3. Login
  console.log('\n🔐 Autenticação necessária')
  const email = await ask('   Email: ')
  const password = await ask('   Senha: ')

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const userId = userCredential.user.uid
    console.log(`\n✅ Logado como: ${userCredential.user.email}`)
    console.log(`   User ID: ${userId}`)

    // 4. Confirmar importação
    console.log('\n' + '='.repeat(50))
    console.log('⚠️  ATENÇÃO: Isso vai importar todos os dados!')
    console.log('='.repeat(50))
    const confirm = await ask('\nDigite "IMPORTAR" para continuar: ')

    if (confirm !== 'IMPORTAR') {
      console.log('\n❌ Importação cancelada')
      process.exit(0)
    }

    // 5. Importar contas
    console.log('\n📁 Importando contas...')
    const accountIdMap = {}
    for (const account of data.accounts) {
      try {
        // Verificar se já existe
        const q = query(
          collection(db, `users/${userId}/accounts`),
          where('name', '==', account.name)
        )
        const existing = await getDocs(q)

        if (existing.empty) {
          const docRef = await addDoc(collection(db, `users/${userId}/accounts`), {
            ...account,
            createdAt: new Date(),
          })
          accountIdMap[account.name] = docRef.id
          console.log(`   ✅ ${account.name}`)
        } else {
          accountIdMap[account.name] = existing.docs[0].id
          console.log(`   ⏭️  ${account.name} (já existe)`)
        }
      } catch (e) {
        console.log(`   ❌ ${account.name}: ${e.message}`)
      }
      await sleep(100) // Rate limiting
    }

    // 6. Importar cartões
    console.log('\n💳 Importando cartões...')
    const cardIdMap = {}
    for (const card of data.cards) {
      try {
        // Verificar se já existe
        const q = query(
          collection(db, `users/${userId}/cards`),
          where('name', '==', card.name)
        )
        const existing = await getDocs(q)

        if (existing.empty) {
          const docRef = await addDoc(collection(db, `users/${userId}/cards`), {
            ...card,
            createdAt: new Date(),
          })
          cardIdMap[card.name] = docRef.id
          console.log(`   ✅ ${card.name}`)
        } else {
          cardIdMap[card.name] = existing.docs[0].id
          console.log(`   ⏭️  ${card.name} (já existe)`)
        }
      } catch (e) {
        console.log(`   ❌ ${card.name}: ${e.message}`)
      }
      await sleep(100)
    }

    // 7. Importar transações
    console.log('\n📄 Importando transações...')
    let txCount = 0
    let txSkipped = 0
    for (const tx of data.transactions) {
      try {
        await addDoc(collection(db, `users/${userId}/transactions`), {
          ...tx,
          createdAt: new Date(),
        })
        txCount++
        if (txCount % 50 === 0) {
          process.stdout.write(`\r   ${txCount}/${data.transactions.length} transações...`)
        }
      } catch (e) {
        txSkipped++
      }
      await sleep(50) // Rate limiting
    }
    console.log(`\n   ✅ ${txCount} transações importadas`)
    if (txSkipped > 0) console.log(`   ⏭️  ${txSkipped} puladas`)

    // 8. Importar despesas de cartão
    console.log('\n💳 Importando despesas de cartão...')
    let cardExpCount = 0
    let cardExpSkipped = 0
    for (const expense of data.cardExpenses) {
      try {
        const cardId = cardIdMap[expense.cardName]
        if (cardId) {
          const { cardName, ...expenseData } = expense
          await addDoc(collection(db, `users/${userId}/cards/${cardId}/expenses`), {
            ...expenseData,
            createdAt: new Date(),
          })
          cardExpCount++
        } else {
          // Salvar como transação normal
          const { cardName, installment, totalInstallments, ...txData } = expense
          await addDoc(collection(db, `users/${userId}/transactions`), {
            ...txData,
            notes: `Cartão: ${cardName}${totalInstallments > 1 ? ` (${installment}/${totalInstallments})` : ''}`,
            createdAt: new Date(),
          })
          cardExpCount++
        }
        if (cardExpCount % 50 === 0) {
          process.stdout.write(`\r   ${cardExpCount}/${data.cardExpenses.length} despesas...`)
        }
      } catch (e) {
        cardExpSkipped++
      }
      await sleep(50)
    }
    console.log(`\n   ✅ ${cardExpCount} despesas importadas`)
    if (cardExpSkipped > 0) console.log(`   ⏭️  ${cardExpSkipped} puladas`)

    // 9. Resumo final
    console.log('\n' + '='.repeat(50))
    console.log('🎉 IMPORTAÇÃO CONCLUÍDA!')
    console.log('='.repeat(50))
    console.log(`   Contas:           ${Object.keys(accountIdMap).length}`)
    console.log(`   Cartões:          ${Object.keys(cardIdMap).length}`)
    console.log(`   Transações:       ${txCount}`)
    console.log(`   Despesas Cartão:  ${cardExpCount}`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('\n❌ Erro de autenticação:', error.message)
    process.exit(1)
  }
}

main()
