/*
 * QISU HUB installable/offline regression suite.
 * Uses the existing shared browser. Never launches a browser or changes login state.
 * Run only after the managed product has been rebuilt and restarted:
 *   QISUSHUO_URL=http://127.0.0.1:<managed-port> node tests/browser-pwa.cjs
 * A nested deployment can be tested with QISUSHUO_URL=https://host/qisu-hub/.
 * Only uniquely named test records are removed; other local data is preserved.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const input = process.env.QISUSHUO_URL || process.env.QISU_URL;
assert(input, 'Set QISUSHUO_URL to the managed product URL; this test does not start a server.');
const base = new URL(input.endsWith('/') ? input : input + '/');
const appURL = new URL('app.html', base).href;
const browserURL = process.env.QISU_BROWSER_URL || 'http://127.0.0.1:9333';
const reportPath = process.env.QISU_PWA_REPORT || 'test-results/pwa-report.json';
const runID = Date.now() + '-' + process.pid;
const testTitles = ['PWA 离线验收 ' + runID, 'PWA 并行新增验收 ' + runID];
const firstBody = '离线新建的研究稿件。原始记录必须在重开应用后保留。';
const winnerBody = '窗口甲保存的第二版本，不能被窗口乙的旧版本覆盖。';
const staleBody = '窗口乙尚未保存的正文，发生冲突后必须仍然可以复制。';

async function readState(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('qisushuo-personal-research', 1);
    open.onerror = () => reject(new Error('Cannot open local workspace'));
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('workspace', 'readonly');
      const read = tx.objectStore('workspace').get('state');
      let state;
      read.onsuccess = () => { state = read.result; };
      tx.oncomplete = () => { db.close(); resolve(state); };
      tx.onabort = () => { db.close(); reject(new Error('Cannot read local workspace')); };
    };
  }));
}

async function removeTestRecords(page) {
  return page.evaluate(async titles => {
    // Opening a missing database creates it. Never perform cleanup before the
    // application has initialized, or when the origin has no workspace yet.
    if (window.__qisushuoReady !== true || typeof indexedDB.databases !== 'function') return false;
    const databases = await indexedDB.databases();
    if (!databases.some(db => db.name === 'qisushuo-personal-research')) return false;
    return new Promise((resolve, reject) => {
    const open = indexedDB.open('qisushuo-personal-research', 1);
    open.onupgradeneeded = () => open.transaction.abort(); // Guard against deletion between the check and open.
    open.onerror = () => reject(new Error('Cannot open workspace for cleanup'));
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('workspace')) { db.close(); resolve(false); return; }
      const tx = db.transaction('workspace', 'readwrite');
      const store = tx.objectStore('workspace');
      const read = store.get('state');
      read.onsuccess = () => {
        const state = read.result;
        if (!state || !Array.isArray(state.records) || !Array.isArray(state.revisions)) {
          tx.abort();
          return;
        }
        const ids = new Set(state.records.filter(row => titles.includes(row.title)).map(row => row.id));
        state.records = state.records.filter(row => !ids.has(row.id));
        state.revisions = state.revisions.filter(row => !ids.has(row.id));
        store.put(state, 'state');
      };
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onabort = () => { db.close(); reject(new Error('Test record cleanup failed; user data was not reset')); };
    };
    });
  }, testTitles);
}

async function ready(page, route = 'home') {
  await page.bringToFront();
  await page.goto(appURL + '#' + route, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__qisushuoReady === true, null, { timeout: 60000 });
  await page.locator('.app-shell').waitFor();
}

async function navigate(page, route) {
  await page.bringToFront();
  const previousHeading = await page.locator('main h1').innerText();
  await page.evaluate(view => { location.hash = view; }, route);
  await page.waitForFunction(({ route, previousHeading }) => {
    const heading = document.querySelector('main h1');
    return location.hash === '#' + route && heading && heading.textContent.trim() !== previousHeading;
  }, { route, previousHeading });
}

async function createDraft(page, title, body) {
  await page.bringToFront();
  await page.getByRole('button', { name: '新建稿件', exact: true }).first().click();
  await page.getByLabel('记录标题', { exact: true }).fill(title);
  await page.getByLabel('正文内容', { exact: true }).fill(body);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
}

async function editDraft(page, title) {
  await page.bringToFront();
  const card = page.locator('.draft-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await card.getByRole('button', { name: '继续编辑', exact: false }).click();
  await page.getByLabel('正文内容', { exact: true }).waitFor();
}

async function downloadJSON(download, page) {
  assert((download.suggestedFilename() || '').endsWith('.json'), 'Backup must download as JSON');
  assert.equal(await download.failure(), null, 'Browser backup download failed');
  // The shared-browser bridge can return an empty createReadStream. Check the
  // actual downloadable Blob in-page as well as the native download event.
  const text = await page.evaluate(() => window.__qisuPwaBackupText);
  assert(text && text.length > 0, 'The generated backup Blob is empty');
  return JSON.parse(text);
}

async function storageFailureCase(testPage, mainPage) {
  const before = await readState(mainPage);
  const fault = await testPage();
  await fault.addInitScript(() => {
    window.__qisuStorageWrites = 0;
    const get = IDBObjectStore.prototype.get;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      window.__qisuStorageWrites += 1;
      return put.apply(this, args);
    };
    IDBObjectStore.prototype.get = function (key) {
      const request = get.call(this, key);
      if (this.name === 'workspace' && key === 'state') {
        window.__qisuStorageFault = true;
        const tx = this.transaction;
        queueMicrotask(() => tx.abort()); // Read fails before any seed write.
      }
      return request;
    };
  });
  await fault.goto(appURL + '#home', { waitUntil: 'domcontentloaded' });
  await fault.locator('.boot p').filter({ hasText: /资料读取或保存失败|存储不可用|重新初始化/ }).waitFor();
  assert.equal(await fault.evaluate(() => window.__qisuStorageFault), true);
  assert.equal(await fault.evaluate(() => window.__qisuStorageWrites), 0, 'A failed read attempted to re-seed the database');
  assert.equal(await fault.locator('.app-shell').count(), 0);
  assert.deepEqual(await readState(mainPage), before, 'Read failure modified existing local records');
  await fault.screenshot({ path: 'test-results/pwa-storage-failure.png', fullPage: true });
  await fault.close();
}

async function nestedPathCase(testPage) {
  const nested = await testPage();
  const nestedBase = new URL('qisu-hub/', base);
  const served = [];
  const allowed = new Map([
    ['app.html', 'text/html; charset=utf-8'],
    ['manifest.webmanifest', 'application/manifest+json'],
    ['icons/icon-192.png', 'image/png'],
    ['icons/icon-512.png', 'image/png'],
    ['sw.js', 'text/javascript; charset=utf-8'],
  ]);
  await nested.route(nestedBase.href + '**', async route => {
    const relative = new URL(route.request().url()).pathname.slice(nestedBase.pathname.length);
    if (!allowed.has(relative)) return route.fulfill({ status: 404, body: 'Missing test fixture' });
    served.push(relative);
    return route.fulfill({ path: path.resolve('dist', relative), contentType: allowed.get(relative) });
  });
  // Browser service-worker script loaders do not use page.route. Stub only
  // registration to inspect the resolved script URL/scope without installing a
  // test worker on the user's origin. Actual installation is covered at root.
  await nested.addInitScript(() => {
    const registration = {
      scope: new URL('./', location.href).href,
      active: null,
      waiting: null,
      addEventListener() {},
    };
    Object.defineProperty(navigator.serviceWorker, 'register', {
      configurable: true,
      value: async (url, options) => {
        window.__qisuNestedWorker = { url: String(url), scope: options.scope };
        return registration;
      },
    });
    Object.defineProperty(navigator.serviceWorker, 'ready', { configurable: true, get: () => Promise.resolve(registration) });
  });
  await nested.goto(new URL('app.html#settings', nestedBase).href, { waitUntil: 'domcontentloaded' });
  await nested.waitForFunction(() => window.__qisushuoReady && !!window.__qisuNestedWorker, null, { timeout: 60000 });
  const result = await nested.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const url = new URL(link.getAttribute('href'), location.href);
    const manifest = await (await fetch(url)).json();
    const icons = await Promise.all(manifest.icons.map(async icon => {
      const iconURL = new URL(icon.src, url);
      const response = await fetch(iconURL);
      return { url: iconURL.href, status: response.status };
    }));
    return {
      local: window.__QISU_LOCAL__, manifestURL: url.href,
      startURL: new URL(manifest.start_url, url).href,
      scope: new URL(manifest.scope, url).href,
      worker: window.__qisuNestedWorker, icons,
    };
  });
  assert.equal(result.local, true);
  assert.equal(result.manifestURL, new URL('manifest.webmanifest', nestedBase).href);
  assert.equal(result.startURL, new URL('app.html', nestedBase).href);
  assert.equal(result.scope, nestedBase.href);
  assert.equal(result.worker.url, new URL('sw.js', nestedBase).href);
  assert.equal(new URL(result.worker.scope, new URL('app.html', nestedBase)).href, nestedBase.href);
  for (const icon of result.icons) assert(icon.url.startsWith(nestedBase.href) && icon.status === 200);
  await nested.screenshot({ path: 'test-results/pwa-nested-path.png', fullPage: true });
  await nested.close();
  return { ...result, served, limitation: 'Static nested routes are mocked; actual SW installation is verified at the managed root URL.' };
}

async function main() {
  const browser = await chromium.connectOverCDP(browserURL);
  const context = browser.contexts()[0];
  assert(context, 'The existing shared browser context is unavailable');
  const pages = [], clients = [];
  const errors = [], consoleErrors = [], badNetwork = [], apiRequests = [];
  const report = { startedAt: new Date().toISOString(), base: base.href, checks: [], errors, consoleErrors, badNetwork, apiRequests };
  let page, peer, cleaned = false;

  async function testPage() {
    const tab = await context.newPage();
    pages.push(tab);
    tab.setDefaultTimeout(15000);
    tab.setDefaultNavigationTimeout(120000);
    tab.on('pageerror', error => errors.push(error.message));
    tab.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    tab.on('request', request => {
      if (/\/api(?:\/|$)/.test(new URL(request.url()).pathname)) apiRequests.push(request.url());
    });
    tab.on('response', response => {
      if (response.status() >= 400) badNetwork.push({ url: response.url(), status: response.status() });
    });
    return tab;
  }

  try {
    page = await testPage();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await ready(page, 'settings');
    assert.equal(await page.evaluate(() => window.__QISU_LOCAL__), true, 'Release entry must explicitly select local storage');
    assert.match(await page.title(), /QISU HUB/);
    assert.match(await page.locator('.save-indicator').innerText(), /此设备|本机|本地/);
    report.checks.push('app.html explicitly uses local storage and QISU HUB branding');

    const install = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) throw new Error('Manifest link is missing');
      const manifestURL = new URL(link.getAttribute('href'), location.href).href;
      const response = await fetch(manifestURL);
      if (!response.ok) throw new Error('Manifest request failed: ' + response.status);
      const manifest = await response.json();
      const registration = await navigator.serviceWorker.ready;
      const icons = await Promise.all((manifest.icons || []).map(async icon => {
        const url = new URL(icon.src, manifestURL).href;
        const result = await fetch(url);
        return { ...icon, url, status: result.status, bytes: (await result.arrayBuffer()).byteLength };
      }));
      return {
        manifest, manifestURL, icons,
        startURL: new URL(manifest.start_url, manifestURL).href,
        scope: new URL(manifest.scope || '.', manifestURL).href,
        registrationScope: registration.scope,
        workerURL: registration.active && registration.active.scriptURL,
        secureContext: isSecureContext,
      };
    });
    assert.equal(install.secureContext, true, 'PWA installation requires HTTPS or localhost');
    assert.match(install.manifest.name, /耆宿说/);
    assert.match(install.manifest.name, /QISU HUB/);
    assert.equal(install.manifest.display, 'standalone');
    assert.equal(new URL(install.startURL).pathname, new URL(appURL).pathname);
    assert.equal(install.scope, base.href, 'Manifest must preserve nested deployment scope');
    assert.equal(install.registrationScope, base.href);
    assert.equal(install.workerURL, new URL('sw.js', base).href);
    for (const size of ['192x192', '512x512']) {
      const icon = install.icons.find(item => (item.sizes || '').split(' ').includes(size));
      assert(icon && icon.status === 200 && icon.bytes > 0, 'Install icon is unavailable: ' + size);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__qisushuoReady && !!navigator.serviceWorker.controller, null, { timeout: 60000 });
    report.install = install;
    report.checks.push('Manifest, 192/512 icons, app start URL, scoped active service worker');

    // Offline state applies to this test tab only, not the shared browser context.
    const network = await context.newCDPSession(page);
    clients.push(network);
    await network.send('Network.enable');
    await network.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__qisushuoReady === true, null, { timeout: 60000 });
    await navigate(page, 'create');
    await createDraft(page, testTitles[0], firstBody);
    let state = await readState(page);
    const created = state.records.find(row => row.title === testTitles[0]);
    assert(created && created.version === 1 && created.body === firstBody, 'Offline draft was not durably saved');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__qisushuoReady === true, null, { timeout: 60000 });
    await page.getByRole('heading', { name: testTitles[0], exact: true }).waitFor();
    await editDraft(page, testTitles[0]);
    assert.equal(await page.getByLabel('正文内容', { exact: true }).inputValue(), firstBody);
    await page.getByRole('button', { name: '取消', exact: true }).click();
    report.checks.push('Controlled offline reload, new draft save, offline reload and original body recovery');
    await network.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

    peer = await testPage();
    await peer.setViewportSize({ width: 1440, height: 1000 });
    await ready(peer, 'create');
    await editDraft(page, testTitles[0]);
    await editDraft(peer, testTitles[0]);
    await page.getByLabel('正文内容', { exact: true }).fill(winnerBody);
    await peer.getByLabel('正文内容', { exact: true }).fill(staleBody);
    await page.bringToFront();
    await page.getByRole('button', { name: '保存记录', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await peer.bringToFront();
    await peer.getByRole('button', { name: '保存记录', exact: true }).click();
    await peer.getByRole('alert').filter({ hasText: /其他窗口|其他设备|版本|冲突/ }).waitFor();
    assert.equal(await peer.getByLabel('正文内容', { exact: true }).inputValue(), staleBody, 'Conflict must keep the unsaved editor body');
    state = await readState(page);
    const winner = state.records.find(row => row.id === created.id);
    assert.equal(winner.body, winnerBody, 'A stale window overwrote the latest saved version');
    assert.equal(winner.version, 2);
    assert.deepEqual(state.revisions.filter(row => row.id === created.id).map(row => row.version).sort(), [1, 2]);
    report.checks.push('Two-window stale edit is rejected; saved data and unsaved editor text are preserved');

    await peer.getByRole('button', { name: '取消', exact: true }).click();
    await peer.locator('.discard-overlay').getByRole('button', { name: '放弃修改', exact: true }).click();
    await peer.getByRole('dialog').waitFor({ state: 'hidden' });
    await createDraft(peer, testTitles[1], '另一个已打开窗口新增的稿件。');
    await navigate(page, 'settings');
    await page.evaluate(() => {
      const create = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        if (blob instanceof Blob && blob.type === 'application/json') window.__qisuPwaBackupText = blob.text();
        return create.call(URL, blob);
      };
    });
    const backupDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出备份', exact: true }).click();
    const backup = await downloadJSON(await backupDownload, page);
    assert.equal(backup.format, 'qisushuo-backup');
    assert.equal(backup.schema, 1);
    for (const title of testTitles) assert(backup.records.some(row => row.title === title), 'Full backup omitted another window record: ' + title);
    assert.deepEqual(backup.revisions.filter(row => row.id === created.id).map(row => row.version).sort(), [1, 2]);
    assert.equal(backup.records.find(row => row.id === created.id).body, winnerBody);
    report.checks.push('Backup keeps legacy format and includes newest records and full history from both windows');

    // Test the normal mobile navigation, long-content pages and a live editor.
    const widths = [1440, 390, 360];
    const routes = ['home', 'library', 'experts', 'graph', 'assistant', 'evidence', 'create', 'projects', 'settings', 'trash'];
    report.layout = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const route of routes) {
        if (new URL(page.url()).hash !== '#' + route) await navigate(page, route);
        const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, heading: document.querySelector('main h1')?.textContent.trim() }));
        assert(layout.heading, 'Missing main heading at ' + width + '/' + route);
        assert(layout.scroll <= layout.width + 1, 'Horizontal overflow at ' + width + '/' + route + ': ' + JSON.stringify(layout));
        report.layout.push({ width, route, overflow: false });
      }
      if (width < 600) {
        await page.getByRole('navigation', { name: '手机导航' }).getByRole('button', { name: '更多', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: '空间设置', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await page.locator('main h1').waitFor();
      }
    }
    await navigate(page, 'create');
    await editDraft(page, testTitles[0]);
    const titleInput = page.getByLabel('记录标题', { exact: true });
    await titleInput.press('End');
    await titleInput.pressSequentially('手机输入', { delay: 30 });
    assert.equal(await titleInput.inputValue(), testTitles[0] + '手机输入');
    assert.equal(await titleInput.evaluate(element => element === document.activeElement), true);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile editor has horizontal overflow');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('.discard-overlay').getByRole('button', { name: '放弃修改', exact: true }).click();
    report.checks.push('Ten page families at 1440/390/360px, mobile More navigation and focused continuous typing');

    fs.mkdirSync('test-results', { recursive: true });
    await navigate(page, 'settings');
    await page.screenshot({ path: 'test-results/pwa-mobile-settings.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: 'test-results/pwa-desktop-settings.png', fullPage: true });
    await storageFailureCase(testPage, page);
    report.checks.push('Injected IndexedDB request failure shows recovery UI and makes zero seed writes; original data remains unchanged');
    report.nested = await nestedPathCase(testPage);
    report.checks.push('Mocked /qisu-hub/ deployment resolves app, manifest, icons and SW registration within its own directory');

    assert.deepEqual(apiRequests, [], 'Local release must not request backend APIs');
    assert.deepEqual(errors, [], 'Unhandled browser errors');
    assert.deepEqual(consoleErrors, [], 'Browser console errors');
    assert.deepEqual(badNetwork, [], 'HTTP error responses');
    report.checks.push('No API requests, unhandled errors, console errors or failed HTTP responses');
    cleaned = await removeTestRecords(page);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.failure = error.stack || String(error);
    throw error;
  } finally {
    for (const client of clients) {
      try { await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); } catch { /* Tab may already be closed. */ }
    }
    if (!cleaned && page && !page.isClosed()) {
      try { cleaned = await removeTestRecords(page); } catch (error) { report.cleanupError = error.message; }
    }
    report.cleanedTestRecords = cleaned;
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    for (const tab of pages.reverse()) if (!tab.isClosed()) await tab.close({ runBeforeUnload: false });
    await browser.close(); // Disconnect only; keep the shared browser running.
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
