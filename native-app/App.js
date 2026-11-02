import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform,
  Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View, useColorScheme,
} from "react-native";
import { fileUrl, fmtBytes, getProfile, listFiles, listFolders, supabase, uploadUri } from "./src/api";
import { getBackupState, runBackup, setBackupEnabled, setVideos } from "./src/backup";

const light = { bg: "#F5F6FB", card: "#FFFFFF", text: "#141625", sub: "#6B7085", line: "#E7E9F2", accent: "#5B4BF5", accent2: "#00B3C7" };
const dark = { bg: "#0C0D14", card: "#171925", text: "#F2F3F8", sub: "#8C90A6", line: "#262938", accent: "#7C6CFF", accent2: "#22D3EE" };
const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export default function App() {
  const c = useColorScheme() === "dark" ? dark : light;
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <View style={[s.center, { backgroundColor: c.bg }]}><ActivityIndicator color={c.accent} /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c === dark ? "light" : "dark"} />
      {session ? <Main c={c} /> : <Login c={c} />}
    </View>
  );
}

function Login({ c }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); Alert.alert("Sign in failed", error.message); }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <LinearGradient colors={[c.accent, c.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <Ionicons name="cloud" size={56} color="#fff" />
        <Text style={s.brand}>Ashish Cloud</Text>
        <Text style={s.tag}>Your memories. Safe. Everywhere.</Text>
      </LinearGradient>
      <View style={[s.loginCard, { backgroundColor: c.card }]}>
        <Text style={[s.h2, { color: c.text }]}>Welcome back</Text>
        <Field c={c} icon="mail-outline" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field c={c} icon="lock-closed-outline" placeholder="Password" value={pw} onChangeText={setPw} secureTextEntry />
        <Btn c={c} label={busy ? "Signing in…" : "Sign in"} onPress={go} disabled={busy || !email || !pw} />
        <Pressable onPress={() => Linking.openURL("https://ashishcloud.lovable.app/signup")}>
          <Text style={{ color: c.sub, textAlign: "center", marginTop: 16 }}>New here? <Text style={{ color: c.accent, fontWeight: "700" }}>Create account</Text></Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ c, icon, ...p }) {
  return (
    <View style={[s.field, { borderColor: c.line, backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={18} color={c.sub} />
      <TextInput {...p} autoCapitalize="none" placeholderTextColor={c.sub} style={{ flex: 1, color: c.text, fontSize: 15, marginLeft: 10 }} />
    </View>
  );
}

function Btn({ c, label, onPress, disabled, icon }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} disabled={disabled} style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <LinearGradient colors={[c.accent, c.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
        {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} />}
        <Text style={s.btnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const TABS = [
  { key: "files", label: "Files", icon: "images" },
  { key: "backup", label: "Backup", icon: "sync-circle" },
  { key: "account", label: "Account", icon: "person-circle" },
];

function Main({ c }) {
  const [tab, setTab] = useState("files");
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === "files" && <Files c={c} />}
        {tab === "backup" && <Backup c={c} />}
        {tab === "account" && <Account c={c} />}
      </View>
      <View style={[s.tabbar, { backgroundColor: c.card, borderColor: c.line }]}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => { tap(); setTab(t.key); }} style={s.tab}>
              <View style={[s.tabPill, on && { backgroundColor: c.accent + "22" }]}>
                <Ionicons name={on ? t.icon : `${t.icon}-outline`} size={22} color={on ? c.accent : c.sub} />
              </View>
              <Text style={{ fontSize: 11, marginTop: 2, color: on ? c.accent : c.sub, fontWeight: on ? "700" : "500" }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const W = Dimensions.get("window").width;
const TILE = (W - 16 * 2 - 6 * 2) / 3;

function Files({ c }) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [folder, setFolder] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [view, setView] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, fl] = await Promise.all([listFiles(folder), listFolders()]);
      setFiles(f); setFolders(fl);
      const imgs = f.filter((x) => x.mime?.startsWith("image/")).slice(0, 60);
      const entries = await Promise.all(imgs.map(async (x) => [x.id, await fileUrl(x.id).catch(() => null)]));
      setThumbs(Object.fromEntries(entries));
    } catch (e) { Alert.alert("Couldn't load files", String(e.message || e)); }
    setLoading(false);
  }, [folder]);
  useEffect(() => { load(); }, [load]);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, quality: 1 });
    if (r.canceled) return;
    let i = 0;
    for (const a of r.assets) {
      setUploading(`${++i}/${r.assets.length}`);
      try {
        await uploadUri({ uri: a.uri, name: a.fileName || `upload-${Date.now()}.${a.type === "video" ? "mp4" : "jpg"}`, mime: a.mimeType, folder: folder || "/" });
      } catch (e) { Alert.alert("Upload failed", String(e.message || e)); break; }
    }
    setUploading(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    load();
  };

  const open = async (f) => {
    tap();
    if (f.mime?.startsWith("image/")) return setView(f);
    const url = await fileUrl(f.id, true).catch(() => null);
    if (url) Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={[s.h1, { color: c.text }]}>My Files</Text>
        <Text style={{ color: c.sub }}>{files.length} items</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {[null, ...folders].map((f) => {
          const on = folder === f;
          return (
            <Pressable key={f ?? "all"} onPress={() => { tap(); setFolder(f); }} style={[s.chip, { backgroundColor: on ? c.accent : c.card, borderColor: on ? c.accent : c.line }]}>
              <Ionicons name={f ? "folder" : "apps"} size={14} color={on ? "#fff" : c.sub} />
              <Text style={{ color: on ? "#fff" : c.text, marginLeft: 6, fontWeight: "600" }}>{f ?? "All"}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <FlatList
        data={files}
        keyExtractor={(x) => x.id}
        numColumns={3}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        columnWrapperStyle={{ gap: 6 }}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
        ListEmptyComponent={!loading && (
          <View style={[s.empty, { backgroundColor: c.card }]}>
            <Ionicons name="cloud-upload-outline" size={48} color={c.accent} />
            <Text style={[s.h2, { color: c.text, marginTop: 10 }]}>Nothing here yet</Text>
            <Text style={{ color: c.sub, textAlign: "center" }}>Tap + to upload photos and videos</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={[s.tile, { backgroundColor: c.card }]}>
            {thumbs[item.id] ? <Image source={{ uri: thumbs[item.id] }} style={StyleSheet.absoluteFill} /> : (
              <View style={s.center}>
                <Ionicons name={item.mime?.startsWith("video/") ? "videocam" : "document-text"} size={26} color={c.accent} />
                <Text numberOfLines={1} style={{ color: c.sub, fontSize: 10, marginTop: 4, paddingHorizontal: 6 }}>{item.name}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
      <Pressable onPress={() => { tap(); pick(); }} disabled={!!uploading} style={s.fabWrap}>
        <LinearGradient colors={[c.accent, c.accent2]} style={s.fab}>
          {uploading ? <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{uploading}</Text> : <Ionicons name="add" size={30} color="#fff" />}
        </LinearGradient>
      </Pressable>
      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={s.viewer}>
          {view && <Image source={{ uri: thumbs[view.id] }} style={{ width: "100%", height: "80%" }} resizeMode="contain" />}
          <View style={{ flexDirection: "row", gap: 24, marginTop: 16 }}>
            <Pressable onPress={async () => { const u = await fileUrl(view.id, true); Linking.openURL(u); }}><Ionicons name="download-outline" size={28} color="#fff" /></Pressable>
            <Pressable onPress={() => setView(null)}><Ionicons name="close" size={28} color="#fff" /></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Backup({ c }) {
  const [st, setSt] = useState(null);
  const [prog, setProg] = useState(null);
  const refresh = () => getBackupState().then(setSt);
  useEffect(() => { refresh(); }, []);
  if (!st) return null;
  const toggle = async (on) => {
    try { await setBackupEnabled(on); tap(); refresh(); } catch (e) { Alert.alert("Auto backup", String(e.message || e)); }
  };
  const now = async () => {
    try {
      setProg("Starting…");
      const n = await runBackup((d, t) => setProg(`Uploading ${d}/${t}`));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Backup complete", n ? `${n} new items backed up.` : "Everything is already backed up.");
    } catch (e) { Alert.alert("Backup failed", String(e.message || e)); }
    setProg(null); refresh();
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
      <Text style={[s.h1, { color: c.text, marginBottom: 16 }]}>Auto Backup</Text>
      <LinearGradient colors={st.enabled ? [c.accent, c.accent2] : [c.card, c.card]} style={[s.bigCard, { borderColor: c.line }]}>
        <Ionicons name={st.enabled ? "shield-checkmark" : "shield-outline"} size={40} color={st.enabled ? "#fff" : c.accent} />
        <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 10, color: st.enabled ? "#fff" : c.text }}>{st.enabled ? "Backup is on" : "Backup is off"}</Text>
        <Text style={{ color: st.enabled ? "#ffffffcc" : c.sub, marginTop: 4 }}>
          {st.lastRun ? `Last backup ${new Date(st.lastRun).toLocaleString()}` : "New photos will be saved automatically"}
        </Text>
        <Text style={{ color: st.enabled ? "#fff" : c.text, marginTop: 10, fontWeight: "700" }}>{st.total} items backed up</Text>
      </LinearGradient>
      <Row c={c} icon="cloud-upload-outline" title="Auto backup photos" sub="Runs in background about every 15 min">
        <Switch value={st.enabled} onValueChange={toggle} trackColor={{ true: c.accent }} />
      </Row>
      <Row c={c} icon="videocam-outline" title="Include videos" sub="Uses more data">
        <Switch value={st.videos} onValueChange={async (v) => { await setVideos(v); refresh(); }} trackColor={{ true: c.accent }} />
      </Row>
      <View style={{ marginTop: 20 }}>
        <Btn c={c} icon="sync" label={prog || "Back up now"} onPress={now} disabled={!!prog} />
      </View>
    </ScrollView>
  );
}

function Row({ c, icon, title, sub, children }) {
  return (
    <View style={[s.row, { backgroundColor: c.card, borderColor: c.line }]}>
      <View style={[s.rowIcon, { backgroundColor: c.accent + "1A" }]}><Ionicons name={icon} size={20} color={c.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>{title}</Text>
        {sub ? <Text style={{ color: c.sub, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Account({ c }) {
  const [p, setP] = useState(null);
  useEffect(() => { getProfile().then(setP); }, []);
  const pct = p ? Math.min(100, (p.storage_used_bytes / Math.max(1, p.storage_quota_bytes)) * 100) : 0;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
      <Text style={[s.h1, { color: c.text, marginBottom: 16 }]}>Account</Text>
      <View style={[s.bigCard, { backgroundColor: c.card, borderColor: c.line, alignItems: "flex-start" }]}>
        <LinearGradient colors={[c.accent, c.accent2]} style={s.avatar}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{(p?.display_name || p?.email || "?")[0].toUpperCase()}</Text>
        </LinearGradient>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "800", marginTop: 12 }}>{p?.display_name || "Ashish Cloud user"}</Text>
        <Text style={{ color: c.sub }}>{p?.email}</Text>
        <Text style={{ color: c.text, fontWeight: "700", marginTop: 18 }}>Storage</Text>
        <View style={[s.bar, { backgroundColor: c.line }]}>
          <LinearGradient colors={[c.accent, c.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct}%`, height: "100%", borderRadius: 8 }} />
        </View>
        <Text style={{ color: c.sub, marginTop: 6 }}>{fmtBytes(p?.storage_used_bytes)} of {fmtBytes(p?.storage_quota_bytes)} used</Text>
      </View>
      <Pressable onPress={() => Linking.openURL("https://ashishcloud.lovable.app/help")}><Row c={c} icon="help-circle-outline" title="Help center" /></Pressable>
      <Pressable onPress={() => Linking.openURL("mailto:ashish01raikwar@gmail.com")}><Row c={c} icon="mail-outline" title="Contact support" /></Pressable>
      <Pressable onPress={() => { tap(); setBackupEnabled(false).catch(() => {}); supabase.auth.signOut(); }}>
        <Row c={c} icon="log-out-outline" title="Sign out" />
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { height: 330, alignItems: "center", justifyContent: "center", borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  brand: { color: "#fff", fontSize: 34, fontWeight: "900", letterSpacing: -0.5, marginTop: 8 },
  tag: { color: "#ffffffd0", marginTop: 6 },
  loginCard: { marginHorizontal: 20, marginTop: -50, padding: 22, borderRadius: 26, elevation: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20 },
  h1: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "800", marginBottom: 14 },
  field: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 52, marginBottom: 12 },
  btn: { height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 44, paddingBottom: 14 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1 },
  tile: { width: TILE, height: TILE, borderRadius: 14, overflow: "hidden" },
  empty: { alignItems: "center", padding: 32, borderRadius: 24, marginTop: 30 },
  fabWrap: { position: "absolute", right: 20, bottom: 24, elevation: 10 },
  fab: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  viewer: { flex: 1, backgroundColor: "#000000f0", alignItems: "center", justifyContent: "center" },
  tabbar: { flexDirection: "row", borderTopWidth: 1, paddingTop: 8, paddingBottom: 14 },
  tab: { flex: 1, alignItems: "center" },
  tabPill: { paddingHorizontal: 18, paddingVertical: 4, borderRadius: 14 },
  bigCard: { borderRadius: 26, padding: 22, alignItems: "center", borderWidth: 1, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 10, gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  bar: { width: "100%", height: 10, borderRadius: 8, marginTop: 10, overflow: "hidden" },
});
