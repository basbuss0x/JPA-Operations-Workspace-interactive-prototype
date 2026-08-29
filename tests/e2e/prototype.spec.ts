import { expect, test } from '@playwright/test'

function localCalendarDateOffset(days: number): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

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

test('Pipeline derives lifecycle columns, prioritizes actions, and keeps completed orders compact', async ({ page }, testInfo) => {
  await page.goto('/pipeline')
  await expect(page.getByRole('heading', { name: 'Pipeline', exact: true })).toBeVisible()
  await expect(page.getByText('8 order aktif')).toBeVisible()

  const hetColumn = page.locator('.pipeline-column[data-stage="HET_REVIEW"]')
  const siplahColumn = page.locator('.pipeline-column[data-stage="SIPLAH"]')
  const distributionColumn = page.locator('.pipeline-column[data-stage="DISTRIBUTION"]')
  await expect(hetColumn.getByText('SDN 30 Ambon')).toBeVisible()
  await expect(hetColumn.getByText('2 selisih HET', { exact: true })).toBeVisible()
  await expect(siplahColumn.locator('.pipeline-card').first()).toContainText('SDN 71')
  await expect(distributionColumn.getByText('Sisa 67 buku', { exact: true })).toBeVisible()
  await expect(distributionColumn.getByText('Benefit ELIGIBLE')).toBeVisible()
  await expect(page.getByText('Demo Closed School')).toHaveCount(0)

  await page.getByRole('button', { name: 'Tampilkan selesai (1)' }).click()
  await expect(page.locator('.pipeline-column[data-stage="CLOSED"]')).toContainText('Demo Closed School')
  await page.screenshot({ path: testInfo.outputPath('desktop-pipeline.png'), fullPage: true })

  await distributionColumn.locator('.pipeline-card[data-order-id="ORD-2026-065"]').click()
  await expect(page).toHaveURL(/\/orders\/ORD-2026-065$/)
  await expect(page.getByRole('heading', { name: 'SDN 65 Ambon' })).toBeVisible()
})

test('desktop Orders and Pipeline keep critical context visible without horizontal discovery', async ({ page }, testInfo) => {
  const desktopViewports = [
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
  ] as const
  const pipelineStages = ['INTAKE', 'HET_REVIEW', 'SIPLAH', 'VENDOR', 'GOODS_ARRIVED', 'DISTRIBUTION', 'COMPLETION'] as const

  for (const viewport of desktopViewports) {
    await page.setViewportSize(viewport)
    await page.goto('/orders')
    await expect(page.locator('.orders-table-wrap')).toBeVisible()
    await expect(page.locator('.orders-mobile-list')).toBeHidden()
    await expect(page.getByRole('columnheader', { name: 'Sinyal order', exact: true })).toBeVisible()
    await expect(page.locator('.orders-table__signals').first().getByText('Bayar', { exact: true })).toBeVisible()
    await expect(page.locator('.orders-table__signals').first().getByText('Benefit', { exact: true })).toBeVisible()

    const paidOrder = page.locator('.orders-table tbody tr').filter({ hasText: 'SDN 65 Ambon' })
    await expect(paidOrder).toContainText('LUNAS')
    await expect(paidOrder).toContainText('ELIGIBLE')

    if (viewport.width === 1366) {
      await page.locator('.orders-table tbody tr').first().locator('.order-link strong').evaluate((element) => {
        element.textContent = 'Sekolah dengan nama yang sangat panjang untuk uji keterbacaan desktop'
      })
    }

    const orderMetrics = await page.locator('.orders-table-wrap').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    }))
    expect(orderMetrics.scrollWidth).toBeLessThanOrEqual(orderMetrics.clientWidth)
    expect(orderMetrics.documentScrollWidth).toBeLessThanOrEqual(viewport.width)

    await page.goto('/pipeline')
    for (const stage of pipelineStages) {
      const column = page.locator(`.pipeline-column[data-stage="${stage}"]`)
      await expect(column).toBeVisible()
      await expect(column.locator('.pipeline-column__header h2')).toBeVisible()
    }
    const firstCard = page.locator('.pipeline-card').first()
    if (viewport.width === 1366) {
      await firstCard.locator('.pipeline-card__header strong').evaluate((element) => {
        element.textContent = 'Sekolah dengan nama yang sangat panjang untuk uji kartu pipeline'
      })
    }
    await firstCard.focus()
    await expect(firstCard).toBeFocused()
    const pipelineMetrics = await page.locator('.pipeline-board').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    }))
    expect(pipelineMetrics.scrollWidth).toBeLessThanOrEqual(pipelineMetrics.clientWidth)
    expect(pipelineMetrics.documentScrollWidth).toBeLessThanOrEqual(viewport.width)
  }

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/orders')
  await page.screenshot({ path: testInfo.outputPath('cor10-orders-1366.png'), fullPage: true })
  await page.goto('/pipeline')
  await page.screenshot({ path: testInfo.outputPath('cor10-pipeline-1366.png'), fullPage: true })
})

