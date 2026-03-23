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
      className={`px-3 sm:px-4 py-2 font-medium text-gray-500 select-none text-xs sm:text-sm ${align === 'right' ? 'text-right' : ''}`}
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
  onRowClick,
  searchable,
  searchKeys,
  searchPlaceholder = 'Search...',
}: {
  columns: Column[];
  data: any[];
  footer?: ReactNode;
  emptyMessage?: string;
  onRowClick?: (row: any) => void;
  searchable?: boolean;
  searchKeys?: string[];
  searchPlaceholder?: string;
}) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [search, setSearch] = useState('');
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

  // Client-side search filter
  let filtered = data;
  if (searchable && search.trim() && searchKeys?.length) {
    const q = search.toLowerCase();
    filtered = data.filter((row) =>
      searchKeys.some((key) => {
        const val = getNestedValue(row, key);
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }

  const sorted = sortData(filtered, sort);

  return (
    <div>
      {searchable && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-900"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">&times;</button>
            )}
          </div>
          {search && <p className="text-xs text-gray-400 mt-1">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>}
        </div>
      )}
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
            <tr
              key={row.id || i}
              className={`border-b border-gray-50 hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{ width: widths[col.key] }}
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 truncate ${col.align === 'right' ? 'text-right' : ''} ${col.className || ''}`}
                  onClick={col.key === '_actions' ? (e) => e.stopPropagation() : undefined}
                >
                  {col.render ? col.render(row) : getNestedValue(row, col.key) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
      {filtered.length === 0 && (
        <div className="px-4 py-8 text-sm text-gray-400 text-center">
          {search ? `No results for "${search}"` : emptyMessage}
        </div>
      )}
      </div>
    </div>
  );
}
