import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir } from 'node:fs/promises'
import { get } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { invite, member, newcomer, password, registered, roomId, startAuthFixture } from './living-auth-fixture.mjs'
import { verifyAccessibility } from './axe-check.mjs'

const playwright = process.env.POINTPLUS_PLAYWRIGHT_CORE
assert.ok(playwright, 'Set POINTPLUS_PLAYWRIGHT_CORE to playwright-core/index.mjs')
const { chromium } = await import(pathToFileURL(playwright))
const screenshots = process.env.POINTPLUS_SCREENSHOTS
const fixture = await startAuthFixture()
const port = process.env.POINTPLUS_TEST_PORT ?? '3424'
const origin = 'http://127.0.0.1:' + port
const production = process.env.POINTPLUS_AUTH_PRODUCTION === '1'
const node = 'node_modules/next/dist/bin/next'
const settings = {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: fixture.origin, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-browser-fixture',
    NEXT_PUBLIC_APP_URL: origin, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'inherit', 'inherit'],
}

let browser
let next
try {
  if (production) {
    const [status] = await once(spawn(process.execPath, [node, 'build'], settings), 'exit')
    assert.equal(status, 0, 'Fixture production build')
  }
  next = spawn(process.execPath, [node, production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', port], settings)
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
  await verifyAccessibility(page, 'login form at 390px')
  await submit(page, member, 'wrong-fixture-password')
  await page.getByRole('alert').getByText(/เข้าสู่ระบบไม่สำเร็จ/).waitFor()
  assert.equal(await page.locator('[data-entry-loading]').count(), 0)
  assert.equal((await context.cookies()).some(cookie => cookie.name === 'pointplus-opening'), false)

  const releasePassword = fixture.hold('password')
  const releaseMemberships = fixture.hold('memberships')
  let releasedAt
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
    await verifyAccessibility(page, 'authenticated loading at 390px')
    if (screenshots) {
      const press = page.locator('[data-entry-loading] [data-stamp-press]')
      await press.evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)))
      await capture(page, 'post-login-impression')
    }
    assert.equal(await page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).count(), 0)
  } finally {
    releasePassword()
    releasedAt = performance.now()
    releaseMemberships()
  }
  await page.waitForURL(origin + '/rooms')
  await page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).waitFor()
  await page.locator('[data-entry-loading]').waitFor({ state: 'detached' })
  console.log('Released destination data to visible Rooms', Math.round(performance.now() - releasedAt), 'ms')
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
  console.log('Invalid, successful, slow, onboarding, deep-link, refresh and reduced-motion login passed')

  await page.getByRole('button', { name: 'ออกจากระบบ' }).click()
  await page.waitForURL(origin + '/')
  await page.goto(origin + '/rooms')
  await page.waitForURL(origin + '/login')
  const warmedStart = performance.now()
  await submit(page)
  await page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).waitFor()
  console.log('Warm password login to visible Rooms', Math.round(performance.now() - warmedStart), 'ms')

  const guest = await newPage()
  await guest.context.addCookies([{ name: 'pointplus-opening', value: '1', url: origin }])
  await guest.page.goto(origin + destination)
  await guest.page.waitForURL(origin + '/login')
  assert.equal(await guest.page.locator('[data-entry-loading]').count(), 0)

  const expired = await newPage()
  await expired.context.addCookies([fixture.expiredCookie(origin)])
  await expired.page.goto(origin + '/rooms')
  await expired.page.waitForURL(origin + '/login')
  assert.equal(await expired.page.locator('[data-entry-loading]').count(), 0)

  const unsafe = await newPage()
  await unsafe.page.goto(origin + '/login?next=' + encodeURIComponent('https://example.invalid/rooms'))
  await submit(unsafe.page)
  await unsafe.page.waitForURL(origin + '/rooms')
  await unsafe.page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).waitFor()

  const registration = await newPage()
  await registration.page.goto(origin + '/register')
  await registration.page.getByLabel('ชื่อที่แสดง').fill('เตย')
  await registration.page.getByLabel('อีเมล', { exact: true }).fill(registered)
  await registration.page.getByLabel('รหัสผ่าน', { exact: true }).fill(password)
  await registration.page.getByRole('button', { name: 'สมัครสมาชิก' }).click()
  await registration.page.getByRole('status').getByText(/ระบบจะส่งลิงก์ยืนยัน/).waitFor()
  assert.deepEqual(fixture.observed.signup.at(-1), { email: registered, name: 'เตย', redirect: origin + '/auth/callback?next=/rooms' })
  await registration.page.goto(origin + '/auth/callback?token_hash=confirmed-fixture&type=signup&next=/rooms')
  await registration.page.waitForURL(origin + '/rooms')
  assert.ok(fixture.observed.verified.includes('signup'))
  await registration.page.goto(origin + '/profile')
  assert.equal(await registration.page.getByLabel('ชื่อที่แสดง').inputValue(), 'เตย')

  const recovery = await newPage()
  await recovery.page.goto(origin + '/forgot-password')
  await recovery.page.getByLabel('อีเมล', { exact: true }).fill(member)
  await recovery.page.getByRole('button', { name: 'ส่งลิงก์' }).click()
  await recovery.page.getByRole('status').getByText(/ลิงก์ตั้งรหัสผ่านใหม่/).waitFor()
  assert.deepEqual(fixture.observed.recovery.at(-1), { email: member, redirect: origin + '/auth/callback?next=/auth/reset-password' })
  await recovery.page.goto(origin + '/auth/callback?code=recovery-code-fixture&next=/auth/reset-password')
  await recovery.page.waitForURL(origin + '/auth/reset-password')
  await recovery.page.getByLabel('ยืนยันรหัสผ่านใหม่').waitFor()
  assert.ok(fixture.observed.verified.includes('pkce'))

  const expiredLink = await newPage()
  await expiredLink.page.goto(origin + '/auth/callback?token_hash=expired-fixture&type=recovery&next=/auth/reset-password')
  await expiredLink.page.waitForURL(origin + '/login?error=confirmation')
  await expiredLink.page.getByRole('alert').getByText(/ยืนยันตัวตนไม่สำเร็จ/).waitFor()

  const invitation = await newPage()
  const inviteUrl = origin + '/join#token=' + invite
  const inviteRequests = []
  invitation.page.on('request', request => {
    const url = new URL(request.url())
    inviteRequests.push(url.pathname + url.search)
  })
  await invitation.page.goto(inviteUrl)
  await invitation.page.waitForURL(origin + '/join')
  await invitation.page.getByRole('button', { name: 'ยอมรับคำเชิญ' }).click()
  await invitation.page.getByRole('status').getByText(/โปรดเข้าสู่ระบบ/).waitFor()
  assert.equal(fixture.observed.accepted, 0)
  await invitation.page.getByRole('link', { name: 'เข้าสู่ระบบ' }).click()
  await invitation.page.waitForURL(origin + '/login')
  await submit(invitation.page)
  await invitation.page.waitForURL(origin + '/rooms')
  await invitation.page.goto(inviteUrl)
  await invitation.page.waitForURL(origin + '/join')
  await invitation.page.getByRole('button', { name: 'ยอมรับคำเชิญ' }).click()
  await invitation.page.getByRole('link', { name: 'เปิดพื้นที่' }).waitFor()
  assert.equal(fixture.observed.accepted, 1)
  assert.equal(inviteRequests.some(url => url.includes(invite)), false)

  const back = await newPage()
  await back.page.goto(origin)
  await back.page.locator('.living-actions').getByRole('link', { name: 'เข้าสู่ระบบ' }).click()
  await back.page.waitForURL(origin + '/login')
  const releaseBack = fixture.hold('memberships')
  try {
    await submit(back.page)
    await back.page.waitForURL(origin + '/rooms')
    await back.page.locator('[data-entry-loading]').waitFor()
    await back.page.goBack({ waitUntil: 'commit' })
    await back.page.waitForURL(origin + '/')
    await back.page.locator('#hero-heading').waitFor()
    assert.equal(await back.page.locator('[data-entry-loading]').count(), 0)
  } finally {
    releaseBack()
  }

  const progressive = await newPage({ javaScriptEnabled: false })
  await progressive.page.goto(origin + '/login')
  await submit(progressive.page)
  await progressive.page.waitForURL(origin + '/rooms')
  const nativeCookies = await progressive.context.cookies()
  assert.ok(nativeCookies.some(cookie => cookie.name.startsWith('sb-127-auth-token')))
  assert.equal(nativeCookies.some(cookie => cookie.name === 'pointplus-opening'), false)
  assert.equal(await progressive.page.locator('[data-entry-loading]').count(), 0)

  const recover = await newPage()
  await recover.page.goto(origin + '/login')
  fixture.failNextMemberships()
  await submit(recover.page)
  await recover.page.getByRole('alert').getByText('เปิดหน้านี้ไม่สำเร็จ', { exact: true }).waitFor()
  assert.equal(await recover.page.locator('[data-entry-loading]').count(), 0)
  await recover.page.getByRole('button', { name: 'ลองอีกครั้ง' }).click()
  await recover.page.getByRole('heading', { name: 'ห้องของฉัน', exact: true }).waitFor()

  assert.deepEqual(errors, [])
  console.log('Registration and confirmation, direct access, expired session, logout, recovery, invitation, safe next, back navigation, native form redirect and route retry passed')
} finally {
  await browser?.close()
  next?.kill()
  await fixture.close()
}
