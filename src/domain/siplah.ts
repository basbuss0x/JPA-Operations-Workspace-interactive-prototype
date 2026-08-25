import type { SiplahDocument, SiplahDocumentKind } from './types'

const definitions: Array<Pick<
  SiplahDocument,
  'kind' | 'label' | 'requiredForVendorReady' | 'requiredForAdminCompletion' | 'sendToSchoolRequired'
>> = [
  {
    kind: 'SURAT_PESANAN',
    label: 'Surat Pesanan',
    requiredForVendorReady: true,
    requiredForAdminCompletion: true,
    sendToSchoolRequired: true,
  },
  {
    kind: 'INVOICE',
    label: 'Invoice SIPLah',
    requiredForVendorReady: false,
    requiredForAdminCompletion: true,
    sendToSchoolRequired: false,
  },
  {
    kind: 'KWITANSI',
    label: 'Kwitansi',
    requiredForVendorReady: false,
    requiredForAdminCompletion: true,
    sendToSchoolRequired: false,
  },
  {
    kind: 'BAST',
    label: 'BAST',
    requiredForVendorReady: false,
    requiredForAdminCompletion: true,
    sendToSchoolRequired: false,
  },
  {
    kind: 'SIPLAH_PDF',
    label: 'Arsip PDF SIPLah',
    requiredForVendorReady: false,
    requiredForAdminCompletion: false,
    sendToSchoolRequired: false,
  },
]

export function createSiplahDocuments(completed = false): SiplahDocument[] {
  return definitions.map((definition) => ({
    ...definition,
    available: completed,
    fileName: completed ? `${definition.kind}-demo.pdf` : null,
    verified: completed,
    sentToSchool: completed && definition.sendToSchoolRequired,
  }))
}

export function getSiplahDocument(
  documents: SiplahDocument[],
  kind: SiplahDocumentKind,
): SiplahDocument {
  const document = documents.find((candidate) => candidate.kind === kind)
  if (!document) throw new Error(`Dokumen ${kind} tidak dikonfigurasi untuk order ini.`)
  return document
}
