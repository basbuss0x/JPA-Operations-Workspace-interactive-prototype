import { createSiplahDocuments } from '../domain/siplah'
import type {
  BenefitStatus,
  GoodsState,
  HetItemStatus,
  HetReview,
  LifecycleStage,
  Order,
  OrderItem,
  PrototypeData,
  SchoolPaymentStatus,
  SiplahProcess,
  SupplierPaymentStatus,
  TimelineEvent,
} from '../domain/types'

export const DEMO_STATE_VERSION = 6

const DATE = {
  created: '2026-01-12T08:00:00.000Z',
  recent: '2026-02-18T09:30:00.000Z',
  today: '2026-02-20T08:00:00.000Z',
}

function item(
  id: string,
  title: string,
  quantity: number,
  price: number,
  status: HetItemStatus = 'MATCHED',
  masterTitle: string | null = title,
  hetPrice: number | null = price,
): OrderItem {
  return {
    id,
    productCode: `BK-${id.toUpperCase()}`,
    arkasTitle: title,
    masterProductTitle: masterTitle,
    quantity,
    arkasUnitPrice: price,
    hetUnitPrice: hetPrice,
    matchStatus: status,
    matchConfidence: status === 'MATCHED' ? 0.99 : 0.7,
    matchReason:
      status === 'MATCHED'
        ? 'Cocok otomatis dengan fixture Product Master.'
        : 'Fixture canonical memerlukan keputusan operator.',
    resolutionType: status === 'MATCHED' ? 'AUTO_MATCHED' : null,
  }
}

function matchedDemoItems(count: number): OrderItem[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    return item(`demo-${number}`, `Buku Pelajaran SD Seri ${number}`, 4 + (index % 5), 52_000 + index * 750)
  })
}

const incompleteSiplah: SiplahProcess = {
  accessAvailable: false,
  orderPlaced: false,
  orderNumber: null,
  documents: createSiplahDocuments(),
}

const completeSiplah: SiplahProcess = {
  accessAvailable: true,
  orderPlaced: true,
  orderNumber: 'SPL-DEMO-001',
  documents: createSiplahDocuments(true),
}

const vendorReadySiplah: SiplahProcess = {
  ...completeSiplah,
  documents: completeSiplah.documents.map((document) =>
    document.requiredForVendorReady
      ? { ...document }
      : {
          ...document,
          available: false,
          fileName: null,
          verified: false,
          sentToSchool: false,
        },
  ),
}

const noGoods: GoodsState = {
  arrivedAt: null,
  arrivalType: 'NONE',
  preDeliveryCheckCompleted: false,
  checkedAt: null,
  checkNote: null,
  acceptedBySchoolAt: null,
}

function trackerIdentity(orderId: string) {
  return {
    trackerOrderId: `KBT-${orderId.replace('ORD-', '')}`,
    trackerUrl: `https://kelengkapan.demo.local/orders/${orderId}`,
    lastSyncAttemptAt: null,
    syncMessage: null,
  }
}

function event(id: string, title: string, detail: string, occurredAt = DATE.recent): TimelineEvent {
  return { id, title, detail, occurredAt, type: 'SYSTEM' }
}

interface MakeOrderOptions {
  id: string
  schoolName: string
  stage: LifecycleStage
  invoice: number
  arkasBudgetAmount?: number
  hetReviewedAmount?: number | null
  finalInvoiceAmount?: number | null
  items: OrderItem[]
  het: HetReview
  siplah?: SiplahProcess
  vendorBatchId?: string | null
  goods?: GoodsState
  fulfillment?: Order['fulfillment']
  paymentStatus?: SchoolPaymentStatus
  schoolPaidAmount?: number
  deductionAmount?: number
  paymentDate?: string | null
  benefitStatus?: BenefitStatus
  benefitDate?: string | null
  supplierStatus?: SupplierPaymentStatus
  supplierObligationAmount?: number | null
  supplierPaid?: number
  timeline?: TimelineEvent[]
}

