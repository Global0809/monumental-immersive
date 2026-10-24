import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { places, videos, type Place, type Video } from '../data/catalogue';
import { useViewer, usePersistentStorage, type Journey } from '../services/viewer';
import { href } from '../services/router';
import { playSound } from '../services/audio';
import { createFrameCadence } from '../services/frameCadence';
import './personal-monument.css';

type Arrangement = 'orbit' | 'column' | 'unfolded';
type Preferences = { arrangement: Arrangement; spacing: number };
type Part = { key: string; kind: 'place' | 'film' | 'journey'; title: string; place?: Place; film?: Video; journey?: Journey; films: Video[] };
type SceneActions = { rotate: (amount: number) => void; reset: () => void; redraw: () => void };
const PREF_KEY = 'monumental.personal-monument.v1';
const DEFAULTS: Preferences = { arrangement: 'orbit', spacing: 50 };

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    return { arrangement: ['orbit', 'column', 'unfolded'].includes(stored?.arrangement) ? stored.arrangement : 'orbit', spacing: typeof stored?.spacing === 'number' && Number.isFinite(stored.spacing) ? Math.max(0, Math.min(100, stored.spacing)) : 50 };
  } catch { return DEFAULTS; }
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return 'Duration to come';
  const wholeSeconds = Math.round(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

export default function PersonalMonument({ onWatch, reducedMotion = false }: { onWatch: (video: Video) => void; reducedMotion?: boolean }) {
  const viewer = useViewer();
  const persistentStorage = usePersistentStorage();
  const headingId = useId();
  const instructionsId = useId();
  const detailId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const actions = useRef<SceneActions | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [preferencesStored, setPreferencesStored] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
  const [filter, setFilter] = useState<'all' | Part['kind']>('all');
  const [paused, setPaused] = useState(false);
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const state = useRef({ preferences, selectedKey, paused, reducedMotion, visible: false });
  state.current = { ...state.current, preferences, selectedKey, paused, reducedMotion };

  const parts = useMemo<Part[]>(() => [
    ...places.filter(place => viewer.savedPlaces.includes(place.id)).map(place => ({ key: `place:${place.id}`, kind: 'place' as const, title: place.name, place, films: videos.filter(video => video.places.includes(place.id)) })),
    ...videos.filter(film => viewer.saved.includes(film.id)).map(film => ({ key: `film:${film.id}`, kind: 'film' as const, title: film.title, film, films: [film] })),
    ...viewer.journeys.map(journey => ({ key: `journey:${journey.id}`, kind: 'journey' as const, title: journey.name, journey, films: journey.videoIds.map(id => videos.find(video => video.id === id)).filter((video): video is Video => Boolean(video)) })).filter(part => part.films.length > 0),
  ], [viewer.savedPlaces, viewer.saved, viewer.journeys]);
  const selected = parts.find(part => part.key === selectedKey) || parts[0];
  const selectedRef = useRef(selected?.key);
  selectedRef.current = selected?.key;
  const chooseRef = useRef<(key: string) => void>(() => {});
  chooseRef.current = key => { setSelectedKey(key); setResetMessage(''); playSound('select'); };
  const counts = { place: parts.filter(part => part.kind === 'place').length, film: parts.filter(part => part.kind === 'film').length, journey: parts.filter(part => part.kind === 'journey').length };
  const visibleParts = filter === 'all' ? parts : parts.filter(part => part.kind === filter);

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(preferences)); setPreferencesStored(true); }
    catch { setPreferencesStored(false); }
    actions.current?.redraw();
  }, [preferences]);
  useEffect(() => { actions.current?.redraw(); }, [selectedKey, paused, reducedMotion]);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      state.current.visible = entry.isIntersecting;
      if (entry.isIntersecting) { setEntered(true); actions.current?.redraw(); }
    }, { rootMargin: '100px', threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [parts.length > 0]);

  useEffect(() => {
    const element = surface.current;
    if (!entered || !element || !parts.length) return;
    const host = element;
    let disposed = false;
    let cleanup = () => {};
    setReady(false); setFallback(false);
    void (async () => {
      const [THREE, { RoomEnvironment }, { attachXray }] = await Promise.all([import('three'), import('three/addons/environments/RoomEnvironment.js'), import('../services/xrayMaterial')]);
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
      catch { setFallback(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      renderer.setClearColor(0x080909, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      element.prepend(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(39, 1, .1, 50);
      camera.position.set(0, .25, 8.1);
      const room = new RoomEnvironment();
      const generator = new THREE.PMREMGenerator(renderer);
      const environment = generator.fromScene(room, .05);
      scene.environment = environment.texture;
      room.dispose(); generator.dispose();
      const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dddc, metalness: 1, roughness: .17 });
      const red = new THREE.MeshStandardMaterial({ color: 0xff4d32, metalness: .55, roughness: .24, emissive: 0x6b0b03, emissiveIntensity: .35 });
      const thread = new THREE.MeshStandardMaterial({ color: 0xb0b6b3, metalness: .85, roughness: .3 });
      const activeMaterial = new THREE.MeshStandardMaterial({ color: 0xff4d32, metalness: .68, roughness: .15, emissive: 0x6b0b03, emissiveIntensity: .45 });
      const group = new THREE.Group();
      group.rotation.set(.12, -.38, -.08);
      scene.add(group);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x252525, 1.8));
      const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(2, 4, 5); scene.add(light);
      const accentLight = new THREE.PointLight(0xff4d32, 5, 12); accentLight.position.set(-3, -1, 2); scene.add(accentLight);
      const geometries: import('three').BufferGeometry[] = [];
      type RenderPart = { part: Part; mesh: InstanceType<typeof THREE.Mesh>; index: number; kindIndex: number };
      const meshes: RenderPart[] = [];
      const kindCounts = { place: 0, film: 0, journey: 0 };
      // Broad, slightly twisting metal surfaces; each is one saved film.
      function bandGeometry(index: number) {
        const positions: number[] = [], indices: number[] = [];
        const segments = 88, radius = 1.05 + (index % 5) * .11;
        for (let i = 0; i <= segments; i++) {
          const t = (i / segments) * Math.PI * 1.67;
          for (let side = 0; side < 4; side++) {
            const r = radius + (side < 2 ? -.018 : .018);
            const width = side === 0 || side === 3 ? -.095 : .095;
            positions.push(Math.cos(t) * r, Math.sin(t * 2 + index * .7) * .22 + width, Math.sin(t) * r);
          }
          if (i < segments) for (let side = 0; side < 4; side++) {
            const a = i * 4 + side, b = i * 4 + (side + 1) % 4;
            indices.push(a, b, a + 4, b, b + 4, a + 4);
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices); geometry.computeVertexNormals();
        return geometry;
      }
      for (const [index, part] of parts.entries()) {
        const kindIndex = kindCounts[part.kind]++;
        let geometry: import('three').BufferGeometry;
        if (part.kind === 'place') geometry = new THREE.IcosahedronGeometry(.19, 2);
        else if (part.kind === 'film') geometry = bandGeometry(kindIndex);
        else {
          // A continuous ordered loop: one waypoint per actual story in this saved journey.
          const points = part.films.map((film, i) => {
            const placeIndex = places.findIndex(place => film.places.includes(place.id));
            const angle = i / part.films.length * Math.PI * 2;
            return new THREE.Vector3(Math.cos(angle) * (1.42 + kindIndex % 3 * .08), (placeIndex < 0 ? 0 : placeIndex / places.length - .5) * .9, Math.sin(angle) * 1.42);
          });
          // A one-film journey has a loop of its own, never an invented connection to another film.
          if (points.length < 3) for (let i = points.length; i < 3; i++) points.push(new THREE.Vector3(Math.cos(i / 3 * Math.PI * 2) * 1.42, 0, Math.sin(i / 3 * Math.PI * 2) * 1.42));
          geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 64, .018, 5, true);
        }
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, part.kind === 'place' ? red : part.kind === 'film' ? chrome : thread);
        mesh.userData.key = part.key;
        group.add(mesh); meshes.push({ part, mesh, index, kindIndex });
      }
      let frame = 0, lastTime = 0, width = 1, height = 1, dirty = true, contextLost = false;
      let playingFilm = Boolean(document.querySelector('.ms-player-dialog[open]'));
      let targetX = .12, targetY = -.38;
      let dragging = false, moved = false, startX = 0, startY = 0, lastX = 0, lastY = 0;
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const target = new THREE.Vector3();
      const objectMeshes = meshes.map(item => item.mesh);
      const xray = attachXray(renderer, [chrome, red, thread, activeMaterial], objectMeshes);
      const canRender = () => !disposed && !contextLost && !document.hidden && !playingFilm && state.current.visible;
      const cadence = createFrameCadence();
      function render(time: number) {
        frame = 0;
        if (!canRender()) return;
        if (!cadence.ready(time)) { frame = requestAnimationFrame(render); return; }
        const dt = Math.min((time - lastTime) / 1000 || 0, .04); lastTime = time;
        const { preferences: prefs, paused: stopped, reducedMotion: reduced } = state.current;
        const moving = !stopped && !reduced && !dragging;
        if (moving) targetY += dt * .09;
        const blend = reduced ? 1 : 1 - Math.exp(-dt * 11);
        group.rotation.x += (targetX - group.rotation.x) * blend;
        group.rotation.y += (targetY - group.rotation.y) * blend;
        const spread = .65 + prefs.spacing / 100 * .75;
        group.scale.setScalar(prefs.arrangement === 'unfolded' ? Math.min(1, 4.2 / (Math.ceil(parts.length / 4) * .65 * spread)) : 1);
        let settling = Math.abs(targetY - group.rotation.y) + Math.abs(targetX - group.rotation.x) > .002;
        for (const { mesh, part, index, kindIndex } of meshes) {
          const count = Math.max(1, kindCounts[part.kind]);
          const fraction = count === 1 ? 0 : kindIndex / (count - 1) - .5;
          const angle = kindIndex / count * Math.PI * 2 + .5;
          const selectedPart = part.key === selectedRef.current;
          if (prefs.arrangement === 'column') target.set(part.kind === 'place' ? Math.cos(angle) * 1.6 : 0, fraction * 2.5 * spread, part.kind === 'place' ? Math.sin(angle) * 1.2 : 0);
          else if (prefs.arrangement === 'unfolded') target.set((index % 4 - 1.5) * .72 * spread, (Math.floor(index / 4) - (Math.ceil(parts.length / 4) - 1) / 2) * .65 * spread, part.kind === 'place' ? .2 : -.3);
          else target.set(part.kind === 'place' ? Math.cos(angle) * 1.72 * spread : 0, part.kind === 'place' ? Math.sin(angle) * .95 * spread : fraction * 1.5 * spread, part.kind === 'place' ? Math.sin(angle * 2) * .65 : 0);
          if (selectedPart) target.z += .18;
          settling ||= mesh.position.distanceToSquared(target) > .0001;
          mesh.position.lerp(target, blend);
          const scale = prefs.arrangement === 'unfolded' && part.kind !== 'place' ? .27 : 1;
          mesh.scale.setScalar(scale);
          if (part.kind !== 'place') mesh.rotation.set(part.kind === 'journey' ? .5 + kindIndex * .16 : .15, kindIndex * .73, prefs.arrangement === 'column' ? .05 : fraction * .75);
          mesh.material = selectedPart ? activeMaterial : part.kind === 'place' ? red : part.kind === 'film' ? chrome : thread;
        }
        if (dirty || moving || settling) { xray.update(!reduced); renderer.render(scene, camera); dirty = false; }
        if (moving || settling) frame = requestAnimationFrame(render);
      }
      function redraw() { dirty = true; if (!frame && canRender()) { cadence.reset(); lastTime = performance.now() - 16; frame = requestAnimationFrame(render); } }
      function resize() {
        width = host.clientWidth; height = host.clientHeight;
        renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height);
        camera.position.z = width < 420 ? 9.8 : 8.1;
        camera.updateProjectionMatrix(); redraw();
      }
      function pick(x: number, y: number) {
        const bounds = host.getBoundingClientRect();
        pointer.set((x - bounds.left) / width * 2 - 1, -((y - bounds.top) / height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObjects(objectMeshes, false)[0]?.object.userData.key as string | undefined;
      }
      function down(event: PointerEvent) {
        if (event.button !== 0) return;
        dragging = true; moved = false; startX = lastX = event.clientX; startY = lastY = event.clientY;
        renderer.domElement.setPointerCapture(event.pointerId);
      }
      function move(event: PointerEvent) {
        if (!dragging) return;
        moved ||= Math.hypot(event.clientX - startX, event.clientY - startY) > 7;
        targetY += (event.clientX - lastX) * .008;
        targetX = Math.max(-.75, Math.min(.75, targetX + (event.clientY - lastY) * .004));
        lastX = event.clientX; lastY = event.clientY; redraw();
      }
      function up(event: PointerEvent) {
        if (!dragging) return;
        dragging = false;
        if (!moved && event.type !== 'pointercancel') { const key = pick(event.clientX, event.clientY); if (key) chooseRef.current(key); }
        if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
        redraw();
      }
      function visibility() { if (!canRender()) { cancelAnimationFrame(frame); frame = 0; } else redraw(); }
      function playback(event: Event) { playingFilm = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active); visibility(); }
      // Pausing the sculpture still allows a pointer scan, using its existing frame.
      function scanRedraw() { if (state.current.visible && state.current.paused && !state.current.reducedMotion) redraw(); }
      function lost(event: Event) { event.preventDefault(); contextLost = true; setFallback(true); cancelAnimationFrame(frame); frame = 0; }
      const resizer = new ResizeObserver(resize); resizer.observe(element);
      renderer.domElement.addEventListener('pointerdown', down);
      renderer.domElement.addEventListener('pointermove', move);
      renderer.domElement.addEventListener('pointerup', up);
      renderer.domElement.addEventListener('pointercancel', up);
      renderer.domElement.addEventListener('webglcontextlost', lost);
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('monumental:playback', playback);
      window.addEventListener('pointermove', scanRedraw, { passive: true });
      window.addEventListener('pointerout', scanRedraw, { passive: true });
      actions.current = { rotate: amount => { targetY += amount; redraw(); }, reset: () => { targetX = .12; targetY = -.38; redraw(); }, redraw };
      resize(); setReady(true);
      cleanup = () => {
        cancelAnimationFrame(frame); resizer.disconnect(); document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('monumental:playback', playback);
        window.removeEventListener('pointermove', scanRedraw); window.removeEventListener('pointerout', scanRedraw); xray.dispose();
        renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move);
        renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', up); renderer.domElement.removeEventListener('webglcontextlost', lost);
        geometries.forEach(geometry => geometry.dispose()); [chrome, red, thread, activeMaterial].forEach(material => material.dispose());
        environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); actions.current = null;
      };
    })().catch(() => { if (!disposed) setFallback(true); });
    return () => { disposed = true; cleanup(); };
  }, [entered, parts]);

  function reset() {
    setPreferences(DEFAULTS); setPaused(false); actions.current?.reset();
    setResetMessage('Arrangement reset. Your saved films, places and journeys are unchanged.');
    playSound('select');
  }
  function pickPart(part: Part) { chooseRef.current(part.key); }
  const typeLabel = { place: 'Destination anchor', film: 'Film segment', journey: 'Journey thread' };

  return <section className="personal-monument" aria-labelledby={headingId}>
    <div className="personal-monument__intro"><h2 id={headingId}>A FORM<br/>OF YOUR OWN.</h2><p>A sculpture made from what you collect. Every piece leads back to a place, a film or a journey you chose.</p></div>
    {!parts.length ? <div className="personal-monument__empty"><div className="personal-monument__empty-form" aria-hidden="true"><span/><span/><span/></div><div><h3>Your first story gives it shape.</h3><p>Save a film to add a chrome segment. Collect a destination to place an anchor. Save a journey to connect them.</p><a className="button button-light" href={href('/search')}>Find a story <ArrowUpRight/></a><a className="text-link" href={href('/world')}>Collect a place <ArrowUpRight size={16}/></a></div></div> : <>
      <div className="personal-monument__body">
        <div className="personal-monument__workshop">
          <div ref={surface} className={`personal-monument__scene ${ready && !fallback ? 'is-ready' : ''}`} tabIndex={0} role="group" aria-label="Your interactive collection sculpture" aria-describedby={instructionsId} onKeyDown={event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); actions.current?.rotate(event.key === 'ArrowLeft' ? -.32 : .32); }
            if (event.key === 'Home') { event.preventDefault(); actions.current?.reset(); }
          }}>
            {(!ready || fallback) && <div className="personal-monument__render-message">{fallback ? 'The readable collection below is your sculpture map. 3D is unavailable in this browser.' : 'Shaping your collection…'}</div>}
            <div className="personal-monument__legend" aria-hidden="true"><span><i className="is-anchor"/>{counts.place} {counts.place === 1 ? 'anchor' : 'anchors'}</span><span><i className="is-segment"/>{counts.film} {counts.film === 1 ? 'segment' : 'segments'}</span><span><i className="is-thread"/>{counts.journey} {counts.journey === 1 ? 'thread' : 'threads'}</span></div>
          </div>
          <div className="personal-monument__toolbar"><p id={instructionsId}>Drag to rotate. Select a piece.<br/>Arrow keys rotate; Home resets the view. The list below selects every piece.</p><div><button aria-label="Rotate sculpture left" onClick={() => actions.current?.rotate(-.38)} disabled={fallback}><ArrowLeft size={17}/></button><button aria-label={paused || reducedMotion ? 'Start sculpture rotation' : 'Pause sculpture rotation'} aria-pressed={!paused && !reducedMotion} disabled={reducedMotion || fallback} onClick={() => setPaused(value => !value)}>{paused || reducedMotion ? <Play size={17}/> : <Pause size={17}/>}</button><button aria-label="Rotate sculpture right" onClick={() => actions.current?.rotate(.38)} disabled={fallback}><ArrowRight size={17}/></button></div></div>
          {reducedMotion && <p className="personal-monument__motion-note">Automatic rotation is off for reduced motion. Drag or use the arrow controls to inspect.</p>}
        </div>
        <div className="personal-monument__detail" id={detailId}>
          {selected && <><div className="personal-monument__selected-title" aria-live="polite"><span>{typeLabel[selected.kind]}</span><h3>{selected.title}</h3></div>
            {selected.place && <><img src={selected.place.image} alt={selected.place.name} loading="lazy"/><p>{selected.place.tagline} This anchor represents a destination you saved.</p><a className="button button-light" href={href('/world', { place: selected.place.id })}>Explore {selected.place.name}<ArrowUpRight size={18}/></a></>}
            {selected.film && <><img src={selected.film.poster} alt="" loading="lazy"/><p>{selected.film.description}</p><div className="personal-monument__film-meta">{selected.film.category} · {formatDuration(selected.film.duration)} · {selected.film.status === 'available' ? 'Available preview' : 'In development'}</div><div className="personal-monument__detail-actions">{selected.film.status === 'available' && selected.film.src && <button className="button button-light" onClick={() => onWatch(selected.film!)}><Play size={18} weight="fill"/>Play film</button>}<a className="text-link" href={href(`/film/${selected.film.id}`)}>Story details <ArrowUpRight size={16}/></a></div></>}
            {selected.journey && <><p>This thread follows the films in your saved journey, in their chosen order.</p><ol className="personal-monument__journey">{selected.films.map((film, index) => <li key={`${film.id}-${index}`}><a href={href(`/film/${film.id}`)}><span>{film.title}</span><small>{formatDuration(film.duration)}{film.status !== 'available' ? ' · In development' : ''}</small></a>{film.status === 'available' && film.src && <button aria-label={`Play ${film.title}`} onClick={() => onWatch(film)}><Play size={16} weight="fill"/></button>}</li>)}</ol><a className="text-link" href={href('/journey')}>Build another journey <ArrowUpRight size={16}/></a></>}
            {selected.kind === 'place' && selected.films.length > 0 && <div className="personal-monument__related"><span>Stories connected to this place</span>{selected.films.slice(0, 3).map(film => <a href={href(`/film/${film.id}`)} key={film.id}>{film.title}<ArrowUpRight size={15}/></a>)}</div>}
          </>}
        </div>
      </div>
      <div className="personal-monument__arrangement"><fieldset><legend>Arrange your sculpture</legend><div>{(['orbit', 'column', 'unfolded'] as const).map(arrangement => <button key={arrangement} aria-pressed={preferences.arrangement === arrangement} onClick={() => { setPreferences(value => ({ ...value, arrangement })); setResetMessage(''); }}>{arrangement === 'orbit' ? 'Orbit' : arrangement === 'column' ? 'Column' : 'Unfold'}</button>)}</div></fieldset><label>Spacing <span>{preferences.spacing}%</span><input type="range" min="0" max="100" value={preferences.spacing} onChange={event => { setPreferences(value => ({ ...value, spacing: Number(event.target.value) })); setResetMessage(''); }}/></label><button className="text-link" onClick={reset}><ArrowCounterClockwise size={17}/>Reset arrangement</button></div>
      <div className="personal-monument__map"><div className="personal-monument__map-heading"><h3>The pieces of your world.</h3><div aria-label="Filter sculpture pieces">{(['all', 'place', 'film', 'journey'] as const).map(kind => <button key={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'all' ? 'All pieces' : kind === 'place' ? 'Places' : kind === 'film' ? 'Films' : 'Journeys'}</button>)}</div></div>{visibleParts.length ? <div className="personal-monument__pieces">{visibleParts.map(part => <button className={`personal-monument__piece is-${part.kind}`} key={part.key} aria-pressed={selected?.key === part.key} aria-controls={detailId} onClick={() => pickPart(part)}><i aria-hidden="true"/><span><small>{typeLabel[part.kind]}</small><strong>{part.title}</strong></span><ArrowUpRight size={16}/></button>)}</div> : <p>No {filter === 'place' ? 'destinations' : filter === 'film' ? 'films' : 'journeys'} saved yet. Add one to give your sculpture a new part.</p>}</div>
    </>}
    <p className="personal-monument__storage">{persistentStorage && preferencesStored ? 'Collection and arrangement are saved only in this browser. No account sync.' : 'Your sculpture is available for this visit; browser storage is unavailable.'} Resetting the arrangement keeps your collection.</p>
    <p className="personal-monument__reset-message" role="status">{resetMessage}</p>
  </section>;
}
