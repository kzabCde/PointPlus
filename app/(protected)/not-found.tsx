import { ButtonLink } from '@/components/ui/button'

export default function ProtectedNotFound() {
  return <section className="card empty-state">
    <h2>เปิดห้องหรือสมุดนี้ไม่ได้</h2>
    <p>ตรวจสอบลิงก์ หรือเลือกห้องที่คุณเข้าถึงได้</p>
    <ButtonLink href="/rooms">กลับไปห้องของฉัน</ButtonLink>
  </section>
}
