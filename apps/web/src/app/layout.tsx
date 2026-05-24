import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'GrowthOS',
  description: 'Plateforme SaaS B2B multi-tenant — Prospection, CRM & Automatisation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Script inline pour appliquer le thème AVANT le rendu (évite le flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var id = localStorage.getItem('growthos-theme-id') || 'default';
                  var themes = ${JSON.stringify(
                    // On injecte les tokens des thèmes built-in pour un accès synchrone
                    Object.fromEntries(
                      ['default','dark','ocean','forest','sunset','minimal'].map(id => [id, id])
                    )
                  )};
                  document.documentElement.setAttribute('data-theme-id', id);
                } catch(e) {}
              })();
            `,
          }}
        />
        <script
  dangerouslySetInnerHTML={{
    __html: `window.__API_URL__ = "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1";`
  }}
/>
      </head>
      <body style={{ fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}>
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
