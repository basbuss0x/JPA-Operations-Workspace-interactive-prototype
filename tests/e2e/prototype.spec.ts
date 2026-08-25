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
  })).toBe(3)

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

test('Pass 2 journey creates order, reviews HET, and completes SIPLah', async ({ page }, testInfo) => {
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
  await mathException.getByRole('button', { name: 'Terima suggested match' }).click()

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
  await expect(page.getByText(/8\.188\.000/)).toHaveCount(2)

  await page.getByRole('link', { name: 'Lanjut ke SIPLah' }).click()
  await expect(page.getByRole('heading', { name: 'Workflow SIPLah' })).toBeVisible()
  await page.getByRole('button', { name: 'Tandai akses tersedia' }).click()
  await page.getByRole('button', { name: 'Tandai pesanan dibuat' }).click()
  await page.getByLabel('Nomor order SIPLah').fill('SPL-E2E-2026-240')
  await page.getByRole('button', { name: 'Simpan nomor order' }).click()
  await page.getByRole('button', { name: 'Lampirkan paket dokumen demo' }).click()

  while (await page.getByRole('button', { name: 'Verifikasi' }).count()) {
    await page.getByRole('button', { name: 'Verifikasi' }).first().click()
  }
  while (await page.getByRole('button', { name: 'Tandai dikirim' }).count()) {
    await page.getByRole('button', { name: 'Tandai dikirim' }).first().click()
  }

  await expect(page.getByRole('heading', { name: 'SIPLah selesai · siap Vendor Batch' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Masukkan ke Vendor Batch' })).toBeVisible()
  await expect(page.getByText('UNPAID')).toBeVisible()
  await expect(page.getByText('NOT ELIGIBLE')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-siplah.png'), fullPage: true })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'SIPLah selesai · siap Vendor Batch' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Masukkan ke Vendor Batch' })).toBeVisible()

  await page.goto('/orders/ORD-2026-240?tab=timeline')
  await expect(page.getByText('HET disetujui')).toBeVisible()
  await expect(page.getByText('Dokumen SIPLah dikirim').first()).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'Barang & Distribusi' })).toBeVisible()
    await expect(page.getByText('Sisa 67 buku')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('mobile-order-workspace.png'), fullPage: true })
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