test('context recovery shows what happened, what is missing, and what comes next', async ({ page }) => {
  const actionableOrders = [
    ['ORD-2026-030', /Review 2 selisih HET/],
    ['ORD-2026-071', /Belanjakan pesanan di TokoLadang\/SIPLah/],
    ['ORD-2026-040', /Masukkan ke Vendor Batch/],
    ['ORD-2026-239', /Cek barang dan jadwalkan pengantaran/],
    ['ORD-2026-065', /Lanjutkan pemenuhan · sisa 67 buku/],
  ] as const

  for (const [orderId, nextAction] of actionableOrders) {
    await page.goto(`/orders/${orderId}`)
    await expect(page.getByRole('heading', { name: nextAction })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Yang masih kurang' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kejadian terakhir' })).toBeVisible()
  }

  await page.goto('/orders/ORD-2026-049')
  await expect(page.getByRole('heading', { name: 'Atur tindak lanjut pembayaran' })).toBeVisible()
  await expect(page.getByText('Atur tindak lanjut vendor')).toBeVisible()
  await expect(page.getByText('PROCESSING', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Vendor memproses')).toBeVisible()

  await page.goto('/orders/ORD-2026-068')
  await expect(page.getByText('Pembayaran sekolah', { exact: true })).toBeVisible()
  await expect(page.getByText('Belum dibayar', { exact: true })).toBeVisible()
  await expect(page.getByText('Menunggu pembayaran sekolah')).toBeVisible()
  await expect(page.getByText('Tidak ada exception operasional yang terbuka.')).toHaveCount(0)
})

