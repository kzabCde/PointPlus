import type { Metadata, Viewport } from 'next'
import './motion.css'
import './globals.css'

export const viewport: Viewport = { viewportFit: 'cover', themeColor: '#fff8f0' }

export const metadata: Metadata = {
  title: {
    default: 'Point+ — สมุดสะสมของคนสำคัญ',
    template: '%s | PointPlus',
  },
  description: 'เก็บช่วงเวลาดี ๆ ด้วยสมุดแสตมป์ส่วนตัวสำหรับตัวเอง คนรัก ครอบครัว และเพื่อน',
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
    <html lang="th" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหา</a>
        {children}
      </body>
    </html>
  )
}