function makeOrder(options: MakeOrderOptions): Order {
  const orderedQty = options.items.reduce((total, current) => total + current.quantity, 0)
  const finalInvoiceAmount = options.finalInvoiceAmount !== undefined
    ? options.finalInvoiceAmount
    : null
  const hetReviewedAmount = options.hetReviewedAmount !== undefined
    ? options.hetReviewedAmount
    : options.het.status === 'APPROVED' ? options.invoice : null
  const schoolPaidAmount = options.schoolPaidAmount ?? (
    options.paymentStatus === 'LUNAS' ? (finalInvoiceAmount ?? 0) : 0
  )
  const benefitStatus = options.benefitStatus ?? (
    options.paymentStatus === 'LUNAS' ? 'ELIGIBLE' : 'NOT_ELIGIBLE'
  )
  const benefitFrozen = options.paymentStatus === 'LUNAS' || benefitStatus !== 'NOT_ELIGIBLE'
  return {
    id: options.id,
    schoolId: `SCH-${options.id.slice(-3)}`,
    schoolName: options.schoolName,
    stage: options.stage,
    createdAt: DATE.created,
    updatedAt: DATE.today,
    arkasBudgetAmount: options.arkasBudgetAmount ?? options.invoice,
    hetReviewedAmount,
    finalInvoiceAmount,
    arkas: {
      reference: `ARKAS-${options.id.slice(-3)}-2026`,
      sourceType: 'PDF',
      fileName: `${options.schoolName.replaceAll(' ', '-')}-ARKAS.pdf`,
      uploadedAt: DATE.created,
      extractedAt: DATE.created,
    },
    items: options.items,
    het: options.het,
    siplah: options.siplah ?? { ...incompleteSiplah },
    vendorBatchId: options.vendorBatchId ?? null,
    goods: options.goods ?? { ...noGoods },
    fulfillment: options.fulfillment ?? {
      ...trackerIdentity(options.id),
      orderedQty,
      deliveredQty: 0,
      remainingQty: orderedQty,
      problemCount: 0,
      progressPercent: 0,
      lastUpdated: null,
      syncStatus: 'OK',
    },
    schoolPayment: {
      status: options.paymentStatus ?? 'UNPAID',
      schoolPaidAmount,
      deductionAmount: options.deductionAmount ?? 0,
      netReceivedAmount: schoolPaidAmount - (options.deductionAmount ?? 0),
      paidAt: options.paymentDate ?? null,
      method: options.paymentStatus === 'LUNAS' ? 'Transfer bank' : null,
      evidenceName: options.paymentStatus === 'LUNAS' ? `Bukti-${options.id}.pdf` : null,
      followUpDueAt: null,
    },
    benefit: {
      status: benefitStatus,
      baseAmount: benefitFrozen ? finalInvoiceAmount : null,
      obligationAmount:
        benefitFrozen && finalInvoiceAmount !== null
          ? Math.round(finalInvoiceAmount * 0.1)
          : null,
      eligibleAt:
        benefitStatus === 'ELIGIBLE' || benefitStatus === 'PAID'
          ? (options.paymentDate ?? DATE.recent)
          : null,
      paidAt: options.benefitDate ?? null,
      method: benefitStatus === 'PAID' ? 'TRANSFER' : null,
      recipientType: benefitStatus === 'PAID' ? 'SCHOOL_OFFICIAL' : null,
      recipient: benefitStatus === 'PAID' ? 'Penerima resmi sekolah' : null,
      accountReference: benefitStatus === 'PAID' ? `REF-${options.id}` : null,
      proofName: benefitStatus === 'PAID' ? `Benefit-${options.id}.pdf` : null,
      schoolConfirmedAt: null,
    },
    supplierPayment: {
      status: options.supplierStatus ?? 'NOT_SET',
      obligationAmount: options.supplierObligationAmount ?? null,
      paidAmount: options.supplierPaid ?? 0,
    },
    nextActionControl: {
      override: null,
      controlsByActionKey: {},
    },
    timeline:
      options.timeline ??
      [
        event(`${options.id}-1`, 'ARKAS diterima', 'Dokumen ARKAS diunggah dan diekstrak.'),
        event(`${options.id}-2`, 'Order diperbarui', `Posisi operasional: ${options.stage}.`, DATE.today),
      ],
  }
}

const approvedHet: HetReview = {
  status: 'APPROVED',
  detectedItemCount: 3,
  autoMatchedItemCount: 3,
  approvedAt: '2026-01-14T04:00:00.000Z',
}

