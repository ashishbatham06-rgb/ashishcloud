import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Lock, FileIcon, Loader2 } from "lucide-react";

export const Route = createFileRoute("/s/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Shared file — Ashish Cloud" }] }),
  component: ShareView,
});

type FileInfo = { url: string; mime: string | null; name: string };

function ShareView() {
  const { token } = Route.useParams();
  const [password, setPassword] = useState("");
  const [needsPwd, setNeedsPwd] = useState(false);
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchFile = async (mode: "view" | "download" = "view", pwd = password) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/public/s/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pwd, mode }),
      });
      if (res.status === 401) {
        setNeedsPwd(true);
        if (loaded) setErr("Password required.");
        return;
      }
      if (res.status === 403) {
        setNeedsPwd(true);
        setErr("Wrong password.");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Failed" }));
        setErr(j.error || `Error ${res.status}`);
        return;
      }
      const data = (await res.json()) as FileInfo;
      if (mode === "download") {
        window.location.href = data.url;
      } else {
        setInfo(data);
        setNeedsPwd(false);
      }
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  // Auto-attempt without password on first load
  if (!loaded && !busy) {
    void fetchFile("view", "");
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6 glass">
        {!info && needsPwd && (
          <form
            onSubmit={(e) => { e.preventDefault(); void fetchFile("view", password); }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Lock className="size-5 text-primary" />
              <h1 className="text-lg font-semibold">Password protected</h1>
            </div>
            <p className="text-sm text-muted-foreground">Enter the password shared with you.</p>
            <div className="space-y-1.5">
              <Label htmlFor="pwd">Password</Label>
              <Input
                id="pwd"
                type="password"
                autoComplete="off"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={busy || !password} className="w-full">
              {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Unlock
            </Button>
          </form>
        )}

        {!info && !needsPwd && (
          <div className="text-center py-10">
            {busy ? (
              <Loader2 className="size-6 animate-spin mx-auto text-primary" />
            ) : (
              <p className="text-sm text-destructive">{err ?? "Loading..."}</p>
            )}
          </div>
        )}

        {info && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileIcon className="size-5 text-primary shrink-0" />
              <h1 className="text-base font-medium truncate flex-1">{info.name}</h1>
            </div>
            <div className="rounded-lg overflow-hidden bg-black/30 flex items-center justify-center min-h-[240px]">
              {info.mime?.startsWith("image/") && (
                <img src={info.url} alt={info.name} className="max-h-[70vh] w-auto" />
              )}
              {info.mime?.startsWith("video/") && (
                <video src={info.url} controls className="max-h-[70vh] w-full" />
              )}
              {info.mime?.startsWith("audio/") && (
                <audio src={info.url} controls className="w-full p-4" />
              )}
              {info.mime === "application/pdf" && (
                <iframe src={info.url} title={info.name} className="w-full h-[70vh]" />
              )}
              {!info.mime?.match(/^(image|video|audio)\//) && info.mime !== "application/pdf" && (
                <div className="p-10 text-center text-muted-foreground">
                  <FileIcon className="size-10 mx-auto opacity-50" />
                  <p className="mt-2 text-sm">Preview not available for this file type.</p>
                </div>
              )}
            </div>
            <Button onClick={() => void fetchFile("download", password)} className="w-full" disabled={busy}>
              <Download className="size-4 mr-2" /> Download
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
