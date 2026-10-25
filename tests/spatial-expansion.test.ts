import test from 'node:test';
import assert from 'node:assert/strict';
import { videos } from '../src/data/catalogue';
import { bridgeStories, collectionPrint, connectionReason, decodeItinerary, encodeItinerary, escapeSvg, playableStories } from '../src/services/spatialDiscovery';
import { qualityRatio, validateSpatialPreferences } from '../src/services/spatialPreferences';

test('shared itineraries include only unique playable IDs, retain order and bound titles',()=>{
  const valid=playableStories().slice(0,3).map(v=>v.id);
  const encoded=encodeItinerary('A'.repeat(300),[valid[2],valid[0],valid[2],'missing',videos.find(v=>v.status==='development')!.id]);
  const decoded=decodeItinerary(new URLSearchParams(encoded));
  assert.deepEqual(decoded?.videoIds,[valid[2],valid[0]]);assert.equal(decoded?.name.length,80);
  assert.equal(decodeItinerary(new URLSearchParams({stops:'unknown'})),null);
  assert.equal(decodeItinerary(new URLSearchParams({stops:'x'.repeat(2001)})),null);
});
test('destination bridges are supported by available catalogue relationships and cannot connect a place to itself',()=>{
  assert.deepEqual(bridgeStories('miami','miami'),[]);
  const bridges=bridgeStories('miami','puerto-rico');assert.ok(bridges.length);
  for(const {a,b,reason} of bridges){assert.ok(a.places.includes('miami'));assert.ok(b.places.includes('puerto-rico'));assert.equal(reason,connectionReason(a,b));assert.ok(playableStories().includes(a));assert.ok(playableStories().includes(b));}
  assert.deepEqual(bridgeStories('not-a-place','london'),[]);
});
test('collection export contains bounded story titles and no private notes or media sources',()=>{
  const svg=collectionPrint(videos.map(v=>v.id));assert.ok(svg.startsWith('<svg'));
  assert.equal((svg.match(/<path /g)||[]).length,12);
  assert.equal(svg.includes('.mp4'),false);assert.equal(svg.includes('javascript:'),false);
  assert.equal(escapeSvg('<script>"&\''),'&lt;script&gt;&quot;&amp;&apos;');
});
test('scene settings cannot produce unbounded resolution or invalid renderer values',()=>{
  const prefs=validateSpatialPreferences({view:'unknown',light:Infinity,quality:'ultra',pinned:['world','unknown','world'],cutaway:1});
  assert.deepEqual(prefs,{view:'gallery',light:55,quality:'balanced',pinned:['world'],cutaway:false});
  assert.equal(validateSpatialPreferences({light:-200}).light,15);
  assert.equal(validateSpatialPreferences({light:200}).light,100);
  assert.ok(qualityRatio('light',false)<qualityRatio('balanced',false));
  assert.ok(qualityRatio('detail',false)<=1.75);
});
