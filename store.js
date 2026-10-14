// لایه ذخیره‌سازی: حالت محلی (localStorage) یا آنلاین (Firebase Firestore)
const LS_KEY = 'pm_data_v1';
const CFG_KEY = 'pm_firebase_cfg';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const DEFAULT_BRANDS = ['آیفون', 'سامسونگ', 'شیائومی', 'سایر'];

export function getFirebaseConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)); } catch { return null; }
}
export function setFirebaseConfig(cfg) {
  if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CFG_KEY);
}

const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------- حالت محلی ---------------- */
export function createLocalStore() {
  const subs = new Set();
  const load = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || { items: [], brands: null }; }
    catch { return { items: [], brands: null }; }
  };
  let data = load();
  const state = () => ({ items: data.items, brands: data.brands || DEFAULT_BRANDS });
  const emit = (changes = []) => subs.forEach((f) => f(state(), changes));
  const persist = () => { localStorage.setItem(LS_KEY, JSON.stringify(data)); emit(); };

  // تغییر در تب دیگر همین مرورگر
  window.addEventListener('storage', (e) => {
    if (e.key !== LS_KEY) return;
    data = load();
    emit();
  });

  return {
    mode: 'local',
    needsAuth: false,
    subscribe(cb) { subs.add(cb); cb(state(), []); return () => subs.delete(cb); },
    async saveItem(item) {
      const i = data.items.findIndex((x) => x.id === item.id);
      if (i >= 0) data.items[i] = clone(item); else data.items.push(clone(item));
      persist();
    },
    async deleteItem(id) { data.items = data.items.filter((x) => x.id !== id); persist(); },
    async saveBrands(list) { data.brands = list; persist(); },
    async importAll(d) {
      const map = new Map(data.items.map((x) => [x.id, x]));
      (d.items || []).forEach((x) => map.set(x.id, x));
      data.items = [...map.values()];
      if (d.brands?.length) data.brands = [...new Set([...(data.brands || DEFAULT_BRANDS), ...d.brands])];
      persist();
    },
    exportAll() { return { items: data.items, brands: state().brands }; },
  };
}

/* ---------------- حالت آنلاین ---------------- */
export async function createFirebaseStore(cfg) {
  const [appM, fsM, authM] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-firestore.js'),
    import(FB + 'firebase-auth.js'),
  ]);
  const app = appM.initializeApp(cfg);
  const db = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache() });
  const auth = authM.getAuth(app);
  const { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } = fsM;

  const subs = new Set();
  let items = [], brands = DEFAULT_BRANDS, gotServer = false, unsubs = [];
  const state = () => ({ items, brands });
  const emit = (changes = []) => subs.forEach((f) => f(state(), changes));

  function start() {
    stop();
    gotServer = false;
    unsubs.push(onSnapshot(collection(db, 'items'), (snap) => {
      items = snap.docs.map((d) => d.data());
      let changes = [];
      if (!gotServer && !snap.metadata.fromCache) { gotServer = true; }
      else if (gotServer && !snap.metadata.hasPendingWrites) {
        changes = snap.docChanges().map((c) => ({ type: c.type, item: c.doc.data() }));
      }
      emit(changes);
    }));
    unsubs.push(onSnapshot(doc(db, 'meta', 'brands'), (s) => {
      if (s.exists() && s.data().list?.length) brands = s.data().list;
      emit();
    }));
  }
  function stop() { unsubs.forEach((u) => u()); unsubs = []; }

  return {
    mode: 'online',
    needsAuth: true,
    onAuth(cb) {
      return authM.onAuthStateChanged(auth, (u) => { if (u) start(); else { stop(); items = []; } cb(u); });
    },
    login: (email, pass) => authM.signInWithEmailAndPassword(auth, email, pass),
    logout: () => authM.signOut(auth),
    subscribe(cb) { subs.add(cb); cb(state(), []); return () => subs.delete(cb); },
    async saveItem(item) {
      item.updatedBy = auth.currentUser?.email || '';
      await setDoc(doc(db, 'items', item.id), clone(item));
    },
    async deleteItem(id) { await deleteDoc(doc(db, 'items', id)); },
    async saveBrands(list) { await setDoc(doc(db, 'meta', 'brands'), { list }); },
    async importAll(d) {
      const all = d.items || [];
      for (let i = 0; i < all.length; i += 400) {
        const b = writeBatch(db);
        all.slice(i, i + 400).forEach((x) => b.set(doc(db, 'items', x.id), clone(x)));
        await b.commit();
      }
      if (d.brands?.length) await this.saveBrands([...new Set([...brands, ...d.brands])]);
    },
    exportAll() { return { items, brands }; },
  };
}
