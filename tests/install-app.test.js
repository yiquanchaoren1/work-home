import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);

test('the app manifest and PNG icons can install at a Pages repository subpath',async()=>{
  const manifest=JSON.parse(await fs.readFile(new URL('manifest.webmanifest',root),'utf8'));
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.prefer_related_applications,false);
  assert.ok(manifest.name && manifest.short_name);
  for(const prefix of ['https://example.org/','https://example.org/work-home/']) {
    const url=new URL('manifest.webmanifest',prefix);
    assert.equal(new URL(manifest.start_url,url).href,prefix);
    assert.equal(new URL(manifest.scope,url).href,prefix);
    assert.equal(new URL(manifest.id,url).href,prefix);
    for(const icon of manifest.icons) assert.ok(new URL(icon.src,url).href.startsWith(prefix+'icons/'));
  }
  for(const size of ['192x192','512x512'])assert.ok(manifest.icons.some(icon=>icon.sizes===size&&icon.purpose==='any'));
  assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
  for(const icon of [...manifest.icons,{src:'./icons/apple-touch-icon.png',sizes:'180x180'}]) {
    const bytes=await fs.readFile(new URL(icon.src,root));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const [width,height]=icon.sizes.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16),width);
    assert.equal(bytes.readUInt32BE(20),height);
  }
});
