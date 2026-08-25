import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DEMO_ARKAS_FIXTURE, extractArkasFixture } from '../data/arkas-fixtures'
import { PRODUCT_MASTER } from '../data/product-master'
import { calculateArkasBudgetAmount, matchExtractedItems } from '../domain/intake'
import type { ArkasExtractionResult, OrderItem } from '../domain/types'
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
  { id: 'DEMO', label: 'Demo ARKAS', detail: 'Fixture PDF deterministik untuk evaluasi end-to-end.' },
  { id: 'PDF', label: 'Upload PDF', detail: 'Pilih file lokal; isi tetap disimulasikan.' },
  { id: 'PHOTO', label: 'Foto / gambar', detail: 'Untuk hasil foto/scan saat kunjungan sekolah.' },
  { id: 'MANUAL', label: 'Input manual demo', detail: 'Gunakan baris fixture tanpa file.' },
]

function statusTone(item: OrderItem) {
  if (item.matchStatus === 'MATCHED') return 'success' as const
  if (item.matchStatus === 'PRICE_MISMATCH') return 'danger' as const
  return 'warning' as const
}

export function NewOrderPage() {
  const orders = usePrototypeStore((state) => state.orders)
  const createExtractedOrder = usePrototypeStore((state) => state.createExtractedOrder)
  const navigate = useNavigate()
  const existingSchools = useMemo(
    () => [...new Set(Object.values(orders).map((order) => order.schoolName))].sort((a, b) => a.localeCompare(b, 'id')),
    [orders],
  )
  const [schoolMode, setSchoolMode] = useState<SchoolMode>('EXISTING')
  const [schoolName, setSchoolName] = useState(existingSchools[0] ?? '')
  const [newSchoolName, setNewSchoolName] = useState('SD Demo Pass 2')
  const [sourceMode, setSourceMode] = useState<SourceMode>('DEMO')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractionState, setExtractionState] = useState<ExtractionState>('IDLE')
  const [errorMessage, setErrorMessage] = useState('')
  const [extraction, setExtraction] = useState<ArkasExtractionResult | null>(null)
  const [matchedItems, setMatchedItems] = useState<OrderItem[]>([])

  const activeSchool = schoolMode === 'EXISTING' ? schoolName : newSchoolName.trim()
  const exceptions = matchedItems.filter((item) => item.matchStatus !== 'MATCHED')
  const autoMatchedCount = matchedItems.length - exceptions.length

  const runExtraction = async () => {
    if (!activeSchool) {
      setErrorMessage('Pilih atau isi nama sekolah terlebih dahulu.')
      setExtractionState('ERROR')
      return
    }
    if ((sourceMode === 'PDF' || sourceMode === 'PHOTO') && !selectedFile) {
      setErrorMessage('Pilih file sebelum menjalankan simulasi ekstraksi.')
      setExtractionState('ERROR')
      return
    }

    setExtractionState('LOADING')
    setErrorMessage('')
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
    if (!extraction || matchedItems.length === 0 || !activeSchool) return
    const sourceType = sourceMode === 'PHOTO'
      ? 'PHOTO'
      : sourceMode === 'MANUAL' ? 'MANUAL' : 'PDF'
    const orderId = createExtractedOrder({
      schoolName: activeSchool,
      sourceType,
      fileName: selectedFile?.name ?? DEMO_ARKAS_FIXTURE.fileName,
      extraction,
      matchedItems,
    })
    navigate(`/orders/${orderId}/arkas`)
  }

  return (
    <div className="page-stack intake-page">
      <PageHeader
        eyebrow="TASK 06 · Intake ARKAS"
        title="Pesanan Baru"
        description="Satu kali tangkap ARKAS menghasilkan order terstruktur dan hanya menyisakan keputusan HET yang benar-benar perlu operator."
        actions={<Link className="button button--ghost button--sm" to="/orders">Batal</Link>}
      />

      <ol className="workflow-steps" aria-label="Tahapan intake">
        <li className="is-active"><span>1</span>Sekolah</li>
        <li className={sourceMode ? 'is-active' : ''}><span>2</span>Sumber ARKAS</li>
        <li className={extractionState === 'SUCCESS' ? 'is-active' : ''}><span>3</span>Review hasil</li>
        <li><span>4</span>Review HET</li>
      </ol>

      <div className="intake-layout">
        <section className="workspace-panel intake-config">
          <div className="panel-heading">
            <div><h2>1. Pilih sekolah</h2><p>Order baru tetap menjadi unit kerja terpisah.</p></div>
          </div>
          <div className="segmented-control" role="group" aria-label="Sumber sekolah">
            <button type="button" className={schoolMode === 'EXISTING' ? 'is-active' : ''} onClick={() => setSchoolMode('EXISTING')}>Sekolah existing</button>
            <button type="button" className={schoolMode === 'NEW' ? 'is-active' : ''} onClick={() => setSchoolMode('NEW')}>Sekolah demo baru</button>
          </div>
          {schoolMode === 'EXISTING' ? (
            <FormField label="Sekolah" htmlFor="intake-school">
              <select id="intake-school" value={schoolName} onChange={(event) => setSchoolName(event.target.value)}>
                {existingSchools.map((school) => <option key={school} value={school}>{school}</option>)}
              </select>
            </FormField>
          ) : (
            <FormField label="Nama sekolah demo" htmlFor="new-school-name">
              <input id="new-school-name" value={newSchoolName} onChange={(event) => setNewSchoolName(event.target.value)} placeholder="Contoh: SD Inpres Pass 2" />
            </FormField>
          )}

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
                  setExtractionState('IDLE')
                  setExtraction(null)
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>

          {sourceMode === 'PDF' || sourceMode === 'PHOTO' ? (
            <FormField label={sourceMode === 'PDF' ? 'File PDF' : 'File foto/gambar'} htmlFor="arkas-file" hint="File hanya dibaca namanya; tidak dikirim ke server.">
              <input
                id="arkas-file"
                type="file"
                accept={sourceMode === 'PDF' ? 'application/pdf' : 'image/*'}
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </FormField>
          ) : (
            <div className="selected-fixture">
              <span>Fixture terpilih</span>
              <strong>{DEMO_ARKAS_FIXTURE.sourceLabel}</strong>
              <small>{DEMO_ARKAS_FIXTURE.fileName} · 8 baris sumber</small>
            </div>
          )}

          <Button fullWidth onClick={() => void runExtraction()} disabled={extractionState === 'LOADING'}>
            {extractionState === 'LOADING' ? 'Mengekstrak & mencocokkan HET…' : 'Simulasikan ekstraksi ARKAS'}
          </Button>
          {extractionState === 'ERROR' ? <div className="callout callout--danger"><strong>Ekstraksi belum dapat dijalankan.</strong> {errorMessage}</div> : null}
        </section>

        <section className="workspace-panel extraction-review" aria-live="polite">
          <div className="panel-heading">
            <div><h2>3. Review hasil ekstraksi</h2><p>Nilai sumber ini akan disimpan immutable pada order.</p></div>
            {extractionState === 'SUCCESS' ? <StatusChip tone="success">Siap dibuat</StatusChip> : null}
          </div>

          {extractionState === 'IDLE' ? (
            <EmptyState title="Belum ada hasil" description="Pilih sekolah dan sumber ARKAS, lalu jalankan simulasi ekstraksi." />
          ) : null}
          {extractionState === 'LOADING' ? (
            <div className="extraction-loading"><span className="spinner" /><strong>Membaca 8 baris ARKAS</strong><p>Struktur item dan Product Master sedang dicocokkan…</p></div>
          ) : null}
          {extractionState === 'ERROR' ? (
            <EmptyState title="Tidak ada hasil extraction" description="Perbaiki input di sebelah kiri lalu coba kembali." />
          ) : null}
          {extractionState === 'SUCCESS' && extraction ? (
            <>
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
                    <StatusChip tone={statusTone(item)}>{item.matchStatus.replaceAll('_', ' ')}</StatusChip>
                  </article>
                ))}
              </div>
              <div className="intake-confirm">
                <div>
                  <strong>{autoMatchedCount} item tidak perlu dicek ulang.</strong>
                  <span>{exceptions.length} exception akan dibuka langsung pada workflow HET.</span>
                </div>
                <Button onClick={createOrder}>Buat order & review HET</Button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
