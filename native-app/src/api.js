import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const API_BASE = "https://ashishcloud.lovable.app";
const URL = "https://oibwmtrqqnlgtykprnjc.supabase.co";
const KEY = "sb_publishable_Yqzvm4Ju5uuQuqpuuo9Huw_qSMaFiG5"; // public key, safe to ship

export const supabase = createClient(URL, KEY, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

async function token() {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error("Please sign in again.");
  return t;
}

export async function listFiles(folder) {
  let q = supabase
    .from("files")
    .select("id,name,size_bytes,mime,folder,created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (folder) q = q.eq("folder", folder);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listFolders() {
  const { data } = await supabase.from("folders").select("name").order("name");
  return (data ?? []).map((f) => f.name);
}

export async function getProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("display_name,email,storage_quota_bytes,storage_used_bytes")
    .eq("id", u.user.id)
    .maybeSingle();
  return data;
}

export async function fileUrl(id, download = false) {
  const res = await fetch(`${API_BASE}/api/mobile/file-url`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id, download }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).url;
}

export async function uploadUri({ uri, name, mime, folder = "/" }) {
  const form = new FormData();
  form.append("file", { uri, name, type: mime || "application/octet-stream" });
  form.append("quality", "original");
  form.append("folder", folder);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}` },
    body: form,
  });
  if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status})`);
  return res.json();
}

export function fmtBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}
