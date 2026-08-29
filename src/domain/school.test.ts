import { describe, expect, it } from 'vitest'
import { createSchoolCandidate, findDuplicateSchool, isSchoolEligible, normalizeSchoolName, proposeSchoolId } from './school'
import type { School } from './types'

const schools: Record<string, School> = {
  'SCH-ACTIVE': { id: 'SCH-ACTIVE', name: 'SDN 1 Ambon', city: 'Ambon', status: 'ACTIVE' },
  'SCH-INACTIVE': { id: 'SCH-INACTIVE', name: 'Demo Closed School', city: 'Ambon', status: 'INACTIVE' },
}

describe('school eligibility and identity', () => {
  it('normalizes names for duplicate detection without changing display values', () => {
    expect(normalizeSchoolName('  SDN   1 Ambon  ')).toBe('sdn 1 ambon')
    expect(findDuplicateSchool(schools, 'sdn 1 ambon')).toEqual(schools['SCH-ACTIVE'])
    expect(findDuplicateSchool(schools, 'Sekolah Baru')).toBeNull()
  })

  it('keeps inactive schools visible to lookup but ineligible for new orders', () => {
    const inactive = schools['SCH-INACTIVE']
    if (!inactive) throw new Error('Missing inactive fixture')
    expect(isSchoolEligible(inactive)).toBe(false)
    expect(isSchoolEligible(schools['SCH-ACTIVE']!)).toBe(true)
  })

  it('creates a stable active candidate and avoids identifier collisions', () => {
    const candidate = createSchoolCandidate(schools, 'SD E2E Baru', 'Ambon')
    expect(candidate).toEqual({
      id: 'SCH-SD-E2E-BARU',
      name: 'SD E2E Baru',
      city: 'Ambon',
      status: 'ACTIVE',
    })
    expect(proposeSchoolId({ ...schools, [candidate.id]: candidate }, 'SD E2E Baru')).toBe('SCH-SD-E2E-BARU-2')
    expect(() => createSchoolCandidate(schools, 'Demo Closed School', 'Ambon')).toThrow(/duplikat/)
  })
})
