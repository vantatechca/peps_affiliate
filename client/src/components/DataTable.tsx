import { useState, useRef, useCallback, ReactNode } from 'react';

// ============ TYPES ============

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  defaultWidth?: number;
  render?: (row: any) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

// ============ SORTING ============

function sortData(data: any[], sort: SortState | null): any[] {
  if (!sort) return data;
  return [...data].sort((a, b) => {
    let aVal = getNestedValue(a, sort.key);
    let bVal = getNestedValue(b, sort.key);

    // Handle nulls
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // Numeric
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sort.dir === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // String
    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();
    if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

// ============ RESIZABLE HEADER ============

function ResizableHeader({
  children,
  width,
  onResize,
  align = 'left',
  sortDir,
  onSort,
  sortable = true,
}: {
  children: ReactNode;
  width: number;
  onResize: (w: number) => void;
  align?: string;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: () => void;
  sortable?: boolean;
}) {
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startW.current = width;

      const onMouseMove = (ev: MouseEvent) => {
        const diff = ev.clientX - startX.current;
        onResize(Math.max(50, startW.current + diff));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [width, onResize]
  );

  return (
    <th
      style={{ width, minWidth: 50, position: 'relative' }}
      className={`px-4 py-2 font-medium text-gray-500 select-none ${align === 'right' ? 'text-right' : ''}`}
    >
      <div
        className={`flex items-center gap-1 ${sortable ? 'cursor-pointer hover:text-gray-900' : ''} ${align === 'right' ? 'justify-end' : ''}`}
        onClick={sortable ? onSort : undefined}
      >
        <span className="truncate">{children}</span>
        {sortable && sortDir && (
          <span className="text-xs text-gray-400 flex-shrink-0">
            {sortDir === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </div>
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 5,
          cursor: 'col-resize',
          zIndex: 1,
        }}
        className="hover:bg-gray-300 active:bg-gray-400"
      />
    </th>
  );
}

// ============ DATA TABLE ============

export default function DataTable({
  columns,
  data,
  footer,
  emptyMessage = 'No data',
}: {
  columns: Column[];
  data: any[];
  footer?: ReactNode;
  emptyMessage?: string;
}) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    columns.forEach((c) => {
      w[c.key] = c.defaultWidth || 150;
    });
    return w;
  });

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
      }
      return { key, dir: 'asc' };
    });
  }

  function handleResize(key: string, w: number) {
    setWidths((prev) => ({ ...prev, [key]: w }));
  }

  const sorted = sortData(data, sort);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <ResizableHeader
                key={col.key}
                width={widths[col.key]}
                onResize={(w) => handleResize(col.key, w)}
                align={col.align}
                sortDir={sort?.key === col.key ? sort.dir : null}
                onSort={() => toggleSort(col.key)}
                sortable={col.sortable !== false}
              >
                {col.label}
              </ResizableHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.id || i} className="border-b border-gray-50 hover:bg-gray-50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{ width: widths[col.key] }}
                  className={`px-4 py-3 truncate ${col.align === 'right' ? 'text-right' : ''} ${col.className || ''}`}
                >
                  {col.render ? col.render(row) : getNestedValue(row, col.key) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
      {data.length === 0 && (
        <div className="px-4 py-8 text-sm text-gray-400 text-center">{emptyMessage}</div>
      )}
    </div>
  );
}
