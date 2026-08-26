import { expect, test } from '@playwright/test'

const canonicalOrders = [
  ['ORD-2026-030', 'SDN 30 Ambon'],
  ['ORD-2026-071', 'SDN 71'],
  ['ORD-2026-040', 'SDN 40 Ambon'],
  ['ORD-2026-SLB', 'SLB Batu Merah'],
  ['ORD-2026-049', 'SD Inpres 49 Ambon'],
  ['ORD-2026-239', 'SDN 239 MT'],
  ['ORD-2026-065', 'SDN 65 Ambon'],
  ['ORD-2026-068', 'SDN 68 Ambon'],
  ['ORD-2025-999', 'Demo Closed School'],
] as const

test('desktop routes render canonical operational context', async ({ page }, testInfo) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kerjakan Sekarang' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review 2 selisih HET' })).toBeVisible()
  await expect(page.getByText('2 pesanan siap masuk Vendor Batch')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-home.png'), fullPage: true })

  await page.goto('/orders')
  await expect(page.getByText('9 pesanan ditemukan')).toBeVisible()
  await page.getByRole('button', { name: 'Masalah HET' }).click()
  await expect(page.getByText('1 pesanan ditemukan')).toBeVisible()
  await expect(page.getByRole('link', { name: /SDN 30 Ambon/ }).first()).toBeVisible()

  for (const [orderId, schoolName] of canonicalOrders) {
    await page.goto(`/orders/${orderId}`)
    await expect(page.getByRole('heading', { name: schoolName, exact: true })).toBeVisible()
    await expect(page.getByText(orderId).first()).toBeVisible()
  }

  await page.goto('/orders/ORD-2026-030?tab=arkas')
  await expect(page.getByRole('heading', { name: 'ARKAS & Review HET' })).toBeVisible()
  await expect(page.getByText('Buku Matematika Kelas V')).toBeVisible()

  await page.goto('/pipeline')
  await expect(page.getByRole('heading', { name: 'Pipeline', exact: true })).toBeVisible()
  await page.goto('/vendor-batches')
  await expect(page.getByRole('heading', { name: 'Vendor Batch', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-vendor-list.png'), fullPage: true })
  expect(pageErrors).toEqual([])
})

test('snooze, override, persistence, and reset mutate real local state', async ({ page }, testInfo) => {
  await page.goto('/')

  const hetWorkItem = page.locator('.next-action').filter({ hasText: 'Review 2 selisih HET' })
  await hetWorkItem.getByRole('button', { name: 'Snooze 3 hari' }).click()
  await expect(hetWorkItem).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.next-action').filter({ hasText: 'Review 2 selisih HET' })).toHaveCount(0)
  await expect(page.getByText('1 disnooze')).toBeVisible()

  await page.goto('/orders/ORD-2026-030')
  await page.getByRole('button', { name: 'Atur manual' }).click()
  await page.getByRole('textbox', { name: 'Next action', exact: true }).fill('Konfirmasi harga dengan sekolah')
  await page.getByRole('textbox', { name: 'Alasan / konteks' }).fill('Menunggu keputusan bendahara BOS.')
  await page.locator('#override-due').fill('2026-03-01')
  await page.getByRole('button', { name: 'Simpan next action' }).click()
  await expect(page.getByRole('heading', { name: 'Konfirmasi harga dengan sekolah' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Konfirmasi harga dengan sekolah' })).toBeVisible()
  await expect(page.getByText('Override manual')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aksi lain & yang disnooze' })).toBeVisible()
  await expect(page.getByText('Review 2 selisih HET')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('manual-plus-system-actions.png'), fullPage: true })

  await page.getByRole('button', { name: 'Reset Demo Data' }).click()
  await page.getByRole('button', { name: 'Reset sekarang' }).click()
  await expect(page.getByRole('heading', { name: 'Review 2 selisih HET' })).toBeVisible()
  await expect(page.getByText('Override manual')).toHaveCount(0)

  await page.evaluate(() => {
    const key = 'jpa-operations-prototype'
    const persisted = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      state?: { orders?: Record<string, Record<string, unknown>> }
    }
    const source = structuredClone(persisted.state?.orders?.['ORD-2026-068'])
    if (!source) throw new Error('Missing source order for v2 migration')
    source.schoolName = 'Migrated SDN 68'
    source.siplah = {
      accessAvailable: true,
      orderPlaced: true,
      orderNumber: 'SPL-2026-1522',
      suratPesananAvailable: true,
      suratPesananAttached: true,
      suratPesananSentToSchool: true,
    }
    source.items = (source.items as Array<Record<string, unknown>>).map((item) => {
      const legacyItem = { ...item }
      delete legacyItem.matchConfidence
      delete legacyItem.matchReason
      delete legacyItem.resolutionType
      return legacyItem
    })
    window.localStorage.setItem(
      key,
      JSON.stringify({
        state: { version: 2, orders: { 'ORD-2026-068': source }, vendorBatches: {} },
        version: 2,
      }),
    )
  })
  await page.goto('/orders/ORD-2026-068')
  await expect(page.getByRole('heading', { name: 'Migrated SDN 68' })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem('jpa-operations-prototype') ?? '{}') as { version?: number }
    return stored.version
  })).toBe(6)

  await page.evaluate(() => {
    window.localStorage.setItem(
      'jpa-operations-prototype',
      JSON.stringify({ state: { version: 999, orders: {}, vendorBatches: {} }, version: 999 }),
    )
  })
  await page.goto('/orders/ORD-2026-030')
  await expect(page.getByRole('heading', { name: 'SDN 30 Ambon' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review 2 selisih HET' })).toBeVisible()
})

test('Pass 2 journey reaches Vendor readiness while admin documents remain later', async ({ page }, testInfo) => {
  await page.goto('/orders/new')
  await expect(page.getByRole('heading', { name: 'Pesanan Baru' })).toBeVisible()
  await page.getByRole('button', { name: 'Sekolah demo baru' }).click()
  await page.getByLabel('Nama sekolah demo').fill('SD E2E Pass 2')
  await page.getByRole('button', { name: 'Upload PDF' }).click()
  await page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' }).click()
  await expect(page.getByText('Pilih file sebelum menjalankan simulasi ekstraksi.')).toBeVisible()
  await page.getByRole('button', { name: 'Demo ARKAS' }).click()
  await page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' }).click()
  await expect(page.getByRole('button', { name: 'Mengekstrak & mencocokkan HET…' })).toBeVisible()
  await expect(page.getByText('5 item tidak perlu dicek ulang.')).toBeVisible()
  await expect(page.getByText('3 exception akan dibuka langsung pada workflow HET.')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-new-order.png'), fullPage: true })

  await page.getByRole('button', { name: 'Buat order & review HET' }).click()
  await expect(page).toHaveURL(/\/orders\/ORD-2026-240\/arkas$/)
  await expect(page.getByRole('heading', { name: 'Review Selisih HET' })).toBeVisible()
  await expect(page.getByText('3 blocker sebelum SIPLah')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-het-review.png'), fullPage: true })

  const mathException = page.locator('.het-exception-card').filter({ hasText: 'Buku Matematika Kelas V' })
  await mathException.getByRole('button', { name: /Gunakan HET Rp ?82\.000/ }).click()

  const religionException = page.locator('.het-exception-card').filter({ hasText: 'Pendidikan Agama Kelas V' })
  await religionException.getByRole('button', { name: 'Pilih produk lain' }).click()
  await religionException.getByLabel('Cari Product Master').fill('BK-PAI-5')
  await religionException.getByText('Pilih BK-PAI-5').click()

  const localException = page.locator('.het-exception-card').filter({ hasText: 'Muatan Lokal Khas Ambon' })
  await localException.getByRole('button', { name: 'Manual override' }).click()
  await localException.getByLabel('Harga review per item').fill('55000')
  await localException.getByLabel('Alasan wajib').fill('Gunakan harga sumber untuk produk lokal non-master.')
  await localException.getByRole('button', { name: 'Simpan manual override' }).click()

  await expect(page.getByRole('heading', { name: 'Semua exception sudah diputuskan' })).toBeVisible()
  await expect(page.getByText(/8\.072\.000/)).toBeVisible()
  await expect(page.getByText(/8\.188\.000/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm HET Review' }).click()
  await expect(page.getByRole('heading', { name: 'Review HET dikonfirmasi' })).toBeVisible()
  await expect(page.getByText(/8\.072\.000/)).toBeVisible()
  await expect(page.getByText(/8\.188\.000/)).toHaveCount(1)
  await expect(page.getByText('Invoice final').last()).toBeVisible()
  await expect(page.getByText('—').last()).toBeVisible()

  await page.getByRole('link', { name: 'Lanjut ke SIPLah' }).click()
  await expect(page.getByRole('heading', { name: 'Workflow SIPLah' })).toBeVisible()
  await page.getByRole('button', { name: 'Tandai akses tersedia' }).click()
  await page.getByRole('button', { name: 'Tandai pesanan dibuat' }).click()
  await page.getByLabel('Nominal final transaksi SIPLah').fill('8188000')
  await page.getByLabel('Nomor order SIPLah').fill('SPL-E2E-2026-240')
  await page.getByLabel('Saya mengonfirmasi nominal final sesuai transaksi SIPLah aktual.').check()
  await page.getByRole('button', { name: 'Konfirmasi nominal & catat order' }).click()

  const suratPesanan = page.locator('.siplah-document-row').filter({ hasText: 'Surat Pesanan' })
  await suratPesanan.getByRole('button', { name: 'Lampirkan demo' }).click()
  await suratPesanan.getByRole('button', { name: 'Verifikasi' }).click()
  await suratPesanan.getByRole('button', { name: 'Tandai dikirim' }).click()

  await expect(page.getByRole('heading', { name: 'Siap masuk Vendor Batch' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Masukkan ke Vendor Batch' })).toBeVisible()
  await expect(page.getByText('Administrasi SIPLah belum lengkap')).toBeVisible()
  await expect(page.getByText('Invoice SIPLah')).toBeVisible()
  await expect(page.locator('.siplah-document-row').filter({ hasText: 'Invoice SIPLah' }).getByText('Missing')).toBeVisible()
  await expect(page.getByText('UNPAID')).toBeVisible()
  await expect(page.getByText('NOT ELIGIBLE')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-siplah.png'), fullPage: true })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Siap masuk Vendor Batch' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Masukkan ke Vendor Batch' })).toBeVisible()
  await expect(page.getByText('Administrasi SIPLah belum lengkap')).toBeVisible()

  await page.goto('/orders/ORD-2026-240?tab=timeline')
  await expect(page.getByText('HET disetujui')).toBeVisible()
  await expect(page.getByText('Transaksi SIPLah dikonfirmasi')).toBeVisible()
  await expect(page.getByText('Dokumen SIPLah dikirim').first()).toBeVisible()
})

test('Pass 3 Vendor Batch journey preserves recap, lifecycle, reminders, arrival targeting, and persistence', async ({ page }, testInfo) => {
  await page.goto('/vendor-batches/new')
  await expect(page.getByRole('heading', { name: 'Buat Vendor Batch' })).toBeVisible()
  await expect(page.getByLabel('Usulan Batch ID')).toContainText('VB-2026-010')

  await page.getByLabel('Pilih SDN 40 Ambon').check()
  await page.getByLabel('Pilih SLB Batu Merah').check()

  const mathRow = page.locator('.vendor-aggregate-table tr[data-product-code="BK-MTK-5"]')
  const bahasaRow = page.locator('.vendor-aggregate-table tr[data-product-code="BK-BINDO-5"]')
  await expect(mathRow).toContainText('28')
  await expect(bahasaRow).toContainText('21')
  await expect(page.locator('.school-allocation[data-order-id="ORD-2026-040"]')).toContainText('20')
  await expect(page.locator('.school-allocation[data-order-id="ORD-2026-SLB"]')).toContainText('8')

  await page.getByLabel('Pilih SLB Batu Merah').uncheck()
  await expect(mathRow).toContainText('20')
  await page.getByLabel('Pilih SLB Batu Merah').check()
  await expect(mathRow).toContainText('28')
  await page.screenshot({ path: testInfo.outputPath('desktop-vendor-builder.png'), fullPage: true })

  await page.getByRole('button', { name: 'Buat DRAFT Batch' }).click()
  await expect(page).toHaveURL(/\/vendor-batches\/VB-2026-010$/)
  await expect(page.getByText('DRAFT', { exact: true }).first()).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('2 pesanan siap masuk Vendor Batch')).toHaveCount(0)
  await page.goto('/vendor-batches/VB-2026-010')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Generate recap .xlsx' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('Rekap-Vendor-VB-2026-010.xlsx')
  await expect(page.getByText('Rekap sudah dibuat, belum dikirim ke vendor.', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('RECAP GENERATED', { exact: true }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('RECAP GENERATED', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Rekap sudah dibuat, belum dikirim ke vendor.', { exact: false }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Mark sent to vendor' }).click()
  await expect(page.getByText('SENT TO VENDOR', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Mark vendor confirmed' }).click()
  await expect(page.getByText('VENDOR CONFIRMED', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Start processing' }).click()
  await expect(page.getByText('PROCESSING', { exact: true }).first()).toBeVisible()

  await page.getByLabel('Tanggal follow-up').fill('2026-03-10')
  await page.getByRole('button', { name: 'Simpan reminder' }).click()
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear reminder' }).click()
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Record partial/full arrival' }).click()
  const sdnAllocation = page.locator('.arrival-allocation-list fieldset').filter({ hasText: 'SDN 40 Ambon' })
  await sdnAllocation.getByLabel('Tiba sebagian').check()
  await page.getByRole('button', { name: 'Simpan kedatangan' }).click()

  await expect(page.getByText('PARTIALLY ARRIVED', { exact: true }).first()).toBeVisible()
  const sdnMember = page.locator('.batch-member-row').filter({ hasText: 'SDN 40 Ambon' })
  const slbMember = page.locator('.batch-member-row').filter({ hasText: 'SLB Batu Merah' })
  await expect(sdnMember).toContainText('Barang PARTIAL')
  await expect(slbMember).toContainText('Barang NONE')
  await page.reload()
  await expect(sdnMember).toContainText('Barang PARTIAL')
  await expect(slbMember).toContainText('Barang NONE')
  await page.screenshot({ path: testInfo.outputPath('desktop-vendor-partial-arrival.png'), fullPage: true })

  await page.goto('/orders/ORD-2026-040?tab=vendor')
  await expect(page.getByRole('link', { name: 'VB-2026-010 →' })).toBeVisible()
  await expect(page.getByText('PARTIALLY ARRIVED', { exact: true }).first()).toBeVisible()
})

test('Pass 4 goods check and tracker cache journey preserves whole-order semantics', async ({ page }, testInfo) => {
  await page.goto('/orders/ORD-2026-239?tab=distribution')
  await expect(page.getByRole('heading', { name: 'Barang dari Vendor' })).toBeVisible()
  await expect(page.getByText('Arrival FULL')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cek barang dan jadwalkan pengantaran' })).toBeVisible()
  await expect(page.getByText('186', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('0', { exact: true }).last()).toBeVisible()

  await page.getByRole('button', { name: 'Cek barang selesai' }).click()
  await page.getByLabel('Catatan singkat').fill('Jumlah kardus sesuai surat jalan.')
  await page.getByRole('button', { name: 'Cek barang selesai' }).last().click()
  await expect(page.getByRole('heading', { name: /Lanjutkan pemenuhan · sisa 186 buku/ })).toBeVisible()
  await expect(page.getByText('Belum diterima')).toBeVisible()

  await page.getByLabel('Hasil simulasi refresh').selectOption('ERROR')
  await page.getByRole('button', { name: 'Refresh summary' }).click()
  await expect(page.getByText('Sync ERROR')).toBeVisible()
  await expect(page.getByText('186', { exact: true }).last()).toBeVisible()

  await page.getByLabel('Hasil simulasi refresh').selectOption('SUCCESS')
  await page.getByRole('button', { name: 'Refresh summary' }).click()
  await expect(page.getByText('Sync OK')).toBeVisible()
  await expect(page.getByText('120', { exact: true })).toBeVisible()
  await expect(page.getByText('66', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Lanjutkan pemenuhan · sisa 66 buku/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Open Kelengkapan Tracker/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-distribution-tracker.png'), fullPage: true })

  await page.reload()
  await expect(page.getByText('120', { exact: true })).toBeVisible()
  await expect(page.getByText('66', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.getByText('Pemeriksaan barang selesai')).toBeVisible()
  await expect(page.getByText('Sinkronisasi tracker gagal')).toBeVisible()
  await expect(page.getByText('Ringkasan fulfillment diperbarui')).toBeVisible()
  await page.getByLabel('Add Note').fill('Sekolah meminta pengantaran bertahap.')
  await page.getByRole('button', { name: 'Simpan catatan' }).click()
  await expect(page.getByText('Sekolah meminta pengantaran bertahap.')).toBeVisible()
  await expect(page.getByText('NOTE').first()).toBeVisible()
})

test('Pass 4 payment and benefit use gross invoice despite settlement deduction', async ({ page }, testInfo) => {
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Pembayaran sekolah' })).toBeVisible()
  await expect(page.getByText('UNPAID', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?24\.350\.000/).first()).toBeVisible()

  await page.getByLabel('Tanggal follow-up').fill('2026-12-10')
  await page.getByRole('button', { name: 'Simpan reminder' }).click()
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear reminder' }).click()

  await page.getByRole('button', { name: 'Confirm LUNAS' }).first().click()
  await page.getByLabel('Potongan settlement').fill('350000')
  await expect(page.getByText(/Rp\s?24\.000\.000/)).toBeVisible()
  await page.getByRole('button', { name: 'Confirm LUNAS' }).last().click()
  await expect(page.getByText('LUNAS', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('ELIGIBLE', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?2\.435\.000/).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?350\.000/)).toBeVisible()
  await expect(page.getByText(/Rp\s?24\.000\.000/)).toBeVisible()

  await page.getByRole('button', { name: 'Bayar benefit penuh' }).click()
  await page.getByLabel('Metode').last().selectOption('CASH')
  await expect(page.getByLabel('Rekening / referensi transfer')).toHaveCount(0)
  await page.getByLabel('Metode').last().selectOption('TRANSFER')
  await expect(page.getByLabel('Rekening / referensi transfer')).toHaveValue('')
  await page.getByLabel('Rekening / referensi transfer').fill('BANK-068')
  await page.getByRole('button', { name: 'Catat benefit PAID' }).click()
  await expect(page.getByText('PAID', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Siap ditutup')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-payment-benefit.png'), fullPage: true })

  await page.reload()
  await expect(page.getByText('LUNAS', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('PAID', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?2\.435\.000/).first()).toBeVisible()
})

test('Pass 4 preserves parallel fulfillment and benefit obligations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Lanjutkan pemenuhan · sisa 67 buku/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Bayar benefit Rp\s?2\.764\.000/ })).toBeVisible()

  await page.goto('/orders/ORD-2026-065')
  await expect(page.getByRole('heading', { name: /Lanjutkan pemenuhan · sisa 67 buku/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aksi lain & yang disnooze' })).toBeVisible()
  await expect(page.getByText(/Bayar benefit Rp\s?2\.764\.000/)).toBeVisible()
  await expect(page.getByText('Sisa 67 buku')).toBeVisible()
})

test('Pass 4 explicitly closes a ready order while supplier remains PARTIAL', async ({ page }) => {
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.getByRole('button', { name: 'Confirm LUNAS' }).first().click()
  await page.getByRole('button', { name: 'Confirm LUNAS' }).last().click()
  await page.getByRole('button', { name: 'Bayar benefit penuh' }).click()
  await page.getByRole('button', { name: 'Catat benefit PAID' }).click()

  await expect(page.getByText('PARTIAL', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tutup order' })).toBeVisible()
  await expect(page.getByText('Siap ditutup')).toBeVisible()
  await page.getByRole('button', { name: 'Tutup order' }).click()
  await expect(page.getByText('Selesai', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tidak ada tindakan aktif' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Selesai', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm LUNAS' })).toHaveCount(0)
})

test.describe('mobile operations layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('uses compact navigation and order cards without a desktop table', async ({ page }, testInfo) => {
    await page.goto('/orders')

    await expect(page.locator('.mobile-nav')).toBeVisible()
    await expect(page.locator('.orders-mobile-list')).toBeVisible()
    await expect(page.locator('.orders-table-wrap')).toBeHidden()
    await expect(page.getByPlaceholder(/Cari sekolah/)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-orders.png'), fullPage: true })

    await page.goto('/orders/ORD-2026-065?tab=distribution')
    await expect(page.getByRole('heading', { name: 'Barang dari Vendor' })).toBeVisible()
    await expect(page.getByText('Sisa 67 buku')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-order-workspace.png'), fullPage: true })
  })

  test('stacks Vendor selection, aggregate breakdown, and Batch detail', async ({ page }, testInfo) => {
    await page.goto('/vendor-batches/new')
    await page.getByLabel('Pilih SDN 40 Ambon').check()
    await page.getByLabel('Pilih SLB Batu Merah').check()
    await expect(page.locator('.vendor-aggregate-table-wrap')).toBeHidden()
    await expect(page.locator('.vendor-aggregate-cards')).toBeVisible()
    await expect(page.locator('.vendor-product-card[data-product-code="BK-MTK-5"]')).toContainText('28')
    await expect(page.locator('.school-breakdown-grid')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buat DRAFT Batch' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-vendor-builder.png'), fullPage: true })

    await page.goto('/vendor-batches/VB-2026-009')
    await expect(page.getByRole('heading', { name: 'VB-2026-009' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Vendor follow-up reminder' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Record partial/full arrival' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-vendor-detail.png'), fullPage: true })
  })

  test('keeps Pass 4 critical goods, finance, benefit, and note actions usable', async ({ page }, testInfo) => {
    await page.goto('/orders/ORD-2026-239?tab=distribution')
    await expect(page.getByRole('button', { name: 'Cek barang selesai' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh summary' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Open Kelengkapan Tracker/ })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-distribution.png'), fullPage: true })

    await page.goto('/orders/ORD-2026-068?tab=finance')
    await expect(page.getByRole('button', { name: 'Confirm LUNAS' })).toBeVisible()
    await page.getByRole('button', { name: 'Confirm LUNAS' }).click()
    await expect(page.getByLabel('Gross dibayar sekolah')).toBeVisible()
    await expect(page.getByLabel('Potongan settlement')).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Net diterima JPA')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-payment-modal.png'), fullPage: true })
    await page.getByRole('button', { name: 'Batal' }).click()

    await page.getByRole('tab', { name: 'Timeline' }).click()
    await expect(page.getByLabel('Add Note')).toBeVisible()
  })

  test('renders Pass 2 workflows as stacked mobile operations', async ({ page }, testInfo) => {
    await page.goto('/orders/new')
    await expect(page.getByRole('heading', { name: 'Pesanan Baru' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-new-order.png'), fullPage: true })

    await page.goto('/orders/ORD-2026-030/arkas')
    await expect(page.getByRole('heading', { name: 'Review Selisih HET' })).toBeVisible()
    await expect(page.locator('.het-comparison').first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-het-review.png'), fullPage: true })

    await page.goto('/orders/ORD-2026-071/siplah')
    await expect(page.getByRole('heading', { name: 'Workflow SIPLah' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dokumen SIPLah' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-siplah.png'), fullPage: true })
  })
})
