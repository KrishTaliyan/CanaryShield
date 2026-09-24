import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, Route, Routes } from "react-router-dom";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Confirmation from "./pages/Confirmation";
import Products from "./pages/Products";
import { CartProvider, useCart } from "./cart";
import PersonaSwitcher, { PersonaProvider } from "./components/PersonaSwitcher";

/** Context that store pages rendered in the layout's Outlet receive. */
export interface StoreContext {
  notify: (message: string) => void;
}

const toastDurationMs = 2500;

function StoreLayout() {
  const { totalItems } = useCart();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const nextId = useRef(1);

  const notify = useCallback((message: string) => {
    setToast({ id: nextId.current++, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toastDurationMs);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const context: StoreContext = { notify };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link className="text-lg font-bold text-emerald-900" to="/">QuickCart</Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <PersonaSwitcher />
            <nav aria-label="Store navigation" className="flex items-center gap-2">
              <NavLink className={({ isActive }) => `rounded px-3 py-2 text-sm font-medium ${isActive ? "bg-emerald-50 text-emerald-900" : "text-neutral-600 hover:bg-neutral-100"}`} end to="/">Menu</NavLink>
              <NavLink aria-label={`Cart, ${totalItems} items`} className={({ isActive }) => `rounded px-3 py-2 text-sm font-medium ${isActive ? "bg-emerald-50 text-emerald-900" : "text-neutral-600 hover:bg-neutral-100"}`} to="/cart">Cart <span className="ml-1 tabular-nums">{totalItems}</span></NavLink>
              <NavLink className={({ isActive }) => `rounded px-3 py-2 text-sm font-medium ${isActive ? "bg-emerald-50 text-emerald-900" : "text-neutral-600 hover:bg-neutral-100"}`} to="/checkout">Checkout</NavLink>
            </nav>
          </div>
        </div>
      </header>
      <Outlet context={context} />
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2">
        {toast && (
          <p key={toast.id} className="rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-900 shadow-lg" role="status">
            {toast.message}
          </p>
        )}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-neutral-950">Page not found</h1>
      <Link className="mt-4 inline-flex text-sm font-medium text-emerald-800 underline" to="/">Return to menu</Link>
    </main>
  );
}

export default function App() {
  return (
    <CartProvider>
      <PersonaProvider>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<Products />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="confirmation" element={<Confirmation />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </PersonaProvider>
    </CartProvider>
  );
}
