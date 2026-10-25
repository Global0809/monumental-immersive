import { assetUrl as asset } from '../services/assets';
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type RefObject, type PointerEvent } from "react";
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { BookmarkSimple } from '@phosphor-icons/react/dist/csr/BookmarkSimple';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { GlobeHemisphereWest } from '@phosphor-icons/react/dist/csr/GlobeHemisphereWest';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Waveform } from '@phosphor-icons/react/dist/csr/Waveform';
import { Shuffle } from '@phosphor-icons/react/dist/csr/Shuffle';
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { Stack } from '@phosphor-icons/react/dist/csr/Stack';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Path } from '@phosphor-icons/react/dist/csr/Path';
import { gsap } from "gsap";
import { places, periods, videos, type Video } from "../data/catalogue";
import { durationLabel } from "../services/discovery";
import { go, href } from "../services/router";
import { createJourney, MAX_SAVED_JOURNEYS, togglePlace, toggleSaved, useViewer } from "../services/viewer";
import { playSound, type SoundType } from "../services/audio";
import { notify } from "../services/feedback";
import "./explore.css";
import { selectDestination } from "../services/exploration";
import { resolveDragAxis, type DragAxis } from "../services/exploreInteraction";

const CityExperience = lazy(() => import("./CityExperience"));
const Atlas = lazy(() => import("./Atlas"));
type ExploreProps = { params: URLSearchParams; reducedMotion: boolean; onWatch: (video: Video) => void };
const channels = ["All", "Movies", "Music", "Fashion", "Culture"];
function channelOf(video: Video) {
  if (["Film", "Movies"].includes(video.category)) return "Movies";
  if (["Art & Design", "Documentary", "Food", "Culture"].includes(video.category)) return "Culture";
  return video.category;
}

