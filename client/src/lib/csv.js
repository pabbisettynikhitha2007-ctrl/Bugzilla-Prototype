export function toCSV(bugs) {
  const headers = ['Title', 'Status', 'Severity', 'Priority', 'Product', 'Component', 'Assignee', 'Reporter', 'Created', 'Updated'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = bugs.map((b) => [
    b.title, b.status, b.severity, b.priority,
    b.product?.name || '', b.component?.name || '',
    b.assignee?.name || '', b.reporter?.name || '',
    b.created_at, b.updated_at,
  ].map(escape).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(bugs, filename = 'bugs-export.csv') {
  const csv = toCSV(bugs);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
