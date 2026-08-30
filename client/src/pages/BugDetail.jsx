import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SeverityBadge, StatusPill } from '../components/Badges';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'verified', 'closed', 'reopened'];

// ─── Bug Health ───────────────────────────────────────────────────────────────
function computeHealth(bug) {
  const now = new Date();
  const created = new Date(bug.created_at);
  const updated = new Date(bug.updated_at);
  const isClosedStatus = ['resolved', 'verified', 'closed'].includes(bug.status);
  if (isClosedStatus) return null; // no health badge for closed bugs

  const daysSinceUpdate = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
  const daysOpen = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  const isOverdue = bug.due_date && new Date(bug.due_date) < now;
  const overdueDays = isOverdue ? Math.ceil((now - new Date(bug.due_date)) / (1000 * 60 * 60 * 24)) : 0;
  const isUnassigned = !bug.assignee_id;

  let health, label, detail;

  if (daysSinceUpdate >= 7 || (isOverdue && overdueDays >= 5) || (daysOpen >= 14 && isUnassigned)) {
    health = 'stalled';
    label = 'Stalled';
    if (daysSinceUpdate >= 7) detail = `No activity for ${daysSinceUpdate} day${daysSinceUpdate !== 1 ? 's' : ''}`;
    else if (isOverdue) detail = `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`;
    else detail = `Open for ${daysOpen} days, unassigned`;
  } else if (daysSinceUpdate >= 3 || isOverdue || (daysOpen >= 7 && isUnassigned)) {
    health = 'at_risk';
    label = 'At Risk';
    if (isOverdue) detail = `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`;
    else if (daysSinceUpdate >= 3) detail = `No activity for ${daysSinceUpdate} day${daysSinceUpdate !== 1 ? 's' : ''}`;
    else detail = `Unassigned for ${daysOpen} days`;
  } else {
    health = 'healthy';
    label = 'Healthy';
    detail = daysSinceUpdate === 0 ? 'Updated today' : `Updated ${daysSinceUpdate} day${daysSinceUpdate !== 1 ? 's' : ''} ago`;
  }

  return { health, label, detail };
}