function canonicalOrders(): Order[] {
  const hetMismatchItems = [
    ...matchedDemoItems(26),
    item(
      'math-exception',
      'Buku Matematika Kelas V',
      20,
      78_000,
      'PRICE_MISMATCH',
      'Matematika untuk SD/MI Kelas V',
      82_000,
    ),
    item(
      'religion-exception',
      'Pendidikan Agama / PAI V',
      12,
      66_000,
      'AMBIGUOUS_MATCH',
      'Pendidikan Agama Islam dan Budi Pekerti Kelas V',
      69_000,
    ),
  ]

  const readyVendorItems = [
    item('mtk-5', 'Matematika Kelas V', 20, 82_000),
    item('bindo-5', 'Bahasa Indonesia Kelas V', 15, 76_000),
    item('ipas-5', 'IPAS Kelas V', 20, 79_000),
  ]

  return [
    makeOrder({
      id: 'ORD-2026-030',
      schoolName: 'SDN 30 Ambon',
      stage: 'HET_REVIEW',
      invoice: 18_940_000,
      items: hetMismatchItems,
      het: {
        status: 'NEEDS_REVIEW',
        detectedItemCount: 28,
        autoMatchedItemCount: 26,
        approvedAt: null,
      },
      hetReviewedAmount: null,
    }),
    makeOrder({
      id: 'ORD-2026-071',
      schoolName: 'SDN 71',
      stage: 'SIPLAH',
      invoice: 16_780_000,
      items: [
        item('mtk-4', 'Matematika Kelas IV', 18, 78_000),
        item('bindo-4', 'Bahasa Indonesia Kelas IV', 18, 72_000),
        item('ipas-4', 'IPAS Kelas IV', 18, 75_000),
      ],
      het: approvedHet,
      hetReviewedAmount: 16_780_000,
      finalInvoiceAmount: null,
      siplah: { ...incompleteSiplah, accessAvailable: true },
      timeline: [
        event('071-1', 'HET disetujui', 'Seluruh item cocok dengan master HET.'),
        event('071-2', 'Akses SIPLah tersedia', 'Operator dapat melanjutkan pembelian.', DATE.today),
      ],
    }),
    makeOrder({
      id: 'ORD-2026-040',
      schoolName: 'SDN 40 Ambon',
      stage: 'SIPLAH',
      invoice: 18_210_000,
      items: readyVendorItems,
      het: approvedHet,
      hetReviewedAmount: 18_210_000,
      finalInvoiceAmount: 18_210_000,
      siplah: { ...vendorReadySiplah, orderNumber: 'SPL-2026-1840' },
      timeline: [
        event('040-1', 'HET disetujui', 'Tidak ada selisih yang belum terselesaikan.'),
        event('040-2', 'Surat Pesanan dikirim', 'Surat Pesanan lengkap; order siap direkap vendor. Administrasi SIPLah lanjutan menyusul.', DATE.today),
      ],
    }),
    makeOrder({
      id: 'ORD-2026-SLB',
      schoolName: 'SLB Batu Merah',
      stage: 'SIPLAH',
      invoice: 9_460_000,
      items: [
        item('mtk-5', 'Matematika Kelas V', 8, 82_000),
        item('bindo-5', 'Bahasa Indonesia Kelas V', 6, 76_000),
      ],
      het: { ...approvedHet, detectedItemCount: 2, autoMatchedItemCount: 2 },
      hetReviewedAmount: 9_460_000,
      finalInvoiceAmount: 9_460_000,
      siplah: { ...vendorReadySiplah, orderNumber: 'SPL-2026-1851' },
    }),
    makeOrder({
      id: 'ORD-2026-049',
      schoolName: 'SD Inpres 49 Ambon',
      stage: 'VENDOR',
      invoice: 21_720_000,
      items: [
        item('mtk-6', 'Matematika Kelas VI', 24, 84_000),
        item('bindo-6', 'Bahasa Indonesia Kelas VI', 24, 78_000),
      ],
      het: { ...approvedHet, detectedItemCount: 2, autoMatchedItemCount: 2 },
      hetReviewedAmount: 21_720_000,
      finalInvoiceAmount: 21_720_000,
      siplah: { ...completeSiplah, orderNumber: 'SPL-2026-1772' },
      vendorBatchId: 'VB-2026-009',
      timeline: [
        event('049-1', 'Masuk vendor batch', 'Order tergabung dalam VB-2026-009.'),
        event('049-2', 'Vendor memproses', 'Vendor mengonfirmasi recap dan menyiapkan barang.', DATE.today),
      ],
    }),
    makeOrder({
      id: 'ORD-2026-239',
      schoolName: 'SDN 239 MT',
      stage: 'GOODS_ARRIVED',
      invoice: 19_850_000,
      items: [item('bundle-239', 'Paket Buku SD Kelas V', 186, 106_720)],
      het: { ...approvedHet, detectedItemCount: 1, autoMatchedItemCount: 1 },
      hetReviewedAmount: 19_850_000,
      finalInvoiceAmount: 19_850_000,
      siplah: { ...completeSiplah, orderNumber: 'SPL-2026-1698' },
      vendorBatchId: 'VB-2026-008',
      goods: {
        arrivedAt: '2026-02-19T06:30:00.000Z',
        arrivalType: 'FULL',
        preDeliveryCheckCompleted: false,
        checkedAt: null,
        checkNote: null,
        acceptedBySchoolAt: null,
      },
      timeline: [
        event('239-1', 'Barang tiba di JPA', 'Barang dari VB-2026-008 diterima; belum diperiksa.', DATE.today),
      ],
    }),
    makeOrder({
      id: 'ORD-2026-065',
      schoolName: 'SDN 65 Ambon',
      stage: 'DISTRIBUTION',
      invoice: 27_640_000,
      items: [item('bundle-065', 'Paket Buku SDN 65', 314, 88_025)],
      het: { ...approvedHet, detectedItemCount: 1, autoMatchedItemCount: 1 },
      hetReviewedAmount: 27_640_000,
      finalInvoiceAmount: 27_640_000,
      siplah: { ...completeSiplah, orderNumber: 'SPL-2026-1604' },
      vendorBatchId: 'VB-2026-007',
      goods: {
        arrivedAt: '2026-02-04T06:30:00.000Z',
        arrivalType: 'FULL',
        preDeliveryCheckCompleted: true,
        checkedAt: '2026-02-04T10:00:00.000Z',
        checkNote: 'Barang siap dilanjutkan ke distribusi bertahap.',
        acceptedBySchoolAt: null,
      },
      fulfillment: {
        ...trackerIdentity('ORD-2026-065'),
        orderedQty: 314,
        deliveredQty: 247,
        remainingQty: 67,
        problemCount: 4,
        progressPercent: 79,
        lastUpdated: DATE.today,
        syncStatus: 'OK',
      },
      paymentStatus: 'LUNAS',
      schoolPaidAmount: 27_640_000,
      paymentDate: '2026-02-10T03:00:00.000Z',
      benefitStatus: 'ELIGIBLE',
      supplierStatus: 'PARTIAL',
      supplierPaid: 12_000_000,
    }),
    makeOrder({
      id: 'ORD-2026-068',
      schoolName: 'SDN 68 Ambon',
      stage: 'COMPLETION',
      invoice: 24_350_000,
      items: [item('bundle-068', 'Paket Buku SDN 68', 275, 88_545)],
      het: { ...approvedHet, detectedItemCount: 1, autoMatchedItemCount: 1 },
      hetReviewedAmount: 24_350_000,
      finalInvoiceAmount: 24_350_000,
      siplah: { ...completeSiplah, orderNumber: 'SPL-2026-1522' },
      vendorBatchId: 'VB-2026-006',
      goods: {
        arrivedAt: '2026-01-28T06:00:00.000Z',
        arrivalType: 'FULL',
        preDeliveryCheckCompleted: true,
        checkedAt: '2026-01-28T08:30:00.000Z',
        checkNote: 'Barang lengkap dan sudah dicek sebelum pengantaran.',
        acceptedBySchoolAt: '2026-02-03T03:00:00.000Z',
      },
      fulfillment: {
        ...trackerIdentity('ORD-2026-068'),
        orderedQty: 275,
        deliveredQty: 275,
        remainingQty: 0,
        problemCount: 0,
        progressPercent: 100,
        lastUpdated: '2026-02-03T03:00:00.000Z',
        syncStatus: 'OK',
      },
      paymentStatus: 'UNPAID',
      benefitStatus: 'NOT_ELIGIBLE',
      supplierStatus: 'PARTIAL',
      supplierPaid: 5_000_000,
      timeline: [
        event('068-1', 'Barang diterima sekolah', 'Kelengkapan 100% dan diterima sekolah.'),
        event('068-2', 'Menunggu pembayaran sekolah', 'Fulfillment selesai; pembayaran tetap checkpoint independen.', DATE.today),
      ],
    }),
    makeOrder({
      id: 'ORD-2025-999',
      schoolName: 'Demo Closed School',
      stage: 'CLOSED',
      invoice: 20_000_000,
      items: [item('bundle-closed', 'Paket Buku Referensi', 200, 100_000)],
      het: { ...approvedHet, detectedItemCount: 1, autoMatchedItemCount: 1 },
      hetReviewedAmount: 20_000_000,
      finalInvoiceAmount: 20_000_000,
      siplah: { ...completeSiplah, orderNumber: 'SPL-2025-9999' },
      vendorBatchId: 'VB-2025-041',
      goods: {
        arrivedAt: '2025-12-01T04:00:00.000Z',
        arrivalType: 'FULL',
        preDeliveryCheckCompleted: true,
        checkedAt: '2025-12-01T07:00:00.000Z',
        checkNote: 'Barang lengkap.',
        acceptedBySchoolAt: '2025-12-06T02:00:00.000Z',
      },
      fulfillment: {
        ...trackerIdentity('ORD-2025-999'),
        orderedQty: 200,
        deliveredQty: 200,
        remainingQty: 0,
        problemCount: 0,
        progressPercent: 100,
        lastUpdated: '2025-12-06T02:00:00.000Z',
        syncStatus: 'OK',
      },
      paymentStatus: 'LUNAS',
      paymentDate: '2025-12-10T03:00:00.000Z',
      benefitStatus: 'PAID',
      benefitDate: '2025-12-12T03:00:00.000Z',
      supplierStatus: 'PARTIAL',
      supplierPaid: 8_000_000,
      timeline: [event('closed-1', 'Order ditutup', 'Semua checkpoint JPA selesai; supplier masih dibayar bertahap.')],
    }),
  ]
}

