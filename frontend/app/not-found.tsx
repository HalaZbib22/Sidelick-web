import Link from "next/link";
import { routes } from "../lib/paths";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-sm text-muted-foreground">We couldn&apos;t find that page.</p>
      <Link href={routes.home} className="font-medium text-primary">
        Go home
      </Link>
    </main>
  );
}
