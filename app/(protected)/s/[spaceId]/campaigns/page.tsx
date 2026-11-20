import type { Metadata } from 'next'
import Link from 'next/link'
import { getManagerContext, getMissionCatalog } from '@/features/missions/catalog'
import { CampaignForm } from '@/features/missions/campaign-form'
export const metadata:Metadata={title:'ชุดภารกิจ'}
export default async function CampaignsPage({params}:{params:Promise<{spaceId:string}>}){
  const {spaceId}=await params
  const [{space},catalog]=await Promise.all([getManagerContext(spaceId),getMissionCatalog(spaceId)])
  return <>
    <h2>ชุดภารกิจ</h2><p className="muted">จัดกลุ่มภารกิจที่ทำร่วมกันภายในพื้นที่</p>
    {catalog.campaigns.length
      ? <div className="feature-grid">{catalog.campaigns.map(c=>
        <article key={c.id} className="feature-card"><h3>{c.title}</h3>
          <p>{c.description??'ไม่มีรายละเอียด'}</p>
          <Link className="button button--secondary" href={'/s/'+spaceId+'/campaigns/'+c.id}>แก้ไขชุดภารกิจ</Link>
        </article>)}</div>
      : <div className="card" role="status">ยังไม่มีชุดภารกิจ คุณสามารถสร้างใหม่ได้ด้านล่าง</div>}
    <div className="feature-rows"><CampaignForm spaceId={spaceId} timezone={'Asia/Bangkok'}/></div>
  </>
}