test('COR-07 makes unscheduled waits explicit and keeps confirmed reminders durable', async ({ page }, testInfo) => {
  const pastDate = localCalendarDateOffset(-1)
  const futureDate = localCalendarDateOffset(5)

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Atur tindak lanjut pembayaran' })).toBeVisible()
  const paymentDate = page.getByLabel('Tanggal follow-up')
  const paymentSave = page.getByRole('button', { name: 'Simpan reminder' })
  await expect(paymentDate).toHaveValue(localCalendarDateOffset(3))
  await expect(paymentSave).toBeEnabled()

  await paymentDate.fill(pastDate)
  await paymentSave.click()
  await expect(page.getByRole('alert')).toContainText('tidak boleh sebelum hari ini')
  await expect(paymentDate).toHaveValue(pastDate)
  await paymentDate.fill('')
  await paymentSave.click()
  await expect(page.getByRole('alert')).toContainText('wajib diisi')
  await expect(paymentDate).toHaveValue('')

  await paymentDate.fill(futureDate)
  await paymentSave.dblclick()
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Reminder pembayaran disimpan')
  await page.reload()
  await expect(paymentDate).toHaveValue(futureDate)

  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.locator('.timeline-list').getByText('Reminder pembayaran diatur', { exact: true })).toHaveCount(1)

  await page.goto('/')
  const unscheduledVendorSetup = page.locator('.next-action').filter({ hasText: 'Atur tindak lanjut vendor · VB-2026-009' })
  await expect(unscheduledVendorSetup).toHaveCount(1)
  await expect(unscheduledVendorSetup.getByRole('button', { name: 'Snooze 3 hari' })).toHaveCount(0)

  await page.goto('/vendor-batches/VB-2026-009')
  await expect(page.getByText('Atur tindak lanjut vendor.', { exact: false })).toBeVisible()
  const vendorDate = page.getByLabel('Tanggal follow-up')
  const vendorSave = page.getByRole('button', { name: 'Simpan reminder' })
  await vendorDate.fill(pastDate)
  await vendorSave.click()
  await expect(page.getByRole('alert')).toContainText('tidak boleh sebelum hari ini')
  await expect(vendorDate).toHaveValue(pastDate)

  await vendorDate.fill(futureDate)
  await vendorSave.dblclick()
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toBeVisible()
  await page.reload()
  await expect(vendorDate).toHaveValue(futureDate)
  await expect(page.locator('.mini-timeline').getByText('Reminder follow-up vendor diatur', { exact: true })).toHaveCount(1)

  await page.goto('/')
  const vendorSetup = page.locator('.next-action').filter({ hasText: 'Atur tindak lanjut vendor · VB-2026-009' })
  await expect(vendorSetup).toHaveCount(0)

  await page.screenshot({ path: testInfo.outputPath('desktop-reminders-persisted.png'), fullPage: true })
})

test('does not report reminder success when localStorage persistence fails', async ({ page }) => {
  const futureDate = localCalendarDateOffset(5)

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(name, value) {
      if (name === 'jpa-operations-prototype') throw new Error('Simulated localStorage failure')
      return originalSetItem.call(this, name, value)
    }
    ;(window as unknown as { restoreStorage?: () => void }).restoreStorage = () => {
      Storage.prototype.setItem = originalSetItem
    }
  })

  const paymentDate = page.getByLabel('Tanggal follow-up')
  await paymentDate.fill(futureDate)
  await page.getByRole('button', { name: 'Simpan reminder' }).click()
  await expect(page.getByRole('alert')).toContainText('Reminder belum tersimpan')
  await expect(paymentDate).toHaveValue(futureDate)
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toHaveCount(0)
  await expect(page.getByText('Reminder pembayaran tersimpan.', { exact: false })).toHaveCount(0)

  await page.evaluate(() => (window as unknown as { restoreStorage?: () => void }).restoreStorage?.())
  await page.getByRole('button', { name: 'Simpan reminder' }).click()
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toBeVisible()
})

