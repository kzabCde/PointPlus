import './journal.css'
import './paper.css'
import type {ReactNode} from 'react'

/** The legacy paper styles are not needed on every Room screen. */
export default function StampBooksLayout({children}:{children:ReactNode}){
  return children
}
