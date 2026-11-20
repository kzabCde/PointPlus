export function SegmentedField({ label, name, options, defaultValue }: {
  label: string
  name: string
  options: { value: string; label: string }[]
  defaultValue: string
}) {
  return <fieldset className="segmented-field">
    <legend>{label}</legend>
    <div>
      {options.map(option => <label key={option.value}>
        <input type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue}/>
        {option.label}
      </label>)}
    </div>
  </fieldset>
}