test('turns a due payment reminder into one queue action and clears it after LUNAS', async ({ page }) => {
  const dueDate = localCalendarDateOffset(0)

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.getByLabel('Tanggal follow-up').fill(dueDate)
  await page.getByRole('button', { name: 'Simpan reminder' }).click()

  await page.goto('/')
  const duePayment = page.locator('.next-action').filter({ hasText: 'Follow-up pembayaran sekolah' })
  await expect(duePayment).toHaveCount(1)
  await expect(duePayment).toContainText('SDN 68 Ambon')

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.getByRole('button', { name: 'Confirm LUNAS' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm LUNAS' }).click()
  await expect(page.getByText('LUNAS', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reminder pembayaran' })).toHaveCount(0)

  await page.goto('/')
  await expect(page.locator('.next-action').filter({ hasText: 'Follow-up pembayaran sekolah' })).toHaveCount(0)
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
  await expect(page.getByRole('heading', { name: 'SDN 68 Ambon' })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem('jpa-operations-prototype') ?? '{}') as { version?: number }
    return stored.version
  })).toBe(8)

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

test('empty routes and invalid finance input stay inside accessible app feedback', async ({ page }) => {
  const browserDialogs: string[] = []
  page.on('dialog', async (dialog) => {
    browserDialogs.push(dialog.message())
    await dialog.dismiss()
  })

  await page.goto('/orders/ORD-NOT-FOUND')
  await expect(page.getByRole('heading', { name: 'Order tidak ditemukan' })).toBeVisible()
  await page.goto('/vendor-batches/VB-NOT-FOUND')
  await expect(page.getByRole('heading', { name: 'Vendor Batch tidak ditemukan' })).toBeVisible()
  await page.goto('/vendor-batches/new')
  await expect(page.getByRole('heading', { name: 'Pilih order untuk melihat recap' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Buat DRAFT Batch' })).toHaveCount(0)

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.getByRole('button', { name: 'Confirm LUNAS' }).click()
  await expect(page.getByRole('button', { name: 'Tutup dialog' })).toBeFocused()
  await page.getByLabel('Gross dibayar sekolah').fill('24000000')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm LUNAS' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('gross harus sama')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Confirm LUNAS' })).toBeFocused()
  expect(browserDialogs).toEqual([])
})

test('closure checklist names an unconfirmed final invoice amount', async ({ page }) => {
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Penutupan order belum siap' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset Demo Data' }).click()
  await page.getByRole('button', { name: 'Reset sekarang' }).click()
  await expect(page.getByRole('heading', { name: 'Penutupan order belum siap' })).toBeVisible()
  await page.evaluate(() => {
    const key = 'jpa-operations-prototype'
    const persisted = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      state?: { orders?: Record<string, { finalInvoiceAmount?: number | null }> }
    }
    const order = persisted.state?.orders?.['ORD-2026-068']
    if (!order) throw new Error('Missing closure fixture')
    order.finalInvoiceAmount = null
    window.localStorage.setItem(key, JSON.stringify(persisted))
  })
  await page.reload()

  await expect(page.getByText('nominal final SIPLah belum dikonfirmasi', { exact: false })).toBeVisible()
  await expect(page.getByText('Belum lengkap: checkpoint administrasi SIPLah.', { exact: true })).toHaveCount(0)
})

test('COR-09 requires explicit eligible school context before ARKAS extraction', async ({ page }) => {
  await page.goto('/orders/new')
  const schoolSelect = page.getByLabel('Sekolah aktif')
  const extractionButton = page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' })

  await expect(schoolSelect).toHaveValue('')
  await expect(extractionButton).toBeDisabled()
  await expect(page.getByText('Belum ada konteks sekolah yang dikonfirmasi.')).toBeVisible()
  await expect(page.locator('#intake-school option[value="SCH-999"]')).toHaveAttribute('disabled', '')

  await page.getByRole('button', { name: 'Sekolah demo baru' }).click()
  await page.getByLabel('Nama sekolah demo').fill('SDN 30 Ambon')
  await page.getByRole('button', { name: 'Konfirmasi sekolah baru' }).click()
  await expect(page.getByRole('alert')).toContainText('duplikat')
  await expect(extractionButton).toBeDisabled()

  await page.getByRole('button', { name: 'Sekolah existing' }).click()
  await expect(schoolSelect).toHaveValue('')
  await expect(page.getByLabel('Nama sekolah demo')).toHaveCount(0)
  await schoolSelect.selectOption('SCH-071')
  await page.getByRole('button', { name: 'Konfirmasi sekolah' }).click()
  await expect(page.getByText('SCH-071')).toBeVisible()
  await expect(extractionButton).toBeEnabled()

  await page.getByRole('button', { name: 'Sekolah demo baru' }).click()
  await expect(page.getByLabel('Nama sekolah demo')).toHaveValue('')
  await page.getByRole('button', { name: 'Sekolah existing' }).click()
  await expect(schoolSelect).toHaveValue('')
  await expect(page.getByText('Belum ada konteks sekolah yang dikonfirmasi.')).toBeVisible()
  await expect(extractionButton).toBeDisabled()
})

