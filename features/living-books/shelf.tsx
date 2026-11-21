import Link from 'next/link'
import { BookCover } from '@/features/stamp-books/presentation'
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
          <BookCover assetId={book.cover_asset_id} eager={index===0}/>
        </div>
        <div className="book-card__content">
          <h3>{book.title}</h3>
          {book.description && <p>{book.description}</p>}
          {recipient && <p>สำหรับ {recipient.display_name}</p>}
          {book.card&&<p>{book.card.target_count} ช่อง · {book.card.reward_title}</p>}
          <Link className="button button--secondary" prefetch={false}
            href={base+'/living/'+book.id}>{book.card?'เปิดการ์ด':'เปิดสมุด'} <span aria-hidden="true">→</span></Link>
        </div>
      </article>
    })}
  </div>
}
