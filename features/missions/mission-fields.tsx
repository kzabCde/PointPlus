import type { Mission } from './data'
import type { CampaignOption, StampCardOption } from './catalog'
import { utcToLocal } from './validation'

export function MissionFields({ mission, campaigns, stampCards, timezone, creating = false }: {
  mission?: Mission
  campaigns: CampaignOption[]
  stampCards: StampCardOption[]
  timezone: string
  creating?: boolean
}) {
  return (
    <>
      <div className="form-field"><label className="form-field__label" htmlFor="mission-title">ชื่อภารกิจ</label>
        <input id="mission-title" className="input" name="title" required maxLength={160} defaultValue={mission?.title ?? ''} />
      </div>
      <div className="form-field"><label className="form-field__label" htmlFor="mission-desc">รายละเอียด</label>
        <textarea id="mission-desc" className="input" name="description" rows={4} maxLength={4000} defaultValue={mission?.description ?? ''} />
      </div>
      <div className="mission-fields-grid">
        <div className="form-field"><label className="form-field__label" htmlFor="mission-frequency">ความถี่</label>
          <select id="mission-frequency" name="frequency" className="input" defaultValue={mission?.frequency ?? 'once'}>
            <option value="once">ครั้งเดียว</option><option value="daily">รายวัน</option>
            <option value="weekly">รายสัปดาห์ (ISO)</option><option value="repeatable">ทำซ้ำได้</option>
          </select>
        </div>
        <div className="form-field"><label className="form-field__label" htmlFor="mission-mode">การมอบหมาย</label>
          <select id="mission-mode" name="assignment_mode" className="input" defaultValue={mission?.assignment_mode ?? 'open'}>
            <option value="open">เปิดให้ผู้เข้าร่วมในพื้นที่</option>
            <option value="assigned">เฉพาะผู้ที่ได้รับมอบหมาย</option>
          </select>
        </div>
        <div className="form-field"><label className="form-field__label" htmlFor="mission-points">แต้มเมื่อภารกิจได้รับอนุมัติ</label>
          <input id="mission-points" name="points_reward" className="input" type="number" min={0} max={1000000} step={1}
            defaultValue={mission?.points_reward ?? 0} required />
        </div>
        <div className="form-field"><label className="form-field__label" htmlFor="mission-stamps">จำนวนแสตมป์</label>
          <input id="mission-stamps" name="stamps_reward" className="input" type="number" min={0} max={100} step={1}
            defaultValue={mission?.stamps_reward ?? 0} required />
        </div>
        <div className="form-field"><label className="form-field__label" htmlFor="mission-card">บัตรสะสมแสตมป์</label>
          <select id="mission-card" name="stamp_card_id" className="input" defaultValue={mission?.stamp_card_id ?? ''}>
            <option value="">ไม่เลือก (ใช้เมื่อแสตมป์ = 0)</option>
            {stampCards.filter(c=>c.active || c.id === mission?.stamp_card_id).map(c=>
              <option key={c.id} value={c.id}>{c.title}{c.active ? '' : ' (ปิดใช้งาน)'}</option>)}
          </select>
          <span className="form-field__hint">เลือกเฉพาะเมื่อจำนวนแสตมป์มากกว่า 0</span>
        </div>
        <div className="form-field"><label className="form-field__label" htmlFor="mission-max">จำนวนครั้งสูงสุด (ไม่บังคับ)</label>
          <input id="mission-max" name="max_completions" className="input" type="number" min={1} max={1000000} step={1}
            defaultValue={mission?.max_completions ?? ''} />
        </div>
        <div className="form-field"><label className="form-field__label" htmlFor="mission-campaign">ชุดภารกิจ</label>
          <select id="mission-campaign" name="campaign_id" className="input" defaultValue={mission?.campaign_id ?? ''}>
            <option value="">ไม่มีชุดภารกิจ</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        {creating && <div className="form-field"><label className="form-field__label" htmlFor="mission-status">สถานะเริ่มต้น</label>
          <select id="mission-status" name="status" className="input" defaultValue="draft">
            <option value="draft">ฉบับร่าง</option><option value="active">เปิดใช้งาน</option>
          </select>
        </div>}
        <div className="form-field"><label className="form-field__label" htmlFor="mission-start">เริ่ม (ไม่บังคับ)</label>
          <input id="mission-start" type="datetime-local" name="starts_at" className="input"
            defaultValue={utcToLocal(mission?.starts_at ?? null,timezone)} />
        </div>
        <div className="form-field"><label className="form-field__label" htmlFor="mission-end">สิ้นสุด (ไม่บังคับ)</label>
          <input id="mission-end" type="datetime-local" name="ends_at" className="input"
            defaultValue={utcToLocal(mission?.ends_at ?? null,timezone)} />
        </div>
      </div>
      <p className="muted">เวลาใช้เขตเวลาของพื้นที่ <strong>{timezone}</strong> และใช้กติกาส่งงาน/รายสัปดาห์ที่ฐานข้อมูลกำหนด ไม่ใช่เขตเวลาของอุปกรณ์</p>
      <p className="muted">การอนุมัติเป็นรูปแบบเดียวที่ระบบรองรับ การสร้างภารกิจยังไม่ทำให้ผู้ใช้ได้รับแต้ม</p>
    </>
  )
}
