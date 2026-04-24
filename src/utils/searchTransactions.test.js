import { describe, it, expect } from 'vitest'
import {
  normalizeSearchText,
  parseAmountQuery,
  matchTransaction,
} from './searchTransactions.js'

describe('normalizeSearchText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeSearchText('Café')).toBe('cafe')
    expect(normalizeSearchText('AÇÃO')).toBe('acao')
  })
})

describe('parseAmountQuery', () => {
  it('parses op', () => {
    const p = parseAmountQuery('>100')
    expect(p.type).toBe('op')
    expect(p.op).toBe('gt')
    expect(p.n).toBe(100)
  })
  it('parses R$ value', () => {
    const p = parseAmountQuery('R$ 12,50')
    expect(p.type).toBe('close')
    expect(p.n).toBe(12.5)
  })
})

describe('matchTransaction', () => {
  const cats = [{ id: 'c1', name: 'Alimentação' }]

  it('matches description (accent-insensitive)', () => {
    const t = {
      description: 'Padaria',
      amount: 10,
      date: new Date('2026-04-15T12:00:00'),
      categoryId: 'c1',
      tags: ['feira'],
    }
    expect(matchTransaction(t, 'padaria', { categories: cats })).toBe(true)
    expect(matchTransaction(t, 'aliment', { categories: cats })).toBe(true)
  })

  it('matches amount token with operator', () => {
    const t = { description: 'x', amount: 150, date: new Date('2026-04-15T12:00:00') }
    expect(matchTransaction(t, '>100', { categories: [], accounts: [] })).toBe(true)
    expect(matchTransaction(t, '>200', { categories: [], accounts: [] })).toBe(false)
  })

  it('does not treat plain number as amount filter', () => {
    const t = { description: 'lote 10 unidades', amount: 5, date: new Date('2026-04-15T12:00:00') }
    expect(matchTransaction(t, '10', { categories: [], accounts: [] })).toBe(true)
  })
})
