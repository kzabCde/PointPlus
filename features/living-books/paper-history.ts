import type {EditorElement} from './editor-model'

/** A command represents one successfully persisted decorative edit.
 * Never put spendable stamps, claims or redemptions in this stack.
 */
export type PaperHistoryCommand={
  id:string;before:EditorElement|null;after:EditorElement|null
}
export type PaperHistory={
  undo:PaperHistoryCommand[];redo:PaperHistoryCommand[]
}
export const emptyPaperHistory=():PaperHistory=>({undo:[],redo:[]})
export const maxPaperUndoDepth=60

export function appendPaperHistory(state:PaperHistory,command:PaperHistoryCommand):PaperHistory {
  if(!command.id||(!command.before&&!command.after))return state
  return {undo:[...state.undo,command].slice(-maxPaperUndoDepth),redo:[]}
}
export function peekPaperHistory(state:PaperHistory,direction:'undo'|'redo'){
  const stack=state[direction]
  return stack[stack.length-1]??null
}
export function completePaperHistory(state:PaperHistory,direction:'undo'|'redo'):PaperHistory {
  const current=state[direction]
  if(current.length===0)return state
  const [other,next]=direction==='undo'?['redo','undo']:['undo','redo'] as const
  return {
    ...state,[direction]:current.slice(0,-1),
    [other]:[...state[other],current[current.length-1]].slice(-maxPaperUndoDepth),
  } as PaperHistory
}
export function samePaperDecoration(a:EditorElement|null,b:EditorElement|null):boolean {
  if(!a||!b)return a===b
  const {version:va,...left}=a
  const {version:vb,...right}=b
  return JSON.stringify(left)===JSON.stringify(right)
}
