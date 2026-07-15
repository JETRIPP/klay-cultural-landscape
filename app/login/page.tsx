interface Props {
  searchParams: Promise<{ from?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { from, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <form method="POST" action="/api/login" className="flex w-full max-w-xs flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-wide text-white/40">Cultural Landscape</p>
        <input type="hidden" name="from" value={from ?? "/"} />
        <input
          type="password"
          name="passphrase"
          autoFocus
          placeholder="Team passphrase"
          className="w-full border-b border-white/15 bg-transparent py-2 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
        />
        {error && <p className="font-mono text-[11px] text-accent">Incorrect passphrase. Try again.</p>}
        <button
          type="submit"
          className="mt-2 self-start font-mono text-xs uppercase tracking-wide text-accent/80 hover:text-accent"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
