"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssignSupervisorDialog } from "./assign-supervisor-dialog";
import { unassignSupervisor } from "@/app/actions/site-assignments";

interface AssignedUser {
  id: string;
  name: string;
  role: string;
  title: string | null;
}

interface Candidate {
  id: string;
  name: string;
  role: string;
}

interface Props {
  siteId: string;
  assigned: AssignedUser[];
  candidates: Candidate[];
  canManage: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: "Supervisor",
  SITE_MANAGER: "Site Manager",
};

function UnassignButton({ siteId, userId, name }: { siteId: string; userId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleUnassign() {
    startTransition(async () => {
      await unassignSupervisor(siteId, userId);
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={handleUnassign}
      aria-label={`Unassign ${name}`}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

export function TeamTab({ siteId, assigned, candidates, canManage }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assigned.length === 0 ? "No supervisors assigned" : `${assigned.length} assigned`}
        </p>
        {canManage && (
          <AssignSupervisorDialog siteId={siteId} candidates={candidates} />
        )}
      </div>

      {assigned.length > 0 && (
        <div className="divide-y divide-border rounded-lg border">
          {assigned.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-sm">{user.name}</p>
                {user.title && (
                  <p className="text-xs text-muted-foreground">{user.title}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
                {canManage && (
                  <UnassignButton siteId={siteId} userId={user.id} name={user.name} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
