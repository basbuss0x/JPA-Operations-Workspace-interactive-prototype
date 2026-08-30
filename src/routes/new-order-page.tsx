import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DEMO_ARKAS_FIXTURE, extractArkasFixture } from '../data/arkas-fixtures'
import { PRODUCT_MASTER } from '../data/product-master'
import { calculateArkasBudgetAmount, matchExtractedItems } from '../domain/intake'
import {
  createSchoolCandidate,
  isSchoolEligible,
} from '../domain/school'
import type { ArkasExtractionResult, OrderItem, School } from '../domain/types'
import { hetItemStatusLabels } from '../domain/presentation'
import { usePrototypeStore } from '../store/use-prototype-store'
import { formatCurrency } from '../utils/format'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { FormField } from '../components/ui/form-field'
import { PageHeader } from '../components/ui/page-header'
import { StatusChip } from '../components/ui/status-chip'

type SchoolMode = 'EXISTING' | 'NEW'
type SourceMode = 'DEMO' | 'PDF' | 'PHOTO' | 'MANUAL'
type ExtractionState = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'

const sourceOptions: Array<{ id: SourceMode; label: string; detail: string }> = [
  { id: 'DEMO', label: 'Demo ARKAS', detail: 'Data PDF demo deterministik untuk evaluasi alur.' },
  { id: 'PDF', label: 'Unggah PDF', detail: 'Pilih file lokal; isi tetap disimulasikan.' },
  { id: 'PHOTO', label: 'Foto / gambar', detail: 'Untuk hasil foto/pindai saat kunjungan sekolah.' },
  { id: 'MANUAL', label: 'Input manual demo', detail: 'Gunakan baris data demo tanpa file.' },
]

function statusTone(item: OrderItem) {
  if (item.matchStatus === 'MATCHED') return 'success' as const
  if (item.matchStatus === 'PRICE_MISMATCH') return 'danger' as const
  return 'warning' as const
}

function SchoolIdentitySummary({ school }: { school: School }) {
  return (
    <div className="selected-school-summary" role="status">
      <div>
        <span>Sekolah terkonfirmasi</span>
        <strong>{school.name}</strong>
        <small>{school.id} · {school.city} · Sekolah aktif</small>
      </div>
      <StatusChip tone="success">Identitas valid</StatusChip>
    </div>
  )
}

