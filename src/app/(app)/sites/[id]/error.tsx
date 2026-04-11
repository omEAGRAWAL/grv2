"use client";

export default function SiteDetailError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 p-6">
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={reset}
        className="text-sm underline underline-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
