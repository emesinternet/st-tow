import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { formatEventTime } from '@/lib/format';
import type { EventFeedItemViewModel } from '@/types/ui';

interface EventFeedProps {
  events: EventFeedItemViewModel[];
}

export function EventFeed({ events }: EventFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Event Feed</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="font-body text-sm text-neo-muted">No events yet.</p>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {events.map(event => (
              <li
                key={event.eventId}
                className="rounded-[10px] border-2 border-neo-ink bg-white px-3 py-2 shadow-neo-sm"
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-neo-muted">
                  <span>{formatEventTime(event.atMicros)}</span>
                  <span>{event.type}</span>
                </div>
                {event.payloadSummary ? (
                  <p className="mt-1 font-mono text-xs text-neo-ink">{event.payloadSummary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
