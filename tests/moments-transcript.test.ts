import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getViewer, updateViewer, saveMoment, removeMoment, restoreMoment } from '../src/services/viewer.ts';
import { clampMomentTime, parseTranscript, momentTime } from '../src/services/transcript.ts';

test('existing guest records retain saves and get an empty moment collection', () => {
  const result = updateViewer({ saved: ['miami-frequency'], moments: undefined });
  assert.deepEqual(result.saved,['miami-frequency']);
  assert.deepEqual(result.moments,[]);
});
test('a captured second is idempotent while its note can be edited', () => {
  updateViewer({ moments: [] });
  const first=saveMoment('miami-frequency',12.6,'  A connection  ')!;
  const edit=saveMoment('miami-frequency',12.9,'Another thought')!;
  assert.equal(first.id,edit.id);
  assert.equal(edit.time,12);
  assert.equal(getViewer().moments.length,1);
  assert.equal(getViewer().moments[0].note,'Another thought');
  assert.equal(saveMoment('miami-frequency',NaN),null);
  assert.equal(saveMoment('miami-frequency',-1),null);
  removeMoment(first.id);
  assert.equal(getViewer().moments.length,0);
});
test('malformed moment data cannot create unsafe seek positions or oversized notes', () => {
  const result=updateViewer({moments:[
    {id:'a',videoId:'film',time:7,note:'x'.repeat(300),createdAt:1},
    {id:'a',videoId:'film',time:7,note:'duplicate',createdAt:2},
    {id:'b',videoId:'film',time:Infinity,note:'bad',createdAt:3},
    {id:'c',videoId:'film',time:-2,note:'bad',createdAt:4},
  ]});
  assert.equal(result.moments.length,1);
  assert.equal(result.moments[0].note.length,180);
});
test('the supplied Miami captions parse to measured, ordered transcript cues', () => {
  const cues=parseTranscript(readFileSync(new URL('../public/captions/miami-frequency.vtt',import.meta.url),'utf8'));
  assert.equal(cues.length,5);
  assert.equal(cues[1].start,1);
  assert.equal(cues[4].end,30.278);
  assert.match(cues[2].text,/Miami/);
});
test('WebVTT notes, settings and markup are handled without HTML rendering', () => {
  const cues=parseTranscript('WEBVTT\n\nNOTE a comment\nnot a cue\n\ncue-1\n00:12.000 --> 00:15.000 align:start\n<v Narrator>A <b>line</b> &amp; thought.</v>\n\n00:20.000 --> 00:19.000\nbad duration');
  assert.deepEqual(cues,[{start:12,end:15,text:'A line & thought.'}]);
  assert.equal(momentTime(3661.8),'1:01:01');
  assert.equal(momentTime(NaN),'0:00');
});

test('captures include zero and stay within integer and fractional media endings', () => {
  assert.equal(clampMomentTime(0,32.128),0);
  assert.equal(clampMomentTime(32,32),31);
  assert.equal(clampMomentTime(32.128,32.128),32);
  assert.equal(clampMomentTime(1000,32.128),32);
  assert.equal(clampMomentTime(.2,.25),0);
  assert.equal(clampMomentTime(NaN,32),null);
  assert.equal(clampMomentTime(2,Infinity),null);
  assert.equal(clampMomentTime(2,0),null);
});

test('storage normalizes fractional duplicates and rejects empty identities', () => {
  const result=updateViewer({moments:[
    {id:'valid',videoId:'film',time:7.8,note:'First thought',createdAt:-5},
    {id:'other',videoId:'film',time:7.1,note:'Duplicate second',createdAt:2},
    {id:'',videoId:'film',time:2,note:'Empty identifier',createdAt:3},
    {id:'empty-film',videoId:'  ',time:2,note:'Empty film',createdAt:3},
  ]});
  assert.equal(result.moments.length,1);
  assert.equal(result.moments[0].time,7);
  assert.equal(result.moments[0].createdAt,0);
  assert.equal(saveMoment('film',7.9,'Edited')?.id,'valid');
  assert.equal(getViewer().moments.length,1);
});

test('undo restores a deletion but does not overwrite a newer note at the same second', () => {
  updateViewer({moments:[]});
  const original=saveMoment('film',0,'Opening')!;
  removeMoment(original.id); assert.equal(restoreMoment(original),true);
  assert.equal(restoreMoment(original),false);
  removeMoment(original.id); const newer=saveMoment('film',0,'A newer thought')!;
  assert.equal(restoreMoment(original),false);
  assert.equal(getViewer().moments.length,1);
  assert.equal(getViewer().moments[0].id,newer.id);
  assert.equal(getViewer().moments[0].note,'A newer thought');
});

test('moment collection remains bounded while preserving independent timestamps', () => {
  const result=updateViewer({moments:Array.from({length:350},(_,index)=>({id:`bounded-${index}`,videoId:'film',time:index,note:'',createdAt:index}))});
  assert.equal(result.moments.length,300);
  assert.equal(result.moments[0].time,50);
  assert.equal(result.moments.at(-1)?.time,349);
});

test('transcript parsing rejects malformed timestamps and decodes plain text entities once', () => {
  const cues=parseTranscript('WEBVTT\n\n00:61.000 --> 01:05.000\ninvalid seconds\n\n00:01.000 --> 00:02.000\n&#x1F30E; &quot;Culture&quot; &amp;lt;b&amp;gt;\n\n:: --> 00:03.000\ninvalid empty time\n\n00:00.0000 --> 00:01.000\ninvalid precision');
  assert.deepEqual(cues,[{start:1,end:2,text:'🌎 "Culture" &lt;b&gt;'}]);
});
