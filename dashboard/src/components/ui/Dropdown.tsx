import { useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import type { Placement } from "../../hooks/useFloating";
import { cn } from "../../lib/cn";
import Popover from "./Popover";

export interface DropdownItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  disabledReason?: string;
  href?: string;
  onSelect?: () => void;
}

interface DropdownProps {
  /** Renders the trigger; spread `triggerProps` onto a button. */
  trigger: (triggerProps: {
    ref: RefObject<HTMLButtonElement>;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
  }) => ReactNode;
  items: DropdownItem[];
  placement?: Placement;
  label: string;
  header?: ReactNode;
}

/** Action menu with arrow-key navigation. */
export default function Dropdown({ trigger, items, placement = "bottom-end", label, header }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const navigate = useNavigate();

  function focusItem(index: number) {
    const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
    if (enabled.length === 0) return;
    const current = enabled.indexOf(index);
    const target = enabled[(current + enabled.length) % enabled.length] ?? enabled[0];
    itemRefs.current[target]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = itemRefs.current.findIndex((element) => element === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1 >= items.length ? 0 : index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index <= 0 ? items.length - 1 : index - 1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function select(item: DropdownItem) {
    if (item.disabled) return;
    setOpen(false);
    if (item.href) navigate(item.href);
    item.onSelect?.();
  }

  return (
    <>
      {trigger({
        ref: anchorRef,
        onClick: () => {
          setOpen((value) => !value);
          window.setTimeout(() => focusItem(0), 30);
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })}
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} placement={placement} role="presentation" className="min-w-[220px] p-1.5">
        {header}
        <div role="menu" aria-label={label} onKeyDown={onKeyDown}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              title={item.disabled ? item.disabledReason : undefined}
              onClick={() => select(item)}
              className={cn(
                "flex w-full items-start gap-3 rounded-control px-3 py-2 text-left text-sm transition-colors focus:outline-none",
                "hover:bg-sunken/80 focus-visible:bg-sunken/80 disabled:cursor-not-allowed disabled:opacity-45",
                item.tone === "danger" ? "text-danger" : "text-ink",
              )}
            >
              {item.icon && <span className="mt-0.5 shrink-0 opacity-80" aria-hidden="true">{item.icon}</span>}
              <span className="min-w-0">
                <span className="block font-medium">{item.label}</span>
                {(item.description || (item.disabled && item.disabledReason)) && (
                  <span className="mt-0.5 block text-xs text-ink-muted">{item.disabled ? item.disabledReason : item.description}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
