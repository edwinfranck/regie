import { SequenceList } from '@/components/editor/sequence-list';

export const metadata = { title: 'Montage' };

export default async function TimelinePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <SequenceList projectId={projectId} />;
}
