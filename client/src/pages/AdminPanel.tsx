import { useState, useEffect, useRef, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { downloadAdminReport } from '../pdfReport';
import DataTable, { Column } from '../components/DataTable';
import OrderDetailModal from '../components/OrderDetailModal';
import Tutorial, { TutorialStep } from '../components/Tutorial';
import ThemeToggle from '../components/ThemeToggle';
import ViewAsModal from '../components/ViewAsModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';

function formatMoney(n: number) { return `$${n.toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatDateTime(d: string) { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
function formatPct(n: number) { return `${(n * 100).toFixed(0)}%`; }

const ADMIN_TUTORIAL_STEPS: TutorialStep[] = [
  { target: '[data-tour="admin-tabs"]', title: 'Navigation Tabs', content: 'Switch between Overview, Affiliates, Codes, Orders, and Payouts to manage your affiliate program.', position: 'bottom' },
  { target: '[data-tour="admin-stats"]', title: 'Dashboard Overview', content: 'See your total affiliates, orders, revenue, and commissions at a glance. Use the filter to view a specific affiliate\'s performance.', position: 'bottom' },
  { target: '[data-tour="admin-charts"]', title: 'Revenue Charts', content: 'Toggle between weekly and monthly views to track revenue and commissions over time.', position: 'top' },
  { target: '[data-tour="admin-filter"]', title: 'Affiliate Filter', content: 'Select an affiliate from the dropdown to view their individual performance, charts, and orders.', position: 'bottom' },
  { target: '[data-tour="admin-pdf"]', title: 'Download Reports', content: 'Export a PDF report of all affiliate data, including orders and commissions.', position: 'bottom' },
  { target: '[data-tour="theme-toggle"]', title: 'Dark Mode', content: 'Toggle between light and dark mode for your preferred viewing experience.', position: 'left' },
];

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'overview' | 'affiliates' | 'codes' | 'orders' | 'payouts' | 'admins' | 'logs'>('overview');
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const tabs = isSuperAdmin
    ? (['overview', 'affiliates', 'codes', 'orders', 'payouts', 'admins', 'logs'] as const)
    : (['overview', 'affiliates', 'codes', 'orders', 'payouts'] as const);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {isSuperAdmin ? 'Super Admin Panel' : 'Admin Panel'}
            </h1>
            <p className="text-sm text-gray-500">{user?.name} {isSuperAdmin && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1">Super</span>}</p>
          </div>
          <div className="flex items-center gap-3">
            <div data-tour="theme-toggle"><ThemeToggle /></div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div data-tour="admin-tabs" className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md capitalize ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              {t}
            </button>
          ))}
        </div>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'affiliates' && <AffiliatesTab isSuperAdmin={isSuperAdmin} onViewAs={setViewAsUserId} />}
        {tab === 'codes' && <CodesTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'payouts' && <PayoutsTab />}
        {tab === 'admins' && isSuperAdmin && <AdminsTab onViewAs={setViewAsUserId} />}
        {tab === 'logs' && isSuperAdmin && <LogsTab />}
      </div>
      <Tutorial steps={ADMIN_TUTORIAL_STEPS} storageKey="tutorial_admin" />
      {viewAsUserId && <ViewAsModal userId={viewAsUserId} onClose={() => setViewAsUserId(null)} />}
    </div>
  );
}

// ============ OVERVIEW WITH CHARTS ============

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [topAffiliates, setTopAffiliates] = useState<any[]>([]);
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('weekly');
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [recentNonAttributed, setRecentNonAttributed] = useState<any[]>([]);
  const [selectedAffiliate, setSelectedAffiliate] = useState<string>('');

  useEffect(() => {
    api.getAffiliates().then(setAffiliates);
    api.adminTopAffiliates().then(setTopAffiliates);
    // Load recent non-attributed orders
    api.getOrders({ limit: '10', attributed: 'false' }).then((d) => setRecentNonAttributed(d.orders));
  }, []);

  useEffect(() => { loadFilteredData(); }, [selectedAffiliate]);

  async function loadFilteredData() {
    const affId = selectedAffiliate || undefined;
    const [s, w, m] = await Promise.all([api.adminStats(affId), api.adminWeekly(affId), api.adminMonthly(affId)]);
    setStats(s); setWeeklyData(w); setMonthlyData(m);
    const orderParams: any = { limit: '100' };
    if (selectedAffiliate) orderParams.affiliateId = selectedAffiliate;
    const o = await api.getOrders(orderParams);
    setOrders(o.orders);
  }

  function handleDownloadPDF() {
    if (!stats) return;
    const filteredOrders = selectedAffiliate ? orders.filter((o: any) => o.attributed) : orders;
    downloadAdminReport(stats, affiliates, filteredOrders, selectedAffiliate ? selectedName : undefined);
  }

  const selectedName = selectedAffiliate ? affiliates.find((a) => a.id === selectedAffiliate)?.name || 'Affiliate' : 'All Affiliates';
  if (!stats) return <div className="text-gray-500 text-sm">Loading...</div>;
  const chartData = chartView === 'weekly' ? weeklyData : monthlyData;
  const conversionRate = stats.totalOrders > 0 ? ((stats.attributedOrders / stats.totalOrders) * 100).toFixed(1) : '0';

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
      <div className="flex items-center justify-between mb-4">
        <div data-tour="admin-filter" className="flex items-center gap-3">
          <label className="text-sm text-gray-500">Filter by affiliate:</label>
          <select value={selectedAffiliate} onChange={(e) => setSelectedAffiliate(e.target.value)}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 min-w-[200px]">
            <option value="">All Affiliates</option>
            {affiliates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {selectedAffiliate && <button onClick={() => setSelectedAffiliate('')} className="text-xs text-gray-500 hover:text-gray-900">Clear filter</button>}
        </div>
        <button data-tour="admin-pdf" onClick={handleDownloadPDF} className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50">Download PDF Report</button>
      </div>

      {selectedAffiliate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-sm text-blue-800">
          Showing data for <span className="font-semibold">{selectedName}</span>
        </div>
      )}

      {/* Business Overview — all orders */}
      {!selectedAffiliate && (
        <>
          <div className="mb-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Business Overview</p>
          </div>
          <div data-tour="admin-stats" className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="All Orders" value={stats.totalOrders} sub="Total orders received" />
            <StatCard label="Total Revenue" value={formatMoney(stats.allOrdersRevenue || 0)} sub="From all orders" />
            <StatCard label="Non-Attributed" value={stats.nonAttributedCount || 0} sub="No affiliate code used" />
            <StatCard label="Affiliate Conversion" value={`${conversionRate}%`} sub={`${stats.attributedOrders} of ${stats.totalOrders} orders`} />
            <StatCard label="Total Affiliates" value={stats.totalAffiliates} sub={`${stats.activeAffiliates} active`} />
          </div>
        </>
      )}

      {/* Affiliate Performance */}
      <div className="mb-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {selectedAffiliate ? `${selectedName}'s Performance` : 'Affiliate Performance'}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={selectedAffiliate ? 'Their Orders' : 'Attributed Orders'}
          value={stats.attributedOrders}
          sub={selectedAffiliate ? `${stats.totalOrders} total` : `${stats.totalOrders - stats.attributedOrders} without code`}
        />
        <StatCard
          label={selectedAffiliate ? 'Their Revenue' : 'Affiliate Revenue'}
          value={formatMoney(stats.totalRevenue)}
          sub="From attributed orders"
        />
        <StatCard
          label={selectedAffiliate ? 'Their Commissions' : 'Commissions Owed'}
          value={formatMoney(stats.totalCommissions)}
          sub={`${formatMoney(stats.pendingPayouts)} pending payout`}
        />
        {selectedAffiliate ? (
          <StatCard label="Pending Payout" value={formatMoney(stats.pendingPayouts)} sub="Awaiting payment" />
        ) : (
          <StatCard label="Net Revenue" value={formatMoney((stats.totalRevenue || 0) - (stats.totalCommissions || 0))} sub="Revenue minus commissions" />
        )}
      </div>

      {/* Charts */}
      <div data-tour="admin-charts" className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900">Revenue & Commissions</h2>
          <div className="flex gap-1 bg-gray-100 rounded p-0.5">
            <button onClick={() => setChartView('weekly')} className={`px-3 py-1 text-xs rounded ${chartView === 'weekly' ? 'bg-white text-gray-900 font-medium' : 'text-gray-500'}`}>Weekly</button>
            <button onClick={() => setChartView('monthly')} className={`px-3 py-1 text-xs rounded ${chartView === 'monthly' ? 'bg-white text-gray-900 font-medium' : 'text-gray-500'}`}>Monthly</button>
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">Revenue</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
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
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
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
          <div className="text-sm text-gray-400 text-center py-12">No chart data available</div>
        )}
      </div>

      {/* Bottom: Top Affiliates + Recent Non-Attributed */}
      <div className={`grid ${!selectedAffiliate && recentNonAttributed.length > 0 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-6`}>
        {topAffiliates.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg">
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

        {/* Recent Non-Attributed Orders */}
        {!selectedAffiliate && recentNonAttributed.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900">Recent Non-Attributed Orders</h2>
              <span className="text-xs text-gray-400">{stats.nonAttributedCount || 0} total</span>
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
                      <td className="px-4 py-2.5 text-gray-900">{o.customerFirstName}</td>
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
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

// ============ AFFILIATES ============

function AffiliatesTab({ isSuperAdmin, onViewAs }: { isSuperAdmin?: boolean; onViewAs?: (id: string) => void }) {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', defaultCommissionRate: '20' });

  useEffect(() => { loadAffiliates(); }, []);
  async function loadAffiliates() { setAffiliates(await api.getAffiliates()); }

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

  const columns: Column[] = [
    { key: 'name', label: 'Name', defaultWidth: 160, className: 'text-gray-900 font-medium' },
    { key: 'email', label: 'Email', defaultWidth: 200, className: 'text-gray-600' },
    { key: 'passwordPlain', label: 'Password', defaultWidth: 140, render: (r: any) => <PasswordCell password={r.passwordPlain} /> },
    { key: 'defaultCommissionRate', label: 'Commission', defaultWidth: 110, render: (r: any) => formatPct(r.defaultCommissionRate), className: 'text-gray-600' },
    { key: '_codes', label: 'Codes', defaultWidth: 80, render: (r: any) => r.discountCodes?.length || 0, className: 'text-gray-600' },
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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium text-gray-900">{affiliates.length} Affiliates</h2>
        <button onClick={openCreate} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Add Affiliate</button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-md mx-4 p-6">
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
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={4}>Total ({affiliates.length} affiliates)</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{affiliates.reduce((s, a) => s + (a.discountCodes?.length || 0), 0)} codes</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{affiliates.filter(a => a.active).length} active</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          ) : undefined}
        />
      </div>
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

  function getCodeStatus(c: any) {
    if (!c.active) return { label: 'Inactive', color: 'text-gray-400' };
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { label: 'Expired', color: 'text-red-600' };
    return { label: 'Active', color: 'text-green-700' };
  }

  const columns: Column[] = [
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium text-gray-900">{codes.length} Discount Codes</h2>
        <button onClick={openCreate} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Add Code</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-md mx-4 p-6">
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

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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

function OrdersTab() {
  const [data, setData] = useState<{ orders: any[]; total: number }>({ orders: [], total: 0 });
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const searchTimer = useRef<any>(null);

  function handleSearch(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchDebounced(val);
      setPage(1);
    }, 400);
  }

  useEffect(() => { setPage(1); }, [filter]);
  useEffect(() => { loadOrders(); }, [page, filter, searchDebounced]);

  function loadOrders() {
    const params: any = { page: page.toString(), limit: '50' };
    if (filter === 'yes') params.attributed = 'true';
    if (filter === 'no') params.attributed = 'false';
    if (searchDebounced.trim()) params.search = searchDebounced.trim();
    api.getOrders(params).then(setData);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    await api.deleteOrder(id);
    loadOrders();
  }

  const columns: Column[] = [
    { key: 'createdAt', label: 'Date & Time', defaultWidth: 180, render: (r: any) => <span className="text-gray-500 text-xs">{formatDateTime(r.createdAt)}</span> },
    { key: 'customerFirstName', label: 'Customer', defaultWidth: 120, className: 'text-gray-900' },
    { key: 'itemsSummary', label: 'Items', defaultWidth: 250, className: 'text-gray-600' },
    { key: 'discountCode.code', label: 'Code', defaultWidth: 110, render: (r: any) => <span className="font-mono text-xs text-gray-500">{r.discountCode?.code || '—'}</span> },
    { key: 'discountCode.affiliate.name', label: 'Affiliate', defaultWidth: 130, render: (r: any) => r.discountCode?.affiliate?.name || '—', className: 'text-gray-600' },
    { key: 'source', label: 'Source', defaultWidth: 90, render: (r: any) => <span className="capitalize text-gray-500">{r.source}</span> },
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900">All Orders ({data.total})</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search orders..."
              className="pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded w-64 focus:outline-none focus:border-gray-900"
            />
            {search && (
              <button onClick={() => { setSearch(''); setSearchDebounced(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">&times;</button>
            )}
          </div>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {([['all', 'All'], ['yes', 'Attributed'], ['no', 'Not Attributed']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-1 text-xs rounded-md ${filter === val ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <DataTable
          columns={columns}
          data={data.orders}
          emptyMessage="No orders yet"
          onRowClick={(row) => setSelectedOrder(row)}
          footer={data.orders.length > 0 ? (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={6}>Total ({data.orders.length} orders on this page)</td>
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
          onDelete={(id) => { handleDelete(id); setSelectedOrder(null); }}
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium text-gray-900">{payouts.length} Payouts</h2>
        <button onClick={() => setShowForm(true)} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Create Payout</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-md mx-4 p-6">
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

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium text-gray-900">{admins.length} Admins</h2>
        <button onClick={openCreate} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Add Admin</button>
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

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
      <div className="flex gap-2 mb-4">
        <button onClick={() => setSubTab('activity')}
          className={`px-3 py-1.5 text-sm rounded-md ${subTab === 'activity' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:text-gray-900'}`}>
          Activity Logs
        </button>
        <button onClick={() => setSubTab('system')}
          className={`px-3 py-1.5 text-sm rounded-md ${subTab === 'system' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:text-gray-900'}`}>
          System Logs
        </button>
      </div>
      {subTab === 'activity' ? <ActivityLogsPanel /> : <SystemLogsPanel />}
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
