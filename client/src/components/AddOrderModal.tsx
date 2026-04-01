import { useState, useEffect } from 'react';
import { api } from '../api';
import ConfirmModal from './ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';

interface AddOrderModalProps {
  onClose: () => void;
  onCreated: (order: any) => void;
}

export default function AddOrderModal({ onClose, onCreated }: AddOrderModalProps) {
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [itemsSummary, setItemsSummary] = useState('');
  const [orderTotal, setOrderTotal] = useState('');
  const [commissionEarned, setCommissionEarned] = useState('');
  const [discountCodeId, setDiscountCodeId] = useState('');
  const [source, setSource] = useState('shopify');
  const [storeName, setStoreName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [attributed, setAttributed] = useState(false);
  const [createdAt, setCreatedAt] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<any[]>([]);
  const [storeNames, setStoreNames] = useState<string[]>([]);
  const { confirmProps, confirm } = useConfirm();

  useEffect(() => {
    api.getCodes().then(setCodes).catch(() => {});
    api.getStores().then(setStoreNames).catch(() => {});
  }, []);

  async function handleSave() {
    if (!customerFirstName.trim() || !itemsSummary.trim() || !orderTotal) {
      setError('Customer first name, items, and order total are required');
      return;
    }
    const ok = await confirm({ title: 'Add Order', message: 'Create this order?', confirmLabel: 'Create', variant: 'info' });
    if (!ok) return;
    setSaving(true);
    setError('');
    try {
      const order = await api.createOrder({
        customerFirstName: customerFirstName.trim(),
        customerLastName: customerLastName.trim() || null,
        itemsSummary: itemsSummary.trim(),
        orderTotal: parseFloat(orderTotal),
        commissionEarned: commissionEarned ? parseFloat(commissionEarned) : 0,
        discountCodeId: discountCodeId || null,
        source,
        storeName: storeName.trim() || null,
        currency,
        attributed,
        createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
      });
      onCreated(order);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative bg-white rounded-t-xl sm:rounded-lg border border-gray-200 w-full sm:max-w-lg sm:mx-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-lg">
          <h3 className="text-base font-semibold text-gray-900">Add Order</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-4 sm:px-6 py-4 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Date & Time</label>
            <input type="datetime-local" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">First Name *</label>
              <input type="text" value={customerFirstName} onChange={(e) => setCustomerFirstName(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Last Name</label>
              <input type="text" value={customerLastName} onChange={(e) => setCustomerLastName(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Items Summary *</label>
            <input type="text" value={itemsSummary} onChange={(e) => setItemsSummary(e.target.value)}
              placeholder="e.g. 2x Widget, 1x Gadget"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Order Total *</label>
              <input type="number" step="0.01" value={orderTotal} onChange={(e) => setOrderTotal(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Commission</label>
              <input type="number" step="0.01" value={commissionEarned} onChange={(e) => setCommissionEarned(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Discount Code</label>
            <select value={discountCodeId} onChange={(e) => setDiscountCodeId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500">
              <option value="">None</option>
              {codes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.code} — {c.affiliate?.name || 'Unknown'}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500">
                <option value="shopify">Shopify</option>
                <option value="wordpress">WordPress</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Store</label>
              <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                list="store-names-list"
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" />
              <datalist id="store-names-list">
                {storeNames.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500">
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={attributed} onChange={(e) => setAttributed(e.target.checked)}
              className="rounded border-gray-300" />
            Attributed
          </label>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 flex justify-end gap-2 rounded-b-lg">
          <button onClick={onClose} disabled={saving}
            className="text-sm text-gray-600 px-3 py-2 rounded hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Order'}
          </button>
        </div>
        <ConfirmModal {...confirmProps} />
      </div>
    </div>
  );
}
