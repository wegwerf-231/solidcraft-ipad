// Modified for solidcraft-ipad: generated version/offline inventory; see FORK-NOTICE.md.
// SolidCraft's service worker: the web app keeps working offline and updates itself.
//
// `cargo xtask web-offline` (Trunk's post_build hook) writes the build into the line below: the
// version (workspace version + a hash of every built file) and the files to keep, each with its
// SHA-256, and the same as `build.json` next to it. Files the app only fetches when it needs
// them (the CJK font) aren't kept: they come from the network. Every download is checked
// against its SHA-256: a deployment that lands mid-download (another build's `index.html`) fails
// the download instead of mixing into the kept build. A new build changes this file, so the
// browser installs the new worker, which keeps the whole new build before taking over.
//
// A launch only ever starts a build whose every file is kept, so a half-downloaded update can't
// break it. It asks for `build.json` (waiting at most NAVIGATE_TIMEOUT_MS): offline, slow or
// unchanged, the kept build starts; when a new build is deployed, it is downloaded first
// (waiting at most UPDATE_TIMEOUT_MS; the download goes on in the background after that) and
// started. When the site has no `build.json` (the app was removed), launches go to the network,
// the kept build answering when that fails. So they do when `build.json` is redirected or
// refused (a sign-in in front of the app): the browser then shows the sign-in. Each page then
// gets its files from the build it started (remembered in PAGES), never from another build
// with a file of the same name.
//
// A cache is only deleted when nothing uses it: a download holds its lock (Web Locks, shared,
// in any tab or worker; the browser releases it when the download ends or its worker stops), and
// an open page uses the build it started. Then unfinished downloads are dropped, and so are
// builds replaced by a newer worker (RETIRED). The origin is shared with other apps (github.io)
// and other copies of this one (the release zip works from any path): only caches named after
// this worker's path (CACHE_PREFIX…, PAGES) are ever touched.
//
// Unbuilt (VERSION "dev", as debug builds get it), the worker retires: it drops what a release
// build kept and unregisters, so `trunk serve` after `trunk serve --release --no-autoreload`
// shows the development build. Deploying this file unbuilt switches the worker off for everyone.
/* @build */ const VERSION = "0.6.1+dd2734337425e2fd", FILES = [{"file":".nojekyll","sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},{"file":"CHANGELOG.md","sha256":"597c4eb0cc8bf67771019b32d83525f3937c7b4c35b2552d18f64a38201d272e"},{"file":"CONTRIBUTING.md","sha256":"4413f507ec4568398629ec4ef74ff8352a8d14eb92181c0ad2b144442705cbdb"},{"file":"FORK-NOTICE.md","sha256":"d581813f9cb25eb75121a0d8ef22699ca0d77cf739f51a635220c6fbbdbba42e"},{"file":"IPAD-ANPASSUNG.md","sha256":"ff61b1270e2a0871f54a2dbe74ffbaf7d32d2164af3d4e822b70f3c582e0bb4f"},{"file":"LICENSE-APACHE","sha256":"0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594"},{"file":"LICENSE-MIT","sha256":"1a26c1e94401d5d221896c74dd1c58d227edc64516da95aaac6f675567c8af63"},{"file":"NOTICE","sha256":"09464b0c8f495c9e3c80d93fccf667056d1c2c306445d66101e4bed49494c54d"},{"file":"README.md","sha256":"37135df40ea2ac2073896af5444c1e7d550c5a41cfac45dc08b2f4725a67ba40"},{"file":"THIRD-PARTY-LICENSES.txt","sha256":"2fea8f11569c7596cdc65b3d21801b8d57920c0ccdd3b905da38a071702ce48b"},{"file":"about.html","sha256":"bfa9a37f0f98aca6665b47bcdc90faf36a37c5165318c6ce0949d9ac2c2ba331"},{"file":"canvas-shift.js","sha256":"96be4e88ca86a19c60bfae2c84628b60fdd96421575378dc41f59428950c091b"},{"file":"docs/IPAD-PERFORMANCE.md","sha256":"fd9932a97d50ed6cb37b0016052e9e1de336df8b301a8672954c265a1743343a"},{"file":"docs/KEYPAD-PENCIL.md","sha256":"a41509b4afd4747493a279e4d56aabfc534f6ce0e1ea277e32431a47bf5d2d2d"},{"file":"docs/LEGAL.md","sha256":"83e99560669e752953f145eb8239289803fe1ba4eda51f8ded9d2972fb5819d3"},{"file":"docs/NUMPAD-DISPLAY.md","sha256":"a8568189034add81832f35776d05b133d52531148bbffadca5d40f47ad706821"},{"file":"docs/RELEASING.md","sha256":"c40a54882eaa396277f31ce32e1e996baea12b7f06c96665f7056cfaf08b1705"},{"file":"docs/SKETCH-IPAD.md","sha256":"1a9b90e72a136ed23e14e34de0d06d8e679220d00b20deb90bb3e91f7a93ab42"},{"file":"docs/TOUCH-SHELL.md","sha256":"bd26615227be52340178927676f64555d7cf0b508a4d19ecf1e1788da749f5e9"},{"file":"docs/screenshots/ap2-error.png","sha256":"e630fe99bf170559bd45d8a430bbf11fa9e88506b84add912f7aeff0e70cb223"},{"file":"docs/screenshots/ap6-spline.png","sha256":"dace515d444a0ccfee7fbcc67f7b67a4ee26ba0dc0ed047c96a4a3aa102f2450"},{"file":"docs/screenshots/ap7-advanced.png","sha256":"554ebd979883f6e22a48552824c50749f0da14776c8ba895bff3deaeeff61d55"},{"file":"docs/screenshots/ap7-touch.png","sha256":"58cf3debfecd35746633e6d38f28108d0f303b0d652fa349f2078723294a5c41"},{"file":"docs/screenshots/extrude-drag-no-keypad.png","sha256":"124abf2cebb45a46e0d845edd509f0e970c96108c319d11b431a87b944dc7ebe"},{"file":"docs/screenshots/ipad-performance-spline.png","sha256":"3a5c08e0a141960e6f4bbb790dbd312b6d2fdf687553a001359f13b0e32bc8d0"},{"file":"docs/screenshots/keypad-dragged.png","sha256":"ebfbc158d98b66a14e2aa52c9b6ac6111231b22c3dd7ffed713bb8205052ba09"},{"file":"docs/screenshots/pr8-pr9-integrated.png","sha256":"ea90f90862f6a226657dca0eac9dbbead3e87aacbd7ca43fbe3c272158758d8e"},{"file":"fonts/BIZUDPGothic-Regular.ttf","sha256":"258d7156c165f2ff774b6efee637c22c3b950de0d8a10e501137061bc8085d01"},{"file":"fonts/CraftUI-SC.otf","sha256":"ab147a715a3f596f2dcde6e363ae7552cc6aa38d2b38ac521b876fddbbe787f5"},{"file":"fonts/CraftUI-TC.otf","sha256":"6e0482aa78df0154db060742fd9ab0e0b09a6a2e1e6a708f6bbfa4e0fc50dd5c"},{"file":"fonts/OFL.txt","sha256":"e753d7155d53c747d037a445e584c8ecfca6dd79846db610417e282a736b28bc"},{"file":"fonts/craft-ui-sc/OFL.txt","sha256":"feaa534bc7fe8d307903a2cfb0d9ff7aad8e83b1dc8dbb9d41ed7c533d461849"},{"file":"fonts/craft-ui-tc/OFL.txt","sha256":"f9c74d7fc3d9d7aa6243f3aa257de3e05115a926e6daf07296c2b5bdd8fa6dba"},{"file":"icons/256x256/io.tangencylabs.solidcraft.png","sha256":"71a3e492720571cf572faa51d86a7ff75e9d7dea0916142b51de835bf857c5af"},{"file":"icons/32x32/io.tangencylabs.solidcraft.png","sha256":"894552719c6bf8aa91f9d3ab3f1cb61836708f9ba00daf0324175ac82f16dfab"},{"file":"icons/512x512/io.tangencylabs.solidcraft.png","sha256":"84fde8ef270f5b32afa2d661749b4778a205e7df980dd67795c10f7f4a69e15d"},{"file":"index.html","sha256":"c3c77954dfb9a585f372d340120c00d31cbc889c8d1af4927dd824e87d6a6f57"},{"file":"keypad-tools.js","sha256":"77134fe798d2cea57ecf958f7e724eb28615d07e7e1fccc850847e92621312ec"},{"file":"legal/upstream-files.json","sha256":"d26bf1c27484d6770049901260e51b4ec6bc21d74ad6fc38657d8223c4ff9de9"},{"file":"legal/upstream/ATTRIBUTION.md","sha256":"889cc4fa02053b7c58ed6cf3f3c14363f98b329469b011c85e30d2a8d5d61e2c"},{"file":"legal/upstream/DISCLAIMER.md","sha256":"84df9edf9a6aff35a4693702671f404435950569813236b6c9973808bb369b15"},{"file":"loading-fa23566dd89fa92b.css","sha256":"6beeebe803106340480ebee6554cf7c1c33a2ce0410bcb42d7fd4f78e3dee7f2"},{"file":"loading-logo.svg","sha256":"31d87162bb6a5a189bf60575981a1ef24c245d209783d9ad08b8318f66146e3d"},{"file":"manifest.webmanifest","sha256":"ce7c33e4e7845bf86b6c76cb97bb31a9148068bbe929192cca4c9f2ad46053c3"},{"file":"pencil-gestures.js","sha256":"49f2a62833faa7cb57f2d0c7387dd5d81b959cef31f0e62d31b7a60b1754a607"},{"file":"pencil-sketch.js","sha256":"9f8404e246b81ffa46fdf7bdbf60f6c9665d28ba8b5a3d46c6bddf79b4c0220e"},{"file":"project-version.js","sha256":"730b698e52439a72bc91241080b12cf87fcd43e99d814732627cf6643ce10ef7"},{"file":"project.json","sha256":"d17a74dedb5bfef4167f7751fba6f1c62ff0e628639cc17188b6a749885ce94b"},{"file":"scripts/release.py","sha256":"55e75eb7fb7e1e2aee4d17573f784f91bb2685ba24cf739ae5d679a6dec2165f"},{"file":"sketch-tools-view.js","sha256":"1b35e71e27166a097e843a3fa235dd1187521ef89c95a10a1d6308b0c62d7c6f"},{"file":"sketch-tools.js","sha256":"cdc40fd4361c03aedb71cace6ac522c254c6eb7af5ec6e8c992e172d73f9a8dc"},{"file":"solidcraft-web-4b1d77a936edaef2.js","sha256":"a1766999f27bac22c11e93e18da9bdba4f4a3e01a412803fe179c9559bee858d"},{"file":"tests/canvas-shift.test.cjs","sha256":"57f341b5a407c848269b16fdf26c8776f1ad790b1ee1b9433faf677ebe8658df"},{"file":"tests/keypad-interaction.test.cjs","sha256":"09f7ff8ea9b71ad5e57c489d572387146e5ef8fe2bff37f4e33ebce808e7a77a"},{"file":"tests/keypad-tools.test.cjs","sha256":"6ec121a9b5508936502acde2615baaed727e03cc251b2e1072d236bf2be1b4f5"},{"file":"tests/pencil-gestures.test.cjs","sha256":"b0f6169b9eba2a44f839617b18f31c4c428f7108eb0cac1fc50b69defeefbe86"},{"file":"tests/pencil-ink.test.cjs","sha256":"2b435810bbc84bd5573bebc0147b87bc368e28bef478a79169ddc521ada01966"},{"file":"tests/pencil-integration.test.cjs","sha256":"3df7ed355e1bc1b91511ecaebb04698deeada2790d2e450ad114665637ce3e4f"},{"file":"tests/sketch-browser.html","sha256":"372a904dc9c7ea9924c39896494468778620e4d78ed2047fd8a57912efe31d20"},{"file":"tests/sketch-refresh.test.cjs","sha256":"43bdcf74d426ada935808d6709fd2a31ad324fc652121589136d451347a5aa6d"},{"file":"tests/sketch-tools.test.cjs","sha256":"0645027b065224734736543320e80637c8acec88a3d01ab42dbb1b14da6ecec2"},{"file":"tests/sketch-view.test.cjs","sha256":"b44d442feb3ea0673cbc42c9a716decede3c2bdb3a563c1e1ffed2c444be6669"},{"file":"tests/test_release.py","sha256":"12e5779ada482a3f28be5fa29e36d90b227574547bba148c222d4039e9fa1ad5"},{"file":"tests/touch-refresh.test.cjs","sha256":"02d26b210e13d919141f21bf658798fe056e3b1ec6b322035c875d12cd6b7c79"},{"file":"tests/touch-shell.test.cjs","sha256":"39b60f87c27f4228d63c5cb9cbc621aa50040544d52af20bc0a823db2e3a24e9"},{"file":"touch-nav.js","sha256":"4919b18fed1af44010e31d890fa4a2db4ed237554002e72a7a4ef4a606c8096f"},{"file":"touch-shell.js","sha256":"4e456ea22252960defc9d7e11e7b6bb271bf954d6c520d9e2f07a02df41664c5"},{"file":"wasm/solidcraft-web-4b1d77a936edaef2_bg.part0.bin","sha256":"ebd3a83cc7182aafe28971c06589f7f120192ac9eacdeb26f07a08f1b4f95600"},{"file":"wasm/solidcraft-web-4b1d77a936edaef2_bg.part1.bin","sha256":"857ef5da9bc25f12c8c46458fc50d628fe6ccb857887a59355b0c2bda676492e"},{"file":"wasm/solidcraft-web-4b1d77a936edaef2_bg.part2.bin","sha256":"1c81ff57298c2c6c9bf03f92b405e81c655b3c740a14bca39e59dced14b30fc9"},{"file":"wasm/solidcraft-web-4b1d77a936edaef2_bg.part3.bin","sha256":"85bf84429d9635208eab5f7f6086515a5b404b764f6ff675f6399207621c4141"},{"file":"wasm/solidcraft-web-4b1d77a936edaef2_bg.part4.bin","sha256":"6260c9bfde1eb7ee0d286d9bf956eab0d2112dff6b0c8ed7d2847de491cd07cc"}];
const RETIRE = VERSION === "dev";

const PATH = new URL(self.registration.scope).pathname;
const CACHE_PREFIX = `solidcraft-app ${PATH} `;
const CACHE = CACHE_PREFIX + VERSION;
/** Which build each open page started: page id → cache name (or NETWORK). */
const PAGES = `solidcraft-app-pages ${PATH}`;
/** A page that came from the network gets its files from there too. */
const NETWORK = "network";
const NAVIGATE_TIMEOUT_MS = 4000;
const UPDATE_TIMEOUT_MS = 20000;
/** The entry that marks a cache as holding its whole build. */
const COMPLETE = "build-complete";
/** The entry that marks a build replaced by a newer worker. */
const RETIRED = "build-retired";
/** A page remembered this recently may still be loading (not yet listed among the clients). */
const PAGE_LOADING_MS = 30 * 1000;

const url = (file) => new URL(file, self.registration.scope).href;
const has = (name, entry) => caches.match(url(entry), { cacheName: name }).then(Boolean);

/** Run `fn` while using the cache `name`: it isn't deleted meanwhile. */
const using = (name, fn) => navigator.locks.request(name, { mode: "shared" }, fn);

/** Delete the cache `name` if nothing is using it and `unwanted()` (asked once no one can start to) agrees. */
const drop = (name, unwanted) =>
  navigator.locks.request(name, { ifAvailable: true }, async (free) => free && (await unwanted()) && caches.delete(name));

const hex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Keep every file of a build (an earlier partial download is resumed); resolves to its cache's
 * name. The first file that fails cancels the others.
 */
function keep(version, files) {
  const name = CACHE_PREFIX + version;
  return using(name, async () => {
    const cache = await caches.open(name);
    await cache.delete(url(RETIRED)); // Back in use (a rollback).
    if (await has(name, COMPLETE)) return name;
    const cancel = new AbortController();
    const results = await Promise.allSettled(
      files.map(async ({ file, sha256 }) => {
        try {
          if (await cache.match(url(file))) return;
          // `no-cache`: revalidate with the server, so a stale HTTP-cached page never mixes builds.
          const response = await fetch(new Request(url(file), { cache: "no-cache" }), { signal: cancel.signal });
          if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
          const body = await response.arrayBuffer();
          if (hex(await crypto.subtle.digest("SHA-256", body)) !== sha256) throw new Error(`${file}: not this build's`);
          await cache.put(url(file), new Response(body, { headers: response.headers }));
        } catch (error) {
          cancel.abort();
          throw error;
        }
      }),
    );
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
    await cache.put(url(COMPLETE), new Response(version));
    return name;
  });
}

const pageEntry = (id) => url(`~page/${encodeURIComponent(id)}`);

/** Remember which build a page started. */
async function started(id, build) {
  if (!id) return;
  const record = JSON.stringify({ build, at: Date.now() });
  await (await caches.open(PAGES)).put(pageEntry(id), new Response(record));
}

/** The build a page started; a page started before it was remembered gets this worker's. */
async function startedBy(id) {
  const response = id ? await caches.match(pageEntry(id), { cacheName: PAGES }) : null;
  return response ? (await response.json()).build : CACHE;
}

/** The builds open pages use (pages closed since are forgotten). */
async function inUse() {
  const open = new Set((await self.clients.matchAll({ includeUncontrolled: true })).map((c) => c.id));
  const pages = await caches.open(PAGES);
  const builds = new Set();
  for (const request of await pages.keys()) {
    const id = decodeURIComponent(request.url.split("~page/")[1] ?? "");
    const record = await pages.match(request).then((r) => r?.json()).catch(() => null);
    if (record && (open.has(id) || Date.now() - record.at < PAGE_LOADING_MS)) builds.add(record.build);
    else await pages.delete(request);
  }
  return builds;
}

/** Drop unfinished downloads nothing is using, and replaced builds no open page uses. */
async function sweep() {
  for (const name of await caches.keys()) {
    if (!name.startsWith(CACHE_PREFIX) || name === CACHE) continue;
    await drop(name, async () => !(await has(name, COMPLETE)) || ((await has(name, RETIRED)) && !(await inUse()).has(name)));
  }
}

self.addEventListener("install", (event) => {
  // Clean up first: a page open for days sees updates (and failed ones) without any launch.
  const install = () => sweep().catch(() => {}).then(() => keep(VERSION, FILES));
  event.waitUntil(RETIRE ? self.skipWaiting() : install().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (RETIRE) {
        for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX) || name === PAGES) await caches.delete(name);
        return self.registration.unregister();
      }
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await (await caches.open(name)).put(url(RETIRED), new Response(""));
      }
      await sweep();
      await self.clients.claim();
    })(),
  );
});

