import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Financial Helper',
  description: 'Gestión de movimientos financieros personales',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
