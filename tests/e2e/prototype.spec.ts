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
  await expect(distributionColumn.getByText('Benefit wajib dibayar')).toBeVisible()
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
    await expect(paidOrder).toContainText('Benefit wajib dibayar')

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
  await expect(page.getByText('Sedang diproses vendor', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Vendor memproses')).toBeVisible()

  await page.goto('/orders/ORD-2026-068')
  await expect(page.getByText('Pembayaran sekolah', { exact: true })).toBeVisible()
  await expect(page.getByText('Belum dibayar', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Menunggu pembayaran sekolah')).toBeVisible()
  await expect(page.getByText('Tidak ada pengecualian operasional yang terbuka.')).toHaveCount(0)
})

test('COR-07 makes unscheduled waits explicit and keeps confirmed reminders durable', async ({ page }, testInfo) => {
  const pastDate = localCalendarDateOffset(-1)
  const futureDate = localCalendarDateOffset(5)

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Atur tindak lanjut pembayaran' })).toBeVisible()
  const paymentDate = page.getByLabel('Tanggal tindak lanjut')
  const paymentSave = page.getByRole('button', { name: 'Simpan pengingat' })
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
  await expect(page.getByRole('button', { name: 'Hapus pengingat' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Pengingat pembayaran disimpan')
  await page.reload()
  await expect(paymentDate).toHaveValue(futureDate)

  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.locator('.timeline-list').getByText('Pengingat pembayaran diatur', { exact: true })).toHaveCount(1)

  await page.goto('/')
  const unscheduledVendorSetup = page.locator('.next-action').filter({ hasText: 'Atur tindak lanjut vendor · VB-2026-009' })
  await expect(unscheduledVendorSetup).toHaveCount(1)
  await expect(unscheduledVendorSetup.getByRole('button', { name: 'Tunda 3 hari' })).toHaveCount(0)

  await page.goto('/vendor-batches/VB-2026-009')
  await expect(page.getByText('Atur tindak lanjut vendor.', { exact: false })).toBeVisible()
  const vendorDate = page.getByLabel('Tanggal tindak lanjut')
  const vendorSave = page.getByRole('button', { name: 'Simpan pengingat' })
  await vendorDate.fill(pastDate)
  await vendorSave.click()
  await expect(page.getByRole('alert')).toContainText('tidak boleh sebelum hari ini')
  await expect(vendorDate).toHaveValue(pastDate)

  await vendorDate.fill(futureDate)
  await vendorSave.dblclick()
  await expect(page.getByRole('button', { name: 'Hapus pengingat' })).toBeVisible()
  await page.reload()
  await expect(vendorDate).toHaveValue(futureDate)
  await expect(page.locator('.mini-timeline').getByText('Pengingat tindak lanjut vendor diatur', { exact: true })).toHaveCount(1)

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

  const paymentDate = page.getByLabel('Tanggal tindak lanjut')
  await paymentDate.fill(futureDate)
  await page.getByRole('button', { name: 'Simpan pengingat' }).click()
  await expect(page.getByRole('alert')).toContainText('Pengingat belum tersimpan')
  await expect(paymentDate).toHaveValue(futureDate)
  await expect(page.getByRole('button', { name: 'Hapus pengingat' })).toHaveCount(0)
  await expect(page.getByText('Pengingat pembayaran tersimpan.', { exact: false })).toHaveCount(0)

  await page.evaluate(() => (window as unknown as { restoreStorage?: () => void }).restoreStorage?.())
  await page.getByRole('button', { name: 'Simpan pengingat' }).click()
  await expect(page.getByRole('button', { name: 'Hapus pengingat' })).toBeVisible()
})

test('turns a due payment reminder into one queue action and clears it after LUNAS', async ({ page }) => {
  const dueDate = localCalendarDateOffset(0)

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.getByLabel('Tanggal tindak lanjut').fill(dueDate)
  await page.getByRole('button', { name: 'Simpan pengingat' }).click()

  await page.goto('/')
  const duePayment = page.locator('.next-action').filter({ hasText: 'Tindak lanjut pembayaran sekolah' })
  await expect(duePayment).toHaveCount(1)
  await expect(duePayment).toContainText('SDN 68 Ambon')

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
  await expect(page.getByText('LUNAS', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pengingat pembayaran' })).toHaveCount(0)

  await page.goto('/')
  await expect(page.locator('.next-action').filter({ hasText: 'Tindak lanjut pembayaran sekolah' })).toHaveCount(0)
})

test('snooze, override, persistence, and reset mutate real local state', async ({ page }, testInfo) => {
  await page.goto('/')

  const hetWorkItem = page.locator('.next-action').filter({ hasText: 'Review 2 selisih HET' })
  await hetWorkItem.getByRole('button', { name: 'Tunda 3 hari' }).click()
  await expect(hetWorkItem).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.next-action').filter({ hasText: 'Review 2 selisih HET' })).toHaveCount(0)
  await expect(page.getByText('1 ditunda')).toBeVisible()

  await page.goto('/orders/ORD-2026-030')
  await page.getByRole('button', { name: 'Atur manual' }).click()
  await page.getByRole('textbox', { name: 'Next Action', exact: true }).fill('Konfirmasi harga dengan sekolah')
  await page.getByRole('textbox', { name: 'Alasan / konteks' }).fill('Menunggu keputusan bendahara BOS.')
  await page.locator('#override-due').fill('2026-03-01')
  await page.getByRole('button', { name: 'Simpan Next Action' }).click()
  await expect(page.getByRole('heading', { name: 'Konfirmasi harga dengan sekolah' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Konfirmasi harga dengan sekolah' })).toBeVisible()
  await expect(page.locator('.status-chip').filter({ hasText: /^Manual$/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tindakan lain & yang ditunda' })).toBeVisible()
  await expect(page.getByText('Review 2 selisih HET')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('manual-plus-system-actions.png'), fullPage: true })

  await page.getByRole('button', { name: 'Atur ulang data demo' }).click()
  await page.getByRole('button', { name: 'Atur ulang sekarang' }).click()
  await expect(page.getByRole('heading', { name: 'Review 2 selisih HET' })).toBeVisible()
  await expect(page.locator('.status-chip').filter({ hasText: /^Manual$/ })).toHaveCount(0)

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
  await expect(page.getByRole('heading', { name: 'Pilih order untuk melihat rekap' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Buat draf Vendor Batch' })).toHaveCount(0)

  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
  await expect(page.getByRole('button', { name: 'Tutup dialog' })).toBeFocused()
  await page.getByLabel('Gross dibayar sekolah').fill('24000000')
  await page.getByRole('dialog').getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('gross harus sama')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Konfirmasi LUNAS' })).toBeFocused()
  expect(browserDialogs).toEqual([])
})

test('COR-11 keeps critical form errors localized, associated, and retryable on desktop', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()

  const paymentDialog = page.getByRole('dialog')
  const gross = paymentDialog.getByLabel('Gross dibayar sekolah')
  await expect(paymentDialog.locator('form')).toHaveAttribute('novalidate', '')
  await gross.fill('24000000')
  await paymentDialog.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
  await expect(gross).toBeFocused()
  await expect(gross).toHaveAttribute('aria-invalid', 'true')
  await expect(gross).toHaveAttribute('aria-describedby', 'school-paid-gross-error')
  await expect(paymentDialog.locator('#school-paid-gross-error')).toContainText('gross harus sama')
  await expect(paymentDialog.getByLabel('Potongan settlement')).toHaveValue('0')

  await gross.fill('24350000')
  await expect(paymentDialog.locator('#school-paid-gross-error')).toHaveCount(0)
  await expect(paymentDialog.getByLabel('Potongan settlement')).toHaveValue('0')

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
  await paymentDialog.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
  await expect(paymentDialog.getByRole('alert')).toContainText('Simulated localStorage failure')
  await expect(gross).toHaveValue('24350000')
  await page.evaluate(() => (window as unknown as { restoreStorage?: () => void }).restoreStorage?.())
  await paymentDialog.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
  await expect(paymentDialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Bayar benefit penuh' }).click()
  const benefitDialog = page.getByRole('dialog')
  const transferReference = benefitDialog.getByLabel('Rekening / referensi transfer')
  await transferReference.fill('')
  await benefitDialog.getByRole('button', { name: 'Catat benefit sudah dibayar' }).click()
  await expect(transferReference).toBeFocused()
  await expect(transferReference).toHaveAttribute('aria-invalid', 'true')
  await expect(benefitDialog.locator('#benefit-account-reference-error')).toContainText('wajib diisi')

  await benefitDialog.getByLabel('Metode').first().selectOption('CASH')
  await expect(benefitDialog.getByLabel('Rekening / referensi transfer')).toHaveCount(0)
  await expect(benefitDialog.getByRole('alert')).toHaveCount(0)
  await benefitDialog.getByLabel('Metode').first().selectOption('TRANSFER')
  const restoredReference = benefitDialog.getByLabel('Rekening / referensi transfer')
  await expect(restoredReference).toHaveValue('')
  await benefitDialog.getByRole('button', { name: 'Catat benefit sudah dibayar' }).click()
  await expect(restoredReference).toBeFocused()
  await restoredReference.fill('BANK-COR-11')
  await expect(benefitDialog.locator('#benefit-account-reference-error')).toHaveCount(0)

  await page.goto('/orders/ORD-2026-030/arkas')
  const hetCard = page.locator('.het-exception-card').first()
  await hetCard.getByRole('button', { name: 'Penyesuaian manual' }).click()
  const manualReason = hetCard.getByLabel('Alasan wajib')
  const manualReasonId = await manualReason.getAttribute('id')
  if (!manualReasonId) throw new Error('Manual reason field has no stable ID')
  await hetCard.getByRole('button', { name: 'Simpan penyesuaian manual' }).click()
  await expect(manualReason).toBeFocused()
  await expect(manualReason).toHaveAttribute('aria-invalid', 'true')
  await expect(manualReason).toHaveAttribute('aria-describedby', `${manualReasonId}-error`)
  await expect(hetCard.locator(`#${manualReasonId}-error`)).toContainText('wajib diisi')
  await manualReason.fill('Harga sumber dikonfirmasi operator.')
  await expect(hetCard.locator(`#${manualReasonId}-error`)).toHaveCount(0)

  await page.goto('/orders/new')
  await page.getByRole('button', { name: 'Sekolah demo baru' }).click()
  const schoolName = page.getByLabel('Nama sekolah demo')
  await page.getByRole('button', { name: 'Konfirmasi sekolah baru' }).click()
  await expect(schoolName).toBeFocused()
  await expect(schoolName).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toContainText('wajib')
  await schoolName.fill('SD E2E COR 11')
  await expect(page.locator('#new-school-name-error')).toHaveCount(0)
  await page.getByRole('button', { name: 'Konfirmasi sekolah baru' }).click()
  await page.getByRole('button', { name: 'Unggah PDF' }).click()
  const arkasFile = page.locator('#arkas-file')
  await page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' }).click()
  await expect(arkasFile).toBeFocused()
  await expect(arkasFile).toHaveAttribute('aria-invalid', 'true')
  await expect(arkasFile).toHaveAttribute('aria-describedby', 'arkas-file-error')
  await expect(page.locator('#arkas-file-error')).toContainText('Pilih file')

  await page.goto('/orders/ORD-2026-065?tab=timeline')
  const note = page.getByLabel('Tambah catatan')
  await page.getByRole('button', { name: 'Simpan catatan' }).click()
  await expect(note).toBeFocused()
  await expect(note).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toContainText('Catatan wajib diisi')
  await note.fill('Konteks koreksi COR-11.')
  await expect(page.locator(`#timeline-note-ORD-2026-065-error`)).toHaveCount(0)
  await page.getByRole('button', { name: 'Simpan catatan' }).click()
  await expect(page.getByText('Konteks koreksi COR-11.')).toBeVisible()
})

test('closure checklist names an unconfirmed final invoice amount', async ({ page }) => {
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Penutupan order belum siap' })).toBeVisible()
  await page.getByRole('button', { name: 'Atur ulang data demo' }).click()
  await page.getByRole('button', { name: 'Atur ulang sekarang' }).click()
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
  await expect(page.getByText('Belum lengkap: syarat administrasi SIPLah.', { exact: true })).toHaveCount(0)
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

  await page.getByRole('button', { name: 'Sekolah terdaftar' }).click()
  await expect(schoolSelect).toHaveValue('')
  await expect(page.getByLabel('Nama sekolah demo')).toHaveCount(0)
  await schoolSelect.selectOption('SCH-071')
  await page.getByRole('button', { name: 'Konfirmasi sekolah' }).click()
  await expect(page.getByText('SCH-071')).toBeVisible()
  await expect(extractionButton).toBeEnabled()

  await page.getByRole('button', { name: 'Sekolah demo baru' }).click()
  await expect(page.getByLabel('Nama sekolah demo')).toHaveValue('')
  await page.getByRole('button', { name: 'Sekolah terdaftar' }).click()
  await expect(schoolSelect).toHaveValue('')
  await expect(page.getByText('Belum ada konteks sekolah yang dikonfirmasi.')).toBeVisible()
  await expect(extractionButton).toBeDisabled()
})

test('Pass 2 journey reaches Vendor readiness while admin documents remain later', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.goto('/orders/new')
  await expect(page.getByRole('heading', { name: 'Pesanan Baru' })).toBeVisible()
  await page.getByRole('button', { name: 'Sekolah demo baru' }).click()
  await page.getByLabel('Nama sekolah demo').fill('SD E2E Pass 2')
  await page.getByRole('button', { name: 'Konfirmasi sekolah baru' }).click()
  await expect(page.getByText('SCH-SD-E2E-PASS-2')).toBeVisible()
  await page.getByRole('button', { name: 'Unggah PDF' }).click()
  await page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' }).click()
  await expect(page.getByText('Pilih file sebelum menjalankan simulasi ekstraksi.')).toBeVisible()
  await page.getByRole('button', { name: 'Demo ARKAS' }).click()
  await page.getByRole('button', { name: 'Simulasikan ekstraksi ARKAS' }).click()
  await expect(page.getByRole('button', { name: 'Mengekstrak & mencocokkan HET…' })).toBeVisible()
  await expect(page.getByText('5 item tidak perlu dicek ulang.')).toBeVisible()
  await expect(page.getByText('3 pengecualian akan dibuka langsung pada review HET.')).toBeVisible()
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
  await expect(page.getByText('3 penghambat sebelum SIPLah')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-het-review.png'), fullPage: true })

  const mathException = page.locator('.het-exception-card').filter({ hasText: 'Buku Matematika Kelas V' })
  await mathException.getByRole('button', { name: /Gunakan HET Rp ?82\.000/ }).click()

  const religionException = page.locator('.het-exception-card').filter({ hasText: 'Pendidikan Agama Kelas V' })
  await religionException.getByRole('button', { name: 'Pilih produk lain' }).click()
  await expect(religionException.getByLabel('Saran saat ini: Pendidikan Agama Islam dan Budi Pekerti Kelas V')).toBeVisible()
  await expect(religionException.getByText('BK-PAI-5', { exact: true })).toBeVisible()
  await expect(religionException.getByText('BK-PAK-5', { exact: true })).toBeVisible()
  await expect(religionException.getByText('Alternatif yang disarankan', { exact: true })).toBeVisible()
  const productSearch = religionException.getByLabel('Cari Product Master')
  await productSearch.fill('Agama')
  await expect(religionException.getByRole('button', { name: /Pilih BK-PAK-5/ })).toBeVisible()
  await productSearch.fill('produk-tidak-ada')
  await expect(religionException.getByText('Tidak ada produk yang cocok dengan pencarian.', { exact: false })).toBeVisible()
  await expect(religionException.getByRole('button', { name: 'Hapus pencarian' })).toBeVisible()
  await religionException.getByRole('button', { name: 'Hapus pencarian' }).click()
  await expect(religionException.getByText('Alternatif yang disarankan', { exact: true })).toBeVisible()
  await productSearch.fill('BK-PAK-5')
  await religionException.getByRole('button', { name: /Pilih BK-PAK-5/ }).click()
  await expect(page.getByRole('heading', { name: 'Review Selisih HET' })).toBeVisible()
  const selectedReligion = await page.evaluate(() => {
    const persisted = JSON.parse(window.localStorage.getItem('jpa-operations-prototype') ?? '{}') as {
      state?: {
        orders?: Record<string, {
          arkasBudgetAmount?: number
          hetReviewedAmount?: number | null
          het?: { status?: string }
          items?: Array<{
            id: string
            productCode?: string | null
            arkasTitle?: string
            quantity?: number
            arkasUnitPrice?: number
          }>
        }>
      }
    }
    const order = persisted.state?.orders?.['ORD-2026-240']
    const item = order?.items?.find((candidate) => candidate.id === 'line-pendidikan-agama')
    return { arkasBudgetAmount: order?.arkasBudgetAmount, hetReviewedAmount: order?.hetReviewedAmount, hetStatus: order?.het?.status, item }
  })
  expect(selectedReligion).toMatchObject({
    arkasBudgetAmount: 8_072_000,
    hetReviewedAmount: null,
    hetStatus: 'NEEDS_REVIEW',
    item: {
      productCode: 'BK-PAK-5',
      arkasTitle: 'Pendidikan Agama Kelas V',
      quantity: 12,
      arkasUnitPrice: 66_000,
    },
  })

  const localException = page.locator('.het-exception-card').filter({ hasText: 'Muatan Lokal Khas Ambon' })
  await localException.getByRole('button', { name: 'Penyesuaian manual' }).click()
  await localException.getByLabel('Harga review per item').fill('55000')
  await localException.getByLabel('Alasan wajib').fill('Gunakan harga sumber untuk produk lokal non-master.')
  await localException.getByRole('button', { name: 'Simpan penyesuaian manual' }).click()

  await expect(page.getByRole('heading', { name: 'Semua pengecualian sudah diputuskan' })).toBeVisible()
  await expect(page.getByText(/8\.072\.000/)).toBeVisible()
  await expect(page.getByText(/8\.212\.000/)).toBeVisible()
  await page.getByRole('button', { name: 'Konfirmasi Review HET' }).click()
  await expect(page.getByRole('heading', { name: 'Review HET dikonfirmasi' })).toBeVisible()
  await expect(page.getByText(/8\.072\.000/)).toBeVisible()
  await expect(page.getByText(/8\.212\.000/)).toHaveCount(1)
  await expect(page.getByText('Invoice final').last()).toBeVisible()
  await expect(page.getByText('—').last()).toBeVisible()

  await page.getByRole('link', { name: 'Lanjut ke SIPLah' }).click()
  await expect(page.getByRole('heading', { name: 'Alur SIPLah' })).toBeVisible()
  await page.getByRole('button', { name: 'Tandai akses tersedia' }).click()
  await page.getByRole('button', { name: 'Tandai pesanan dibuat' }).click()
  await page.getByLabel('Nominal final transaksi SIPLah').fill('8212000')
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
  await expect(page.locator('.siplah-document-row').filter({ hasText: 'Invoice SIPLah' }).getByText('Belum tersedia')).toBeVisible()
  await expect(page.getByText('Belum dibayar')).toBeVisible()
  await expect(page.getByText('Belum wajib dibayar')).toBeVisible()
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

test('COR-14 keeps ranked HET alternatives available after reopening a resolved item', async ({ page }) => {
  await page.goto('/orders/ORD-2026-071/arkas')
  await expect(page.getByRole('heading', { name: 'Review HET dikonfirmasi' })).toBeVisible()

  await page.getByLabel('Alasan wajib').fill('Perlu memeriksa ulang pemetaan produk sebelum SIPLah.')
  await page.getByRole('button', { name: 'Buka kembali review HET' }).click()
  await expect(page.getByRole('heading', { name: 'Review Selisih HET' })).toBeVisible()

  await page.locator('.matched-items-disclosure summary').click()
  const resolvedMath = page.locator('.matched-items-disclosure article').filter({ hasText: 'Matematika Kelas IV' })
  await resolvedMath.getByRole('button', { name: 'Ubah' }).click()
  await resolvedMath.getByRole('button', { name: 'Pilih produk lain' }).click()
  await expect(resolvedMath.getByText('Produk saat ini', { exact: true })).toBeVisible()
  await expect(resolvedMath.getByText('Alternatif yang disarankan', { exact: true })).toBeVisible()
  await expect(resolvedMath.getByText('BK-MTK-4', { exact: true })).toBeVisible()
  await expect(resolvedMath.getByRole('button', { name: /Pilih BK-MTK-5/ })).toBeVisible()

  const productSearch = resolvedMath.getByLabel('Cari Product Master')
  await productSearch.fill('Matematika')
  await expect(resolvedMath.getByRole('button', { name: /Pilih BK-MTK-5/ })).toBeVisible()
  await productSearch.fill('BK-MTK-5')
  await resolvedMath.getByRole('button', { name: /Pilih BK-MTK-5/ }).click()

  await expect(page.getByRole('heading', { name: 'Semua pengecualian sudah diputuskan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Konfirmasi Review HET' })).toBeEnabled()
  const reopenedState = await page.evaluate(() => {
    const persisted = JSON.parse(window.localStorage.getItem('jpa-operations-prototype') ?? '{}') as {
      state?: {
        orders?: Record<string, {
          het?: { status?: string }
          hetReviewedAmount?: number | null
          arkasBudgetAmount?: number
          items?: Array<{
            id: string
            productCode?: string | null
            arkasTitle?: string
            quantity?: number
            arkasUnitPrice?: number
          }>
        }>
      }
    }
    const order = persisted.state?.orders?.['ORD-2026-071']
    return {
      hetStatus: order?.het?.status,
      hetReviewedAmount: order?.hetReviewedAmount,
      arkasBudgetAmount: order?.arkasBudgetAmount,
      item: order?.items?.find((candidate) => candidate.id === 'mtk-4'),
    }
  })
  expect(reopenedState).toMatchObject({
    hetStatus: 'NEEDS_REVIEW',
    hetReviewedAmount: null,
    arkasBudgetAmount: 16_780_000,
    item: {
      productCode: 'BK-MTK-5',
      arkasTitle: 'Matematika Kelas IV',
      quantity: 18,
      arkasUnitPrice: 78_000,
    },
  })
})

test('Pass 3 Vendor Batch journey preserves recap, lifecycle, reminders, arrival targeting, and persistence', async ({ page }, testInfo) => {
  await page.goto('/vendor-batches/new')
  await expect(page.getByRole('heading', { name: 'Buat Vendor Batch' })).toBeVisible()
  await expect(page.getByLabel('Usulan ID batch')).toContainText('VB-2026-010')

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

  await page.getByRole('button', { name: 'Buat draf Vendor Batch' }).click()
  await expect(page).toHaveURL(/\/vendor-batches\/VB-2026-010$/)
  await expect(page.getByText('Draf', { exact: true }).first()).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('2 pesanan siap masuk Vendor Batch')).toHaveCount(0)
  await page.goto('/vendor-batches/VB-2026-010')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Buat rekap .xlsx' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('Rekap-Vendor-VB-2026-010.xlsx')
  await expect(page.getByText('Rekap sudah dibuat, belum dikirim ke vendor.', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Rekap dibuat, belum dikirim', { exact: true }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('Rekap dibuat, belum dikirim', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Rekap sudah dibuat, belum dikirim ke vendor.', { exact: false }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Tandai dikirim ke vendor' }).click()
  await expect(page.getByText('Dikirim ke vendor', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Tandai vendor sudah mengonfirmasi' }).click()
  await expect(page.getByText('Vendor mengonfirmasi', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Mulai proses' }).click()
  await expect(page.getByText('Sedang diproses vendor', { exact: true }).first()).toBeVisible()

  await page.getByLabel('Tanggal tindak lanjut').fill(localCalendarDateOffset(14))
  await page.getByRole('button', { name: 'Simpan pengingat' }).click()
  await expect(page.getByRole('button', { name: 'Hapus pengingat' })).toBeVisible()
  await page.getByRole('button', { name: 'Hapus pengingat' }).click()
  await expect(page.getByRole('button', { name: 'Hapus pengingat' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Catat kedatangan sebagian/penuh' }).click()
  const sdnAllocation = page.locator('.arrival-allocation-list fieldset').filter({ hasText: 'SDN 40 Ambon' })
  await sdnAllocation.getByLabel('Tiba penuh').check()
  await page.getByRole('button', { name: 'Simpan kedatangan' }).click()

  await expect(page.getByText('Tiba sebagian', { exact: true }).first()).toBeVisible()
  const sdnMember = page.locator('.batch-member-row').filter({ hasText: 'SDN 40 Ambon' })
  const slbMember = page.locator('.batch-member-row').filter({ hasText: 'SLB Batu Merah' })
  await expect(sdnMember).toContainText('Barang · Tiba penuh')
  await expect(slbMember).toContainText('Barang · Belum tiba')
  await expect(page.getByText('Atur tindak lanjut vendor.', { exact: false })).toBeVisible()
  await page.reload()
  await expect(sdnMember).toContainText('Barang · Tiba penuh')
  await expect(slbMember).toContainText('Barang · Belum tiba')
  await expect(page.getByText('Atur tindak lanjut vendor.', { exact: false })).toBeVisible()
  await page.goto('/')
  const partialSetup = page.locator('.next-action').filter({ hasText: 'Atur tindak lanjut vendor · VB-2026-010' })
  await expect(partialSetup).toHaveCount(1)
  await expect(partialSetup).toContainText('SLB Batu Merah')
  await expect(partialSetup).not.toContainText('SDN 40 Ambon')
  await page.screenshot({ path: testInfo.outputPath('desktop-vendor-partial-arrival.png'), fullPage: true })

  await page.goto('/orders/ORD-2026-040?tab=vendor')
  await expect(page.getByRole('link', { name: 'VB-2026-010 →' })).toBeVisible()
  await expect(page.getByText('Tiba sebagian', { exact: true }).first()).toBeVisible()
})

test('Pass 4 goods check and tracker cache journey preserves whole-order semantics', async ({ page }, testInfo) => {
  await page.goto('/orders/ORD-2026-239?tab=distribution')
  await expect(page.getByRole('heading', { name: 'Barang dari Vendor' })).toBeVisible()
  await expect(page.getByText('Tiba penuh', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cek barang dan jadwalkan pengantaran' })).toBeVisible()
  await expect(page.getByText('186', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('0', { exact: true }).last()).toBeVisible()

  await page.getByRole('button', { name: 'Cek barang selesai' }).click()
  await page.getByLabel('Catatan singkat').fill('Jumlah kardus sesuai surat jalan.')
  await page.getByRole('button', { name: 'Cek barang selesai' }).last().click()
  await expect(page.getByRole('heading', { name: /Lanjutkan pemenuhan · sisa 186 buku/ })).toBeVisible()
  await expect(page.getByText('Belum diterima')).toBeVisible()

  await page.getByLabel('Hasil simulasi pembaruan').selectOption('ERROR')
  await page.getByRole('button', { name: 'Perbarui ringkasan' }).click()
  await expect(page.getByText('Sinkronisasi gagal')).toBeVisible()
  await expect(page.getByText('186', { exact: true }).last()).toBeVisible()

  await page.getByLabel('Hasil simulasi pembaruan').selectOption('SUCCESS')
  await page.getByRole('button', { name: 'Perbarui ringkasan' }).click()
  await expect(page.locator('.tracker-summary-panel .status-chip').filter({ hasText: /^Sinkronisasi berhasil$/ })).toBeVisible()
  await expect(page.getByText('120', { exact: true })).toBeVisible()
  await expect(page.getByText('66', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Lanjutkan pemenuhan · sisa 66 buku/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Buka Kelengkapan Tracker/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-distribution-tracker.png'), fullPage: true })

  await page.reload()
  await expect(page.getByText('120', { exact: true })).toBeVisible()
  await expect(page.getByText('66', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.getByText('Pemeriksaan barang selesai')).toBeVisible()
  await expect(page.getByText('Sinkronisasi tracker gagal')).toBeVisible()
  await expect(page.getByText('Ringkasan pemenuhan diperbarui')).toBeVisible()
  await page.getByLabel('Tambah catatan').fill('Sekolah meminta pengantaran bertahap.')
  await page.getByRole('button', { name: 'Simpan catatan' }).click()
  await expect(page.getByText('Sekolah meminta pengantaran bertahap.')).toBeVisible()
  await expect(page.getByText('Catatan operator').first()).toBeVisible()
})

test('tracker cumulative regression is visible while the last good cache remains intact', async ({ page }) => {
  await page.goto('/orders/ORD-2026-065?tab=distribution')
  await page.getByRole('button', { name: 'Atur ulang data demo' }).click()
  await page.getByRole('button', { name: 'Atur ulang sekarang' }).click()
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
  await page.getByLabel('Hasil simulasi pembaruan').selectOption('SUCCESS')
  await page.getByRole('button', { name: 'Perbarui ringkasan' }).click()

  await expect(page.locator('.tracker-summary-panel .status-chip').filter({ hasText: /^Data tracker tertinggal$/ })).toBeVisible()
  await expect(page.getByText('300', { exact: true })).toBeVisible()
  await expect(page.getByText('14', { exact: true })).toBeVisible()
  await expect(page.getByText(/jumlah diterima kumulatif masuk 247, lebih rendah dari data terakhir 300/)).toBeVisible()
  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.getByText('Konflik data tracker').first()).toBeVisible()
})

test('Pass 4 payment and benefit use gross invoice despite settlement deduction', async ({ page }, testInfo) => {
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Pembayaran sekolah' })).toBeVisible()
  await expect(page.getByText('Belum dibayar', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?24\.350\.000/).first()).toBeVisible()

  await page.getByLabel('Tanggal tindak lanjut').fill(localCalendarDateOffset(14))
  await page.getByRole('button', { name: 'Simpan pengingat' }).click()
  await expect(page.getByRole('button', { name: 'Hapus pengingat' })).toBeVisible()
  await page.getByRole('button', { name: 'Hapus pengingat' }).click()

  await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).first().click()
  await page.getByLabel('Potongan settlement').fill('350000')
  await expect(page.getByText(/Rp\s?24\.000\.000/)).toBeVisible()
  await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).last().click()
  await expect(page.getByText('LUNAS', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Benefit wajib dibayar', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?2\.435\.000/).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?350\.000/)).toBeVisible()
  await expect(page.getByText(/Rp\s?24\.000\.000/)).toBeVisible()

  await page.getByRole('button', { name: 'Bayar benefit penuh' }).click()
  await page.getByLabel('Metode').last().selectOption('CASH')
  await expect(page.getByLabel('Rekening / referensi transfer')).toHaveCount(0)
  await page.getByLabel('Metode').last().selectOption('TRANSFER')
  await expect(page.getByLabel('Rekening / referensi transfer')).toHaveValue('')
  await page.getByLabel('Rekening / referensi transfer').fill('BANK-068')
  await page.getByRole('button', { name: 'Catat benefit sudah dibayar' }).click()
  await expect(page.getByText('Benefit sudah dibayar', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Siap ditutup')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-payment-benefit.png'), fullPage: true })

  await page.reload()
  await expect(page.getByText('LUNAS', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Benefit sudah dibayar', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Rp\s?2\.435\.000/).first()).toBeVisible()
})

test('Pass 4 preserves parallel fulfillment and benefit obligations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Lanjutkan pemenuhan · sisa 67 buku/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Bayar benefit Rp\s?2\.764\.000/ })).toBeVisible()

  await page.goto('/orders/ORD-2026-065')
  await expect(page.getByRole('heading', { name: /Lanjutkan pemenuhan · sisa 67 buku/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tindakan lain & yang ditunda' })).toBeVisible()
  await expect(page.getByText(/Bayar benefit Rp\s?2\.764\.000/)).toBeVisible()
  await expect(page.getByText('Sisa 67 buku')).toBeVisible()

  await page.locator('.next-action').getByRole('button', { name: 'Tunda 3 hari' }).click()
  await expect(page.getByRole('heading', { name: /Bayar benefit Rp\s?2\.764\.000/ })).toBeVisible()
  await expect(page.getByText(/Lanjutkan pemenuhan · sisa 67 buku/)).toBeVisible()
  await expect(page.getByText(/Ditunda sampai/)).toBeVisible()
})

test('Pass 4 closes through review and recovers an order without losing audit context', async ({ page }) => {
  await page.goto('/orders/ORD-2026-068?tab=finance')
  await expect(page.getByRole('heading', { name: 'Penutupan order belum siap' })).toBeVisible()
  await expect(page.getByText('Pembayaran sekolah belum dikonfirmasi LUNAS.')).toBeVisible()
  await expect(page.getByText('Benefit sekolah belum dibayar penuh.')).toBeVisible()
  await expect(page.getByText('Belum dapat ditutup. Lengkapi syarat wajib yang bertanda ○.')).toBeVisible()

  await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).first().click()
  await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).last().click()
  await page.getByRole('button', { name: 'Bayar benefit penuh' }).click()
  await page.getByRole('button', { name: 'Catat benefit sudah dibayar' }).click()

  await expect(page.getByText('Dibayar sebagian', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Siap ditutup' })).toBeVisible()
  const reviewButton = page.getByRole('button', { name: 'Review penutupan' })
  await reviewButton.click()
  const closeDialog = page.getByRole('dialog')
  await expect(closeDialog).toBeVisible()
  await expect(closeDialog.getByText('Pemenuhan seluruh order 100%', { exact: true })).toBeVisible()
  await expect(closeDialog.getByText('Benefit sekolah sudah dibayar', { exact: true })).toBeVisible()
  await expect(closeDialog.getByText(/tidak memblokir penutupan order/)).toBeVisible()
  await expect(page.getByText('Penyelesaian', { exact: true }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(closeDialog).toHaveCount(0)
  await expect(reviewButton).toBeFocused()

  await reviewButton.click()
  const closeCheckbox = page.getByRole('checkbox', { name: /Saya sudah meninjau syarat/ })
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
  await expect(page.getByRole('button', { name: 'Konfirmasi LUNAS' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Bayar benefit penuh' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Barang & Distribusi' }).click()
  await expect(page.getByRole('button', { name: 'Perbarui ringkasan' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cek barang selesai' })).toHaveCount(0)
  await expect(page.getByText(/Ringkasan tracker ditampilkan sebagai konteks hanya baca/)).toBeVisible()
  await page.goto('/orders/ORD-2026-068/siplah')
  await expect(page.getByText(/Syarat SIPLah ditampilkan sebagai konteks hanya baca/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tandai belum tersedia' })).toBeDisabled()
  await page.goto('/orders/ORD-2026-068?tab=timeline')
  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page.getByLabel('Tambah catatan')).toHaveCount(0)
  await expect(page.locator('.timeline-list').getByText('Order ditutup', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Pembayaran sekolah LUNAS', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Buka kembali order' }).click()
  const reopenDialog = page.getByRole('dialog')
  const confirmReopen = page.getByRole('button', { name: 'Konfirmasi buka kembali' })
  await expect(reopenDialog).toBeVisible()
  await confirmReopen.click()
  const reopenReason = page.getByLabel('Alasan membuka kembali order (wajib)')
  await expect(reopenReason).toBeFocused()
  await expect(reopenReason).toHaveAttribute('aria-invalid', 'true')
  await expect(reopenReason).toHaveAttribute('aria-describedby', 'reopen-order-reason-error')
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
    const sectionPicker = page.getByRole('combobox', { name: 'Bagian ruang kerja order' })
    await expect(sectionPicker).toHaveValue('distribution')
    await expect(sectionPicker.locator('option')).toHaveCount(7)
    await page.screenshot({ path: testInfo.outputPath('mobile-order-workspace.png'), fullPage: true })

    await page.goto('/pipeline')
    await expect(page.locator('.mobile-nav')).toBeVisible()
    await expect(page.locator('.pipeline-column[data-stage="DISTRIBUTION"]')).toContainText('SDN 65 Ambon')
    await expect(page.locator('.pipeline-board')).toHaveCSS('overflow-x', 'visible')
    await page.screenshot({ path: testInfo.outputPath('mobile-pipeline.png'), fullPage: true })
  })

  test('makes workspace sections and Orders filters explicit on mobile', async ({ page }) => {
    await page.goto('/orders/ORD-2026-065')
    const sectionPicker = page.getByRole('combobox', { name: 'Bagian ruang kerja order' })

    await expect(page.locator('.tabs')).toBeHidden()
    await expect(page.locator('.tabs__mobile-picker')).toBeVisible()
    await expect(sectionPicker).toHaveValue('overview')
    await expect(sectionPicker.locator('option')).toHaveCount(7)
    expect(await sectionPicker.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))).toEqual([
      'overview', 'arkas', 'siplah', 'vendor', 'distribution', 'finance', 'timeline',
    ])
    await expect(sectionPicker.locator('option').last()).toHaveText('Timeline')

    await sectionPicker.selectOption('finance')
    await expect(page).toHaveURL(/\/orders\/ORD-2026-065\?tab=finance$/)
    await expect(sectionPicker).toHaveValue('finance')
    await expect(page.getByRole('heading', { name: 'Pembayaran sekolah' })).toBeVisible()

    await sectionPicker.selectOption('arkas')
    await expect(page).toHaveURL(/\/orders\/ORD-2026-065\?tab=arkas$/)
    await expect(page.getByRole('heading', { name: 'ARKAS & Review HET' })).toBeVisible()

    await sectionPicker.selectOption('timeline')
    await expect(page).toHaveURL(/\/orders\/ORD-2026-065\?tab=timeline$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/orders\/ORD-2026-065\?tab=arkas$/)
    await expect(sectionPicker).toHaveValue('arkas')
    await page.goForward()
    await expect(page).toHaveURL(/\/orders\/ORD-2026-065\?tab=timeline$/)
    await page.reload()
    await expect(sectionPicker).toHaveValue('timeline')
    await expect(page.getByRole('heading', { name: 'Timeline order' })).toBeVisible()

    await page.goto('/orders?filter=benefit-eligible')
    const filterPicker = page.getByRole('combobox', { name: 'Filter cepat' })
    await expect(page.locator('.quick-filters')).toBeHidden()
    await expect(page.locator('.quick-filter-picker')).toBeVisible()
    await expect(filterPicker).toHaveValue('benefit-eligible')
    await expect(filterPicker.locator('option')).toHaveCount(8)
    await expect(filterPicker.locator('option').last()).toHaveText('Benefit wajib dibayar')
    for (const filter of ['all', 'needs-action', 'het-problem', 'ready-siplah', 'ready-vendor', 'goods-arrived', 'unpaid', 'benefit-eligible']) {
      await filterPicker.selectOption(filter)
      await expect(filterPicker).toHaveValue(filter)
    }
    await filterPicker.selectOption('unpaid')
    await expect(page).toHaveURL(/\/orders\?filter=unpaid$/)
    await expect(filterPicker).toHaveValue('unpaid')

    const lastNavItem = page.locator('.mobile-nav__link').last()
    const lastNavBox = await lastNavItem.boundingBox()
    expect(lastNavBox).not.toBeNull()
    if (lastNavBox) expect(lastNavBox.x + lastNavBox.width).toBeLessThanOrEqual(390)
    const resetButton = page.getByRole('button', { name: 'Atur ulang data demo' })
    await expect(resetButton).toHaveClass(/topbar__reset/)
    expect(Number(await resetButton.evaluate((element) => getComputedStyle(element).opacity))).toBeLessThan(1)

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/orders/ORD-2026-065?tab=finance')
    await expect(page.locator('.tabs')).toBeVisible()
    await expect(page.locator('.tabs__mobile-picker')).toBeHidden()
    await expect(page.getByRole('tab', { name: 'Pembayaran', selected: true })).toBeVisible()
    await page.goto('/orders?filter=benefit-eligible')
    await expect(page.locator('.quick-filters')).toBeVisible()
    await expect(page.locator('.quick-filter-picker')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Benefit wajib dibayar' })).toHaveClass(/filter-chip--active/)
  })

  test('keeps reminder setup, validation, and persistence usable on mobile', async ({ page }, testInfo) => {
    const pastDate = localCalendarDateOffset(-1)
    const futureDate = localCalendarDateOffset(5)

    await page.goto('/orders/ORD-2026-068?tab=finance')
    await expect(page.getByRole('heading', { name: 'Atur tindak lanjut pembayaran' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Simpan pengingat' })).toBeEnabled()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

    const paymentDate = page.getByLabel('Tanggal tindak lanjut')
    await paymentDate.fill(pastDate)
    await page.getByRole('button', { name: 'Simpan pengingat' }).click()
    await expect(page.getByRole('alert')).toContainText('tidak boleh sebelum hari ini')
    await expect(paymentDate).toHaveValue(pastDate)
    await paymentDate.fill('')
    await page.getByRole('button', { name: 'Simpan pengingat' }).click()
    await expect(page.getByRole('alert')).toContainText('wajib diisi')
    await expect(paymentDate).toHaveValue('')

    await paymentDate.fill(futureDate)
    await page.getByRole('button', { name: 'Simpan pengingat' }).click()
    await expect(page.getByRole('button', { name: 'Hapus pengingat' })).toBeVisible()
    await page.reload()
    await expect(paymentDate).toHaveValue(futureDate)
    await page.screenshot({ path: testInfo.outputPath('mobile-reminders.png'), fullPage: true })
  })

  test('reviews and recovers closure without hiding controls on mobile', async ({ page }, testInfo) => {
    await page.goto('/orders/ORD-2026-068?tab=finance')
    await expect(page.getByRole('heading', { name: 'Penutupan order belum siap' })).toBeVisible()
    await expect(page.getByText('Pembayaran sekolah belum dikonfirmasi LUNAS.')).toBeVisible()

    await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
    await page.getByRole('button', { name: 'Bayar benefit penuh' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Catat benefit sudah dibayar' }).click()

    await page.getByRole('button', { name: 'Review penutupan' }).click()
    const closeDialog = page.getByRole('dialog')
    await expect(closeDialog.getByText(/Status supplier Dibayar sebagian/)).toBeVisible()
    const dialogBox = await closeDialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    if (dialogBox) {
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(844)
    }
    await page.screenshot({ path: testInfo.outputPath('mobile-close-review.png'), fullPage: true })

    const confirmClose = page.getByRole('button', { name: 'Konfirmasi tutup order' })
    await expect(confirmClose).toBeDisabled()
    await page.getByRole('checkbox', { name: /Saya sudah meninjau syarat/ }).check()
    await confirmClose.click()
    await expect(page.getByRole('heading', { name: 'Order selesai' })).toHaveCount(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

    await page.getByRole('combobox', { name: 'Bagian ruang kerja order' }).selectOption('distribution')
    await expect(page.getByRole('button', { name: 'Perbarui ringkasan' })).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Bagian ruang kerja order' }).selectOption('timeline')
    await expect(page.getByLabel('Tambah catatan')).toHaveCount(0)

    await page.getByRole('button', { name: 'Buka kembali order' }).click()
    await page.getByLabel('Alasan membuka kembali order (wajib)').fill('Koreksi dokumen pada kunjungan sekolah.')
    await page.getByRole('button', { name: 'Konfirmasi buka kembali' }).click()
    await expect(page.getByText('Penyelesaian', { exact: true }).first()).toBeVisible()
    await page.getByRole('combobox', { name: 'Bagian ruang kerja order' }).selectOption('finance')
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
    await expect(page.getByRole('button', { name: 'Buat draf Vendor Batch' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-vendor-builder.png'), fullPage: true })

    await page.goto('/vendor-batches/VB-2026-009')
    await expect(page.getByRole('heading', { name: 'VB-2026-009' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pengingat tindak lanjut vendor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Catat kedatangan sebagian/penuh' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-vendor-detail.png'), fullPage: true })
  })

  test('keeps Pass 4 critical goods, finance, benefit, and note actions usable', async ({ page }, testInfo) => {
    await page.goto('/orders/ORD-2026-239?tab=distribution')
    await expect(page.getByRole('button', { name: 'Cek barang selesai' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Perbarui ringkasan' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Buka Kelengkapan Tracker/ })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-distribution.png'), fullPage: true })

    await page.goto('/orders/ORD-2026-068?tab=finance')
    await expect(page.getByRole('button', { name: 'Konfirmasi LUNAS' })).toBeVisible()
    await page.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
    await expect(page.getByLabel('Gross dibayar sekolah')).toBeVisible()
    await expect(page.getByLabel('Potongan settlement')).toBeVisible()
    const paymentDialog = page.getByRole('dialog')
    await expect(paymentDialog.getByText('Net diterima JPA')).toBeVisible()
    await expect(paymentDialog.locator('form')).toHaveAttribute('novalidate', '')
    await page.screenshot({ path: testInfo.outputPath('mobile-payment-modal.png'), fullPage: true })
    const gross = paymentDialog.getByLabel('Gross dibayar sekolah')
    await gross.fill('')
    await paymentDialog.getByRole('button', { name: 'Konfirmasi LUNAS' }).click()
    await expect(gross).toBeFocused()
    await expect(paymentDialog.getByRole('alert')).toContainText('wajib diisi')
    const paymentDialogBox = await paymentDialog.boundingBox()
    expect(paymentDialogBox).not.toBeNull()
    if (paymentDialogBox) expect(paymentDialogBox.y + paymentDialogBox.height).toBeLessThanOrEqual(844)
    await expect(paymentDialog.getByRole('button', { name: 'Konfirmasi LUNAS' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await gross.fill('24350000')
    await expect(paymentDialog.locator('#school-paid-gross-error')).toHaveCount(0)
    await page.getByRole('button', { name: 'Batal' }).click()

    await page.getByRole('combobox', { name: 'Bagian ruang kerja order' }).selectOption('timeline')
    await expect(page.getByLabel('Tambah catatan')).toBeVisible()
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
    const mobileReligion = page.locator('.het-exception-card').filter({ hasText: 'Pendidikan Agama / PAI V' })
    await mobileReligion.getByRole('button', { name: 'Pilih produk lain' }).click()
    await expect(mobileReligion.getByText('Saran saat ini', { exact: true })).toBeVisible()
    await expect(mobileReligion.getByText('BK-PAI-5', { exact: true })).toBeVisible()
    await expect(mobileReligion.getByText('BK-PAK-5', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await page.screenshot({ path: testInfo.outputPath('mobile-het-alternatives.png'), fullPage: true })

    await page.goto('/orders/ORD-2026-071/siplah')
    await expect(page.getByRole('heading', { name: 'Alur SIPLah' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dokumen SIPLah' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-siplah.png'), fullPage: true })
  })
})
