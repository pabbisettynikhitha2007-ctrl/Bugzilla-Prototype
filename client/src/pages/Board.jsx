import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SeverityBadge, StatusPill } from '../components/Badges';
import KanbanBoard from '../components/KanbanBoard';
import { downloadCSV } from '../lib/csv';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'verified', 'closed', 'reopened'];
const SEVERITY_OPTIONS = ['blocker', 'critical', 'major', 'normal', 'minor', 'trivial'];

function isOverdue(bug) {
  if (!bug.due_date || ['resolved', 'verified', 'closed'].includes(bug.status)) return false;
  return new Date(bug.due_date) < new Date();
}

export default function Board() {
  const { user } = useAuth();
  const [bugs, setBugs] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', severity: '', product_id: '', assignee_id: '', q: '' });
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [bugsData, productsData, usersData] = await Promise.all([
        api.listBugs(filters), api.listProducts(), api.listUsers(),
      ]);
      setBugs(bugsData);
      setProducts(productsData);
      setUsers(usersData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.severity, filters.product_id, filters.assignee_id]);

  useEffect(() => { setSelected(new Set()); }, [bugs.length, view]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    load();
  }

  async function handleKanbanStatusChange(bugId, status) {
    setBugs((prev) => prev.map((b) => (b.id === bugId ? { ...b, status } : b)));
    await api.updateBug(bugId, { status });
    load();
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === bugs.length ? new Set() : new Set(bugs.map((b) => b.id))));
  }

  async function handleBulkStatus(status) {
    if (!status || selected.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all([...selected].map((id) => api.updateBug(id, { status })));
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkAssignee(assigneeId) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all([...selected].map((id) => api.updateBug(id, { assignee_id: assigneeId || null })));
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-muted text-sm mt-0.5">{bugs.length} issue{bugs.length !== 1 ? 's' : ''} matching filters</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilters((f) => ({ ...f, assignee_id: f.assignee_id === user.id ? '' : user.id }))}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
              filters.assignee_id === user.id
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-surface border-border text-muted hover:text-ink'
            }`}
          >
            My Bugs
          </button>
          <div className="flex bg-surface border border-border rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'list' ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'}`}
            >
              List
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'kanban' ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'}`}
            >
              Kanban
            </button>
          </div>
          <Link to="/new" className="bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition">
            + New Bug
          </Link>
          <button
            onClick={() => downloadCSV(bugs)}
            title="Export current results to CSV"
            className="bg-surface border border-border text-sm font-medium px-3 py-2 rounded-lg text-muted hover:text-ink transition"
          >
            Export CSV
          </button>
        </div>
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

      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">Loading issues…</div>
      ) : bugs.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">
          No bugs match these filters. Try widening your search.
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard bugs={bugs} onStatusChange={handleKanbanStatusChange} />
      ) : (
        <>
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-surface2 border border-accent/30 rounded-lg px-3 py-2 mb-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <select
                onChange={(e) => { handleBulkStatus(e.target.value); e.target.value = ''; }}
                disabled={bulkBusy}
                defaultValue=""
                className="bg-surface border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-accent transition"
              >
                <option value="" disabled>Set status…</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <select
                onChange={(e) => { handleBulkAssignee(e.target.value); e.target.value = ''; }}
                disabled={bulkBusy}
                defaultValue=""
                className="bg-surface border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-accent transition"
              >
                <option value="" disabled>Assign to…</option>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {bulkBusy && <span className="text-muted text-xs">Updating…</span>}
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted hover:text-ink transition">
                Clear
              </button>
            </div>
          )}

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-border">
                  <th className="px-4 py-2.5 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === bugs.length && bugs.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-accent"
                    />
                  </th>
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
                      <input
                        type="checkbox"
                        checked={selected.has(bug.id)}
                        onChange={() => toggleSelected(bug.id)}
                        className="accent-accent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/bugs/${bug.id}`} className="font-medium hover:text-accent transition">
                        {bug.title}
                      </Link>
                      {isOverdue(bug) && (
                        <span className="ml-2 text-[10px] font-mono uppercase text-critical border border-critical/30 bg-critical/10 rounded px-1.5 py-0.5">
                          overdue
                        </span>
                      )}
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
          </div>
        </>
      )}
    </div>
  );
}