/** The promise's value, or null when it fails or takes longer than `ms`. */
function within(ms, promise) {
  return Promise.race([promise.catch(() => null), new Promise((resolve) => setTimeout(resolve, ms, null))]);
}

/** No app is deployed here any more (the server says `build.json` doesn't exist). */
const GONE = "gone";

/** The site wants a sign-in first (`build.json` is redirected, often to another origin, or refused). */
const SIGN_IN = "sign-in";

/** The deployed build's version and files, GONE, SIGN_IN, or null (unknown: offline, failing, invalid). */
async function deployed() {
  // `manual`: a redirect to another origin would only fail (CORS), looking like being offline.
  const response = await fetch(url("build.json"), { cache: "no-cache", redirect: "manual" });
  if (response.type === "opaqueredirect" || response.status === 401 || response.status === 403) return SIGN_IN;
  if (response.status === 404 || response.status === 410) return GONE;
  const build = response.ok ? await response.json() : null;
  const valid = build && typeof build.version === "string" && Array.isArray(build.files);
  return valid && build.files.every((f) => typeof f.file === "string" && typeof f.sha256 === "string") ? build : null;
}

/** Keep the worker alive for `promise` (allowed while the launch is being answered). */
function extend(event, promise) {
  try {
    event.waitUntil(promise.catch(() => {}));
  } catch {
    // The event has ended; the work goes on while the worker runs.
  }
}

