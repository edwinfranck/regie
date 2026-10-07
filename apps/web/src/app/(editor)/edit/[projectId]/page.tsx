import { prisma } from '@regie/db';
import { requireProject } from '@regie/studio';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Editor } from '@/components/editor/editor';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Montage' };

export default async function EditPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await currentUser();
  if (!user) redirect('/login');
  try {
    await requireProject(projectId, user.id);
  } catch {
    notFound();
  }
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { title: true } });
  return (
    <Suspense>
      <Editor projectId={projectId} projectTitle={project.title} />
    </Suspense>
  );
}
