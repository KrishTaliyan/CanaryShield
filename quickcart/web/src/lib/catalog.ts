/**
 * Menu copy shown in the shop. The server only sends id, name, price and
 * category; descriptions and dietary labels live here with the other
 * presentation details.
 */
export interface Dish {
  emoji: string;
  /** Tailwind gradient classes for the plate background. */
  tint: string;
  description: string;
  veg: boolean;
}

const dishes: Record<string, Dish> = {
  p1: { emoji: "🍛", tint: "from-amber-200 to-orange-300 dark:from-amber-900/60 dark:to-orange-900/50", veg: false, description: "Long-grain basmati layered with spiced chicken, fried onions and saffron, slow-cooked in a sealed pot." },
  p2: { emoji: "🫓", tint: "from-yellow-100 to-amber-200 dark:from-yellow-900/50 dark:to-amber-900/40", veg: true, description: "A crisp fermented rice crêpe folded around spiced potato, with coconut chutney and sambar." },
  p3: { emoji: "🍢", tint: "from-orange-200 to-red-200 dark:from-orange-900/50 dark:to-red-900/40", veg: true, description: "Cubes of paneer marinated in yoghurt and spices, charred with peppers and onion." },
  p4: { emoji: "🥘", tint: "from-rose-200 to-orange-200 dark:from-rose-900/50 dark:to-orange-900/40", veg: false, description: "Tandoori chicken simmered in a mild, creamy tomato and butter gravy." },
  p5: { emoji: "🥙", tint: "from-lime-100 to-yellow-200 dark:from-lime-900/40 dark:to-yellow-900/40", veg: true, description: "Spicy chickpea curry with two puffed, deep-fried bhature." },
  p6: { emoji: "🍱", tint: "from-emerald-100 to-teal-200 dark:from-emerald-900/50 dark:to-teal-900/40", veg: true, description: "A full meal on one plate: dal, two sabzis, rice, rotis, raita and a sweet." },
  p7: { emoji: "🥟", tint: "from-sky-100 to-cyan-200 dark:from-sky-900/50 dark:to-cyan-900/40", veg: true, description: "Flaky pastry filled with spiced potato and peas, with mint and tamarind chutney." },
  p8: { emoji: "🍩", tint: "from-pink-100 to-rose-200 dark:from-pink-900/50 dark:to-rose-900/40", veg: true, description: "Soft milk-solid dumplings soaked in cardamom and rose syrup, served warm." },
};

const fallback: Dish = { emoji: "🍽️", tint: "from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-700", veg: false, description: "Freshly prepared in the QuickCart kitchen." };

export function dishFor(productId: string): Dish {
  return dishes[productId] ?? fallback;
}
