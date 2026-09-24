import { cityOptions, userTypeOptions } from "../services/featureService";

function SegmentedControl({ label, value, options, onChange, format = (option) => option }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-[rgb(var(--muted))]">
          {label}
        </span>
        <span className="text-xs font-semibold text-[rgb(var(--muted))]">{format(value)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition duration-200 ${
                active
                  ? "border-cyan-300 bg-cyan-300 text-gray-950"
                  : "border-[rgb(var(--line))] bg-[rgb(var(--field))] text-[rgb(var(--text))] hover:border-cyan-400"
              }`}
            >
              {format(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CohortSelector({ city, userType, onCityChange, onUserTypeChange }) {
  return (
    <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--panel-2))] p-4">
      <h3 className="mb-4 text-sm font-bold text-[rgb(var(--text))]">Cohort</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <SegmentedControl
          label="City"
          value={city}
          options={cityOptions}
          onChange={onCityChange}
        />
        <SegmentedControl
          label="User Type"
          value={userType}
          options={userTypeOptions}
          onChange={onUserTypeChange}
        />
      </div>
    </section>
  );
}

export default CohortSelector;