export function NewOrderPage() {
  const schools = usePrototypeStore((state) => state.schools)
  const createExtractedOrder = usePrototypeStore((state) => state.createExtractedOrder)
  const navigate = useNavigate()
  const activeSchools = useMemo(
    () => Object.values(schools)
      .filter(isSchoolEligible)
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [schools],
  )
  const inactiveSchools = useMemo(
    () => Object.values(schools)
      .filter((school) => !isSchoolEligible(school))
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [schools],
  )
  const [schoolMode, setSchoolMode] = useState<SchoolMode>('EXISTING')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [newSchoolName, setNewSchoolName] = useState('')
  const [newSchoolCity, setNewSchoolCity] = useState('')
  const [confirmedSchool, setConfirmedSchool] = useState<School | null>(null)
  const [schoolError, setSchoolError] = useState('')
  const [schoolFieldError, setSchoolFieldError] = useState('')
  const [sourceMode, setSourceMode] = useState<SourceMode>('DEMO')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractionState, setExtractionState] = useState<ExtractionState>('IDLE')
  const [errorMessage, setErrorMessage] = useState('')
  const [fileError, setFileError] = useState('')
  const [creationError, setCreationError] = useState('')
  const [extraction, setExtraction] = useState<ArkasExtractionResult | null>(null)
  const [matchedItems, setMatchedItems] = useState<OrderItem[]>([])

  const exceptions = matchedItems.filter((item) => item.matchStatus !== 'MATCHED')
  const autoMatchedCount = matchedItems.length - exceptions.length

  const clearExtraction = () => {
    setExtractionState('IDLE')
    setErrorMessage('')
    setFileError('')
    setCreationError('')
    setExtraction(null)
    setMatchedItems([])
  }

  const switchSchoolMode = (mode: SchoolMode) => {
    setSchoolMode(mode)
    setSelectedSchoolId('')
    setNewSchoolName('')
    setNewSchoolCity('')
    setConfirmedSchool(null)
    setSchoolError('')
    setSchoolFieldError('')
    clearExtraction()
  }

  const changeExistingSchool = (schoolId: string) => {
    setSelectedSchoolId(schoolId)
    setConfirmedSchool(null)
    setSchoolError('')
    setSchoolFieldError('')
    clearExtraction()
  }

  const changeNewSchool = (name: string) => {
    setNewSchoolName(name)
    setConfirmedSchool(null)
    setSchoolError('')
    setSchoolFieldError('')
    clearExtraction()
  }

  const changeNewSchoolCity = (city: string) => {
    setNewSchoolCity(city)
    setConfirmedSchool(null)
    setSchoolError('')
    setSchoolFieldError('')
    clearExtraction()
  }

  const confirmSchool = () => {
    setSchoolError('')
    setSchoolFieldError('')
    if (schoolMode === 'EXISTING') {
      const school = schools[selectedSchoolId]
      if (!school) {
        setSchoolError('Pilih sekolah aktif terlebih dahulu.')
        return
      }
      if (!isSchoolEligible(school)) {
        setSchoolError('Sekolah tidak aktif dan tidak dapat menjadi target order baru.')
        setConfirmedSchool(null)
        return
      }
      setConfirmedSchool({ ...school })
      setSchoolError('')
      return
    }

    try {
      const school = createSchoolCandidate(schools, newSchoolName, newSchoolCity)
      setConfirmedSchool(school)
      setSchoolError('')
    } catch (error) {
      setConfirmedSchool(null)
      setSchoolFieldError(error instanceof Error ? error.message : 'Identitas sekolah belum valid.')
      document.getElementById('new-school-name')?.focus()
    }
  }

  const runExtraction = async () => {
    setErrorMessage('')
    setFileError('')
    if (!confirmedSchool) {
      setErrorMessage('Konfirmasi identitas sekolah terlebih dahulu sebelum menjalankan ekstraksi.')
      setExtractionState('ERROR')
      return
    }
    if ((sourceMode === 'PDF' || sourceMode === 'PHOTO') && !selectedFile) {
      const message = 'Pilih file sebelum menjalankan simulasi ekstraksi.'
      setFileError(message)
      setExtractionState('ERROR')
      document.getElementById('arkas-file')?.focus()
      return
    }

    setExtractionState('LOADING')
    setErrorMessage('')
    setCreationError('')
    setExtraction(null)
    setMatchedItems([])
    await new Promise((resolve) => window.setTimeout(resolve, 750))

    try {
      const result = extractArkasFixture(DEMO_ARKAS_FIXTURE.id)
      setExtraction(result)
      setMatchedItems(matchExtractedItems(result.lines, PRODUCT_MASTER))
      setExtractionState('SUCCESS')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Ekstraksi demo gagal.')
      setExtractionState('ERROR')
    }
  }

  const createOrder = () => {
    if (!extraction || matchedItems.length === 0 || !confirmedSchool) return
    const sourceType = sourceMode === 'PHOTO'
      ? 'PHOTO'
      : sourceMode === 'MANUAL' ? 'MANUAL' : 'PDF'
    try {
      const orderId = createExtractedOrder({
        school: confirmedSchool,
        sourceType,
        fileName: selectedFile?.name ?? DEMO_ARKAS_FIXTURE.fileName,
        extraction,
        matchedItems,
      })
      navigate(`/orders/${orderId}/arkas`)
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'Order baru gagal dibuat.')
    }
  }

  return (
    <div className="page-stack intake-page">
      <PageHeader
        eyebrow="Penerimaan ARKAS"
        title="Pesanan Baru"
        description="Satu kali tangkap ARKAS menghasilkan order terstruktur dan hanya menyisakan keputusan HET yang benar-benar perlu operator."
        actions={<Link className="button button--ghost button--sm" to="/orders">Batal</Link>}
      />

      <ol className="workflow-steps" aria-label="Tahapan penerimaan">
        <li className="is-active"><span>1</span>Sekolah</li>
        <li className={confirmedSchool ? 'is-active' : ''}><span>2</span>Sumber ARKAS</li>
        <li className={extractionState === 'SUCCESS' ? 'is-active' : ''}><span>3</span>Review hasil</li>
        <li><span>4</span>Review HET</li>
      </ol>

      <div className="intake-layout">
        <section className="workspace-panel intake-config">
          <div className="panel-heading">
            <div><h2>1. Pilih sekolah</h2><p>Tidak ada sekolah yang dipilih otomatis. Konfirmasi identitas sebelum ARKAS diproses.</p></div>
          </div>
          <div className="segmented-control" role="group" aria-label="Sumber sekolah">
            <button type="button" className={schoolMode === 'EXISTING' ? 'is-active' : ''} onClick={() => switchSchoolMode('EXISTING')}>Sekolah terdaftar</button>
            <button type="button" className={schoolMode === 'NEW' ? 'is-active' : ''} onClick={() => switchSchoolMode('NEW')}>Sekolah demo baru</button>
          </div>
          {schoolMode === 'EXISTING' ? (
            <>
              <FormField label="Sekolah aktif" htmlFor="intake-school" hint="Sekolah historis tetap terlihat sebagai konteks, tetapi tidak dapat dipilih.">
                <select id="intake-school" value={selectedSchoolId} onChange={(event) => changeExistingSchool(event.target.value)}>
                  <option value="">Pilih sekolah aktif…</option>
                  <optgroup label="Sekolah aktif">
                    {activeSchools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.city}</option>)}
                  </optgroup>
                  {inactiveSchools.length > 0 ? (
                    <optgroup label="Riwayat / tidak aktif — tidak dapat dipilih">
                      {inactiveSchools.map((school) => <option key={school.id} value={school.id} disabled>{school.name} · historis</option>)}
                    </optgroup>
                  ) : null}
                </select>
              </FormField>
              <Button variant="secondary" onClick={confirmSchool} disabled={!selectedSchoolId}>Konfirmasi sekolah</Button>
            </>
          ) : (
            <>
              <FormField label="Nama sekolah demo" htmlFor="new-school-name" hint="Nama dinormalisasi untuk mendeteksi kemungkinan duplikat." error={schoolFieldError || undefined}>
                <input
                  id="new-school-name"
                  value={newSchoolName}
                  onChange={(event) => changeNewSchool(event.target.value)}
                  aria-invalid={Boolean(schoolFieldError)}
                  aria-describedby={schoolFieldError ? 'new-school-name-error' : undefined}
                  placeholder="Contoh: SD Inpres Pass 2"
                />
              </FormField>
              <FormField label="Kota / kabupaten" htmlFor="new-school-city" hint="Opsional untuk data demo; identitas sekolah tetap memakai ID stabil.">
                <input id="new-school-city" value={newSchoolCity} onChange={(event) => changeNewSchoolCity(event.target.value)} placeholder="Contoh: Ambon" />
              </FormField>
              <Button variant="secondary" onClick={confirmSchool}>Konfirmasi sekolah baru</Button>
            </>
          )}
          {schoolError ? <div className="callout callout--danger" role="alert"><strong>Identitas sekolah belum dapat dikonfirmasi.</strong> {schoolError}</div> : null}
          {confirmedSchool ? <SchoolIdentitySummary school={confirmedSchool} /> : <div className="selected-school-empty">Belum ada konteks sekolah yang dikonfirmasi.</div>}

          <div className="panel-heading intake-source-heading">
            <div><h2>2. Tangkap sumber ARKAS</h2><p>Tidak ada OCR/API eksternal; simulasi selalu deterministik.</p></div>
          </div>
          <div className="source-options">
            {sourceOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                className={sourceMode === option.id ? 'source-option is-selected' : 'source-option'}
                onClick={() => {
                  setSourceMode(option.id)
                  setSelectedFile(null)
                  clearExtraction()
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>

          {sourceMode === 'PDF' || sourceMode === 'PHOTO' ? (
            <FormField label={sourceMode === 'PDF' ? 'File PDF' : 'File foto/gambar'} htmlFor="arkas-file" hint="File hanya dibaca namanya; tidak dikirim ke server." error={fileError || undefined}>
              <input
                id="arkas-file"
                type="file"
                accept={sourceMode === 'PDF' ? 'application/pdf' : 'image/*'}
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null)
                  setFileError('')
                  setErrorMessage('')
                }}
                aria-invalid={Boolean(fileError)}
                aria-describedby={fileError ? 'arkas-file-error' : undefined}
              />
            </FormField>
          ) : (
            <div className="selected-fixture">
              <span>Data demo terpilih</span>
              <strong>{DEMO_ARKAS_FIXTURE.sourceLabel}</strong>
              <small>{DEMO_ARKAS_FIXTURE.fileName} · 8 baris sumber</small>
            </div>
          )}

          <Button fullWidth onClick={() => void runExtraction()} disabled={!confirmedSchool || extractionState === 'LOADING'}>
            {extractionState === 'LOADING' ? 'Mengekstrak & mencocokkan HET…' : 'Simulasikan ekstraksi ARKAS'}
          </Button>
          {!confirmedSchool ? <p className="form-hint">Pilih lalu konfirmasi sekolah untuk mengaktifkan ekstraksi.</p> : null}
          {extractionState === 'ERROR' ? <div className="callout callout--danger" role="alert"><strong>Ekstraksi belum dapat dijalankan.</strong> {errorMessage}</div> : null}
        </section>

        <section className="workspace-panel extraction-review" aria-live="polite">
          <div className="panel-heading">
            <div><h2>3. Review hasil ekstraksi</h2><p>Nilai sumber ini akan disimpan tetap pada order.</p></div>
            {extractionState === 'SUCCESS' ? <StatusChip tone="success">Siap dibuat</StatusChip> : null}
          </div>

          {extractionState === 'IDLE' ? (
            <EmptyState title="Belum ada hasil" description="Konfirmasi sekolah dan pilih sumber ARKAS, lalu jalankan simulasi ekstraksi." />
          ) : null}
          {extractionState === 'LOADING' ? (
            <div className="extraction-loading"><span className="spinner" /><strong>Membaca 8 baris ARKAS</strong><p>Struktur item dan Product Master sedang dicocokkan…</p></div>
          ) : null}
          {extractionState === 'ERROR' ? (
            <EmptyState title="Tidak ada hasil ekstraksi" description="Perbaiki konteks sekolah atau input di sebelah kiri lalu coba kembali." />
          ) : null}
          {extractionState === 'SUCCESS' && extraction && confirmedSchool ? (
            <>
              <SchoolIdentitySummary school={confirmedSchool} />
              <div className="extraction-summary">
                <div><span>Item terdeteksi</span><strong>{matchedItems.length}</strong></div>
                <div><span>Cocok otomatis</span><strong>{autoMatchedCount}</strong></div>
                <div className="is-warning"><span>Perlu review</span><strong>{exceptions.length}</strong></div>
                <div><span>Anggaran ARKAS</span><strong>{formatCurrency(calculateArkasBudgetAmount(extraction.lines))}</strong></div>
              </div>
              <div className="extracted-items">
                {matchedItems.map((item) => (
                  <article key={item.id}>
                    <div><strong>{item.arkasTitle}</strong><span>{item.quantity} × {formatCurrency(item.arkasUnitPrice)}</span></div>
                    <StatusChip tone={statusTone(item)}>{hetItemStatusLabels[item.matchStatus]}</StatusChip>
                  </article>
                ))}
              </div>
              <div className="intake-confirm">
                <div>
                  <span>Sekolah yang akan dibuat</span>
                  <strong>{confirmedSchool.name}</strong>
                  <small>{confirmedSchool.id} · {confirmedSchool.city} · identitas aktif terkonfirmasi</small>
                  <span>{autoMatchedCount} item tidak perlu dicek ulang. {exceptions.length} pengecualian akan dibuka langsung pada review HET.</span>
                </div>
                <Button onClick={createOrder}>Buat order & review HET</Button>
              </div>
              {creationError ? <div className="callout callout--danger" role="alert"><strong>Order belum dibuat.</strong> {creationError}</div> : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
