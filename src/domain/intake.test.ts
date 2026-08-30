import { describe, expect, it } from 'vitest'
import { DEMO_ARKAS_FIXTURE, extractArkasFixture } from '../data/arkas-fixtures'
import { PRODUCT_MASTER } from '../data/product-master'
import {
  calculateArkasBudgetAmount,
  matchExtractedItems,
  rankProductAlternatives,
  searchProductMaster,
} from './intake'

describe('deterministic ARKAS extraction and HET matching', () => {
  it('extracts immutable source lines from the canonical demo fixture', () => {
    const extraction = extractArkasFixture(DEMO_ARKAS_FIXTURE.id)

    expect(extraction.lines).toHaveLength(8)
    expect(extraction.lines[0]).toEqual({
      id: 'line-mtk-5',
      arkasTitle: 'Buku Matematika Kelas V',
      quantity: 20,
      arkasUnitPrice: 78_000,
      productCodeCandidate: 'BK-MTK-5',
    })
    expect(calculateArkasBudgetAmount(extraction.lines)).toBe(8_072_000)
  })

  it('auto-accepts confident matches and surfaces three deterministic exception types', () => {
    const extraction = extractArkasFixture(DEMO_ARKAS_FIXTURE.id)
    const items = matchExtractedItems(extraction.lines, PRODUCT_MASTER)

    expect(items.filter((item) => item.matchStatus === 'MATCHED')).toHaveLength(5)
    expect(items.find((item) => item.id === 'line-mtk-5')?.matchStatus).toBe('PRICE_MISMATCH')
    expect(items.find((item) => item.id === 'line-pendidikan-agama')?.matchStatus).toBe('AMBIGUOUS_MATCH')
    expect(items.find((item) => item.id === 'line-muatan-lokal')?.matchStatus).toBe('NO_MATCH')
    expect(items.find((item) => item.id === 'line-pendidikan-agama')?.matchReason).toContain('2 kandidat')
  })

  it('ranks ambiguous alternatives from title evidence and keeps candidate codes unique', () => {
    const extraction = extractArkasFixture(DEMO_ARKAS_FIXTURE.id)
    const religion = matchExtractedItems(extraction.lines, PRODUCT_MASTER)
      .find((item) => item.id === 'line-pendidikan-agama')
    if (!religion) throw new Error('Missing ambiguous religion item')

    const ranked = rankProductAlternatives(religion, PRODUCT_MASTER)
    expect(ranked.slice(0, 2).map((product) => product.code)).toEqual([
      'BK-PAI-5',
      'BK-PAK-5',
    ])
    expect(new Set(ranked.map((product) => product.code)).size).toBe(ranked.length)

    const pai = PRODUCT_MASTER.find((product) => product.code === 'BK-PAI-5')
    const pak = PRODUCT_MASTER.find((product) => product.code === 'BK-PAK-5')
    if (!pai || !pak) throw new Error('Missing religion Product Master fixtures')
    expect(rankProductAlternatives(religion, [pai, pak, pak]).map((product) => product.code)).toEqual([
      'BK-PAI-5',
      'BK-PAK-5',
    ])
  })

  it('searches the local Product Master by title or product code', () => {
    expect(searchProductMaster('BK-MTK-5', PRODUCT_MASTER).map((product) => product.code)).toEqual([
      'BK-MTK-5',
    ])
    expect(searchProductMaster('agama', PRODUCT_MASTER).map((product) => product.code)).toEqual([
      'BK-PAI-5',
      'BK-PAK-5',
    ])
  })
})
