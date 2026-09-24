import { Link, NavLink, Outlet, Route, Routes } from "react-router-dom";
import Cart from "./pages/Cart";
import Products from "./pages/Products";
import { CartProvider, useCart } from "./cart";

function StoreLayout() {
  const { totalItems } = useCart();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="text-lg font-bold text-emerald-900" to="/">QuickCart</Link>
          <nav aria-label="Store navigation" className="flex items-center gap-2">
            <NavLink className={({ isActive }) => `rounded px-3 py-2 text-sm font-medium ${isActive ? "bg-emerald-50 text-emerald-900" : "text-neutral-600 hover:bg-neutral-100"}`} end to="/">Menu</NavLink>
            <NavLink aria-label={`Cart, ${totalItems} items`} className={({ isActive }) => `rounded px-3 py-2 text-sm font-medium ${isActive ? "bg-emerald-50 text-emerald-900" : "text-neutral-600 hover:bg-neutral-100"}`} to="/cart">Cart <span className="ml-1 tabular-nums">{totalItems}</span></NavLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

function NotFound() {
  return (
    <main className="min-h-screen p-6">
      <p>Page not found.</p>
      <Link className="underline" to="/">Return to store</Link>
    </main>
  );
}

export default function App() {
  return (
    <CartProvider>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<Products />} />
          <Route path="cart" element={<Cart />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </CartProvider>
  );
}
