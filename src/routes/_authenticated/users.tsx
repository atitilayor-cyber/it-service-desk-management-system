import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, changeUserRole, getMe } from "@/lib/tickets.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const fn = useServerFn(listUsers);
  const meFn = useServerFn(getMe);
  const changeFn = useServerFn(changeUserRole);
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => fn() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  const mut = useMutation({
    mutationFn: (v: { targetUserId: string; role: AppRole }) => changeFn({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User management</h2>
        <p className="text-sm text-muted-foreground">Manage roles for all registered users.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All users ({users?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="divide-y">
              {(users ?? []).map((u) => (
                <div key={u.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">
                        {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.full_name || u.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email} · {u.department || "—"}</div>
                    </div>
                  </div>
                  <Select
                    value={u.role}
                    onValueChange={(v) => mut.mutate({ targetUserId: u.id, role: v as AppRole })}
                    disabled={u.id === me?.userId}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="end_user">{ROLE_LABEL.end_user}</SelectItem>
                      <SelectItem value="technician">{ROLE_LABEL.technician}</SelectItem>
                      <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
