import Link from 'next/link'
import { LivingBookCover } from '@/features/living-books/cover'
import type { Participant } from '@/features/spaces/data'
import type { LivingBook } from './data'

export function LivingBookShelf({books,people,base}:{
  books:LivingBook[];people:Participant[];base:string
}){
  return <div className="stamp-book-library">
    {books.map((book,index)=>{
      const recipient=people.find(p=>p.id===book.recipient_participant_id)
      return <article className="stamp-book-cover" key={book.id}>
        <div className="book-card__visual">
          <LivingBookCover assetId={book.cover_asset_id} eager={index===0}/>
        </div>
        <div className="book-card__content">
          <span className="stamp-collection-type">Living Stampbook</span>
          <h3>{book.title}</h3>
          {book.description && <p>{book.description}</p>}
          {recipient && <p>สำหรับ {recipient.display_name}</p>}
          <p>สะสมต่อเนื่อง · ไม่จำกัดจำนวนแสตมป์</p>
          <Link className="button button--secondary"
            href={base+'/living/'+book.id}>เปิดสมุด <span aria-hidden="true">→</span></Link>
        </div>
      </article>
    })}
  </div>
}
