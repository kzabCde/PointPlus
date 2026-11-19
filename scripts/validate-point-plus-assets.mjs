#!/usr/bin/env node
/** Checks exact original PointPlus asset kit without installing dependencies. */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, extname, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'

const repo = resolve(import.meta.dirname, '..')
const publicDir = resolve(repo, 'public')
const manifestDir = resolve(repo, 'assets/point-plus/manifest')
const modes = new Set(['couple', 'family', 'personal'])
const rarities = new Set(['bronze', 'silver', 'gold', 'diamond'])
const errors = []
const assert = (value, message) => { if (!value) errors.push(message) }
const json = (name) => JSON.parse(readFileSync(resolve(manifestDir, name), 'utf8'))
const stamps = json('stamps.json')
const badges = json('badges.json')
const collections = json('collections.json')
const registry = readFileSync(resolve(repo, 'lib/point-plus/assets.ts'), 'utf8')

function extractRegistry(exportName) {
  const m = registry.match(new RegExp(`export const ${exportName}: \\w+\\[\\] = (\\[[\\s\\S]*?\\]);`))
  if (!m) { errors.push(`Registry export missing: ${exportName}`); return [] }
  try { return JSON.parse(m[1]) } catch (error) {
    errors.push(`Invalid ${exportName} data: ${error.message}`)
    return []
  }
}

function allFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) return allFiles(path)
    if (!entry.isFile()) { errors.push(`Unexpected non-file: ${path}`); return [] }
    return [path]
  })
}

const assetsDir = resolve(publicDir, 'point-plus')
const files = allFiles(assetsDir)
const expectedPaths = new Set()
const uniqueAssetIds = new Set()
const totalByKindAndMode = new Map()

for (const [kind, items, expected] of [['stamps', stamps, 18], ['badges', badges, 12]]) {
  assert(Array.isArray(items), `${kind} manifest must be an array`)
  assert(items.length === expected, `Expected ${expected} ${kind}, received ${items.length}`)
  for (const item of items) {
    const label = `${kind}/${item.id}`
    assert(typeof item.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), `${label}: invalid id`)
    assert(!uniqueAssetIds.has(item.id), `${label}: duplicate asset ID`)
    uniqueAssetIds.add(item.id)
    assert(modes.has(item.mode), `${label}: invalid mode`)
    assert(item.id.startsWith(`${item.mode}-`), `${label}: ID prefix does not match mode`)
    assert(typeof item.name === 'string' && item.name.trim(), `${label}: missing English name`)
    assert(typeof item.nameTh === 'string' && item.nameTh.trim(), `${label}: missing Thai name`)
    if (kind === 'badges') assert(rarities.has(item.rarity), `${label}: invalid rarity`)
    const key = `${kind}/${item.mode}`
    totalByKindAndMode.set(key, (totalByKindAndMode.get(key) || 0) + 1)
    for (const ext of ['svg', 'png']) {
      const url = item[ext]
      assert(typeof url === 'string' && url.startsWith(`/point-plus/${kind}/${item.mode}/`) && url.endsWith(`.${ext}`), `${label}: invalid ${ext} URL`)
      if (typeof url !== 'string' || !url.startsWith('/point-plus/')) continue
      const target = resolve(publicDir, '.' + url)
      assert(target.startsWith(assetsDir + sep), `${label}: asset reference escapes public/point-plus`)
      if (target.startsWith(assetsDir + sep)) {
        expectedPaths.add(target)
        try { assert(statSync(target).isFile(), `${label}: missing file at ${url}`) }
        catch { errors.push(`${label}: missing file at ${url}`) }
      }
    }
  }
}

for (const mode of modes) {
  assert(totalByKindAndMode.get(`stamps/${mode}`) === 6, `${mode}: expected 6 stamps`)
  assert(totalByKindAndMode.get(`badges/${mode}`) === 4, `${mode}: expected 4 badges`)
}

