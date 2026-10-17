import { useState } from 'react';
import { Link } from 'react-router-dom';
import Seo, { firmJsonLd } from '../../components/seo/Seo';
import { CONTACT, REGISTRATIONS, SERVICES } from '../../data/nav';
import { api } from '../../api/client';
import BillingHeroCard from '../../components/marketing/BillingHeroCard';

const serviceDescriptions = {
  '/services/accounting': 'Bookkeeping, management reporting, and outsourced accounting support.',
  '/services/audit': 'Independent assurance, internal controls, and statutory audit support.',
  '/services/income-tax': 'Return filing, tax planning, notices, and practical advisory.',
  '/services/gst': 'Registration, returns, reconciliation, refunds, and GST advisory.',
  '/services/roc-compliance': 'Company filings, annual compliance, and governance support.',
  '/services/financial-advisory': 'Financial analysis, planning, and decision-ready business insights.',
};

const serviceCodes = {
  '/services/accounting': 'AC',
  '/services/audit': 'AU',
  '/services/income-tax': 'IT',
  '/services/gst': 'GST',
  '/services/roc-compliance': 'ROC',
  '/services/financial-advisory': 'FA',
};

const featuredServices = [SERVICES[0], SERVICES[1], SERVICES[2], SERVICES[3], SERVICES[4], SERVICES[6]];

const process = [
  {
    number: '01',
    title: 'Understand',
    text: 'We review your structure, priorities, and current compliance position.',
  },
  {
    number: '02',
    title: 'Plan',
    text: 'You receive a clear scope, document checklist, and practical next steps.',
  },
  {
    number: '03',
    title: 'Deliver',
    text: 'Our team completes the work and keeps you informed through every stage.',
  },
];

const assurancePoints = [
  'Integrity and transparent communication',
  'Accurate, detail-focused execution',
  'Timely compliance and proactive follow-up',
  'Secure online access for clients and staff',
];

const networkHighlights = ['Trusted Relationships', 'Global Compliance', 'Cross-Border Expertise', 'Business Growth'];

const globalNetwork = [
  {
    code: 'IN',
    flag: '/assets/flags/in.png',
    name: 'India',
    text: 'Strong local presence across key cities with in-depth expertise and timely solutions.',
  },
  {
    code: 'AE',
    flag: '/assets/flags/ae.png',
    name: 'UAE',
    text: 'Strategic partners delivering end-to-end tax, VAT & advisory services.',
  },
  {
    code: 'SA',
    flag: '/assets/flags/sa.png',
    name: 'Saudi Arabia',
    text: 'Experienced associates offering ZATCA, tax & compliance advisory across industries.',
  },
  {
    code: 'KW',
    flag: '/assets/flags/kw.png',
    name: 'Kuwait',
    text: 'Trusted advisors providing tax, audit & business consultation services.',
  },
];

const testimonials = [
  {
    name: 'S. K. Traders',
    role: 'Business Client',
    initials: 'SK',
    review:
      'I am getting my work done from CA Abdul Basit and everything is completed on time. He resolves all my queries quickly. I also got my brand registration done through him, and everything was done perfectly. Always recommended.',
  },
  {
    name: 'Salman Khan',
    role: 'Trademark Client',
    initials: 'S',
    review:
      'Excellent CA service for brand patent and trademark registration. Very professional, knowledgeable, and supportive throughout the complete process. They explained everything clearly and handled all documentation smoothly.',
  },
  {
    name: 'Dk Shaikh',
    role: 'Accounting & Tax',
    initials: 'DS',
    review:
      'Excellent service by the CA. Very professional, knowledgeable, and supportive. All work was completed on time with clear guidance. Highly recommended for accounting and tax-related services.',
  },
  {
    name: 'Chabi Shaikh',
    role: 'Income Tax & GST',
    initials: 'CS',
    review:
      'Since I started working with this firm, all my work has been managed properly and in sequence. All my Income Tax and GST work is completed on time. I will always recommend this firm.',
  },
  {
    name: 'Ramiz Khan',
    role: 'Taxation & Planning',
    initials: 'RK',
    review: 'Professional, knowledgeable, and very supportive. Excellent guidance in taxation and financial planning. Definitely recommend this firm!',
  },
  {
    name: 'A1 Enterprises',
    role: 'Compliance Client',
    initials: 'A1',
    review: 'Perfect advice, all compliance done in a timely manner. Best service — highly recommended for anyone looking for reliable CA support.',
  },
];

