export default function PaymentBadge({ flow }: { flow: "old" | "new" }) {
  const isNew = flow === "new";
  return (
    <span className={`inline-flex items-center rounded border px-2.5 py-1 text-sm font-semibold ${isNew ? "border-sky-300 bg-sky-50 text-sky-900" : "border-neutral-300 bg-neutral-100 text-neutral-800"}`}>
      {isNew ? "New payment · canary" : "Classic payment"}
    </span>
  );
}
