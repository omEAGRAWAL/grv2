import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Skeleton className="h-9 w-48 mx-auto" />
          <Skeleton className="h-4 w-56 mx-auto" />
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </main>
  );
}
