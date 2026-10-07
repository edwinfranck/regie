import { PageHeader } from '@/components/common/page-header';
import { GenerationHub } from '@/components/generation/hub';
import { ProviderNotice } from '@/components/generation/provider-notice';

export const metadata = { title: 'Images' };

export default function ImagesPage() {
  return (
    <div>
      <PageHeader title="Images" description="Génération d’images libre ou à partir de références. Les résultats rejoignent les assets et peuvent devenir la référence d’un personnage ou d’un lieu." />
      <ProviderNotice capability="IMAGE" />
      <GenerationHub capability="IMAGE" />
    </div>
  );
}
