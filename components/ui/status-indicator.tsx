type Tone = 'neutral' | 'success' | 'warning' | 'error'

export function StatusIndicator({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return <span className={'status status--' + tone}>{label}</span>
}
