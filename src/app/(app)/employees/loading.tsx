import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeesLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="rounded-lg border">
        <div className="p-3 border-b flex gap-4">
          {[140, 100, 80, 60, 80].map((w, i) => (
            <Skeleton key={i} className={`h-4 w-[${w}px]`} />
          ))}
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 border-b last:border-0 flex gap-4 items-center">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
