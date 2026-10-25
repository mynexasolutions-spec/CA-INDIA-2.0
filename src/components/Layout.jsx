import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CookieConsent from './CookieConsent';
import Footer from './Footer';
import Header from './Header';
import MobileDrawer from './MobileDrawer';
import WhatsAppFloat from './WhatsAppFloat';

/** Live chat: uses WhatsApp until a third-party chat widget ID is configured. */

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isAuthPage = location.pathname.endsWith('/login');

  useEffect(() => {
    setMenuOpen(false);
    document.body.style.overflow = '';
    if (location.hash) {
      const id = location.hash.slice(1);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
  }, [menuOpen]);

  // The login page fills exactly the space left under the header (see .is-auth-page in index.css).
  useEffect(() => {
    document.documentElement.classList.toggle('is-auth-page', isAuthPage);
    return () => document.documentElement.classList.remove('is-auth-page');
  }, [isAuthPage]);

  return (
    <>
      <Header onOpenMenu={() => setMenuOpen(true)} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main>
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
      <WhatsAppFloat />
      <CookieConsent />
    </>
  );
}
