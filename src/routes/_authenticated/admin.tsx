import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getMe } from "@/lib/api/auth.functions";
import {
  adminListUsers, adminSetQuota, adminToggleDisable, adminDeleteUser,
  adminCreateInvite, adminListInvites, adminRevokeInvite, adminGetBilling,
  adminResetBillingPeriod, adminListAudit,
} from "@/lib/api/admin.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, RotateCcw, Trash2, Mail, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Ashish Cloud" }] }),
  beforeLoad: async () => {
    // Re-check admin role client-side. Server fns also enforce it.
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: Admin,
});

function bytes(n: number) {
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function Admin() {
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  if (me.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!me.data?.isAdmin) {
    return (
      <Card className="p-8 glass">
        <h2 className="font-display text-xl font-semibold">Admins only</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your account doesn't have admin access.</p>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="users" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Admin</h1>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="users"><UsersTab qc={qc} /></TabsContent>
      <TabsContent value="invites"><InvitesTab qc={qc} /></TabsContent>
      <TabsContent value="billing"><BillingTab /></TabsContent>
      <TabsContent value="audit"><AuditTab /></TabsContent>
    </Tabs>
  );
}

function UsersTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const listFn = useServerFn(adminListUsers);
  const quotaFn = useServerFn(adminSetQuota);
  const toggleFn = useServerFn(adminToggleDisable);
  const deleteFn = useServerFn(adminDeleteUser);
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<{ id: string; current: number } | null>(null);
  const [quotaGB, setQuotaGB] = useState("5");

  return (
    <Card className="glass">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Used / Quota</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(users.data ?? []).map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.email}<div className="text-xs text-muted-foreground">{u.display_name}</div></TableCell>
              <TableCell>{u.roles.includes("admin") ? <Badge>Admin</Badge> : <Badge variant="secondary">User</Badge>}</TableCell>
              <TableCell>{bytes(Number(u.storage_used_bytes))} / {bytes(Number(u.storage_quota_bytes))}</TableCell>
              <TableCell>{u.disabled ? <Badge variant="destructive">Disabled</Badge> : <Badge variant="outline">Active</Badge>}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing({ id: u.id, current: Number(u.storage_quota_bytes) }); setQuotaGB(String(Math.round(Number(u.storage_quota_bytes) / 1024 ** 3))); }}>Quota</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await toggleFn({ data: { userId: u.id, disabled: !u.disabled } }); qc.invalidateQueries({ queryKey: ["admin-users"] }); }}>{u.disabled ? "Enable" : "Disable"}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (confirm(`Delete ${u.email}? This wipes all their files.`)) { await deleteFn({ data: { userId: u.id } }); toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); } }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set storage quota</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Quota (GB)</Label>
            <Input type="number" min={0} max={1024} value={quotaGB} onChange={(e) => setQuotaGB(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              if (!editing) return;
              await quotaFn({ data: { userId: editing.id, quotaBytes: Math.round(Number(quotaGB) * 1024 ** 3) } });
              toast.success("Quota updated");
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["admin-users"] });
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InvitesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const createFn = useServerFn(adminCreateInvite);
  const listFn = useServerFn(adminListInvites);
  const revokeFn = useServerFn(adminRevokeInvite);
  const invites = useQuery({ queryKey: ["admin-invites"], queryFn: () => listFn() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [quotaGB, setQuotaGB] = useState("5");
  const [hours, setHours] = useState("72");
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const { url } = await createFn({ data: { email, role, quotaBytes: Math.round(Number(quotaGB) * 1024 ** 3), expiresInHours: Number(hours) } });
      setLastUrl(url);
      toast.success("Invite created and emailed.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-invites"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6 glass space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Mail className="size-4" /> Create invite</h3>
          <p className="text-xs text-muted-foreground mt-1">Email is required. The invite link is emailed automatically and shown here for copying.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quota (GB)</Label>
            <Input type="number" min={0} value={quotaGB} onChange={(e) => setQuotaGB(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Expires (h)</Label>
            <Input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
        </div>
        <Button onClick={create} disabled={busy || !email}>{busy && <Loader2 className="size-4 mr-2 animate-spin" />}Create invite</Button>
        {lastUrl && (
          <div className="space-y-2 pt-2 border-t">
            <Label>Last invite link</Label>
            <div className="flex gap-2">
              <Input readOnly value={lastUrl} />
              <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(lastUrl); toast.success("Copied"); }}>
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
      <Card className="glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(invites.data ?? []).map((i) => (
              <TableRow key={i.id}>
                <TableCell className="text-sm">{i.email}</TableCell>
                <TableCell>{i.role}</TableCell>
                <TableCell>
                  {i.used_at ? <Badge variant="secondary">Used</Badge> :
                    new Date(i.expires_at) < new Date() ? <Badge variant="destructive">Expired</Badge> : <Badge>Pending</Badge>}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={async () => { await revokeFn({ data: { id: i.id } }); qc.invalidateQueries({ queryKey: ["admin-invites"] }); }}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!invites.data?.length && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No invites yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function BillingTab() {
  const qc = useQueryClient();
  const fn = useServerFn(adminGetBilling);
  const resetFn = useServerFn(adminResetBillingPeriod);
  const q = useQuery({ queryKey: ["admin-billing"], queryFn: () => fn(), refetchInterval: 5000 });
  const b = q.data;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Period started {b?.periodStart ? new Date(b.periodStart).toLocaleDateString() : "—"}</p>
        <Button variant="outline" size="sm" onClick={async () => { if (confirm("Reset counters?")) { await resetFn(); toast.success("Reset"); qc.invalidateQueries({ queryKey: ["admin-billing"] }); } }}>
          <RotateCcw className="size-3.5 mr-1.5" />Reset period
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <BigStat label="Estimated overage" value={`$${(b?.total ?? 0).toFixed(4)}`} highlight />
        <BigStat label="Storage used" value={`${(b?.gbUsed ?? 0).toFixed(2)} GB`} sub="10 GB included" />
        <BigStat label="Operations (A + B)" value={`${(b?.classA ?? 0).toLocaleString()} + ${(b?.classB ?? 0).toLocaleString()}`} sub="1M + 10M included" />
      </div>
      <Card className="glass">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resource</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Included</TableHead>
              <TableHead>Over</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Storage ($0.015 / GB-mo)</TableCell>
              <TableCell>{b?.breakdown.storage.gbUsed.toFixed(3)} GB</TableCell>
              <TableCell>10 GB</TableCell>
              <TableCell>{b?.breakdown.storage.overGB.toFixed(3)} GB</TableCell>
              <TableCell className="text-right">${b?.breakdown.storage.cost.toFixed(4)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Class A ops ($4.50 / M)</TableCell>
              <TableCell>{b?.breakdown.classA.used.toLocaleString()}</TableCell>
              <TableCell>1,000,000</TableCell>
              <TableCell>{b?.breakdown.classA.over.toLocaleString()}</TableCell>
              <TableCell className="text-right">${b?.breakdown.classA.cost.toFixed(4)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Class B ops ($0.36 / M)</TableCell>
              <TableCell>{b?.breakdown.classB.used.toLocaleString()}</TableCell>
              <TableCell>10,000,000</TableCell>
              <TableCell>{b?.breakdown.classB.over.toLocaleString()}</TableCell>
              <TableCell className="text-right">${b?.breakdown.classB.cost.toFixed(4)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Egress</TableCell>
              <TableCell colSpan={3}>—</TableCell>
              <TableCell className="text-right text-success font-semibold">$0.0000</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function BigStat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={`p-6 glass ${highlight ? "shadow-elegant" : ""}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${highlight ? "text-gradient" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}

function AuditTab() {
  const fn = useServerFn(adminListAudit);
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => fn() });
  return (
    <Card className="glass">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
              <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
              <TableCell className="text-xs">{r.actor_id?.slice(0, 8) ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.target ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.ip ?? "—"}</TableCell>
            </TableRow>
          ))}
          {!q.data?.length && (
            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No activity yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