function HealthBadge({ bug }) {
  const info = computeHealth(bug);
  if (!info) return null;
  const colors = {
    healthy: 'bg-minor/15 text-minor border-minor/30',
    at_risk: 'bg-major/15 text-major border-major/30',
    stalled: 'bg-critical/15 text-critical border-critical/30',
  };
  const dots = {
    healthy: 'bg-minor',
    at_risk: 'bg-major',
    stalled: 'bg-critical',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${colors[info.health]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[info.health]}`} />
      {info.label}
      {info.detail && <span className="text-xs opacity-75 ml-0.5">· {info.detail}</span>}
    </span>
  );
}

// ─── Activity message formatter ───────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_FIELD_MAP = {
  assignee_id: 'assignee',
  product_id: 'product',
  component_id: 'component',
};

function formatActivityMessage(a) {
  const actor = a.actor_name || 'System';
  // Normalize legacy field names
  const field = LEGACY_FIELD_MAP[a.field] || a.field;
  const newVal = a.new_value;
  const oldVal = a.old_value;

  // If either value is a raw UUID (legacy record), show a sanitized fallback
  const hasRawUUID = (UUID_REGEX.test(newVal) || UUID_REGEX.test(oldVal));
  if (hasRawUUID && field === 'assignee') {
    return <><span className="font-medium text-ink/80">{actor}</span>{' changed the assignee'}</>;
  }
  if (hasRawUUID) {
    return <><span className="font-medium text-ink/80">{actor}</span>{` updated ${field}`}</>;
  }

  if (field === 'created') {
    return (
      <>
        <span className="font-medium text-ink/80">{actor}</span>
        {' created this bug: '}
        <span className="text-ink/70 font-medium">"{newVal}"</span>
      </>
    );
  }
  if (field === 'assignee') {
    if (oldVal && newVal) {
      return (
        <>
          <span className="font-medium text-ink/80">{actor}</span>
          {' reassigned this bug from '}
          <span className="text-ink/70">{oldVal}</span>
          {' to '}
          <span className="text-ink/70 font-medium">{newVal}</span>
        </>
      );
    }
    if (newVal) {
      return (
        <>
          <span className="font-medium text-ink/80">{actor}</span>
          {' assigned this bug to '}
          <span className="text-ink/70 font-medium">{newVal}</span>
        </>
      );
    }
    return (
      <>
        <span className="font-medium text-ink/80">{actor}</span>
        {' removed the assignee'}
      </>
    );
  }
  if (field === 'status') {
    const fmt = (v) => v ? v.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : v;
    return (
      <>
        <span className="font-medium text-ink/80">{actor}</span>
        {' changed status '}
        {oldVal ? <>{' from '}<span className="text-ink/70">{fmt(oldVal)}</span></> : ''}
        {' to '}
        <span className="text-ink/70 font-medium">{fmt(newVal)}</span>
      </>
    );
  }
  if (field === 'priority') {
    return (
      <>
        <span className="font-medium text-ink/80">{actor}</span>
        {oldVal
          ? <>{' changed priority from '}<span className="text-ink/70">{oldVal?.toUpperCase()}</span>{' to '}<span className="text-ink/70 font-medium">{newVal?.toUpperCase()}</span></>
          : <>{' set priority to '}<span className="text-ink/70 font-medium">{newVal?.toUpperCase()}</span></>}
      </>
    );
  }
  if (field === 'severity') {
    const cap = (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
    return (
      <>
        <span className="font-medium text-ink/80">{actor}</span>
        {oldVal
          ? <>{' changed severity from '}<span className="text-ink/70">{cap(oldVal)}</span>{' to '}<span className="text-ink/70 font-medium">{cap(newVal)}</span></>
          : <>{' set severity to '}<span className="text-ink/70 font-medium">{cap(newVal)}</span></>}
      </>
    );
  }
  if (field === 'due date') {
    if (!newVal) return <><span className="font-medium text-ink/80">{actor}</span>{' removed the due date'}</>;
    return <><span className="font-medium text-ink/80">{actor}</span>{' changed the due date to '}<span className="text-ink/70">{newVal}</span></>;
  }
  if (field === 'title') {
    return (
      <>
        <span className="font-medium text-ink/80">{actor}</span>
        {' renamed this bug to "'}
        <span className="text-ink/70">{newVal}</span>
        {'"'}
      </>
    );
  }
  if (field === 'description') {
    return <><span className="font-medium text-ink/80">{actor}</span>{' updated the description'}</>;
  }
  if (field === 'resolution') {
    return <><span className="font-medium text-ink/80">{actor}</span>{' set resolution to '}<span className="text-ink/70">{newVal}</span></>;
  }
  if (field === 'attachment') {
    return <><span className="font-medium text-ink/80">{actor}</span>{' added attachment: '}<span className="text-ink/70">{newVal}</span></>;
  }
  if (field === 'comment') {
    return <><span className="font-medium text-ink/80">{actor}</span>{' commented on this bug'}</>;
  }
  if (field === 'github pr') {
    return (
      <>
        <span className="font-medium text-ink/80">{actor}</span>
        {' linked a GitHub PR: '}
        <a href={newVal} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate max-w-xs inline-block align-bottom">
          {newVal}
        </a>
      </>
    );
  }
  if (field === 'product' || field === 'component') {
    return (
      <>
        <span className="font-medium text-ink/80">{actor}</span>
        {oldVal
          ? <>{` changed ${field} from `}<span className="text-ink/70">{oldVal}</span>{' to '}<span className="text-ink/70 font-medium">{newVal}</span></>
          : <>{` set ${field} to `}<span className="text-ink/70 font-medium">{newVal}</span></>}
      </>
    );
  }
  // Fallback generic
  return (
    <>
      <span className="font-medium text-ink/80">{actor}</span>
      {oldVal ? <>{` changed ${field} from `}<span className="text-ink/70">{oldVal}</span>{' to '}<span className="text-ink/70">{newVal}</span></> : <>{` set ${field} to `}<span className="text-ink/70">{newVal}</span></>}
    </>
  );
}

// ─── Comment body with @mention highlighting ──────────────────────────────────
function CommentBody({ body, users = [] }) {
  if (!body) return null;
  if (!users || users.length === 0) return <p className="text-sm text-ink/90 whitespace-pre-wrap">{body}</p>;

  const sortedNames = users
    .map((u) => u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);

  if (sortedNames.length === 0) return <p className="text-sm text-ink/90 whitespace-pre-wrap">{body}</p>;

  const regex = new RegExp(`@(${sortedNames.join('|')})(?=\\s|$|[,!?.;:])`, 'gi');
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="text-accent font-medium bg-accent/10 px-1 py-0.5 rounded">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return <p className="text-sm text-ink/90 whitespace-pre-wrap">{parts}</p>;
}

// ─── @mention autocomplete comment input ──────────────────────────────────────
function MentionInput({ value, onChange, users, placeholder, className }) {
  const [suggestions, setSuggestions] = useState([]);
  const [mentionStart, setMentionStart] = useState(-1);
  const ref = useRef(null);

  function handleChange(e) {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(val);
    // Find if we're mid-mention
    const textUpToCursor = val.slice(0, cursor);
    const atMatch = textUpToCursor.match(/@([\w ]*)$/);
    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      const filtered = users.filter((u) => u.name.toLowerCase().startsWith(query)).slice(0, 5);
      setSuggestions(filtered);
      setMentionStart(textUpToCursor.lastIndexOf('@'));
    } else {
      setSuggestions([]);
      setMentionStart(-1);
    }
  }

  function insertMention(user) {
    const before = value.slice(0, mentionStart);
    const after = value.slice(ref.current.selectionStart);
    const newVal = `${before}@${user.name} ${after}`;
    onChange(newVal);
    setSuggestions([]);
    setTimeout(() => ref.current?.focus(), 0);
  }

  return (
    <div className="relative flex-1">
      <input
        ref={ref}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
      />
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden z-30 min-w-[160px]">
          {suggestions.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-surface2 transition"
            >
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Days open helper ─────────────────────────────────────────────────────────
function daysOpen(bug) {
  return Math.floor((Date.now() - new Date(bug.created_at)) / (1000 * 60 * 60 * 24));
}

function computePeopleInvolved(bug) {
  const people = new Set();
  if (bug.reporter?.id) people.add(bug.reporter.id);
  if (bug.assignee?.id) people.add(bug.assignee.id);
  (bug.comments || []).forEach((c) => { if (c.author_id) people.add(c.author_id); });
  (bug.activity || []).forEach((a) => { if (a.actor_id) people.add(a.actor_id); });
  return people.size;
}

// ─── Bug Summary ──────────────────────────────────────────────────────────────
function BugSummary({ bug, commentCount, attachmentCount }) {
  const open = daysOpen(bug);
  const peopleCount = computePeopleInvolved(bug);
  const items = [
    { label: 'Status', value: <StatusPill status={bug.status} /> },
    { label: 'Assignee', value: bug.assignee?.name || <span className="text-muted">Unassigned</span> },
    { label: 'Priority', value: bug.priority?.toUpperCase() },
    { label: 'Severity', value: bug.severity },
    { label: 'Days open', value: open === 0 ? 'Today' : `${open}d` },
    { label: 'People', value: peopleCount },
    { label: 'Comments', value: commentCount },
    { label: 'Attachments', value: attachmentCount },
    { label: 'Activity', value: bug.activity?.length ?? '—' },
  ];
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Bug Summary</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {items.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-[11px] text-muted uppercase tracking-wide mb-0.5">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── GitHub PR Section ────────────────────────────────────────────────────────
function GitHubPRSection({ bug, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [prUrl, setPrUrl] = useState(bug.github_pr_url || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateBug(bug.id, { github_pr_url: prUrl || null });
      onUpdate();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const pr = bug.github_pr_url;
  const prNum = bug.github_pr_number;
  const prTitle = bug.github_pr_title;
  const prState = bug.github_pr_state;
  const repo = bug.github_repo;

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
          <GitHubIcon />
          GitHub PR
        </h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
            {pr ? 'Change' : 'Link PR'}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <input
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            placeholder="https://github.com/owner/repo/pull/123"
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-accent text-bg text-xs font-semibold px-3 py-1.5 rounded-lg hover:brightness-110 transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setPrUrl(bug.github_pr_url || ''); }} className="text-xs text-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      ) : pr ? (
        <div className="space-y-1">
          {prTitle && <p className="text-sm font-medium truncate">{prTitle}</p>}
          {repo && <p className="text-xs text-muted">{repo}{prNum ? ` #${prNum}` : ''}</p>}
          {prState && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${prState === 'open' ? 'bg-minor/15 text-minor border-minor/30' : prState === 'merged' ? 'bg-accent/15 text-accent border-accent/30' : 'bg-muted/15 text-muted border-muted/30'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {prState.charAt(0).toUpperCase() + prState.slice(1)}
            </span>
          )}
          <a href={pr} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline block truncate mt-1">
            {pr}
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted">No PR linked yet.</p>
      )}
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

