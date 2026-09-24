import { useEffect, useState } from "react";
import type { Product } from "../api";
import { useCart } from "../cart";
import { buttonClass } from "../lib/button";
import { dishFor } from "../lib/catalog";
import { currency } from "../lib/pricing";
import Dialog from "./Dialog";
import DishPlate from "./DishPlate";
import { CartIcon } from "./Icons";
import QuantityStepper from "./QuantityStepper";
import VegMark from "./VegMark";

/** Item details with a quantity picker. */
export default function ProductDialog({ product, onClose, onAdded }: { product: Product | null; onClose: () => void; onAdded: (product: Product, quantity: number) => void }) {
  const { addProduct, quantityOf } = useCart();
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) setQuantity(1);
  }, [product]);

  if (!product) return null;
  const dish = dishFor(product.id);
  const inCart = quantityOf(product.id);

  return (
    <Dialog open onClose={onClose} title={product.name} hideTitle>
      <div className="grid sm:grid-cols-2">
        <div className="p-4 sm:p-5"><DishPlate productId={product.id} size="lg" /></div>
        <div className="flex flex-col gap-4 p-5 pt-0 sm:pl-0 sm:pt-12">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              <VegMark veg={dish.veg} /> {product.category}
            </p>
            <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{product.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{dish.description}</p>
          </div>
          <p className="text-2xl font-bold tabular text-ink">{currency.format(product.price)}</p>
          {inCart > 0 && <p className="text-xs font-medium text-brand">{inCart} already in your cart</p>}
          <div className="mt-auto flex flex-wrap items-center gap-3">
            <QuantityStepper label={product.name} value={quantity} onChange={(value) => setQuantity(Math.max(1, value))} />
            <button
              type="button"
              data-autofocus
              className={buttonClass("primary", "md", "flex-1")}
              onClick={() => {
                addProduct(product, quantity);
                onAdded(product, quantity);
                onClose();
              }}
            >
              <CartIcon size={16} /> Add · {currency.format(product.price * quantity)}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
