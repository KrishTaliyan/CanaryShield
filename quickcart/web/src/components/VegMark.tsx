/** The Indian veg / non-veg mark: a square with a dot. */
export default function VegMark({ veg }: { veg: boolean }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${veg ? "border-green-600 dark:border-green-400" : "border-red-700 dark:border-red-400"}`}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${veg ? "bg-green-600 dark:bg-green-400" : "bg-red-700 dark:bg-red-400"}`} />
    </span>
  );
}
