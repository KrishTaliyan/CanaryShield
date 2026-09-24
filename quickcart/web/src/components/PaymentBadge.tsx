import { ShieldIcon } from "./Icons";

/** Which payment flow handled (or will handle) the payment. */
export default function PaymentBadge({ flow }: { flow: "old" | "new" }) {
  const isNew = flow === "new";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold ${isNew ? "border-info/30 bg-info-soft text-info" : "border-line bg-sunken text-ink-muted"}`}>
      <ShieldIcon size={14} />
      {isNew ? "New payment flow · canary" : "Classic payment flow"}
    </span>
  );
}
