import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Confirmation from "./pages/Confirmation";
import Products from "./pages/Products";
import { CartProvider, useCart } from "./cart";
import CartDrawer from "./components/CartDrawer";
import { AlertIcon, CartIcon, CheckIcon, MoonIcon, ShieldIcon, SunIcon } from "./components/Icons";
import PersonaSwitcher, { PersonaProvider } from "./components/PersonaSwitcher";
import { buttonClass } from "./lib/button";
import { useTheme } from "./lib/theme";

/** Context that store pages rendered in the layout's Outlet receive. */
export interface StoreContext {
  notify: (message: string, tone?: "success" | "error") => void;
}

const toastDurationMs = 2800;

function StoreLayout() {
  const { totalItems, openDrawer } = useCart();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const [toast, setToast] = useState<{ id: number; message: string; tone: "success" | "error" } | null>(null);
  const [bump, setBump] = useState(0);
  const nextId = useRef(1);
  const previousCount = useRef(totalItems);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ id: nextId.current++, message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toastDurationMs);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Animate the cart badge when items are added.
  useEffect(() => {
    if (totalItems > previousCount.current) setBump((value) => value + 1);
    previousCount.current = totalItems;
  }, [totalItems]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const context: StoreContext = { notify };
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-control px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-brand-soft text-brand" : "text-ink-muted hover:bg-sunken hover:text-ink"}`;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <a href="#main" className="sr-only z-[60] rounded-control bg-surface px-4 py-2 text-sm font-semibold shadow-float focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
          <Link to="/" className="mr-auto flex items-center gap-2.5" aria-label="QuickCart home">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-brand text-brand-fg shadow-raised-sm" aria-hidden="true"><CartIcon size={18} /></span>
            <span className="hidden text-lg font-bold tracking-tight text-ink min-[400px]:inline">QuickCart</span>
          </Link>
          <nav aria-label="Store navigation" className="hidden items-center gap-1 md:flex">
            <NavLink className={navClass} end to="/">Menu</NavLink>
            <NavLink className={navClass} to="/checkout">Checkout</NavLink>
          </nav>
          <PersonaSwitcher />
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
          <button type="button" onClick={openDrawer} aria-label={`Open cart, ${totalItems} item${totalItems === 1 ? "" : "s"}`} className={buttonClass("secondary", "md", "relative px-3")}>
            <CartIcon size={18} />
            <span className="hidden sm:inline">Cart</span>
            {totalItems > 0 && (
              <span key={bump} className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron px-1 text-[11px] font-bold tabular text-white shadow-raised-sm animate-pop">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet context={context} />
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>QuickCart is a demo shop. Payments are simulated; no money moves.</p>
          <p className="flex items-center gap-1.5"><ShieldIcon size={14} className="text-brand" /> Checkout releases are guarded by CanaryShield.</p>
        </div>
      </footer>

      <nav aria-label="Store navigation" className="sticky bottom-0 z-30 grid grid-cols-2 border-t border-line/70 bg-surface/95 backdrop-blur md:hidden">
        <NavLink end to="/" className={({ isActive }) => `py-3 text-center text-sm font-semibold ${isActive ? "text-brand" : "text-ink-muted"}`}>Menu</NavLink>
        <NavLink to="/checkout" className={({ isActive }) => `py-3 text-center text-sm font-semibold ${isActive ? "text-brand" : "text-ink-muted"}`}>Checkout</NavLink>
      </nav>

      <CartDrawer />

      <div aria-live="polite" className="pointer-events-none fixed bottom-20 left-1/2 z-[60] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 md:bottom-6">
        {toast && (
          <p
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-card border px-4 py-3 text-sm font-medium shadow-float animate-rise-in ${toast.tone === "error" ? "border-danger/30 bg-danger-soft text-danger" : "border-line bg-surface-2 text-ink"}`}
          >
            <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${toast.tone === "error" ? "bg-danger text-white" : "bg-brand text-brand-fg"}`}>
              {toast.tone === "error" ? <AlertIcon size={13} /> : <CheckIcon size={14} />}
            </span>
            {toast.message}
          </p>
        )}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-6xl" aria-hidden="true">🍽️</p>
      <h1 className="mt-4 text-2xl font-bold text-ink">This page is not on the menu</h1>
      <p className="mt-2 text-sm text-ink-muted">The link may be old or mistyped.</p>
      <Link className={buttonClass("primary", "md", "mt-6")} to="/">Back to the menu</Link>
    </div>
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
