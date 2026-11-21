export type CreationFormat='living'|'card'
export type CreationIntent={
  key:string;format:CreationFormat;fields:Record<string,string>
}
export const creationIntentVersion=1

/**
 * Persist one immutable logical command before calling the Server Action.
 * Replays must never inherit edits from the visible form after a timeout.
 */
export function captureCreationIntent(format:CreationFormat,key:string,form:FormData):
CreationIntent {
  const fields=Object.fromEntries(Array.from(form.entries(),([name,value])=>
    [name,String(value)]))
  fields.idempotency_key=key
  return {key,format,fields}
}

export function restoreCreationIntent(raw:string|null,format:CreationFormat,spaceId:string):
CreationIntent|null {
  if(!raw)return null
  try{
    const value=JSON.parse(raw) as CreationIntent
    if(value?.format!==format||value.fields?.space_id!==spaceId||
      value.fields?.idempotency_key!==value.key||
      typeof value.fields?.recipient_id!=='string'||!value.fields.recipient_id||
      typeof value.fields?.title!=='string'||!value.fields.title||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.key))
      return null
    if(format==='card'&&
      (typeof value.fields.target_count!=='string'||
       typeof value.fields.reward_title!=='string'))return null
    return value
  }catch{return null}
}

export function intentFormData(intent:CreationIntent):FormData {
  const result=new FormData()
  for(const [name,value] of Object.entries(intent.fields))result.set(name,value)
  return result
}
