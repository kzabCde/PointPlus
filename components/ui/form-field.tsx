import type { InputHTMLAttributes } from 'react'

export function FormField({
  id,
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string
  error?: string
}) {
  const descriptionId = hint || error ? id + '-description' : undefined
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>{label}</label>
      <input {...props} id={id} className="input" aria-invalid={Boolean(error)} aria-describedby={descriptionId} />
      {error ? <span id={descriptionId} className="form-field__error" role="alert">{error}</span> : null}
      {!error && hint ? <span id={descriptionId} className="form-field__hint">{hint}</span> : null}
    </div>
  )
}
