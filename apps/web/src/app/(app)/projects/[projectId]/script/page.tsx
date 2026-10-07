'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectData, useProjectId } from '@/hooks/use-project';
import { initialDoc } from './editor/schema';
import { ScriptEditor, type ScriptRow } from './editor/script-editor';

function ScriptPageInner() {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const q = useSearchParams().get('q') ?? undefined;
  const { data: script, isLoading, refetch } = useProjectData<ScriptRow>('script');
  // L'éditeur n'est construit qu'une fois : les rafraîchissements du cache ne
  // doivent pas écraser la saisie. Une restauration le reconstruit.
  const [generation, setGeneration] = useState(0);
  const initial = useMemo(() => (script ? initialDoc(script) : null), [script?.id, generation]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !script || !initial)
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mx-auto h-[70vh] w-[8.5in] max-w-full" />
      </div>
    );

  return (
    <ScriptEditor
      key={generation}
      script={script}
      initial={initial}
      initialQuery={q}
      onRestored={async () => {
        await qc.invalidateQueries({ queryKey: ['project', projectId, 'script'] });
        await refetch();
        setGeneration((g) => g + 1);
      }}
    />
  );
}

export default function ScriptPage() {
  return (
    <Suspense>
      <ScriptPageInner />
    </Suspense>
  );
}
