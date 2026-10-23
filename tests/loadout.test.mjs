import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeLoadout, decodeLoadout, revision, installationIssues} from '../data/loadout.mjs';
import worker from '../worker/index.mjs';
const build = {major:13, ids:['dice-calculator','quick-insert']};
const request = async (value=build, rev, file='module.json') => worker.fetch(new Request(`https://installer.example/install/${encodeLoadout(value)}/${rev ?? await revision(value)}/${file}`));
test('shared builds validate IDs, deduplicate and preserve major', () => {
  assert.deepEqual(decodeLoadout(encodeLoadout({...build,ids:[...build.ids,'quick-insert']})),build);
  for (const value of [{major:12,ids:[]},{major:13,ids:['https://evil.example']},{major:13,ids:[{}]}]) assert.throws(()=>encodeLoadout(value));
  assert.throws(()=>decodeLoadout('!'));
});
test('installer emits version-specific dependencies and rejects stale links', async () => {
  const response = await request(); assert.equal(response.status,200);
  const manifest = await response.json();
  assert.deepEqual(manifest.compatibility,{minimum:'13',maximum:'13'});
  assert.equal(manifest.relationships.requires.length,2);
  assert.ok(manifest.relationships.requires.every(x=>x.manifest.startsWith('https://') && x.compatibility.minimum === x.compatibility.maximum));
  assert.equal((await request(build,'0'.repeat(24))).status,409);
  const zip = await request(build,await revision(build),'module.zip');
  assert.equal(zip.headers.get('content-type'),'application/zip');
  const bytes = new Uint8Array(await zip.arrayBuffer());
  assert.deepEqual([...bytes.slice(0,4)],[80,75,3,4]);
  assert.equal(JSON.parse(new TextDecoder().decode(bytes.slice(41,41+new DataView(bytes.buffer).getUint32(18,true)))).manifest,manifest.manifest);
});
test('installer refuses premium, missing versions and empty builds',async()=>{
  for (const value of [{major:13,ids:['jb2a_patreon']},{major:13,ids:['classic-facing']},{major:14,ids:[]}]) {
    assert.ok(installationIssues(value).length); assert.equal((await request(value)).status,422);
  }
});