function updateRoute(path: string, params: URLSearchParams, changes: Record<string, string>, sound: SoundType = "select") {
  const next = Object.fromEntries(params.entries());
  Object.entries(changes).forEach(([key, value]) => { if (value) next[key] = value; else delete next[key]; });
  go(path, next);
  playSound(sound);
}
function coordinates(lat: number, lon: number) { return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"} / ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`; }
function useArrival(scope: RefObject<HTMLDivElement | null>, key: string, reduced: boolean) {
  useEffect(() => {
    if (!scope.current || reduced) return;
    const context = gsap.context(() => {
      gsap.fromTo(".ex-reactive", { y: 16, opacity: .45 }, { y: 0, opacity: 1, duration: .7, stagger: .055, ease: "power3.out", clearProps: "transform,opacity" });
    }, scope);
    const visibility = () => context.getTweens().forEach((tween: gsap.core.Tween) => document.hidden ? tween.pause() : tween.resume());
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); context.revert(); };
  }, [scope, key, reduced]);
}
function findConnections(id: string) {
  const source = videos.filter(video => video.places.includes(id));
  const generic = new Set(["preview", "motion study", "originals", "in development", "history"]);
  return places.filter(place => place.id !== id).map(place => {
    const target = videos.filter(video => video.places.includes(place.id));
    const joint = source.find(video => video.places.includes(place.id));
    const series = source.find(video => video.series && target.some(other => other.series === video.series));
    const tag = source.flatMap(video => video.tags).find(tag => !generic.has(tag) && target.some(other => other.tags.includes(tag)));
    const category = source.find(video => target.some(other => channelOf(other) === channelOf(video)));
    return { place, score: joint ? 5 : series ? 4 : tag ? 3 : category ? 1 : 0, reason: joint ? `${joint.status === "development" ? "Planned " : ""}${joint.series || "shared programme"}` : series ? `Shared collection / ${series.series}` : tag ? `Shared theme / ${tag}` : category ? `${channelOf(category)} connects the collections` : "", films: target.filter(video => video.status === "available").length };
  }).filter(connection => connection.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

function ChannelFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="ex-channel-filter" role="group" aria-label="Filter by category" data-sound-owned>{channels.map((channel) => <button key={channel} aria-pressed={value === channel} onClick={() => onChange(channel)}>{channel}{value === channel && <span aria-hidden="true">↗</span>}</button>)}</div>;
}

function StoryCards({ items, onWatch, empty, onReset, resetLabel = "Explore all categories" }: { items: Video[]; onWatch: ExploreProps["onWatch"]; empty: string; onReset: () => void; resetLabel?: string }) {
  const viewer = useViewer();
  if (!items.length) return <div className="ex-empty"><span className="ex-empty-number" aria-hidden="true">00</span><div><h3>A connection waiting to happen.</h3><p>{empty}</p><button className="ex-text-link" onClick={onReset}>{resetLabel} <ArrowRight size={20} /></button></div></div>;
  return <div className="ex-stories">{items.map((video, index) => <article key={video.id} className="ex-story">
    <div className="ex-story-image">
      <a href={href(`/film/${video.id}`)} aria-label={`About ${video.title}`}><img src={asset(video.poster)} alt="" loading="lazy" /></a>
      <span className="ex-story-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="ex-story-format">{video.status === "development" ? "In development" : video.tags.includes("full film") ? "Guest film" : "Preview collection"}</span>
      {video.status === "available" && <button className="ex-story-play" onClick={() => onWatch(video)} aria-label={`Watch ${video.title}`}><Play weight="fill" size={23} /></button>}
    </div>
    <div className="ex-story-meta"><span>{channelOf(video)}</span><span>{video.status === "available" ? durationLabel(video.duration) : "Original series"}</span></div>
    <div className="ex-story-title"><h3><a href={href(`/film/${video.id}`)}>{video.title}</a></h3><button className="ex-save-story" data-sound-owned aria-label={`${viewer.saved.includes(video.id) ? "Remove" : "Save"} ${video.title}`} aria-pressed={viewer.saved.includes(video.id)} onClick={() => { const added = toggleSaved(video.id); playSound(added ? "save" : "remove"); }}>{viewer.saved.includes(video.id) ? <Check size={20} /> : <Plus size={20} />}</button></div>
    <p>{video.description}</p>
  </article>)}</div>;
}

export function WorldPage({ params, reducedMotion, onWatch }: ExploreProps) {
  const selected = places.find(place => place.id === params.get("place")) || places[0];
  const [cityRequest, setCityRequest] = useState(0);
  useEffect(() => selectDestination(selected.id), [selected.id]);
  const category = channels.includes(params.get("category") || "") ? params.get("category")! : "All";
  const viewer = useViewer();
  const root = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const connections = findConnections(selected.id);
  const linksVisible = params.get("links") !== "off";
  const available = videos.filter(video => video.places.includes(selected.id) && video.status === "available");
  useArrival(root, selected.id, reducedMotion);
  const items = videos.filter(video => video.places.includes(selected.id) && (category === "All" || channelOf(video) === category));
  const selectPlace = (place: string) => updateRoute("/world", params, { place }, "destination");
  return <div ref={root} className={`ex-page ex-world ${reducedMotion ? "ex-reduced" : ""}`}>
    <header className="ex-page-label"><span><GlobeHemisphereWest size={17} /> THE WORLD / 01</span><span>DISCOVER A DIFFERENT PERSPECTIVE</span></header>
    <div className="ex-world-room">
      <section className="ex-orbit-stage" aria-label="Explore the cultural globe">
        <h1 className="ex-world-title">NO<br /><span>BORDERS.</span></h1>
        <div className="ex-globe"><Suspense fallback={<div className="ex-atlas-loading"><span /><p>Bringing the world into focus</p></div>}><Atlas selected={selected.id} onSelect={selectPlace} reducedMotion={reducedMotion} connections={connections.map(connection => connection.place.id)} showConnections={linksVisible} /></Suspense></div>
        <div className="ex-orbit-caption"><span className="ex-signal-dot" /><span>A world connected through culture.<br />Rotate the globe. Find your next story.</span></div>
        <span className="ex-orbit-cross ex-orbit-cross--one" aria-hidden="true">+</span><span className="ex-orbit-cross ex-orbit-cross--two" aria-hidden="true">+</span>
      </section>
      <aside className="ex-location" aria-label={`${selected.name} destination`}>
        <div className="ex-location-top"><span>YOUR COORDINATES</span><button data-sound-owned aria-label={`${viewer.savedPlaces.includes(selected.id) ? "Unsave" : "Save"} ${selected.name}`} aria-pressed={viewer.savedPlaces.includes(selected.id)} onClick={() => { const added = togglePlace(selected.id); playSound(added ? "save" : "remove"); }}><BookmarkSimple size={22} weight={viewer.savedPlaces.includes(selected.id) ? "fill" : "regular"} /></button></div>
        <div className="ex-location-name ex-reactive" key={selected.id}><span>{selected.country}</span><h2>{selected.name}</h2></div>
        <div className="ex-coordinates ex-reactive">{coordinates(selected.lat, selected.lon)}<ArrowUpRight size={17} /></div>
        <div className="ex-location-photo ex-reactive"><img key={selected.image} src={asset(selected.image)} alt={`Destination photograph of ${selected.name}`} /><span>{selected.id === "miami" ? "THE OPENING GATEWAY" : "A DIFFERENT POINT OF VIEW"}</span></div>
        <p className="ex-location-tagline">{selected.tagline}</p>
        <button className="ex-location-explore" onClick={() => section.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" })}>Explore {selected.name}<ArrowDown size={21} /></button>
        <div className="ex-location-inventory ex-reactive"><span><strong>{String(available.length).padStart(2, "0")}</strong> playable stories</span><span><strong>{durationLabel(available.reduce((sum, video) => sum + video.duration, 0))}</strong> to discover</span></div>
        {selected.id === "miami" && <button className="button button-outline city-entry-link" data-sound="destination" onClick={() => { setCityRequest(value => value + 1); document.getElementById("city-experience")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" }); }}>Step inside Miami <ArrowUpRight size={18}/></button>}
      </aside>
    </div>
    <div className="ex-world-tools"><span><Path size={18} /> CULTURE IS A CONNECTION.</span><div><button data-sound-owned aria-pressed={linksVisible} onClick={() => updateRoute("/world", params, { links: linksVisible ? "off" : "" })}><span className={linksVisible ? "ex-toggle-light is-on" : "ex-toggle-light"} />Cultural connections {linksVisible ? "on" : "off"}</button><button data-sound-owned onClick={() => { const options = places.filter(place => place.id !== selected.id); selectPlace(options[Math.floor(Math.random() * options.length)].id); }}><Shuffle size={17} />Take a different turn</button></div></div>
    <nav className="ex-destinations" aria-label="Choose a destination" data-sound-owned>{places.map((place, index) => <button key={place.id} onClick={() => selectPlace(place.id)} aria-current={selected.id === place.id ? "location" : undefined}><span>{String(index + 1).padStart(2, "0")}</span>{place.name}<ArrowUpRight size={18} /></button>)}</nav>
    <Suspense fallback={null}><CityExperience openRequest={cityRequest} placeId={selected.id} reducedMotion={reducedMotion} onWatch={onWatch}/></Suspense>
    {connections.length > 0 && <section className="ex-connections" aria-label={`Cultural connections from ${selected.name}`}><div className="ex-connection-intro"><span className="ex-kicker">FOLLOW THE THREAD</span><h2>{selected.name}<br /><span>is a beginning.</span></h2><p>These lines connect shared themes and collections. Choose a place to see its perspective.</p></div><div className="ex-connection-links">{connections.map((connection, index) => <button className="ex-connection-link ex-reactive" key={connection.place.id} data-sound-owned onClick={() => { selectPlace(connection.place.id); root.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "instant" : "smooth" }); }}><img src={asset(connection.place.image)} alt="" loading="lazy" /><span className="ex-connection-number">0{index + 1}</span><span className="ex-connection-copy"><small>{connection.reason}</small><strong>{connection.place.name}</strong><span>{connection.films} playable {connection.films === 1 ? "story" : "stories"}</span></span><ArrowUpRight size={23} /></button>)}</div></section>}
    <section className="ex-results" ref={section}>
      <div className="ex-section-heading"><div><span className="ex-kicker">STORIES WITH A SENSE OF PLACE</span><h2>Inside {selected.name}<span>({String(items.length).padStart(2, "0")})</span></h2></div><a href={href("/time-machine", { place: selected.id, category: category === "All" ? undefined : category })}>Travel through time <ArrowUpRight size={19} /></a></div>
      <p className="ex-place-description">{selected.description}</p>
      <ChannelFilter value={category} onChange={value => updateRoute("/world", params, { category: value === "All" ? "" : value })} />
      <StoryCards items={items} onWatch={onWatch} empty={`There are no ${category.toLowerCase()} stories in this ${selected.name} collection yet. The next chapter is still being made.`} onReset={() => updateRoute("/world", params, { category: "" })} />
      <div className="ex-footnote"><Waveform size={19} /><p>Films are preview selections. Destination photographs introduce the place; they are not frames from the films. <a href={href("/credits")}>Sources & credits <ArrowUpRight size={13} /></a></p></div>
    </section>
  </div>;
}

const eras: Record<string, { title: string; place: string; image: string; shorthand: string }> = {
  "1930s": { title: "THE SHAPE OF TOMORROW", place: "MIAMI GATEWAY", image: "/media/miami.jpg", shorthand: "Design / 01" },
  "1970s": { title: "A NEW FREQUENCY", place: "NEW YORK", image: "/media/new-york.jpg", shorthand: "Music / 02" },
  "1990s": { title: "UNDERGROUND SIGNALS", place: "LONDON", image: "/media/london.jpg", shorthand: "Culture / 03" },
  "2000s": { title: "CINEMA OPENS UP", place: "OPEN CINEMA", image: "/media/big-buck-bunny.jpg", shorthand: "Movies / 04" },
  "2010s": { title: "INDEPENDENT WORLDS", place: "OPEN CINEMA", image: "/media/sintel.jpg", shorthand: "Movies / 05" },
  "now": { title: "THE NEXT CHAPTER", place: "EVERYWHERE", image: "/media/rio.jpg", shorthand: "Culture / 06" },
};

function EraComparison({ current, comparison, category, place, onChange, onClose, onWatch }: { current: string; comparison: string; category: string; place?: string; onChange: (id: string) => void; onClose: () => void; onWatch: ExploreProps["onWatch"] }) {
  const collection = (id: string) => videos.filter(video => video.period === id && video.status === "available" && (!place || video.places.includes(place)) && (category === "All" || channelOf(video) === category));
  const left = collection(current), right = collection(comparison);
  const shared = [...new Set(left.map(channelOf))].filter(channel => right.some(video => channelOf(video) === channel));
  return <section className="ex-comparison" aria-label="Compare cultural eras">
    <header><div><ArrowsLeftRight size={20} /><span>TWO ERAS. TWO PERSPECTIVES.</span></div><button data-sound-owned aria-label="Close era comparison" onClick={onClose}><X size={20} /></button></header>
    <div className="ex-comparison-grid">{[current, comparison].map((id, side) => { const era = periods.find(era => era.id === id)!; const films = side ? right : left; return <article key={side}><div className="ex-comparison-era"><h3>{era.label}</h3>{side ? <label><span>COMPARE WITH</span><select aria-label="Comparison era" data-sound-owned value={id} onChange={event => onChange(event.target.value)}>{periods.filter(era => era.id !== current).map(era => <option key={era.id} value={era.id}>{era.label}</option>)}</select></label> : <span>YOUR SELECTED CHAPTER</span>}</div><p>{era.description}</p><div className="ex-comparison-stats"><span>{films.length} {films.length === 1 ? "story" : "stories"}</span><span>{durationLabel(films.reduce((total, video) => total + video.duration, 0))}</span><span>{[...new Set(films.map(channelOf))].join(" / ") || "No matching category"}</span></div><div className="ex-comparison-films">{films.length ? films.map(video => <button key={video.id} onClick={() => onWatch(video)} aria-label={`Watch ${video.title}`}><img src={asset(video.poster)} alt="" loading="lazy"/><span>{video.title}<small>{durationLabel(video.duration)}</small></span><Play size={17} weight="fill" /></button>) : <p>No playable stories match these filters in this era. Change the category or destination below.</p>}</div></article>; })}</div>
    <footer><span className="ex-signal-dot" />{shared.length ? `Shared collection categories: ${shared.join(" / ")}. Explore how each chapter approaches them.` : "Different collections offer different perspectives. This comparison uses the available catalogue."}</footer>
  </section>;
}

export function TimeMachinePage({ params, reducedMotion, onWatch }: ExploreProps) {
  const root = useRef<HTMLDivElement>(null);
  const fan = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; pointer: number; axis: DragAxis; moved: boolean } | null>(null);
  const dragClick = useRef(false);
  const viewer = useViewer();
  const period = periods.find(era => era.id === params.get("period")) || periods[0];
  const index = periods.findIndex(era => era.id === period.id);
  const category = channels.includes(params.get("category") || "") ? params.get("category")! : "All";
  const place = places.find(item => item.id === params.get("place"));
  const current = eras[period.id];
  const contactSheet = params.get("view") === "contact";
  const comparePeriod = periods.find(era => era.id === params.get("compare") && era.id !== period.id);
  const items = videos.filter(video => video.period === period.id && (!place || video.places.includes(place.id)) && (category === "All" || channelOf(video) === category));
  const playable = items.filter(video => video.status === "available");
  const capsuleName = `Time capsule / ${period.label}${place ? ` / ${place.name}` : ""}${category !== "All" ? ` / ${category}` : ""}`;
  const capsuleSaved = viewer.journeys.some(journey => journey.name === capsuleName && journey.videoIds.join("|") === playable.map(video => video.id).join("|"));
  const selectPeriod = (id: string) => { if (id !== period.id) updateRoute("/time-machine", params, { period: id, compare: params.get("compare") === id ? period.id : params.get("compare") || "" }, "era"); };
  useArrival(root, period.id, reducedMotion);
  const moveScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointer !== event.pointerId || contactSheet) return;
    const delta = event.clientX - drag.current.x;
    drag.current.axis = resolveDragAxis(delta, event.clientY - drag.current.y, drag.current.axis);
    if (drag.current.axis !== 'horizontal') return;
    if (Math.abs(delta) > 9) { drag.current.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
    if (drag.current.moved && !reducedMotion) fan.current?.style.setProperty("--scrub-shift", `${Math.max(-100, Math.min(100, delta * .3))}px`);
  };
  const finishScrub = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    drag.current = null;
    fan.current?.style.removeProperty("--scrub-shift");
    dragClick.current = !cancel && gesture.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const delta = event.clientX - gesture.x;
    if (!cancel && gesture.axis === 'horizontal' && Math.abs(delta) > 45) selectPeriod(periods[Math.max(0, Math.min(periods.length - 1, index + (delta < 0 ? 1 : -1)))].id);
  };
  return <div ref={root} className={`ex-page ex-time ${reducedMotion ? "ex-reduced" : ""}`}>
    <header className="ex-page-label"><span>THE TIME MACHINE / 02</span><a href={href("/world", { place: place?.id, category: category === "All" ? undefined : category })}>SPACE IS ONLY HALF THE STORY <ArrowUpRight size={16} /></a></header>
    <section className="ex-time-room" aria-label="Explore cultural eras">
      <div className="ex-time-heading"><h1>GOOD STORIES<br />DON’T EXPIRE.</h1><p>Rewind the culture.<br />Discover what shaped the now.</p></div>
      <div className="ex-era-toolbar"><div className="ex-view-switch" role="group" aria-label="Era presentation" data-sound-owned><button aria-pressed={!contactSheet} onClick={() => updateRoute("/time-machine", params, { view: "" })}><Stack size={16} /> Film strip</button><button aria-pressed={contactSheet} onClick={() => updateRoute("/time-machine", params, { view: "contact" })}><SquaresFour size={16} /> Contact sheet</button></div><span>{contactSheet ? "SIX OPEN DOORS. CHOOSE YOUR MOMENT." : "DRAG THE FILMS / USE ARROW KEYS"}</span></div>
      <div className={`ex-era-room ${contactSheet ? "ex-era-room--contact" : ""}`} role="group" aria-label="Era explorer. Drag horizontally or use left and right arrow keys to select an era." tabIndex={0} data-sound-owned
        onPointerDown={event => { if (event.button === 0 && !contactSheet && !drag.current) { drag.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId, axis: 'pending', moved: false }; dragClick.current = false; } }} onPointerMove={moveScrub} onPointerLeave={event => { if (drag.current && !drag.current.moved) finishScrub(event, true); }} onPointerUp={event => finishScrub(event)} onPointerCancel={event => finishScrub(event, true)}
        onClickCapture={event => { if (dragClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); dragClick.current = false; } }}
        onKeyDown={event => { const target = event.target as HTMLElement; if (!target.closest("button") && target !== event.currentTarget) return; const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? periods.length - 1 : null; if (next !== null) { event.preventDefault(); const id = periods[Math.max(0, Math.min(periods.length - 1, next))].id; selectPeriod(id); if (target.closest('button')) event.currentTarget.querySelector<HTMLButtonElement>(`[data-era="${id}"]`)?.focus({ preventScroll: true }); } }}>
        <span className="ex-year-ghost ex-reactive" aria-hidden="true" key={period.id}>{period.label}</span>
        <div className="ex-era-fan" ref={fan} role="group" aria-label="Select an era">
          {periods.map((era, eraIndex) => {
            const meta = eras[era.id];
            const offset = eraIndex - index; const playableCount = videos.filter(video => video.period === era.id && video.status === "available").length;
            const style = { "--era-offset": offset, "--era-distance": Math.abs(offset), zIndex: 10 - Math.abs(offset) } as CSSProperties;
            return <button key={era.id} data-era={era.id} className={`ex-era-frame ${era.id === period.id ? "is-active" : ""}`} style={style} aria-pressed={era.id === period.id} onClick={() => selectPeriod(era.id)} aria-label={`Explore ${era.label}: ${meta.title.toLowerCase()}`}><span className="ex-film-perfs" aria-hidden="true" /><div className="ex-era-picture"><img src={asset(meta.image)} alt="" draggable={false} /><span className="ex-era-place">{meta.place}</span><span className="ex-era-number">{era.label}</span></div><span className="ex-era-frame-bottom">{meta.shorthand}<ArrowUpRight size={18} /></span><span className="ex-era-count">{playableCount} playable {playableCount === 1 ? "story" : "stories"}</span><span className="ex-film-perfs" aria-hidden="true" /></button>;
          })}
        </div>
        <span className="ex-era-image-note">{["1930s", "1970s", "1990s"].includes(period.id) ? "Contemporary imagery / historical context" : period.id === "now" ? "Contemporary culture / the story continues" : "Film release era / fictional worlds"}</span>
      </div>
      <div className="ex-time-controls" data-sound-owned><button disabled={index === 0} onClick={() => selectPeriod(periods[index - 1].id)} aria-label="Previous era"><ArrowLeft size={22} /></button><div className="ex-time-rail"><label htmlFor="era-selector">DRAG TO TRAVEL <span>{String(index + 1).padStart(2, "0")} / {String(periods.length).padStart(2, "0")}</span></label><input id="era-selector" type="range" min="0" max={periods.length - 1} step="1" value={index} aria-valuetext={period.label} onChange={event => selectPeriod(periods[Number(event.target.value)].id)} /><div className="ex-time-ticks" aria-hidden="true">{periods.map(era => <span key={era.id} className={period.id === era.id ? "active" : ""}>{era.label}</span>)}</div></div><button disabled={index === periods.length - 1} onClick={() => selectPeriod(periods[index + 1].id)} aria-label="Next era"><ArrowRight size={22} /></button></div>
    </section>
    <section className="ex-results ex-era-results">
      <div className="ex-era-introduction ex-reactive"><div><span className="ex-kicker">{period.id === "now" ? "CONTEMPORARY CULTURE" : `AN OPEN WINDOW TO THE ${period.label.toUpperCase()}`}</span><h2>{current.title}</h2></div><p>{period.description}</p></div>
      <div className="ex-chapter-actions" data-sound-owned><span>{durationLabel(playable.reduce((sum, video) => sum + video.duration, 0))} OF PLAYABLE CULTURE</span><div><button disabled={!playable.length || capsuleSaved} onClick={() => { const created = createJourney(capsuleName, playable.map(video => video.id)); if (!created) { notify(`You have ${MAX_SAVED_JOURNEYS} saved journeys. Remove one in My World, then save again.`); return; } playSound("save"); }}>{capsuleSaved ? <Check size={17} /> : <BookmarkSimple size={17} />}{capsuleSaved ? "Time capsule saved" : "Save a time capsule"}</button><button aria-expanded={Boolean(comparePeriod)} onClick={() => updateRoute("/time-machine", params, { compare: comparePeriod ? "" : periods[(index + 1) % periods.length].id })}><ArrowsLeftRight size={18} />{comparePeriod ? "Close comparison" : "Compare another era"}</button></div></div>
      {comparePeriod && <EraComparison current={period.id} comparison={comparePeriod.id} category={category} place={place?.id} onChange={value => updateRoute("/time-machine", params, { compare: value }, "era")} onClose={() => updateRoute("/time-machine", params, { compare: "" })} onWatch={onWatch} />}
      <div className="ex-time-filters"><ChannelFilter value={category} onChange={value => updateRoute("/time-machine", params, { category: value === "All" ? "" : value })} /><label className="ex-place-filter">DESTINATION<select aria-label="Filter eras by destination" value={place?.id || ""} onChange={event => updateRoute("/time-machine", params, { place: event.target.value })}><option value="">Everywhere</option>{places.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <div className="ex-results-count" aria-live="polite">{items.length} {items.length === 1 ? "story" : "stories"} in this chapter{place ? ` · ${place.name}` : ""}</div>
      <StoryCards items={items} onWatch={onWatch} empty={`This combination has no stories yet. Explore another era, or open the whole ${period.label} collection.`} resetLabel="Clear filters" onReset={() => updateRoute("/time-machine", params, { category: "", place: "" })} />
      <div className="ex-footnote"><span className="ex-footnote-star" aria-hidden="true">✳</span><p>Time Machine explores cultural context and release eras. Newly created studies are clearly identified; selecting a decade never turns contemporary video into historical footage.</p></div>
    </section>
  </div>;
}
