import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const modelSource = readFileSync(new URL('../features/stamp-books/journal-model.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(modelSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const module = { exports: {} }
new Function('exports', compiled.outputText)(module.exports)
const { pageCount, stampPage, locateActivity } = module.exports

test('journal pages paginate stored slots without inventing slots on the last leaf', () => {
  assert.equal(pageCount(1), 1)
  assert.equal(pageCount(6), 1)
  assert.equal(pageCount(7), 2)
  assert.deepEqual(stampPage(8, 0), [0, 1, 2, 3, 4, 5])
  assert.deepEqual(stampPage(8, 1), [6, 7])
  assert.equal(pageCount(100), 17)
  assert.deepEqual(stampPage(100, 16), [96, 97, 98, 99])
})

test('impact points to the recorded slot, even after a repeat cycle has opened', () => {
  const completed = {
    id: 'finished',
    target_snapshot: 8,
    completed_at: '2026-11-20T00:00:00Z',
    marks: Array.from({ length: 8 }, (_, slot) => ({ request_id: 'request-' + slot })),
  }
  const cycles = [{ id: 'next', target_snapshot: 8, marks: [] }, completed]
  assert.equal(locateActivity(cycles, { kind: 'stamp', id: 'uncommitted' }), undefined)
  assert.deepEqual(locateActivity(cycles, { kind: 'stamp', id: 'request-7' }), {
    cycleId: 'finished', page: 1, completedByStamp: true,
  })
  assert.deepEqual(locateActivity(cycles, { kind: 'stamp', id: 'request-2' }), {
    cycleId: 'finished', page: 0, completedByStamp: false,
  })
})

test('reward receipt matches its own cycle and status before revealing', () => {
  const requested = [{ id: 'cycle', claim: { id: 'claim', status: 'requested' } }]
  assert.equal(locateActivity(requested, { kind: 'fulfilled', id: 'claim' }), undefined)
  assert.equal(locateActivity(requested, { kind: 'requested', id: 'other-cycle' }), undefined)
  assert.deepEqual(locateActivity(requested, { kind: 'requested', id: 'cycle' }), { cycleId: 'cycle' })

  const fulfilled = [{ id: 'cycle', claim: { id: 'claim', status: 'fulfilled' } }]
  assert.equal(locateActivity(fulfilled, { kind: 'requested', id: 'cycle' }), undefined)
  assert.deepEqual(locateActivity(fulfilled, { kind: 'fulfilled', id: 'claim' }), { cycleId: 'cycle' })

  const canceled = [{ id: 'cycle', claim: { id: 'claim', status: 'canceled' } }]
  assert.equal(locateActivity(canceled, { kind: 'requested', id: 'cycle' }), undefined)
  assert.equal(locateActivity(canceled, { kind: 'fulfilled', id: 'claim' }), undefined)
})
