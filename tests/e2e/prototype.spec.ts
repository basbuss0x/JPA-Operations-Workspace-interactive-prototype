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
  await expect(page.getByText('Review 2 selisih HET')).toBeVisible()
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

test('snooze, override, persistence, and reset mutate real local state', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Reset Demo Data' }).click()
  await page.getByRole('button', { name: 'Reset sekarang' }).click()
  await expect(page.getByRole('heading', { name: 'Review 2 selisih HET' })).toBeVisible()
  await expect(page.getByText('Override manual')).toHaveCount(0)

  await page.evaluate(() => {
    window.localStorage.setItem(
      'jpa-operations-prototype',
      JSON.stringify({ state: { version: 999, orders: {}, vendorBatches: {} }, version: 999 }),
    )
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Review 2 selisih HET' })).toBeVisible()
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
})
