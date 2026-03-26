import { useState } from 'react';
import { api } from '../api';

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

export default function OrderDetailModal({ order, onClose, isAdmin, isSuperAdmin, onDelete, onUpdated }: OrderDetailProps) {
  const [editing, setEditing] = useState(false);
  const [editSource, setEditSource] = useState(order?.source || '');
  const [editCurrency, setEditCurrency] = useState(order?.currency || 'USD');
  const [editStoreName, setEditStoreName] = useState(order?.storeName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!order) return null;

  const date = order.createdAt || order.date;
  const code = isAdmin ? order.discountCode?.code : order.discountCode;
  const affiliate = order.discountCode?.affiliate?.name;
  const codeLabel = isAdmin ? order.discountCode?.label : order.codeLabel;

  function startEdit() {
    setEditSource(order.source || '');
    setEditCurrency(order.currency || 'USD');
    setEditStoreName(order.storeName || '');
    setError('');
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateOrder(order.id, {
        source: editSource,
        currency: editCurrency,
        storeName: editStoreName,
      });
      setEditing(false);
      onUpdated?.(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative bg-white rounded-t-xl sm:rounded-lg border border-gray-200 w-full sm:max-w-lg sm:mx-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-lg">
          <h3 className="text-base font-semibold text-gray-900">Order Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 space-y-4">
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

          {/* Source, Store, Currency & Attribution — editable for super admin */}
          {editing ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-3">
              <p className="text-xs font-medium text-blue-700">Editing Order</p>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Source</label>
                <select
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="shopify">Shopify</option>
                  <option value="wordpress">WordPress</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Store Name</label>
                <input
                  type="text"
                  value={editStoreName}
                  onChange={(e) => setEditStoreName(e.target.value)}
                  placeholder="Store name"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Currency</label>
                <select
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="text-sm text-gray-600 px-3 py-1.5 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
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

              {isSuperAdmin && (
                <button
                  onClick={startEdit}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Edit Source / Store / Currency
                </button>
              )}
            </>
          )}

          {/* External Order ID */}
          {order.externalOrderId && (
            <Row label="External Order ID" value={order.externalOrderId} mono />
          )}

          {/* Order ID */}
          <Row label="Internal ID" value={order.id} mono />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 flex justify-between rounded-b-lg">
          {isAdmin && onDelete ? (
            <button
              onClick={() => { onDelete(order.id); onClose(); }}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Delete Order
            </button>
          ) : <div />}
          <button onClick={onClose} className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800">
            Close
          </button>
        </div>
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