const contactServices = ['General Enquiry', 'Accounting', 'Taxation', 'GST', 'Audit', 'Business Registration', 'Billing Software'];

function HomeContactForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', service: contactServices[0], message: '' });
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'sending', message: '' });
    try {
      await api('/contact', { method: 'POST', body: form });
      setStatus({ state: 'success', message: "Thank you! We've received your message and will respond shortly." });
      setForm({ name: '', phone: '', email: '', service: contactServices[0], message: '' });
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Something went wrong. Please try again.' });
    }
  };

  return (
    <form className="home-page__contact-form" onSubmit={onSubmit} noValidate>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="hp-name">Name *</label>
          <input id="hp-name" className="form-control" required value={form.name} onChange={update('name')} />
        </div>
        <div className="form-group">
          <label htmlFor="hp-phone">Phone Number *</label>
          <input id="hp-phone" type="tel" className="form-control" required value={form.phone} onChange={update('phone')} />
        </div>
      </div>
      <div className="form-group full">
        <label htmlFor="hp-email">Email Address *</label>
        <input id="hp-email" type="email" className="form-control" required value={form.email} onChange={update('email')} />
      </div>
      <div className="form-group full">
        <label htmlFor="hp-service">Service Required</label>
        <select id="hp-service" className="form-control" value={form.service} onChange={update('service')}>
          {contactServices.map((service) => (
            <option key={service}>{service}</option>
          ))}
        </select>
      </div>
      <div className="form-group full">
        <label htmlFor="hp-message">Message *</label>
        <textarea id="hp-message" className="form-control" rows="4" required value={form.message} onChange={update('message')} />
      </div>
      <button type="submit" className="btn btn-navy home-page__contact-submit" disabled={status.state === 'sending'}>
        {status.state === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
      <p className="form-note">We typically respond within one business day.</p>
      {status.state === 'success' && <p className="form-success" style={{ display: 'block' }}>{status.message}</p>}
      {status.state === 'error' && (
        <p className="form-note" role="alert" style={{ color: '#c0392b' }}>{status.message}</p>
      )}
    </form>
  );
}

