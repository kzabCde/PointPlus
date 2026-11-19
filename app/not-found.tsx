import Link from 'next/link'
export default function NotFound() {
  return <main className="container section" id="main-content">
    <h1 className="page-title">ไม่พบหน้านี้</h1><p className="muted">โปรดตรวจสอบลิงก์อีกครั้ง</p>
    <Link className="button button--primary" href="/">กลับหน้าแรก</Link>
  </main>
}
