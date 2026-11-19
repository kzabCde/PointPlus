import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Point+',
    short_name: 'Point+',
    description: 'A personal missions, points and rewards app for people who care about each other.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF4E3',
    theme_color: '#FF7F7A',
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
