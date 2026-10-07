import type { Metadata } from 'next';
import { JetBrains_Mono, Lexend } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { fr } from '@/lib/i18n';
import './global.css';

const lexend = Lexend({ subsets: ['latin'], variable: '--font-lexend', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'régie — studio de production audiovisuelle assistée par IA', template: '%s — régie' },
  description:
    'Une bible, un découpage, N moteurs. De l’idée au film, sans que les personnages changent de visage d’un plan à l’autre. Open source, auto-hébergé.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${lexend.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ defaultTheme: 'light', enableSystem: false }} i18n={{ locale: 'fr', translations: fr }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
