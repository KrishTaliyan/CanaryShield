import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  width?: string;
}

export interface SortState {
  id: string;
  dir: "asc" | "desc";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  caption: string;
  defaultSort?: SortState;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  loadingRows?: number;
  empty?: ReactNode;
  /** Card layout for small screens; the table is used from md up. */
  renderMobile?: (row: T) => ReactNode;
  rowTone?: (row: T) => "danger" | "warning" | undefined;
  minWidth?: number;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" };

function isInteractive(event: MouseEvent) {
  return Boolean((event.target as HTMLElement).closest("a, button, input, label, select, textarea"));
}

/** Sortable, selectable table that becomes cards on phones. */
export default function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  defaultSort,
  selectable,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  loading,
  loadingRows = 4,
  empty,
  renderMobile,
  rowTone,
  minWidth = 760,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | undefined>(defaultSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.id);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = column.sortValue!(a);
      const y = column.sortValue!(b);
      if (typeof x === "number" && typeof y === "number") return (x - y) * factor;
      return String(x).localeCompare(String(y)) * factor;
    });
  }, [rows, columns, sort]);

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(getRowId(row)));
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleAll() {
    onSelectionChange?.(allSelected ? [] : rows.map(getRowId));
  }
  function toggleRow(id: string) {
    onSelectionChange?.(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }
  function toggleSort(id: string) {
    setSort((current) => (current?.id === id ? { id, dir: current.dir === "asc" ? "desc" : "asc" } : { id, dir: "asc" }));
  }

  if (!loading && rows.length === 0) return <>{empty}</>;

  return (
    <>
      {renderMobile && (
        <ul className="space-y-3 md:hidden" aria-label={caption}>
          {loading
            ? Array.from({ length: loadingRows }, (_, index) => (
                <li key={index} className="surface p-4"><div className="skeleton mb-3 h-4 w-1/2" /><div className="skeleton h-3 w-3/4" /></li>
              ))
            : sorted.map((row) => (
                <li
                  key={getRowId(row)}
                  className={cn("surface p-4", onRowClick && "cursor-pointer active:shadow-inset-sm")}
                  onClick={(event) => {
                    if (onRowClick && !isInteractive(event)) onRowClick(row);
                  }}
                >
                  {renderMobile(row)}
                </li>
              ))}
        </ul>
      )}
      <div className={cn("surface overflow-hidden p-0", renderMobile && "hidden md:block")}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2/70">
                {selectable && (
                  <th scope="col" className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={allSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded accent-[rgb(var(--accent))]"
                    />
                  </th>
                )}
                {columns.map((column) => {
                  const active = sort?.id === column.id;
                  const SortIcon = active ? (sort?.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      style={{ width: column.width }}
                      aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}
                      className={cn("whitespace-nowrap px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle", alignClass[column.align ?? "left"], column.headerClassName)}
                    >
                      {column.sortValue ? (
                        <button type="button" onClick={() => toggleSort(column.id)} className={cn("inline-flex items-center gap-1 rounded uppercase hover:text-ink", active && "text-ink")}>
                          {column.header}
                          <SortIcon size={13} className={active ? "" : "opacity-50"} aria-hidden="true" />
                        </button>
                      ) : column.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {loading
                ? Array.from({ length: loadingRows }, (_, index) => (
                    <tr key={index}>
                      {selectable && <td className="px-4 py-4" />}
                      {columns.map((column) => (
                        <td key={column.id} className="px-4 py-4"><div className="skeleton h-3.5 w-3/4" /></td>
                      ))}
                    </tr>
                  ))
                : sorted.map((row) => {
                    const id = getRowId(row);
                    const selected = selectedIds.includes(id);
                    const tone = rowTone?.(row);
                    return (
                      <tr
                        key={id}
                        onClick={(event) => {
                          if (onRowClick && !isInteractive(event)) onRowClick(row);
                        }}
                        className={cn(
                          "transition-colors",
                          onRowClick && "cursor-pointer",
                          selected ? "bg-accent-soft/40" : "hover:bg-surface-2/80",
                          tone === "danger" && "shadow-[inset_3px_0_0_rgb(var(--danger))]",
                          tone === "warning" && "shadow-[inset_3px_0_0_rgb(var(--warning))]",
                        )}
                      >
                        {selectable && (
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              aria-label={`Select row ${id}`}
                              checked={selected}
                              onChange={() => toggleRow(id)}
                              className="h-4 w-4 cursor-pointer rounded accent-[rgb(var(--accent))]"
                            />
                          </td>
                        )}
                        {columns.map((column) => (
                          <td key={column.id} className={cn("px-4 py-3.5 align-middle", alignClass[column.align ?? "left"], column.className)}>
                            {column.cell(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
