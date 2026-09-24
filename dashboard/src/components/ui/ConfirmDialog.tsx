import { AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import Button from "./Button";
import Modal from "./Modal";

interface StateBox {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  tone?: "danger" | "warning" | "primary";
  /** What is true now. */
  current?: StateBox;
  /** What will be true after confirming. */
  after?: StateBox;
  /** Expected impact, in plain words. */
  impact?: ReactNode;
  reason?: { label: string; placeholder?: string; required?: boolean };
  /** For the most destructive actions: the user must type this text exactly. */
  requireText?: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<unknown> | void;
  busy?: boolean;
  error?: string | null;
  children?: ReactNode;
}

/**
 * Confirmation for consequential actions. Always shows the current state,
 * the state after, and the expected impact, never just "Are you sure?".
 */
export default function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  tone = "danger",
  current,
  after,
  impact,
  reason,
  requireText,
  confirmLabel,
  onConfirm,
  busy,
  error,
  children,
}: ConfirmDialogProps) {
  const reasonId = useId();
  const typedId = useId();
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) {
      setText("");
      setTyped("");
    }
  }, [open]);

  const Icon = tone === "danger" ? ShieldAlert : AlertTriangle;
  const iconTone = tone === "danger" ? "bg-danger-soft text-danger" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-info-soft text-info";
  const blocked = Boolean(reason?.required && text.trim().length === 0) || Boolean(requireText && typed.trim() !== requireText);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      role="alertdialog"
      title={title}
      description={description}
      icon={<span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-control", iconTone)}><Icon size={20} /></span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            disabled={blocked}
            onClick={() => void onConfirm(text.trim())}
            data-autofocus={reason || requireText ? undefined : true}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {(current || after) && (
          <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
            {current && (
              <div className="well px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{current.label}</p>
                <p className="mt-1 text-lg font-semibold tabular text-ink">{current.value}</p>
                {current.hint && <p className="mt-0.5 text-xs text-ink-muted">{current.hint}</p>}
              </div>
            )}
            {current && after && (
              <span className="hidden items-center justify-center text-ink-subtle sm:flex" aria-hidden="true"><ArrowRight size={18} /></span>
            )}
            {after && (
              <div className={cn("rounded-control border px-4 py-3", tone === "danger" ? "border-danger/30 bg-danger-soft/50" : "border-accent/30 bg-accent-soft/60")}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{after.label}</p>
                <p className="mt-1 text-lg font-semibold tabular text-ink">{after.value}</p>
                {after.hint && <p className="mt-0.5 text-xs text-ink-muted">{after.hint}</p>}
              </div>
            )}
          </div>
        )}
        {impact && (
          <div className="rounded-control border border-line bg-surface-2 px-4 py-3 text-sm text-ink-muted">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Expected impact</p>
            {impact}
          </div>
        )}
        {children}
        {reason && (
          <div>
            <label htmlFor={reasonId} className="mb-1.5 block text-sm font-medium text-ink">
              {reason.label}{reason.required && <span className="text-danger"> *</span>}
            </label>
            <textarea
              id={reasonId}
              data-autofocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={reason.placeholder}
              className="well min-h-[88px] w-full resize-y px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent"
            />
          </div>
        )}
        {requireText && (
          <div>
            <label htmlFor={typedId} className="mb-1.5 block text-sm font-medium text-ink">
              Type <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px] text-ink">{requireText}</code> to confirm
            </label>
            <input
              id={typedId}
              data-autofocus={reason ? undefined : true}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="well h-10 w-full px-3 font-mono text-sm text-ink outline-none focus:border-accent"
            />
          </div>
        )}
        {error && <p className="rounded-control border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
