'use client'

import { useEffect } from 'react'

export function LandingReveals() {
  useEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const elements = document.querySelectorAll<HTMLElement>('[data-living-reveal]')
    let remaining = elements.length
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const element = entry.target as HTMLElement
        element.dataset.revealed = ''
        observer.unobserve(element)
        if (--remaining === 0) observer.disconnect()
      }
    }, { threshold: 0.18 })

    elements.forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return null
}
