import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getProducts, type Product } from "../api";
import type { StoreContext } from "../App";
import { useCart } from "../cart";
import DishPlate from "../components/DishPlate";
import FlowStatus from "../components/FlowStatus";
import { LeafIcon, PlusIcon, RefreshIcon, SearchIcon, ShieldIcon, TruckIcon } from "../components/Icons";
import { usePersona } from "../components/PersonaSwitcher";
import ProductDialog from "../components/ProductDialog";
import QuantityStepper from "../components/QuantityStepper";
import VegMark from "../components/VegMark";
import { buttonClass } from "../lib/button";
import { dishFor } from "../lib/catalog";
import { currency, deliveryFee, freeDeliveryFrom } from "../lib/pricing";

type Sort = "menu" | "price-asc" | "price-desc" | "name";

export default function Products() {
  const { addProduct, quantityOf, setQuantity } = useCart();
  const { notify } = useOutletContext<StoreContext>();
  const { selectedPersona } = usePersona();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("menu");
  const [open, setOpen] = useState<Product | null>(null);

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

  const categories = useMemo(() => ["All", ...new Set(products.map((product) => product.category))], [products]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = products.filter((product) => {
      if (category !== "All" && product.category !== category) return false;
      if (vegOnly && !dishFor(product.id).veg) return false;
      if (term && !`${product.name} ${product.category} ${dishFor(product.id).description}`.toLowerCase().includes(term)) return false;
      return true;
    });
    if (sort === "price-asc") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...list].sort((a, b) => b.price - a.price);
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, category, vegOnly, search, sort]);

  function add(product: Product) {
    addProduct(product);
    notify(`Added ${product.name} to your cart`);
  }

  const filtersActive = category !== "All" || vegOnly || search.trim() !== "";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
      <section className="grid items-center gap-6 py-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:py-12" aria-labelledby="hero-title">
        <div className="animate-rise-in">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <LeafIcon size={14} /> Fresh from the QuickCart kitchen
          </p>
          <h1 id="hero-title" className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            Food made for your day, <span className="text-brand">delivered fast.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base text-ink-muted">
            Biryani, dosa, thali and more, cooked to order. Free delivery on orders above {currency.format(freeDeliveryFrom)}.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#menu" className={buttonClass("primary", "lg")}>Browse the menu</a>
            <span className="inline-flex items-center gap-2 text-sm text-ink-muted"><TruckIcon size={18} className="text-saffron" /> Delivery {currency.format(deliveryFee)}, free above {currency.format(freeDeliveryFrom)}</span>
          </div>
        </div>
        <aside className="surface p-5 animate-rise-in" aria-labelledby="release-title">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-brand-soft text-brand" aria-hidden="true"><ShieldIcon size={17} /></span>
            <div>
              <h2 id="release-title" className="text-sm font-semibold text-ink">Checkout release status</h2>
              <p className="text-xs text-ink-subtle">For {selectedPersona?.name ?? "the selected shopper"} · live from CanaryShield</p>
            </div>
          </div>
          <FlowStatus persona={selectedPersona} />
        </aside>
      </section>

      <section id="menu" aria-labelledby="menu-title" className="scroll-mt-20">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="menu-title" className="text-2xl font-bold tracking-tight text-ink">Menu</h2>
            {!loading && !error && <p className="text-sm text-ink-muted">{visible.length} of {products.length} dishes</p>}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Search dishes</span>
              <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dishes"
                className="well h-10 w-full pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-brand"
              />
            </label>
            <label className="sr-only" htmlFor="sort">Sort</label>
            <select id="sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="h-10 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink shadow-raised-sm">
              <option value="menu">Menu order</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all duration-200 ease-soft ${category === item ? "border-brand bg-brand text-brand-fg shadow-raised-sm" : "border-line bg-surface text-ink-muted hover:text-ink"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={vegOnly}
            onClick={() => setVegOnly((value) => !value)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${vegOnly ? "border-green-600/50 bg-success-soft text-success" : "border-line bg-surface text-ink-muted hover:text-ink"}`}
          >
            <VegMark veg /> Veg only
          </button>
          {filtersActive && (
            <button type="button" onClick={() => { setCategory("All"); setVegOnly(false); setSearch(""); }} className="text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div aria-busy="true" aria-label="Loading dishes" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="surface overflow-hidden p-0">
                <div className="skeleton h-40 rounded-none" />
                <div className="space-y-2 p-4"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-4 w-2/3" /><div className="skeleton h-9 w-full" /></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <section className="surface flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
            <p className="text-4xl" aria-hidden="true">😕</p>
            <p className="text-base font-semibold text-ink">We could not load the menu</p>
            <p className="max-w-md text-sm text-ink-muted">{error}</p>
            <button className={buttonClass("secondary", "md")} onClick={() => setAttempt((value) => value + 1)} type="button"><RefreshIcon size={16} /> Try again</button>
          </section>
        ) : visible.length === 0 ? (
          <section className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-4xl" aria-hidden="true">🔍</p>
            <p className="text-base font-semibold text-ink">{products.length === 0 ? "The kitchen has nothing on the menu" : "No dishes match"}</p>
            {filtersActive && <button type="button" className={buttonClass("secondary", "md")} onClick={() => { setCategory("All"); setVegOnly(false); setSearch(""); }}>Clear filters</button>}
          </section>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((product) => {
              const dish = dishFor(product.id);
              const quantity = quantityOf(product.id);
              return (
                <li key={product.id} className="group surface flex flex-col overflow-hidden p-0 transition-all duration-300 ease-soft hover:-translate-y-1 hover:shadow-float">
                  <button type="button" onClick={() => setOpen(product)} className="text-left" aria-label={`View details of ${product.name}`}>
                    <DishPlate productId={product.id} />
                  </button>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                      <VegMark veg={dish.veg} /> {product.category}
                    </p>
                    <h3 className="mt-1.5 text-base font-semibold text-ink">
                      <button type="button" onClick={() => setOpen(product)} className="text-left hover:text-brand">{product.name}</button>
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{dish.description}</p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="text-lg font-bold tabular text-ink">{currency.format(product.price)}</span>
                      {quantity > 0 ? (
                        <QuantityStepper size="sm" label={product.name} value={quantity} onChange={(value) => setQuantity(product.id, value)} />
                      ) : (
                        <button type="button" aria-label={`Add ${product.name} to cart`} className={buttonClass("primary", "sm")} onClick={() => add(product)}>
                          <PlusIcon size={15} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ProductDialog
        product={open}
        onClose={() => setOpen(null)}
        onAdded={(product, quantity) => notify(`Added ${quantity} × ${product.name} to your cart`)}
      />
    </div>
  );
}
