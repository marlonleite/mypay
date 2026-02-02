import { useCallback } from 'react'
import { useTransactions } from './useFirestore'
import { useActivityLogger } from './useActivities'

/**
 * Hook wrapper que combina useTransactions com registro automático de atividades
 */
export function useTransactionsWithActivity(month, year) {
  const transactionsHook = useTransactions(month, year)
  const {
    logTransactionCreate,
    logTransactionUpdate,
    logTransactionDelete
  } = useActivityLogger()

  const addTransactionWithActivity = useCallback(async (data) => {
    const result = await transactionsHook.addTransaction(data)

    // Registrar atividade
    if (result?.id) {
      await logTransactionCreate({
        id: result.id,
        ...data
      })
    }

    return result
  }, [transactionsHook, logTransactionCreate])

  const updateTransactionWithActivity = useCallback(async (id, data, previousData = null) => {
    const result = await transactionsHook.updateTransaction(id, data)

    // Registrar atividade
    await logTransactionUpdate({ id, ...data }, previousData)

    return result
  }, [transactionsHook, logTransactionUpdate])

  const deleteTransactionWithActivity = useCallback(async (id, transactionData = null) => {
    const result = await transactionsHook.deleteTransaction(id)

    // Registrar atividade
    if (transactionData) {
      await logTransactionDelete({ id, ...transactionData })
    }

    return result
  }, [transactionsHook, logTransactionDelete])

  return {
    ...transactionsHook,
    // Sobrescrever métodos com versões que registram atividade
    addTransaction: addTransactionWithActivity,
    updateTransaction: updateTransactionWithActivity,
    deleteTransaction: deleteTransactionWithActivity,
    // Manter originais caso necessário
    addTransactionSilent: transactionsHook.addTransaction,
    updateTransactionSilent: transactionsHook.updateTransaction,
    deleteTransactionSilent: transactionsHook.deleteTransaction
  }
}
