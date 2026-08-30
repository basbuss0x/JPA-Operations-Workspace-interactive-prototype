import type {
  ArkasDocument,
  BenefitPaymentMethod,
  BenefitRecipientType,
  BenefitStatus,
  GoodsState,
  HetItemStatus,
  HetResolutionType,
  HetReviewStatus,
  LifecycleStage,
  NextAction,
  SchoolPaymentStatus,
  SupplierPaymentStatus,
  SiplahDocumentKind,
  SyncStatus,
  TimelineEvent,
  VendorBatchStatus,
} from './types'

export const arkasSourceTypeLabels: Record<ArkasDocument['sourceType'], string> = {
  PDF: 'PDF',
  PHOTO: 'Foto/gambar',
  SCAN: 'Scan',
  MANUAL: 'Input manual',
}

export const lifecycleLabels: Record<LifecycleStage, string> = {
  INTAKE: 'Penerimaan',
  HET_REVIEW: 'Review HET',
  SIPLAH: 'SIPLah',
  VENDOR: 'Vendor',
  GOODS_ARRIVED: 'Barang tiba',
  DISTRIBUTION: 'Distribusi',
  COMPLETION: 'Penyelesaian',
  CLOSED: 'Selesai',
}

export const vendorBatchStatusLabels: Record<VendorBatchStatus, string> = {
  DRAFT: 'Draf',
  RECAP_GENERATED: 'Rekap dibuat, belum dikirim',
  SENT_TO_VENDOR: 'Dikirim ke vendor',
  VENDOR_CONFIRMED: 'Vendor mengonfirmasi',
  PROCESSING: 'Sedang diproses vendor',
  PARTIALLY_ARRIVED: 'Tiba sebagian',
  ARRIVED: 'Semua barang tiba',
}

export const benefitStatusLabels: Record<BenefitStatus, string> = {
  NOT_ELIGIBLE: 'Belum wajib dibayar',
  ELIGIBLE: 'Benefit wajib dibayar',
  PAID: 'Benefit sudah dibayar',
}

export const schoolPaymentStatusLabels: Record<SchoolPaymentStatus, string> = {
  UNPAID: 'Belum dibayar',
  LUNAS: 'LUNAS',
}

export const supplierPaymentStatusLabels: Record<SupplierPaymentStatus, string> = {
  NOT_SET: 'Belum ditetapkan',
  UNPAID: 'Belum dibayar',
  PARTIAL: 'Dibayar sebagian',
  PAID: 'Sudah dibayar',
}

export const arrivalTypeLabels: Record<GoodsState['arrivalType'], string> = {
  NONE: 'Belum tiba',
  PARTIAL: 'Tiba sebagian',
  FULL: 'Tiba penuh',
}

export const timelineEventTypeLabels: Record<TimelineEvent['type'], string> = {
  SYSTEM: 'Otomatis',
  NOTE: 'Catatan operator',
}

export const actionSourceLabels: Record<NextAction['source'], string> = {
  SYSTEM: 'Otomatis',
  MANUAL: 'Manual',
}

export const syncStatusLabels: Record<SyncStatus, string> = {
  OK: 'Sinkronisasi berhasil',
  STALE: 'Data tracker tertinggal',
  ERROR: 'Sinkronisasi gagal',
}

export const trackerRefreshOutcomeLabels: Record<'SUCCESS' | 'STALE' | 'ERROR', string> = {
  SUCCESS: 'Sinkronisasi berhasil',
  STALE: 'Data tracker tertinggal',
  ERROR: 'Koneksi gagal',
}

export const hetReviewStatusLabels: Record<HetReviewStatus, string> = {
  NOT_STARTED: 'Belum dimulai',
  EXTRACTED: 'Hasil ekstraksi tersedia',
  NEEDS_REVIEW: 'Perlu review',
  APPROVED: 'Disetujui',
}

export const hetItemStatusLabels: Record<HetItemStatus, string> = {
  MATCHED: 'Cocok',
  PRICE_MISMATCH: 'Harga berbeda',
  AMBIGUOUS_MATCH: 'Kecocokan ambigu',
  NO_MATCH: 'Belum ada kecocokan',
  MANUAL_OVERRIDE: 'Penyesuaian manual',
}

export const hetResolutionTypeLabels: Record<HetResolutionType, string> = {
  AUTO_MATCHED: 'Cocok otomatis',
  ACCEPTED_SUGGESTION: 'Saran diterima',
  CHOSEN_PRODUCT: 'Produk dipilih',
  MANUAL_OVERRIDE: 'Penyesuaian manual',
}

export const benefitRecipientTypeLabels: Record<BenefitRecipientType, string> = {
  SCHOOL_OFFICIAL: 'Pejabat sekolah',
  INDIVIDUAL: 'Individu',
}

export const benefitPaymentMethodLabels: Record<BenefitPaymentMethod, string> = {
  TRANSFER: 'Transfer',
  CASH: 'Tunai',
}

export const schoolPaymentMethodLabels: Record<string, string> = {
  'Transfer bank': 'Transfer bank',
  'SIPLah settlement': 'Settlement SIPLah',
  TRANSFER: 'Transfer',
  CASH: 'Tunai',
  Cash: 'Tunai',
}

export const siplahDocumentStatusLabels = {
  available: 'Tersedia',
  unavailable: 'Belum tersedia',
  attached: 'Terlampir',
  unattached: 'Belum terlampir',
  verified: 'Terverifikasi',
  unverified: 'Belum diverifikasi',
  sent: 'Sudah dikirim',
  unsent: 'Belum dikirim',
  notSentRequired: 'Tidak perlu dikirim',
} as const

export const siplahDocumentKindLabels: Record<SiplahDocumentKind, string> = {
  SURAT_PESANAN: 'Surat Pesanan',
  INVOICE: 'Invoice',
  KWITANSI: 'Kwitansi',
  BAST: 'BAST',
  SIPLAH_PDF: 'Dokumen SIPLah',
}
