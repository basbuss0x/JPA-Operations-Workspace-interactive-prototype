import { read, utils } from 'xlsx'
import { describe, expect, it } from 'vitest'
import { createCanonicalDemoData } from '../../data/demo-data'
import { buildVendorRecap } from '../../domain/selectors'
import { createVendorBatch } from '../../domain/transitions'
import { serializeVendorWorkbook, VENDOR_WORKBOOK_SHEETS } from './vendor-workbook'

interface SummaryRow {
  'Kode Produk': string
  'Nama Buku': string
  'Total Jumlah': number
  'Jumlah Sekolah': number
}

interface BreakdownRow {
  Sekolah: string
  'ID Order': string
  'Nomor SIPLah': string
  'Kode Produk': string
  'Nama Buku': string
  Jumlah: number
}

describe('Vendor recap XLSX', () => {
  it('writes a real two-sheet workbook with canonical aggregate and allocation rows', () => {
    const created = createVendorBatch(
      createCanonicalDemoData(),
      ['ORD-2026-040', 'ORD-2026-SLB'],
      'VB-2026-010',
      new Date('2026-02-21T08:00:00.000Z'),
    )
    const batch = created.vendorBatches['VB-2026-010']
    const sdn40 = created.orders['ORD-2026-040']
    const slb = created.orders['ORD-2026-SLB']
    if (!batch || !sdn40 || !slb) throw new Error('Missing canonical workbook source')
    const recap = buildVendorRecap([sdn40, slb])
    const file = serializeVendorWorkbook(batch, recap)
    const bytes = new Uint8Array(file)

    // XLSX is a ZIP container (PK), not CSV renamed with an .xlsx extension.
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b])

    const workbook = read(file, { type: 'array' })
    expect(workbook.SheetNames).toEqual([
      VENDOR_WORKBOOK_SHEETS.summary,
      VENDOR_WORKBOOK_SHEETS.schoolBreakdown,
    ])

    const summarySheet = workbook.Sheets[VENDOR_WORKBOOK_SHEETS.summary]
    const breakdownSheet = workbook.Sheets[VENDOR_WORKBOOK_SHEETS.schoolBreakdown]
    if (!summarySheet || !breakdownSheet) throw new Error('Missing expected workbook sheet')
    const summary = utils.sheet_to_json<SummaryRow>(summarySheet, { range: 7 })
    const breakdown = utils.sheet_to_json<BreakdownRow>(breakdownSheet)

    expect(summary.find((row) => row['Kode Produk'] === 'BK-MTK-5')?.['Total Jumlah']).toBe(28)
    expect(summary.find((row) => row['Kode Produk'] === 'BK-BINDO-5')?.['Total Jumlah']).toBe(21)
    expect(summary.find((row) => row['Kode Produk'] === 'BK-IPAS-5')?.['Total Jumlah']).toBe(20)
    expect(breakdown.filter((row) => row['Kode Produk'] === 'BK-MTK-5')).toEqual([
      {
        Sekolah: 'SDN 40 Ambon',
        'ID Order': 'ORD-2026-040',
        'Nomor SIPLah': 'SPL-2026-1840',
        'Kode Produk': 'BK-MTK-5',
        'Nama Buku': 'Matematika untuk SD/MI Kelas V',
        Jumlah: 20,
      },
      {
        Sekolah: 'SLB Batu Merah',
        'ID Order': 'ORD-2026-SLB',
        'Nomor SIPLah': 'SPL-2026-1851',
        'Kode Produk': 'BK-MTK-5',
        'Nama Buku': 'Matematika untuk SD/MI Kelas V',
        Jumlah: 8,
      },
    ])
    expect(breakdown.filter((row) => row['Kode Produk'] === 'BK-BINDO-5').map((row) => row.Jumlah)).toEqual([15, 6])
    expect(breakdown.filter((row) => row['Kode Produk'] === 'BK-IPAS-5')).toEqual([
      {
        Sekolah: 'SDN 40 Ambon',
        'ID Order': 'ORD-2026-040',
        'Nomor SIPLah': 'SPL-2026-1840',
        'Kode Produk': 'BK-IPAS-5',
        'Nama Buku': 'IPAS Kelas V',
        Jumlah: 20,
      },
    ])
  })
})
