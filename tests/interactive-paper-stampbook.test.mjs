import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const code = ts.transpileModule(read('features/stamp-books/paper-model.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
new Function('exports', code)(module.exports)
const { paperPageCount, legacyPaperPosition, normalizedPaperPosition, deterministicRotation } = module.exports

test('a sheet has one page, a notebook preserves six-stamp historical paging', () => {
  assert.equal(paperPageCount(1, 'single_sheet'), 1)
  assert.equal(paperPageCount(100, 'single_sheet'), 1)
  assert.equal(paperPageCount(6, 'notebook'), 1)
  assert.equal(paperPageCount(7, 'notebook'), 2)
  assert.equal(paperPageCount(100, 'notebook'), 17)
})
test('positions are stable, deterministic and within the page', () => {
  assert.deepEqual(legacyPaperPosition(0), legacyPaperPosition(0))
  assert.equal(legacyPaperPosition(6).pageIndex, 1)
  assert.ok(legacyPaperPosition(8).x > 0)
  assert.ok(legacyPaperPosition(8).x < 1)
  assert.equal(deterministicRotation(.23,.72), deterministicRotation(.23,.72))
})
test('normalizes pointer positions across screen sizes, clamping away from page edges', () => {
  const mobile = normalizedPaperPosition(200,300,{left:100,top:100,width:200,height:400})
  const desktop = normalizedPaperPosition(400,600,{left:200,top:200,width:400,height:800})
  assert.deepEqual(mobile, desktop)
  assert.deepEqual(mobile, {x:.5,y:.5})
  assert.deepEqual(normalizedPaperPosition(-20,-10,{left:0,top:0,width:300,height:300}),{x:.1,y:.1})
  assert.equal(normalizedPaperPosition(5,5,{left:0,top:0,width:0,height:300}),null)
})
test('new RPCs preserve old contracts and copy approved request positions', () => {
  const sql=read('supabase/stamp-book-first/12_interactive_paper_stampbook.sql')
  assert.match(sql,/pointplus_give_stamp_at/)
  assert.match(sql,/pointplus_create_paper_stamp_book/)
  assert.match(sql,/pointplus_private\.book_copy_paper_position/)
  assert.match(sql,/public\.pointplus_give_stamp\(p_book, p_recipient, p_art, p_note, p_key\)/)
  assert.match(sql,/p_key uuid/)
  assert.match(sql,/rotation_deg/)
  assert.doesNotMatch(sql,/\bTRUNCATE\b|\bDROP TABLE\b|\bDELETE FROM\b/i)
})
test('new UI uses pointer placement and original approval and claim actions', () => {
  const paper=read('features/stamp-books/paper.tsx')
  assert.match(paper,/onPointerDown=\{pointerDown\}/)
  assert.match(paper,/onPointerUp=\{pointerUp\}/)
  assert.match(paper,/crypto\.randomUUID\(\)/)
  assert.match(paper,/useBookAction\(giveStampAction\)/)
  const journal=read('features/stamp-books/journal.tsx')
  assert.match(journal,/StampPaper/)
  assert.match(journal,/rewardContent\[cycle\.id\]/)
  const actions=read('features/stamp-books/actions.ts')
  assert.match(actions,/pointplus_give_stamp_at/)
  assert.match(actions,/pointplus_claim_couple_memory/)
})
