import {getSpaceContext} from '@/features/spaces/data'

export type RedemptionStatus='requested'|'fulfilled'|'canceled'
export type StampBalance={
  total:number;available:number;reserved:number;redeemed:number;peeled:number
}
export type LivingRedemption={
  id:string;book_id:string;space_id:string;recipient_participant_id:string;
  requested_by:string;requested_quantity:number;reward_message:string
  status:RedemptionStatus;requested_at:string;
  fulfilled_at:string|null;fulfilled_by:string|null;
  canceled_at:string|null;canceled_by:string|null
}
export type RedemptionStamp={
  id:string;asset_id:string;page_id:string;state:string;granted_at:string
}
export type RedemptionAssociation={redemption_id:string;mark_id:string}
const balanceZero:StampBalance={total:0,available:0,reserved:0,redeemed:0,peeled:0}

/**
 * Reads are scoped through RLS to current room membership and one book.
 * Only the latest 40 historical requests are shown; stamps remain unlimited.
 */
export async function loadLivingRedemptionData(spaceId:string,bookId:string){
  const {supabase}=await getSpaceContext(spaceId)
  const [balanceResult,historyResult,previewResult]=await Promise.all([
    supabase.rpc('pointplus_get_living_stamp_balance',{p_book:bookId}),
    supabase.from('living_stamp_redemptions')
      .select('id,book_id,space_id,recipient_participant_id,requested_by,requested_quantity,reward_message,status,requested_at,fulfilled_at,fulfilled_by,canceled_at,canceled_by')
      .eq('book_id',bookId).eq('space_id',spaceId)
      .order('requested_at',{ascending:false}).order('id',{ascending:false}).limit(40),
    supabase.from('living_stamp_marks')
      .select('id,asset_id,page_id,state,granted_at')
      .eq('book_id',bookId).eq('state','available')
      .order('granted_at',{ascending:true}).order('id',{ascending:true}).limit(30),
  ])
  if(balanceResult.error||historyResult.error||previewResult.error)
    throw new Error('Cannot load Living Book redemption balances and history')
  const balance=(balanceResult.data??balanceZero) as StampBalance
  const history=(historyResult.data??[]) as LivingRedemption[]
  const candidates=(previewResult.data??[]) as RedemptionStamp[]
  const associations:RedemptionAssociation[]=[]
  if(history.length){
    const {data,error}=await supabase.from('living_stamp_redemption_marks')
      .select('redemption_id,mark_id')
      .eq('book_id',bookId).in('redemption_id',history.map(row=>row.id))
      .order('linked_at',{ascending:true})
    if(error)throw new Error('Cannot load redemption-to-stamp associations')
    associations.push(...(data??[]) as RedemptionAssociation[])
  }
  const ids=[...new Set(associations.map(row=>row.mark_id))]
  const knownStamps:RedemptionStamp[]=[]
  for(let i=0;i<ids.length;i+=100){
    const {data,error}=await supabase.from('living_stamp_marks')
      .select('id,asset_id,page_id,state,granted_at')
      .eq('book_id',bookId).in('id',ids.slice(i,i+100))
    if(error)throw new Error('Cannot load redeemed stamp artwork')
    knownStamps.push(...(data??[]) as RedemptionStamp[])
  }
  return {balance,history,candidates,associations,knownStamps}
}
