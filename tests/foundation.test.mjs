import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const exists = (path) => existsSync(new URL('../' + path, import.meta.url))

test('replaces the demo with a purposeful PointPlus public page', () => {
  const page = read('app/(public)/page.tsx')
  assert.match(page, /PointPlus/)
  assert.doesNotMatch(page, /\.from\(['"]todos['"]\)/)
  assert.equal(exists('app/page.tsx'), false)
  assert.match(page, /id="spaces"/)
  assert.match(page, /id="how-it-works"/)
})

test('only links to implemented destinations in the protected shell', () => {
  const layout = read('app/(protected)/layout.tsx')
  assert.match(layout, /getClaims\(\)/)
  assert.match(layout, /redirect\('\/login'\)/)
  assert.ok(exists('app/(protected)/dashboard/page.tsx'))
  assert.doesNotMatch(layout, /href="\/(missions|rewards|settings)"/)
})

test('preserves existing Supabase SSR session wiring', () => {
  assert.match(read('proxy.ts'), /updateSession/)
  assert.match(read('utils/supabase/middleware.ts'), /auth\.getClaims\(\)/)
  assert.match(read('utils/supabase/server.ts'), /createServerClient/)
})

test('all artwork referenced on the landing page exists', () => {
  const paths = [
    'public/point-plus/stamps/personal/sunrise.svg',
    'public/point-plus/stamps/personal/target.svg',
    'public/point-plus/stamps/couple/heart.svg',
    'public/point-plus/stamps/family/star.svg',
    'public/point-plus/stamps/family/books.svg',
  ]
  paths.forEach((path) => assert.ok(exists(path), path))
})

test('product copy is non-commercial and does not fabricate mission statistics', () => {
  const page = read('app/(public)/page.tsx')
  const dashboard = read('app/(protected)/dashboard/page.tsx')
  assert.match(page, /ไม่เกี่ยวกับการซื้อขายหรือธุรกิจ/)
  assert.doesNotMatch(dashboard, /point_wallets|point_transactions|\b100\s*แต้ม/)
})
