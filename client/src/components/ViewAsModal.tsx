import { useState, useEffect } from 'react';
import { api } from '../api';

function formatMoney(n: number) { return `$${n.toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatDateTime(d: string) { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }

interface ViewAsProps {
  userId: string;
  onClose: () => void;
}

export default function ViewAsModal({ userId, onClose }: ViewAsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.viewAs(userId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-lg z-10">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Viewing as: {data?.user?.name || 'Loading...'}
            </h3>
            {data?.user && (
              <p className="text-xs text-gray-500 mt-0.5">
                {data.user.email} — {data.user.role === 'AFFILIATE' ? 'Affiliate' : 'Admin'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Impersonation banner */}
        <div className="bg-yellow-50 dark:bg-yellow-900 border-b border-yellow-200 dark:border-yellow-700 px-6 py-2 text-sm text-yellow-800 dark:text-yellow-200">
          You are viewing this page as <strong>{data?.user?.name}</strong>. This is what they see when they log in.
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {loading && <div className="text-gray-500 text-center py-12">Loading dashboard...</div>}

          {!loading && !data && <div className="text-red-500 text-center py-12">Failed to load</div>}

          {!loading && data?.type === 'affiliate' && <AffiliateView data={data.data} />}

          {!loading && data?.type === 'admin' && <AdminView data={data.data} />}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-6 py-3 flex justify-end rounded-b-lg">
          <button onClick={onClose} className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AffiliateView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Earnings" value={formatMoney(data.stats.daily.earnings)} sub={`${data.stats.daily.orders} orders`} />
        <StatCard label="This Month" value={formatMoney(data.stats.monthly.earnings)} sub={`${data.stats.monthly.orders} orders`} />
        <StatCard label="All Time Earnings" value={formatMoney(data.stats.total.earnings)} sub={`${data.stats.total.orders} orders`} />
        <StatCard label="Pending Payout" value={formatMoney(data.payouts.pending)} sub={`${formatMoney(data.payouts.paid)} paid`} />
      </div>

      {/* Codes */}
      {data.codes?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Discount Codes</h4>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">Discount</th>
                  <th className="px-4 py-2 font-medium">Times Used</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.codes.map((c: any) => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700">
                    <td className="px-4 py-2 font-mono font-medium text-gray-900">{c.code}</td>
                    <td className="px-4 py-2 text-gray-600">{c.label || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{(c.discountPercent * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-gray-900 font-medium">{c.timesUsed}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium ${c.active ? 'text-green-700' : 'text-gray-400'}`}>
                        {c.active ? (c.expiresAt && new Date(c.expiresAt) < new Date() ? 'Expired' : 'Active') : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {data.orders?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Orders ({data.orders.length})</h4>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Items</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                  <th className="px-4 py-2 font-medium text-right">Earning</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.slice(0, 10).map((o: any) => (
                  <tr key={o.id} className="border-b border-gray-50 dark:border-gray-700">
                    <td className="px-4 py-2 text-gray-500 text-xs">{formatDateTime(o.date)}</td>
                    <td className="px-4 py-2 text-gray-900">{o.customerFirstName}</td>
                    <td className="px-4 py-2 text-gray-600 truncate max-w-xs">{o.itemsSummary}</td>
                    <td className="px-4 py-2 text-gray-900 text-right">{formatMoney(o.orderTotal)}</td>
                    <td className="px-4 py-2 text-green-700 font-medium text-right">{formatMoney(o.commissionEarned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminView({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard label="Total Affiliates" value={data.totalAffiliates} sub={`${data.activeAffiliates} active`} />
      <StatCard label="Attributed Orders" value={data.attributedOrders} sub={`${data.totalOrders} total`} />
      <StatCard label="Total Revenue" value={formatMoney(data.totalRevenue)} sub="From attributed orders" />
      <StatCard label="Total Commissions" value={formatMoney(data.totalCommissions)} sub="Owed to affiliates" />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
