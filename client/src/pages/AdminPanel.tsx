import { useState, useEffect, useRef, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { downloadBusinessOverviewPDF } from '../pdfReport';
import DataTable, { Column } from '../components/DataTable';
import OrderDetailModal from '../components/OrderDetailModal';
import Tutorial, { TutorialStep } from '../components/Tutorial';
import ThemeToggle from '../components/ThemeToggle';
import ViewAsModal from '../components/ViewAsModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

function formatMoney(n: number) { return `$${n.toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatDateTime(d: string) { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
function formatPct(n: number) { return `${(n * 100).toFixed(0)}%`; }

const ADMIN_TUTORIAL_STEPS: TutorialStep[] = [
  // Global steps (shown on every tab)
  { target: '[data-tour="admin-tabs"]', title: 'Navigation Tabs', content: 'Switch between Business Overview, Affiliates, Codes, Orders, Payouts, and more to manage your affiliate program.', position: 'bottom' },
  { target: '[data-tour="theme-toggle"]', title: 'Dark Mode', content: 'Toggle between light and dark mode for your preferred viewing experience.', position: 'left' },

  // Business Overview tab
  { tab: 'business', target: '[data-tour="biz-source-filter"]', title: 'Source Filter', content: 'Filter all metrics by order source — Shopify, WordPress, or view everything combined.', position: 'bottom' },
  { tab: 'business', target: '[data-tour="biz-stats"]', title: 'Key Metrics', content: 'See total revenue, today\'s and this month\'s performance, net revenue after commissions, and more at a glance.', position: 'bottom' },
  { tab: 'business', target: '[data-tour="biz-attribution"]', title: 'Attribution & Affiliates', content: 'Track conversion rate, non-attributed orders, commissions owed, and active affiliates in your program.', position: 'bottom' },
  { tab: 'business', target: '[data-tour="biz-charts"]', title: 'Revenue & Order Volume', content: 'Visualize revenue trends and order volume over time. Toggle between weekly and monthly views.', position: 'top' },
  { tab: 'business', target: '[data-tour="biz-secondary-charts"]', title: 'Commissions & Attribution', content: 'Track commission payouts over time and see how revenue splits between attributed and non-attributed orders.', position: 'top' },
  { tab: 'business', target: '[data-tour="admin-pdf"]', title: 'Download Report', content: 'Export a comprehensive PDF report of all business data including orders, affiliates, and revenue.', position: 'bottom' },

  // Affiliates tab
  { tab: 'affiliates', target: '[data-tour="aff-filter"]', title: 'Affiliate Filter', content: 'Select a specific affiliate to view their individual performance, charts, and earnings breakdown.', position: 'bottom' },
  { tab: 'affiliates', target: '[data-tour="aff-perf-stats"]', title: 'Performance Stats', content: 'View attributed orders, revenue generated, commissions owed, and pending payouts for the selected affiliate or all affiliates.', position: 'bottom' },
  { tab: 'affiliates', target: '[data-tour="aff-perf-charts"]', title: 'Revenue & Commission Charts', content: 'Track affiliate revenue and commission trends. Toggle between weekly and monthly views for deeper insight.', position: 'top' },
  { tab: 'affiliates', target: '[data-tour="aff-top-table"]', title: 'Top Affiliates Leaderboard', content: 'See your highest-performing affiliates ranked by revenue, with order counts and commission totals.', position: 'top' },
  { tab: 'affiliates', target: '[data-tour="aff-crud"]', title: 'Manage Affiliates', content: 'Create, edit, deactivate, or delete affiliates. Click "Add Affiliate" to onboard a new partner.', position: 'top' },

  // Codes tab
  { tab: 'codes', target: '[data-tour="codes-add"]', title: 'Add Discount Code', content: 'Create new discount codes and assign them to affiliates. Set discount percentages, commission overrides, labels, and expiry dates.', position: 'bottom' },
  { tab: 'codes', target: '[data-tour="codes-table"]', title: 'Codes Table', content: 'View all discount codes with their assigned affiliate, discount/commission rates, usage count, expiry, and status. Search, sort, and manage codes here.', position: 'top' },

  // Orders tab
  { tab: 'orders', target: '[data-tour="orders-search"]', title: 'Search Orders', content: 'Search orders by customer name, items, discount code, or affiliate name.', position: 'bottom' },
  { tab: 'orders', target: '[data-tour="orders-filter"]', title: 'Attribution Filter', content: 'Filter orders by attribution status — view all orders, only attributed (from affiliate codes), or non-attributed.', position: 'bottom' },
  { tab: 'orders', target: '[data-tour="orders-table"]', title: 'Orders Table', content: 'Browse all orders with details including customer, items, discount code, affiliate, source, total, and commission. Click any row for full details.', position: 'top' },

  // Payouts tab
  { tab: 'payouts', target: '[data-tour="payouts-create"]', title: 'Create Payout', content: 'Record a new payout for an affiliate. Enter the amount, period, and optional notes.', position: 'bottom' },
  { tab: 'payouts', target: '[data-tour="payouts-table"]', title: 'Payout History', content: 'Track all payouts with affiliate name, period, amount, status, and payment date. Mark pending payouts as paid when processed.', position: 'top' },

  // Admins tab (Super Admin only)
  { tab: 'admins', target: '[data-tour="admins-add"]', title: 'Add Admin', content: 'Create new admin users with either Admin or Super Admin roles. Super Admins can manage other admins and view system logs.', position: 'bottom' },
  { tab: 'admins', target: '[data-tour="admins-table"]', title: 'Admin Management', content: 'View, edit, deactivate, or delete admin accounts. Use "View As" to see the panel from another admin\'s perspective.', position: 'top' },

  // Logs tab (Super Admin only)
  { tab: 'logs', target: '[data-tour="logs-subtabs"]', title: 'Log Types', content: 'Switch between Activity Logs (user actions like logins, CRUD operations) and System Logs (webhooks, errors, API events).', position: 'bottom' },
  { tab: 'logs', target: '[data-tour="logs-content"]', title: 'Log Details', content: 'Browse all logged events with timestamps, users, action types, and expandable details. Use search and filters to find specific entries.', position: 'top' },
];

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'business' | 'affiliates' | 'codes' | 'orders' | 'payouts' | 'admins' | 'logs'>('business');
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const tabs = isSuperAdmin
    ? (['business', 'affiliates', 'codes', 'orders', 'payouts', 'admins', 'logs'] as const)
    : (['business', 'affiliates', 'codes', 'orders', 'payouts'] as const);

  const tabLabels: Record<string, string> = {
    business: 'Business Overview',
    affiliates: 'Affiliates',
    codes: 'Codes',
    orders: 'Orders',
    payouts: 'Payouts',
    admins: 'Admins',
    logs: 'Logs',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
              {isSuperAdmin ? 'Super Admin Panel' : 'Admin Panel'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">{user?.name} {isSuperAdmin && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1">Super</span>}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div data-tour="theme-toggle"><ThemeToggle /></div>
            <button onClick={logout} className="text-xs sm:text-sm text-gray-500 hover:text-gray-900 whitespace-nowrap">Sign out</button>
          </div>
        </div>
      </header>
      <div className="px-4 sm:px-6 py-4 sm:py-6">
        <div data-tour="admin-tabs" className="scrollable-tabs flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-full sm:w-fit">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md whitespace-nowrap ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              {tabLabels[t] || t}
            </button>
          ))}
        </div>
        {tab === 'business' && <BusinessOverviewTab />}
        {tab === 'affiliates' && <AffiliatesTab isSuperAdmin={isSuperAdmin} onViewAs={setViewAsUserId} />}
        {tab === 'codes' && <CodesTab />}
        {tab === 'orders' && <OrdersTab isSuperAdmin={isSuperAdmin} />}
        {tab === 'payouts' && <PayoutsTab />}
        {tab === 'admins' && isSuperAdmin && <AdminsTab onViewAs={setViewAsUserId} />}
        {tab === 'logs' && isSuperAdmin && <LogsTab />}
      </div>
      <Tutorial steps={ADMIN_TUTORIAL_STEPS} storageKey="tutorial_admin" activeTab={tab} />
      {viewAsUserId && <ViewAsModal userId={viewAsUserId} onClose={() => setViewAsUserId(null)} />}
    </div>
  );
}

// ============ BUSINESS OVERVIEW ============

const PIE_COLORS = ['#111827', '#9ca3af'];
const GATEWAY_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function BusinessOverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('weekly');
  const [sourceFilter, setSourceFilter] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - day + (day === 0 ? 0 : 7));
    return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
  });
  const [recentNonAttributed, setRecentNonAttributed] = useState<any[]>([]);
  const [topStores, setTopStores] = useState<any[]>([]);
  const [sourceDist, setSourceDist] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    api.getOrders({ limit: '10', attributed: 'false' }).then((d) => setRecentNonAttributed(d.orders));
  }, []);

  useEffect(() => { loadData(); }, [sourceFilter, startDate, endDate]);

  async function loadData() {
    const src = sourceFilter || undefined;
    const statsParams: any = {};
    if (src) statsParams.source = src;
    if (startDate) statsParams.startDate = startDate;
    if (endDate) statsParams.endDate = endDate;
    const storeParams: any = {};
    if (startDate) storeParams.startDate = startDate;
    if (endDate) storeParams.endDate = endDate;
    const [s, w, m, stores, dist, products] = await Promise.all([
      api.businessStats(statsParams), api.businessWeekly(src), api.businessMonthly(src), api.topStores(storeParams), api.sourceDistribution(storeParams), api.topProducts(statsParams),
    ]);
    setStats(s); setWeeklyData(w); setMonthlyData(m); setTopStores(stores); setSourceDist(dist); setTopProducts(products);
  }

  function handleDownloadPDF() {
    if (!stats) return;
    downloadBusinessOverviewPDF(stats, sourceFilter);
  }

  if (!stats) return <div className="text-gray-500 text-sm">Loading...</div>;

  const chartData = chartView === 'weekly' ? weeklyData : monthlyData;
  const pieData = [
    { name: 'Attributed', value: stats.attributedRevenue },
    { name: 'Non-Attributed', value: stats.nonAttributedRevenue },
  ].filter(d => d.value > 0);

  return (
    <div>
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div data-tour="biz-source-filter" className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <label className="text-sm text-gray-500">Source:</label>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 min-w-[120px]">
            <option value="">All Sources</option>
            <option value="shopify">Shopify</option>
            <option value="wordpress">WordPress</option>
            <option value="stripe">Stripe</option>
          </select>
          <label className="text-xs text-gray-500">From:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5" />
          <label className="text-xs text-gray-500">To:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5" />
          {(sourceFilter || startDate || endDate) && <button onClick={() => { setSourceFilter(''); setStartDate(''); setEndDate(''); }} className="text-xs text-gray-500 hover:text-gray-900">Clear all</button>}
        </div>
        <button data-tour="admin-pdf" onClick={handleDownloadPDF} className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 w-full sm:w-auto">Download PDF Report</button>
      </div>

      {/* Key Metrics */}
      <div className="mb-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Key Metrics</p>
      </div>
      <div data-tour="biz-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={formatMoney(stats.totalRevenue)} sub={`${stats.totalOrders} total orders`} />
        <StatCard label="Today" value={formatMoney(stats.todayRevenue)} sub={`${stats.todayOrders} orders today`} />
        <StatCard label="This Month" value={formatMoney(stats.monthRevenue)} sub={`${stats.monthOrders} orders this month`} />
        <StatCard label="Net Revenue" value={formatMoney(stats.netRevenue)} sub={`After ${formatMoney(stats.totalCommissions)} commissions`} />
      </div>

      {/* Attribution & Affiliate Stats */}
      <div data-tour="biz-attribution" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Conversion Rate" value={`${stats.conversionRate.toFixed(1)}%`} sub={`${stats.attributedOrders} of ${stats.totalOrders} attributed`} />
        <StatCard label="Non-Attributed" value={stats.nonAttributedOrders} sub={formatMoney(stats.nonAttributedRevenue)} />
        <StatCard label="Commissions Owed" value={formatMoney(stats.totalCommissions)} sub={`${formatMoney(stats.pendingPayouts)} pending payout`} />
        <StatCard label="Active Affiliates" value={stats.activeAffiliates} sub={`${stats.activeCodes} active codes`} />
      </div>

      {/* Charts Row 1: Revenue & Orders Volume */}
      <div data-tour="biz-charts" className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900">Revenue & Order Volume</h2>
          <div className="flex gap-1 bg-gray-100 rounded p-0.5">
            <button onClick={() => setChartView('weekly')} className={`px-3 py-1 text-xs rounded ${chartView === 'weekly' ? 'bg-white text-gray-900 font-medium' : 'text-gray-500'}`}>Weekly</button>
            <button onClick={() => setChartView('monthly')} className={`px-3 py-1 text-xs rounded ${chartView === 'monthly' ? 'bg-white text-gray-900 font-medium' : 'text-gray-500'}`}>Monthly</button>
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">Total Revenue</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                  <Area type="monotone" dataKey="totalRevenue" stroke="#111827" fill="#f3f4f6" strokeWidth={2} name="Total Revenue" />
                  <Area type="monotone" dataKey="attributedRevenue" stroke="#16a34a" fill="#dcfce7" strokeWidth={1.5} name="Attributed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">Order Volume</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="attributedOrders" fill="#111827" stackId="orders" radius={[0, 0, 0, 0]} name="Attributed" />
                  <Bar dataKey="nonAttributedOrders" fill="#d1d5db" stackId="orders" radius={[3, 3, 0, 0]} name="Non-Attributed" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center py-12">No chart data available</div>
        )}
      </div>

      {/* Charts Row 2: Commissions, Attribution & Gateway Distribution */}
      <div data-tour="biz-secondary-charts" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Commissions Over Time</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Commissions']} />
                <Line type="monotone" dataKey="commissions" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-gray-400 text-center py-12">No data</div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Revenue Attribution</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-gray-400 text-center py-12">No revenue data</div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Payment Gateway Distribution</h2>
          {sourceDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sourceDist.map(d => ({ name: d.source.charAt(0).toUpperCase() + d.source.slice(1), value: d.orders }))} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {sourceDist.map((_entry, index) => (
                    <Cell key={`gw-${index}`} fill={GATEWAY_COLORS[index % GATEWAY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} orders`, '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-gray-400 text-center py-12">No data</div>
          )}
        </div>
      </div>

      {/* Top Performing Stores */}
      {topStores.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg mb-6">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Top Performing Stores</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-2 text-gray-500 font-medium">Store</th>
                  <th className="px-4 py-2 text-gray-500 font-medium">Source</th>
                  <th className="px-4 py-2 text-gray-500 font-medium text-right">Orders</th>
                  <th className="px-4 py-2 text-gray-500 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2 text-gray-500 font-medium text-right">Commissions</th>
                </tr>
              </thead>
              <tbody>
                {topStores.map((s: any) => (
                  <tr key={s.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-900 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 capitalize">{s.source}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-right">{s.orders}</td>
                    <td className="px-4 py-2.5 text-gray-900 text-right font-medium">{formatMoney(s.revenue)}</td>
                    <td className="px-4 py-2.5 text-green-700 text-right font-medium">{formatMoney(s.commissions)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-sm" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-right text-sm">{topStores.reduce((s, st) => s + st.orders, 0)}</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-right text-sm">{formatMoney(topStores.reduce((s, st) => s + st.revenue, 0))}</td>
                  <td className="px-4 py-2.5 text-green-700 font-semibold text-right text-sm">{formatMoney(topStores.reduce((s, st) => s + st.commissions, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Top Products Sold */}
      {topProducts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg mb-6">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Top Products Sold</h2>
            <span className="text-xs text-gray-400">{topProducts.length} products</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-2 text-gray-500 font-medium">#</th>
                  <th className="px-4 py-2 text-gray-500 font-medium">Product</th>
                  <th className="px-4 py-2 text-gray-500 font-medium text-right">Qty Sold</th>
                  <th className="px-4 py-2 text-gray-500 font-medium text-right">Orders</th>
                  <th className="px-4 py-2 text-gray-500 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p: any, i: number) => (
                  <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-900 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-right">{p.quantity}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-right">{p.orders}</td>
                    <td className="px-4 py-2.5 text-gray-900 text-right font-medium">{formatMoney(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-sm" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-right text-sm">{topProducts.reduce((s, p) => s + p.quantity, 0)}</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-right text-sm">{topProducts.reduce((s, p) => s + p.orders, 0)}</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-right text-sm">{formatMoney(topProducts.reduce((s, p) => s + p.revenue, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Recent Non-Attributed Orders */}
      {recentNonAttributed.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Recent Non-Attributed Orders</h2>
            <span className="text-xs text-gray-400">{stats.nonAttributedOrders} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-2 text-gray-500 font-medium">Date</th>
                  <th className="px-4 py-2 text-gray-500 font-medium">Customer</th>
                  <th className="px-4 py-2 text-gray-500 font-medium">Items</th>
                  <th className="px-4 py-2 text-gray-500 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentNonAttributed.map((o: any) => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                    <td className="px-4 py-2.5 text-gray-900">{[o.customerFirstName, o.customerLastName].filter(Boolean).join(' ')}</td>
                    <td className="px-4 py-2.5 text-gray-600 truncate max-w-[200px]">{o.itemsSummary}</td>
                    <td className="px-4 py-2.5 text-gray-900 text-right font-medium">{formatMoney(o.orderTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-sm" colSpan={3}>Subtotal ({recentNonAttributed.length} shown)</td>
                  <td className="px-4 py-2.5 text-gray-900 font-semibold text-right text-sm">{formatMoney(recentNonAttributed.reduce((s, o) => s + o.orderTotal, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 sm:px-4 py-3 sm:py-4">
      <p className="text-xs text-gray-500 mb-1 truncate">{label}</p>
      <p className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{value}</p>
      <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>
    </div>
  );
}

// ============ AFFILIATES ============

function AffiliatesTab({ isSuperAdmin, onViewAs }: { isSuperAdmin?: boolean; onViewAs?: (id: string) => void }) {
  const [subTab, setSubTab] = useState<'performance' | 'manage'>('performance');
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', defaultCommissionRate: '20' });
  const [selectedAffiliate, setSelectedAffiliate] = useState<string>('');
  const [perfStats, setPerfStats] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [topAffiliates, setTopAffiliates] = useState<any[]>([]);
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadAffiliates(); api.adminTopAffiliates().then(setTopAffiliates); }, []);
  async function loadAffiliates() { setAffiliates(await api.getAffiliates()); }

  useEffect(() => {
    const affId = selectedAffiliate || undefined;
    Promise.all([api.adminStats(affId), api.adminWeekly(affId), api.adminMonthly(affId)])
      .then(([s, w, m]) => { setPerfStats(s); setWeeklyData(w); setMonthlyData(m); });
  }, [selectedAffiliate]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', password: '', defaultCommissionRate: '20' });
    setShowModal(true);
  }

  function openEdit(aff: any) {
    setEditing(aff);
    setForm({ name: aff.name, email: aff.email, password: '', defaultCommissionRate: (aff.defaultCommissionRate * 100).toString() });
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: any = { name: form.name, email: form.email, defaultCommissionRate: parseFloat(form.defaultCommissionRate) / 100 };
    if (editing) {
      if (form.password) payload.password = form.password;
      await api.updateAffiliate(editing.id, payload);
    } else {
      payload.password = form.password;
      await api.createAffiliate(payload);
    }
    setShowModal(false);
    loadAffiliates();
  }

  async function toggleActive(aff: any) { await api.updateAffiliate(aff.id, { active: !aff.active }); loadAffiliates(); }
  async function handleDelete(aff: any) {
    if (!confirm(`Delete affiliate "${aff.name}"?`)) return;
    await api.deleteAffiliate(aff.id); loadAffiliates();
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected affiliate(s)? This will also delete their codes and orders.`)) return;
    await api.batchDeleteAffiliates(Array.from(selectedIds));
    setSelectedIds(new Set());
    loadAffiliates();
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleSelectAll() {
    if (selectedIds.size === affiliates.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(affiliates.map(a => a.id)));
  }

  function handleDownloadAffiliatesCSV() {
    const headers = ['Name', 'Email', 'Password', 'Commission %', 'Codes', 'Status', 'Created'];
    const rows = affiliates.map(a => [
      a.name, a.email, a.passwordPlain || '',
      (a.defaultCommissionRate * 100).toFixed(0) + '%',
      (a.discountCodes || []).map((c: any) => c.code).join('; ') || 'None',
      a.active ? 'Active' : 'Inactive',
      formatDate(a.createdAt),
    ]);
    downloadCSV(rows, headers, `affiliates-${new Date().toISOString().split('T')[0]}.csv`);
  }

  const columns: Column[] = [
    {
      key: '_select', label: '', defaultWidth: 40, sortable: false,
      render: (r: any) => (
        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
          className="rounded border-gray-300" onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: 'name', label: 'Name', defaultWidth: 160, className: 'text-gray-900 font-medium' },
    { key: 'email', label: 'Email', defaultWidth: 200, className: 'text-gray-600' },
    { key: 'passwordPlain', label: 'Password', defaultWidth: 140, render: (r: any) => <PasswordCell password={r.passwordPlain} /> },
    { key: 'defaultCommissionRate', label: 'Commission', defaultWidth: 110, render: (r: any) => formatPct(r.defaultCommissionRate), className: 'text-gray-600' },
    { key: '_codes', label: 'Codes', defaultWidth: 180, render: (r: any) => {
      const codes = r.discountCodes || [];
      if (codes.length === 0) return <span className="text-gray-400">None</span>;
      return <span className="font-mono text-xs text-gray-600">{codes.map((c: any) => c.code).join(', ')}</span>;
    } },
    { key: 'active', label: 'Status', defaultWidth: 90, render: (r: any) => <span className={`text-xs font-medium ${r.active ? 'text-green-700' : 'text-gray-400'}`}>{r.active ? 'Active' : 'Inactive'}</span> },
    {
      key: '_actions', label: 'Actions', defaultWidth: 220, sortable: false,
      render: (r: any) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={() => toggleActive(r)} className="text-xs text-gray-500 hover:underline">{r.active ? 'Deactivate' : 'Activate'}</button>
          <button onClick={() => handleDelete(r)} className="text-xs text-red-500 hover:underline">Delete</button>
          {isSuperAdmin && <button onClick={() => onViewAs?.(r.id)} className="text-xs text-purple-600 hover:underline">View As</button>}
        </div>
      ),
    },
  ];

  const selectedName = selectedAffiliate ? affiliates.find((a) => a.id === selectedAffiliate)?.name || 'Affiliate' : 'All Affiliates';
  const perfChartData = chartView === 'weekly' ? weeklyData : monthlyData;

  const topColumns: Column[] = [
    { key: '_rank', label: '#', defaultWidth: 50, sortable: false, render: (_r: any) => '' },
    { key: 'name', label: 'Name', defaultWidth: 200, className: 'text-gray-900 font-medium' },
    { key: 'orders', label: 'Orders', align: 'right', defaultWidth: 100, className: 'text-gray-600' },
    { key: 'revenue', label: 'Revenue', align: 'right', defaultWidth: 130, render: (r: any) => formatMoney(r.revenue), className: 'text-gray-900' },
    { key: 'commissions', label: 'Commissions', align: 'right', defaultWidth: 130, render: (r: any) => <span className="text-green-700 font-medium">{formatMoney(r.commissions)}</span> },
  ];
  const rankedAffiliates = topAffiliates.map((a, i) => ({ ...a, _rank: i + 1 }));

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setSubTab('performance')}
          className={`px-4 py-1.5 text-sm rounded-md ${subTab === 'performance' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:text-gray-900'}`}>
          Performance
        </button>
        <button onClick={() => setSubTab('manage')}
          className={`px-4 py-1.5 text-sm rounded-md ${subTab === 'manage' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:text-gray-900'}`}>
          Manage Affiliates
        </button>
      </div>

      {subTab === 'performance' && (
        <div>
          {/* Affiliate Performance Overview */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <div data-tour="aff-filter" className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <label className="text-sm text-gray-500">Filter by affiliate:</label>
                <select value={selectedAffiliate} onChange={(e) => setSelectedAffiliate(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-3 py-1.5 min-w-0 w-full sm:w-auto sm:min-w-[200px]">
                  <option value="">All Affiliates</option>
                  {affiliates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {selectedAffiliate && <button onClick={() => setSelectedAffiliate('')} className="text-xs text-gray-500 hover:text-gray-900">Clear</button>}
              </div>
            </div>

            {selectedAffiliate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-sm text-blue-800">
                Showing data for <span className="font-semibold">{selectedName}</span>
              </div>
            )}

            {perfStats && (
              <>
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {selectedAffiliate ? `${selectedName}'s Performance` : 'Affiliate Performance'}
                  </p>
                </div>
                <div data-tour="aff-perf-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatCard
                    label={selectedAffiliate ? 'Their Orders' : 'Attributed Orders'}
                    value={perfStats.attributedOrders}
                    sub={selectedAffiliate ? `${perfStats.totalOrders} total` : `${perfStats.totalOrders - perfStats.attributedOrders} without code`}
                  />
                  <StatCard
                    label={selectedAffiliate ? 'Their Revenue' : 'Affiliate Revenue'}
                    value={formatMoney(perfStats.totalRevenue)}
                    sub="From attributed orders"
                  />
                  <StatCard
                    label={selectedAffiliate ? 'Their Commissions' : 'Commissions Owed'}
                    value={formatMoney(perfStats.totalCommissions)}
                    sub={`${formatMoney(perfStats.pendingPayouts)} pending payout`}
                  />
                  {selectedAffiliate ? (
                    <StatCard label="Pending Payout" value={formatMoney(perfStats.pendingPayouts)} sub="Awaiting payment" />
                  ) : (
                    <StatCard label="Net Revenue" value={formatMoney((perfStats.totalRevenue || 0) - (perfStats.totalCommissions || 0))} sub="Revenue minus commissions" />
                  )}
                </div>

                {/* Charts */}
                <div data-tour="aff-perf-charts" className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-medium text-gray-900">Revenue & Commissions</h2>
                    <div className="flex gap-1 bg-gray-100 rounded p-0.5">
                      <button onClick={() => setChartView('weekly')} className={`px-3 py-1 text-xs rounded ${chartView === 'weekly' ? 'bg-white text-gray-900 font-medium' : 'text-gray-500'}`}>Weekly</button>
                      <button onClick={() => setChartView('monthly')} className={`px-3 py-1 text-xs rounded ${chartView === 'monthly' ? 'bg-white text-gray-900 font-medium' : 'text-gray-500'}`}>Monthly</button>
                    </div>
                  </div>
                  {perfChartData.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Revenue</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={perfChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                            <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                            <Area type="monotone" dataKey="revenue" stroke="#111827" fill="#f3f4f6" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Commissions Owed</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={perfChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                            <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                            <Bar dataKey="commissions" fill="#16a34a" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-8">No chart data available</div>
                  )}
                </div>

                {/* Top Affiliates */}
                {!selectedAffiliate && topAffiliates.length > 0 && (
                  <div data-tour="aff-top-table" className="bg-white border border-gray-200 rounded-lg mb-6">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h2 className="text-sm font-medium text-gray-900">Top Affiliates</h2>
                    </div>
                    <DataTable
                      columns={topColumns}
                      data={rankedAffiliates}
                      footer={
                        <tfoot>
                          <tr className="bg-gray-50 border-t border-gray-200">
                            <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={2}>Total</td>
                            <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{topAffiliates.reduce((s, a) => s + a.orders, 0)}</td>
                            <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{formatMoney(topAffiliates.reduce((s, a) => s + a.revenue, 0))}</td>
                            <td className="px-4 py-3 text-green-700 font-semibold text-right text-sm">{formatMoney(topAffiliates.reduce((s, a) => s + a.commissions, 0))}</td>
                          </tr>
                        </tfoot>
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {subTab === 'manage' && (
        <div>
          {/* Affiliates CRUD Table */}
          <div data-tour="aff-crud" className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-sm font-medium text-gray-900">{affiliates.length} Affiliates</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 && (
                <button onClick={handleBatchDelete}
                  className="text-sm bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700">
                  Delete {selectedIds.size} selected
                </button>
              )}
              <button onClick={handleDownloadAffiliatesCSV}
                className="text-sm border border-gray-300 text-gray-700 px-3 sm:px-4 py-2 rounded hover:bg-gray-50">
                CSV
              </button>
              <button onClick={openCreate} className="bg-gray-900 text-white text-sm px-3 sm:px-4 py-2 rounded hover:bg-gray-800">Add Affiliate</button>
            </div>
          </div>

          {showModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowModal(false)} />
              <div className="relative bg-white rounded-t-xl sm:rounded-lg border border-gray-200 w-full sm:max-w-md sm:mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit' : 'New'} Affiliate</h3>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
                  <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
                  <Input label={editing ? 'New Password (leave blank to keep)' : 'Password'} value={form.password} onChange={(v) => setForm({ ...form, password: v })} required={!editing} />
                  <Input label="Commission %" type="number" value={form.defaultCommissionRate} onChange={(v) => setForm({ ...form, defaultCommissionRate: v })} />
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-gray-900 text-white text-sm px-4 py-2.5 rounded hover:bg-gray-800 font-medium">{editing ? 'Update' : 'Create'}</button>
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 text-sm text-gray-600 px-4 py-2.5 rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <DataTable
              columns={columns}
              data={affiliates}
              emptyMessage="No affiliates yet"
              searchable
              searchKeys={['name', 'email']}
              searchPlaceholder="Search affiliates by name or email..."
              footer={affiliates.length > 0 ? (
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.size === affiliates.length && affiliates.length > 0}
                        onChange={toggleSelectAll} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={3}>Total ({affiliates.length} affiliates)</td>
                    <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{affiliates.reduce((s, a) => s + (a.discountCodes?.length || 0), 0)} codes</td>
                    <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{affiliates.filter(a => a.active).length} active</td>
                    <td className="px-4 py-3" colSpan={2}></td>
                  </tr>
                </tfoot>
              ) : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============ DISCOUNT CODES ============

function CodesTab() {
  const [codes, setCodes] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: '', affiliateId: '', discountPercent: '10', commissionRateOverride: '', label: '', expiresAt: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadCodes(); api.getAffiliates().then(setAffiliates); }, []);
  async function loadCodes() { setCodes(await api.getCodes()); }

  function openCreate() {
    setEditing(null);
    setForm({ code: '', affiliateId: '', discountPercent: '10', commissionRateOverride: '', label: '', expiresAt: '' });
    setShowForm(true);
  }

  function openEdit(c: any) {
    setEditing(c);
    setForm({
      code: c.code, affiliateId: c.affiliateId, discountPercent: (c.discountPercent * 100).toString(),
      commissionRateOverride: c.commissionRateOverride ? (c.commissionRateOverride * 100).toString() : '',
      label: c.label || '', expiresAt: c.expiresAt ? c.expiresAt.split('T')[0] : '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: any = {
      discountPercent: parseFloat(form.discountPercent) / 100,
      commissionRateOverride: form.commissionRateOverride ? parseFloat(form.commissionRateOverride) / 100 : null,
      label: form.label || null, expiresAt: form.expiresAt || null,
    };
    if (editing) { await api.updateCode(editing.id, payload); }
    else { payload.code = form.code; payload.affiliateId = form.affiliateId; await api.createCode(payload); }
    setShowForm(false); loadCodes();
  }

  async function toggleActive(c: any) { await api.updateCode(c.id, { active: !c.active }); loadCodes(); }
  async function handleDelete(c: any) { if (!confirm(`Delete code "${c.code}"?`)) return; await api.deleteCode(c.id); loadCodes(); }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected code(s)? This cannot be undone.`)) return;
    await api.batchDeleteCodes(Array.from(selectedIds));
    setSelectedIds(new Set());
    loadCodes();
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleSelectAll() {
    if (selectedIds.size === codes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(codes.map(c => c.id)));
  }

  function getCodeStatus(c: any) {
    if (!c.active) return { label: 'Inactive', color: 'text-gray-400' };
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { label: 'Expired', color: 'text-red-600' };
    return { label: 'Active', color: 'text-green-700' };
  }

  const columns: Column[] = [
    {
      key: '_select', label: '', defaultWidth: 40, sortable: false,
      render: (r: any) => (
        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
          className="rounded border-gray-300" onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: 'code', label: 'Code', defaultWidth: 130, className: 'font-mono font-medium text-gray-900' },
    { key: 'affiliate.name', label: 'Affiliate', defaultWidth: 150, className: 'text-gray-600' },
    { key: 'discountPercent', label: 'Discount', defaultWidth: 100, render: (r: any) => formatPct(r.discountPercent), className: 'text-gray-600' },
    { key: 'commissionRateOverride', label: 'Commission', defaultWidth: 110, render: (r: any) => r.commissionRateOverride ? formatPct(r.commissionRateOverride) : '—', className: 'text-gray-600' },
    { key: 'label', label: 'Label', defaultWidth: 130, className: 'text-gray-500' },
    { key: '_used', label: 'Used', defaultWidth: 80, render: (r: any) => <span className="text-gray-900 font-medium">{r._count?.orders || 0}×</span> },
    { key: 'expiresAt', label: 'Expires', defaultWidth: 130, render: (r: any) => r.expiresAt ? formatDate(r.expiresAt) : 'Never', className: 'text-gray-500' },
    { key: 'active', label: 'Status', defaultWidth: 90, render: (r: any) => { const s = getCodeStatus(r); return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>; } },
    {
      key: '_actions', label: 'Actions', defaultWidth: 180, sortable: false,
      render: (r: any) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={() => toggleActive(r)} className="text-xs text-gray-500 hover:underline">{r.active ? 'Deactivate' : 'Activate'}</button>
          <button onClick={() => handleDelete(r)} className="text-xs text-red-500 hover:underline">Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h2 className="text-sm font-medium text-gray-900">{codes.length} Discount Codes</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button onClick={handleBatchDelete}
              className="text-sm bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700">
              Delete {selectedIds.size} selected
            </button>
          )}
          <button data-tour="codes-add" onClick={openCreate} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Add Code</button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-t-xl sm:rounded-lg border border-gray-200 w-full sm:max-w-md sm:mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit' : 'New'} Discount Code</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {!editing && <Input label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} required placeholder="e.g. INFLUENCER10" />}
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Affiliate</label>
                  <select value={form.affiliateId} onChange={(e) => setForm({ ...form, affiliateId: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required>
                    <option value="">Select affiliate...</option>
                    {affiliates.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
                  </select>
                </div>
              )}
              <Input label="Discount %" type="number" value={form.discountPercent} onChange={(v) => setForm({ ...form, discountPercent: v })} />
              <Input label="Commission % Override (blank = use affiliate default)" type="number" value={form.commissionRateOverride} onChange={(v) => setForm({ ...form, commissionRateOverride: v })} />
              <Input label="Label" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="e.g. TikTok Summer" />
              <Input label="Expires On" type="date" value={form.expiresAt} onChange={(v) => setForm({ ...form, expiresAt: v })} />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-gray-900 text-white text-sm px-4 py-2.5 rounded hover:bg-gray-800 font-medium">{editing ? 'Update' : 'Create'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 text-sm text-gray-600 px-4 py-2.5 rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div data-tour="codes-table" className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <DataTable
          columns={columns}
          data={codes}
          emptyMessage="No discount codes yet"
          searchable
          searchKeys={['code', 'affiliate.name', 'label']}
          searchPlaceholder="Search codes, affiliates, or labels..."
          footer={codes.length > 0 ? (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selectedIds.size === codes.length && codes.length > 0}
                    onChange={toggleSelectAll} className="rounded border-gray-300" />
                </td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={5}>Total ({codes.length} codes)</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{codes.reduce((s, c) => s + (c._count?.orders || 0), 0)}×</td>
                <td className="px-4 py-3" colSpan={3}></td>
              </tr>
            </tfoot>
          ) : undefined}
        />
      </div>
    </div>
  );
}

// ============ ORDERS ============

function downloadCSV(rows: string[][], headers: string[], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function OrdersTab({ isSuperAdmin }: { isSuperAdmin?: boolean }) {
  const [data, setData] = useState<{ orders: any[]; total: number }>({ orders: [], total: 0 });
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - day + (day === 0 ? 0 : 7));
    return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
  });
  const [sourceFilter, setSourceFilter] = useState('');
  const [storeNameFilter, setStoreNameFilter] = useState('');
  const [storeNameDebounced, setStoreNameDebounced] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const searchTimer = useRef<any>(null);
  const storeNameTimer = useRef<any>(null);

  function handleSearch(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchDebounced(val);
      setPage(1);
    }, 400);
  }

  function handleStoreNameFilter(val: string) {
    setStoreNameFilter(val);
    if (storeNameTimer.current) clearTimeout(storeNameTimer.current);
    storeNameTimer.current = setTimeout(() => {
      setStoreNameDebounced(val);
      setPage(1);
    }, 400);
  }

  useEffect(() => { setPage(1); }, [filter, startDate, endDate, sourceFilter, storeNameDebounced, currencyFilter]);
  useEffect(() => { loadOrders(); }, [page, filter, searchDebounced, startDate, endDate, sourceFilter, storeNameDebounced, currencyFilter]);

  function loadOrders() {
    const params: any = { page: page.toString(), limit: '50' };
    if (filter === 'yes') params.attributed = 'true';
    if (filter === 'no') params.attributed = 'false';
    if (searchDebounced.trim()) params.search = searchDebounced.trim();
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (sourceFilter) params.source = sourceFilter;
    if (storeNameDebounced.trim()) params.storeName = storeNameDebounced.trim();
    if (currencyFilter) params.currency = currencyFilter;
    api.getOrders(params).then((d) => { setData(d); setSelectedIds(new Set()); });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    await api.deleteOrder(id);
    loadOrders();
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected order(s)? This cannot be undone.`)) return;
    await api.batchDeleteOrders(Array.from(selectedIds));
    setSelectedIds(new Set());
    loadOrders();
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleSelectAll() {
    if (selectedIds.size === data.orders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(data.orders.map(o => o.id)));
  }

  function handleDownloadCSV() {
    const headers = ['Date', 'Customer', 'Items', 'Code', 'Affiliate', 'Source', 'Store', 'Currency', 'Total', 'Commission', 'Attributed'];
    const rows = data.orders.map(o => [
      formatDateTime(o.createdAt), o.customerFirstName, o.itemsSummary,
      o.discountCode?.code || '', o.discountCode?.affiliate?.name || '',
      o.source, o.storeName || '', o.currency || 'USD', o.orderTotal.toFixed(2), o.commissionEarned.toFixed(2),
      o.attributed ? 'Yes' : 'No',
    ]);
    downloadCSV(rows, headers, `orders-${new Date().toISOString().split('T')[0]}.csv`);
  }

  const columns: Column[] = [
    {
      key: '_select', label: '', defaultWidth: 40, sortable: false,
      render: (r: any) => (
        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
          className="rounded border-gray-300" onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: 'createdAt', label: 'Date & Time', defaultWidth: 180, render: (r: any) => <span className="text-gray-500 text-xs">{formatDateTime(r.createdAt)}</span> },
    { key: 'customerFirstName', label: 'Customer', defaultWidth: 150, render: (r: any) => <span className="text-gray-900">{[r.customerFirstName, r.customerLastName].filter(Boolean).join(' ')}</span> },
    { key: 'itemsSummary', label: 'Items', defaultWidth: 220, className: 'text-gray-600' },
    { key: 'discountCode.code', label: 'Code', defaultWidth: 110, render: (r: any) => <span className="font-mono text-xs text-gray-500">{r.discountCode?.code || '—'}</span> },
    { key: 'discountCode.affiliate.name', label: 'Affiliate', defaultWidth: 130, render: (r: any) => r.discountCode?.affiliate?.name || '—', className: 'text-gray-600' },
    { key: 'source', label: 'Source', defaultWidth: 90, render: (r: any) => <span className="capitalize text-gray-500">{r.source}</span> },
    { key: 'storeName', label: 'Store', defaultWidth: 130, render: (r: any) => <span className="text-gray-500 text-xs">{r.storeName || '—'}</span> },
    { key: 'currency', label: 'Currency', defaultWidth: 80, render: (r: any) => <span className="text-gray-500 text-xs">{r.currency || 'USD'}</span> },
    { key: 'orderTotal', label: 'Total', align: 'right', defaultWidth: 110, render: (r: any) => formatMoney(r.orderTotal), className: 'text-gray-900' },
    { key: 'commissionEarned', label: 'Commission', align: 'right', defaultWidth: 110, render: (r: any) => <span className="text-green-700 font-medium">{formatMoney(r.commissionEarned)}</span> },
    { key: 'attributed', label: 'Attributed', defaultWidth: 90, render: (r: any) => <span className={`text-xs ${r.attributed ? 'text-green-700' : 'text-gray-400'}`}>{r.attributed ? 'Yes' : 'No'}</span> },
    {
      key: '_actions', label: 'Actions', defaultWidth: 80, sortable: false,
      render: (r: any) => <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline">Delete</button>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-sm font-medium text-gray-900">All Orders ({data.total})</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div data-tour="orders-search" className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search orders..."
              className="pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded w-full sm:w-64 focus:outline-none focus:border-gray-900"
            />
            {search && (
              <button onClick={() => { setSearch(''); setSearchDebounced(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">&times;</button>
            )}
          </div>
          <div data-tour="orders-filter" className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {([['all', 'All'], ['yes', 'Attributed'], ['no', 'Not Attributed']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-1 text-xs rounded-md flex-1 sm:flex-none ${filter === val ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Date Range + Source/Currency Filters + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-gray-500">From:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1" />
          <label className="text-xs text-gray-500">To:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1" />
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1">
            <option value="">All Sources</option>
            <option value="shopify">Shopify</option>
            <option value="wordpress">WordPress</option>
            <option value="stripe">Stripe</option>
          </select>
          <input type="text" value={storeNameFilter} onChange={(e) => handleStoreNameFilter(e.target.value)}
            placeholder="Filter by store..." className="text-sm border border-gray-300 rounded px-2 py-1 w-32 sm:w-40" />
          <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1">
            <option value="">All Currencies</option>
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
          {(startDate || endDate || sourceFilter || storeNameFilter || currencyFilter) && (
            <button onClick={() => { setStartDate(''); setEndDate(''); setSourceFilter(''); setStoreNameFilter(''); setStoreNameDebounced(''); setCurrencyFilter(''); }} className="text-xs text-gray-500 hover:text-gray-900">Clear all</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={handleBatchDelete}
              className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700">
              Delete {selectedIds.size} selected
            </button>
          )}
          <button onClick={handleDownloadCSV}
            className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50">
            Download CSV
          </button>
        </div>
      </div>

      <div data-tour="orders-table" className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <DataTable
          columns={columns}
          data={data.orders}
          emptyMessage="No orders yet"
          onRowClick={(row) => setSelectedOrder(row)}
          footer={data.orders.length > 0 ? (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3" >
                  <input type="checkbox" checked={selectedIds.size === data.orders.length && data.orders.length > 0}
                    onChange={toggleSelectAll} className="rounded border-gray-300" />
                </td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={7}>Total ({data.orders.length} orders on this page)</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{formatMoney(data.orders.reduce((s, o) => s + o.orderTotal, 0))}</td>
                <td className="px-4 py-3 text-green-700 font-semibold text-right text-sm">{formatMoney(data.orders.reduce((s, o) => s + o.commissionEarned, 0))}</td>
                <td className="px-4 py-3" colSpan={2}></td>
              </tr>
            </tfoot>
          ) : undefined}
        />
        {data.total > 50 && (
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2 text-sm">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="text-gray-500 hover:text-gray-900 disabled:opacity-30">Previous</button>
            <span className="text-gray-400">Page {page}</span>
            <button onClick={() => setPage(page + 1)} disabled={data.orders.length < 50} className="text-gray-500 hover:text-gray-900 disabled:opacity-30">Next</button>
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          isAdmin
          isSuperAdmin={isSuperAdmin}
          onDelete={(id) => { handleDelete(id); setSelectedOrder(null); }}
          onUpdated={(updated) => { setSelectedOrder(updated); loadOrders(); }}
        />
      )}
    </div>
  );
}

// ============ PAYOUTS ============

function PayoutsTab() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ affiliateId: '', amount: '', period: '', notes: '' });

  useEffect(() => { loadPayouts(); api.getAffiliates().then(setAffiliates); }, []);
  async function loadPayouts() { setPayouts(await api.getPayouts()); }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await api.createPayout({ affiliateId: form.affiliateId, amount: parseFloat(form.amount), period: form.period, notes: form.notes || null });
    setShowForm(false); setForm({ affiliateId: '', amount: '', period: '', notes: '' }); loadPayouts();
  }

  async function markPaid(id: string) { await api.updatePayout(id, { status: 'PAID' }); loadPayouts(); }

  const columns: Column[] = [
    { key: 'affiliate.name', label: 'Affiliate', defaultWidth: 160, className: 'text-gray-900' },
    { key: 'period', label: 'Period', defaultWidth: 140, className: 'text-gray-600' },
    { key: 'amount', label: 'Amount', align: 'right', defaultWidth: 120, render: (r: any) => <span className="font-medium">{formatMoney(r.amount)}</span>, className: 'text-gray-900' },
    { key: 'notes', label: 'Notes', defaultWidth: 150, render: (r: any) => r.notes || '—', className: 'text-gray-500' },
    { key: 'status', label: 'Status', defaultWidth: 100, render: (r: any) => <span className={`text-xs font-medium ${r.status === 'PAID' ? 'text-green-700' : r.status === 'PROCESSING' ? 'text-yellow-600' : 'text-gray-500'}`}>{r.status}</span> },
    { key: 'paidAt', label: 'Paid At', defaultWidth: 140, render: (r: any) => r.paidAt ? formatDate(r.paidAt) : '—', className: 'text-gray-500' },
    {
      key: '_actions', label: 'Actions', defaultWidth: 100, sortable: false,
      render: (r: any) => r.status === 'PENDING' ? <button onClick={() => markPaid(r.id)} className="text-xs text-green-600 hover:underline">Mark Paid</button> : null,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h2 className="text-sm font-medium text-gray-900">{payouts.length} Payouts</h2>
        <button data-tour="payouts-create" onClick={() => setShowForm(true)} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800 w-full sm:w-auto">Create Payout</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-t-xl sm:rounded-lg border border-gray-200 w-full sm:max-w-md sm:mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">New Payout</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Affiliate</label>
                <select value={form.affiliateId} onChange={(e) => setForm({ ...form, affiliateId: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required>
                  <option value="">Select...</option>
                  {affiliates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <Input label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required placeholder="0.00" />
              <Input label="Period" value={form.period} onChange={(v) => setForm({ ...form, period: v })} required placeholder="e.g. March 2026" />
              <Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Optional" />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-gray-900 text-white text-sm px-4 py-2.5 rounded hover:bg-gray-800 font-medium">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 text-sm text-gray-600 px-4 py-2.5 rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div data-tour="payouts-table" className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <DataTable
          columns={columns}
          data={payouts}
          emptyMessage="No payouts yet"
          footer={payouts.length > 0 ? (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={2}>Total ({payouts.length} payouts)</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{formatMoney(payouts.reduce((s, p) => s + p.amount, 0))}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{payouts.filter(p => p.status === 'PAID').length} paid, {payouts.filter(p => p.status === 'PENDING').length} pending</td>
                <td className="px-4 py-3" colSpan={2}></td>
              </tr>
            </tfoot>
          ) : undefined}
        />
      </div>
    </div>
  );
}

// ============ ADMINS (Super Admin only) ============

function AdminsTab({ onViewAs }: { onViewAs: (id: string) => void }) {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'ADMIN' });

  useEffect(() => { loadAdmins(); }, []);
  async function loadAdmins() { setAdmins(await api.getAdmins()); }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'ADMIN' });
    setShowModal(true);
  }

  function openEdit(admin: any) {
    setEditing(admin);
    setForm({ name: admin.name, email: admin.email, password: '', role: admin.role });
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: any = { name: form.name, email: form.email, role: form.role };
    if (editing) {
      if (form.password) payload.password = form.password;
      await api.updateAdmin(editing.id, payload);
    } else {
      payload.password = form.password;
      await api.createAdmin(payload);
    }
    setShowModal(false);
    loadAdmins();
  }

  async function toggleActive(admin: any) {
    await api.updateAdmin(admin.id, { active: !admin.active });
    loadAdmins();
  }

  async function handleDelete(admin: any) {
    if (admin.id === user?.id) { alert("Can't delete your own account"); return; }
    if (!confirm(`Delete admin "${admin.name}"?`)) return;
    await api.deleteAdmin(admin.id);
    loadAdmins();
  }

  const columns: Column[] = [
    { key: 'name', label: 'Name', defaultWidth: 160, className: 'text-gray-900 font-medium' },
    { key: 'email', label: 'Email', defaultWidth: 220, className: 'text-gray-600' },
    { key: 'passwordPlain', label: 'Password', defaultWidth: 140, render: (r: any) => <PasswordCell password={r.passwordPlain} /> },
    {
      key: 'role', label: 'Role', defaultWidth: 120,
      render: (r: any) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${r.role === 'SUPER_ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
          {r.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
        </span>
      ),
    },
    {
      key: 'active', label: 'Status', defaultWidth: 90,
      render: (r: any) => <span className={`text-xs font-medium ${r.active ? 'text-green-700' : 'text-gray-400'}`}>{r.active ? 'Active' : 'Inactive'}</span>,
    },
    {
      key: 'createdAt', label: 'Created', defaultWidth: 130,
      render: (r: any) => <span className="text-xs text-gray-500">{formatDate(r.createdAt)}</span>,
    },
    {
      key: '_actions', label: 'Actions', defaultWidth: 200, sortable: false,
      render: (r: any) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={() => toggleActive(r)} className="text-xs text-gray-500 hover:underline">{r.active ? 'Deactivate' : 'Activate'}</button>
          {r.id !== user?.id && <button onClick={() => handleDelete(r)} className="text-xs text-red-500 hover:underline">Delete</button>}
          <button onClick={() => onViewAs(r.id)} className="text-xs text-purple-600 hover:underline">View As</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h2 className="text-sm font-medium text-gray-900">{admins.length} Admins</h2>
        <button data-tour="admins-add" onClick={openCreate} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800 w-full sm:w-auto">Add Admin</button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit' : 'New'} Admin</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
              <Input label={editing ? 'New Password (leave blank to keep)' : 'Password'} value={form.password} onChange={(v) => setForm({ ...form, password: v })} required={!editing} />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-gray-900 text-white text-sm px-4 py-2.5 rounded hover:bg-gray-800 font-medium">{editing ? 'Update' : 'Create'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 text-sm text-gray-600 px-4 py-2.5 rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div data-tour="admins-table" className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <DataTable
          columns={columns}
          data={admins}
          emptyMessage="No admins"
          searchable
          searchKeys={['name', 'email']}
          searchPlaceholder="Search admins..."
        />
      </div>
    </div>
  );
}

// ============ PASSWORD CELL ============

function PasswordCell({ password }: { password: string | null }) {
  const [visible, setVisible] = useState(false);
  if (!password) return <span className="text-gray-400 text-xs">Not set</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-gray-600">{visible ? password : '••••••••'}</span>
      <button onClick={() => setVisible(!visible)} className="text-gray-400 hover:text-gray-700 text-xs p-0.5" title={visible ? 'Hide' : 'Show'}>
        {visible ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

// ============ SHARED INPUT ============

function Input({ label, value, onChange, type = 'text', required = false, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
        required={required} placeholder={placeholder} step={type === 'number' ? 'any' : undefined} />
    </div>
  );
}

// ============ LOGS TAB ============

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN: { label: 'Login', color: 'bg-blue-100 text-blue-700' },
  LOGIN_FAILED: { label: 'Login Failed', color: 'bg-red-100 text-red-700' },
  CREATE_AFFILIATE: { label: 'Create Affiliate', color: 'bg-green-100 text-green-700' },
  UPDATE_AFFILIATE: { label: 'Update Affiliate', color: 'bg-yellow-100 text-yellow-700' },
  DELETE_AFFILIATE: { label: 'Delete Affiliate', color: 'bg-red-100 text-red-700' },
  CREATE_CODE: { label: 'Create Code', color: 'bg-green-100 text-green-700' },
  UPDATE_CODE: { label: 'Update Code', color: 'bg-yellow-100 text-yellow-700' },
  DELETE_CODE: { label: 'Delete Code', color: 'bg-red-100 text-red-700' },
  DELETE_ORDER: { label: 'Delete Order', color: 'bg-red-100 text-red-700' },
  CREATE_PAYOUT: { label: 'Create Payout', color: 'bg-green-100 text-green-700' },
  UPDATE_PAYOUT: { label: 'Update Payout', color: 'bg-yellow-100 text-yellow-700' },
  CREATE_ADMIN: { label: 'Create Admin', color: 'bg-purple-100 text-purple-700' },
  UPDATE_ADMIN: { label: 'Update Admin', color: 'bg-purple-100 text-purple-700' },
  DELETE_ADMIN: { label: 'Delete Admin', color: 'bg-red-100 text-red-700' },
  VIEW_AS: { label: 'View As', color: 'bg-indigo-100 text-indigo-700' },
};

const LEVEL_STYLES: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-700',
  WARN: 'bg-yellow-100 text-yellow-700',
  ERROR: 'bg-red-100 text-red-700',
};

function LogsTab() {
  const [subTab, setSubTab] = useState<'activity' | 'system'>('activity');

  return (
    <div>
      <div data-tour="logs-subtabs" className="flex gap-2 mb-4">
        <button onClick={() => setSubTab('activity')}
          className={`px-3 py-1.5 text-sm rounded-md ${subTab === 'activity' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:text-gray-900'}`}>
          Activity Logs
        </button>
        <button onClick={() => setSubTab('system')}
          className={`px-3 py-1.5 text-sm rounded-md ${subTab === 'system' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:text-gray-900'}`}>
          System Logs
        </button>
      </div>
      <div data-tour="logs-content">
        {subTab === 'activity' ? <ActivityLogsPanel /> : <SystemLogsPanel />}
      </div>
    </div>
  );
}

function ActivityLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 30;

  useEffect(() => {
    api.getAuditActions().then(setActions);
    api.getAuditStats().then(setStats);
  }, []);

  useEffect(() => { loadLogs(); }, [page, actionFilter, search]);

  async function loadLogs() {
    const params: any = { page: String(page), limit: String(limit) };
    if (actionFilter) params.action = actionFilter;
    if (search) params.search = search;
    const data = await api.getAuditLogs(params);
    setLogs(data.logs);
    setTotal(data.total);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Actions Today</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalToday}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Actions This Week</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalWeek}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Logins Today</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.loginsToday}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">System Errors Today</p>
            <p className={`text-2xl font-bold mt-1 ${stats.errorsToday > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.errorsToday}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by user, action, details..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-900" />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Action Type</label>
            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-900 bg-white">
              <option value="">All Actions</option>
              {actions.map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>
              ))}
            </select>
          </div>
          <button onClick={() => { setSearch(''); setActionFilter(''); setPage(1); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900">Clear</button>
        </div>
      </div>

      {/* Log entries */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-100">
          {logs.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No activity logs found</div>
          )}
          {logs.map((log) => {
            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' };
            const details = log.details ? JSON.parse(log.details) : null;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${actionInfo.color}`}>
                      {actionInfo.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-gray-900 font-medium">
                        {log.userName || log.userEmail || 'System'}
                      </span>
                      {log.userRole && (
                        <span className="text-xs text-gray-400 ml-1.5">({log.userRole})</span>
                      )}
                      {log.entity && (
                        <span className="text-xs text-gray-500 ml-2">
                          on {log.entity}{log.entityId ? ` #${log.entityId.substring(0, 8)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {log.ipAddress && (
                      <span className="text-xs text-gray-400 hidden md:block">{log.ipAddress}</span>
                    )}
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {isExpanded && details && (
                  <div className="mt-2 ml-0 p-3 bg-gray-50 rounded text-xs font-mono text-gray-600 overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">
            Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SystemLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 30;

  useEffect(() => { loadLogs(); }, [page, levelFilter, sourceFilter, search]);

  async function loadLogs() {
    const params: any = { page: String(page), limit: String(limit) };
    if (levelFilter) params.level = levelFilter;
    if (sourceFilter) params.source = sourceFilter;
    if (search) params.search = search;
    const data = await api.getSystemLogs(params);
    setLogs(data.logs);
    setTotal(data.total);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search messages, sources..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-900" />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Level</label>
            <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-900 bg-white">
              <option value="">All Levels</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="ERROR">Error</option>
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
            <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-900 bg-white">
              <option value="">All Sources</option>
              <option value="WEBHOOK">Webhook</option>
              <option value="API">API</option>
              <option value="AUTH">Auth</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>
          <button onClick={() => { setSearch(''); setLevelFilter(''); setSourceFilter(''); setPage(1); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900">Clear</button>
        </div>
      </div>

      {/* Log entries */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="divide-y divide-gray-100">
          {logs.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No system logs found</div>
          )}
          {logs.map((log) => {
            const levelStyle = LEVEL_STYLES[log.level] || 'bg-gray-100 text-gray-700';
            const details = log.details ? JSON.parse(log.details) : null;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${levelStyle}`}>
                      {log.level}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                      {log.source}
                    </span>
                    <span className="text-sm text-gray-900 truncate">{log.message}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {isExpanded && details && (
                  <div className="mt-2 ml-0 p-3 bg-gray-50 rounded text-xs font-mono text-gray-600 overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">
            Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
