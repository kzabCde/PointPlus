import { notFound } from 'next/navigation'
import { canManage, getSpaceContext, getSpaceParticipants, getSpaceMembers, type Participant } from '@/features/spaces/data'

export type StampBook = {
 id:string; space_id:string; created_by:string; title:string; description:string|null;
 cover_asset_id:string|null; target_count:number; repeatable:boolean; allow_self_stamp:boolean;
 approval_policy:'direct'|'approval_required';status:'active'|'paused'|'archived';created_at:string
}
export type StampCycle = {
 id:string;book_id:string;participant_id:string;space_id:string;cycle_no:number;
 target_snapshot:number;progress_count:number;completed_at:string|null;created_at:string
}
export type BookMark = {
 id:string;cycle_id:string;participant_id:string;asset_id:string;giver_user_id:string;
 note:string|null;stamped_at:string
}
export type BookClaim = {
 id:string;cycle_id:string;participant_id:string;reward_option_id:string;
 reward_title_snapshot:string;status:'requested'|'fulfilled'|'canceled';claimed_at:string
}
export type BookReward = {
 id:string;title:string;description:string|null;stock_remaining:number|null;active:boolean
}
export type BookRequest = {
 id:string;participant_id:string;asset_id:string;giver_user_id:string;note:string|null;created_at:string;status:string
}
export const readableParticipants = (people:Participant[],userId:string,manager:boolean,kind?:string) =>
 people.filter(p=>(kind==='couple'&&p.kind==='adult')||manager||p.user_id===userId||(p.kind==='child'&&p.guardian_user_id===userId))

export async function loadStampBookBoard(spaceId:string) {
 const [context,people] = await Promise.all([getSpaceContext(spaceId),getSpaceParticipants(spaceId)])
 const {supabase,user,member}=context
 const manager=canManage(member.role)
 const eligible=readableParticipants(people,user.id,manager,context.space.kind)
 const {data:books,error}=await supabase.from('stamp_books')
   .select('id,space_id,created_by,title,description,cover_asset_id,target_count,repeatable,allow_self_stamp,approval_policy,status,created_at')
   .eq('space_id',spaceId).order('created_at',{ascending:false}).limit(80)
 if(error)throw new Error('Cannot load Stamp Books. Confirm the v3.x Stamp Book schema has been installed.')
 const bookIds=(books??[]).map(b=>b.id)
 const result=bookIds.length&&eligible.length ? await supabase.from('stamp_book_cycles')
  .select('id,book_id,participant_id,space_id,cycle_no,target_snapshot,progress_count,completed_at,created_at')
  .eq('space_id',spaceId).in('book_id',bookIds).in('participant_id',eligible.map(p=>p.id))
  .order('created_at',{ascending:false}).limit(300)
 : {data:[] as StampCycle[],error:null}
 if(result.error)throw new Error('Cannot load book progress')
 return {context,books:(books??[]) as StampBook[],cycles:(result.data??[]) as StampCycle[],eligible}
}
export async function loadStampBookDetail(spaceId:string,bookId:string) {
 const [context,people,members]=await Promise.all([
   getSpaceContext(spaceId),getSpaceParticipants(spaceId),getSpaceMembers(spaceId),
 ])
 const {supabase,user,member}=context
 const manager=canManage(member.role)
 const eligible=readableParticipants(people,user.id,manager,context.space.kind)
 const {data:book,error}=await supabase.from('stamp_books')
 .select('id,space_id,created_by,title,description,cover_asset_id,target_count,repeatable,allow_self_stamp,approval_policy,status,created_at')
 .eq('space_id',spaceId).eq('id',bookId).maybeSingle()
 if(error)throw new Error('Cannot open Stamp Book')
 if(!book)notFound()
 const [recipients,givers,styles,rewards,cycles,marks,claims,requests]=await Promise.all([
 supabase.from('stamp_book_recipients').select('participant_id').eq('book_id',bookId),
 supabase.from('stamp_book_givers').select('user_id').eq('book_id',bookId),
 supabase.from('stamp_book_styles').select('asset_id').eq('book_id',bookId),
 supabase.from('stamp_book_reward_options').select('id,title,description,stock_remaining,active').eq('book_id',bookId),
 supabase.from('stamp_book_cycles').select('id,book_id,participant_id,space_id,cycle_no,target_snapshot,progress_count,completed_at,created_at')
  .eq('book_id',bookId).order('cycle_no',{ascending:false}).limit(400),
 supabase.from('stamp_book_marks').select('id,cycle_id,participant_id,asset_id,giver_user_id,note,stamped_at')
  .eq('book_id',bookId).order('stamped_at',{ascending:true}).limit(1000),
 supabase.from('stamp_book_claims').select('id,cycle_id,participant_id,reward_option_id,reward_title_snapshot,status,claimed_at')
  .eq('book_id',bookId).order('claimed_at',{ascending:false}).limit(400),
 supabase.from('stamp_book_stamp_requests').select('id,participant_id,asset_id,giver_user_id,note,created_at,status')
  .eq('book_id',bookId).eq('status','pending').order('created_at',{ascending:true}).limit(100),
 ])
 if([recipients,givers,styles,rewards,cycles,marks,claims,requests].some(r=>r.error))
   throw new Error('Cannot load protected Stamp Book details')
 const allowedRecipients=new Set((recipients.data??[]).map(x=>x.participant_id))
 const assigned=eligible.filter(p=>allowedRecipients.has(p.id))
 const giverRecipients=people.filter(p=>allowedRecipients.has(p.id)
   && (manager || p.kind==='adult' || p.guardian_user_id===user.id)
   && (context.space.kind!=='couple'||p.user_id!==user.id))
 const bookManager=context.space.kind==='couple' ? book.created_by===user.id : manager
 return {
 context,manager:bookManager,people,assigned,giverRecipients,members,book:book as StampBook,
 givers:[...new Set([...(givers.data??[]).map(x=>x.user_id),
   ...(context.space.kind==='couple'?[book.created_by]:[])])] as string[],
 styles:(styles.data??[]).map(x=>x.asset_id) as string[],
 rewards:(rewards.data??[]) as BookReward[],
 cycles:(cycles.data??[]) as StampCycle[],marks:(marks.data??[]) as BookMark[],
 claims:(claims.data??[]) as BookClaim[],requests:(requests.data??[]) as BookRequest[],
 }
}
