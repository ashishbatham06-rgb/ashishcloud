import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { getMe } from "@/lib/api/auth.functions";
import {
  listFiles, presignDownload, softDeleteFile, createShareLink,
} from "@/lib/api/storage.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Trash2, Share2, Upload, FileIcon, Loader2, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ashish Cloud" }] }),
  component: Dashboard,
});

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function Dashboard() {
  const qc = useQueryClient();
  const me = useServerFn(getMe);
  const listFn = useServerFn(listFiles);
  const downloadFn = useServerFn(presignDownload);
  const deleteFn = useServerFn(softDeleteFile);
  const shareFn = useServerFn(createShareLink);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const filesQ = useQuery({ queryKey: ["files"], queryFn: () => listFn() });

  const [quality, setQuality] = useState<"original" | "high" | "medium">("original");
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareFor, setShareFor] = useState<{ id: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const profile = meQ.data?.profile;
  const usedPct = profile ? Math.min(100, (Number(profile.storage_used_bytes) / Number(profile.storage_quota_bytes)) * 100) : 0;

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    let okCount = 0;
    for (const file of files) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Please log in again.");

        const form = new FormData();
        form.append("file", file);
        form.append("quality", quality);

        const uploaded = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!uploaded.ok) throw new Error((await uploaded.text()) || `Upload failed: ${uploaded.status}`);
        okCount++;
      } catch (e: unknown) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    setUploading(false);
    if (okCount) toast.success(`Uploaded ${okCount} file${okCount > 1 ? "s" : ""}.`);
    qc.invalidateQueries({ queryKey: ["files"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  }, [quality, qc]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const downloadOne = async (id: string) => {
    const { url } = await downloadFn({ data: { fileId: id } });
    window.open(url, "_blank");
  };
  const downloadSelected = async () => {
    for (const id of selected) await downloadOne(id);
  };
  const deleteSelected = async () => {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} file(s)?`)) return;
    for (const id of selected) await deleteFn({ data: { fileId: id } });
    toast.success("Deleted.");
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["files"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const list = filesQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Hello{profile?.display_name ? `, ${profile.display_name}` : ""}</h1>
          <p className="text-sm text-muted-foreground">{meQ.data?.isAdmin ? "Admin workspace" : "Personal workspace"}</p>
        </div>
        {profile && (
          <Card className="p-4 min-w-[260px] glass">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Storage used</span>
              <span>{bytes(Number(profile.storage_used_bytes))} / {bytes(Number(profile.storage_quota_bytes))}</span>
            </div>
            <Progress value={usedPct} className="mt-2" />
          </Card>
        )}
      </div>

      {/* Uploader */}
      <Card
        className="p-8 glass border-dashed border-2 text-center cursor-pointer"
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <Upload className="size-8 mx-auto text-muted-foreground" />
        <p className="mt-3 font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Up to 1 GB per file. Bulk upload supported.</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Label className="text-xs text-muted-foreground">Quality</Label>
          <Select value={quality} onValueChange={(v) => setQuality(v as "original" | "high" | "medium")}>
            <SelectTrigger className="w-32" onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading && <p className="mt-3 text-sm text-primary inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Uploading…</p>}
      </Card>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{list.length} file{list.length !== 1 ? "s" : ""} • {selected.size} selected</p>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={!selected.size} onClick={downloadSelected}>
            <Download className="size-4 mr-1.5" />Download
          </Button>
          <Button size="sm" variant="destructive" disabled={!selected.size} onClick={deleteSelected}>
            <Trash2 className="size-4 mr-1.5" />Delete
          </Button>
        </div>
      </div>

      {/* Files grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((f) => (
          <Card key={f.id} className="p-4 glass">
            <div className="flex items-start gap-3">
              <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={f.name}>{f.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{bytes(Number(f.size_bytes))} • {f.quality}</p>
              </div>
              <FileIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="mt-3 flex gap-1.5">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => downloadOne(f.id)}>
                <Download className="size-3.5 mr-1" />Download
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShareFor({ id: f.id, name: f.name })}>
                <Share2 className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (confirm(`Delete ${f.name}?`)) { await deleteFn({ data: { fileId: f.id } }); qc.invalidateQueries({ queryKey: ["files"] }); qc.invalidateQueries({ queryKey: ["me"] }); } }}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </Card>
        ))}
        {!list.length && !filesQ.isLoading && (
          <Card className="p-12 col-span-full text-center text-sm text-muted-foreground glass">
            No files yet. Drop some above to get started.
          </Card>
        )}
      </div>

      <ShareDialog target={shareFor} onClose={() => setShareFor(null)} shareFn={shareFn} />
    </div>
  );
}

function ShareDialog({
  target, onClose, shareFn,
}: {
  target: { id: string; name: string } | null;
  onClose: () => void;
  shareFn: ReturnType<typeof useServerFn<typeof createShareLink>>;
}) {
  const [password, setPassword] = useState("");
  const [hours, setHours] = useState<string>("24");
  const [max, setMax] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const url = useMemo(() => (token ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/s/${token}` : null), [token]);

  const create = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const res = await shareFn({
        data: {
          fileId: target.id,
          password: password || undefined,
          expiresInHours: hours ? Number(hours) : undefined,
          maxDownloads: max ? Number(max) : undefined,
        },
      });
      setToken(res.token);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setToken(null); setPassword(""); setHours("24"); setMax(""); onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share file</DialogTitle>
          <DialogDescription>{target?.name}</DialogDescription>
        </DialogHeader>
        {!url ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Password (optional)</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave empty for none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Expires in (hours)</Label>
                <Input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Max downloads</Label>
                <Input type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} placeholder="Unlimited" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Share URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} />
              <Button onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied!"); }}>
                <Copy className="size-4" />
              </Button>
            </div>
            {password && <p className="text-xs text-muted-foreground">Send the password separately. Append <code>?p=PASSWORD</code> to the URL.</p>}
          </div>
        )}
        <DialogFooter>
          {!url ? (
            <Button onClick={create} disabled={busy}>{busy && <Loader2 className="size-4 mr-2 animate-spin" />}Create link</Button>
          ) : (
            <Button onClick={close}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
