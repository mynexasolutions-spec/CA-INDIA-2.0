import { Link } from 'react-router-dom';
import Seo from '../../components/seo/Seo';

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

function HandshakeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12.5 6 9l3.5 3-1.4 1.4a1.6 1.6 0 0 0 2.26 2.26L14 12l4 4-1.3 1.3a2 2 0 0 1-2.83 0L12 15.5" />
      <path d="M22 12.5 18 9l-4.5 4" />
      <path d="M9.5 12 6 8.5" />
      <path d="M6 9 3.5 6.5" />
      <path d="M18 9l2.5-2.5" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5.1" />
    </svg>
  );
}

function AlertClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ConfirmDocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function DocBase() {
  return (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="7.5" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="7.5" y1="16.2" x2="11" y2="16.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function RupeeDocIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      <DocBase />
      <circle cx="17.3" cy="17.3" r="5" fill="currentColor" stroke="#fff" strokeWidth="1.2" />
      <text x="17.3" y="19.7" fontSize="6.5" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Inter, sans-serif">₹</text>
    </svg>
  );
}

function PlusDocIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      <DocBase />
      <circle cx="17.3" cy="17.3" r="5" fill="currentColor" stroke="#fff" strokeWidth="1.2" />
      <line x1="15.1" y1="17.3" x2="19.5" y2="17.3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17.3" y1="15.1" x2="17.3" y2="19.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MinusDocIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      <DocBase />
      <circle cx="17.3" cy="17.3" r="5" fill="currentColor" stroke="#fff" strokeWidth="1.2" />
      <line x1="15.1" y1="17.3" x2="19.5" y2="17.3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function HashDocIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      <DocBase />
      <circle cx="17.3" cy="17.3" r="5" fill="currentColor" stroke="#fff" strokeWidth="1.2" />
      <line x1="15.4" y1="18.6" x2="16.3" y2="16" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="18.3" y1="18.6" x2="19.2" y2="16" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TruckDocIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      <DocBase />
      <circle cx="17.3" cy="17.3" r="5" fill="currentColor" stroke="#fff" strokeWidth="1.2" />
      <rect x="14.3" y="16.2" width="3.4" height="2.1" fill="#fff" stroke="none" />
      <rect x="17.7" y="17" width="1.5" height="1.3" fill="#fff" stroke="none" />
      <circle cx="15.6" cy="18.7" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="18.3" cy="18.7" r="0.55" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <rect x="15" y="15" width="6" height="6" rx="1" />
      <path d="M12 9v3M6 15v-3h12v3" />
    </svg>
  );
}

function NumberingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <circle cx="8.5" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MultiUserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <line x1="18.5" y1="6" x2="18.5" y2="12" />
      <line x1="15.5" y1="9" x2="21.5" y2="9" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BackupIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A5.5 5.5 0 0 1 17.2 8.1 4 4 0 0 1 17 18H7z" />
      <path d="M9.5 13.3 11 14.8l3.2-3.6" />
    </svg>
  );
}

const overviewBullets = [
  { icon: <ClockIcon />, label: 'Timely Filing after approval' },
  { icon: <CheckCircleIcon />, label: 'No Last-Minute Filing Stress' },
  { icon: <AlertClockIcon />, label: 'Avoid Delays & Compliance Risks' },
  { icon: <ConfirmDocIcon />, label: 'Filing Confirmation in Client Portal' },
];

const documentTypes = [
  { icon: <RupeeDocIcon />, title: 'Tax Invoice', text: 'Create professional GST-compliant tax invoices.' },
  { icon: <PlusDocIcon />, title: 'Bill of Supply', text: 'Generate bills of supply for applicable transactions.' },
  { icon: <MinusDocIcon />, title: 'Debit Note', text: 'Record additional charges and upward adjustments.' },
  { icon: <MinusDocIcon />, title: 'Credit Note', text: 'Record returns, discounts and downward adjustments.' },
  { icon: <HashDocIcon />, title: 'Quotation', text: 'Share professional quotations with your customers.' },
  { icon: <TruckDocIcon />, title: 'Delivery Challan', text: 'Track goods movement with vehicle, transporter and e-way bill details.' },
];

const automationItems = [
  { title: 'HSN / SAC with GST Rate', text: 'Search & apply correct HSN/SAC codes.' },
  { title: 'Automatic CGST / SGST / IGST', text: 'Accurate tax calculation for intra & inter-state.' },
  { title: 'Taxable Value Calculation', text: 'Automatically calculated after discounts.' },
  { title: 'GST Summary & Liability', text: 'Detailed GST reports at your fingertips.' },
];

const workflowSteps = [
  { title: 'Create', text: 'Select party & add products/services' },
  { title: 'Calculate', text: 'GST, discounts & totals calculated automatically' },
  { title: 'Review', text: 'Review invoice details before generating' },
  { title: 'Generate', text: 'Generate professional PDF document' },
  { title: 'Share', text: 'Share via Email or WhatsApp' },
  { title: 'Track', text: 'Track payments & outstanding easily' },
];

const reportItems = [
  'GST Summary Report',
  'GST Liability Report',
  'HSN / SAC Summary',
  'Party-wise Details',
  'Outstanding Report',
  'Sales Report',
];

