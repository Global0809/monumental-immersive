import { test } from 'node:test';
import assert from 'node:assert/strict';
import { savedConstellations } from '../src/services/personalConstellation';
import { places, videos } from '../src/data/catalogue';
test('constellation only includes saved stories, once, under documented destinations',()=>{
 const sample=videos.filter(v=>v.places.length).slice(0,5), ids=sample.map(v=>v.id);
 const groups=savedConstellations([...ids,ids[0],'missing-film'],[]);
 assert.deepEqual(groups.flatMap(g=>g.films.map(v=>v.id)).sort(),[...ids].sort());
 for(const group of groups)for(const film of group.films)assert.equal(group.id,places.find(p=>p.id===film.places[0])?.id||'collection');
 assert.ok(groups.every(g=>!g.savedPlace));
});
test('a saved empty destination remains an honest empty collection',()=>{
 const result=savedConstellations([],[places[0].id,'missing-place']);
 assert.equal(result.length,1);assert.equal(result[0].id,places[0].id);assert.equal(result[0].films.length,0);assert.equal(result[0].savedPlace,true);
});
