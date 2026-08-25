import type { SiplahDocument, SiplahDocumentKind } from './types'

const definitions: Array<Pick<
  SiplahDocument,
  'kind' | 'label' | 'required' | 'sendToSchoolRequired'
>> = [
  {
    kind: 'SURAT_PESANAN',
    label: 'Surat Pesanan',
    required: true,
    sendToSchoolRequired: true,
  },
  {
    kind: 'INVOICE',
    label: 'Invoice SIPLah',
    required: true,
    sendToSchoolRequired: true,
  },
  {
    kind: 'KWITANSI',
    label: 'Kwitansi',
    required: true,
    sendToSchoolRequired: true,
  },
  {
    kind: 'BAST',
    label: 'BAST',
    required: true,
    sendToSchoolRequired: true,
  },
  {
    kind: 'SIPLAH_PDF',
    label: 'Arsip PDF SIPLah',
    required: false,
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
