function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`group flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left shadow-lg transition duration-300 ${
        checked
          ? "border-emerald-400/40 bg-emerald-500/10 shadow-emerald-950/30"
          : "border-rose-400/40 bg-rose-500/10 shadow-rose-950/30"
      }`}
    >
      <span>
        <span className="block text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
          {label}
        </span>
        <span className="mt-1 block text-sm text-gray-300">{description}</span>
      </span>
      <span
        className={`relative h-8 w-16 shrink-0 rounded-full p-1 transition duration-300 ${
          checked ? "bg-emerald-400" : "bg-rose-500"
        }`}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white shadow transition duration-300 ${
            checked ? "translate-x-8" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export default Toggle;
