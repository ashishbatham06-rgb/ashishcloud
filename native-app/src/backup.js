import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundFetch from "expo-background-fetch";
import * as MediaLibrary from "expo-media-library";
import * as TaskManager from "expo-task-manager";
import { uploadUri } from "./api";

export const BACKUP_TASK = "ashish-cloud-auto-backup";
const K = { enabled: "backup.enabled", since: "backup.since", last: "backup.lastRun", count: "backup.total", videos: "backup.videos" };

export async function getBackupState() {
  const [e, s, l, c, v] = await Promise.all(Object.values(K).map((k) => AsyncStorage.getItem(k)));
  return { enabled: e === "1", since: Number(s || 0), lastRun: Number(l || 0), total: Number(c || 0), videos: v !== "0" };
}

export async function setVideos(on) { await AsyncStorage.setItem(K.videos, on ? "1" : "0"); }

export async function setBackupEnabled(on) {
  if (on) {
    const p = await MediaLibrary.requestPermissionsAsync();
    if (!p.granted) throw new Error("Gallery permission is required for auto backup.");
    await AsyncStorage.setItem(K.enabled, "1");
    // Start from now so we don't re-upload the whole gallery unless the user taps "Back up now".
    if (!(await AsyncStorage.getItem(K.since))) await AsyncStorage.setItem(K.since, String(Date.now() - 24 * 3600e3));
    await BackgroundFetch.registerTaskAsync(BACKUP_TASK, { minimumInterval: 15 * 60, stopOnTerminate: false, startOnBoot: true });
  } else {
    await AsyncStorage.setItem(K.enabled, "0");
    if (await TaskManager.isTaskRegisteredAsync(BACKUP_TASK)) await BackgroundFetch.unregisterTaskAsync(BACKUP_TASK);
  }
}

let running = false;
export async function runBackup(onProgress) {
  if (running) return 0;
  running = true;
  let done = 0;
  try {
    const st = await getBackupState();
    const perm = await MediaLibrary.getPermissionsAsync();
    if (!perm.granted) return 0;
    const types = st.videos ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video] : [MediaLibrary.MediaType.photo];
    const page = await MediaLibrary.getAssetsAsync({
      first: 40, mediaType: types, createdAfter: st.since, sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    });
    let newest = st.since;
    for (const a of page.assets) {
      const info = await MediaLibrary.getAssetInfoAsync(a);
      const uri = info.localUri || a.uri;
      const mime = a.mediaType === "video" ? "video/mp4" : "image/jpeg";
      await uploadUri({ uri, name: a.filename, mime });
      done++;
      newest = Math.max(newest, a.creationTime + 1);
      await AsyncStorage.setItem(K.since, String(newest));
      onProgress?.(done, page.assets.length);
    }
    await AsyncStorage.setItem(K.count, String(st.total + done));
    await AsyncStorage.setItem(K.last, String(Date.now()));
  } finally {
    running = false;
  }
  return done;
}

TaskManager.defineTask(BACKUP_TASK, async () => {
  try {
    const st = await getBackupState();
    if (!st.enabled) return BackgroundFetch.BackgroundFetchResult.NoData;
    const n = await runBackup();
    return n ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
