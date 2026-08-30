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

const productRankingStopWords = new Set(['buku', 'dan', 'kelas', 'mi', 'sd', 'untuk'])
const productRankingGenericTokens = new Set(['pendidikan'])
const gradeTokenPattern = /^(?:0?[1-6]|i|ii|iii|iv|v|vi)$/

function meaningfulTokens(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => (
      token.length > 0 &&
      !productRankingStopWords.has(token) &&
      !productRankingGenericTokens.has(token) &&
      !gradeTokenPattern.test(token)
    ))
}

function sharedTokenCount(sourceTokens: Set<string>, candidate: string): number {
  return meaningfulTokens(candidate).filter((token) => sourceTokens.has(token)).length
}

function productTexts(product: ProductMasterItem): string[] {
  return [product.title, ...product.aliases]
}

export function isRelevantProductAlternative(
  item: Pick<OrderItem, 'arkasTitle'>,
  product: ProductMasterItem,
): boolean {
  const sourceTitle = normalize(item.arkasTitle)
  if (!sourceTitle) return false
  const texts = productTexts(product)
  if (texts.some((value) => normalize(value) === sourceTitle)) return true
  const sourceTokens = new Set(meaningfulTokens(item.arkasTitle))
  return sourceTokens.size > 0 && texts.some((value) => sharedTokenCount(sourceTokens, value) > 0)
}

export function rankProductAlternatives(
  item: Pick<OrderItem, 'arkasTitle' | 'arkasUnitPrice'>,
  products: ProductMasterItem[],
): ProductMasterItem[] {
  const sourceTitle = normalize(item.arkasTitle)
  const sourceTokens = new Set(meaningfulTokens(item.arkasTitle))
  const seenCodes = new Set<string>()
  const uniqueProducts = products.filter((product) => {
    if (seenCodes.has(product.code)) return false
    seenCodes.add(product.code)
    return true
  })

  return uniqueProducts
    .filter((product) => isRelevantProductAlternative(item, product))
    .map((product, index) => {
      const texts = productTexts(product)
      const exactTitleMatch = texts.some((value) => normalize(value) === sourceTitle)
      const overlap = Math.max(...texts.map((value) => sharedTokenCount(sourceTokens, value)))
      return {
        product,
        index,
        exactTitleMatch,
        overlap,
        priceDistance: Math.abs(product.hetUnitPrice - item.arkasUnitPrice),
      }
    })
    .sort((left, right) => {
      if (left.exactTitleMatch !== right.exactTitleMatch) return left.exactTitleMatch ? -1 : 1
      if (left.overlap !== right.overlap) return right.overlap - left.overlap
      if (left.priceDistance !== right.priceDistance) return left.priceDistance - right.priceDistance
      return left.index - right.index
    })
    .map(({ product }) => product)
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
          'Kode produk cocok, tetapi harga ARKAS berbeda dari HET Product Master.',
        )
      }
      return toMatchedItem(
        line,
        codeMatch,
        'MATCHED',
        0.99,
        'Kode produk dan harga cocok dengan HET Product Master.',
      )
    }

    const titleMatches = products.filter((product) => matchesTitle(line, product))
    if (titleMatches.length === 1) {
      const product = titleMatches[0]
      if (!product) throw new Error('Pencocokan produk tidak ditemukan.')
      const status = product.hetUnitPrice === line.arkasUnitPrice ? 'MATCHED' : 'PRICE_MISMATCH'
      return toMatchedItem(
        line,
        product,
        status,
        0.92,
        status === 'MATCHED'
          ? 'Judul dan harga cocok dengan satu produk acuan.'
          : 'Judul cocok, tetapi harga ARKAS berbeda dari HET Product Master.',
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
