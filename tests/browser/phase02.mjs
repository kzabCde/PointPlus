import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { createServer, get } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout } from 'node:timers/promises'

const playwrightEntry = process.env.POINTPLUS_PLAYWRIGHT_CORE
assert.ok(playwrightEntry, 'Set POINTPLUS_PLAYWRIGHT_CORE to the path of playwright-core/index.mjs')
const { chromium } = await import(pathToFileURL(playwrightEntry))
const ids = {
  user: '11111111-1111-4111-8111-111111111111',
  partner: '22222222-2222-4222-8222-222222222222',
  room: '33333333-3333-4333-8333-333333333333',
  participant: '44444444-4444-4444-8444-444444444444',
  otherParticipant: '55555555-5555-4555-8555-555555555555',
  book: '66666666-6666-4666-8666-666666666666',
  archive: '77777777-7777-4777-8777-777777777777',
  paused: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  reward: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  claim: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  otherClaim: '13131313-1313-4313-8313-131313131313',
  notice: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  cycle: '88888888-8888-4888-8888-888888888888',
  otherCycle: '99999999-9999-4999-8999-999999999999',
  pastCycle: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  nextCycle: '12121212-1212-4212-8212-121212121212',
  approvedRequest: '23232323-2323-4232-8232-232323232323',
}
const now = '2025-06-07T09:00:00Z'
const authUser = { id: ids.user, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now }
const room = { id: ids.room, name: 'บ้านของเรา', kind: 'family', owner_id: ids.user, timezone: 'Asia/Bangkok' }
const firstBook = { id: ids.book, space_id: room.id, created_by: ids.user, title: 'ช่วงเวลาดี ๆ ของเรา', description: 'เก็บวันที่เราได้อ่านหนังสือและใช้เวลาด้วยกัน', cover_asset_id: 'family-books', target_count: 8, repeatable: true, allow_self_stamp: false, approval_policy: 'approval_required', status: 'active', created_at: now }
const tables = {
  spaces: [room],
  profiles: [{ id: ids.user, display_name: 'ใบบัว', locale: 'th', timezone: 'Asia/Bangkok', avatar_path: null }],
  space_members: [
    { space_id: room.id, user_id: ids.user, role: 'owner', joined_at: now },
    { space_id: room.id, user_id: ids.partner, role: 'admin', joined_at: now },
  ],
  participants: [
    { id: ids.participant, space_id: room.id, kind: 'adult', user_id: ids.partner, display_name: 'มะลิ', archived_at: null },
    { id: ids.otherParticipant, space_id: room.id, kind: 'adult', user_id: ids.user, display_name: 'ใบบัว', archived_at: null },
  ],
  stamp_books: [firstBook, { ...firstBook, id: ids.paused, status: 'paused', title: 'บันทึกช่วงเวลาพิเศษ', description: null, cover_asset_id: 'couple-heart' }, { ...firstBook, id: ids.archive, status: 'archived', title: 'สมุดวันหยุด', cover_asset_id: 'personal-sunrise' }],
  stamp_book_cycles: [
    { id: ids.cycle, book_id: ids.book, space_id: room.id, participant_id: ids.participant, cycle_no: 2, target_snapshot: 8, progress_count: 2, completed_at: null, created_at: now },
    { id: ids.pastCycle, book_id: ids.book, space_id: room.id, participant_id: ids.participant, cycle_no: 1, target_snapshot: 1, progress_count: 1, completed_at: now, created_at: now },
    { id: ids.otherCycle, book_id: ids.book, space_id: room.id, participant_id: ids.otherParticipant, cycle_no: 1, target_snapshot: 8, progress_count: 0, completed_at: null, created_at: now },
  ],
  stamp_book_marks: [
    { id: 'mark-past', request_id: 'past-stamp', book_id: ids.book, cycle_id: ids.pastCycle, participant_id: ids.participant,
      asset_id: 'family-books', giver_user_id: ids.user, stamped_at: now, note: 'ความทรงจำรอบแรก' },
    { id: 'mark-a', request_id: 'original-a', book_id: ids.book, cycle_id: ids.cycle, participant_id: ids.participant, asset_id: 'family-books', giver_user_id: ids.user, stamped_at: now, note: 'ขอบคุณที่อ่านด้วยกัน' },
    { id: 'mark-b', request_id: 'original-b', book_id: ids.book, cycle_id: ids.cycle, participant_id: ids.participant, asset_id: 'couple-heart', giver_user_id: ids.user, stamped_at: now, note: null },
  ],
  stamp_book_recipients: [
    { book_id: ids.book, participant_id: ids.participant },
    { book_id: ids.book, participant_id: ids.otherParticipant },
  ],
  stamp_book_givers: [{ book_id: ids.book, user_id: ids.user }],
  stamp_book_styles: [{ book_id: ids.book, asset_id: 'family-books' }, { book_id: ids.book, asset_id: 'couple-heart' }],
  stamp_book_reward_options: [{ id: ids.reward, space_id: room.id, book_id: ids.book, title: 'เลือกหนังดูด้วยกัน', description: 'เลือกเรื่องโปรดสำหรับคืนวันหยุด', active: true, stock_remaining: null }],
  stamp_book_claims: [],
  stamp_book_stamp_requests: [],
  notifications: [{ id: ids.notice, space_id: room.id, recipient_user_id: ids.user, type: 'notice', title: 'มีคำเชิญเข้าร่วมกิจกรรม', body: 'เปิดห้องเพื่อดูรายละเอียด', payload: {}, read_at: null, created_at: now }],
}
const calls = []
const inviteToken = 'a'.repeat(64)
let inviteUsed = false
let failNextCreate = true
let forcedStampResult = null
const fixture = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  function json(payload, status = 200) {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(payload))
  }
  if (url.pathname === '/auth/v1/user') return json(authUser)
  const table = url.pathname.split('/').at(-1)
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    let body = ''
    for await (const chunk of request) body += chunk
    calls.push({ rpc: table, payload: JSON.parse(body) })
    if (table === 'pointplus_create_stamp_book') {
      if (failNextCreate) {
        failNextCreate = false
        return json({ message: 'Fixture validation error', code: 'P0001' }, 400)
      }
      return json(ids.book)
    }
    if (table === 'pointplus_give_stamp') {
      const forced = forcedStampResult
      forcedStampResult = null
      if (forced === 'denied') return json({ message: 'Not authorized to give this stamp', code: '42501' }, 403)
      if (forced === 'rejected') return json({ request_id: ids.approvedRequest, status: 'rejected' })
      const { p_art, p_note } = calls.at(-1).payload
      if (firstBook.approval_policy === 'approval_required') {
        tables.stamp_book_stamp_requests.push({
          id: 'pending-stamp', book_id: ids.book, participant_id: ids.participant, asset_id: p_art,
          giver_user_id: ids.user, status: 'pending', created_at: now, note: p_note,
        })
        return json({ request_id: 'pending-stamp', status: 'pending' })
      }
      if (!tables.stamp_book_marks.some(mark => mark.request_id === ids.approvedRequest)) {
        const current = tables.stamp_book_cycles.find(cycle => cycle.id === ids.cycle)
        tables.stamp_book_marks.push({
          id: 'mark-confirmed', request_id: ids.approvedRequest, book_id: ids.book, cycle_id: current.id,
          participant_id: ids.participant, asset_id: p_art, giver_user_id: ids.user, stamped_at: '2025-06-08T09:00:00Z', note: p_note,
        })
        current.progress_count++
        current.completed_at = '2025-06-08T09:00:00Z'
        tables.stamp_book_cycles.push({ ...current, id: ids.nextCycle, cycle_no: 3, progress_count: 0, completed_at: null })
      }
      return json({ request_id: ids.approvedRequest, status: 'approved' })
    }
    if (table === 'pointplus_claim_stamp_book_reward') {
      tables.stamp_book_claims.push({
        id: ids.claim, space_id: room.id, book_id: ids.book, cycle_id: ids.otherCycle,
        participant_id: ids.otherParticipant, reward_option_id: ids.reward, status: 'requested',
        reward_title_snapshot: tables.stamp_book_reward_options[0].title, claimed_at: now,
      })
      return json(ids.claim)
    }
    if (table === 'pointplus_process_stamp_book_claim') {
      const { p_claim, p_decision } = calls.at(-1).payload
      const claim = tables.stamp_book_claims.find(entry => entry.id === p_claim)
      if (!claim) return json({ message: 'Claim not found' }, 404)
      claim.status = p_decision
      return json(null)
    }
    if (table === 'pointplus_create_invite') return json(inviteToken)
    if (table === 'pointplus_accept_invite' && !inviteUsed && calls.at(-1).payload.p_token === inviteToken) {
      inviteUsed = true
      return json(room.id)
    }
    return json({ message: 'Unexpected RPC in fixture', code: 'P0001' }, 400)
  }
  if (!Object.hasOwn(tables, table) || (request.method !== 'GET' && !(table === 'notifications' && request.method === 'PATCH'))) return json({ message: 'Unsupported fixture request' }, 404)
  let rows = tables[table]
  for (const [field, filter] of url.searchParams) {
    if (filter.startsWith('eq.')) rows = rows.filter(row => String(row[field]) === filter.slice(3))
    if (filter === 'is.null') rows = rows.filter(row => row[field] == null)
    if (filter.startsWith('in.(')) rows = rows.filter(row => filter.slice(4, -1).split(',').includes(row[field]))
  }
  if (request.method === 'PATCH') for (const row of rows) row.read_at = now
  if (request.headers.prefer?.includes('count=exact')) response.setHeader('content-range', '0-0/' + rows.length)
  return json(request.headers.accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows)
})
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve))
const port = Number(process.env.POINTPLUS_TEST_PORT ?? 3400)
const base = 'http://127.0.0.1:' + port
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:' + fixture.address().port, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-browser-fixture', NEXT_PUBLIC_APP_URL: base, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'inherit', 'inherit'],
})
const root = '/s/' + ids.room
const library = root + '/stamp-books'
const detail = library + '/' + ids.book
const screenshots = process.env.POINTPLUS_SCREENSHOTS
const axeSource = process.env.POINTPLUS_AXE
let browser
try {
  for (let attempts = 0; ; attempts++) {
    if (next.exitCode !== null || attempts > 60) throw new Error('Next.js fixture server did not start')
    try {
      const response = await new Promise((resolve, reject) => get(base + '/login', resolve).on('error', reject))
      response.resume()
      if (response.statusCode === 200) break
    } catch {}
    await setTimeout(500)
  }
  browser = await chromium.launch({ executablePath: process.env.POINTPLUS_CHROMIUM ?? '/usr/bin/chromium', args: ['--no-sandbox'] })
  const context = await browser.newContext({ reducedMotion: 'reduce', locale: 'th-TH', hasTouch: true })
  await context.addInitScript(() => {
    window.pointplusMeasures = { start: [], end: [], shifts: 0 }
    for (const [event, state] of [['animationstart', 'start'], ['animationend', 'end']]) {
      document.addEventListener(event, ({ animationName, elapsedTime }) => {
        if (animationName.startsWith('pointplus-')) {
          window.pointplusMeasures[state].push({ animationName, elapsedMs: Math.round(elapsedTime * 1000), at: performance.now() })
        }
      })
    }
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.pointplusMeasures.shifts += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  async function screenshot(name) {
    if (!screenshots) return
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: resolve(screenshots, name + '.png'), fullPage: true, style: 'nextjs-portal { display: none }',
    })
  }
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + '/rooms')
  assert.equal(new URL(page.url()).pathname, '/login')
  await page.keyboard.press('Tab')
  await page.locator('.skip-link:focus').waitFor()
  await page.keyboard.press('Enter')
  assert.equal(new URL(page.url()).hash, '#main-content')

  const toBase64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const encoded = toBase64({ alg: 'HS256', typ: 'JWT' }) + '.' + toBase64({ sub: ids.user, exp, role: 'authenticated' })
  const signature = createHmac('sha256', 'local-fixture-only').update(encoded).digest('base64url')
  const session = {
    access_token: encoded + '.' + signature,
    refresh_token: 'local-fixture-only',
    expires_at: exp,
    user: authUser,
  }
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + toBase64(session), url: base }])
  await page.goto(base + '/rooms')
  await page.getByRole('link', { name: /บ้านของเรา/ }).click()
  await page.getByRole('heading', { name: 'สมุดของเรา' }).waitFor()
  await page.goto(base + '/rooms')
  await page.getByRole('link', { name: /กลับเข้าห้องล่าสุด/ }).waitFor()
  if (screenshots) await mkdir(screenshots, { recursive: true })
  const publicContext = await browser.newContext({ reducedMotion: 'reduce', locale: 'th-TH' })
  const publicPage = await publicContext.newPage()
  publicPage.on('pageerror', error => errors.push(error.message))
  const views = [
    ['/rooms', 'ห้องของฉัน', 'rooms'],
    [root, 'สมุดของเรา', 'room-home'],
    [library, 'สมุดสะสมของเรา', 'library'],
    [library + '/new', 'สร้างสมุดเล่มใหม่', 'wizard'],
    [detail, firstBook.title, 'journal'],
    [root + '/members', 'สมาชิกของพื้นที่', 'members'],
    [root + '/settings', 'ตั้งค่าห้อง', 'settings'],
    ['/profile', 'โปรไฟล์ของฉัน', 'profile'],
    ['/notifications', 'การแจ้งเตือน', 'notifications'],
    ['/join', 'เข้าร่วมพื้นที่', 'join'],
  ]
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await publicPage.setViewportSize({ width, height: 900 })
    for (const [path, selector] of [['/', '#hero-heading'], ['/login', '#main-content input[type=password]']]) {
      await publicPage.goto(base + path)
      await publicPage.locator(selector).waitFor()
      assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path + ' overflows at ' + width)
    }
    for (const [path, title, filename] of views) {
      await page.goto(base + path)
      await page.getByRole('heading', { name: title, exact: true }).first().waitFor()
      assert.ok(await page.evaluate(() => {
        const main = document.querySelector('.app-main')
        return document.documentElement.scrollWidth <= window.innerWidth && (!main || main.scrollWidth <= main.clientWidth)
      }), filename + ' overflows at ' + width)
      if (path !== '/join') {
        const links = await page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link').all()
        for (const link of links) assert.ok((await link.boundingBox()).height >= 44)
        if (width <= 800) {
          const main = await page.locator('.app-main').boundingBox()
          const nav = await page.getByRole('navigation', { name: 'เมนูหลัก' }).boundingBox()
          assert.ok(main.y + main.height <= nav.y, 'Mobile navigation overlaps ' + filename)
        }
      }
      if (axeSource && width === 390) {
        await page.addScriptTag({ path: axeSource })
        const violations = await page.evaluate(async () => {
          const { violations } = await window.axe.run('body', {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
            exclude: ['nextjs-portal'],
          })
          return violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))
        })
        assert.deepEqual(violations, [], 'Accessibility checks for ' + filename)
      }
      if (screenshots && ((width === 390 && !['members', 'notifications', 'join'].includes(filename)) || (width === 1440 && ['library', 'journal'].includes(filename)))) {
        await screenshot(filename + '-' + width)
        if (filename === 'journal' && width === 390) {
          await page.locator('.journal-spread').first().scrollIntoViewIfNeeded()
          await screenshot('journal-spread-390')
        }
      }
    }
    console.log('Layout checks passed at ' + width + 'px')
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + library)
  for (const [name, expected] of [['มะลิ', 2], ['ใบบัว', 0]]) {
    const value = await page.getByRole('progressbar', { name: 'แสตมป์ของ ' + name }).getAttribute('value')
    assert.equal(Number(value), expected)
  }
  await page.getByText(/สมุดเก็บถาวร/).click()
  await page.getByRole('link', { name: 'เปิดสมุด สมุดวันหยุด' }).click()
  await page.getByRole('heading', { name: 'สมุดวันหยุด', exact: true }).waitFor()
  await page.waitForFunction(() => {
    const main = document.querySelector('.app-main')
    const title = main?.querySelector('.stamp-book-detail-head h2')
    return title && title.getBoundingClientRect().top >= main.getBoundingClientRect().top
  })
  await page.goto(base + library + '/new')
  await page.getByRole('button', { name: 'ถัดไป' }).click()
  await page.locator('#stamp-book-title:focus').waitFor()
  await page.getByLabel('ชื่อสมุด').fill('สมุดทดสอบ')
  await page.getByLabel('ลายบนปก').selectOption('family-books')
  await page.getByRole('button', { name: 'ถัดไป' }).click()
  await page.getByRole('heading', { name: 'ผู้สะสมและแสตมป์' }).waitFor()
  await page.getByText('มะลิ', { exact: true }).first().click()
  await page.getByRole('button', { name: 'ถัดไป' }).click()
  await page.getByRole('alert').getByText(/ผู้สะสม/).waitFor()
  await page.getByText('มะลิ', { exact: true }).first().click()
  await page.getByRole('button', { name: 'ถัดไป' }).click()
  await page.getByRole('heading', { name: 'รางวัลและตรวจสอบ' }).waitFor()
  await page.getByLabel('ตัวเลือกรางวัล').fill('เลือกหนังดูด้วยกัน\nทำอาหารมื้อพิเศษ')
  await screenshot('wizard-review-390')
  assert.equal(calls.length, 0)
  await page.getByRole('button', { name: 'ย้อนกลับ' }).click()
  assert.equal(await page.locator('[name=recipient_id]').first().isChecked(), true)
  await page.getByRole('button', { name: 'ถัดไป' }).click()
  const submit = page.getByRole('button', { name: 'ยืนยันสร้างสมุด' })
  await submit.evaluate(button => {
    button.form.requestSubmit(button)
    button.form.requestSubmit(button)
  })
  await page.getByRole('alert').getByText(/สร้างสมุดไม่สำเร็จ/).waitFor()
  assert.equal(calls.length, 1)
  assert.equal(new URL(page.url()).pathname, library + '/new')
  await submit.click()
  await page.waitForURL(base + detail)
  assert.equal(calls.length, 2)
  for (const { rpc, payload } of calls) {
    assert.equal(rpc, 'pointplus_create_stamp_book')
    assert.equal(payload.p_styles[0], 'family-books')
    assert.deepEqual(payload.p_rewards, ['เลือกหนังดูด้วยกัน', 'ทำอาหารมื้อพิเศษ'])
    assert.deepEqual(payload.p_recipients, [ids.participant])
  }

  const journal = page.getByRole('article', { name: 'มะลิ', exact: true })
  const spread = journal.locator('.journal-spread')
  const slots = journal.locator('.journal-slots')
  const nextLeaf = journal.getByRole('button', { name: 'หน้าถัดไป' })
  const previousLeaf = journal.getByRole('button', { name: 'หน้าก่อน' })
  await journal.getByText('ขอบคุณที่อ่านด้วยกัน', { exact: true }).waitFor()
  assert.equal(await spread.locator('.journal-slot').count(), 6)
  const initialHeight = (await spread.boundingBox()).height
  await nextLeaf.click()
  await journal.getByText('หน้า 2 / 2', { exact: true }).waitFor()
  assert.equal(await spread.locator('.journal-slot').count(), 2)
  assert.equal((await spread.boundingBox()).height, initialHeight)
  assert.equal(await spread.evaluate(el => el.getAnimations({ subtree: true }).length), 0)
  await nextLeaf.press('ArrowLeft')
  await journal.getByText('หน้า 1 / 2', { exact: true }).waitFor()
  assert.equal(await nextLeaf.evaluate(el => el === document.activeElement), true)
  await previousLeaf.press('End')
  await journal.getByText('หน้า 2 / 2', { exact: true }).waitFor()
  await previousLeaf.press('Home')
  await journal.getByText('หน้า 1 / 2', { exact: true }).waitFor()

  await slots.scrollIntoViewIfNeeded()
  const box = await slots.boundingBox()
  const x = Math.round(box.x + box.width * .8)
  const y = Math.round(box.y + box.height * .24)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 80, y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await journal.getByText('หน้า 2 / 2', { exact: true }).waitFor()
  await cdp.detach()
  await journal.getByLabel('รอบสะสม').selectOption(ids.pastCycle)
  await journal.getByText('ความทรงจำรอบแรก', { exact: true }).waitFor()
  await journal.getByLabel('รอบสะสม').selectOption(ids.cycle)

  const give = page.getByRole('button', { name: '+ ให้แสตมป์' })
  await give.click()
  await page.getByRole('dialog').waitFor()
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true)
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.locator('button:focus').filter({ hasText: 'ให้แสตมป์' }).waitFor()
  await give.click()
  await page.getByLabel(/ข้อความสั้น/).fill('ข้อความทดสอบ')
  await screenshot('give-stamp-390')
  await page.getByRole('button', { name: 'ส่งคำขอแสตมป์' }).click()
  await page.getByText('ส่งคำขอแล้ว · รออนุมัติ', { exact: true }).waitFor()
  assert.equal(await journal.getByRole('progressbar').getAttribute('value'), '2')
  assert.equal(await page.locator('[data-impact]').count(), 0)
  assert.equal(calls.at(-1).rpc, 'pointplus_give_stamp')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const openCycle = tables.stamp_book_cycles.find(cycle => cycle.id === ids.cycle)
  openCycle.progress_count = 7
  for (let index = 2; index < 7; index++) {
    tables.stamp_book_marks.push({
      id: 'setup-' + index, request_id: 'existing-' + index, book_id: ids.book, cycle_id: ids.cycle,
      participant_id: ids.participant, asset_id: 'family-books', giver_user_id: ids.user, stamped_at: now, note: null,
    })
  }
  firstBook.approval_policy = 'direct'
  await page.goto(base + detail)
  await page.waitForFunction(() => window.pointplusMeasures.end.some(event => event.animationName === 'pointplus-leaf-turn'))
  await nextLeaf.click()
  await page.waitForFunction(() => window.pointplusMeasures.end.filter(event => event.animationName === 'pointplus-leaf-turn').length === 2)
  await previousLeaf.click()
  await page.waitForFunction(() => window.pointplusMeasures.end.filter(event => event.animationName === 'pointplus-leaf-turn').length === 3)

  forcedStampResult = 'rejected'
  await give.click()
  await page.getByRole('button', { name: 'ยืนยันให้ 1 ดวง' }).click()
  await page.getByRole('alert').getByText('คำขอแสตมป์ถูกปฏิเสธ').waitFor()
  assert.equal(await journal.getByRole('progressbar').getAttribute('value'), '7')
  assert.equal(await page.locator('[data-impact]').count(), 0)

  forcedStampResult = 'denied'
  await give.click()
  await page.getByRole('button', { name: 'ยืนยันให้ 1 ดวง' }).click()
  await page.getByRole('alert').getByText('บัญชีนี้ไม่มีสิทธิ์ให้แสตมป์แก่ผู้สะสมคนนี้').waitFor()
  assert.equal(await journal.getByRole('progressbar').getAttribute('value'), '7')
  assert.equal(await page.locator('[data-impact]').count(), 0)

  await page.getByLabel(/ข้อความสั้น/).fill('แสตมป์ดวงสุดท้าย')
  const giveKey = await page.locator('dialog [name=idempotency_key]').inputValue()
  await page.getByRole('button', { name: 'ยืนยันให้ 1 ดวง' }).click()
  await journal.getByText('หน้า 2 / 2', { exact: true }).waitFor()
  await journal.locator('[data-impact] .journal-slot__art').waitFor()
  await journal.getByText('แสตมป์ดวงสุดท้าย', { exact: true }).waitFor()
  assert.equal(await journal.getByRole('progressbar').getAttribute('value'), '8')
  assert.equal(await journal.getByLabel('รอบสะสม').inputValue(), ids.cycle)
  assert.equal(await journal.locator('[data-impact] .journal-slot__number').textContent(), '08')
  assert.equal(await journal.locator('[data-celebrate]').count(), 1)
  await page.waitForFunction(() => window.pointplusMeasures.end.some(event => event.animationName === 'pointplus-stamp-impact'))
  const impactMeasures = await page.evaluate(() => window.pointplusMeasures)
  assert.equal(impactMeasures.end.find(event => event.animationName === 'pointplus-stamp-impact').elapsedMs, 450)
  assert.equal(impactMeasures.end.find(event => event.animationName === 'pointplus-leaf-turn').elapsedMs, 600)
  assert.ok(impactMeasures.shifts <= .01, 'Unexpected layout shift while applying a confirmed stamp')
  await screenshot('completed-cycle-390')
  await journal.getByLabel('รอบสะสม').selectOption(ids.nextCycle)
  assert.equal(await journal.getByRole('progressbar').getAttribute('value'), '0')
  await journal.getByLabel('รอบสะสม').selectOption(ids.cycle)
  assert.equal(await journal.locator('[data-impact]').count(), 0)
  const callsBeforeReplay = calls.length
  await give.click()
  await page.getByLabel(/ข้อความสั้น/).fill('แสตมป์ดวงสุดท้าย')
  await page.getByRole('button', { name: 'ยืนยันให้ 1 ดวง' }).evaluate((submit, key) => {
    submit.form.elements.namedItem('idempotency_key').value = key
    submit.form.requestSubmit(submit)
  }, giveKey)
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(calls.length, callsBeforeReplay + 1)
  await page.getByText('เพิ่มแสตมป์ 1 ดวงแล้ว', { exact: true }).waitFor()
  assert.equal(calls.at(-1).payload.p_key, giveKey)
  assert.equal(await journal.locator('[data-impact]').count(), 0)
  assert.equal(await journal.getByRole('progressbar').getAttribute('value'), '8')

  const complete = tables.stamp_book_cycles.find(cycle => cycle.id === ids.otherCycle)
  Object.assign(complete, { progress_count: complete.target_snapshot, completed_at: now })
  await page.goto(base + detail)
  const reward = page.getByRole('radio', { name: /เลือกหนังดูด้วยกัน/ })
  await reward.check()
  await screenshot('reward-selection-390')
  await page.getByRole('button', { name: 'ยืนยันขอรางวัล' }).click()
  await page.getByText('รางวัล: เลือกหนังดูด้วยกัน · รอส่งมอบ', { exact: true }).waitFor()
  await page.locator('[data-status="requested"] [data-reveal="requested"]').waitFor()
  assert.equal(await page.locator('[data-reveal="fulfilled"]').count(), 0)
  await page.waitForFunction(() => window.pointplusMeasures.end
    .some(event => event.animationName === 'pointplus-reward-lid' && event.elapsedMs === 900))
  assert.deepEqual(
    Object.fromEntries(Object.entries(calls.at(-1).payload).filter(([key]) => key !== 'p_key')),
    { p_cycle: ids.otherCycle, p_reward: ids.reward },
  )
  await page.getByRole('button', { name: 'ส่งมอบแล้ว', exact: true }).click()
  await page.getByText('รางวัล: เลือกหนังดูด้วยกัน · ส่งมอบแล้ว', { exact: true }).waitFor()
  await page.locator('[data-status="fulfilled"] [data-reveal="fulfilled"]').waitFor()
  assert.equal(calls.at(-1).rpc, 'pointplus_process_stamp_book_claim')
  await page.waitForFunction(() => window.pointplusMeasures.end.filter(event => event.animationName === 'pointplus-reward-lid').length >= 2)
  const rewardMeasures = await page.evaluate(() => window.pointplusMeasures)
  assert.ok(rewardMeasures.shifts <= .01, 'Unexpected layout shift during reward reveal')
  await screenshot('reward-fulfilled-390')

  tables.stamp_book_claims.push({
    ...tables.stamp_book_claims[0], id: ids.otherClaim, cycle_id: ids.cycle,
    participant_id: ids.participant, reward_title_snapshot: 'เลือกกิจกรรมวันหยุด', status: 'requested',
  })
  await page.goto(base + detail)
  await journal.getByLabel('รอบสะสม').selectOption(ids.cycle)
  assert.equal(await page.locator('[data-reveal]').count(), 0)
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click()
  await journal.getByText('รางวัล: เลือกกิจกรรมวันหยุด · ยกเลิก', { exact: true }).waitFor()
  assert.equal(calls.at(-1).payload.p_claim, ids.otherClaim)
  assert.equal(await page.locator('[data-reveal]').count(), 0)
  function wallTime(metrics, name, occurrence = 0) {
    const started = metrics.start.filter(event => event.animationName === name)[occurrence]
    const ended = metrics.end.filter(event => event.animationName === name)[occurrence]
    return Math.round(ended.at - started.at)
  }
  console.log('Motion measurements: ' + JSON.stringify({
    openingMs: wallTime(impactMeasures, 'pointplus-leaf-turn'),
    turnMs: wallTime(impactMeasures, 'pointplus-leaf-turn', 1),
    impactMs: wallTime(impactMeasures, 'pointplus-stamp-impact'),
    rewardMs: wallTime(rewardMeasures, 'pointplus-reward-lid'),
    stampLayoutShift: impactMeasures.shifts, rewardLayoutShift: rewardMeasures.shifts,
  }))

  await page.goto(base + root + '/members')
  await page.getByRole('button', { name: 'สร้างลิงก์เชิญ' }).click()
  const invite = base + '/join#token=' + inviteToken
  assert.equal(await page.locator('#invite-link').inputValue(), invite)
  await page.getByRole('button', { name: 'คัดลอกลิงก์', exact: true }).click()
  await page.getByText('คัดลอกลิงก์เชิญแล้ว', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), invite)
  await page.goto(invite)
  await page.waitForURL(base + '/join')
  await page.getByRole('button', { name: 'ยอมรับคำเชิญ' }).click()
  await page.getByRole('link', { name: 'เปิดพื้นที่' }).waitFor()
  await page.goto(base + '/join')
  await page.getByLabel('วางลิงก์หรือรหัสคำเชิญ').fill(invite)
  await page.getByRole('button', { name: 'ยอมรับคำเชิญ' }).click()
  await page.getByRole('alert').getByText(/ลิงก์อาจหมดอายุ/).waitFor()
  assert.equal(page.url(), base + '/join')

  await page.goto(base + '/notifications')
  await page.getByRole('button', { name: 'ทำเครื่องหมายว่าอ่านแล้ว' }).click()
  await page.getByText('อ่านแล้ว', { exact: true }).waitFor()
  await page.goto(base + '/s/ffffffff-ffff-4fff-8fff-ffffffffffff')
  await page.getByRole('heading', { name: 'เปิดห้องหรือสมุดนี้ไม่ได้' }).waitFor()
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log('Fixture checks passed for keyboard, touch, reduced motion, historical and repeat cycles, wizard validation and retry, dialog focus, pending, rejected and denied stamps, exact confirmed placement and harmless replay, reward request, fulfillment and cancellation, invitation copy and join, and notification read state.')
} finally {
  await browser?.close()
  next.kill()
  fixture.closeAllConnections()
  await new Promise(resolve => fixture.close(resolve))
}
