'use client';

import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

// Listes réordonnables par glisser-déposer. Le déplacement ne démarre
// qu'après 5 px, pour que le clic sur une carte reste un clic.

const STRATEGIES = { vertical: verticalListSortingStrategy, horizontal: horizontalListSortingStrategy, grid: rectSortingStrategy };

export function SortableList<T extends { id: string }>({ items, onReorder, layout = 'vertical', children }: { items: T[]; onReorder: (items: T[]) => void; layout?: keyof typeof STRATEGIES; children: React.ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={STRATEGIES[layout]}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

const HandleCtx = createContext<Record<string, unknown>>({});

export function SortableItem({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'relative z-10 opacity-80', className)}>
      <HandleCtx.Provider value={{ ...attributes, ...listeners }}>{children}</HandleCtx.Provider>
    </div>
  );
}

/** La poignée : seul endroit d'où l'on peut saisir l'élément. */
export function DragHandle({ className }: { className?: string }) {
  const props = useContext(HandleCtx);
  return (
    <button type="button" aria-label="Déplacer" className={cn('cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing', className)} {...props}>
      <GripVertical className="size-4" />
    </button>
  );
}
