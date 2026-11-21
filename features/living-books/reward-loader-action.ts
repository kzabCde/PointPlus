'use server'

import {isUuid} from '@/lib/auth/validation'
import {getSpaceContext} from '@/features/spaces/data'
import {loadLivingRedemptionData} from './redemption-data'

/**
 * Invoked only when the authenticated user opens the rewards drawer.
 * Never accept a book ID without checking that it belongs to this Room.
 */
export async function loadLivingRewardsOnDemand(spaceId:string,bookId:string){
  if(!isUuid(spaceId)||!isUuid(bookId))throw new Error('Invalid collection')
  const {supabase}=await getSpaceContext(spaceId)
  const {data,error}=await supabase.from('living_books')
    .select('id').eq('space_id',spaceId).eq('id',bookId).maybeSingle()
  if(error||!data)throw new Error('Collection not accessible')
  return loadLivingRedemptionData(spaceId,bookId)
}
