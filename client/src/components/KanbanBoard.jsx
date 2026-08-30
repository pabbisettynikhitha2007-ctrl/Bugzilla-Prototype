import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SeverityBadge } from './Badges';

const COLUMNS = [
  { key: 'open', label: 'Open', dot: 'bg-critical' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-major' },
  { key: 'resolved', label: 'Resolved', dot: 'bg-normal' },
  { key: 'verified', label: 'Verified', dot: 'bg-minor' },
  { key: 'closed', label: 'Closed', dot: 'bg-muted' },
];

export default function KanbanBoard({ bugs, onStatusChange }) {
  const [dragOverCol, setDragOverCol] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  function handleDrop(e, status) {
    e.preventDefault();
    setDragOverCol(null);
    const bugId = e.dataTransfer.getData('text/bug-id');
    if (bugId) onStatusChange(bugId, status);
    setDraggingId(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {COLUMNS.map((col) => {
        const colBugs = bugs.filter((b) => b.status === col.key);
        const isOver = dragOverCol === col.key;
        return (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
            onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => handleDrop(e, col.key)}
            className={`flex-shrink-0 w-72 rounded-xl border transition ${
              isOver ? 'border-accent bg-accent/5' : 'border-border bg-surface'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                <span className="text-sm font-medium">{col.label}</span>
              </div>
              <span className="text-xs text-muted font-mono">{colBugs.length}</span>
            </div>

            <div className="p-2 space-y-2 min-h-[120px]">
              {colBugs.map((bug) => (
                <div
                  key={bug.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/bug-id', bug.id);
                    setDraggingId(bug.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className={`bg-surface2 border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition ${
                    draggingId === bug.id ? 'opacity-40' : 'hover:border-accent/40'
                  }`}
                >
                  <Link to={`/bugs/${bug.id}`} className="text-sm font-medium leading-snug hover:text-accent transition block mb-1.5">
                    {bug.title}
                  </Link>
                  <div className="flex items-center justify-between">
                    <SeverityBadge severity={bug.severity} />
                    {bug.assignee ? (
                      <span className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-semibold" title={bug.assignee.name}>
                        {bug.assignee.name[0].toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted">Unassigned</span>
                    )}
                  </div>
                </div>
              ))}
              {colBugs.length === 0 && (
                <p className="text-xs text-muted text-center py-6">Drop a bug here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
