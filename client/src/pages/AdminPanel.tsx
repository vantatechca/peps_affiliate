import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { downloadAdminReport } from '../pdfReport';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts';

function formatMoney(n: number) { return `$${n.toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function formatPct(n: number) { return `${(n * 100).toFixed(0)}%`; }

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'overview' | 'affiliates' | 'codes' | 'orders' | 'payouts'>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">{user?.name}</p>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {(['overview', 'affiliates', 'codes', 'orders', 'payouts'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md capitalize ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              {t}
            </button>
          ))}
        </div>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'affiliates' && <AffiliatesTab />}
        {tab === 'codes' && <CodesTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'payouts' && <PayoutsTab />}
      </div>
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
  const [selectedAffiliate, setSelectedAffiliate] = useState<string>('');

  useEffect(() => {
    api.getAffiliates().then(setAffiliates);
    api.adminTopAffiliates().then(setTopAffiliates);
  }, []);

  useEffect(() => {
    loadFilteredData();
  }, [selectedAffiliate]);

  async function loadFilteredData() {
    const affId = selectedAffiliate || undefined;
    const [s, w, m] = await Promise.all([
      api.adminStats(affId),
      api.adminWeekly(affId),
      api.adminMonthly(affId),
    ]);
    setStats(s);
    setWeeklyData(w);
    setMonthlyData(m);

    const orderParams: any = { limit: '100' };
    if (selectedAffiliate) orderParams.affiliateId = selectedAffiliate;
    const o = await api.getOrders(orderParams);
    setOrders(o.orders);
  }

  function handleDownloadPDF() {
    if (!stats) return;
    downloadAdminReport(stats, affiliates, orders);
  }

  const selectedName = selectedAffiliate
    ? affiliates.find((a) => a.id === selectedAffiliate)?.name || 'Affiliate'
    : 'All Affiliates';

  if (!stats) return <div className="text-gray-500 text-sm">Loading...</div>;

  const chartData = chartView === 'weekly' ? weeklyData : monthlyData;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500">Filter by affiliate:</label>
          <select
            value={selectedAffiliate}
            onChange={(e) => setSelectedAffiliate(e.target.value)}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 min-w-[200px]"
          >
            <option value="">All Affiliates</option>
            {affiliates.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {selectedAffiliate && (
            <button onClick={() => setSelectedAffiliate('')}
              className="text-xs text-gray-500 hover:text-gray-900">
              Clear filter
            </button>
          )}
        </div>
        <button onClick={handleDownloadPDF}
          className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50">
          Download PDF Report
        </button>
      </div>

      {/* Selected affiliate indicator */}
      {selectedAffiliate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-sm text-blue-800">
          Showing data for <span className="font-semibold">{selectedName}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {!selectedAffiliate && (
          <StatCard label="Total Affiliates" value={stats.totalAffiliates} sub={`${stats.activeAffiliates} active`} />
        )}
        <StatCard label={selectedAffiliate ? 'Their Orders' : 'Total Orders'} value={stats.attributedOrders} sub={`${stats.totalOrders} total (inc. unattributed)`} />
        <StatCard label={selectedAffiliate ? 'Their Revenue' : 'Affiliate Revenue'} value={formatMoney(stats.totalRevenue)} sub="From attributed orders" />
        <StatCard label={selectedAffiliate ? 'Their Commissions' : 'Total Commissions'} value={formatMoney(stats.totalCommissions)} sub={`${formatMoney(stats.pendingPayouts)} pending`} />
        {selectedAffiliate && (
          <StatCard label="Pending Payout" value={formatMoney(stats.pendingPayouts)} sub="Awaiting payment" />
        )}
      </div>

      {/* Charts */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900">Revenue & Commissions</h2>
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

      {/* Top Affiliates */}
      {topAffiliates.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Top Affiliates</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium text-right">Orders</th>
                  <th className="px-4 py-2 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2 font-medium text-right">Commissions</th>
                </tr>
              </thead>
              <tbody>
                {topAffiliates.map((a, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{a.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-right">{a.orders}</td>
                    <td className="px-4 py-3 text-gray-900 text-right">{formatMoney(a.revenue)}</td>
                    <td className="px-4 py-3 text-green-700 font-medium text-right">{formatMoney(a.commissions)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{topAffiliates.reduce((s, a) => s + a.orders, 0)}</td>
                  <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{formatMoney(topAffiliates.reduce((s, a) => s + a.revenue, 0))}</td>
                  <td className="px-4 py-3 text-green-700 font-semibold text-right text-sm">{formatMoney(topAffiliates.reduce((s, a) => s + a.commissions, 0))}</td>
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
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

// ============ AFFILIATES ============

function AffiliatesTab() {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', defaultCommissionRate: '20' });

  useEffect(() => { loadAffiliates(); }, []);

  async function loadAffiliates() { setAffiliates(await api.getAffiliates()); }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', password: '', defaultCommissionRate: '20' });
    setShowForm(true);
  }

  function openEdit(aff: any) {
    setEditing(aff);
    setForm({ name: aff.name, email: aff.email, password: '', defaultCommissionRate: (aff.defaultCommissionRate * 100).toString() });
    setShowForm(true);
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
    setShowForm(false);
    loadAffiliates();
  }

  async function toggleActive(aff: any) { await api.updateAffiliate(aff.id, { active: !aff.active }); loadAffiliates(); }
  async function handleDelete(aff: any) {
    if (!confirm(`Delete affiliate "${aff.name}"? This removes all their codes and order attributions.`)) return;
    await api.deleteAffiliate(aff.id); loadAffiliates();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium text-gray-900">{affiliates.length} Affiliates</h2>
        <button onClick={openCreate} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Add Affiliate</button>
      </div>
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">{editing ? 'Edit' : 'New'} Affiliate</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <Input label={editing ? 'New Password (leave blank to keep)' : 'Password'} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required={!editing} />
            <Input label="Commission %" type="number" value={form.defaultCommissionRate} onChange={(v) => setForm({ ...form, defaultCommissionRate: v })} />
            <div className="col-span-full flex gap-2">
              <button type="submit" className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">{editing ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-900">Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Commission</th><th className="px-4 py-2 font-medium">Codes</th>
            <th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-gray-900 font-medium">{a.name}</td>
                <td className="px-4 py-3 text-gray-600">{a.email}</td>
                <td className="px-4 py-3 text-gray-600">{formatPct(a.defaultCommissionRate)}</td>
                <td className="px-4 py-3 text-gray-600">{a.discountCodes?.length || 0}</td>
                <td className="px-4 py-3"><span className={`text-xs font-medium ${a.active ? 'text-green-700' : 'text-gray-400'}`}>{a.active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => toggleActive(a)} className="text-xs text-gray-500 hover:underline">{a.active ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => handleDelete(a)} className="text-xs text-red-500 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
          {affiliates.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={3}>Total ({affiliates.length} affiliates)</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{affiliates.reduce((s, a) => s + (a.discountCodes?.length || 0), 0)} codes</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{affiliates.filter(a => a.active).length} active</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
        {affiliates.length === 0 && <div className="px-4 py-8 text-sm text-gray-400 text-center">No affiliates yet</div>}
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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium text-gray-900">{codes.length} Discount Codes</h2>
        <button onClick={openCreate} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Add Code</button>
      </div>
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">{editing ? 'Edit' : 'New'} Discount Code</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
            <div className="col-span-full flex gap-2">
              <button type="submit" className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">{editing ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-900">Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Code</th><th className="px-4 py-2 font-medium">Affiliate</th>
            <th className="px-4 py-2 font-medium">Discount</th><th className="px-4 py-2 font-medium">Commission</th>
            <th className="px-4 py-2 font-medium">Label</th><th className="px-4 py-2 font-medium">Used</th>
            <th className="px-4 py-2 font-medium">Expires</th><th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {codes.map((c) => {
              const status = getCodeStatus(c);
              return (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.code}</td>
                  <td className="px-4 py-3 text-gray-600">{c.affiliate?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatPct(c.discountPercent)}</td>
                  <td className="px-4 py-3 text-gray-600">{c.commissionRateOverride ? formatPct(c.commissionRateOverride) : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.label || '—'}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{c._count?.orders || 0}×</td>
                  <td className="px-4 py-3 text-gray-500">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${status.color}`}>{status.label}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openEdit(c)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => toggleActive(c)} className="text-xs text-gray-500 hover:underline">{c.active ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => handleDelete(c)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {codes.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={5}>Total ({codes.length} codes)</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{codes.reduce((s, c) => s + (c._count?.orders || 0), 0)}×</td>
                <td className="px-4 py-3" colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
        {codes.length === 0 && <div className="px-4 py-8 text-sm text-gray-400 text-center">No discount codes yet</div>}
      </div>
    </div>
  );
}

