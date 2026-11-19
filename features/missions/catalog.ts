import { canManage, getSpaceContext } from '@/features/spaces/data'
import { notFound } from 'next/navigation'
import { isUuid } from '@/lib/auth/validation'

export type CampaignOption = { id: string; title: string; description: string | null; start_at: string | null; end_at: string | null }
export type StampCardOption = { id: string; title: string; active: boolean; image_key: string | null }

export async function getManagerContext(spaceId: string) {
  const context = await getSpaceContext(spaceId)
  if (!canManage(context.member.role)) notFound()
  return context
}
export async function getMissionCatalog(spaceId: string) {
  const { supabase } = await getManagerContext(spaceId)
  const [campaigns, cards] = await Promise.all([
    supabase.from('campaigns').select('id,title,description,start_at,end_at').eq('space_id',spaceId).order('created_at',{ascending:false}),
    supabase.from('stamp_cards').select('id,title,active,image_key').eq('space_id',spaceId).order('created_at',{ascending:false}),
  ])
  if (campaigns.error || cards.error) throw new Error('Cannot load mission catalog')
  return {
    campaigns: (campaigns.data ?? []) as CampaignOption[],
    stampCards: (cards.data ?? []) as StampCardOption[],
  }
}
export function checkMissionCatalog(
  mission: { campaign_id: string | null; stamp_card_id: string | null; stamps_reward: number },
  catalog: { campaigns: CampaignOption[]; stampCards: StampCardOption[] },
): string | null {
  if (mission.campaign_id && (!isUuid(mission.campaign_id) || !catalog.campaigns.some(c => c.id === mission.campaign_id)))
    return 'ชุดภารกิจนี้ไม่อยู่ในพื้นที่'
  if (mission.stamps_reward > 0 &&
      !catalog.stampCards.some(c => c.id === mission.stamp_card_id && c.active))
    return 'กรุณาเลือกบัตรสะสมที่เปิดใช้งานภายในพื้นที่'
  return null
}
