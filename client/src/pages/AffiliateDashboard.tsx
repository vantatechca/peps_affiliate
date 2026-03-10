import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { downloadAffiliateReport } from '../pdfReport';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';

interface DashboardData {
  codes: Array<{
    id: string; code: string; label: string | null; discountPercent: number;
    active: boolean; expiresAt: string | null; timesUsed: number;
  }>;
  stats: {
    total: { orders: number; revenue: number; earnings: number };
    monthly: { orders: number; revenue: number; earnings: number };
    daily: { orders: number; revenue: number; earnings: number };
  };
  payouts: { pending: number; paid: number };
}

interface Order {
  id: string; customerFirstName: string; itemsSummary: string; orderTotal: number;
  commissionEarned: number; discountCode: string; codeLabel: string | null;
  source: string; date: string;
}

function formatMoney(n: number) { return `$${n.toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

function codeStatus(code: { active: boolean; expiresAt: string | null }) {
  if (!code.active) return { label: 'Inactive', color: 'text-gray-400' };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return { label: 'Expired', color: 'text-red-600' };
  return { label: 'Active', color: 'text-green-700' };
}

export default function AffiliateDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [period, setPeriod] = useState('');
  const [tab, setTab] = useState<'overview' | 'orders' | 'codes'>('overview');
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    loadDashboard();
    loadCharts();
  }, []);

  useEffect(() => { loadOrders(); }, [period]);

  async function loadDashboard() {
    try {
      const d = await api.affiliateDashboard();
      setData(d);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadCharts() {
    try {
      const [w, m] = await Promise.all([api.affiliateWeekly(), api.affiliateMonthly()]);
      setWeeklyData(w);
      setMonthlyData(m);
    } catch (err) { console.error(err); }
  }

  async function loadOrders() {
    try {
      const d = await api.affiliateOrders(period);
      setOrders(d.orders);
      setOrdersTotal(d.total);
    } catch (err) { console.error(err); }
  }

  function handleDownloadPDF() {
    if (!data || !user) return;
    downloadAffiliateReport(user.name, data.stats, orders, data.codes);
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-screen text-red-500">Failed to load dashboard</div>;

  const chartData = chartView === 'weekly' ? weeklyData : monthlyData;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Affiliate Dashboard</h1>
            <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleDownloadPDF}
              className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50">
              Download PDF Report
            </button>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Today's Earnings" value={formatMoney(data.stats.daily.earnings)} sub={`${data.stats.daily.orders} orders`} />
          <StatCard label="This Month" value={formatMoney(data.stats.monthly.earnings)} sub={`${data.stats.monthly.orders} orders`} />
          <StatCard label="All Time Earnings" value={formatMoney(data.stats.total.earnings)} sub={`${data.stats.total.orders} orders`} />
          <StatCard label="Pending Payout" value={formatMoney(data.payouts.pending)} sub={`${formatMoney(data.payouts.paid)} paid`} />
        </div>

        {/* Charts */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-900">Sales & Earnings</h2>
            <div className="flex gap-1 bg-gray-100 rounded p-0.5">
              <button onClick={() => setChartView('weekly')}
                className={`px-3 py-1 text-xs rounded ${chartView === 'weekly' ? 'bg-white text-gray-900 font-medium' : 'text-gray-500'}`}>
                Weekly
              </button>
              <button onClick={() => setChartView('monthly')}
                className={`px-3 py-1 text-xs rounded ${chartView === 'monthly' ? 'bg-white text-gray-900 font-medium' : 'text-gray-500'}`}>
                Monthly
              </button>
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-2">Revenue</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                    <Bar dataKey="revenue" fill="#111827" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Your Earnings</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                    <Line type="monotone" dataKey="earnings" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 text-center py-12">No chart data available</div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {(['overview', 'orders', 'codes'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md capitalize ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              {t}
            </button>
          ))}
        </div>

        {(tab === 'overview' || tab === 'orders') && (
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900">
                {tab === 'orders' ? `All Orders (${ordersTotal})` : 'Recent Sales'}
              </h2>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1">
                <option value="">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>
            </div>
            <OrdersTable orders={tab === 'overview' ? orders.slice(0, 10) : orders} />
            {tab === 'overview' && orders.length > 10 && (
              <div className="px-4 py-3 text-sm text-gray-500 border-t border-gray-100">
                Showing 10 most recent — switch to <button onClick={() => setTab('orders')} className="text-gray-900 font-medium underline">Orders</button> to see all
              </div>
            )}
            {tab === 'orders' && ordersTotal > orders.length && (
              <div className="px-4 py-3 text-sm text-gray-500 border-t border-gray-100">
                Showing {orders.length} of {ordersTotal} orders
              </div>
            )}
          </div>
        )}

        {tab === 'codes' && (
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">Your Discount Codes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-4 py-2 font-medium">Code</th>
                    <th className="px-4 py-2 font-medium">Label</th>
                    <th className="px-4 py-2 font-medium">Discount</th>
                    <th className="px-4 py-2 font-medium">Times Used</th>
                    <th className="px-4 py-2 font-medium">Expires</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.codes.map((c) => {
                    const status = codeStatus(c);
                    return (
                      <tr key={c.id} className="border-b border-gray-50">
                        <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.code}</td>
                        <td className="px-4 py-3 text-gray-600">{c.label || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{(c.discountPercent * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{c.timesUsed}</td>
                        <td className="px-4 py-3 text-gray-600">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</td>
                        <td className={`px-4 py-3 font-medium ${status.color}`}>{status.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {data.codes.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={3}>Total ({data.codes.length} codes)</td>
                      <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{data.codes.reduce((s, c) => s + c.timesUsed, 0)}</td>
                      <td className="px-4 py-3" colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <div className="px-4 py-8 text-sm text-gray-400 text-center">No orders found</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Customer</th>
            <th className="px-4 py-2 font-medium">Items</th>
            <th className="px-4 py-2 font-medium">Code</th>
            <th className="px-4 py-2 font-medium text-right">Order Total</th>
            <th className="px-4 py-2 font-medium text-right">Your Earning</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(o.date)}</td>
              <td className="px-4 py-3 text-gray-900">{o.customerFirstName}</td>
              <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{o.itemsSummary}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.discountCode}</td>
              <td className="px-4 py-3 text-gray-900 text-right">{formatMoney(o.orderTotal)}</td>
              <td className="px-4 py-3 text-green-700 font-medium text-right">{formatMoney(o.commissionEarned)}</td>
            </tr>
          ))}
        </tbody>
        {orders.length > 0 && (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={4}>Total ({orders.length} orders)</td>
              <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{formatMoney(orders.reduce((s, o) => s + o.orderTotal, 0))}</td>
              <td className="px-4 py-3 text-green-700 font-semibold text-right text-sm">{formatMoney(orders.reduce((s, o) => s + o.commissionEarned, 0))}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
