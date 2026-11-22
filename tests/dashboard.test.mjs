import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// Exercise the distributable without network access or a server.
async function openDashboard(hash = '') {
  const html = await readFile('DevLens-AI.html', 'utf8');
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const events = {};
  const windowEvents = {};
  const documentEvents = {};
  const location = {hash};
  const classes = new Set();
  let focus = '';
  const root = {
    dataset: {},
    addEventListener: (name, callback) => { events[name] = callback; },
    querySelector: selector => ({
      setAttribute() {},
      focus() { focus = selector; },
    }),
  };
  const context = {
    location,
    document: {
      querySelector: () => root,
      addEventListener: (name, callback) => { documentEvents[name] = callback; },
      body: { classList: { contains: key => classes.has(key), remove: key => classes.delete(key) } },
    },
    window: {
      scrollTo() {},
      addEventListener: (name, callback) => { windowEvents[name] = callback; },
    },
  };
  vm.runInNewContext(script, context);
  await new Promise(resolve => setImmediate(resolve));
  return {
    root, location, windowEvents, documentEvents, getFocus: () => focus,
    click(dataset) {
      events.click({target:{closest:()=>({dataset,hasAttribute:()=>false})}});
    },
  };
}

test('offline overview renders sourced metrics and interactive period controls', async () => {
  const app = await openDashboard();
  assert.match(app.root.innerHTML, /Saved snapshot/);
  assert.match(app.root.innerHTML, /252.9K/);
  app.click({days:'7'});
  assert.match(app.root.innerHTML, /data-days="7" aria-pressed="true"/);
  assert.equal((app.root.innerHTML.match(/class="sample-point"/g) || []).length, 7);
});

test('developer deep link contains the portrait and every section is navigable', async () => {
  const app = await openDashboard('#person');
  assert.match(app.root.innerHTML, /class="developer panel"><img src="data:image\/jpeg;base64,/);
  for (const view of ['folder','book','spark','insight','activity','overview']) {
    app.click({view});
    assert.equal(app.location.hash, view);
    assert.ok(app.root.innerHTML.includes('aria-current="page"'));
  }
  app.location.hash = '#person';
  app.windowEvents.hashchange();
  assert.match(app.root.innerHTML, /class="developer panel"/);
});

test('keyboard shortcut returns to the analyzer and focuses its input', async () => {
  const app = await openDashboard('#activity');
  let prevented = false;
  app.documentEvents.keydown({key:'/',target:{closest:()=>null},preventDefault(){prevented=true}});
  assert.equal(prevented,true);
  assert.equal(app.getFocus(),'#repo');
});
