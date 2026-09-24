function SliderControl({
  label = "Rollout Percentage",
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = "%",
}) {
  return (
    <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-[rgb(var(--text))]">{label}</h3>
          <p className="mt-1 text-xs text-[rgb(var(--muted))]">userId % 100</p>
        </div>
        <span className="rounded-lg bg-cyan-400/10 px-3 py-1 text-2xl font-black text-cyan-400">
          {value.toLocaleString()}
          {suffix}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="feature-range w-full"
      />

      <div className="mt-3 flex justify-between text-xs text-[rgb(var(--muted))]">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </section>
  );
}

export default SliderControl;
