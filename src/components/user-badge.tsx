import { cn } from "@/lib/utils";

type Props = {
  name: string;
  role?: string;
  className?: string;
};

export function UserBadge({ name, role, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {name}
      {role && (
        <span className="text-muted-foreground opacity-70">· {role}</span>
      )}
    </span>
  );
}
