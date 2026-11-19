import type { Metadata } from 'next'
import Link from 'next/link'
import { listMySpaces, canManage } from '@/features/spaces/data'

export const metadata: Metadata = { title: 'สร้างกิจกรรม' }

const kindLabel = { personal: 'ส่วนตัว', couple: 'คนรัก', family: 'ครอบครัว' }

export default async function NewActivityPage() {
  const spaces = (await listMySpaces()).filter(space => canManage(space.role))
  return <>
    <span className="eyebrow">เริ่มต้นกิจกรรม</span>
    <h1 className="page-title">อยากทำกิจกรรมอะไรด้วยกัน?</h1>
    <p className="muted">เลือกพื้นที่ก่อน แล้วตั้งชื่อกิจกรรม กำหนดแต้มและการทำซ้ำได้</p>
    {spaces.length ? <div className="feature-grid">
      {spaces.map(space => <section key={space.id} className="feature-card">
        <span className="eyebrow">{kindLabel[space.kind]}</span>
        <h2>{space.name}</h2>
        <p className="muted">สร้างกิจกรรมสำหรับพื้นที่นี้</p>
        <Link className="button button--primary" href={'/s/' + space.id + '/missions/new'}>
          สร้างกิจกรรมในพื้นที่นี้
        </Link>
      </section>)}
    </div> : <div className="card empty-state" role="status">
      <h2>ยังไม่มีพื้นที่ที่คุณสร้างกิจกรรมได้</h2>
      <p>หากเพิ่งสมัครสมาชิก ระบบควรสร้างพื้นที่ส่วนตัวให้อัตโนมัติ หากยังไม่ปรากฏ ให้ตรวจสอบข้อมูลตั้งต้นของบัญชีและสิทธิ์ในฐานข้อมูล</p>
      <Link className="button button--primary" href="/spaces">ดูหรือสร้างพื้นที่</Link>
    </div>}
    <p className="muted" style={{ marginTop: 20 }}>
      กิจกรรมที่ตั้งเป็นฉบับร่างจะไม่แสดงในรายการกิจกรรมที่เปิดใช้งาน จนกว่าจะเปิดใช้งาน
    </p>
  </>
}
