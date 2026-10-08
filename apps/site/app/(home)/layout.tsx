import { GeistSans } from 'geist/font/sans';
import { SiteFooter, SiteHeader } from '@/components/landing/chrome';
import { SmoothScroll } from '@/components/landing/smooth-scroll';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <div className={`home ${GeistSans.variable} flex min-h-screen flex-col`}>
      <SmoothScroll />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
