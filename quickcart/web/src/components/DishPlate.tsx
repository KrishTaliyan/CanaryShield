import { dishFor } from "../lib/catalog";

const sizes = { sm: "h-14 w-14 text-3xl rounded-control", md: "h-40 w-full text-7xl rounded-t-card", lg: "h-56 w-full text-8xl rounded-card" };

/** The dish's illustration: its emoji on a tinted plate. */
export default function DishPlate({ productId, size = "md" }: { productId: string; size?: keyof typeof sizes }) {
  const dish = dishFor(productId);
  return (
    <div aria-hidden="true" className={`relative grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br ${dish.tint} ${sizes[size]}`}>
      <span className="absolute inset-x-[18%] bottom-[12%] top-[18%] rounded-full bg-white/35 blur-md dark:bg-white/5" />
      <span className="relative drop-shadow-md transition-transform duration-300 ease-soft group-hover:scale-110" role="img">{dish.emoji}</span>
    </div>
  );
}
