'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { get, patch } from '@/lib/client';
import { cn, fmtRelative } from '@/lib/utils';

export function Notifications() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => get('/api/notifications'), refetchInterval: 60_000 });
  const unread = data?.unread ?? 0;
  return (
    <Popover
      onOpenChange={async (o) => {
        if (!o && unread) {
          await patch('/api/notifications', {});
          qc.invalidateQueries({ queryKey: ['notifications'] });
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell />
          {unread > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-signal" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {!data?.items?.length && <p className="p-3 text-sm text-muted-foreground">Rien de nouveau.</p>}
          {data?.items?.map((n: any) => (
            <Link key={n.id} href={n.href ?? '#'} className={cn('block border-b px-3 py-2 text-sm last:border-0 hover:bg-accent', !n.readAt && 'bg-secondary/60')}>
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="line-clamp-2 text-muted-foreground">{n.body}</div>}
              <div className="text-xs text-muted-foreground">{fmtRelative(n.createdAt)}</div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