export function createCanonicalDemoData(): PrototypeData {
  const orderEntries = canonicalOrders().map((order) => [order.id, order] as const)
  return {
    version: DEMO_STATE_VERSION,
    orders: Object.fromEntries(orderEntries),
    vendorBatches: {
      'VB-2026-009': {
        id: 'VB-2026-009',
        status: 'PROCESSING',
        createdAt: '2026-02-15T02:00:00.000Z',
        recapGeneratedAt: '2026-02-15T04:00:00.000Z',
        recapGenerationCount: 1,
        sentAt: '2026-02-15T08:00:00.000Z',
        confirmedAt: '2026-02-15T10:00:00.000Z',
        processingStartedAt: '2026-02-16T02:00:00.000Z',
        arrivedAt: null,
        followUpDueAt: null,
        orderIds: ['ORD-2026-049'],
        timeline: [],
      },
      'VB-2026-008': {
        id: 'VB-2026-008',
        status: 'ARRIVED',
        createdAt: '2026-02-12T02:00:00.000Z',
        recapGeneratedAt: '2026-02-12T04:00:00.000Z',
        recapGenerationCount: 1,
        sentAt: '2026-02-12T08:00:00.000Z',
        confirmedAt: '2026-02-12T10:00:00.000Z',
        processingStartedAt: '2026-02-13T02:00:00.000Z',
        arrivedAt: '2026-02-19T06:30:00.000Z',
        followUpDueAt: null,
        orderIds: ['ORD-2026-239'],
        timeline: [],
      },
      'VB-2026-007': {
        id: 'VB-2026-007',
        status: 'ARRIVED',
        createdAt: '2026-01-28T02:00:00.000Z',
        recapGeneratedAt: '2026-01-28T04:00:00.000Z',
        recapGenerationCount: 1,
        sentAt: '2026-01-28T08:00:00.000Z',
        confirmedAt: '2026-01-28T10:00:00.000Z',
        processingStartedAt: '2026-01-29T02:00:00.000Z',
        arrivedAt: '2026-02-04T06:30:00.000Z',
        followUpDueAt: null,
        orderIds: ['ORD-2026-065'],
        timeline: [],
      },
      'VB-2026-006': {
        id: 'VB-2026-006',
        status: 'ARRIVED',
        createdAt: '2026-01-20T02:00:00.000Z',
        recapGeneratedAt: '2026-01-20T04:00:00.000Z',
        recapGenerationCount: 1,
        sentAt: '2026-01-20T08:00:00.000Z',
        confirmedAt: '2026-01-20T10:00:00.000Z',
        processingStartedAt: '2026-01-21T02:00:00.000Z',
        arrivedAt: '2026-01-28T06:00:00.000Z',
        followUpDueAt: null,
        orderIds: ['ORD-2026-068'],
        timeline: [],
      },
      'VB-2025-041': {
        id: 'VB-2025-041',
        status: 'ARRIVED',
        createdAt: '2025-11-22T02:00:00.000Z',
        recapGeneratedAt: '2025-11-22T04:00:00.000Z',
        recapGenerationCount: 1,
        sentAt: '2025-11-22T08:00:00.000Z',
        confirmedAt: '2025-11-22T10:00:00.000Z',
        processingStartedAt: '2025-11-23T02:00:00.000Z',
        arrivedAt: '2025-12-01T04:00:00.000Z',
        followUpDueAt: null,
        orderIds: ['ORD-2025-999'],
        timeline: [],
      },
    },
  }
}
