import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/section-header'
import { canManage } from '@/features/spaces/data'
import { loadStampBookBoard } from '@/features/stamp-books/data'
import { BookShelf } from '@/features/stamp-books/presentation'

export const metadata: Metadata = { title: 'สมุดสะสมแสตมป์' }

export default async function StampBooksPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  const { context, books, cycles, eligible } = await loadStampBookBoard(spaceId)
  const manager = context.space.kind==='couple' || canManage(context.member.role)
  const current = books.filter(book => book.status !== 'archived')
  const archive = books.filter(book => book.status === 'archived')
  const base = '/s/' + spaceId + '/stamp-books'
  const create = manager && <Link href={base + '/new'} className="button button--primary">สร้างสมุดใหม่</Link>

  return <section className="stamp-book-page">
    <SectionHeader title="สมุดสะสมของเรา" actions={current.length > 0 && create}/>
    {current.length > 0
      ? <BookShelf books={current} cycles={cycles} people={eligible} base={base}/>
      : <div className="card empty-state">
        <h3>ยังไม่มีสมุดที่เปิดอยู่</h3>
        {create}
      </div>}
    {archive.length > 0 && <details className="stamp-book-archive">
      <summary>สมุดเก็บถาวร ({archive.length})</summary>
      <BookShelf books={archive} cycles={cycles} people={eligible} base={base}/>
    </details>}
  </section>
}
