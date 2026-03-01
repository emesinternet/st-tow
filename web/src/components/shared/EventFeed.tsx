import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { formatEventTime } from '@/lib/format';
import type { EventFeedItemViewModel } from '@/types/ui';

interface EventFeedProps {
  events: EventFeedItemViewModel[];
  headerAction?: ReactNode;
}

export function EventFeed({ events, headerAction }: EventFeedProps) {
  return (
    <Card>
      <CardHeader className="mb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Event Feed</CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="font-body text-xs text-neo-muted">No events yet.</p>
        ) : (
          <ul className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
            {events.map((event) => (
              <li
                key={event.eventId}
                className="rounded-[10px] border-4 border-neo-ink bg-white px-2.5 py-1.5 shadow-neo-sm"
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-neo-muted">
                  <span>{formatEventTime(event.atMicros)}</span>
                  <span>{event.type}</span>
                </div>
                {event.payloadSummary ? (
                  <p className="mt-0.5 font-mono text-[11px] text-neo-ink">
                    {event.payloadSummary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
