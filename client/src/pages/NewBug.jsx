import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function NewBug() {
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', product_id: '', component_id: '',
    severity: 'normal', priority: 'p3', assignee_id: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.listProducts().then(setProducts);
    api.listUsers().then(setUsers);
  }, []);

  const selectedProduct = products.find((p) => p.id === form.product_id);

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
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Short, specific summary of the problem"
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Steps to reproduce, expected vs actual behavior, environment…"
            rows={5}
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Product</label>
            <select
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value, component_id: '' })}
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
              onChange={(e) => setForm({ ...form, component_id: e.target.value })}
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
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
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
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
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
              onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
            >
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
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
