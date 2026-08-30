import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { SeverityBadge, StatusPill } from '../components/Badges';

export default function NewBug() {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', product_id: '', component_id: '',
    severity: 'normal', priority: 'p3', assignee_id: '', due_date: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [similarBugs, setSimilarBugs] = useState([]);
  const [searchingDupes, setSearchingDupes] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listProducts().then(setProducts);
    api.listUsers().then(setUsers);
  }, []);

  const selectedProduct = products.find((p) => p.id === form.product_id);

  // Debounced duplicate search
  const searchDuplicates = useCallback((title, description) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!title && !description) { setSimilarBugs([]); return; }
    debounceRef.current = setTimeout(async () => {
      if ((title + description).trim().length < 5) { setSimilarBugs([]); return; }
      setSearchingDupes(true);
      try {
        const results = await api.findSimilarBugs(title, description);
        setSimilarBugs(results);
      } catch {
        setSimilarBugs([]);
      } finally {
        setSearchingDupes(false);
      }
    }, 600);
  }, []);

  function handleFormChange(updates) {
    const next = { ...form, ...updates };
    setForm(next);
    searchDuplicates(next.title, next.description);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const bug = await api.createBug(form);
      navigate(`/bugs/${bug.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight mb-1">Report a bug</h1>
      <p className="text-muted text-sm mb-6">Give enough detail that anyone on the team can reproduce and fix it.</p>

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-4">
        {error && (
          <div className="bg-critical/10 border border-critical/30 text-critical text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div>
          <label className="block text-xs text-muted mb-1.5">Title</label>
          <input
            value={form.title}
            onChange={(e) => handleFormChange({ title: e.target.value })}
            placeholder="Short, specific summary of the problem"
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => handleFormChange({ description: e.target.value })}
            placeholder="Steps to reproduce, expected vs actual behavior, environment…"
            rows={5}
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition resize-none"
          />
        </div>

        {/* Possible duplicates */}
        {(similarBugs.length > 0 || searchingDupes) && (
          <div className="bg-major/5 border border-major/25 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-major uppercase tracking-wide">
                {searchingDupes ? 'Checking for similar bugs…' : `${similarBugs.length} possible duplicate${similarBugs.length !== 1 ? 's' : ''} found`}
              </span>
            </div>
            {!searchingDupes && similarBugs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted mb-2">Please check these before submitting. You can still submit if your bug is different.</p>
                {similarBugs.map((b) => (
                  <a
                    key={b.id}
                    href={`/bugs/${b.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 bg-surface2 border border-border rounded-lg px-3 py-2.5 hover:border-accent/40 transition group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted">#{b.id.slice(0, 8)}</span>
                        <p className="text-sm font-medium truncate group-hover:text-accent transition">{b.title}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusPill status={b.status} />
                        <SeverityBadge severity={b.severity} />
                        <span className="text-[10px] font-mono uppercase text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                          {b.priority?.toUpperCase()}
                        </span>
                        {b.assignee && <span className="text-xs text-muted">· {b.assignee.name}</span>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Product</label>
            <select
              value={form.product_id}
              onChange={(e) => handleFormChange({ product_id: e.target.value, component_id: '' })}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
            >
              <option value="">Select product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Component</label>
            <select
              value={form.component_id}
              onChange={(e) => handleFormChange({ component_id: e.target.value })}
              disabled={!selectedProduct}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition disabled:opacity-40"
            >
              <option value="">Select component</option>
              {selectedProduct?.components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Severity</label>
            <select
              value={form.severity}
              onChange={(e) => handleFormChange({ severity: e.target.value })}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
            >
              {['blocker', 'critical', 'major', 'normal', 'minor', 'trivial'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => handleFormChange({ priority: e.target.value })}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
            >
              {['p1', 'p2', 'p3', 'p4', 'p5'].map((p) => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Assignee</label>
            <select
              value={form.assignee_id}
              onChange={(e) => handleFormChange({ assignee_id: e.target.value })}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
            >
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Due date (optional)</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => handleFormChange({ due_date: e.target.value })}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-accent text-bg font-semibold text-sm rounded-lg px-5 py-2.5 hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Submit bug'}
        </button>
      </form>
    </div>
  );
}
