import {getSpaceContext} from '@/features/spaces/data'
import type {Participant} from '@/features/spaces/data'

export type CreationRecipient=Pick<Participant,'id'|'kind'|'user_id'|'display_name'>

/** Read only fields used by the create form, never fetch the Room shelf. */
export async function loadCreationRecipients(spaceId:string):Promise<CreationRecipient[]> {
  const {supabase}=await getSpaceContext(spaceId)
  const {data,error}=await supabase.from('participants')
    .select('id,kind,user_id,display_name')
    .eq('space_id',spaceId).is('archived_at',null).order('created_at')
  if(error)throw new Error('Cannot load Room recipients for collection creation')
  return (data??[]) as CreationRecipient[]
}
