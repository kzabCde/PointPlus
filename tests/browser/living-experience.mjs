import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const playwright = process.env.POINTPLUS_PLAYWRIGHT_CORE
assert.ok(playwright, 'Set POINTPLUS_PLAYWRIGHT_CORE to playwright-core/index.mjs')
const { chromium } = await import(pathToFileURL(playwright))
const origin = process.env.POINTPLUS_LIVING_URL ?? 'http://localhost:3000'
const screenshots = process.env.POINTPLUS_SCREENSHOTS

const browser = await chromium.launch({
  executablePath: process.env.POINTPLUS_CHROMIUM ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
})

try {
  const context = await browser.newContext({ locale: 'th-TH', hasTouch: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const book = page.locator('.living-book')

  async function capture(name) {
    if (!screenshots) return
    await mkdir(screenshots, { recursive: true })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: resolve(screenshots, name + '.png'), animations: 'disabled',
      style: 'nextjs-portal { display: none }' })
  }

  for (const viewport of [
    ...[320, 375, 390, 768, 1024, 1440].map(width => ({ width, height: 900 })),
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto(origin)
    await page.locator('#hero-heading').waitFor()
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    assert.equal(await fits(), true, 'Closed landing overflow at ' + viewport.width)
    assert.equal(await book.getByRole('button', { name: 'เปิดสมุดดู' }).getAttribute('aria-expanded'), 'false')
    if (viewport.width === 1440 || viewport.width === 390) await capture('landing-' + viewport.width)
    await book.getByRole('button', { name: 'เปิดสมุดดู' }).tap()
    await book.getByText('ขอบคุณที่คอยอยู่ข้าง ๆ', { exact: true }).waitFor()
    assert.equal(await fits(), true, 'Open book overflow at ' + viewport.width)
    if (viewport.width === 1440 || viewport.width === 390) await capture('open-book-' + viewport.width)

    await book.getByRole('button', { name: 'หน้าถัดไป' }).press('Enter')
    await book.getByText('จดหมายถึงเธอ', { exact: true }).waitFor()
    await book.getByRole('button', { name: 'หน้าก่อน' }).click()
    await book.getByText('หน้า 1 / 2', { exact: true }).waitFor()
    await book.getByRole('button', { name: 'ปิดสมุด' }).press('Space')
    await book.getByRole('button', { name: 'เปิดสมุดดู' }).waitFor()
    assert.equal(await book.getByText('ขอบคุณที่คอยอยู่ข้าง ๆ', { exact: true }).count(), 0)
    console.log('Landing layout and book interaction passed at ' + viewport.width + '×' + viewport.height)
  }

  await page.getByRole('button', { name: 'ลองประทับแสตมป์' }).press('Enter')
  await page.getByRole('status').getByText('ประทับแสตมป์ในตัวอย่างแล้ว').waitFor()
  await page.getByRole('button', { name: 'ล้างแสตมป์ตัวอย่าง' }).click()
  assert.equal(await page.locator('.stamp-preview__slot img').count(), 0)
  await page.locator('.living-actions').getByRole('link', { name: 'เริ่มสร้างสมุด' }).click()
  await page.waitForURL(origin + '/register')
  await page.getByLabel('ชื่อที่แสดง').waitFor()
  await page.goto(origin)
  await page.locator('.living-actions').getByRole('link', { name: 'เข้าสู่ระบบ' }).click()
  await page.waitForURL(origin + '/login')
  await page.getByLabel('อีเมล').waitFor()
  assert.deepEqual(errors, [])
  console.log('Sample stamp and public auth links passed')
} finally {
  await browser.close()
}
