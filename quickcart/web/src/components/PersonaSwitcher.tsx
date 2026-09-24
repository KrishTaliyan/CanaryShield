/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getPersonas, type Persona } from "../api";

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
    <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
      <span className="hidden sm:inline">Paying as</span>
      <select
        aria-label="Selected shopper persona"
        className="max-w-36 rounded border border-neutral-300 bg-white px-2 py-2 text-sm text-neutral-900"
        disabled={loading || personas.length === 0}
        onChange={(event) => selectPersona(event.target.value)}
        value={selectedPersona?.userId ?? ""}
      >
        {personas.map((persona) => (
          <option key={persona.userId} value={persona.userId}>{persona.name}</option>
        ))}
      </select>
      {error && <span className="sr-only" role="status">{error}</span>}
    </label>
  );
}
