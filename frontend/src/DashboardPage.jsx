import { useEffect, useState } from 'react';

function DashboardPage({ onProducts }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/dashboard', { credentials: 'include' }).then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error); if (!body.statistics || !Array.isArray(body.recentlyAdded) || !Array.isArray(body.nearestExpiration)) throw new Error('Dashboard data is invalid. Please refresh the page.'); return body; }).then(setData).catch((e) => setError(e.message || 'Unable to load dashboard.')); }, []);
  if (error) return <main className="products-page"><p className="error" role="alert">{error}</p></main>;
  if (!data) return <main className="products-page"><p role="status">Loading dashboard...</p></main>;
  const cards = [['Total Products', data.statistics.total, 'All products', ''], ['Active Warranties', data.statistics.active, 'More than 30 days remaining', 'Active'], ['Expiring Soon', data.statistics.expiringSoon, 'Within the next 30 days', 'Expiring Soon'], ['Expired Warranties', data.statistics.expired, 'Warranty has ended', 'Expired']];
  return <main className="products-page dashboard"><h1>Dashboard</h1><p>Overview of your warranty collection.</p><section className="dashboard-cards">{cards.map(([label, value, description, status]) => <button className="dashboard-card" key={label} onClick={() => onProducts(status)}><span className="dashboard-count">{value}</span><strong>{label}</strong><small>{description}</small><span>View products →</span></button>)}</section><section className="dashboard-section"><h2>Recently Added</h2>{data.recentlyAdded.length ? <ul className="dashboard-list">{data.recentlyAdded.map((p) => <li key={p.id}><strong>{p.name}</strong><span>{p.category} · {p.warrantyStatus}</span></li>)}</ul> : <p className="empty-state">No products yet. Add your first product to see it here.</p>}</section><section className="dashboard-section"><h2>Nearest Expiration Dates</h2>{data.nearestExpiration.length ? <ul className="dashboard-list">{data.nearestExpiration.map((p) => <li key={p.id}><strong>{p.name}</strong><span>{p.expirationDate} · {p.remainingWarrantyDays} days · {p.warrantyStatus}</span></li>)}</ul> : <p className="empty-state">No active warranties with an upcoming expiration.</p>}</section></main>;
}
export default DashboardPage;
