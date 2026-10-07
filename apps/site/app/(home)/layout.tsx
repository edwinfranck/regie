import { Instrument_Serif } from 'next/font/google';
import { SiteFooter, SiteHeader } from '@/components/landing/chrome';
import { SmoothScroll } from '@/components/landing/smooth-scroll';

// Serif d'affiche, chargée pour la landing seulement.
const instrument = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

// Arme l'ouverture (écran noir, amorce) avant le premier rendu, seulement si
// le JavaScript tourne et que le mouvement est autorisé : sans script, ou en
// mouvement réduit, la page s'affiche directement.
const ARM_INTRO = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('intro-armed')}}catch(e){}`;

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <div className={`cine ${instrument.variable} flex min-h-screen flex-col`}>
      <script dangerouslySetInnerHTML={{ __html: ARM_INTRO }} />
      <a
        href="#contenu"
        className="sr-only z-[70] bg-foreground px-4 py-3 text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <div className="cine-vignette" aria-hidden />
      <div className="cine-grain" aria-hidden />
      <SmoothScroll />
    </div>
  );
}