assert(Array.isArray(collections) && collections.length === 3, 'Expected 3 collections')
const collectionIds = new Set()
for (const collection of collections) {
  assert(modes.has(collection.id), `Invalid collection mode: ${collection.id}`)
  assert(!collectionIds.has(collection.id), `Duplicate collection: ${collection.id}`)
  collectionIds.add(collection.id)
  for (const [kind, entries] of [['stamps', stamps], ['badges', badges]]) {
    const ids = entries.filter((e) => e.mode === collection.id).map((e) => e.id)
    const refs = collection[kind]
    assert(Array.isArray(refs), `${collection.id}: ${kind} list is missing`)
    if (Array.isArray(refs)) {
      assert(refs.length === new Set(refs).size, `${collection.id}: duplicate ${kind} reference`)
      assert(refs.length === ids.length && ids.every((id) => refs.includes(id)), `${collection.id}: ${kind} references differ from manifest`)
    }
  }
}

for (const [exportName, items] of [['pointPlusStamps', stamps], ['pointPlusBadges', badges]]) {
  const records = extractRegistry(exportName)
  assert(records.length === items.length, `Registry ${exportName} has wrong number of records`)
  for (const item of items) {
    const def = records.find((entry) => entry.id === item.id)
    assert(def, `Registry ${exportName} missing ${item.id}`)
    if (def) for (const field of ['id', 'name', 'nameTh', 'mode', 'svg', 'png', ...(exportName === 'pointPlusBadges' ? ['rarity'] : [])]) {
      assert(def[field] === item[field], `Registry mismatch: ${item.id}.${field}`)
    }
  }
}

const counts = { svg: 0, png: 0 }
const shaMap = new Map()
for (const f of files) {
  const ext = extname(f).slice(1).toLowerCase()
  assert(['png', 'svg'].includes(ext), `Unexpected asset file: ${relative(repo, f)}`)
  assert(expectedPaths.has(f), `Unreferenced artwork: ${relative(repo, f)}`)
  if (!(ext in counts)) continue
  counts[ext]++
  const bytes = readFileSync(f)
  const sha = createHash('sha256').update(bytes).digest('hex')
  if (shaMap.has(sha)) errors.push(`Identical asset bytes: ${relative(repo, f)} / ${shaMap.get(sha)}`)
  else shaMap.set(sha, relative(repo, f))
  if (ext === 'png') {
    assert(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), `Invalid PNG signature: ${f}`)
    assert(bytes.length >= 33 && bytes.toString('ascii', 12, 16) === 'IHDR', `No PNG IHDR: ${f}`)
    if (bytes.length >= 33) {
      assert(bytes.readUInt32BE(16) === 512 && bytes.readUInt32BE(20) === 512, `Unexpected PNG dimensions: ${f}`)
      assert(bytes[25] === 6, `Expected PNG RGBA transparency: ${f}`)
    }
  } else {
    const source = bytes.toString('utf8')
    assert(/^\s*<svg\b/.test(source), `Invalid SVG root: ${f}`)
    const dangerous = [
      /<\s*(?:script|foreignObject|iframe|object|embed)\b/i,
      /\bon[a-z]+\s*=/i,
      /\b(?:href|xlink:href|src)\s*=\s*["']\s*(?!#|data:image\/(?:png|gif|jpeg);base64,)[^"']+["']/i,
      /\b(?:javascript|vbscript):/i,
      /<!\s*(?:DOCTYPE|ENTITY)\b/i,
      /@import\b/i,
      /\burl\(\s*(?!['"]?#)[^)]+\)/i,
    ]
    assert(!dangerous.some((re) => re.test(source)), `Potentially unsafe SVG: ${relative(repo, f)}`)
  }
}
assert(counts.svg === 30 && counts.png === 30, `Expected 30 SVG/30 PNG, got ${counts.svg} SVG/${counts.png} PNG`)
assert(expectedPaths.size === 60 && files.length === 60, `Expected exactly 60 referenced assets (found ${expectedPaths.size} refs, ${files.length} files)`)

if (errors.length) {
  console.error(`PointPlus asset validation FAILED (${errors.length} problems):`)
  for (const error of errors) console.error(' - ' + error)
  process.exitCode = 1
} else {
  console.log(`PointPlus asset validation PASSED: 18 stamps, 12 badges, ${counts.svg} SVG, ${counts.png} PNG, 3 JSON manifests, typed registry and safe local URLs.`)
}
