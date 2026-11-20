import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { get } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { member, newcomer, password, roomId, startAuthFixture } from './living-auth-fixture.mjs'

const playwright = process.env.POINTPLUS_PLAYWRIGHT_CORE
assert.ok(playwright, 'Set POINTPLUS_PLAYWRIGHT_CORE to playwright-core/index.mjs')
const { chromium } = await import(pathToFileURL(playwright))
const screenshots = process.env.POINTPLUS_SCREENSHOTS
const fixture = await startAuthFixture()
const port = process.env.POINTPLUS_TEST_PORT ?? '3424'
const origin = 'http://127.0.0.1:' + port
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', port], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: fixture.origin, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-browser-fixture',
    NEXT_PUBLIC_APP_URL: origin, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'inherit', 'inherit'],
})

let browser
try {
  for (let attempts = 0; ; attempts++) {
    if (next.exitCode !== null || attempts > 80) throw new Error('Next fixture server did not start')
    try {
      const reply = await new Promise((resolve, reject) => get(origin + '/login', resolve).on('error', reject))
      reply.resume()
      if (reply.statusCode === 200) break
    } catch {}
    await setTimeout(250)
  }

  browser = await chromium.launch({ executablePath: process.env.POINTPLUS_CHROMIUM ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
  const errors = []
  async function newPage(options = {}) {
    const context = await browser.newContext({ locale: 'th-TH', viewport: { width: 390, height: 844 }, ...options })
    const page = await context.newPage()
    page.setDefaultTimeout(12000)
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      window.pointplusEntryEvents = []
      document.addEventListener('animationstart', event => {
        if (event.target.closest('[data-entry-loading]')) window.pointplusEntryEvents.push(event.animationName)
      })
    })
    return { context, page }
  }

  async function submit(page, email = member, secret = password) {
    await page.getByLabel('อีเมล', { exact: true }).fill(email)
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(secret)
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  }

  async function capture(page, name) {
    if (!screenshots) return
    await mkdir(screenshots, { recursive: true })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: resolve(screenshots, name + '.png'), style: 'nextjs-portal { display: none }' })
  }

  const { context, page } = await newPage()
  await page.goto(origin + '/login')
  await submit(page, member, 'wrong-fixture-password')
  await page.getByRole('alert').getByText(/เข้าสู่ระบบไม่สำเร็จ/).waitFor()
  assert.equal(await page.locator('[data-entry-loading]').count(), 0)
  assert.equal((await context.cookies()).some(cookie => cookie.name === 'pointplus-opening'), false)

  const releasePassword = fixture.hold('password')
  const releaseMemberships = fixture.hold('memberships')
  try {
    await submit(page)
    await page.getByRole('status').getByText(/กำลังตรวจสอบข้อมูลเข้าสู่ระบบ/).waitFor()
    assert.equal(await page.locator('[data-entry-loading]').count(), 0)
    const started = Date.now()
    releasePassword()
    await page.locator('[data-entry-loading]').waitFor()
    console.log('Login response to opening fallback', Date.now() - started, 'ms')
    await page.waitForFunction(() => window.pointplusEntryEvents.some(name => name.includes('cover-open')))
    await capture(page, 'post-login-cover-opening')
    await page.waitForFunction(() => window.pointplusEntryEvents.some(name => name.includes('press-die')))
    await capture(page, 'post-login-heart-stamp')
    assert.equal(await page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).count(), 0)
  } finally {
    releasePassword()
    releaseMemberships()
  }
  await page.waitForURL(origin + '/rooms')
  await page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).waitFor()
  await page.locator('[data-entry-loading]').waitFor({ state: 'detached' })
  assert.equal((await context.cookies()).some(cookie => cookie.name === 'pointplus-opening'), false)
  await capture(page, 'post-login-rooms')
  await page.reload()
  await page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).waitFor()
  assert.equal(await page.locator('[data-entry-loading]').count(), 0)
  await page.goto(origin + '/register')
  await page.waitForURL(origin + '/rooms')

  const first = await newPage()
  await first.page.goto(origin + '/login')
  await submit(first.page, newcomer)
  await first.page.waitForURL(origin + '/onboarding')
  await first.page.getByRole('heading', { name: 'มาทำความรู้จักกันก่อน' }).waitFor()

  const deep = await newPage()
  const destination = '/s/' + roomId + '/settings'
  await deep.page.goto(origin + '/login?next=' + encodeURIComponent(destination))
  await submit(deep.page)
  await deep.page.waitForURL(origin + destination)
  await deep.page.getByRole('heading', { name: 'ตั้งค่าห้อง' }).waitFor()

  const reduced = await newPage({ reducedMotion: 'reduce' })
  await reduced.page.goto(origin + '/login')
  const releaseReduced = fixture.hold('memberships')
  try {
    await submit(reduced.page)
    const opening = reduced.page.locator('[data-entry-loading]')
    await opening.waitFor()
    assert.equal(await opening.evaluate(node => node.getAnimations({ subtree: true }).length), 0)
  } finally {
    releaseReduced()
  }
  await reduced.page.waitForURL(origin + '/rooms')
  await reduced.page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('Invalid, successful, slow, onboarding, deep-link, refresh and reduced-motion login passed')
} finally {
  await browser?.close()
  next.kill()
  await fixture.close()
}
