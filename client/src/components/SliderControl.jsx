function SliderControl({ value, onChange }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
            Rollout Percentage
          </p>
          <p className="text-sm text-gray-500">Deterministic bucket: userId % 100</p>
        </div>
        <span className="rounded-lg bg-cyan-400/10 px-3 py-1 text-xl font-bold text-cyan-200">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="feature-range w-full"
      />
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
}

export default SliderControl;
