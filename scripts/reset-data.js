#!/usr/bin/env node

/**
 * Script para resetar todos os dados do Firebase
 *
 * Uso: node scripts/reset-data.js
 *
 * Requer no .env:
 * - FIREBASE_USER_EMAIL
 * - FIREBASE_USER_PASSWORD
 *
 * CUIDADO: Este script apaga TODOS os dados do usuário!
 */

import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

// Credenciais do .env
const USER_EMAIL = process.env.FIREBASE_USER_EMAIL
const USER_PASSWORD = process.env.FIREBASE_USER_PASSWORD

// Coleções para deletar
const COLLECTIONS = [
  'transactions',
  'cardExpenses',
  'cards',
  'accounts',
  'categories',
  'tags',
  'budgets',
  'billPayments',
  'transfers'
]

async function deleteCollection(db, userId, collectionName) {
  const colRef = collection(db, `users/${userId}/${collectionName}`)
  const snapshot = await getDocs(colRef)

  let count = 0
  for (const docSnap of snapshot.docs) {
    await deleteDoc(doc(db, `users/${userId}/${collectionName}`, docSnap.id))
    count++
  }

  return count
}

async function main() {
  console.log('🗑️  Reset de Dados do myPay\n')
  console.log('='.repeat(50))

  // Validar credenciais
  if (!USER_EMAIL || !USER_PASSWORD) {
    console.error('❌ Configure FIREBASE_USER_EMAIL e FIREBASE_USER_PASSWORD no .env')
    process.exit(1)
  }

  // 1. Inicializar Firebase
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)
  const auth = getAuth(app)

  try {
    // 2. Login automático
    console.log(`🔐 Autenticando como ${USER_EMAIL}...`)
    const userCredential = await signInWithEmailAndPassword(auth, USER_EMAIL, USER_PASSWORD)
    const userId = userCredential.user.uid
    console.log(`✅ Logado! User ID: ${userId}`)

    // 3. Contar documentos
    console.log('\n📊 Contando documentos...')
    const counts = {}
    let total = 0

    for (const col of COLLECTIONS) {
      const colRef = collection(db, `users/${userId}/${col}`)
      const snapshot = await getDocs(colRef)
      counts[col] = snapshot.size
      total += snapshot.size
      if (snapshot.size > 0) {
        console.log(`   ${col}: ${snapshot.size} documentos`)
      }
    }

    if (total === 0) {
      console.log('\n✅ Nenhum dado encontrado. Banco já está limpo!')
      process.exit(0)
    }

    console.log(`\n   TOTAL: ${total} documentos`)
    console.log('='.repeat(50))

    // 4. Deletar dados (sem confirmação - automático)
    console.log('\n🗑️  Deletando dados...')

    for (const col of COLLECTIONS) {
      if (counts[col] > 0) {
        process.stdout.write(`   ${col}...`)
        const deleted = await deleteCollection(db, userId, col)
        console.log(` ✅ ${deleted} deletados`)
      }
    }

    // 5. Resumo
    console.log('\n' + '='.repeat(50))
    console.log('🎉 RESET CONCLUÍDO!')
    console.log('='.repeat(50))
    console.log(`   ${total} documentos deletados`)
    console.log('\n📋 Próximos passos:')
    console.log('   1. node scripts/migrate-organizze.js')
    console.log('   2. node scripts/import-to-firebase.js')
    console.log('='.repeat(50))

  } catch (error) {
    console.error('\n❌ Erro:', error.message)
    process.exit(1)
  }
}

main()
