import Link from "next/link";
import { routes } from "../../lib/paths";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-bold">403</h1>
      <p className="text-sm text-muted-foreground">
        You don&apos;t have permission to view this page.
      </p>
      <Link href={routes.dashboard} className="font-medium text-primary">
        Back to dashboard
      </Link>
    </main>
  );
}