export default function HomePage() {
  return (
    <>
      <Seo path="/" jsonLd={firmJsonLd} />

      <section className="home-page__hero">
        <div className="container home-page__hero-grid">
          <div className="home-page__hero-copy">
            <p className="eyebrow">Chartered Accountants &amp; Business Advisors</p>
            <h1>Your Trusted Chartered Accountant for Business Growth.</h1>
            <p className="home-page__lead">
              We provide comprehensive solutions for Accounting, Taxation, Audit, GST, Business Registration and Corporate Compliance.
            </p>
            <div className="home-page__hero-actions">
              <Link to="/contact" className="btn btn-gold">Book a Consultation</Link>
              <Link to="/services" className="btn btn-outline">Explore Services</Link>
            </div>
            <div className="home-page__trust-row" aria-label="Service advantages">
              <span>Professional guidance</span>
              <span>Timely compliance</span>
              <span>Secure client access</span>
            </div>
            <div className="home-page__hero-badge" aria-hidden="true">
              <span>Navi Mumbai</span>
              <span>&middot;</span>
              <span>Pan-India clients</span>
              <span>&middot;</span>
              <span>All major GST states</span>
            </div>
          </div>

          <div className="home-page__hero-visual" aria-label="Overview of the firm's digital services">
            <div className="home-page__visual-orbit home-page__visual-orbit--one" />
            <div className="home-page__visual-orbit home-page__visual-orbit--two" />
            <div className="home-page__dashboard-card home-page__dashboard-card--photo">
              <p className="home-page__dashboard-photo-heading">Compliance at a Glance</p>
              <img
                src="/assets/compliance.png"
                alt="Accountant reviewing compliance and financial reports"
                className="home-page__dashboard-photo"
              />
            </div>
            <div className="home-page__floating-card home-page__floating-card--top">
              <span className="home-page__floating-icon">01</span>
              <div><strong>One secure login</strong><span>Automatic role-based access</span></div>
            </div>
            <div className="home-page__floating-card home-page__floating-card--bottom">
              <span className="home-page__floating-icon">24</span>
              <div><strong>Always available</strong><span>Invoices, reports, and records</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section home-page__services" id="services">
        <div className="container">
          <div className="home-page__section-heading">
            <div>
              <p className="eyebrow">What We Do</p>
              <h2>Professional services built around your business.</h2>
            </div>
            <p>
              From day-to-day accounting to complex compliance, our team brings structure, clarity, and dependable
              execution to every engagement.
            </p>
          </div>
          <div className="home-page__service-grid">
            {featuredServices.map((service) => (
              <Link key={service.path} to={service.path} className="home-page__service-card">
                <span className="home-page__service-icon" aria-hidden="true">{serviceCodes[service.path]}</span>
                <h3>{service.label}</h3>
                <p>{serviceDescriptions[service.path]}</p>
                <span className="home-page__card-link">Learn more <span aria-hidden="true">&rarr;</span></span>
              </Link>
            ))}
          </div>
          <div className="home-page__center-action">
            <Link to="/services" className="btn btn-outline-navy">View All Services</Link>
          </div>
        </div>
      </section>

      <section className="section home-page__about">
        <div className="container home-page__about-grid">
          <div className="home-page__about-visual" aria-hidden="true">
            <img src="/assets/ABK.png" alt="" className="home-page__about-photo" />
            <div className="home-page__about-label">
              <strong>Structured advice.</strong>
              <span>Practical outcomes.</span>
            </div>
          </div>
          <div className="home-page__about-copy">
            <p className="eyebrow">About Our Firm</p>
            <h2>Professional advice, delivered with clarity and care.</h2>
            <p>
              A B Khan &amp; Associates supports businesses, startups, professionals, and individuals with financial and
              compliance solutions tailored to their goals. We combine technical rigour with communication that stays
              straightforward and useful.
            </p>
            <div className="home-page__assurance-grid">
              {assurancePoints.map((point) => (
                <div key={point}><span aria-hidden="true" style={{ display: 'inline-flex', marginRight: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg></span>{point}</div>
              ))}
            </div>
            <Link to="/about" className="btn btn-navy">Discover Our Firm</Link>
          </div>
        </div>
      </section>

      <section className="section home-page__network" aria-label="Global associates network">
        <div className="container">
          <div className="section-head center home-page__center-heading">
            <p className="eyebrow">International Reach</p>
            <h2>Global Associates Network</h2>
            <p>
              Supported by a trusted network of associate partners across <strong>India</strong> and key
              international jurisdictions including the <strong>UAE, Saudi Arabia &amp; Kuwait</strong>.
            </p>
          </div>
          <ul className="home-page__network-points">
            {networkHighlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="home-page__network-grid">
            {globalNetwork.map((region) => (
              <article key={region.code} className="home-page__network-card">
                <span className="home-page__network-flag">
                  <img src={region.flag} alt="" width="64" height="64" loading="lazy" />
                </span>
                <h3>{region.name}</h3>
                <p>{region.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="billing-hero-section" id="billing">
        <div className="container">
          <BillingHeroCard exploreTo="/billing-management" />
        </div>
      </section>

      <section className="section home-page__process-section">
        <div className="container">
          <div className="section-head center home-page__center-heading">
            <p className="eyebrow">How We Work</p>
            <h2>A clear process from first conversation to final delivery.</h2>
            <p>Every engagement is structured to reduce uncertainty and keep the next step visible.</p>
          </div>
          <div className="home-page__process-grid">
            {process.map((step) => (
              <article key={step.number} className="home-page__step-card">
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section home-page__portal-section">
        <div className="container home-page__portal-grid">
          <div>
            <p className="eyebrow">Secure Online Portal</p>
            <h2>One login. The right dashboard, automatically.</h2>
            <p>
              Use your registered credentials to sign in. Admin and staff accounts are directed to the admin dashboard,
              while client accounts open the client portal—no separate login pages to choose from.
            </p>
            <ul className="home-page__portal-list">
              <li>Access billing, invoices, reports, and business records</li>
              <li>Role-based access keeps each account in the correct workspace</li>
              <li>Responsive experience across desktop, tablet, and mobile</li>
            </ul>
            <Link to="/login" className="btn btn-gold home-page__login-btn">Login to Your Account</Link>
          </div>
          <div className="home-page__registration-card">
            <p className="eyebrow">Start a Business</p>
            <h3>Choose the right structure with confidence.</h3>
            <p>Get support for incorporation, registrations, and the compliance steps that follow.</p>
            <div className="home-page__chip-row">
              {REGISTRATIONS.slice(0, 6).map((item) => (
                <Link key={item.path} to={item.path}>{item.label}</Link>
              ))}
            </div>
            <Link to="/business-registration" className="home-page__text-link">
              Explore registration services <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section testimonials">
        <div className="container">
          <div className="section-head center">
            <p className="eyebrow" style={{ justifyContent: 'center' }}>Client Testimonials</p>
            <h2>What Our Clients Say About Us</h2>
            <p>
              Trusted by businesses and professionals across Navi Mumbai for reliable accounting, taxation, audit,
              compliance, and business advisory services.
            </p>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((item) => (
              <article key={item.name} className="test-card">
                <div className="test-stars" aria-label="5 out of 5 stars" style={{ display: 'flex', gap: 3 }}>{[0, 1, 2, 3, 4].map((n) => (<svg key={n} width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>))}</div>
                <div className="test-quote-icon" aria-hidden="true">&ldquo;</div>
                <p className="review">{item.review}</p>
                <div className="test-person">
                  <div className="test-avatar">{item.initials}</div>
                  <div>
                    <h5>{item.name}</h5>
                    <span>{item.role}</span>
                  </div>
                  <span className="verified-badge">Google Review</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section home-page__contact-details" id="contact">
        <div className="container contact-grid">
          <div>
            <p className="eyebrow">Get In Touch</p>
            <h2 className="home-page__contact-details-heading">Contact Us</h2>
            <p className="home-page__contact-details-lead">
              Tell us what you need and our team will help you identify the right next step.
            </p>
            <div className="contact-info-item">
              <div className="ci-icon home-page__ci-icon" aria-hidden="true">AD</div>
              <div><h4>Office Address</h4><p>{CONTACT.address}</p></div>
            </div>
            <div className="contact-info-item">
              <div className="ci-icon home-page__ci-icon" aria-hidden="true">PH</div>
              <div><h4>Phone</h4><p><a href={CONTACT.phoneHref}>{CONTACT.phone}</a></p></div>
            </div>
            <div className="contact-info-item">
              <div className="ci-icon home-page__ci-icon" aria-hidden="true">EM</div>
              <div><h4>Email</h4><p><a href={CONTACT.emailHref}>{CONTACT.email}</a></p></div>
            </div>
            <div className="contact-info-item">
              <div className="ci-icon home-page__ci-icon" aria-hidden="true">HR</div>
              <div><h4>Business Hours</h4><p>{CONTACT.hours}</p></div>
            </div>
            <div className="map-embed">
              <iframe
                title="A B Khan & Associates office location"
                loading="lazy"
                src="https://maps.google.com/maps?q=Seawoods%20East%20Sector%2023%20Navi%20Mumbai&t=&z=14&output=embed"
              />
            </div>
          </div>
          <div className="home-page__contact-form-card">
            <HomeContactForm />
          </div>
        </div>
      </section>

      <section className="section home-page__contact-section">
        <div className="container">
          <div className="home-page__contact-card">
            <div>
              <p className="eyebrow">Let&apos;s Talk</p>
              <h2>Ready to bring more clarity to your finances?</h2>
              <p>Tell us what you need and our team will help you identify the right next step.</p>
            </div>
            <div className="home-page__contact-actions">
              <Link to="/contact" className="btn btn-gold">Book a Consultation</Link>
              <a href={CONTACT.phoneHref} className="btn btn-outline">Call {CONTACT.phone}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
