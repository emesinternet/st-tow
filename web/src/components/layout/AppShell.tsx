import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  banner: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
}

export function AppShell({ header, banner, primary, secondary }: AppShellProps) {
  return (
    <div className="min-h-screen pb-8">
      <div className="mx-auto w-full max-w-[1200px] px-3 py-4 sm:px-4 sm:py-6">
        {banner}
        {header}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-4">{primary}</section>
          <aside className="hidden space-y-4 lg:block">{secondary}</aside>
        </div>
      </div>
    </div>
  );
}
