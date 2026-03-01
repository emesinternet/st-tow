import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  banner: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  backgroundClassName?: string;
}

export function AppShell({
  header,
  banner,
  primary,
  secondary,
  backgroundClassName = '',
}: AppShellProps) {
  return (
    <div className={`min-h-screen ${backgroundClassName}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col gap-[var(--space-6)] px-3 py-[var(--space-4)] sm:px-[var(--space-4)] sm:py-[var(--space-6)]">
        {banner}
        {header}

        <section className="ui-stack-6">{primary}</section>
        {secondary ? (
          <aside className="mt-auto ui-stack-6 pt-[calc(var(--space-6)+var(--space-2))]">
            {secondary}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
