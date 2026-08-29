const SEVERITY_COLORS = {
  blocker: 'bg-blocker/15 text-blocker border-blocker/30',
  critical: 'bg-critical/15 text-critical border-critical/30',
  major: 'bg-major/15 text-major border-major/30',
  normal: 'bg-normal/15 text-normal border-normal/30',
  minor: 'bg-minor/15 text-minor border-minor/30',
  trivial: 'bg-trivial/15 text-trivial border-trivial/30',
};

const STATUS_DOT = {
  open: 'bg-critical',
  in_progress: 'bg-major',
  resolved: 'bg-normal',
  verified: 'bg-minor',
  closed: 'bg-muted',
  reopened: 'bg-accent',
};

const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  verified: 'Verified',
  closed: 'Closed',
  reopened: 'Reopened',
};

export function SeverityBadge({ severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wide border ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.normal}`}>
      {severity}
    </span>
  );
}

export function StatusPill({ status }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface2 border border-border text-xs font-medium">
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || 'bg-muted'}`} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export { STATUS_LABEL, STATUS_DOT };
