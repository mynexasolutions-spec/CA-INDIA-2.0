import { NavLink } from 'react-router-dom';
import { billingMode } from './billingProfile';
import { useReportsEnv } from './ReportsContext';

const ALL_LINKS = [
  { path: 'gst-summary', label: 'GST Summary', gstOnly: true },
  { path: 'gst-liability', label: 'GST Liability', regularOnly: true },
  { path: 'hsn-summary', label: 'HSN / SAC Summary', gstOnly: true },
  { path: 'document-numbering', label: 'Document Numbering', gstOnly: false },
  { path: 'party-wise', label: 'Party-wise Detail', gstOnly: false },
  { path: 'outstanding', label: 'Outstanding', gstOnly: false },
];

export default function ReportsSubNav() {
  const env = useReportsEnv();
  const mode = billingMode(env.profile);
  const links = ALL_LINKS.filter((link) => {
    if (mode === 'retail' && link.gstOnly) return false;
    if (mode !== 'regular' && link.regularOnly) return false;
    return true;
  });

  if (!links.length) return null;

  return (
    <nav className="bp-section-nav" aria-label="Reports section">
      {links.map((l) => (
        <NavLink
          key={l.path}
          to={`${env.basePath}/${l.path}`}
          className={({ isActive }) => `bp-section-nav-link${isActive ? ' active' : ''}`}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
