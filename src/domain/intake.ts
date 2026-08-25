import type {
  ExtractedArkasLine,
  OrderItem,
  ProductMasterItem,
} from './types'

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('id')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function matchesTitle(line: ExtractedArkasLine, product: ProductMasterItem): boolean {
  const source = normalize(line.arkasTitle)
  return [product.title, ...product.aliases].some((value) => normalize(value) === source)
}

function toMatchedItem(
  line: ExtractedArkasLine,
  product: ProductMasterItem | null,
  status: OrderItem['matchStatus'],
  confidence: number | null,
  reason: string,
): OrderItem {
  return {
    id: line.id,
    productCode: product?.code ?? null,
    arkasTitle: line.arkasTitle,
    masterProductTitle: product?.title ?? null,
    quantity: line.quantity,
    arkasUnitPrice: line.arkasUnitPrice,
    hetUnitPrice: product?.hetUnitPrice ?? null,
    matchStatus: status,
    matchConfidence: confidence,
    matchReason: reason,
    resolutionType: status === 'MATCHED' ? 'AUTO_MATCHED' : null,
  }
}

export function calculateArkasBudgetAmount(lines: ExtractedArkasLine[]): number {
  return lines.reduce(
    (total, line) => total + line.quantity * line.arkasUnitPrice,
    0,
  )
}

export function matchExtractedItems(
  lines: ExtractedArkasLine[],
  products: ProductMasterItem[],
): OrderItem[] {
  return lines.map((line) => {
    const codeMatch = line.productCodeCandidate
      ? products.find((product) => product.code === line.productCodeCandidate) ?? null
      : null
    if (codeMatch) {
      if (codeMatch.hetUnitPrice !== line.arkasUnitPrice) {
        return toMatchedItem(
          line,
          codeMatch,
          'PRICE_MISMATCH',
          0.99,
          'Kode produk cocok, tetapi harga ARKAS berbeda dari HET master.',
        )
      }
      return toMatchedItem(
        line,
        codeMatch,
        'MATCHED',
        0.99,
        'Kode produk dan harga cocok dengan HET master.',
      )
    }

    const titleMatches = products.filter((product) => matchesTitle(line, product))
    if (titleMatches.length === 1) {
      const product = titleMatches[0]
      if (!product) throw new Error('Product match tidak ditemukan.')
      const status = product.hetUnitPrice === line.arkasUnitPrice ? 'MATCHED' : 'PRICE_MISMATCH'
      return toMatchedItem(
        line,
        product,
        status,
        0.92,
        status === 'MATCHED'
          ? 'Judul dan harga cocok dengan satu produk master.'
          : 'Judul cocok, tetapi harga ARKAS berbeda dari HET master.',
      )
    }

    if (titleMatches.length > 1) {
      const suggested = titleMatches[0] ?? null
      return toMatchedItem(
        line,
        suggested,
        'AMBIGUOUS_MATCH',
        0.68,
        `${titleMatches.length} kandidat Product Master memiliki judul/alias yang sama.`,
      )
    }

    return toMatchedItem(
      line,
      null,
      'NO_MATCH',
      null,
      'Tidak ditemukan kandidat Product Master yang cukup yakin.',
    )
  })
}

export function searchProductMaster(
  query: string,
  products: ProductMasterItem[],
): ProductMasterItem[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return products.slice(0, 8)
  return products.filter((product) =>
    [product.code, product.title, ...product.aliases].some((value) =>
      normalize(value).includes(normalizedQuery),
    ),
  )
}
