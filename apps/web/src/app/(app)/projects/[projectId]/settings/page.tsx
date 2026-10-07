'use client';

import { PageHeader } from '@/components/common/page-header';
import { DangerZone } from '@/components/settings/project/danger-zone';
import { FormatSection } from '@/components/settings/project/format-section';
import { LightsSection } from '@/components/settings/project/lights-section';
import { MembersSection } from '@/components/settings/project/members-section';
import { RulesSection } from '@/components/settings/project/rules-section';
import { canArt, canEditProject, isProjectAdmin, ROLE_LABELS } from '@/components/settings/project/shared';
import { StylesSection } from '@/components/settings/project/styles-section';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/hooks/use-project';

export default function ProjectSettingsPage() {
  const { data: p } = useProject();
  if (!p)
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  const admin = isProjectAdmin(p.role);
  return (
    <div>
      <PageHeader title="Réglages du projet" description={`Format, règles du découpage, rendu, lumières et équipe. Votre rôle : ${ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}.`} />
      <Tabs defaultValue="format" className="p-8">
        <TabsList>
          <TabsTrigger value="format">Format</TabsTrigger>
          <TabsTrigger value="rules">Règles et mouvement</TabsTrigger>
          <TabsTrigger value="styles">Styles de rendu</TabsTrigger>
          <TabsTrigger value="lights">Lumières</TabsTrigger>
          <TabsTrigger value="members">Membres</TabsTrigger>
          {admin && <TabsTrigger value="danger">Zone sensible</TabsTrigger>}
        </TabsList>
        <TabsContent value="format" className="max-w-5xl pt-4">
          <FormatSection project={p} editable={canEditProject(p.role)} />
        </TabsContent>
        <TabsContent value="rules" className="max-w-5xl pt-4">
          <RulesSection project={p} editable={admin} />
        </TabsContent>
        <TabsContent value="styles" className="pt-4">
          <StylesSection editable={canArt(p.role)} aspectRatio={p.aspectRatio} />
        </TabsContent>
        <TabsContent value="lights" className="pt-4">
          <LightsSection editable={canArt(p.role)} />
        </TabsContent>
        <TabsContent value="members" className="max-w-4xl pt-4">
          <MembersSection />
        </TabsContent>
        {admin && (
          <TabsContent value="danger" className="max-w-4xl pt-4">
            <DangerZone project={p} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
