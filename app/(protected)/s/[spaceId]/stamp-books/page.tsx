import type {Metadata} from 'next'
import Link from 'next/link'
import {SectionHeader} from '@/components/ui/section-header'
import {canManage} from '@/features/spaces/data'
import {loadLivingBookShelf} from '@/features/living-books/data'
import {LivingBookShelf} from '@/features/living-books/shelf'

export const metadata:Metadata={title:'สมุดของเรา'}

export default async function StampBooksPage({params,searchParams}:{
  params:Promise<{spaceId:string}>
  searchParams:Promise<{view?:string|string[]}>
}){
  const [{spaceId},{view}]=await Promise.all([params,searchParams])
  // Do not load the retired Stamp Book board, cycles and participants a second
  // time. Existing historical tables/routes remain untouched.
  const {context,books,people}=await loadLivingBookShelf(spaceId)
  const canCreate=context.space.kind==='couple'||canManage(context.member.role)
  const archive=view==='archive'
  const visible=books.filter(book=>(book.status==='archived')===archive)
  const base='/s/'+spaceId+'/stamp-books'
  return <section className="stamp-book-page">
    <SectionHeader title="สมุดของเรา" actions={canCreate&&
      <Link href={base+'/new'} className="button button--primary">สร้างใหม่</Link>}/>
    <nav className="shelf-nav" aria-label="เลือกสมุด">
      <Link href={base} aria-current={archive?undefined:'page'}>กำลังสะสม</Link>
      <Link href={base+'?view=archive'} aria-current={archive?'page':undefined}>ความทรงจำ</Link>
    </nav>
    {visible.length>0
      ?<LivingBookShelf books={visible} people={people} base={base}/>
      :<div className="card empty-state">
        <h3>{archive?'ยังไม่มีสมุดที่เก็บไว้':'ยังไม่มีสมุดหรือการ์ด'}</h3>
        {!archive&&canCreate&&<Link href={base+'/new'} className="button button--primary">
          สร้างสมุดเล่มแรก
        </Link>}
      </div>}
  </section>
}
