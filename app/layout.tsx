import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'PointPlus — ภารกิจเล็ก ๆ ความหมายดี ๆ',
    template: '%s | PointPlus',
  },
  description: 'สร้างภารกิจและกำลังใจให้ตัวเอง คนรัก และคนในครอบครัว ผ่านพื้นที่ส่วนตัวที่ไม่เกี่ยวข้องกับการค้า',
  applicationName: 'Point+',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' }],
  },
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
