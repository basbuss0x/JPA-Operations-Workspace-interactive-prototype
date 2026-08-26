import { utils, write, writeFile, type WorkBook } from 'xlsx'
import type { VendorBatch, VendorRecap } from '../../domain/types'

export const VENDOR_WORKBOOK_SHEETS = {
  summary: 'Ringkasan Vendor',
  schoolBreakdown: 'Breakdown Sekolah',
} as const

export function vendorWorkbookFilename(batchId: string): string {
  return `Rekap-Vendor-${batchId}.xlsx`
}

export function createVendorWorkbook(batch: VendorBatch, recap: VendorRecap): WorkBook {
  const summaryRows: Array<Array<string | number>> = [
    ['Rekap Vendor'],
    ['Batch ID', batch.id],
    ['Tanggal dibuat', batch.createdAt],
    ['Jumlah sekolah', recap.schoolCount],
    ['Jumlah product lines', recap.distinctProductCount],
    ['Total quantity', recap.totalQuantity],
    [],
    ['Kode Produk', 'Nama Buku', 'Total Qty', 'Jumlah Sekolah'],
    ...recap.aggregatedItems.map((item) => [
      item.productCode,
      item.title,
      item.totalQuantity,
      item.schools.length,
    ]),
  ]
  const breakdownRows: Array<Array<string | number>> = [
    ['Sekolah', 'Order ID', 'Nomor SIPLah', 'Kode Produk', 'Nama Buku', 'Qty'],
    ...recap.schoolBreakdown.flatMap((school) =>
      school.items.map((item) => [
        school.schoolName,
        school.orderId,
        school.siplahOrderNumber,
        item.productCode,
        item.title,
        item.quantity,
      ]),
    ),
  ]

  const summarySheet = utils.aoa_to_sheet(summaryRows)
  summarySheet['!cols'] = [
    { wch: 20 },
    { wch: 44 },
    { wch: 14 },
    { wch: 18 },
  ]
  const breakdownSheet = utils.aoa_to_sheet(breakdownRows)
  breakdownSheet['!cols'] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 44 },
    { wch: 10 },
  ]

  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, summarySheet, VENDOR_WORKBOOK_SHEETS.summary)
  utils.book_append_sheet(workbook, breakdownSheet, VENDOR_WORKBOOK_SHEETS.schoolBreakdown)
  return workbook
}

export function serializeVendorWorkbook(batch: VendorBatch, recap: VendorRecap): ArrayBuffer {
  return write(createVendorWorkbook(batch, recap), {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
  }) as ArrayBuffer
}

export function downloadVendorWorkbook(batch: VendorBatch, recap: VendorRecap): void {
  writeFile(createVendorWorkbook(batch, recap), vendorWorkbookFilename(batch.id), {
    bookType: 'xlsx',
    compression: true,
  })
}
