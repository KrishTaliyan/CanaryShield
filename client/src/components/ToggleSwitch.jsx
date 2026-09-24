function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition duration-300 ${
        checked
          ? "border-emerald-400 bg-emerald-500/10"
          : "border-red-400 bg-red-500/10"
      }`}
    >
      <span>
        <span className="block text-sm font-bold text-[rgb(var(--text))]">Kill Switch</span>
        <span className="mt-1 block text-xs text-[rgb(var(--muted))]">
          {checked ? "Traffic allowed" : "OLD UI only"}
        </span>
      </span>
      <span
        className={`relative h-8 w-16 rounded-full p-1 transition duration-300 ${
          checked ? "bg-emerald-400" : "bg-red-500"
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

export default ToggleSwitch;
