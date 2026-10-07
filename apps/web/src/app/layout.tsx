import type { Metadata } from 'next';
import { JetBrains_Mono, Lexend } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const lexend = Lexend({ subsets: ['latin'], variable: '--font-lexend', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'régie', template: '%s · régie' },
  description: 'Studio de production audiovisuelle assistée par IA. Une bible, un découpage, N moteurs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${lexend.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
