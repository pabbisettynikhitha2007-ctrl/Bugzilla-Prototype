import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { SeverityBadge, StatusPill } from '../components/Badges';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'verified', 'closed', 'reopened'];

export default function BugDetail() {
  const { id } = useParams();
  const [bug, setBug] = useState(null);
  const [users, setUsers] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [bugData, usersData] = await Promise.all([api.getBug(id), api.listUsers()]);
    setBug(bugData);
    setUsers(usersData);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleFieldChange(field, value) {
    await api.updateBug(id, { [field]: value });
    load();
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await api.addComment(id, commentText);
      setCommentText('');
      load();
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <div className="text-muted text-sm">Loading…</div>;
  if (!bug) return <div className="text-muted text-sm">Bug not found.</div>;

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-accent transition inline-flex items-center gap-1 mb-4">
        ← Back to board
      </Link>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="font-display text-xl font-semibold leading-snug">{bug.title}</h1>
              <SeverityBadge severity={bug.severity} />
            </div>
            <p className="text-xs text-muted font-mono mb-4">
              {bug.product?.name || 'Unassigned'} {bug.component ? `· ${bug.component.name}` : ''} · reported by {bug.reporter?.name}
            </p>
            <p className="text-sm text-ink/90 whitespace-pre-wrap leading-relaxed">{bug.description || 'No description provided.'}</p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3">Comments</h2>
            <div className="space-y-3 mb-4">
              {bug.comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
              {bug.comments.map((c) => (
                <div key={c.id} className="border-l-2 border-border pl-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{c.author_name}</span>
                    <span className="text-xs text-muted">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-ink/90 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleComment} className="flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
              />
              <button
                type="submit"
                disabled={posting}
                className="bg-accent text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition disabled:opacity-50"
              >
                Post
              </button>
            </form>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3">Activity</h2>
            <div className="space-y-2">
              {bug.activity.map((a) => (
                <p key={a.id} className="text-xs text-muted">
                  <span className="text-ink/80 font-medium">{a.actor_name || 'System'}</span>{' '}
                  changed <span className="font-mono">{a.field}</span>
                  {a.old_value ? <> from <span className="text-ink/70">{a.old_value}</span></> : ''} to{' '}
                  <span className="text-ink/70">{a.new_value}</span>
                  {' · '}{new Date(a.created_at).toLocaleString()}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1.5">Status</label>
              <div className="mb-1.5"><StatusPill status={bug.status} /></div>
              <select
                value={bug.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">Assignee</label>
              <select
                value={bug.assignee_id || ''}
                onChange={(e) => handleFieldChange('assignee_id', e.target.value || null)}
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
              >
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">Severity</label>
              <select
                value={bug.severity}
                onChange={(e) => handleFieldChange('severity', e.target.value)}
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
                value={bug.priority}
                onChange={(e) => handleFieldChange('priority', e.target.value)}
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
              >
                {['p1', 'p2', 'p3', 'p4', 'p5'].map((p) => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-border text-xs text-muted space-y-1">
              <p>Created {new Date(bug.created_at).toLocaleString()}</p>
              <p>Updated {new Date(bug.updated_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
