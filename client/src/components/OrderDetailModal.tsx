import { useState, useEffect } from 'react';
import { api } from '../api';
import ConfirmModal from './ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';

interface OrderDetailProps {
  order: any;
  onClose: () => void;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  onDelete?: (id: string) => void;
  onUpdated?: (updatedOrder: any) => void;
}

function formatMoney(n: number) { return `$${n.toFixed(2)}`; }
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function toLocalDatetime(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

export default function OrderDetailModal({ order, onClose, isAdmin, isSuperAdmin, onDelete, onUpdated }: OrderDetailProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    createdAt: '',
    customerFirstName: '',
    customerLastName: '',
    itemsSummary: '',
    orderTotal: '',
    commissionEarned: '',
    discountCodeId: '',
    source: '',
    storeName: '',
    currency: '',
    attributed: false,
    externalOrderId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<any[]>([]);
  const [storeNames, setStoreNames] = useState<string[]>([]);
  const { confirmProps, confirm } = useConfirm();

  useEffect(() => {
    if (isSuperAdmin) {
      api.getCodes().then(setCodes).catch(() => {});
      api.getStores().then(setStoreNames).catch(() => {});
    }
  }, [isSuperAdmin]);

  if (!order) return null;

  const date = order.createdAt || order.date;
  const code = isAdmin ? order.discountCode?.code : order.discountCode;
  const affiliate = order.discountCode?.affiliate?.name;
  const codeLabel = isAdmin ? order.discountCode?.label : order.codeLabel;

  function startEdit() {
    const d = order.createdAt || order.date;
    setForm({
      createdAt: d ? toLocalDatetime(d) : '',
      customerFirstName: order.customerFirstName || '',
      customerLastName: order.customerLastName || '',
      itemsSummary: order.itemsSummary || '',
      orderTotal: String(order.orderTotal ?? ''),
      commissionEarned: String(order.commissionEarned ?? ''),
      discountCodeId: order.discountCodeId || order.discountCode?.id || '',
      source: order.source || 'shopify',
      storeName: order.storeName || '',
      currency: order.currency || 'USD',
      attributed: order.attributed ?? false,
      externalOrderId: order.externalOrderId || '',
    });
    setError('');
    setEditing(true);
  }

  function updateForm(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.customerFirstName.trim() || !form.itemsSummary.trim() || !form.orderTotal) {
      setError('Customer first name, items, and order total are required');
      return;
    }
    const ok = await confirm({ title: 'Save Changes', message: 'Are you sure you want to save these changes?', confirmLabel: 'Save', variant: 'info' });
    if (!ok) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateOrder(order.id, {
        createdAt: form.createdAt ? new Date(form.createdAt).toISOString() : undefined,
        customerFirstName: form.customerFirstName.trim(),
        customerLastName: form.customerLastName.trim() || null,
        itemsSummary: form.itemsSummary.trim(),
        orderTotal: parseFloat(form.orderTotal),
        commissionEarned: form.commissionEarned ? parseFloat(form.commissionEarned) : 0,
        discountCodeId: form.discountCodeId || null,
        source: form.source,
        storeName: form.storeName.trim() || null,
        currency: form.currency,
        attributed: form.attributed,
        externalOrderId: form.externalOrderId.trim() || null,
      });
      setEditing(false);
      onUpdated?.(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative bg-white rounded-t-xl sm:rounded-lg border border-gray-200 w-full sm:max-w-lg sm:mx-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-lg">
          <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Order' : 'Order Details'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 space-y-4">
          {editing ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-3">
              <p className="text-xs font-medium text-blue-700">Editing Order</p>
              {error && <p className="text-xs text-red-600">{error}</p>}

              <div>
                <label className="text-xs text-gray-500 block mb-1">Date & Time</label>
                <input type="datetime-local" value={form.createdAt} onChange={(e) => updateForm('createdAt', e.target.value)} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">First Name *</label>
                  <input type="text" value={form.customerFirstName} onChange={(e) => updateForm('customerFirstName', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Last Name</label>
                  <input type="text" value={form.customerLastName} onChange={(e) => updateForm('customerLastName', e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Items Summary *</label>
                <input type="text" value={form.itemsSummary} onChange={(e) => updateForm('itemsSummary', e.target.value)} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Order Total *</label>
                  <input type="number" step="0.01" value={form.orderTotal} onChange={(e) => updateForm('orderTotal', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Commission</label>
                  <input type="number" step="0.01" value={form.commissionEarned} onChange={(e) => updateForm('commissionEarned', e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Discount Code</label>
                <select value={form.discountCodeId} onChange={(e) => updateForm('discountCodeId', e.target.value)} className={inputClass}>
                  <option value="">None</option>
                  {codes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.affiliate?.name || 'Unknown'}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Source</label>
                  <select value={form.source} onChange={(e) => updateForm('source', e.target.value)} className={inputClass}>
                    <option value="manual">Manual</option>
                    <option value="shopify">Shopify</option>
                    <option value="wordpress">WordPress</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Store</label>
                  <input type="text" value={form.storeName} onChange={(e) => updateForm('storeName', e.target.value)}
                    list="edit-store-names" className={inputClass} />
                  <datalist id="edit-store-names">
                    {storeNames.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Currency</label>
                  <select value={form.currency} onChange={(e) => updateForm('currency', e.target.value)} className={inputClass}>
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">External Order ID</label>
                <input type="text" value={form.externalOrderId} onChange={(e) => updateForm('externalOrderId', e.target.value)}
                  placeholder="Optional" className={inputClass} />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.attributed} onChange={(e) => updateForm('attributed', e.target.checked)}
                  className="rounded border-gray-300" />
                Attributed
              </label>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving}
                  className="text-sm text-gray-600 px-3 py-1.5 rounded hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Date */}
              <Row label="Date & Time" value={date ? formatDateTime(date) : '—'} />

              {/* Customer */}
              <Row label="Customer" value={isAdmin ? [order.customerFirstName, order.customerLastName].filter(Boolean).join(' ') || '—' : order.customerFirstName || '—'} bold />

              {/* Items - full text, no truncation */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Items</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  {(order.itemsSummary || '').split(', ').map((item: string, i: number) => (
                    <p key={i} className="text-sm text-gray-800 py-0.5">{item}</p>
                  ))}
                </div>
              </div>

              {/* Financials */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Order Total</span>
                  <span className="text-sm text-gray-900 font-semibold">{formatMoney(order.orderTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Commission Earned</span>
                  <span className="text-sm text-green-700 font-semibold">{formatMoney(order.commissionEarned)}</span>
                </div>
              </div>

              {/* Code & Affiliate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Discount Code</p>
                  {code ? (
                    <span className="inline-block font-mono text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded">{code}</span>
                  ) : (
                    <span className="text-sm text-gray-400">None</span>
                  )}
                </div>
                {isAdmin && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Affiliate</p>
                    <span className="text-sm text-gray-900">{affiliate || '—'}</span>
                  </div>
                )}
              </div>

              {codeLabel && (
                <Row label="Code Label" value={codeLabel} />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Source</p>
                  <span className="text-sm text-gray-700 capitalize">{order.source || '—'}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Attributed</p>
                  <span className={`text-sm font-medium ${order.attributed ? 'text-green-700' : 'text-gray-400'}`}>
                    {order.attributed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {order.storeName && (
                <Row label="Store" value={order.storeName} />
              )}

              <Row label="Currency" value={order.currency || 'USD'} />

              {/* External Order ID */}
              {order.externalOrderId && (
                <Row label="External Order ID" value={order.externalOrderId} mono />
              )}

              {/* Order ID */}
              <Row label="Internal ID" value={order.id} mono />

              {isSuperAdmin && (
                <button onClick={startEdit}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  Edit Order
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 flex justify-between rounded-b-lg">
          {isAdmin && onDelete ? (
            <button
              onClick={async () => {
                const ok = await confirm({ title: 'Delete Order', message: 'Are you sure you want to delete this order? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' });
                if (ok) { onDelete(order.id); onClose(); }
              }}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Delete Order
            </button>
          ) : <div />}
          <button onClick={onClose} className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800">
            Close
          </button>
        </div>
        <ConfirmModal {...confirmProps} />
      </div>
    </div>
  );
}

function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'} ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