// ============ ORDERS ============

function OrdersTab() {
  const [data, setData] = useState<{ orders: any[]; total: number }>({ orders: [], total: 0 });
  const [page, setPage] = useState(1);

  useEffect(() => { api.getOrders({ page: page.toString(), limit: '50' }).then(setData); }, [page]);

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-4">All Orders ({data.total})</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Customer</th>
            <th className="px-4 py-2 font-medium">Items</th><th className="px-4 py-2 font-medium">Code</th>
            <th className="px-4 py-2 font-medium">Affiliate</th><th className="px-4 py-2 font-medium">Source</th>
            <th className="px-4 py-2 font-medium text-right">Total</th><th className="px-4 py-2 font-medium text-right">Commission</th>
            <th className="px-4 py-2 font-medium">Attributed</th>
          </tr></thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3 text-gray-900">{o.customerFirstName}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{o.itemsSummary}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.discountCode?.code || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{o.discountCode?.affiliate?.name || '—'}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{o.source}</td>
                <td className="px-4 py-3 text-gray-900 text-right">{formatMoney(o.orderTotal)}</td>
                <td className="px-4 py-3 text-right font-medium text-green-700">{formatMoney(o.commissionEarned)}</td>
                <td className="px-4 py-3"><span className={`text-xs ${o.attributed ? 'text-green-700' : 'text-gray-400'}`}>{o.attributed ? 'Yes' : 'No'}</span></td>
              </tr>
            ))}
          </tbody>
          {data.orders.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={6}>Total ({data.orders.length} orders on this page)</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{formatMoney(data.orders.reduce((s, o) => s + o.orderTotal, 0))}</td>
                <td className="px-4 py-3 text-green-700 font-semibold text-right text-sm">{formatMoney(data.orders.reduce((s, o) => s + o.commissionEarned, 0))}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
        {data.orders.length === 0 && <div className="px-4 py-8 text-sm text-gray-400 text-center">No orders yet</div>}
        {data.total > 50 && (
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2 text-sm">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="text-gray-500 hover:text-gray-900 disabled:opacity-30">Previous</button>
            <span className="text-gray-400">Page {page}</span>
            <button onClick={() => setPage(page + 1)} disabled={data.orders.length < 50} className="text-gray-500 hover:text-gray-900 disabled:opacity-30">Next</button>
          </div>
        )}
      </div>
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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium text-gray-900">{payouts.length} Payouts</h2>
        <button onClick={() => setShowForm(true)} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Create Payout</button>
      </div>
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">New Payout</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <div className="col-span-full flex gap-2">
              <button type="submit" className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">Affiliate</th><th className="px-4 py-2 font-medium">Period</th>
            <th className="px-4 py-2 font-medium text-right">Amount</th><th className="px-4 py-2 font-medium">Notes</th>
            <th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Paid At</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-gray-900">{p.affiliate?.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.period}</td>
                <td className="px-4 py-3 text-gray-900 font-medium text-right">{formatMoney(p.amount)}</td>
                <td className="px-4 py-3 text-gray-500">{p.notes || '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs font-medium ${p.status === 'PAID' ? 'text-green-700' : p.status === 'PROCESSING' ? 'text-yellow-600' : 'text-gray-500'}`}>{p.status}</span></td>
                <td className="px-4 py-3 text-gray-500">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                <td className="px-4 py-3">{p.status === 'PENDING' && <button onClick={() => markPaid(p.id)} className="text-xs text-green-600 hover:underline">Mark Paid</button>}</td>
              </tr>
            ))}
          </tbody>
          {payouts.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm" colSpan={2}>Total ({payouts.length} payouts)</td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-right text-sm">{formatMoney(payouts.reduce((s, p) => s + p.amount, 0))}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-gray-900 font-semibold text-sm">{payouts.filter(p => p.status === 'PAID').length} paid, {payouts.filter(p => p.status === 'PENDING').length} pending</td>
                <td className="px-4 py-3" colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
        {payouts.length === 0 && <div className="px-4 py-8 text-sm text-gray-400 text-center">No payouts yet</div>}
      </div>
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
