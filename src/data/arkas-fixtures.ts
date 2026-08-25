import type { ArkasExtractionResult } from '../domain/types'

export interface ArkasFixture extends ArkasExtractionResult {
  id: string
  fileName: string
}

export const DEMO_ARKAS_FIXTURE: ArkasFixture = {
  fixtureId: 'arkas-demo-semester-1',
  id: 'arkas-demo-semester-1',
  activityReference: 'ARKAS-DEMO-2026-S1',
  sourceLabel: 'Demo ARKAS Semester 1',
  fileName: 'ARKAS-Demo-Semester-1.pdf',
  lines: [
    {
      id: 'line-mtk-5',
      arkasTitle: 'Buku Matematika Kelas V',
      quantity: 20,
      arkasUnitPrice: 78_000,
      productCodeCandidate: 'BK-MTK-5',
    },
    {
      id: 'line-pendidikan-agama',
      arkasTitle: 'Pendidikan Agama Kelas V',
      quantity: 12,
      arkasUnitPrice: 66_000,
      productCodeCandidate: null,
    },
    {
      id: 'line-muatan-lokal',
      arkasTitle: 'Muatan Lokal Khas Ambon',
      quantity: 10,
      arkasUnitPrice: 55_000,
      productCodeCandidate: null,
    },
    {
      id: 'line-bindo-5',
      arkasTitle: 'Bahasa Indonesia Kelas V',
      quantity: 15,
      arkasUnitPrice: 76_000,
      productCodeCandidate: 'BK-BINDO-5',
    },
    {
      id: 'line-ipas-5',
      arkasTitle: 'IPAS Kelas V',
      quantity: 20,
      arkasUnitPrice: 79_000,
      productCodeCandidate: 'BK-IPAS-5',
    },
    {
      id: 'line-ppkn-5',
      arkasTitle: 'Pendidikan Pancasila Kelas V',
      quantity: 15,
      arkasUnitPrice: 70_000,
      productCodeCandidate: 'BK-PPKN-5',
    },
    {
      id: 'line-seni-5',
      arkasTitle: 'Seni Budaya Kelas V',
      quantity: 10,
      arkasUnitPrice: 68_000,
      productCodeCandidate: 'BK-SENI-5',
    },
    {
      id: 'line-english-5',
      arkasTitle: 'Bahasa Inggris Kelas V',
      quantity: 10,
      arkasUnitPrice: 72_000,
      productCodeCandidate: 'BK-ENG-5',
    },
  ],
}

const fixtures = new Map([[DEMO_ARKAS_FIXTURE.id, DEMO_ARKAS_FIXTURE]])

export function extractArkasFixture(fixtureId: string): ArkasExtractionResult {
  const fixture = fixtures.get(fixtureId)
  if (!fixture) throw new Error('Fixture ARKAS tidak ditemukan atau gagal diekstrak.')
  return {
    fixtureId: fixture.fixtureId,
    activityReference: fixture.activityReference,
    sourceLabel: fixture.sourceLabel,
    lines: fixture.lines.map((line) => ({ ...line })),
  }
}
