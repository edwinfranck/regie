import { PageHeader } from '@/components/common/page-header';
import { GenerationHub } from '@/components/generation/hub';
import { ProviderNotice } from '@/components/generation/provider-notice';

export const metadata = { title: 'Audio' };

export default function AudioPage() {
  return (
    <div>
      <PageHeader title="Audio" description="Voix, effets sonores et musique. Les fichiers rejoignent les assets du projet." />
      <ProviderNotice capability="AUDIO" />
      <GenerationHub capability="AUDIO" />
    </div>
  );
}
