'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/movements', label: 'Movimientos' },
  { href: '/categories', label: 'Categorías' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!localStorage.getItem('access_token')) router.replace('/login');
  }, [router]);

  async function handleLogout() {
    try { await auth.logout(); } catch { /* ignore */ }
    localStorage.removeItem('access_token');
    router.push('/login');
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav style={{
        background: '#1e293b', color: '#fff', padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 24, height: 52,
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, marginRight: 8 }}>💰 Financial Helper</span>
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href} style={{
            color: pathname.startsWith(href) ? '#60a5fa' : '#cbd5e1',
            fontWeight: pathname.startsWith(href) ? 600 : 400,
            fontSize: 14,
          }}>
            {label}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          style={{ marginLeft: 'auto', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontSize: 13 }}
        >
          Salir
        </button>
      </nav>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        {children}
      </main>
    </div>
  );
}
