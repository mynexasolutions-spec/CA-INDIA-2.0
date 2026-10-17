import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ReportsProvider, adminReportsEnv } from '../billing/ReportsContext';
import ReportsSubNav from '../billing/ReportsSubNav';

/**
 * Wraps the Report Dashboard and every report page for ONE selected client.
 *
 * The pages inside are the very same components the Client Portal renders; this layout only
 * tells them which client they are showing (via the reports environment) and adds the Admin
 * navigation around them (back to the client list, which client, switch between reports).
 */
export default function AdminReportsLayout() {
  const { clientId } = useParams();
  const { pathname } = useLocation();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    setProfile(null);
    api(`/admin/clients/${clientId}?directory=1`)
      .then((d) => setProfile(d?.client_profile ?? d))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [clientId]);

  const env = useMemo(() => adminReportsEnv(clientId, profile), [clientId, profile]);

  if (loading) {
    return <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>Loading client…</div>;
  }

  if (failed || !profile) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>Client not found.</p>
        <Link to="/admin/reports" style={{ color: '#2563eb', fontWeight: 600 }}>← Back to client list</Link>
      </div>
    );
  }

  const name = profile.business_name || profile.client_name || 'Client';
  const onDashboard = pathname.replace(/\/$/, '') === env.basePath;

  return (
    <ReportsProvider value={env}>
      <div className="bp-section-wrap">
        {/* Which client the Admin is looking at — everything below is exactly that client's own view */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
            background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '9px 16px', marginBottom: 16, fontSize: 13,
          }}
        >
          <div style={{ color: '#1e3a8a' }}>
            Viewing reports for <strong>{name}</strong>
            {profile.client_code ? <span style={{ color: '#64748b' }}> · {profile.client_code}</span> : null}
            {profile.gstin ? <span style={{ color: '#64748b' }}> · GSTIN {profile.gstin}</span> : null}
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            {!onDashboard && (
              <Link to={env.basePath} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>← Report Dashboard</Link>
            )}
            <Link to="/admin/reports" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>All clients</Link>
          </div>
        </div>

        {!onDashboard && <ReportsSubNav />}

        <Outlet />
      </div>
    </ReportsProvider>
  );
}
