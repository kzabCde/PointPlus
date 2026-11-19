'use client'

import { useActionState } from 'react'
import { reviewMissionAction, type ActionResult } from './actions'
const initial:ActionResult={status:'error',message:''}
export function ReviewForm({spaceId,submissionId}:{
  spaceId:string;submissionId:string
}) {
  const [state,action,pending]=useActionState(reviewMissionAction,initial)
  return <form action={action} className="social-form">
    <input type="hidden" name="space_id" value={spaceId}/>
    <input type="hidden" name="submission_id" value={submissionId}/>
    <label htmlFor={'review-note-'+submissionId}>เหตุผล (จำเป็นเมื่อไม่อนุมัติ)</label>
    <textarea id={'review-note-'+submissionId} className="input" name="note" maxLength={1000} rows={2}/>
    <div className="hero__actions">
      <button className="button button--primary" name="decision" value="approve" disabled={pending}>อนุมัติ</button>
      <button className="button button--secondary" name="decision" value="reject" disabled={pending}>ไม่อนุมัติ</button>
    </div>
    {state.message && <p role="status">{state.message}</p>}
  </form>
}
