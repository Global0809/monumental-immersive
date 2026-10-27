import { attachXray } from '../services/xrayMaterial';
import { createFrameCadence } from '../services/frameCadence';
/**
 * Land geometry: Natural Earth, 1:110m land, public domain.
 * https://www.naturalearthdata.com/about/terms-of-use/
 * Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
 * Local earth-land.json contains sampled land coordinates and original coastlines.
 * The arcs show shared catalogue themes and collections, not live traffic or travel routes.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { MagnifyingGlassPlus } from '@phosphor-icons/react/dist/csr/MagnifyingGlassPlus';
import { MagnifyingGlassMinus } from '@phosphor-icons/react/dist/csr/MagnifyingGlassMinus';
import { Crosshair } from '@phosphor-icons/react/dist/csr/Crosshair';
import { places } from "../data/catalogue";
import { playSound } from "../services/audio";
import { resolveDragAxis, type DragAxis } from "../services/exploreInteraction";
import "./atlas.css";

type AtlasProps = {
  selected?: string;
  onSelect: (id: string) => void;
  compact?: boolean;
  reducedMotion?: boolean;
  connections?: string[];
  showConnections?: boolean;
  approaching?: boolean;
};
type EarthData = { land: number[]; coast: number[][] };
const RADIANS = Math.PI / 180;
const HOME_YAW = 57 * RADIANS;

function coordinate(lat: number, lon: number, radius = 1.025) {
  return new THREE.Vector3(
    Math.cos(lat * RADIANS) * Math.sin(lon * RADIANS),
    Math.sin(lat * RADIANS),
    Math.cos(lat * RADIANS) * Math.cos(lon * RADIANS),
  ).multiplyScalar(radius);
}

export default function Atlas({
  selected,
  onSelect,
  compact = false,
  reducedMotion = false,
  connections = [],
  showConnections = true,
  approaching = false,
}: AtlasProps) {
  const [systemReduced, setSystemReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const calm = reducedMotion || systemReduced;
  const host = useRef<HTMLDivElement>(null);
  const destinationMenu = useRef<HTMLDetailsElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const controls = useRef<{
    rotate: (amount: number) => void;
    focus: (id: string) => void;
    reset: () => void;
    refresh: () => void;
    zoom: (amount: number) => void;
    connect: (id: string, targets: string[], visible: boolean) => void;
  } | null>(null);
  const motionRef = useRef(calm);
  const pauseRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [zoomFactor, setZoomFactor] = useState(1);
  const selectedRef = useRef(selected || "miami");
  selectedRef.current = selected || "miami";
  const connectionRef = useRef(connections);
  connectionRef.current = connections;
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );

  useEffect(() => {
    if (selected) controls.current?.focus(selected);
  }, [selected]);
  useEffect(() => {
    if (approaching) controls.current?.focus(selectedRef.current);
    controls.current?.zoom(approaching ? 2 : zoomLevel);
    // The departure briefly moves closer without changing the visitor's zoom setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approaching]);
  useEffect(() => {
    controls.current?.connect(selected || "miami", connections, showConnections);
  }, [selected, connections.join("|"), showConnections]);
  useEffect(() => {
    motionRef.current = calm;
    controls.current?.refresh();
  }, [calm]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let contextAvailable = true;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setStatus("fallback");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.35 : 1.6));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    element.prepend(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
    camera.position.set(0, 0.04, 3.45);
    const globe = new THREE.Group();
    globe.rotation.set(0.1, HOME_YAW, -0.075);
    const initialPlace =
      selected && selected !== "miami"
        ? places.find((place) => place.id === selected)
        : undefined;
    if (initialPlace)
      globe.rotation.set(
        initialPlace.lat * RADIANS * 0.65,
        -initialPlace.lon * RADIANS,
        -0.075,
      );
    scene.add(globe);
    scene.add(new THREE.AmbientLight(0xe4e7dc, 0.65));
    const key = new THREE.DirectionalLight(0xf0f2e8, 2.6);
    key.position.set(-3, 3.5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff4d32, 1.1);
    fill.position.set(4, -0.6, 1);
    scene.add(fill);

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.997, 64, 48),
      new THREE.MeshStandardMaterial({
        color: 0x151817,
        metalness: 0.78,
        roughness: 0.43,
      }),
    );
    globe.add(body);
    const xray = attachXray(renderer, [body.material], [body]);
    const haloMaterial = new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color("#e9eee2") } },
      vertexShader:
        "varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.); vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz); gl_Position=projectionMatrix*p;}",
      fragmentShader:
        "uniform vec3 tint; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),4.5); gl_FragColor=vec4(tint,rim*.16);}",
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    globe.add(
      new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 48), haloMaterial),
    );

    // Quiet geodetic lines give the land a physical reference without becoming UI.
    const geodesicMaterial = new THREE.LineBasicMaterial({
      color: 0xc5cec0,
      transparent: true,
      opacity: 0.055,
    });
    for (const lat of [-60, -30, 0, 30, 60]) {
      const points = Array.from({ length: 181 }, (_, i) =>
        coordinate(lat, i * 2 - 180, 1.002),
      );
      globe.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          geodesicMaterial,
        ),
      );
    }
    for (const lon of [0, 45, 90, 135]) {
      const points = Array.from({ length: 181 }, (_, i) => {
        const angle = i * 2 * RADIANS;
        return new THREE.Vector3(
          Math.sin(angle) * Math.sin(lon * RADIANS),
          Math.cos(angle),
          Math.sin(angle) * Math.cos(lon * RADIANS),
        ).multiplyScalar(1.002);
      });
      globe.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          geodesicMaterial,
        ),
      );
    }

    const assembly = new THREE.Group();
    assembly.rotation.set(1.12, 0.2, -0.32);
    scene.add(assembly);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xd0d5c7,
      metalness: 0.92,
      roughness: 0.34,
      transparent: true,
      opacity: 0.7,
    });
    assembly.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(1.26, 0.0035, 5, 200),
        ringMaterial,
      ),
    );
    assembly.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(1.29, 0.0012, 4, 200),
        ringMaterial,
      ),
    );
    const arcMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f2e8,
      metalness: 0.82,
      roughness: 0.4,
    });
    for (let i = 0; i < 5; i++) {
      const segment = new THREE.Mesh(
        new THREE.TorusGeometry(1.275, 0.009, 5, 22, 0.17),
        arcMaterial,
      );
      segment.rotation.z = (i * Math.PI * 2) / 5;
      assembly.add(segment);
    }
    const tiltedOrbit = new THREE.Mesh(
      new THREE.TorusGeometry(1.17, 0.0016, 4, 160, Math.PI * 1.65),
      new THREE.MeshBasicMaterial({
        color: 0xff4d32,
        transparent: true,
        opacity: 0.25,
      }),
    );
    tiltedOrbit.rotation.set(0.65, 0.8, 1.65);
    scene.add(tiltedOrbit);

    const destinations = places.map((place) => ({
      ...place,
      position: coordinate(place.lat, place.lon),
    }));
    const connectionGroup = new THREE.Group();
    globe.add(connectionGroup);
    const connectionPaths: { line: THREE.Line; points: THREE.Vector3[]; bead: THREE.Mesh }[] = [];
    let connectionReveal = 1;
    let connectionClock = 0;
    const setConnections = (from: string, targets: string[], enabled: boolean) => {
      connectionGroup.traverse(object => {
        const item = object as THREE.Mesh;
        item.geometry?.dispose();
        if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach(material => material.dispose());
      });
      connectionGroup.clear();
      connectionPaths.length = 0;
      if (!enabled) return;
      const start = destinations.find(destination => destination.id === from);
      if (!start) return;
      targets.filter(id => id !== from).slice(0, 4).forEach((target, index) => {
        const end = destinations.find(destination => destination.id === target);
        if (!end) return;
        const angle = start.position.angleTo(end.position);
        const points = Array.from({ length: 90 }, (_, step) => {
          const t = step / 89;
          return start.position.clone().multiplyScalar(Math.sin((1 - t) * angle))
            .add(end.position.clone().multiplyScalar(Math.sin(t * angle)))
            .divideScalar(Math.max(.0001, Math.sin(angle))).normalize()
            .multiplyScalar(1.025 + Math.sin(Math.PI * t) * Math.min(.32, angle * .2));
        });
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: index ? 0xe7eddf : 0xff4d32, transparent: true, opacity: index ? .25 : .7 }));
        const bead = new THREE.Mesh(new THREE.SphereGeometry(.007, 8, 6), new THREE.MeshBasicMaterial({ color: index ? 0xeff2e8 : 0xff4d32 }));
        bead.position.copy(points[0]);
        connectionGroup.add(line, bead);
        connectionPaths.push({ line, points, bead });
      });
      connectionReveal = motionRef.current ? 1 : 0;
      connectionClock = 0;
    };
    const abort = new AbortController();
    let frame = 0;
    let visible = true;
    let playingFilm = document.body.classList.contains('monumental-player-active');
    let lastTime = 0;
    let width = 1;
    let height = 1;
    let clipLeft = 0;
    let clipRight = 1;
    const zoomPanel = element.querySelector<HTMLElement>('.cultural-atlas__zoom');
    let zoomPanelBounds = { left: Infinity, top: Infinity, bottom: -Infinity };
    const labelWidths = new Map<string, number>();
    const labelHeights = new Map<string, number>();
    let lastInteraction = 0;
    let dragging = false;
    let targetRotation: { x: number; y: number } | null = null;
    let pointerX = 0;
    let pointerY = 0;
    let activePointer: number | null = null, startPointerX = 0, startPointerY = 0;
    let dragAxis: DragAxis = 'pending';
    let baseDistance = 3.45;
    let targetZoom = 0;
    const world = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const towardCamera = new THREE.Vector3();
    const cadence = createFrameCadence();
    const labelPresentation = new Map<HTMLElement, { visible: boolean; side?: string; transform?: string; depth?: string; shift?: number; collapsed?: boolean }>();

    const updateLabels = () => {
      globe.updateMatrixWorld(true);
      const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
      const priority = [...destinations].sort((a, b) => {
        const rank = (id: string) => id === selectedRef.current ? 3 : document.activeElement === markers.current.get(id) ? 2 : 0;
        return rank(b.id) - rank(a.id);
      });
      for (const destination of priority) {
        const label = markers.current.get(destination.id);
        if (!label) continue;
        world.copy(destination.position).applyMatrix4(globe.matrixWorld);
        towardCamera.copy(camera.position).sub(world);
        projected.copy(world).project(camera);
        const x = ((projected.x + 1) * width) / 2;
        const y = ((1 - projected.y) * height) / 2;
        const isVisible = world.dot(towardCamera) > 0.12 && x >= clipLeft + 4 && x <= clipRight - 4 && y >= 4 && y <= height - 4;
        let presentation = labelPresentation.get(label);
        if (!presentation || presentation.visible !== isVisible) {
          label.style.visibility = isVisible ? "visible" : "hidden";
          label.tabIndex = isVisible ? 0 : -1;
          if (!presentation) { presentation = { visible: isVisible }; labelPresentation.set(label, presentation); }
          else presentation.visible = isVisible;
        }
        if (!isVisible) continue;
        // Widths and visible viewport bounds are measured only on resize, never
        // while projecting the moving pins. World can extend beyond the screen.
        const besideZoomPanel = y >= zoomPanelBounds.top - 24 && y <= zoomPanelBounds.bottom + 32;
        const rightEdge = besideZoomPanel && x < zoomPanelBounds.left ? Math.min(clipRight, zoomPanelBounds.left) : clipRight;
        const rightRoom = rightEdge - 8 - x - 17;
        const leftRoom = x - clipLeft - 8 - 17;
        const side = rightRoom < (labelWidths.get(destination.id) ?? 110) && leftRoom > rightRoom ? "left" : "right";
        if (presentation.side !== side) { label.dataset.labelSide = side; presentation.side = side; }
        // Place the selected label first. Neighbouring labels yield while their
        // geographic pins remain selectable; no layout reads run in this loop.
        const labelWidth = labelWidths.get(destination.id) ?? 110;
        const labelHeight = labelHeights.get(destination.id) ?? 30;
        const labelLeft = side === 'left' ? x - 17 - labelWidth : x + 17;
        const preferred = destination.id === 'new-york' ? -22 : destination.id === 'puerto-rico' ? 22 : 0;
        const offsets = [preferred, -32, 32, -56, 56];
        let shift = preferred, collapsed = true;
        for (const offset of offsets) {
          const box = { left: labelLeft - 4, right: labelLeft + labelWidth + 4, top: y + offset - labelHeight / 2 - 3, bottom: y + offset + labelHeight / 2 + 3 };
          const clear = box.left >= clipLeft + 3 && box.right <= clipRight - 3 && box.top >= 4 && box.bottom <= height - 4 &&
            !(box.right > zoomPanelBounds.left - 5 && box.bottom > zoomPanelBounds.top && box.top < zoomPanelBounds.bottom) &&
            !occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
          if (clear || destination.id === selectedRef.current) { shift = offset; collapsed = false; occupied.push(box); break; }
        }
        if (presentation.shift !== shift) { label.style.setProperty('--atlas-label-shift', `${shift}px`); presentation.shift = shift; }
        if (presentation.collapsed !== collapsed) { label.dataset.labelCollapsed = String(collapsed); presentation.collapsed = collapsed; }
        const transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        const depth = destination.id === selectedRef.current ? '300' : String(Math.round((2 - projected.z) * 100));
        if (presentation.transform !== transform) { label.style.transform = transform; presentation.transform = transform; }
        if (presentation.depth !== depth) { label.style.zIndex = depth; presentation.depth = depth; }
      }
    };
    const draw = (time: number) => {
      frame = 0;
      if (disposed || !contextAvailable || !visible || document.hidden || playingFilm) return;
      if (!cadence.ready(time)) { frame = window.requestAnimationFrame(draw); return; }
      // Visibility callbacks can sample performance.now() after this frame's
      // RAF timestamp. Never let that move a newly revealed connection backward.
      const delta = Math.max(0, Math.min((time - lastTime) / 1000, 0.05));
      lastTime = time;
      const cameraTarget = baseDistance - targetZoom * .3;
      const zooming = Math.abs(camera.position.z - cameraTarget) > .002;
      camera.position.z = motionRef.current ? cameraTarget : THREE.MathUtils.lerp(camera.position.z, cameraTarget, 1 - Math.exp(-delta * 7));
      connectionReveal = Math.min(1, connectionReveal + (motionRef.current ? 1 : delta * 1.6));
      if (!motionRef.current && !pauseRef.current) connectionClock += delta;
      connectionPaths.forEach(({ line, points, bead }, index) => {
        const visiblePoints = Math.max(2, Math.round(connectionReveal * points.length));
        line.geometry.setDrawRange(0, visiblePoints);
        const t = motionRef.current ? .65 : connectionReveal < 1 ? connectionReveal : (connectionClock * .13 + index * .27) % 1;
        const position = THREE.MathUtils.clamp(Math.floor(t * (points.length - 1)), 0, points.length - 1);
        bead.position.copy(points[position]);
      });
      if (targetRotation) {
        if (motionRef.current) {
          globe.rotation.x = targetRotation.x;
          globe.rotation.y = targetRotation.y;
          targetRotation = null;
        } else {
          const ease = 1 - Math.exp(-delta * 6);
          globe.rotation.x += (targetRotation.x - globe.rotation.x) * ease;
          globe.rotation.y += (targetRotation.y - globe.rotation.y) * ease;
          if (
            Math.abs(targetRotation.x - globe.rotation.x) +
              Math.abs(targetRotation.y - globe.rotation.y) <
            0.001
          )
            targetRotation = null;
        }
      } else if (
        !dragging &&
        !motionRef.current &&
        !pauseRef.current &&
        time - lastInteraction > 6000
      )
        globe.rotation.y += delta * 0.006;
      // DOM pins and WebGL must project from the same camera frame during zoom.
      camera.updateMatrixWorld(true);
      updateLabels();
      xray.update(!motionRef.current);
      renderer.render(scene, camera);
      if (targetRotation || zooming || connectionReveal < 1 || (!motionRef.current && !pauseRef.current))
        frame = window.requestAnimationFrame(draw);
    };
    const requestDraw = () => {
      if (
        !frame &&
        !disposed &&
        contextAvailable &&
        visible &&
        !document.hidden &&
        !playingFilm
      ) {
        cadence.reset();
        frame = window.requestAnimationFrame(draw);
      }
    };
    let resizeFrame = 0;
    const resize = () => {
      resizeFrame = 0;
      if (disposed) return;
      const bounds = element.getBoundingClientRect();
      const panel = zoomPanel?.getBoundingClientRect();
      if (panel) zoomPanelBounds = { left: panel.left - bounds.left, top: panel.top - bounds.top, bottom: panel.bottom - bounds.top };
      const nextWidth = Math.max(1, bounds.width);
      const nextHeight = Math.max(1, bounds.height);
      const sizeChanged = Math.abs(nextWidth - width) > .5 || Math.abs(nextHeight - height) > .5;
      const currentZoom = (baseDistance - camera.position.z) / .3;
      width = nextWidth;
      height = nextHeight;
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
      clipLeft = Math.max(0, viewportLeft - bounds.left);
      clipRight = Math.min(width, viewportLeft + viewportWidth - bounds.left);
      // Mobile browser chrome and visual-viewport panning can report scroll and
      // resize without changing this scene. Do not clear its buffer or snap an
      // in-flight zoom to its endpoint for those notifications.
      if (sizeChanged) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        baseDistance = width / height < 0.95 ? 3.45 / (width / height) : 3.45;
        camera.position.z = baseDistance - currentZoom * .3;
        setZoomFactor(baseDistance / (baseDistance - targetZoom * .3));
        camera.updateProjectionMatrix();
      }
      requestDraw();
    };
    const scheduleResize = () => { if (!resizeFrame) resizeFrame = requestAnimationFrame(resize); };
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(element);
    if (zoomPanel) resizeObserver.observe(zoomPanel);
    const labelObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target.parentElement as HTMLButtonElement | null)?.dataset.place;
        if (id) {
          labelWidths.set(id, entry.borderBoxSize[0]?.inlineSize ?? (entry.target as HTMLElement).offsetWidth);
          labelHeights.set(id, entry.borderBoxSize[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight);
        }
      }
      requestDraw();
    });
    markers.current.forEach(marker => {
      const text = marker.querySelector('.cultural-atlas__label');
      if (text) labelObserver.observe(text);
    });
    window.addEventListener('resize', scheduleResize);
    window.visualViewport?.addEventListener('resize', scheduleResize);
    window.visualViewport?.addEventListener('scroll', scheduleResize);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          lastTime = performance.now();
          requestDraw();
        } else {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "30px" },
    );
    observer.observe(element);
    const visibility = () => {
      if (document.hidden || playingFilm) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        lastTime = performance.now();
        requestDraw();
      }
    };
    const playback = (event: Event) => {
      playingFilm = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      visibility();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener('monumental:playback', playback);
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || activePointer !== null) return;
      pauseRef.current = true; setPaused(true);
      targetRotation = null;
      dragging = true;
      activePointer = event.pointerId; dragAxis = 'pending';
      pointerX = startPointerX = event.clientX;
      pointerY = startPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging || activePointer !== event.pointerId) { requestDraw(); return; }
      if (event.pointerType !== 'mouse') {
        dragAxis = resolveDragAxis(event.clientX - startPointerX, event.clientY - startPointerY, dragAxis);
        if (dragAxis !== 'horizontal') return;
      }
      globe.rotation.y += (event.clientX - pointerX) * 0.006;
      if (event.pointerType === "mouse")
        globe.rotation.x = THREE.MathUtils.clamp(
          globe.rotation.x + (event.clientY - pointerY) * 0.004,
          -0.6,
          0.6,
        );
      pointerX = event.clientX;
      pointerY = event.clientY;
      lastInteraction = performance.now();
      requestDraw();
    };
    const pointerUp = (event: PointerEvent) => {
      if (activePointer !== event.pointerId) return;
      dragging = false;
      activePointer = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = "grab";
      lastInteraction = performance.now();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      contextAvailable = false;
      setStatus("fallback");
      cancelAnimationFrame(frame);
      frame = 0;
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("webglcontextlost", contextLost);
    controls.current = {
      rotate(amount) {
        targetRotation = null;
        globe.rotation.y += amount;
        lastInteraction = performance.now();
        requestDraw();
      },
      focus(id) {
        const destination = destinations.find((place) => place.id === id);
        if (!destination) return;
        pauseRef.current = true; setPaused(true);
        const target = -destination.lon * RADIANS;
        const difference = Math.atan2(
          Math.sin(target - globe.rotation.y),
          Math.cos(target - globe.rotation.y),
        );
        targetRotation = {
          x: destination.lat * RADIANS * 0.65,
          y: globe.rotation.y + difference,
        };
        lastInteraction = performance.now();
        requestDraw();
      },
      reset() {
        targetRotation = null;
        targetZoom = 0;
        setZoomFactor(1);
        globe.rotation.set(0.1, HOME_YAW, -0.075);
        lastInteraction = performance.now();
        requestDraw();
      },
      zoom(level) {
        targetZoom = THREE.MathUtils.clamp(level, 0, 3);
        setZoomFactor(baseDistance / (baseDistance - targetZoom * .3));
        lastInteraction = performance.now();
        requestDraw();
      },
      connect(id, targets, enabled) {
        setConnections(id, targets, enabled);
        requestDraw();
      },
      refresh: requestDraw,
    };
    setConnections(selectedRef.current, connectionRef.current, showConnections);
    resize();
    fetch(`${import.meta.env.BASE_URL}assets/earth-land.json`, {
      signal: abort.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Earth unavailable");
        return response.json() as Promise<EarthData>;
      })
      .then((data) => {
        if (disposed) return;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(data.land, 3),
        );
        const pointMaterial = new THREE.ShaderMaterial({
          uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
          vertexShader: `uniform float pixelRatio; varying float vLight; varying float vNoise; void main(){ vec3 n=normalize(normalMatrix*normalize(position)); vLight=.22+.78*max(dot(n,normalize(vec3(-.8,.85,1.))),0.); vNoise=.7+.3*fract(sin(dot(position.xy,vec2(12.9898,78.233)))*43758.5453); vec4 mv=modelViewMatrix*vec4(position*1.007,1.); gl_PointSize=pixelRatio*1.85*(3.45/-mv.z); gl_Position=projectionMatrix*mv; }`,
          fragmentShader: `varying float vLight; varying float vNoise; void main(){float d=length(gl_PointCoord-.5); if(d>.5)discard; float a=1.-smoothstep(.27,.5,d); vec3 color=mix(vec3(.22,.26,.24),vec3(.92,.95,.88),vLight); gl_FragColor=vec4(color*vNoise,a*.95);}`,
          transparent: true,
          depthWrite: false,
        });
        globe.add(new THREE.Points(geometry, pointMaterial));
        const coastMaterial = new THREE.LineBasicMaterial({
          color: 0xd8e0d0,
          transparent: true,
          opacity: 0.14,
        });
        const coastSegments: number[] = [];
        for (const coastline of data.coast) {
          for (let i = 0; i < coastline.length - 3; i += 3) {
            coastSegments.push(
              ...coastline.slice(i, i + 6).map((value) => value * 1.004),
            );
          }
        }
        const coastGeometry = new THREE.BufferGeometry();
        coastGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(coastSegments, 3),
        );
        globe.add(new THREE.LineSegments(coastGeometry, coastMaterial));
        setStatus("ready");
        requestDraw();
      })
      .catch((error) => {
        if (disposed || error.name === "AbortError") return;
        // The labelled sphere and destination list remain useful if geometry cannot load.
        setStatus("ready");
        requestDraw();
      });

    return () => {
      disposed = true;
      xray.dispose();
      abort.abort();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      resizeObserver.disconnect();
      labelObserver.disconnect();
      window.removeEventListener('resize', scheduleResize);
      window.visualViewport?.removeEventListener('resize', scheduleResize);
      window.visualViewport?.removeEventListener('scroll', scheduleResize);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener('monumental:playback', playback);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("webglcontextlost", contextLost);
      controls.current = null;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const renderable = object as THREE.Mesh;
        if (renderable.geometry) geometries.add(renderable.geometry);
        if (renderable.material)
          (Array.isArray(renderable.material)
            ? renderable.material
            : [renderable.material]
          ).forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      // Release driver-owned default textures/framebuffers as well as Three's caches.
      // The event listeners have already been removed, so unmount cannot trigger fallback UI.
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  const toggleRotation = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(pauseRef.current);
    controls.current?.refresh();
  };
  const choosePlace = (id: string) => {
    if (destinationMenu.current?.open && status !== "fallback") {
      destinationMenu.current.open = false;
      destinationMenu.current.querySelector("summary")?.focus();
    }
    controls.current?.focus(id);
    onSelect(id);
  };
  const zoom = (step: number) => {
    const next = Math.max(0, Math.min(3, zoomLevel + step));
    setZoomLevel(next);
    controls.current?.zoom(next);
    playSound("focus");
  };

  return (
    <div
      className={`cultural-atlas ${compact ? "cultural-atlas--compact" : ""} ${status === "fallback" ? "cultural-atlas--fallback" : ""} ${approaching ? "is-approaching" : ""}`}
    >
      <div
        className="cultural-atlas__viewport"
        ref={host}
        data-cursor="Orbit"
        tabIndex={status === 'fallback' ? undefined : 0}
        aria-label="Interactive cultural globe. Drag or use left and right arrows to rotate. Plus and minus zoom. Home returns to Miami."
        onKeyDown={event => {
          if (event.target !== event.currentTarget || status === 'fallback') return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); controls.current?.rotate(event.key === 'ArrowLeft' ? -.3 : .3); playSound('drag'); }
          else if (event.key === '+' || event.key === '=' || event.key === '-') { event.preventDefault(); zoom(event.key === '-' ? -1 : 1); }
          else if (event.key === 'Home') { event.preventDefault(); controls.current?.reset(); setZoomLevel(0); choosePlace('miami'); playSound('focus'); }
        }}
      >
        <div className="cultural-atlas__atmosphere" aria-hidden="true" />
        {status !== "fallback" && <div className="cultural-atlas__zoom" aria-label="Globe camera controls" data-sound-owned>
          <button onClick={() => zoom(1)} disabled={zoomLevel === 3} aria-label="Zoom globe in"><MagnifyingGlassPlus size={19} /></button>
          <span aria-live="polite">{zoomFactor.toFixed(2)}×</span>
          <button onClick={() => zoom(-1)} disabled={zoomLevel === 0} aria-label="Zoom globe out"><MagnifyingGlassMinus size={19} /></button>
          <button onClick={() => { controls.current?.focus(selectedRef.current); playSound("focus"); }} aria-label="Focus selected destination"><Crosshair size={19} /></button>
        </div>}
        {status !== "fallback" && (
          <div className="cultural-atlas__markers">
            {places.map((place) => (
              <button
                key={place.id}
                className={`cultural-atlas__marker ${place.id === (selected ?? "miami") ? "is-selected" : ""} cultural-atlas__marker--${place.id}`}
                ref={(node) => {
                  if (node) markers.current.set(place.id, node);
                  else markers.current.delete(place.id);
                }}
                onClick={() => choosePlace(place.id)}
                onFocus={() => controls.current?.refresh()}
                onPointerEnter={() => controls.current?.refresh()}
                data-sound-owned
                data-place={place.id}
                aria-label={`Explore ${place.name}`}
                aria-pressed={place.id === (selected ?? "miami")}
                data-cursor="Explore"
              >
                <span className="cultural-atlas__pin" aria-hidden="true" />
                <span className="cultural-atlas__label">
                  {place.name}
                  {place.id === (selected ?? "miami") && <small>SELECTED DESTINATION</small>}
                </span>
              </button>
            ))}
          </div>
        )}
        {status === "fallback" && (
          <div className="cultural-atlas__fallback">
            <span
              className="cultural-atlas__fallback-orbit"
              aria-hidden="true"
            />
            <p>The world is still yours to explore.</p>
            <span>Choose a destination below.</span>
          </div>
        )}
      </div>
      <div className="cultural-atlas__footer">
        {status !== "fallback" && (
          <div className="cultural-atlas__controls" aria-label="Globe controls">
            <span className="cultural-atlas__hint">DRAG TO EXPLORE</span>
            <button
              data-sound="drag"
              onClick={() => controls.current?.rotate(-0.3)}
              aria-label="Rotate globe left"
              title="Rotate left"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              data-sound="drag"
              onClick={() => controls.current?.rotate(0.3)}
              aria-label="Rotate globe right"
              title="Rotate right"
            >
              <ArrowRight size={16} />
            </button>
            <button
              data-sound="focus"
              onClick={() => { controls.current?.reset(); setZoomLevel(0); choosePlace('miami'); }}
              aria-label="Reset globe to Miami"
              title="Return to Miami"
            >
              <ArrowCounterClockwise size={16} />
            </button>
            {!calm && (
              <button
                onClick={toggleRotation}
                aria-label={
                  paused ? "Start globe rotation" : "Pause globe rotation"
                }
                title={paused ? "Start rotation" : "Pause rotation"}
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}
          </div>
        )}
        <details
          className="cultural-atlas__destinations"
          ref={destinationMenu}
          open={status === "fallback" ? true : undefined}
        >
          <summary>
            All destinations <span aria-hidden="true">↗</span>
          </summary>
          <div
            className="cultural-atlas__destination-list"
            aria-label="Browse destinations without the globe"
          >
            {places.map((place) => (
              <button
                key={place.id}
                onClick={() => choosePlace(place.id)}
                data-sound-owned
                aria-pressed={place.id === selected}
              >
                {place.name}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