// ─── Main BugDetail Component ─────────────────────────────────────────────────
export default function BugDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [bug, setBug] = useState(null);
  const [users, setUsers] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchBusy, setWatchBusy] = useState(false);

  async function load() {
    const [bugData, usersData, attachmentsData] = await Promise.all([
      api.getBug(id), api.listUsers(), api.listAttachments(id),
    ]);
    setBug(bugData);
    setUsers(usersData);
    setAttachments(attachmentsData);
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

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      await api.uploadAttachment(id, file);
      load();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attId) {
    await api.deleteAttachment(attId);
    load();
  }

  async function handleWatch() {
    setWatchBusy(true);
    try {
      if (bug.watching) {
        await api.unwatchBug(id);
      } else {
        await api.watchBug(id);
      }
      load();
    } finally {
      setWatchBusy(false);
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) return <div className="text-muted text-sm">Loading…</div>;
  if (!bug) return <div className="text-muted text-sm">Bug not found.</div>;

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-accent transition inline-flex items-center gap-1 mb-4">
        ← Back to board
      </Link>

      <div className="grid grid-cols-3 gap-6">
        {/* ── Main column ── */}
        <div className="col-span-2 space-y-4">
          {/* Bug header */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="font-display text-xl font-semibold leading-snug">{bug.title}</h1>
              <SeverityBadge severity={bug.severity} />
            </div>
            <div className="flex items-center flex-wrap gap-2 mb-3">
              <p className="text-xs text-muted font-mono">
                {bug.product?.name || 'Unassigned'} {bug.component ? `· ${bug.component.name}` : ''} · reported by {bug.reporter?.name}
              </p>
              <HealthBadge bug={bug} />
            </div>
            <p className="text-sm text-ink/90 whitespace-pre-wrap leading-relaxed">{bug.description || 'No description provided.'}</p>
          </div>

          {/* Attachments */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Attachments</h2>
              <label className="text-xs bg-surface2 border border-border rounded-lg px-3 py-1.5 cursor-pointer hover:border-accent/40 transition">
                {uploading ? 'Uploading…' : '+ Add file'}
                <input type="file" onChange={handleFileSelect} disabled={uploading} className="hidden" />
              </label>
            </div>
            {uploadError && (
              <div className="bg-critical/10 border border-critical/30 text-critical text-xs rounded-lg px-3 py-2 mb-3">
                {uploadError}
              </div>
            )}
            {attachments.length === 0 ? (
              <p className="text-sm text-muted">No files attached yet. Screenshots, logs, and patches all work — up to 10MB.</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-surface2 border border-border rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <PaperclipIcon />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{a.original_name}</p>
                        <p className="text-xs text-muted">
                          {formatBytes(a.size_bytes)} · {a.uploader_name} · {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <button
                        onClick={() => api.downloadAttachment(a.id, a.original_name)}
                        className="text-xs text-accent hover:underline"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteAttachment(a.id)}
                        className="text-xs text-muted hover:text-critical transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
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
                  <CommentBody body={c.body} users={users} />
                </div>
              ))}
            </div>
            <form onSubmit={handleComment} className="flex gap-2">
              <MentionInput
                value={commentText}
                onChange={setCommentText}
                users={users}
                placeholder="Add a comment… Use @Name to mention someone"
                className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition w-full"
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

          {/* Activity timeline */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3">Activity</h2>
            {bug.activity.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
            <div className="space-y-2">
              {bug.activity.map((a) => (
                <p key={a.id} className="text-xs text-muted leading-relaxed">
                  {formatActivityMessage(a)}
                  {' · '}
                  {new Date(a.created_at).toLocaleString()}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Bug Summary */}
          <BugSummary bug={bug} commentCount={bug.commentCount} attachmentCount={bug.attachmentCount} />

          {/* Watch button */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">Watching</p>
                <p className="text-xs text-muted">{bug.watcherCount} watcher{bug.watcherCount !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={handleWatch}
                disabled={watchBusy}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                  bug.watching
                    ? 'bg-accent/15 border-accent/40 text-accent hover:bg-critical/10 hover:border-critical/30 hover:text-critical'
                    : 'bg-surface2 border-border text-muted hover:border-accent/40 hover:text-ink'
                }`}
              >
                {watchBusy ? '…' : bug.watching ? '👁 Watching' : '+ Watch'}
              </button>
            </div>
          </div>

          {/* GitHub PR */}
          <GitHubPRSection bug={bug} onUpdate={load} />

          {/* Field controls */}
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

            <div>
              <label className="block text-xs text-muted mb-1.5">Due date</label>
              <input
                type="date"
                value={bug.due_date ? bug.due_date.slice(0, 10) : ''}
                onChange={(e) => handleFieldChange('due_date', e.target.value || null)}
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition"
              />
              <DueBadge dueDate={bug.due_date} status={bug.status} />
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

function DueBadge({ dueDate, status }) {
  if (!dueDate) return null;
  const done = ['resolved', 'verified', 'closed'].includes(status);
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (done) {
    return <p className="text-xs text-muted mt-1.5">Was due {due.toLocaleDateString()}</p>;
  }
  if (diffDays < 0) {
    return <p className="text-xs text-critical mt-1.5 font-medium">Overdue by {Math.abs(diffDays)} day{Math.abs(diffDays) !== 1 ? 's' : ''}</p>;
  }
  if (diffDays === 0) {
    return <p className="text-xs text-major mt-1.5 font-medium">Due today</p>;
  }
  if (diffDays <= 2) {
    return <p className="text-xs text-major mt-1.5 font-medium">Due in {diffDays} day{diffDays !== 1 ? 's' : ''}</p>;
  }
  return <p className="text-xs text-muted mt-1.5">Due in {diffDays} days</p>;
}

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0 text-muted">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
