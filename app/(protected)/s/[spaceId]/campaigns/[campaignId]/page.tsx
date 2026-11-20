import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { isUuid } from '@/lib/auth/validation'
import { getManagerContext } from '@/features/missions/catalog'
import { CampaignForm } from '@/features/missions/campaign-form'
import type { CampaignOption } from '@/features/missions/catalog'
export const metadata:Metadata={title:'แก้ไขชุดภารกิจ'}
export default async function EditCampaignPage({params}:{
  params:Promise<{spaceId:string;campaignId:string}>
}) {
  const {spaceId,campaignId}=await params
  if (!isUuid(campaignId)) notFound()
  const {space,supabase}=await getManagerContext(spaceId)
  const {data,error}=await supabase.from('campaigns')
    .select('id,title,description,start_at,end_at').eq('space_id',spaceId).eq('id',campaignId).maybeSingle()
  if (error) throw new Error('Cannot load campaign')
  if (!data) notFound()
  return <>
    <Link href={'/s/'+spaceId+'/campaigns'} className="text-link">← กลับไปชุดภารกิจ</Link>
    <h2>แก้ไขชุดภารกิจ</h2>
    <CampaignForm spaceId={spaceId} timezone={'Asia/Bangkok'} campaign={data as CampaignOption}/>
  </>
}
