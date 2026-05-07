import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Central de Cargas',
  description: 'Base Next.js + Supabase Auth',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
