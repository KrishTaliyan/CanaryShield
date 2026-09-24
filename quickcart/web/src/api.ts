declare global {
  interface ImportMetaEnv {
    readonly VITE_QUICKCART_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const serverUrl = (import.meta.env.VITE_QUICKCART_URL || "http://localhost:4000").replace(/\/$/, "");

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface Persona {
  userId: string;
  name: string;
  country: string;
  plan: "free" | "premium";
  betaUser: boolean;
}

interface Collection<T> {
  [key: string]: T[];
}

async function getCollection<T>(path: string, key: string, signal?: AbortSignal): Promise<T[]> {
  let response: Response;
  try {
    response = await fetch(`${serverUrl}${path}`, { signal });
  } catch {
    throw new Error("Unable to reach QuickCart. Check that its server is running.");
  }

  let payload: Collection<T>;
  try {
    payload = await response.json() as Collection<T>;
  } catch {
    throw new Error("QuickCart returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(`QuickCart request failed (${response.status}).`);
  }
  if (!Array.isArray(payload[key])) {
    throw new Error("QuickCart returned an invalid collection.");
  }
  return payload[key];
}

export function getProducts(signal?: AbortSignal) {
  return getCollection<Product>("/api/products", "products", signal);
}

export function getPersonas(signal?: AbortSignal) {
  return getCollection<Persona>("/api/personas", "personas", signal);
}
