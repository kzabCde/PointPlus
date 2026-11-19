import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'PointPlus — ภารกิจเล็ก ๆ ความหมายดี ๆ',
    template: '%s | PointPlus',
  },
  description: 'สร้างภารกิจและกำลังใจให้ตัวเอง คนรัก และคนในครอบครัว ผ่านพื้นที่ส่วนตัวที่ไม่เกี่ยวข้องกับการค้า',
  applicationName: 'PointPlus',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body>
        <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหา</a>
        {children}
      </body>
    </html>
  )
}
