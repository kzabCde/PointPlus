import { redirect } from 'next/navigation'
export default async function LegacyPage({params}:{params:Promise<{spaceId:string}>}){
 const {spaceId}=await params
 redirect('/s/'+spaceId+'/stamp-books')
}
