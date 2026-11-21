import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/section-header'
import { canManage } from '@/features/spaces/data'
import { loadStampBookBoard } from '@/features/stamp-books/data'
import { BookShelf } from '@/features/stamp-books/presentation'
import { loadLivingBookShelf } from '@/features/living-books/data'
import { LivingBookShelf } from '@/features/living-books/shelf'

export const metadata: Metadata = { title: 'การ์ดและสมุดสะสมแสตมป์' }

export default async function StampBooksPage({ params, searchParams }: {
  params: Promise<{ spaceId: string }>
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const [{ spaceId }, { view }] = await Promise.all([params, searchParams])
  const [{ context, books, cycles, eligible }, { books: livingBooks, people: livingPeople }] = await Promise.all([
    loadStampBookBoard(spaceId),loadLivingBookShelf(spaceId),
  ])
  const manager = context.space.kind === 'couple' || canManage(context.member.role)
  const archived = view === 'archive'
  const shelf = books.filter(book => (book.status === 'archived') === archived)
  const livingShelf = livingBooks.filter(book => (book.status === 'archived') === archived)
  const base = '/s/' + spaceId + '/stamp-books'
  const create = manager && <Link href={base + '/new'} className="button button--primary">สร้างการสะสมใหม่</Link>

  return <section className="stamp-book-page">
    <SectionHeader title="การ์ดและสมุดสะสมของเรา" actions={(archived || shelf.length > 0 || livingShelf.length > 0) && create}/>
    <nav className="shelf-nav" aria-label="การ์ดและสมุดสะสม">
      <Link href={base} aria-current={archived ? undefined : 'page'}>การสะสมในห้อง</Link>
      <Link href={base + '?view=archive'} aria-current={archived ? 'page' : undefined}>เก็บเป็นความทรงจำ</Link>
    </nav>
    {livingShelf.length>0 && <section className="living-shelf-section" aria-label="Living Stampbooks">
      <h3>สมุดความทรงจำ</h3>
      <LivingBookShelf books={livingShelf} people={livingPeople} base={base}/>
    </section>}
    {shelf.length > 0 && <section className="living-shelf-section" aria-label="การ์ดสะสมเดิม">
      <h3>การ์ดและสมุดแบบเดิม</h3>
      <BookShelf books={shelf} cycles={cycles} people={eligible} base={base}/>
    </section>}
    {shelf.length===0 && livingShelf.length===0 && <div className="card empty-state">
        <h3>{archived ? 'ยังไม่มีการสะสมเก็บถาวร' : 'ยังไม่มีการ์ดหรือสมุดที่เปิดอยู่'}</h3>
        {archived ? <Link href={base} className="button button--secondary">กลับไปการสะสมในห้อง</Link> : create}
      </div>}
  </section>
}
