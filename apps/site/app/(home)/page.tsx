import { Coherence } from '@/components/landing/coherence';
import { Hero } from '@/components/landing/hero';
import { Journey } from '@/components/landing/journey';
import { Montage } from '@/components/landing/montage';
import { Problem } from '@/components/landing/problem';
import { Bible, OpenSource, Providers } from '@/components/landing/sections';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <Journey />
      <Bible />
      <Coherence />
      <Montage />
      <Providers />
      <OpenSource />
    </>
  );
}