/** A launch: the start page of a complete build (whatever query the URL has: `?sample`), and that build. */
async function launch(event) {
  const kept = await caches.match(url("index.html"), { cacheName: CACHE });
  if (!kept) return [await fetch(event.request), NETWORK]; // Nothing kept yet (the first visit).
  extend(event, sweep());
  const build = await within(NAVIGATE_TIMEOUT_MS, deployed());
  if (build === SIGN_IN) return [await fetch(event.request), NETWORK];
  if (build === GONE) {
    const page = await fetch(event.request).catch(() => null);
    return page && page.ok ? [page, NETWORK] : [kept, CACHE];
  }
  if (!build || build.version === VERSION) return [kept, CACHE];
  const download = keep(build.version, build.files);
  extend(event, download);
  const name = await within(UPDATE_TIMEOUT_MS, download);
  const page = name && (await caches.match(url("index.html"), { cacheName: name }));
  return page ? [page, name] : [kept, CACHE];
}

/**
 * A launch that fails unexpectedly still starts the kept build (or asks the network). A newer
 * worker only takes over once the launch has ended, by when its page is remembered (in use).
 */
async function launchOrKept(event) {
  let page, build;
  try {
    [page, build] = await launch(event);
  } catch {
    page = await caches.match(url("index.html"), { cacheName: CACHE }).catch(() => null);
    build = page ? CACHE : NETWORK;
    page = page || (await fetch(event.request));
  }
  await started(event.resultingClientId, build).catch(() => {});
  return page;
}

/** A page's files come from the build it started, else the network. */
async function asset(event) {
  const build = await startedBy(event.clientId).catch(() => CACHE);
  const kept = build === NETWORK ? null : await caches.match(event.request, { cacheName: build, ignoreSearch: true });
  return kept || fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (RETIRE || request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const path = request.url.split(/[?#]/)[0];
  const start = request.mode === "navigate" && (path === url("") || path === url("index.html"));
  event.respondWith(start ? launchOrKept(event) : asset(event));
});
