import { PageHeader } from '@/components/common/page-header';
import { GenerationHub } from '@/components/generation/hub';
import { ProviderNotice } from '@/components/generation/provider-notice';

export const metadata = { title: 'Vidéos' };

export default function VideosPage() {
  return (
    <div>
      <PageHeader title="Vidéos" description="Texte, première image, première et dernière image, ou références : chaque vidéo part dans la file et arrive dans les assets." />
      <ProviderNotice capability="VIDEO" />
      <GenerationHub capability="VIDEO" />
    </div>
  );
}
