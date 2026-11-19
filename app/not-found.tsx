import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="container section" id="main-content">
      <span className="eyebrow">ไม่พบหน้านี้</span>
      <h1 className="page-title">หน้าที่คุณกำลังหาไม่มีอยู่</h1>
      <p className="muted">โปรดตรวจสอบลิงก์ หรือกลับไปที่หน้าหลักของ PointPlus</p>
      <Link href="/" className="button button--primary">กลับหน้าแรก</Link>
    </main>
  )
}
