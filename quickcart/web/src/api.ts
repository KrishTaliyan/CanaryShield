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

export interface PayRequest {
  user: Pick<Persona, "userId" | "country" | "plan" | "betaUser">;
  items: Array<{ productId: string; qty: number }>;
  amount: number;
}

export interface PaymentEvaluation {
  variant: "old" | "new";
  reason: string;
}

export interface PaySuccessResponse {
  orderId: string;
  status: "confirmed";
  flow: "old" | "new";
  evaluation: PaymentEvaluation;
  durationMs: number;
}

export interface PayFailureResponse {
  status: "failed";
  flow: "old" | "new";
  error: { code: string; message: string };
  evaluation: PaymentEvaluation;
  durationMs: number;
}

export type PayResponse = PaySuccessResponse | PayFailureResponse;

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

/** Which payment flow a shopper's checkout will use, from GET /api/checkout-flow. */
export interface CheckoutFlow {
  flagKey: string;
  flow: "old" | "new";
  reason: string;
  /** null when the platform could not be reached. */
  rolloutPercentage: number | null;
}

export async function getCheckoutFlow(persona: Pick<Persona, "userId" | "country" | "plan" | "betaUser">, signal?: AbortSignal): Promise<CheckoutFlow> {
  const query = new URLSearchParams({
    userId: persona.userId,
    country: persona.country,
    plan: persona.plan,
    betaUser: String(persona.betaUser),
  });
  let response: Response;
  try {
    response = await fetch(`${serverUrl}/api/checkout-flow?${query}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Unable to reach QuickCart. Check that its server is running.");
  }
  if (!response.ok) throw new Error(`QuickCart request failed (${response.status}).`);
  const payload = await response.json() as Partial<CheckoutFlow>;
  if (payload.flow !== "old" && payload.flow !== "new") throw new Error("QuickCart returned an invalid checkout flow.");
  return {
    flagKey: payload.flagKey ?? "new_payment_flow",
    flow: payload.flow,
    reason: typeof payload.reason === "string" ? payload.reason : "UNKNOWN",
    rolloutPercentage: typeof payload.rolloutPercentage === "number" ? payload.rolloutPercentage : null,
  };
}

export async function createPayment(request: PayRequest): Promise<PayResponse> {
  let response: Response;
  try {
    response = await fetch(`${serverUrl}/api/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error("Unable to reach QuickCart. Check that its server is running.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("QuickCart returned an invalid payment response.");
  }

  if (
    typeof payload === "object" && payload !== null
    && "status" in payload && payload.status === "failed"
    && "flow" in payload && (payload.flow === "old" || payload.flow === "new")
    && "error" in payload && typeof payload.error === "object" && payload.error !== null
    && "code" in payload.error && typeof payload.error.code === "string"
    && "message" in payload.error && typeof payload.error.message === "string"
    && "evaluation" in payload && typeof payload.evaluation === "object" && payload.evaluation !== null
    && "variant" in payload.evaluation && (payload.evaluation.variant === "old" || payload.evaluation.variant === "new")
    && "reason" in payload.evaluation && typeof payload.evaluation.reason === "string"
    && "durationMs" in payload && typeof payload.durationMs === "number"
  ) {
    return payload as PayFailureResponse;
  }

  if (
    response.ok && typeof payload === "object" && payload !== null
    && "status" in payload && payload.status === "confirmed"
    && "orderId" in payload && typeof payload.orderId === "string"
    && "flow" in payload && (payload.flow === "old" || payload.flow === "new")
    && "evaluation" in payload && typeof payload.evaluation === "object" && payload.evaluation !== null
    && "variant" in payload.evaluation && (payload.evaluation.variant === "old" || payload.evaluation.variant === "new")
    && "reason" in payload.evaluation && typeof payload.evaluation.reason === "string"
    && "durationMs" in payload && typeof payload.durationMs === "number"
  ) {
    return payload as PaySuccessResponse;
  }

  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = payload.error;
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
      throw new Error(error.message);
    }
  }
  throw new Error(`QuickCart payment failed (${response.status}).`);
}
