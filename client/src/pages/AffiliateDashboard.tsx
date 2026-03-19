import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { downloadAffiliateReport } from '../pdfReport';
import DataTable, { Column } from '../components/DataTable';
import OrderDetailModal from '../components/OrderDetailModal';
import Tutorial, { TutorialStep } from '../components/Tutorial';
import ThemeToggle from '../components/ThemeToggle';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';

const AFFILIATE_TUTORIAL_STEPS: TutorialStep[] = [
  // Global steps (shown on every tab)
  { target: '[data-tour="aff-stats"]', title: 'Your Earnings', content: "See your earnings at a glance — today's, this month's, all time, and pending payouts.", position: 'bottom' },
  { target: '[data-tour="aff-charts"]', title: 'Sales Charts', content: 'View your revenue and earnings over time. Toggle between weekly and monthly views.', position: 'top' },
  { target: '[data-tour="aff-tabs"]', title: 'Navigation', content: 'Switch between Overview (recent sales), all Orders, and your discount Codes.', position: 'bottom' },
  { target: '[data-tour="aff-pdf"]', title: 'Download Report', content: 'Export a PDF report of your sales and earnings to share or keep for your records.', position: 'bottom' },
  { target: '[data-tour="theme-toggle"]', title: 'Dark Mode', content: 'Toggle between light and dark mode.', position: 'left' },

  // Overview tab
  { tab: 'overview', target: '[data-tour="aff-recent-sales"]', title: 'Recent Sales', content: 'Your 10 most recent orders appear here. Click any row to see full order details including customer info and items.', position: 'top' },

  // Orders tab
  { tab: 'orders', target: '[data-tour="aff-period-filter"]', title: 'Time Period Filter', content: 'Filter orders by time period — view today\'s, this week\'s, this month\'s, or all-time orders.', position: 'bottom' },
  { tab: 'orders', target: '[data-tour="aff-orders-table"]', title: 'All Orders', content: 'Browse all your orders with date, customer, items, discount code used, order total, and your earnings. Click any row for details.', position: 'top' },

  // Codes tab
  { tab: 'codes', target: '[data-tour="aff-codes-table"]', title: 'Your Discount Codes', content: 'See all your assigned discount codes with their discount percentage, usage count, expiry date, and status. Share active codes with customers.', position: 'top' },
];

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
function formatDateTime(d: string) { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }

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
            <button data-tour="aff-pdf" onClick={handleDownloadPDF}
              className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50">
              Download PDF Report
            </button>
            <div data-tour="theme-toggle"><ThemeToggle /></div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div data-tour="aff-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Today's Earnings" value={formatMoney(data.stats.daily.earnings)} sub={`${data.stats.daily.orders} orders`} />
          <StatCard label="This Month" value={formatMoney(data.stats.monthly.earnings)} sub={`${data.stats.monthly.orders} orders`} />
          <StatCard label="All Time Earnings" value={formatMoney(data.stats.total.earnings)} sub={`${data.stats.total.orders} orders`} />
          <StatCard label="Pending Payout" value={formatMoney(data.payouts.pending)} sub={`${formatMoney(data.payouts.paid)} paid`} />
        </div>

        {/* Charts */}
        <div data-tour="aff-charts" className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
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
        <div data-tour="aff-tabs" className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {(['overview', 'orders', 'codes'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md capitalize ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              {t}
            </button>
          ))}
        </div>

        {(tab === 'overview' || tab === 'orders') && (
          <div data-tour={tab === 'overview' ? 'aff-recent-sales' : 'aff-orders-table'} className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900">
                {tab === 'orders' ? `All Orders (${ordersTotal})` : 'Recent Sales'}
              </h2>
              <select data-tour="aff-period-filter" value={period} onChange={(e) => setPeriod(e.target.value)}
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
          <div data-tour="aff-codes-table" className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">Your Discount Codes</h2>
            </div>
            <DataTable
              columns={[
                { key: 'code', label: 'Code', defaultWidth: 150, className: 'font-mono font-medium text-gray-900' },
                { key: 'label', label: 'Label', defaultWidth: 150, render: (r: any) => r.label || '—', className: 'text-gray-600' },
                { key: 'discountPercent', label: 'Discount', defaultWidth: 100, render: (r: any) => `${(r.discountPercent * 100).toFixed(0)}%`, className: 'text-gray-600' },
                { key: 'timesUsed', label: 'Times Used', defaultWidth: 110, className: 'text-gray-900 font-medium' },
                { key: 'expiresAt', label: 'Expires', defaultWidth: 140, render: (r: any) => r.expiresAt ? formatDate(r.expiresAt) : 'Never', className: 'text-gray-600' },
                { key: 'active', label: 'Status', defaultWidth: 100, render: (r: any) => { const s = codeStatus(r); return <span className={`font-medium ${s.color}`}>{s.label}</span>; } },
              ]}
              data={data.codes}
              footer={data.codes.length > 0 ? (
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={3}>Total ({data.codes.length} codes)</td>
                    <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{data.codes.reduce((s, c) => s + c.timesUsed, 0)}</td>
                    <td className="px-4 py-3" colSpan={2}></td>
                  </tr>
                </tfoot>
              ) : undefined}
            />
          </div>
        )}
      </div>
      <Tutorial steps={AFFILIATE_TUTORIAL_STEPS} storageKey="tutorial_affiliate" activeTab={tab} />
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
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const columns: Column[] = [
    { key: 'date', label: 'Date & Time', defaultWidth: 180, render: (r: any) => <span className="text-gray-500 text-xs">{formatDateTime(r.date)}</span> },
    { key: 'customerFirstName', label: 'Customer', defaultWidth: 120, className: 'text-gray-900' },
    { key: 'itemsSummary', label: 'Items', defaultWidth: 250, className: 'text-gray-600' },
    { key: 'discountCode', label: 'Code', defaultWidth: 120, render: (r: any) => <span className="font-mono text-xs text-gray-500">{r.discountCode}</span> },
    { key: 'orderTotal', label: 'Order Total', align: 'right', defaultWidth: 120, render: (r: any) => formatMoney(r.orderTotal), className: 'text-gray-900' },
    { key: 'commissionEarned', label: 'Your Earning', align: 'right', defaultWidth: 120, render: (r: any) => <span className="text-green-700 font-medium">{formatMoney(r.commissionEarned)}</span> },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={orders}
        emptyMessage="No orders found"
        onRowClick={(row) => setSelectedOrder(row)}
        footer={orders.length > 0 ? (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={4}>Total ({orders.length} orders)</td>
              <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{formatMoney(orders.reduce((s, o) => s + o.orderTotal, 0))}</td>
              <td className="px-4 py-3 text-green-700 font-semibold text-right text-sm">{formatMoney(orders.reduce((s, o) => s + o.commissionEarned, 0))}</td>
            </tr>
          </tfoot>
        ) : undefined}
      />
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}
