import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { api } from '../lib/api';

const SEVERITY_COLORS = {
  blocker: '#DC2626', critical: '#EF4444', major: '#F59E0B',
  normal: '#3B82F6', minor: '#22C55E', trivial: '#8891A6',
};

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`font-display text-2xl font-semibold ${accent || ''}`}>{value}</p>
    </div>
  );
}

export default function Analytics() {
  const [stats, setStats] = useState(null);

  useEffect(() => { api.getStats().then(setStats); }, []);

  if (!stats) return <div className="text-muted text-sm">Loading analytics…</div>;

  const statusData = stats.byStatus.map((s) => ({ name: s.status.replace('_', ' '), count: s.count }));
  const severityData = stats.bySeverity.map((s) => ({ name: s.severity, value: s.count }));
  const productData = stats.byProduct.map((p) => ({ name: p.product || 'Unassigned', count: p.count }));

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight mb-1">Analytics</h1>
      <p className="text-muted text-sm mb-6">A pulse check on how the team is tracking against open issues.</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total issues" value={stats.totalCount} />
        <StatCard label="Currently open" value={stats.openCount} accent="text-critical" />
        <StatCard label="Resolved (7 days)" value={stats.recentlyResolved} accent="text-minor" />
        <StatCard label="Products tracked" value={stats.byProduct.length} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Issues by status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262E44" />
              <XAxis dataKey="name" stroke="#8891A6" fontSize={12} />
              <YAxis stroke="#8891A6" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#161C2C', border: '1px solid #262E44', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#F5A623" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Issues by severity</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {severityData.map((entry) => (
                  <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#8891A6'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#161C2C', border: '1px solid #262E44', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {severityData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS[s.name] }} />
                {s.name} ({s.value})
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 col-span-2">
          <h2 className="text-sm font-semibold mb-4">Issues by product</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={productData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#262E44" />
              <XAxis type="number" stroke="#8891A6" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="#8891A6" fontSize={12} width={100} />
              <Tooltip contentStyle={{ background: '#161C2C', border: '1px solid #262E44', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
