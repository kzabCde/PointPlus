import type { ReactNode } from 'react'

export function SectionHeader({ title, description, actions }: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return <header className="section-header">
    <div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="hero__actions">{actions}</div>}
  </header>
}
