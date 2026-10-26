import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Sign in - FoodTech Study" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/library");

  const { error } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-foreground/60">
          Welcome back. Pick up where you left off.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}

      <form
        method="post"
        action="/api/auth/login"
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-black/15 bg-white/60 px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/15 dark:bg-white/5"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-black/15 bg-white/60 px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/15 dark:bg-white/5"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Sign in
        </button>
      </form>

      <p className="text-sm text-foreground/60">
        New here?{" "}
        <Link
          href="/register"
          className="font-medium text-accent hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
