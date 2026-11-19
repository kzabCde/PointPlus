import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PointPlus',
  description: 'PointPlus rewards and loyalty web app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
