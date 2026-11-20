import type { ReactNode } from 'react'

export function SectionHeader({ title, description, actions, heading: Heading = 'h2' }: {
  title: string
  description?: string
  actions?: ReactNode
  heading?: 'h1' | 'h2'
}) {
  return <header className="section-header">
    <div>
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="hero__actions">{actions}</div>}
  </header>
}
