import type {Metadata} from 'next'
import Link from 'next/link'
import {SectionHeader} from '@/components/ui/section-header'
import {canManage} from '@/features/spaces/data'
import {loadLivingBookShelf} from '@/features/living-books/data'
import {LivingBookShelf} from '@/features/living-books/shelf'

export const metadata:Metadata={title:'สมุดความทรงจำ'}

export default async function LivingBooksPage({params,searchParams}:{
  params:Promise<{spaceId:string}>
  searchParams:Promise<{view?:string|string[]}>
}){
  const [{spaceId},{view}]=await Promise.all([params,searchParams])
  const {context,books,people}=await loadLivingBookShelf(spaceId)
  const manager=context.space.kind==='couple'||canManage(context.member.role)
  const archived=view==='archive'
  const shelf=books.filter(book=>(book.status==='archived')===archived)
  const base='/s/'+spaceId+'/stamp-books'
  const create=manager&&<Link className="button button--primary" href={base+'/new'}>
    + สร้างสมุดความทรงจำ
  </Link>
  return <section className="stamp-book-page">
    <SectionHeader title="สมุดความทรงจำของเรา" actions={create}/>
    <nav className="shelf-nav" aria-label="รายการสมุดความทรงจำ">
      <Link href={base} aria-current={archived?undefined:'page'}>สมุดที่ใช้งาน</Link>
      <Link href={base+'?view=archive'} aria-current={archived?'page':undefined}>เก็บเป็นความทรงจำ</Link>
    </nav>
    {shelf.length>0
      ?<LivingBookShelf books={shelf} people={people} base={base}/>
      :<div className="card empty-state">
        <h3>{archived?'ยังไม่มีสมุดความทรงจำที่เก็บไว้':'ยังไม่มีสมุดความทรงจำในห้องนี้'}</h3>
        <p>หนึ่งเล่มเพิ่มหน้าได้เอง แปะแสตมป์ได้เรื่อย ๆ และแลกบางส่วนโดยไม่ต้องปิดสมุด</p>
        {archived
          ?<Link className="button button--secondary" href={base}>กลับไปดูสมุด</Link>
          :create}
      </div>}
  </section>
}
