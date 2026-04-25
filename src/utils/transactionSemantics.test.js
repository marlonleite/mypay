import { describe, it, expect } from 'vitest'
import {
  isCreditCardInvoicePurchase,
  isCreditCardBillPayment,
  isAccountSideTransaction,
  matchesTransactionSourceFilter,
  isRecurrenceLinkedTransaction,
  isInstallmentPlanTransaction,
  formatInstallmentFraction
} from './transactionSemantics.js'

const API_EXAMPLE_ACCOUNT_EXPENSE = {
  id: 't1',
  account_id: 'acc-1',
  credit_card_id: null,
  credit_card_invoice_id: null,
  paid_credit_card_id: null,
  paid_credit_card_invoice_id: null,
  is_transfer: false,
  type: 'expense',
  amount: '50.00'
}

const API_EXAMPLE_CARD_PURCHASE = {
  id: 't2',
  account_id: null,
  credit_card_id: 'cc-1',
  credit_card_invoice_id: 'inv-1',
  paid_credit_card_id: null,
  paid_credit_card_invoice_id: null,
  is_transfer: false,
  type: 'expense',
  amount: '120.00'
}

const API_EXAMPLE_BILL_PAYMENT = {
  id: 't3',
  account_id: 'acc-1',
  credit_card_id: null,
  credit_card_invoice_id: null,
  paid_credit_card_id: 'cc-1',
  paid_credit_card_invoice_id: 'inv-2',
  is_transfer: false,
  type: 'expense',
  amount: '500.00'
}

function mapTx(t) {
  return {
    creditCardId: t.credit_card_id ?? null,
    paidCreditCardId: t.paid_credit_card_id ?? null,
    accountId: t.account_id ?? null
  }
}

describe('transactionSemantics', () => {
  it('classifies API-shaped examples after camelCase map', () => {
    const a = mapTx(API_EXAMPLE_ACCOUNT_EXPENSE)
    const c = mapTx(API_EXAMPLE_CARD_PURCHASE)
    const p = mapTx(API_EXAMPLE_BILL_PAYMENT)

    expect(isCreditCardInvoicePurchase(c)).toBe(true)
    expect(isCreditCardInvoicePurchase(a)).toBe(false)
    expect(isCreditCardInvoicePurchase(p)).toBe(false)

    expect(isCreditCardBillPayment(p)).toBe(true)
    expect(isCreditCardBillPayment(a)).toBe(false)
    expect(isCreditCardBillPayment(c)).toBe(false)

    expect(isAccountSideTransaction(a)).toBe(true)
    expect(isAccountSideTransaction(p)).toBe(true)
    expect(isAccountSideTransaction(c)).toBe(false)
  })

  it('recurrence and installment flags from mapTransaction shape', () => {
    const recurring = { recurrenceId: 'r1-uuid-0000-0000-000000000001' }
    const parcel = { installment: 3, totalInstallments: 12, recurrenceId: null }
    const single = { totalInstallments: 1, installment: 1 }

    expect(isRecurrenceLinkedTransaction(recurring)).toBe(true)
    expect(isRecurrenceLinkedTransaction(parcel)).toBe(false)
    expect(isInstallmentPlanTransaction(parcel)).toBe(true)
    expect(isInstallmentPlanTransaction(single)).toBe(false)
    expect(formatInstallmentFraction(parcel)).toBe('3/12')
    expect(formatInstallmentFraction(single)).toBe('')
  })

  it('matchesTransactionSourceFilter', () => {
    const a = mapTx(API_EXAMPLE_ACCOUNT_EXPENSE)
    const c = mapTx(API_EXAMPLE_CARD_PURCHASE)
    const p = mapTx(API_EXAMPLE_BILL_PAYMENT)

    expect(matchesTransactionSourceFilter(c, 'all')).toBe(true)
    expect(matchesTransactionSourceFilter(c, 'card')).toBe(true)
    expect(matchesTransactionSourceFilter(c, 'account')).toBe(false)
    expect(matchesTransactionSourceFilter(p, 'account')).toBe(true)
    expect(matchesTransactionSourceFilter(p, 'bill_payment')).toBe(true)
    expect(matchesTransactionSourceFilter(a, 'bill_payment')).toBe(false)
  })
})
