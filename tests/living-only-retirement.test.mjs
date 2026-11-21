import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'

const root=new URL('../',import.meta.url)
const read=path=>readFileSync(new URL(path,root),'utf8')
const exists=path=>existsSync(new URL(path,root))
const r='app/(protected)/s/[spaceId]/'
const home=read(r+'page.tsx')
const list=read(r+'stamp-books/page.tsx')
const newBook=read(r+'stamp-books/new/page.tsx')
const studio=read(r+'stamp-books/living/[bookId]/page.tsx')
const form=read('features/living-books/forms.tsx')
const shelf=read('features/living-books/shelf.tsx')
const migration=read('supabase/stamp-book-first/21_retire_legacy_collections_data.sql')

test('All room navigation and creation use Living Stampbook only',()=>{
 for(const code of [home,list,newBook,studio,form,shelf]){
   assert.doesNotMatch(code,/features\/stamp-books\/|loadStampBookBoard|CreateCoupleStampBookForm|CreateStampBookForm|stamp_book_cycles|stamp_book_marks/)
 }
 assert.match(home,/loadLivingBookShelf/)
 assert.match(list,/LivingBookShelf/)
 assert.match(newBook,/CreateLivingBookForm/)
 assert.match(form,/createLivingBookAction/)
 assert.match(form,/AddLivingBookPageForm/)
 assert.doesNotMatch(form,/cardOnly|format==='card'|top_level_format/)
 assert.match(studio,/LivingPaperEditor/)
 assert.match(studio,/LivingRedemptionPanel/)
})
test('Old direct Stamp Card/finite journal routes no longer exist',()=>{
 for(const path of [
   'features/stamp-books/actions.ts','features/stamp-books/forms.tsx',
   'features/stamp-books/data.ts','features/stamp-books/journal.tsx',
   'features/stamp-books/card.tsx','features/stamp-books/paper.tsx',
   'features/stamp-books/sound.tsx',
   r+'stamp-books/[bookId]/page.tsx',
   r+'stamp-books/[bookId]/edit/page.tsx',
   r+'stamp-books/journal.css',
   r+'stamp-books/paper.css',
 ])assert.equal(exists(path),false,path)
 assert.doesNotMatch(read(r+'layout.tsx'),/journal\.css|paper\.css/)
})
test('Production legacy-data cleanup is a transaction with protected exact counts',()=>{
 assert.match(migration,/^BEGIN;/m)
 assert.match(migration,/COMMIT;\s*$/)
 assert.match(migration,/legacy data changed|Legacy data changed/i)
 for(const old of [
 'stamp_book_claims','stamp_book_marks','stamp_book_stamp_requests',
 'stamp_book_cycles','stamp_book_reward_options','stamp_book_styles',
 'stamp_book_givers','stamp_book_recipients','stamp_books','stamp_cards'
 ])assert.match(migration,new RegExp('DELETE FROM public\\.'+old+';'))
 assert.doesNotMatch(migration,/DELETE FROM public\.living_|DROP TABLE public\.living_|DELETE FROM public\.stamp_book_artworks/i)
 assert.match(migration,/SELECT count\(\*\) FROM public\.stamp_book_artworks/)
 assert.match(migration,/REVOKE ALL ON FUNCTION/)
 assert.match(migration,/CREATE OR REPLACE FUNCTION pointplus_private\.after_new_space/)
 assert.match(migration,/CREATE OR REPLACE FUNCTION pointplus_private\.seed_official_asset_catalog/)
 assert.doesNotMatch(migration,/DROP TABLE/)
})
test('Authentication, roles, participant and badge data remain out of cleanup scope',()=>{
 for(const protectedTable of [
 'auth.users','public.spaces','public.space_members','public.participants',
 'public.badge_definitions','public.living_books','public.stamp_book_artworks'
 ]){
   assert.doesNotMatch(migration,new RegExp('DELETE FROM '+protectedTable.replace('.','\\.')+';'))
   assert.doesNotMatch(migration,new RegExp('DROP TABLE '+protectedTable.replace('.','\\.')))
 }
 assert.match(migration,/INSERT INTO public\.space_members/)
 assert.match(migration,/INSERT INTO public\.badge_definitions/)
})