const miniFeatures = [
  { icon: <NumberingIcon />, title: 'Custom Numbering', text: 'Prefix, series & FY-wise invoice numbering' },
  { icon: <MultiUserIcon />, title: 'Multi-User Access', text: 'Role-based access for your team' },
  { icon: <MobileIcon />, title: 'Mobile Friendly', text: 'Access your billing workspace anywhere' },
  { icon: <ShieldIcon />, title: 'Secure & Reliable', text: 'Your data is safe with us' },
  { icon: <BackupIcon />, title: 'Backup & Data Safety', text: 'Automatic backup & secure storage' },
];

export default function BillingManagement() {
  return (
    <>
      <Seo
        title="GST Billing Management Software | A B KHAN & ASSOCIATES"
        description="GST-ready billing software for businesses in Navi Mumbai — invoices, credit notes, masters, reports, PDF and WhatsApp sharing."
        path="/billing-management"
      />
      <section className="section" id="overview">
        <div className="container billing-overview-grid">
          <div>
            <h2>
              Professional GST Billing,
              <br />
              <span className="accent-blue">Made Simple</span>
            </h2>
            <p>
              Create GST-compliant invoices, manage customers and products, track payments, and access business
              reports — all from one secure client portal.
            </p>

            <div className="billing-overview-card">
              <div className="billing-overview-card-row">
                <div className="billing-overview-card-col">
                  <div className="billing-overview-card-item">
                    <span className="billing-overview-card-icon blue">
                      <RocketIcon />
                    </span>
                    <div>
                      <h4>Go Digital with Your Billing</h4>
                      <p>Move from manual billing to a smarter digital billing experience.</p>
                    </div>
                  </div>
                  <div className="billing-overview-card-price">
                    <span>Starting at just</span>
                    <strong>
                      ₹1,499<sup>*</sup>
                    </strong>
                  </div>
                </div>
                <div className="billing-overview-card-divider" />
                <div className="billing-overview-card-item">
                  <span className="billing-overview-card-icon green">
                    <ShieldCheckIcon />
                  </span>
                  <div>
                    <h4>Your Billing. Our Compliance Support.</h4>
                    <p>
                      If you have opted for our GST Filing Services, once your GST return data is approved, we aim to
                      complete the filing on the next working day.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="billing-feature-bullets">
              {overviewBullets.map((b) => (
                <div key={b.label} className="billing-feature-bullet">
                  {b.icon}
                  <span>{b.label}</span>
                </div>
              ))}
            </div>

            <div className="hero-actions">
              <Link to="/login" className="btn btn-navy btn-arrow">
                Get Started <span className="btn-arrow-bubble"><ArrowIcon /></span>
              </Link>
              <Link to="/contact" className="btn btn-outline-navy btn-arrow">
                Book a Demo <span className="btn-arrow-bubble"><ArrowIcon /></span>
              </Link>
            </div>
          </div>

          {/* Same composited laptop+mobile graphic as the homepage hero. */}
          <div className="billing-hero-visual billing-hero-visual-plain billing-hero-visual-light">
            <img
              src="/assets/laptop-mobile-dashboard.png"
              alt="Client Portal billing dashboard preview on laptop and mobile"
              className="billing-hero-visual-img"
            />
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="billing-dotted-head">
            <h2>Complete Billing Documents</h2>
          </div>
          <div className="billing-doctypes-grid">
            {documentTypes.map((d) => (
              <div key={d.title} className="billing-doctype-card">
                <span className="billing-doctype-icon">{d.icon}</span>
                <h4>{d.title}</h4>
                <p>{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="billing-panels-grid">
            <div className="billing-panel green">
              <div className="billing-panel-head">
                <CheckCircleIcon />
                <span>Smart GST Automation</span>
              </div>
              {automationItems.map((item) => (
                <div key={item.title} className="billing-panel-item">
                  <span className="billing-panel-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg></span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="billing-panel blue">
              <div className="billing-panel-head">
                <WorkflowIcon />
                <span>Simple Billing Workflow</span>
              </div>
              {workflowSteps.map((step, i) => (
                <div key={step.title} className="billing-panel-item">
                  <span className="billing-panel-step">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="billing-panel purple">
              <div className="billing-panel-head">
                <ChartIcon />
                <span>Powerful Business Reports</span>
              </div>
              {reportItems.map((r) => (
                <div key={r} className="billing-panel-item">
                  <span className="billing-panel-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg></span>
                  <div>
                    <strong style={{ marginBottom: 0 }}>{r}</strong>
                  </div>
                </div>
              ))}
              <div className="billing-panel-reports-total">
                <strong>17+ Business Reports</strong>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Export to Excel / CSV</div>
              </div>
            </div>
          </div>

          <div className="billing-mini-features">
            {miniFeatures.map((f) => (
              <div key={f.title} className="billing-mini-feature">
                <span className="billing-mini-feature-icon">{f.icon}</span>
                <div>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-banner">
            <div className="cta-banner-lead">
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--navy-deep)',
                }}
              >
                <HandshakeIcon />
              </span>
              <div>
                <h3>Ready to Simplify Your Billing?</h3>
                <p>Create GST-compliant documents, manage your billing and stay organised — all from one secure portal.</p>
              </div>
            </div>
            <div className="actions">
              <Link to="/login" className="btn btn-gold btn-arrow">
                Get Started <span className="btn-arrow-bubble btn-arrow-bubble-gold"><ArrowIcon /></span>
              </Link>
              <Link to="/contact" className="btn btn-outline btn-arrow">
                Book a Demo <span className="btn-arrow-bubble btn-arrow-bubble-outline"><ArrowIcon /></span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
