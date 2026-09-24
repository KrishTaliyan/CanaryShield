/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getPersonas, type Persona } from "../api";
import { ChevronDownIcon, UserIcon } from "./Icons";

interface PersonaContextValue {
  personas: Persona[];
  selectedPersona: Persona | null;
  selectPersona: (userId: string) => void;
  loading: boolean;
  error: string | null;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("u_demo_canary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getPersonas(controller.signal)
      .then((items) => {
        setPersonas(items);
        setSelectedUserId((current) => items.some((persona) => persona.userId === current) ? current : items[0]?.userId ?? "");
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : "Could not load personas.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const value = useMemo(() => ({
    personas,
    selectedPersona: personas.find((persona) => persona.userId === selectedUserId) ?? null,
    selectPersona: setSelectedUserId,
    loading,
    error,
  }), [personas, selectedUserId, loading, error]);

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona() {
  const value = useContext(PersonaContext);
  if (!value) throw new Error("usePersona must be used inside PersonaProvider.");
  return value;
}

export default function PersonaSwitcher() {
  const { personas, selectedPersona, selectPersona, loading, error } = usePersona();

  return (
    <label className="relative flex items-center" title={error ?? "Shopper persona used at checkout"}>
      <span className="sr-only">Paying as</span>
      <UserIcon size={16} className="pointer-events-none absolute left-3 text-ink-subtle" />
      <select
        aria-label="Selected shopper persona"
        className="h-10 max-w-[10rem] appearance-none rounded-control border border-line bg-surface pl-9 pr-8 text-sm font-medium text-ink shadow-raised-sm outline-none transition-colors hover:text-brand disabled:opacity-60"
        disabled={loading || personas.length === 0}
        onChange={(event) => selectPersona(event.target.value)}
        value={selectedPersona?.userId ?? ""}
      >
        {personas.length === 0 && <option value="">{loading ? "Loading…" : "No shoppers"}</option>}
        {personas.map((persona) => (
          <option key={persona.userId} value={persona.userId}>{persona.name}</option>
        ))}
      </select>
      <ChevronDownIcon size={14} className="pointer-events-none absolute right-3 text-ink-subtle" />
      {error && <span className="sr-only" role="status">{error}</span>}
    </label>
  );
}
