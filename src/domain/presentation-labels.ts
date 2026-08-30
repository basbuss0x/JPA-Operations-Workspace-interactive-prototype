import type {
  BenefitRecipientType,
  BenefitStatus,
  GoodsState,
  HetItemStatus,
  HetResolutionType,
  HetReviewStatus,
  LifecycleStage,
  SchoolPaymentStatus,
  SupplierPaymentStatus,
  SiplahDocumentKind,
  TimelineEvent,
  VendorBatchStatus,
} from './types'

export const lifecycleLabels: Record<LifecycleStage, string> = {
  INTAKE: 'Intake',
  HET_REVIEW: 'Review HET',
  SIPLAH: 'SIPLah',
  VENDOR: 'Vendor',
  GOODS_ARRIVED: 'Barang tiba',
  DISTRIBUTION: 'Distribusi',
  COMPLETION: 'Penyelesaian',
  CLOSED: 'Selesai',
}

export const vendorBatchStatusLabels: Record<VendorBatchStatus, string> = {
  DRAFT: 'Draft',
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

export const hetReviewStatusLabels: Record<HetReviewStatus, string> = {
  NOT_STARTED: 'Belum dimulai',
  EXTRACTED: 'Hasil ekstraksi tersedia',
  NEEDS_REVIEW: 'Perlu review',
  APPROVED: 'Disetujui',
}

export const hetItemStatusLabels: Record<HetItemStatus, string> = {
  MATCHED: 'Cocok',
  PRICE_MISMATCH: 'Harga berbeda',
  AMBIGUOUS_MATCH: 'Match ambigu',
  NO_MATCH: 'Tidak ada match',
  MANUAL_OVERRIDE: 'Override manual',
}

export const hetResolutionTypeLabels: Record<HetResolutionType, string> = {
  AUTO_MATCHED: 'Cocok otomatis',
  ACCEPTED_SUGGESTION: 'Saran diterima',
  CHOSEN_PRODUCT: 'Produk dipilih',
  MANUAL_OVERRIDE: 'Override manual',
}

export const benefitRecipientTypeLabels: Record<BenefitRecipientType, string> = {
  SCHOOL_OFFICIAL: 'Pejabat sekolah',
  INDIVIDUAL: 'Individu',
}

export const siplahDocumentKindLabels: Record<SiplahDocumentKind, string> = {
  SURAT_PESANAN: 'Surat Pesanan',
  INVOICE: 'Invoice',
  KWITANSI: 'Kwitansi',
  BAST: 'BAST',
  SIPLAH_PDF: 'Dokumen SIPLah',
}
