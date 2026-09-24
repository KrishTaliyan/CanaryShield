import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getProducts, type Product } from "../api";
import type { StoreContext } from "../App";
import { useCart } from "../cart";

const foodVisuals: Record<string, { emoji: string; background: string }> = {
  p1: { emoji: "🍛", background: "bg-amber-100" },
  p2: { emoji: "🫓", background: "bg-yellow-100" },
  p3: { emoji: "🍢", background: "bg-orange-100" },
  p4: { emoji: "🥘", background: "bg-rose-100" },
  p5: { emoji: "🥙", background: "bg-lime-100" },
  p6: { emoji: "🍱", background: "bg-emerald-100" },
  p7: { emoji: "🥟", background: "bg-sky-100" },
  p8: { emoji: "🍩", background: "bg-pink-100" },
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function Products() {
  const { addProduct } = useCart();
  const { notify } = useOutletContext<StoreContext>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getProducts(controller.signal)
      .then(setProducts)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : "Could not load products.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-800">QuickCart kitchen</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-950">Food made for your day</h1>
        </div>
        {!loading && !error && <p className="text-sm text-neutral-600">{products.length} items</p>}
      </header>

      {loading ? (
        <div aria-busy="true" aria-label="Loading products" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => <div className="h-64 animate-pulse rounded border border-neutral-200 bg-white" key={item} />)}
        </div>
      ) : error ? (
        <section className="border-y border-red-200 bg-red-50 px-4 py-5" role="alert">
          <p className="text-sm font-medium text-red-900">Could not load products</p>
          <p className="mt-1 text-sm text-red-800">{error}</p>
          <button className="mt-3 rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100" onClick={() => setAttempt((value) => value + 1)} type="button">Retry</button>
        </section>
      ) : products.length === 0 ? (
        <p className="border-y border-neutral-200 py-10 text-center text-sm text-neutral-600">No products are available.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => {
            const visual = foodVisuals[product.id] ?? { emoji: "🍽️", background: "bg-neutral-100" };
            return (
              <article className="overflow-hidden rounded border border-neutral-200 bg-white" key={product.id}>
                <div aria-hidden="true" className={`grid h-36 place-items-center ${visual.background}`}>
                  <span className="text-6xl" role="img">{visual.emoji}</span>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium uppercase text-neutral-500">{product.category}</p>
                  <h2 className="mt-1 min-h-11 text-base font-semibold text-neutral-950">{product.name}</h2>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold tabular-nums text-neutral-900">{currency.format(product.price)}</span>
                    <button
                      aria-label={`Add ${product.name} to cart`}
                      className="rounded bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                      onClick={() => {
                        addProduct(product);
                        notify(`Added ${product.name} to your cart`);
                      }}
                      type="button"
                    >Add</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
