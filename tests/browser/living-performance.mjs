import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const playwright = process.env.POINTPLUS_PLAYWRIGHT_CORE
const origin = process.env.POINTPLUS_LIVING_URL
assert.ok(playwright && origin, 'Set POINTPLUS_PLAYWRIGHT_CORE and POINTPLUS_LIVING_URL to a local production build')
const { chromium } = await import(pathToFileURL(playwright))
const browser = await chromium.launch({ executablePath: process.env.POINTPLUS_CHROMIUM ?? '/usr/bin/chromium', args: ['--no-sandbox'] })

try {
  for (const [label, width, height, mobile] of [['desktop', 1440, 1000, false], ['mobile', 390, 844, true]]) {
    const samples = []
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile })
      const page = await context.newPage()
      await page.addInitScript(() => {
        const measures = window.livingMeasures = { lcp: 0, cls: 0, interactions: {}, coverFrames: [], coverReady: false }
        let clsStart = 0
        let lastShift = 0
        let clsWindow = 0
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) measures.lcp = entry.startTime
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue
            if (entry.startTime - lastShift > 1000 || entry.startTime - clsStart > 5000) {
              clsWindow = 0
              clsStart = entry.startTime
            }
            clsWindow += entry.value
            measures.cls = Math.max(measures.cls, clsWindow)
            lastShift = entry.startTime
          }
        }).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (!entry.interactionId) continue
            measures.interactions[entry.interactionId] =
              Math.max(entry.duration, measures.interactions[entry.interactionId] ?? 0)
          }
        }).observe({ type: 'event', durationThreshold: 16 })

        document.addEventListener('transitionstart', event => {
          if (!event.target.matches('[data-book-cover]') || event.propertyName !== 'transform' || measures.coverReady) return
          let previous
          const frame = time => {
            if (measures.coverReady) return
            if (previous !== undefined) measures.coverFrames.push(time - previous)
            previous = time
            requestAnimationFrame(frame)
          }
          requestAnimationFrame(frame)
        })
        document.addEventListener('transitionend', event => {
          if (event.target.matches('[data-book-cover]') && event.propertyName === 'transform') measures.coverReady = true
        })
      })
      if (mobile) {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await cdp.send('Network.enable')
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
          downloadThroughput: 200000, uploadThroughput: 90000 })
      }

      await page.goto(origin, { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(450)
      const initial = await page.evaluate(() => {
        const sum = test => performance.getEntriesByType('resource').filter(test)
          .reduce((total, entry) => total + entry.encodedBodySize, 0)
        const navigation = performance.getEntriesByType('navigation')[0]
        return {
          responseMs: Math.round(navigation.responseStart), loadMs: Math.round(navigation.loadEventEnd),
          jsBytes: sum(entry => /\.js(?:\?|$)/.test(entry.name)),
          cssBytes: sum(entry => /\.css(?:\?|$)/.test(entry.name)),
          fontBytes: sum(entry => entry.name.includes('/fonts/')),
          imageBytes: sum(entry => entry.initiatorType === 'img'),
        }
      })

      const open = page.getByRole('button', { name: 'เปิดสมุดดู' })
      if (await open.count()) {
        if (mobile) await open.tap()
        else await open.click()
        await page.waitForFunction(() => window.livingMeasures.coverReady)
        await page.getByRole('button', { name: 'หน้าถัดไป' }).press('Enter')
        await page.getByRole('button', { name: 'ลองประทับแสตมป์' }).click()
        await page.getByText('ประทับแสตมป์ในตัวอย่างแล้ว', { exact: true }).waitFor()
        await page.waitForTimeout(450)
      }

      const visual = await page.evaluate(() => {
        const { lcp, cls, interactions, coverFrames } = window.livingMeasures
        const frames = coverFrames.toSorted((a, b) => a - b)
        const lags = Object.values(interactions)
        return {
          lcpMs: Math.round(lcp), cls: Number(cls.toFixed(4)),
          worstObservedInteractionMs: lags.length ? Math.max(...lags) : null,
          sampledInteractionCount: lags.length,
          coverFrameCount: frames.length,
          coverFrameP95Ms: frames.length ? Number(frames[Math.floor((frames.length - 1) * .95)].toFixed(1)) : null,
        }
      })
      assert.ok(visual.lcpMs > 0, 'Browser did not report an LCP candidate')
      samples.push({ ...initial, ...visual })
      await context.close()
    }
    console.log(label, JSON.stringify(samples))
  }
} finally {
  await browser.close()
}
