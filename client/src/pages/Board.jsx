import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { SeverityBadge, StatusPill } from '../components/Badges';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'verified', 'closed', 'reopened'];
const SEVERITY_OPTIONS = ['blocker', 'critical', 'major', 'normal', 'minor', 'trivial'];

export default function Board() {
  const [bugs, setBugs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', severity: '', product_id: '', q: '' });

  async function load() {
    setLoading(true);
    try {
      const [bugsData, productsData] = await Promise.all([api.listBugs(filters), api.listProducts()]);
      setBugs(bugsData);
      setProducts(productsData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.severity, filters.product_id]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-muted text-sm mt-0.5">{bugs.length} issue{bugs.length !== 1 ? 's' : ''} matching filters</p>
        </div>
        <Link to="/new" className="bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition">
          + New Bug
        </Link>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2 mb-4">
        <input
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          placeholder="Search title or description…"
          className="flex-1 min-w-[200px] bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
        >
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filters.product_id}
          onChange={(e) => setFilters({ ...filters, product_id: e.target.value })}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
        >
          <option value="">All products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </form>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted text-sm">Loading issues…</div>
        ) : bugs.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">No bugs match these filters. Try widening your search.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-border">
                <th className="px-4 py-2.5 font-medium">Issue</th>
                <th className="px-4 py-2.5 font-medium">Severity</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Assignee</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((bug) => (
                <tr key={bug.id} className="border-b border-border/60 last:border-0 hover:bg-surface2/50 transition">
                  <td className="px-4 py-3">
                    <Link to={`/bugs/${bug.id}`} className="font-medium hover:text-accent transition">
                      {bug.title}
                    </Link>
                    <p className="text-xs text-muted mt-0.5 font-mono">
                      {bug.product?.name || 'Unassigned'} {bug.component ? `· ${bug.component.name}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={bug.severity} /></td>
                  <td className="px-4 py-3"><StatusPill status={bug.status} /></td>
                  <td className="px-4 py-3 text-muted">{bug.assignee?.name || '—'}</td>
                  <td className="px-4 py-3 text-muted text-xs">{new Date(bug.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
