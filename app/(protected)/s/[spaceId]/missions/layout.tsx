import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
export default async function LegacyLayout({params}:{params:Promise<{spaceId:string}>,children:ReactNode}){
 const {spaceId}=await params
 redirect('/s/'+spaceId+'/stamp-books')
}
