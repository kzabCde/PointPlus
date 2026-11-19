import type { Metadata } from 'next'
import Link from 'next/link'
import { listMySpaces } from '@/features/spaces/data'
import { CreateSpaceForm } from '@/features/spaces/space-form'

export const metadata: Metadata = { title: 'พื้นที่ของฉัน' }
const labels = { personal: 'ส่วนตัว', couple: 'คนรัก', family: 'ครอบครัว' }
export default async function SpacesPage() {
  const spaces = await listMySpaces()
  return (
    <>
      <h1 className="page-title">พื้นที่ของฉัน</h1>
      <p className="muted">เลือกพื้นที่ที่ต้องการทำภารกิจ และจัดการความสัมพันธ์ในแต่ละกลุ่ม</p>
      <div className="feature-grid" style={{ marginBottom: 25 }}>
        {spaces.map((space) => (
          <article key={space.id} className="feature-card">
            <span className="eyebrow">{labels[space.kind]}</span>
            <h2 style={{ marginTop: 14 }}>{space.name}</h2>
            <p>บทบาท: {space.role} · เขตเวลา: {space.timezone}</p>
            <Link className="button button--primary" href={'/s/' + space.id}>เข้าสู่พื้นที่</Link>
          </article>
        ))}
      </div>
      {!spaces.length && <div role="status" className="card">ยังไม่พบพื้นที่ที่สามารถเข้าถึงได้ โปรดตรวจสอบข้อมูลตั้งต้นของบัญชี</div>}
      <CreateSpaceForm />
    </>
  )
}
