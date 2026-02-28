import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  banner: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
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
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-3 py-4 sm:px-4 sm:py-6">
        {banner}
        {header}

        <section className="mt-4 space-y-4">{primary}</section>
        <aside className="mt-auto space-y-4 pt-6">{secondary}</aside>
      </div>
    </div>
  );
}
