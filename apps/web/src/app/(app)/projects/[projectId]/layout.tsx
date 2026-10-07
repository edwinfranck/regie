import { prisma } from '@regie/db';
import { requireProject } from '@regie/studio';
import { notFound } from 'next/navigation';
import { SetCrumbs } from '@/components/app/crumbs';
import { AssistantPanel } from '@/components/project/assistant-panel';
import { RememberProject } from '@/components/project/remember-project';
import { ProjectSidebar } from '@/components/project/sidebar';
import { currentUser } from '@/lib/auth';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await currentUser();
  if (!user) notFound();
  try {
    await requireProject(projectId, user.id);
  } catch {
    notFound();
  }
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { title: true } });
  return (
    <div className="flex">
      <SetCrumbs crumbs={[{ label: project.title, href: `/projects/${projectId}` }]} />
      <RememberProject id={projectId} title={project.title} />
      <ProjectSidebar projectId={projectId} />
      <main className="min-w-0 flex-1">{children}</main>
      <AssistantPanel projectId={projectId} />
    </div>
  );
}