test('Pass 2 journey reaches Vendor readiness while admin documents remain later', async ({ page }, testInfo) => {
  await page.goto('/orders/new')
  await expect(page.getByRole('heading', { name: 'Pesanan Baru' })).toBeVisible()
  await page.getByRole('button', { name: 'Sekolah demo baru' }).click()
  await page.getByLabel('Nama sekolah demo').fill('SD E2E Pass 2')
  await page.getByRole('button', { name: 'Konfirmasi sekolah baru' }).click()
  await expect(page.getByText('SCH-SD-E2E-PASS-2')).toBeVisible()
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
  const createdSchool = await page.evaluate(() => {
    const persisted = JSON.parse(window.localStorage.getItem('jpa-operations-prototype') ?? '{}') as {
      state?: {
        orders?: Record<string, { schoolId?: string }>
        schools?: Record<string, { id: string; name: string; status: string }>
      }
    }
    const order = persisted.state?.orders?.['ORD-2026-240']
    const school = order?.schoolId ? persisted.state?.schools?.[order.schoolId] : undefined
    return { schoolId: order?.schoolId, school }
  })
  expect(createdSchool.schoolId).toBe('SCH-SD-E2E-PASS-2')
  expect(createdSchool.school).toMatchObject({
    id: 'SCH-SD-E2E-PASS-2',
    name: 'SD E2E Pass 2',
    status: 'ACTIVE',
  })
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

  await page.getByLabel('Tanggal follow-up').fill(localCalendarDateOffset(14))
  await page.getByRole('button', { name: 'Simpan reminder' }).click()
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear reminder' }).click()
  await expect(page.getByRole('button', { name: 'Clear reminder' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Record partial/full arrival' }).click()
  const sdnAllocation = page.locator('.arrival-allocation-list fieldset').filter({ hasText: 'SDN 40 Ambon' })
  await sdnAllocation.getByLabel('Tiba penuh').check()
  await page.getByRole('button', { name: 'Simpan kedatangan' }).click()

  await expect(page.getByText('PARTIALLY ARRIVED', { exact: true }).first()).toBeVisible()
  const sdnMember = page.locator('.batch-member-row').filter({ hasText: 'SDN 40 Ambon' })
  const slbMember = page.locator('.batch-member-row').filter({ hasText: 'SLB Batu Merah' })
  await expect(sdnMember).toContainText('Barang FULL')
  await expect(slbMember).toContainText('Barang NONE')
  await expect(page.getByText('Atur tindak lanjut vendor.', { exact: false })).toBeVisible()
  await page.reload()
  await expect(sdnMember).toContainText('Barang FULL')
  await expect(slbMember).toContainText('Barang NONE')
  await expect(page.getByText('Atur tindak lanjut vendor.', { exact: false })).toBeVisible()
  await page.goto('/')
  const partialSetup = page.locator('.next-action').filter({ hasText: 'Atur tindak lanjut vendor · VB-2026-010' })
  await expect(partialSetup).toHaveCount(1)
  await expect(partialSetup).toContainText('SLB Batu Merah')
  await expect(partialSetup).not.toContainText('SDN 40 Ambon')
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

test('tracker cumulative regression is visible while the last good cache remains intact', async ({ page }) => {
  await page.goto('/orders/ORD-2026-065?tab=distribution')
  await page.getByRole('button', { name: 'Reset Demo Data' }).click()
  await page.getByRole('button', { name: 'Reset sekarang' }).click()
  await page.evaluate(() => {
    const key = 'jpa-operations-prototype'
    const persisted = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      state?: { orders?: Record<string, { fulfillment?: Record<string, unknown> }> }
    }
    const fulfillment = persisted.state?.orders?.['ORD-2026-065']?.fulfillment
    if (!fulfillment) throw new Error('Missing persisted fulfillment cache')
    Object.assign(fulfillment, {
      deliveredQty: 300,
      remainingQty: 14,
      problemCount: 1,
      progressPercent: 96,
      lastUpdated: '2026-02-21T08:00:00.000Z',
      syncStatus: 'OK',
      syncMessage: null,
    })
    window.localStorage.setItem(key, JSON.stringify(persisted))
  })
  await page.reload()

  await expect(page.getByText('300', { exact: true })).toBeVisible()
  await expect(page.getByText('14', { exact: true })).toBeVisible()
  await page.getByLabel('Hasil simulasi refresh').selectOption('SUCCESS')
  await page.getByRole('button', { name: 'Refresh summary' }).click()

  await expect(page.getByText('Sync STALE')).toBeVisible()
  await expect(page.getByText('300', { exact: true })).toBeVisible()
  await expect(page.getByText('14', { exact: true })).toBeVisible()
  await expect(page.getByText(/delivered kumulatif masuk 247, lebih rendah dari cache 300/)).toBeVisible()
  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.getByText('Konflik snapshot tracker').first()).toBeVisible()
})

test('Pass 4 payment and benefit use gross invoice despite settlement deduction', async ({ page }, testInfo) => {
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Pembayaran sekolah' })).toBeVisible()
  await expect(page.getByText('UNPAID', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?24\.350\.000/).first()).toBeVisible()

  await page.getByLabel('Tanggal follow-up').fill(localCalendarDateOffset(14))
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

  await page.locator('.next-action').getByRole('button', { name: 'Snooze 3 hari' }).click()
  await expect(page.getByRole('heading', { name: /Bayar benefit Rp\s?2\.764\.000/ })).toBeVisible()
  await expect(page.getByText(/Lanjutkan pemenuhan · sisa 67 buku/)).toBeVisible()
  await expect(page.getByText(/Snooze sampai/)).toBeVisible()
})

test('Pass 4 closes through review and recovers an order without losing audit context', async ({ page }) => {
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Penutupan order belum siap' })).toBeVisible()
  await expect(page.getByText('Pembayaran sekolah belum dikonfirmasi LUNAS.')).toBeVisible()
  await expect(page.getByText('Benefit sekolah belum dibayar penuh.')).toBeVisible()
  await expect(page.getByText('Belum dapat ditutup. Lengkapi checkpoint wajib yang bertanda ○.')).toBeVisible()

  await page.getByRole('button', { name: 'Confirm LUNAS' }).first().click()
  await page.getByRole('button', { name: 'Confirm LUNAS' }).last().click()
  await page.getByRole('button', { name: 'Bayar benefit penuh' }).click()
  await page.getByRole('button', { name: 'Catat benefit PAID' }).click()

  await expect(page.getByText('PARTIAL', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Siap ditutup' })).toBeVisible()
  const reviewButton = page.getByRole('button', { name: 'Review penutupan' })
  await reviewButton.click()
  const closeDialog = page.getByRole('dialog')
  await expect(closeDialog).toBeVisible()
  await expect(closeDialog.getByText('Fulfillment seluruh order 100%', { exact: true })).toBeVisible()
  await expect(closeDialog.getByText('Benefit sekolah PAID', { exact: true })).toBeVisible()
  await expect(closeDialog.getByText(/tidak memblokir penutupan order/)).toBeVisible()
  await expect(page.getByText('Penyelesaian', { exact: true }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(closeDialog).toHaveCount(0)
  await expect(reviewButton).toBeFocused()

  await reviewButton.click()
  const closeCheckbox = page.getByRole('checkbox', { name: /Saya sudah meninjau checkpoint/ })
  const confirmClose = page.getByRole('button', { name: 'Konfirmasi tutup order' })
  await expect(confirmClose).toBeDisabled()
  await expect(closeCheckbox).toBeFocused()
  await closeCheckbox.check()
  await expect(confirmClose).toBeEnabled()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(confirmClose).toBeFocused()
  await confirmClose.dblclick()
  await expect(page.getByRole('heading', { name: 'Order selesai' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Atur manual' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review penutupan' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Selesai', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Order selesai' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Confirm LUNAS' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Bayar benefit penuh' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Barang & Distribusi' }).click()
  await expect(page.getByRole('button', { name: 'Refresh summary' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cek barang selesai' })).toHaveCount(0)
  await expect(page.getByText(/Cache tracker ditampilkan sebagai konteks read-only/)).toBeVisible()
  await page.goto('/orders/ORD-2026-068/siplah')
  await expect(page.getByText(/Checkpoint SIPLah ditampilkan sebagai konteks read-only/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tandai belum tersedia' })).toBeDisabled()
  await page.goto('/orders/ORD-2026-068?tab=timeline')
  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.getByLabel('Add Note')).toHaveCount(0)
  await expect(page.locator('.timeline-list').getByText('Order ditutup', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Pembayaran sekolah LUNAS', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Buka kembali order' }).click()
  const reopenDialog = page.getByRole('dialog')
  const confirmReopen = page.getByRole('button', { name: 'Konfirmasi buka kembali' })
  await expect(reopenDialog).toBeVisible()
  await confirmReopen.click()
  await expect(reopenDialog.getByRole('alert')).toContainText('Alasan membuka kembali order wajib diisi.')
  await expect(page.getByText('Selesai', { exact: true }).first()).toBeVisible()
  await page.getByLabel('Alasan membuka kembali order (wajib)').fill('Koreksi bukti pembayaran sebelum audit.')
  await confirmReopen.dblclick()
  await expect(page.getByText('Penyelesaian', { exact: true }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Pembayaran' }).click()
  await expect(page.getByRole('button', { name: 'Review penutupan' })).toBeVisible()

  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.locator('.timeline-list').getByText('Order dibuka kembali', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Koreksi bukti pembayaran sebelum audit.')).toBeVisible()
})

test.describe('mobile operations layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('uses compact navigation and order cards without a desktop table', async ({ page }, testInfo) => {
    await page.goto('/orders')

    await expect(page.locator('.mobile-nav')).toBeVisible()
    await expect(page.locator('.orders-mobile-list')).toBeVisible()
    await expect(page.locator('.orders-table-wrap')).toBeHidden()
    await expect(page.getByPlaceholder(/Cari sekolah/)).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await page.screenshot({ path: testInfo.outputPath('mobile-orders.png'), fullPage: true })

    await page.goto('/orders/ORD-2026-065?tab=distribution')
    await expect(page.getByRole('heading', { name: 'Barang dari Vendor' })).toBeVisible()
    await expect(page.getByText('Sisa 67 buku')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-order-workspace.png'), fullPage: true })

    await page.goto('/pipeline')
    await expect(page.locator('.mobile-nav')).toBeVisible()
    await expect(page.locator('.pipeline-column[data-stage="DISTRIBUTION"]')).toContainText('SDN 65 Ambon')
    await expect(page.locator('.pipeline-board')).toHaveCSS('overflow-x', 'visible')
    await page.screenshot({ path: testInfo.outputPath('mobile-pipeline.png'), fullPage: true })
  })

  test('keeps reminder setup, validation, and persistence usable on mobile', async ({ page }, testInfo) => {
    const pastDate = localCalendarDateOffset(-1)
    const futureDate = localCalendarDateOffset(5)

    await page.goto('/orders/ORD-2026-068?tab=finance')
    await expect(page.getByRole('heading', { name: 'Atur tindak lanjut pembayaran' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Simpan reminder' })).toBeEnabled()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

    const paymentDate = page.getByLabel('Tanggal follow-up')
    await paymentDate.fill(pastDate)
    await page.getByRole('button', { name: 'Simpan reminder' }).click()
    await expect(page.getByRole('alert')).toContainText('tidak boleh sebelum hari ini')
    await expect(paymentDate).toHaveValue(pastDate)
    await paymentDate.fill('')
    await page.getByRole('button', { name: 'Simpan reminder' }).click()
    await expect(page.getByRole('alert')).toContainText('wajib diisi')
    await expect(paymentDate).toHaveValue('')

    await paymentDate.fill(futureDate)
    await page.getByRole('button', { name: 'Simpan reminder' }).click()
    await expect(page.getByRole('button', { name: 'Clear reminder' })).toBeVisible()
    await page.reload()
    await expect(paymentDate).toHaveValue(futureDate)
    await page.screenshot({ path: testInfo.outputPath('mobile-reminders.png'), fullPage: true })
  })

  test('reviews and recovers closure without hiding controls on mobile', async ({ page }, testInfo) => {
    await page.goto('/orders/ORD-2026-068?tab=finance')
    await expect(page.getByRole('heading', { name: 'Penutupan order belum siap' })).toBeVisible()
    await expect(page.getByText('Pembayaran sekolah belum dikonfirmasi LUNAS.')).toBeVisible()

    await page.getByRole('button', { name: 'Confirm LUNAS' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm LUNAS' }).click()
    await page.getByRole('button', { name: 'Bayar benefit penuh' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Catat benefit PAID' }).click()

    await page.getByRole('button', { name: 'Review penutupan' }).click()
    const closeDialog = page.getByRole('dialog')
    await expect(closeDialog.getByText(/Status supplier PARTIAL/)).toBeVisible()
    const dialogBox = await closeDialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    if (dialogBox) {
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(844)
    }
    await page.screenshot({ path: testInfo.outputPath('mobile-close-review.png'), fullPage: true })

    const confirmClose = page.getByRole('button', { name: 'Konfirmasi tutup order' })
    await expect(confirmClose).toBeDisabled()
    await page.getByRole('checkbox', { name: /Saya sudah meninjau checkpoint/ }).check()
    await confirmClose.click()
    await expect(page.getByRole('heading', { name: 'Order selesai' })).toHaveCount(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

    await page.getByRole('tab', { name: 'Barang & Distribusi' }).click()
    await expect(page.getByRole('button', { name: 'Refresh summary' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Timeline' }).click()
    await expect(page.getByLabel('Add Note')).toHaveCount(0)

    await page.getByRole('button', { name: 'Buka kembali order' }).click()
    await page.getByLabel('Alasan membuka kembali order (wajib)').fill('Koreksi dokumen pada kunjungan sekolah.')
    await page.getByRole('button', { name: 'Konfirmasi buka kembali' }).click()
    await expect(page.getByText('Penyelesaian', { exact: true }).first()).toBeVisible()
    await page.getByRole('tab', { name: 'Pembayaran' }).click()
    await expect(page.getByRole('button', { name: 'Review penutupan' })).toBeVisible()
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
    await expect(page.getByLabel('Sekolah aktif')).toHaveValue('')
    await expect(page.locator('#intake-school option[value="SCH-999"]')).toHaveAttribute('disabled', '')
    await expect(page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath('mobile-new-order.png'), fullPage: true })
    await page.getByLabel('Sekolah aktif').selectOption('SCH-071')
    await page.getByRole('button', { name: 'Konfirmasi sekolah' }).click()
    await page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' }).click()
    await expect(page.getByRole('button', { name: 'Mengekstrak & mencocokkan HET…' })).toBeVisible()
    await expect(page.getByText('5 item tidak perlu dicek ulang.')).toBeVisible()
    await page.getByRole('button', { name: 'Buat order & review HET' }).click()
    await expect(page).toHaveURL(/\/orders\/ORD-2026-240\/arkas$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

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
