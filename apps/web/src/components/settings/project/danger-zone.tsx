'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { del, patch, toastError } from '@/lib/client';

export function DangerZone({ project: p }: { project: { id: string; title: string; archivedAt: string | null } }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function toggleArchive() {
    setBusy(true);
    try {
      const row = await patch(`/api/projects/${p.id}`, { archived: !p.archivedAt });
      qc.setQueryData(['project', p.id], (old: any) => (old ? { ...old, ...row } : old));
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(p.archivedAt ? 'Projet désarchivé' : 'Projet archivé', { description: p.archivedAt ? 'Il revient dans la liste des projets.' : 'Il quitte la liste principale ; rien n’est supprimé.' });
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del(`/api/projects/${p.id}`);
      qc.removeQueries({ queryKey: ['project', p.id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`« ${p.title} » supprimé`);
      router.push('/');
    } catch (e) {
      toastError(e);
      setBusy(false);
    }
  }

  return (
    <section className="divide-y rounded-md border border-destructive/40">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p className="font-medium">{p.archivedAt ? 'Désarchiver le projet' : 'Archiver le projet'}</p>
          <p className="text-sm text-muted-foreground">{p.archivedAt ? 'Le projet est archivé : il n’apparaît plus dans la liste principale.' : 'Le projet quitte la liste principale. Tout est conservé et réversible.'}</p>
        </div>
        <Button variant="outline" onClick={toggleArchive} disabled={busy}>
          {p.archivedAt ? 'Désarchiver' : 'Archiver'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p className="font-medium">Supprimer le projet</p>
          <p className="text-sm text-muted-foreground">Bible, scénario, scènes, plans, assets et générations : tout disparaît, sans retour possible.</p>
        </div>
        <AlertDialog onOpenChange={(o) => !o && setConfirm('')}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Supprimer</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement « {p.title} » ?</AlertDialogTitle>
              <AlertDialogDescription>Cette action est irréversible. Tapez le titre du projet pour confirmer.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Titre du projet" autoFocus />
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <Button variant="destructive" disabled={confirm.trim() !== p.title.trim() || busy} onClick={remove}>
                Supprimer le projet
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
