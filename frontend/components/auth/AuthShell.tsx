import Link from "next/link";
import { routes } from "../../lib/paths";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href={routes.home} className="font-display mb-8 text-center text-2xl font-semibold text-primary">
        Sidelick
      </Link>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-md">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
    </main>
  );
}
