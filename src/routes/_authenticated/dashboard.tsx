import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  listFolders, createFolder, deleteFolder, moveFiles, presignView,
} from "@/lib/api/storage.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Download, Trash2, Share2, Upload, FileIcon, Loader2, Copy, FolderPlus,
  Folder, FolderOpen, Image as ImageIcon, Video as VideoIcon,
  X, ChevronLeft, ChevronRight, Move, Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ashish Cloud" }] }),
  component: Dashboard,
});

type FileRow = {
  id: string;
  name: string;
  size_bytes: number;
  mime: string | null;
  quality: string;
  folder: string;
  created_at: string;
};

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

const isImage = (m?: string | null) => !!m && m.startsWith("image/");
const isVideo = (m?: string | null) => !!m && m.startsWith("video/");
const isMedia = (m?: string | null) => isImage(m) || isVideo(m);

function Dashboard() {
  const qc = useQueryClient();
  const me = useServerFn(getMe);
  const listFn = useServerFn(listFiles);
  const downloadFn = useServerFn(presignDownload);
  const deleteFn = useServerFn(softDeleteFile);
  const shareFn = useServerFn(createShareLink);
  const foldersFn = useServerFn(listFolders);
  const createFolderFn = useServerFn(createFolder);
  const deleteFolderFn = useServerFn(deleteFolder);
  const moveFn = useServerFn(moveFiles);
  const viewFn = useServerFn(presignView);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const filesQ = useQuery({ queryKey: ["files"], queryFn: () => listFn() });
  const foldersQ = useQuery({ queryKey: ["folders"], queryFn: () => foldersFn() });

  const [activeFolder, setActiveFolder] = useState<string>("/");
  const [quality, setQuality] = useState<"original" | "high" | "medium">("original");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareFor, setShareFor] = useState<{ id: string; name: string } | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const profile = meQ.data?.profile;
  const usedPct = profile
    ? Math.min(100, (Number(profile.storage_used_bytes) / Number(profile.storage_quota_bytes)) * 100)
    : 0;

  const allFiles = (filesQ.data ?? []) as FileRow[];
  const folders = foldersQ.data ?? [];

  const folderList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of allFiles) counts.set(f.folder, (counts.get(f.folder) ?? 0) + 1);
    return [
      { name: "/", label: "All files", count: allFiles.length },
      ...folders.map((f) => ({ name: f.name, label: f.name, count: counts.get(f.name) ?? 0 })),
    ];
  }, [allFiles, folders]);

  const visible = useMemo(
    () => (activeFolder === "/" ? allFiles : allFiles.filter((f) => f.folder === activeFolder)),
    [allFiles, activeFolder],
  );

  const mediaItems = useMemo(() => visible.filter((f) => isMedia(f.mime)), [visible]);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    let okCount = 0;
    for (const file of files) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Please log in again.");
        const form = new FormData();
        form.append("file", file);
        form.append("quality", quality);
        form.append("folder", activeFolder);
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) throw new Error((await res.text()) || `Upload failed: ${res.status}`);
        okCount++;
      } catch (e: unknown) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "failed"}`);
      } finally {
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }
    setUploading(false);
    setProgress(null);
    if (okCount) toast.success(`Uploaded ${okCount} file${okCount > 1 ? "s" : ""}.`);
    qc.invalidateQueries({ queryKey: ["files"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  }, [quality, qc, activeFolder]);

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
    if (!confirm(`Delete ${selected.size} file(s)? This cannot be undone.`)) return;
    for (const id of selected) await deleteFn({ data: { fileId: id } });
    toast.success("Deleted.");
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["files"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolderFn({ data: { name } });
      toast.success(`Folder "${name}" created.`);
      setNewFolderOpen(false);
      setNewFolderName("");
      qc.invalidateQueries({ queryKey: ["folders"] });
      setActiveFolder(name);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    }
  };

  const handleDeleteFolder = async (name: string) => {
    if (name === "/") return;
    if (!confirm(`Delete folder "${name}"? Files will be moved to "All files".`)) return;
    await deleteFolderFn({ data: { name } });
    toast.success("Folder deleted.");
    if (activeFolder === name) setActiveFolder("/");
    qc.invalidateQueries({ queryKey: ["folders"] });
    qc.invalidateQueries({ queryKey: ["files"] });
  };

  const handleMoveTo = async (target: string) => {
    if (!selected.size) return;
    await moveFn({ data: { fileIds: Array.from(selected), folder: target } });
    toast.success(`Moved ${selected.size} file(s).`);
    setSelected(new Set());
    setMoveOpen(false);
    qc.invalidateQueries({ queryKey: ["files"] });
  };

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div
        className="rounded-2xl border border-border/60 p-6 sm:p-8 relative overflow-hidden"
        style={{ background: "var(--gradient-hero), var(--background)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4 relative">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {meQ.data?.isAdmin ? "Admin workspace" : "Your cloud"}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">
              Hello{profile?.display_name ? `, ${profile.display_name}` : ""} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {allFiles.length} file{allFiles.length !== 1 ? "s" : ""} • {folders.length} folder{folders.length !== 1 ? "s" : ""}
            </p>
          </div>
          {profile && (
            <Card className="p-4 min-w-[260px] glass">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Storage</span>
                <span className="font-medium text-foreground">
                  {bytes(Number(profile.storage_used_bytes))}
                  <span className="text-muted-foreground"> / {bytes(Number(profile.storage_quota_bytes))}</span>
                </span>
              </div>
              <Progress value={usedPct} className="mt-2 h-2" />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {usedPct < 80 ? `${(100 - usedPct).toFixed(0)}% free` : "Running low — clear some files"}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile folder chips */}
      <div className="lg:hidden -mx-1 px-1 overflow-x-auto">
        <div className="flex gap-2 min-w-min pb-1">
          {folderList.map((f) => {
            const active = activeFolder === f.name;
            return (
              <button
                key={f.name}
                onClick={() => setActiveFolder(f.name)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-border",
                )}
              >
                {active ? <FolderOpen className="size-3.5" /> : <Folder className="size-3.5" />}
                {f.label}
                <span className={cn("text-[10px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{f.count}</span>
              </button>
            );
          })}
          <button
            onClick={() => setNewFolderOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-dashed border-border hover:bg-accent"
          >
            <FolderPlus className="size-3.5" /> New
          </button>
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Folder sidebar (desktop only) */}
        <Card className="p-3 glass h-fit hidden lg:block sticky top-4">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Folders</p>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setNewFolderOpen(true)} title="New folder">
              <FolderPlus className="size-4" />
            </Button>
          </div>
          <div className="mt-1 space-y-0.5">
            {folderList.map((f) => {
              const active = activeFolder === f.name;
              return (
                <div key={f.name} className="group flex items-center gap-1">
                  <button
                    onClick={() => setActiveFolder(f.name)}
                    className={cn(
                      "flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left",
                      active ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent",
                    )}
                  >
                    {active ? <FolderOpen className="size-4 shrink-0" /> : <Folder className="size-4 shrink-0" />}
                    <span className="truncate flex-1">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.count}</span>
                  </button>
                  {f.name !== "/" && (
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteFolder(f.name)}
                      title="Delete folder"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6 min-w-0">
          {/* Uploader */}
          <Card
            className="p-6 glass border-dashed border-2 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <Upload className="size-7 mx-auto text-muted-foreground" />
            <p className="mt-2 font-medium">
              Drop into <span className="text-primary">{activeFolder === "/" ? "All files" : activeFolder}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Up to 1 GB per file. Bulk supported.</p>
            <div className="mt-3 flex items-center justify-center gap-3">
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
            {uploading && progress && (
              <div className="mt-3">
                <p className="text-sm text-primary inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Uploading {progress.done}/{progress.total}…
                </p>
                <Progress value={(progress.done / progress.total) * 100} className="mt-2" />
              </div>
            )}
          </Card>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {visible.length} file{visible.length !== 1 ? "s" : ""}
              {mediaItems.length > 0 && <span> • {mediaItems.length} in gallery</span>}
              {selected.size > 0 && <span> • {selected.size} selected</span>}
            </p>
            <div className="ml-auto flex gap-2 flex-wrap">
              {mediaItems.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setLightboxIdx(0)}>
                  <Play className="size-4 mr-1.5" />Open gallery
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => setMoveOpen(true)}>
                <Move className="size-4 mr-1.5" />Move
              </Button>
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={downloadSelected}>
                <Download className="size-4 mr-1.5" />Download
              </Button>
              <Button size="sm" variant="destructive" disabled={!selected.size} onClick={deleteSelected}>
                <Trash2 className="size-4 mr-1.5" />Delete
              </Button>
            </div>
          </div>

          {/* Files grid */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((f) => {
              const media = isMedia(f.mime);
              const mediaIdx = media ? mediaItems.findIndex((m) => m.id === f.id) : -1;
              return (
                <Card
                  key={f.id}
                  className={cn(
                    "overflow-hidden glass group relative transition-all",
                    selected.has(f.id) && "ring-2 ring-primary",
                  )}
                >
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={selected.has(f.id)}
                      onCheckedChange={() => toggle(f.id)}
                      className="bg-background/80 backdrop-blur"
                    />
                  </div>
                  <div
                    className="aspect-square bg-muted/40 flex items-center justify-center cursor-pointer relative"
                    onClick={() => (media ? setLightboxIdx(mediaIdx) : downloadOne(f.id))}
                  >
                    {isImage(f.mime) ? (
                      <MediaThumb fileId={f.id} viewFn={viewFn} kind="image" />
                    ) : isVideo(f.mime) ? (
                      <>
                        <MediaThumb fileId={f.id} viewFn={viewFn} kind="video" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="size-10 text-white drop-shadow-lg" />
                        </div>
                      </>
                    ) : (
                      <FileIcon className="size-12 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium truncate" title={f.name}>{f.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{bytes(Number(f.size_bytes))}</p>
                    <div className="mt-2 flex gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadOne(f.id)} title="Download">
                        <Download className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShareFor({ id: f.id, name: f.name })} title="Share">
                        <Share2 className="size-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 ml-auto"
                        onClick={async () => {
                          if (confirm(`Delete ${f.name}?`)) {
                            await deleteFn({ data: { fileId: f.id } });
                            qc.invalidateQueries({ queryKey: ["files"] });
                            qc.invalidateQueries({ queryKey: ["me"] });
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
            {!visible.length && !filesQ.isLoading && (
              <Card className="p-12 col-span-full text-center text-sm text-muted-foreground glass">
                {activeFolder === "/" ? "No files yet. Drop some above to get started." : `Folder "${activeFolder}" is empty. Drop files to upload here.`}
              </Card>
            )}
          </div>
        </div>
      </div>

      <ShareDialog target={shareFor} onClose={() => setShareFor(null)} shareFn={shareFn} />

      {/* New folder */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
            <DialogDescription>E.g. Birthday, School Trip, Goa 2026</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selected.size} file(s) to…</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 max-h-[300px] overflow-y-auto">
            <button
              onClick={() => handleMoveTo("/")}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <Folder className="size-4" /> All files (root)
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => handleMoveTo(f.name)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <Folder className="size-4" /> {f.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxIdx !== null && mediaItems.length > 0 && (
        <Lightbox
          items={mediaItems}
          index={Math.min(lightboxIdx, mediaItems.length - 1)}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
          viewFn={viewFn}
          downloadOne={downloadOne}
        />
      )}
    </div>
  );
}

/** Thumbnail that fetches a signed view URL on demand. */
function MediaThumb({
  fileId, viewFn, kind,
}: {
  fileId: string;
  viewFn: ReturnType<typeof useServerFn<typeof presignView>>;
  kind: "image" | "video";
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    viewFn({ data: { fileId } })
      .then((r) => { if (alive) setUrl(r.url); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [fileId, viewFn]);
  if (err) return kind === "image"
    ? <ImageIcon className="size-10 text-muted-foreground" />
    : <VideoIcon className="size-10 text-muted-foreground" />;
  if (!url) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (kind === "image") {
    return <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />;
  }
  // Video thumb: render the first frame via <video> with preload="metadata"
  return <video src={url} className="w-full h-full object-cover" preload="metadata" muted playsInline />;
}

function Lightbox({
  items, index, onIndexChange, onClose, viewFn, downloadOne,
}: {
  items: FileRow[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  viewFn: ReturnType<typeof useServerFn<typeof presignView>>;
  downloadOne: (id: string) => Promise<void>;
}) {
  const current = items[index];
  const [url, setUrl] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setUrl(null);
    let alive = true;
    viewFn({ data: { fileId: current.id } })
      .then((r) => { if (alive) setUrl(r.url); })
      .catch(() => {});
    return () => { alive = false; };
  }, [current.id, viewFn]);

  const next = useCallback(() => onIndexChange((index + 1) % items.length), [index, items.length, onIndexChange]);
  const prev = useCallback(() => onIndexChange((index - 1 + items.length) % items.length), [index, items.length, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
        touchStartX.current = null;
      }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 text-white/90">
        <p className="text-sm font-medium truncate flex-1">{current.name}</p>
        <p className="text-xs text-white/60 hidden sm:block">{index + 1} / {items.length}</p>
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={() => downloadOne(current.id)}>
          <Download className="size-5" />
        </Button>
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center relative px-2 sm:px-12 min-h-0">
        {items.length > 1 && (
          <button
            onClick={prev}
            className="absolute left-1 sm:left-4 z-10 size-10 sm:size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        <div className="max-h-full max-w-full flex items-center justify-center">
          {!url ? (
            <Loader2 className="size-8 animate-spin text-white/70" />
          ) : isImage(current.mime) ? (
            <img src={url} alt={current.name} className="max-h-[80vh] max-w-full object-contain" />
          ) : (
            <video src={url} controls autoPlay playsInline className="max-h-[80vh] max-w-full" />
          )}
        </div>
        {items.length > 1 && (
          <button
            onClick={next}
            className="absolute right-1 sm:right-4 z-10 size-10 sm:size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {/* Filmstrip */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 justify-center min-w-min">
          {items.map((m, i) => (
            <button
              key={m.id}
              onClick={() => onIndexChange(i)}
              className={cn(
                "shrink-0 size-14 rounded-md overflow-hidden bg-white/5 border-2 transition-all",
                i === index ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <MediaThumb fileId={m.id} viewFn={viewFn} kind={isVideo(m.mime) ? "video" : "image"} />
            </button>
          ))}
        </div>
      </div>
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
