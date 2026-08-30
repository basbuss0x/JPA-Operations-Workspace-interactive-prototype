import type { School } from './types'

export function normalizeSchoolName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('id')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function isSchoolEligible(school: School): boolean {
  return school.status === 'ACTIVE'
}

export function validateSchoolName(name: string): string | null {
  const normalized = normalizeSchoolName(name)
  if (!normalized) return 'Nama sekolah wajib diisi.'
  if (normalized.length < 3) return 'Nama sekolah terlalu singkat.'
  return null
}

export function findDuplicateSchool(
  schools: Record<string, School>,
  name: string,
): School | null {
  const normalized = normalizeSchoolName(name)
  if (!normalized) return null
  return Object.values(schools).find((school) => normalizeSchoolName(school.name) === normalized) ?? null
}

export function proposeSchoolId(
  schools: Record<string, School>,
  name: string,
): string {
  const base = `SCH-${normalizeSchoolName(name).replaceAll(' ', '-').toUpperCase()}`
  let candidate = base
  let suffix = 2
  while (schools[candidate]) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

export function createSchoolCandidate(
  schools: Record<string, School>,
  name: string,
  city: string,
): School {
  const validationError = validateSchoolName(name)
  if (validationError) throw new Error(validationError)
  const duplicate = findDuplicateSchool(schools, name)
  if (duplicate) {
    throw new Error(`Sekolah kemungkinan duplikat: ${duplicate.name} (${duplicate.id}). Pilih sekolah yang sudah terdaftar atau periksa identitasnya.`)
  }
  return {
    id: proposeSchoolId(schools, name),
    name: name.trim(),
    city: city.trim() || 'Lokasi belum diisi',
    status: 'ACTIVE',
  }
}
