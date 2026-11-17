import { visibleInkAt, rankedInkHits, cycleInkHit } from './ink-picking.js';
import * as THREE from 'three';
import { INDEX, INDEX_ALL, COUNTS, EYES, MARKS, shapePositions, shapePositionsV1, legacyPositions } from './mesh.js';
import { FIT_GROUPS, fitVisible, fitFromV47 } from './fit.js';
import { createSkin, updateSkin, setSkinFace, skinFaceOn, setSkinHair, setSkinBeard, setSkinBodyHair, setSkinIris, skinIrisHex, skinPhotoIrisHex } from './skin.js';
import { HAIR_STYLES, HAIR_COLOURS } from './hair.js';
import { BEARD_STYLES } from './beard.js';
import { createHairShell, createHairStrands } from './hair-shell.js';
import { buildStrands, buildBeard, skullMove } from './hair-strands.js';
import { FACE_MAP } from './face-map.js';
import { landmarks3D, faceMorph } from './face-fit.js';
import { FACE_DEPTH } from './face-depth.js';
import { buildAdjacency, buildDecal, UV_MARGIN } from './decal.js';
import './slider.js';
import {twoPointerDelta,twoFingerIntent,wrapAngle,planTapPlacement} from './view-gestures.js';
import {findLiveAlignment,findCentreLine} from './live-alignment.js';
import { editArtwork } from './cleanup.js';
import { applyArtworkRevision } from './cleanup-links.js';
import { readPending, writePending, editFileName, artworkAsSeen, clipboardImage, normalisePicture } from './procreate-edit.js';
import { openShelf, openProjectShelf } from './shelf.js';
import { createAccount } from './account.js';
import { emailCodes } from './cloud.js';
import { openPlanning } from './planning.js';
import { openLayers } from './layers.js';
import { makeArtistPacket } from './artist-packet.js';
import { cleanState, imageKeysFor, REACTIONS, SUGGEST_KEYS } from './project.js';
import { openStore } from './store.js';
import { sampleSun, sampleSprig } from './sample-art.js';
import { dataUrlBlob, shareOrDownload, canShareFiles } from './share.js';
import { createBeforeAfter } from './before-after.js';
import { createPoseView } from './pose-view.js';
import { createClothes, TOPS, BOTTOMS, HAIR, coverage as clothesCoverage } from './clothes.js';
import { OUTFITS, visibilityText, sittingWear } from './visibility.js';
import { sizeLikeText } from './size-like.js';
import { planMessage } from './plan-text.js';
import { placeLabels, sizeLabel, leader } from './size-labels.js';
import { changeWords, undoToast, historyList } from './undo-words.js';
import { wearAt } from './wear.js';
import { installPenTap, controlAt } from './pen-tap.js';
import { POSE_CATALOG, POSE_GROUPS, MOTION_CATALOG, catalogRotations } from './pose-catalog.js';
import { AGES, ageInk } from './aging.js';
import { skinSet, inkColours, swatchesFile } from './swatches.js';
import { GUIDE_SIZE, areaExtent, drawGuide, inkBox, clearShare } from './procreate-draw.js';
import { patchMaskTriangles } from './procreate-patch.js';
import { makePatchReference } from './patch-reference.js';
import { toneColour, nearestTone, sampleSkin, skinCheck, hexToRgb } from './skin-tone.js';
import { LIGHTS, readLight, writeLight, applyLight } from './lighting.js';
import { NEW_FEATURES as ALL_FEATURES, readTried, writeTried, untriedCount, ordered, readSeen, writeSeen, unseenCount } from './whats-new.js';
import { curvedArt, compose, pinch } from './try-on.js';
import { SPOTS, spotAim, turnAlong, spotNote, edgeTris, girthAt, fitNote } from './spots.js';
import { POSE_BONES, vertexBones, skinPose } from './pose.js';
import { stretchUnder, stretchText } from './stretch.js';
import { posesFor } from './pose-pick.js';
import { PART_NAMES } from './body-photo.js';
import { stencilLines, stencilPixels, stencilScale, pngWithDpi, artSharpness } from './stencil.js';
import { findDesigns, inDesign } from './flash.js';
import { meshNeighbours, alongSkin, aroundAt, tapeText } from './tape.js';
import { inkCheck, inkCheckPixels, widthForLines } from './ink-check.js';
import { DISTANCES, shrinkFor, distanceText, softenRGBA } from './distance.js';
import { unrollLimb, mapTriangle, mapBounds, typicalRound } from './limb-map.js';
import { BODY_CHANGES, changedShape, skinGrowth, growthWords, changeLine } from './body-change.js';
import { makeRef, approvalHtml, parseAnswers } from './approval.js';
import { coverByArt, coverText } from './cover.js';
import { painMap, painFor, smoothLevels, painColour, painWords, painLine, vertexNeighbours, painUnder } from './pain.js';
import { OFF_LIMITS, clearance, inkSeeds, vertexAreas, halfGirth, acrossAt, roomByRegion, roomColour, roomSummary, inchWords, coveredArea, coveredByArea, coveredText } from './room.js';
import { whereItSits } from './where.js';
import { sessionHours, sessionText, planText } from './estimate.js';
import { evenness, evennessText, limbLine, straighten, readsFor } from './symmetry.js';
import { planSittings, dayWords, sittingHours, sittingsCalendar, clearOn, tripClash, sleepLine, sittingCost, planCalendar, planCalendarText, planCalendarFile } from './sittings.js';
import { keepVersion, useVersion, versionList } from './versions.js';
import { matchesComment } from './comment-find.js';
import { writePrefs, readPrefs as readDevicePrefs } from './prefs.js';
import { initWrapStudio } from './wrap-studio.js';
import { limbAxis, limbPlace, limbPoint, LimbDrag, rotFor, rotRound, shareRound, wrapAngle as wrapA } from './wrap-drag.js';
import { mentionsMe, pieces as mentionPieces, typingMention, offer as mentionOffer, insertMention } from './mention.js';
const newSeen = readSeen();
// Each instruction on screen shows until it has been followed once on this device, then gets out of the way.
const TAUGHT_KEY = 'ia-taught', taught = (() => { try { return new Set(JSON.parse(localStorage.getItem(TAUGHT_KEY) || '[]')); } catch (_) { return new Set(); } })();
// the fine print under the pain map and open skin is read once, then the bars stay slim
let painSeen = false, roomSeen = false;
function learnt(k) { taught.add(k); try { localStorage.setItem(TAUGHT_KEY, JSON.stringify([...taught])); } catch (_) { /* private mode: lasts until reload */ } }

// a feature that needs the account's email sender is listed only once that is switched on
const NEW_FEATURES = ALL_FEATURES.filter((f) => !f.needs || (f.needs === 'emailCodes' && emailCodes));
// comments pinned to the body, and the tattoo whose "Ask for a change" box is open (used early by renderUI)
const pins = { on: false, pending: null, open: null, els: new Map(), ids: '', list: false, filter: 'open', forTattoo: null, find: '' };
let changeFor = null;
const $ = (s) => document.querySelector(s);
const V3 = THREE.Vector3;
const SKINS = ['#f1d3bd', '#e0b394', '#c6916c', '#9a6644', '#6a422a'];
const FOV = 30;
const STENCIL = '#8474ff';

/* ---------- state ---------- */
// v2: muscle and weight run 0..1 with 0.5 = average; `fit` holds the fine-tune sliders (-1..1, see fit.js).
const freshState = () => ({ app: 'ink-atlas-proto', v: 2, tattoos: [], skin: 1, heightCm: 175, figure: 'male', muscle: 0.6, weight: 0.5, fit: {}, genitals: false }); // genitals off for anything new; older saves without the field keep them shown (cleanState)
let state = freshState();
let images = {}; // key -> dataURL
const imgEls = {}; // key -> HTMLImageElement
let selectedId = null;
let tapPlaceId = null;
const tape = { on: false, mode: 'along', pts: [], result: null, key: -1, group: null, nb: null, nbOf: null }; // the tape measure (only for looking, never saved)
let soloIds = null;
const undoStack = [];
const redoStack = [];
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- three setup ---------- */
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
stage.appendChild(renderer.domElement);
const canvas = renderer.domElement;
canvas.style.touchAction = 'none';

const scene = new THREE.Scene();
// the studio backdrop: a soft pool of light, dark or light with the device's appearance
function paintBackdrop() {
  const css = getComputedStyle(document.documentElement), v = (k, d) => css.getPropertyValue(k).trim() || d;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 215, 20, 256, 256, 380);
  gr.addColorStop(0, v('--stage-a', '#474b59')); gr.addColorStop(0.55, v('--stage-b', '#2a2d37')); gr.addColorStop(1, v('--stage-c', '#17181d'));
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const old = scene.background; scene.background = tex; if (old && old.dispose) old.dispose();
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = v('--bg', '#17181d');
}
paintBackdrop();
try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { paintBackdrop(); needsRender = true; }); } catch (_) { /* older browsers: keeps the first look */ }
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
scene.add(camera);
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a4652, 1.15); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff4ea, 2.1);
key.position.set(-0.7, 0.9, 0.6); camera.add(key);
const keyTarget = new THREE.Object3D(); keyTarget.position.set(0, 1, 0); scene.add(keyTarget); key.target = keyTarget;
const rim = new THREE.DirectionalLight(0xb9c4ff, 1.0); rim.position.set(2, 2.5, -3); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0xffd9c4, 0.5); rim2.position.set(-2.5, 1, -2); scene.add(rim2);

const bodyGeo = new THREE.BufferGeometry();
bodyGeo.setAttribute('position', new THREE.BufferAttribute(legacyPositions(), 3));
const idxBody = new THREE.BufferAttribute(INDEX, 1), idxAll = new THREE.BufferAttribute(INDEX_ALL, 1); // without / with the genital geometry
bodyGeo.setIndex(idxBody);
bodyGeo.computeVertexNormals();
bodyGeo.computeBoundingBox(); bodyGeo.computeBoundingSphere();
const { mat: skinMat, uniforms: skinU } = createSkin(bodyGeo, SKINS[1]);
let shapeKey = 0;
let wrapStudio = null; // the measured wrap studio (wrap-studio.js), made once the body exists
let poseView = null; // set up once the body exists; poses are for looking and never saved
const genitalsShown = () => state.figure === 'male' && state.genitals !== false;
// My face (see the My face section): its state is here because the body is built before that code runs.
const face = { saved: null, busy: false, uv: null, version: 0 };
let faceMorphCache = { key: '', off: null };
// Vertices past this are the genital geometry, which is only on the body when shown.
const vertEnd = () => (genitalsShown() ? COUNTS.body + COUNTS.eyes + COUNTS.genital : COUNTS.body + COUNTS.eyes) * 3;
// Put raw positions on the body and refresh everything derived from them.
let afterShape = null; // set once the hair strands exist
function setBodyPositions(pos, withGenitals) {
  bodyGeo.attributes.position.array.set(pos); bodyGeo.attributes.position.needsUpdate = true;
  bodyGeo.setIndex(withGenitals ? idxAll : idxBody);
  bodyGeo.computeVertexNormals();
  const fm = faceShapeOffsets(); if (fm) { const P = bodyGeo.attributes.position.array; for (let i = 0; i < fm.length; i++) P[i] += fm[i]; bodyGeo.computeVertexNormals(); }
  bodyGeo.computeBoundingBox(); bodyGeo.computeBoundingSphere();
  const fem = state.figure === 'female' ? 1 : state.figure === 'male' ? 0 : 0.5;
  updateSkin(bodyGeo, skinU, (0.0155 + 0.006 * fem) * (1 + 0.35 * ((state.fit && state.fit.nippleSize) || 0)), state);
  shapeKey++; needsRender = true; if (poseView) poseView.invalidate(); if (afterShape) afterShape();
}
function applyShape() { setBodyPositions(shapePositions(state), genitalsShown()); }
const body = new THREE.Mesh(bodyGeo, skinMat);
scene.add(body); body.updateMatrixWorld(true);

let floorShadow = null;
{ // soft floor shadow
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.001; scene.add(m); floorShadow = m;
}
const decalGroup = new THREE.Group(); scene.add(decalGroup);
const areolaSize = () => { const fem = state.figure === 'female' ? 1 : state.figure === 'male' ? 0 : 0.5; return (0.0155 + 0.006 * fem) * (1 + 0.35 * ((state.fit && state.fit.nippleSize) || 0)); };
poseView = createPoseView({ THREE, bodyMesh: body, bodyGeo, skinMat, state: () => state, areola: areolaSize, onChange: () => { needsRender = true; if (typeof renderPose === 'function') renderPose(); } });
const clothes = createClothes({ THREE, bodyGeo, scene, rig: () => poseView.restRig(), posed: () => (poseView.active ? (poseView.ensure(), poseView.geometry) : null) });
const decals = {}; // id -> {mesh, outline, tex, texKey}

/* ---------- camera rig ---------- */
const cur = { theta: 0.35, phi: 1.45, roll: 0, r: 4.2, tx: 0, ty: 0.86, tz: 0 };
const goal = { ...cur };
// who else has a shared project open (account.js), and whose view this one follows
let peersHere = [], followId = null;
let glide = true; let needsRender = true;
function fullBodyR() {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return Math.max(2.7 / (2 * t), 1.35 / (2 * t * camera.aspect));
}
function fullBody(theta) {
  if (theta != null) goal.theta = theta;
  goal.roll = 0; goal.phi = 1.5; goal.r = fullBodyR(); goal.tx = 0; goal.ty = 0.73; goal.tz = 0.02; glide = true; needsRender = true;
  // In wide landscape with the edit panel open as a column at the right, the whole body is framed in
  // the space left of it rather than centred on the screen behind the column.
  if (!$('#sheet').hidden) try {
    const b = canvas.getBoundingClientRect(), { top, bottom, left, right } = freeArea(), w = right - left, h = bottom - top;
    const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    if (b.width > 0 && w < b.width * 0.8 && w > 240) {
      const availW = w / b.width;
      goal.r = Math.max(goal.r, 1.35 / (2 * tn * camera.aspect * availW));
      const side = 2 * goal.r * tn * camera.aspect * ((left + right) / 2 - b.left - b.width / 2) / b.width;
      goal.tx = -Math.cos(goal.theta) * side; goal.tz = 0.02 + Math.sin(goal.theta) * side;
    }
    // and in portrait, above the edit panel when it is open, so the feet are not behind it
    if (b.height > 0 && h < b.height * 0.7 && h > 200) {
      goal.r = Math.max(goal.r, 2.0 / (2 * tn * (h / b.height)));
      goal.ty = 0.73 - 2 * goal.r * tn * (0.5 - ((top + bottom) / 2 - b.top) / b.height);
    }
  } catch (_) {}
}
function focusTattoo(t) {
  if (followId) stopFollow();
  const spot = viewSpot(t);
  // the tattoo fills about a third of the free space, with enough body round it to see where it sits
  aimView(spot.pos, spot.normal, Math.max(t.width, t.width / t.aspect) * 2.2 + 0.12);
}
// Turn and zoom the camera to look at pos along normal, with about ext of body in the free space.
function aimView(pos, normal, ext) {
  if (followId) stopFollow();
  const spot = { pos, normal };
  const n = new V3(...spot.normal);
  goal.theta = Math.atan2(n.x, n.z);
  goal.phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)), 0.75, 2.0);
  goal.tx = spot.pos[0]; goal.ty = spot.pos[1]; goal.tz = spot.pos[2];
  const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const bounds=canvas.getBoundingClientRect(),{top,bottom,left,right}=freeArea();
  const available=THREE.MathUtils.clamp((bottom-top)/Math.max(1,bounds.height),.18,1),availableW=THREE.MathUtils.clamp((right-left)/Math.max(1,bounds.width),.18,1);
  goal.r = THREE.MathUtils.clamp(ext / (2 * tn * Math.min(available, camera.aspect * availableW)), 0.45, 3.2);
  const shiftFrac=THREE.MathUtils.clamp(.5-((top+bottom)/2-bounds.top)/Math.max(1,bounds.height),-.2,.4),shift=2*goal.r*tn*shiftFrac;
  const sideFrac=THREE.MathUtils.clamp(((left+right)/2-bounds.left)/Math.max(1,bounds.width)-.5,-.3,.3),side=2*goal.r*tn*camera.aspect*sideFrac;
  // Move the aim point in camera-screen up, including view roll, so the selected
  // artwork lands in the measured unobscured area rather than behind the dock.
  const st=Math.sin(goal.theta),ct=Math.cos(goal.theta),sp=Math.sin(goal.phi),cp=Math.cos(goal.phi),sr=Math.sin(goal.roll||0),cr=Math.cos(goal.roll||0);
  const up=new V3(-cp*st*cr-ct*sr,sp*cr,-cp*ct*cr+st*sr);
  const rt=new V3(ct*cr-cp*st*sr,sp*sr,-st*cr-cp*ct*sr);
  goal.tx=spot.pos[0]-up.x*shift-rt.x*side;goal.ty=spot.pos[1]-up.y*shift-rt.y*side;goal.tz=spot.pos[2]-up.z*shift-rt.z*side;
  glide = true; needsRender = true;
}
// The part of the screen that no panel covers: below the top bar, above (or left of) the dock.
function placeChrome() {
  const body = document.body, v = $('#views'), tb = $('#top .toolbar'), br = $('#top .brand');
  body.classList.remove('views-low');
  const vr = v.getBoundingClientRect(), tr = tb.getBoundingClientRect(), b = br.getBoundingClientRect();
  const fits = vr.right <= tr.left - 8 && tr.right <= innerWidth - 4 && vr.left >= 0 && (!b.width || vr.left >= b.right + 4) && Math.abs(vr.top - tr.top) < 30;
  if (!fits) { body.classList.add('views-low'); document.documentElement.style.setProperty('--views-top', Math.round($('#top').getBoundingClientRect().bottom - 4) + 'px'); }
  const bottom = Math.max($('#top').getBoundingClientRect().bottom, fits ? 0 : v.getBoundingClientRect().bottom + 8);
  document.documentElement.style.setProperty('--below', Math.round(bottom) + 'px');
  // panels at the right stop above the tray wherever the tray sits under them
  const tr2 = $('#tray').getBoundingClientRect(), popLeft = innerWidth - 356;
  const gap = tr2.height && tr2.right > popLeft ? Math.max(24, Math.round(innerHeight - tr2.top + 12)) : 24;
  document.documentElement.style.setProperty('--tray-gap', gap + 'px');
}
addEventListener('resize', () => { placeChrome(); requestAnimationFrame(placeChrome); setTimeout(placeChrome, 300); });
{ const ro = new ResizeObserver(() => requestAnimationFrame(placeChrome)); ro.observe($('#top .toolbar')); ro.observe($('#top')); ro.observe($('#tray')); }
if (document.fonts) document.fonts.ready.then(placeChrome);
placeChrome();
function freeArea() {
  const b = canvas.getBoundingClientRect(), d = $('#dock').getBoundingClientRect();
  const top = Math.max(b.top, $('#top').getBoundingClientRect().bottom, $('#views').getBoundingClientRect().bottom) + 12;
  const side = d.height > b.height * 0.5 && d.left > b.left + b.width * 0.4; // the panel stands at the right in landscape
  const firstShown = [...$('#dock').children].map((n) => n.getBoundingClientRect()).filter((r) => r.height > 0);
  const dockTop = firstShown.length ? Math.min(...firstShown.map((r) => r.top)) : b.bottom;
  const bottom = side ? b.bottom - 12 : Math.max(top + 80, Math.min(b.bottom - 12, dockTop - 14));
  const right = side ? d.left + 4 : b.right - 12;
  // a panel open at the left (Try other spots) takes that side too
  const sp = !$('#spotPop').hidden ? $('#spotPop') : $('#bodyMatch'), spr = sp.hidden ? null : sp.getBoundingClientRect();
  const left = spr && spr.right < right - 240 ? spr.right + 12 : b.left + 12;
  const ws = document.getElementById('wrapStudio');
  if (ws && !ws.hidden) { const w = ws.getBoundingClientRect(); if (w.left > b.left + b.width * 0.3) return { top, bottom, left, right: Math.min(right, w.left - 8) }; return { top, bottom: Math.max(top + 60, Math.min(bottom, w.top - 10)), left, right }; }
  return { top, bottom, left, right };
}
// Already in sight: on screen above the bottom panels, below the top bar, and facing us.
function inSight(t) {
  const spot = viewSpot(t), b = canvas.getBoundingClientRect(), p = screenOf(new V3(...spot.pos));
  const toCam = camera.position.clone().sub(new V3(...spot.pos)).normalize();
  if (new V3(...spot.normal).dot(toCam) < 0.25) return false;
  const f = freeArea();
  return p.x > f.left && p.x < f.right && p.y > f.top && p.y < f.bottom;
}
// After a tap opens the edit panel over the very tattoo you tapped, slide the picture just far
// enough to clear the panel. Same zoom, same angle: only a small shift, and only when covered.
function keepClearOfPanels(t) {
  const spot = viewSpot(t), p = screenOf(new V3(...spot.pos)), f = freeArea(), m = 40;
  const toCam = camera.position.clone().sub(new V3(...spot.pos)).normalize();
  if (new V3(...spot.normal).dot(toCam) < 0.1) return;
  let dx = 0, dy = 0;
  if (p.y > f.bottom - m) dy = f.bottom - m - p.y; else if (p.y < f.top + m) dy = f.top + m - p.y;
  if (p.x > f.right - m) dx = f.right - m - p.x; else if (p.x < f.left + m) dx = f.left + m - p.x;
  if (!dx && !dy) return;
  const k = (2 * cur.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / canvas.getBoundingClientRect().height;
  const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0), up = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
  const mx = -dx * k, my = dy * k;
  goal.tx += right.x * mx + up.x * my; goal.ty += right.y * mx + up.y * my; goal.tz += right.z * mx + up.z * my;
  glide = true; needsRender = true;
}
// Tapping a tattoo keeps your view. Only when it is out of sight (picked from the tray or the
// layers list while looking elsewhere) does the camera go and find it.
function revealTattoo(t) { if (!inSight(t)) focusTattoo(t); }
function applyCam() {
  const s = Math.sin(cur.phi);
  camera.position.set(cur.tx + cur.r * s * Math.sin(cur.theta), cur.ty + cur.r * Math.cos(cur.phi), cur.tz + cur.r * s * Math.cos(cur.theta));
  camera.up.set(0,1,0);
  camera.lookAt(cur.tx, cur.ty, cur.tz);
  camera.rotateZ(cur.roll || 0);
  camera.updateMatrixWorld(true);
}
// with Reduce Motion on in the device's settings, the view goes straight to a new spot instead of gliding
const reduceMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function stepCam(dt) {
  const k = glide && reduceMotion.matches ? 1 : 1 - Math.exp(-dt * (glide ? 5 : 18));
  let d = 0;
  for (const p of ['phi', 'r', 'tx', 'ty', 'tz']) { const dv = goal[p] - cur[p]; cur[p] += dv * k; d += Math.abs(dv); }
  let dth = goal.theta - cur.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); cur.theta += dth * k; d += Math.abs(dth);
  const dr=wrapAngle((goal.roll||0)-(cur.roll||0));cur.roll=wrapAngle((cur.roll||0)+dr*k);d+=Math.abs(dr);
  applyCam();
  if (d < 2e-4) { glide = false; return false; }
  return true;
}
// While the Body panel is open the picture slides over, so the body stays centred in the free space.
let curInset = 0, goalInset = 0;
function applyInset() { const w = stage.clientWidth || 800, h = stage.clientHeight || 600; if (curInset > 0.5) camera.setViewOffset(w, h, curInset / 2, 0, w, h); else camera.clearViewOffset(); }
function updateInset() { const p = $('#bodyPop'), w = stage.clientWidth || 800; document.body.classList.toggle('panel-open', !p.hidden); goalInset = !p.hidden && w - p.offsetWidth > 300 ? p.offsetWidth + 16 : 0; needsRender = true; }
function resize() {
  const w = stage.clientWidth || 800, h = stage.clientHeight || 600;
  renderer.setSize(w, h, false);
  canvas.style.width = '100%'; canvas.style.height = '100%';
  camera.aspect = w / h; camera.updateProjectionMatrix(); updateInset(); applyInset(); needsRender = true;
}
new ResizeObserver(resize).observe(stage); resize();
cur.r = fullBodyR() * 1.25; fullBody(0);

/* ---------- raycast helpers ---------- */
const ray = new THREE.Raycaster();
function ndc(x, y) { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); }
function hitBody(x, y) {
  ray.setFromCamera(ndc(x, y), camera);
  if (!poseView.active) { const h = ray.intersectObject(body, false)[0]; return h || null; }
  // In a pose the finger touches the posed body; everything else works on the rest
  // body, so report the same skin there (same triangle, same barycentric weights).
  const h = poseView.withPosed(() => ray.intersectObject(body, false)[0]);
  if (!h || !h.face || !h.barycoord) return null;
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array, ids = [h.face.a, h.face.b, h.face.c], w = [h.barycoord.x, h.barycoord.y, h.barycoord.z];
  const point = new V3(), normal = new V3();
  for (let k = 0; k < 3; k++) { point.x += P[ids[k] * 3] * w[k]; point.y += P[ids[k] * 3 + 1] * w[k]; point.z += P[ids[k] * 3 + 2] * w[k]; normal.x += N[ids[k] * 3] * w[k]; normal.y += N[ids[k] * 3 + 1] * w[k]; normal.z += N[ids[k] * 3 + 2] * w[k]; }
  return { point, normal: normal.normalize(), face: h.face, faceIndex: h.faceIndex, barycoord: h.barycoord, distance: h.distance, posedPoint: h.point };
}
// Where a tattoo is on screen right now: its rest spot, or the same skin in the pose.
const spotCache = new Map();
function viewSpot(t) {
  if (!poseView.active) return { pos: t.pos, normal: t.normal };
  const k = t.pos.join(',') + '|' + t.normal.join(',') + '|' + shapeKey;
  let c = spotCache.get(t.id);
  if (!c || c.k !== k) {
    const tri = startTriangle(t), I = bodyGeo.index.array, P = bodyGeo.attributes.position.array;
    const [a, b, d] = [0, 1, 2].map((j) => new V3().fromArray(P, I[tri * 3 + j] * 3));
    const w = new V3(); THREE.Triangle.getBarycoord(new THREE.Triangle(a, b, d).closestPointToPoint(new V3(...t.pos), new V3()), a, b, d, w);
    c = { k, tri, w: [w.x, w.y, w.z] }; spotCache.set(t.id, c);
  }
  return poseView.pointOn(c.tri, c.w);
}
function surfaceAt(origin, dir) { ray.set(origin, dir.clone().normalize()); const h = ray.intersectObject(body, false)[0]; return h ? { pos: h.point.toArray(), normal: h.normal.clone().normalize().toArray() } : null; }
function frameOf(t) {
  const n = new V3(...t.normal).normalize();
  const ref = Math.abs(n.y) > 0.93 ? new V3(0, 0, -1) : new V3(0, 1, 0);
  const x = new V3().crossVectors(ref, n).normalize();
  const y = new V3().crossVectors(n, x).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), t.rot || 0));
  return { q, n, right: new V3(1, 0, 0).applyQuaternion(q), up: new V3(0, 1, 0).applyQuaternion(q) };
}
function insideTattoo(point, t, pad = 1.12) {
  const f = frameOf(t); const d = point.clone().sub(new V3(...t.pos));
  const hw = Math.max(t.width / 2 * pad, 0.028), hh = Math.max(t.width / t.aspect / 2 * pad, 0.028);
  return Math.abs(d.dot(f.right)) <= hw && Math.abs(d.dot(f.up)) <= hh && Math.abs(d.dot(f.n)) < 0.09;
}
const inkPixels=new WeakMap();
function inkIdsAt(x,y,bodyHit=hitBody(x,y)) {
 if(!bodyHit)return [];
 ray.setFromCamera(ndc(x,y),camera);
 const entries=state.tattoos.map((t,order)=>({t,order,d:decals[t.id]})).filter(e=>!e.t.hidden&&e.d?.mesh.visible&&e.d.tex);
 const hits=[];for(const e of entries)for(const h of poseView.withPosed(()=>ray.intersectObject(e.d.mesh,false),[e.d.mesh]))if(h.uv)hits.push({id:e.t.id,order:e.order,distance:h.distance,uv:h.uv,tex:e.d.tex});
 return rankedInkHits(hits,bodyHit.distance,h=>{try{let pixels=inkPixels.get(h.tex);if(!pixels){pixels=h.tex.image.getContext('2d',{willReadFrequently:true}).getImageData(0,0,h.tex.image.width,h.tex.image.height);inkPixels.set(h.tex,pixels);}return visibleInkAt(pixels,h.uv.x,h.uv.y,h.tex.flipY);}catch{return false;}});
}
let lastInkTap=null;

function nearestIndex(p) { const P = bodyGeo.attributes.position.array, end = vertEnd(); let best = 0, bd = Infinity; for (let i = 0; i < end; i += 3) { const d = (P[i] - p[0]) ** 2 + (P[i + 1] - p[1]) ** 2 + (P[i + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i / 3; } } return best; }
function anchorsNow() {
  return state.tattoos.map((t) => {
    const n = new V3(...t.normal).normalize(); ray.set(new V3(...t.pos).addScaledVector(n, 0.06), n.clone().negate()); ray.far = 0.25;
    const h = ray.intersectObject(body, false)[0]; ray.far = Infinity;
    if (h && h.face && h.barycoord) return { v: [h.face.a, h.face.b, h.face.c], w: [h.barycoord.x, h.barycoord.y, h.barycoord.z] };
    const i = nearestIndex(t.pos); return { v: [i, i, i], w: [1, 0, 0] };
  });
}
function applyAnchors(an) {
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array;
  state.tattoos.forEach((t, i) => { const A = an[i]; if (!A) return; const p = [0, 0, 0], n = [0, 0, 0];
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { p[j] += P[A.v[k] * 3 + j] * A.w[k]; n[j] += N[A.v[k] * 3 + j] * A.w[k]; }
    const l = Math.hypot(n[0], n[1], n[2]) || 1; t.pos = p; t.normal = [n[0] / l, n[1] / l, n[2] / l]; });
}
function reshape(fn) { const an = anchorsNow(); fn(); applyShape(); applyAnchors(an); }
/* ---------- decals ---------- */
function loadImg(keyName) {
  if(typeof images[keyName]!=='string'||!images[keyName].startsWith('data:image/'))return Promise.resolve(null);
  if (imgEls[keyName]) return Promise.resolve(imgEls[keyName]);
  return new Promise((res) => { const im = new Image(); im.onload = () => { imgEls[keyName] = im; res(im); }; im.onerror = () => res(null); im.src = images[keyName]; });
}
function inkTexture(t) {
  const im = imgEls[t.img]; const c = document.createElement('canvas');
  const W = Math.min(1024, Math.max(64, im ? im.naturalWidth : 256)); c.width = W; c.height = Math.max(8, Math.round(W / t.aspect));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  if (im) { g.save(); g.globalAlpha = t.opacity ?? 0.92; if (t.flip) { g.translate(c.width, 0); g.scale(-1, 1); } const mx = UV_MARGIN * c.width, my = UV_MARGIN * c.height; g.drawImage(im, mx, my, c.width - 2 * mx, c.height - 2 * my); g.restore(); }
  if (im && agingYears > 0) {
    // the ink as it would look after this many years (only for looking)
    const mm = t.width * 1000 * (state.heightCm || 175) / 175, d = g.getImageData(0, 0, c.width, c.height);
    ageInk(d.data, c.width, c.height, agingYears, (c.width * (1 - 2 * UV_MARGIN)) / Math.max(1, mm)); g.putImageData(d, 0, 0);
  }
  const tex = new THREE.CanvasTexture(c); tex.flipY = !t.imageTopDown; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function outlineTexture(aspect) {
  const c = document.createElement('canvas'); c.width = 384; c.height = Math.max(24, Math.round(384 / aspect));
  const g = c.getContext('2d'); g.strokeStyle = STENCIL; g.lineWidth = 5; g.setLineDash([14, 10]);
  const mx = UV_MARGIN * c.width + 3, my = UV_MARGIN * c.height + 3;
  g.strokeRect(mx, my, c.width - 2 * mx, c.height - 2 * my);
  g.setLineDash([]); g.fillStyle = STENCIL;
  for (const [x, y] of [[mx, my], [c.width - mx, my], [mx, c.height - my], [c.width - mx, c.height - my]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
// Adjacency is rebuilt only when the index buffer changes (genitals shown/hidden).
let adjCache = { key: '', adj: null };
function bodyAdjacency() { const key = bodyGeo.index === idxAll ? 'all' : 'body'; if (adjCache.key !== key) adjCache = { key, adj: buildAdjacency(bodyGeo.index.array) }; return adjCache.adj; }
function startTriangle(t) {
  const n = new V3(...t.normal).normalize(); ray.set(new V3(...t.pos).addScaledVector(n, 0.06), n.clone().negate()); ray.far = 0.3;
  const h = ray.intersectObject(body, false)[0]; ray.far = Infinity;
  if (h && h.faceIndex != null) return h.faceIndex;
  const I = bodyGeo.index.array, P = bodyGeo.attributes.position.array; let best = 0, bd = Infinity;
  for (let tri = 0; tri < I.length / 3; tri++) { const a = I[tri * 3] * 3, b = I[tri * 3 + 1] * 3, c = I[tri * 3 + 2] * 3; const cx = (P[a] + P[b] + P[c]) / 3 - t.pos[0], cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - t.pos[1], cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - t.pos[2]; const d = cx * cx + cy * cy + cz * cz; if (d < bd) { bd = d; best = tri; } }
  return best;
}
// The arm or leg a tattoo's anchor triangle is on, for a band that wraps right round it.
const limbKeep = new Map();
function decalLimb(tri) {
  const I = bodyGeo.index.array, v = I[tri * 3];
  if (!(v < COUNTS.body)) return null;
  let bone = '', bw = -1; for (const [n, x] of vertexBones(v)) if (x > bw) { bw = x; bone = n; }
  const L = LIMBS.find((q) => q.keep.test(bone)); if (!L) return null;
  if (!limbKeep.has(L.key)) {
    const k = new Uint8Array(COUNTS.body);
    for (let i = 0; i < COUNTS.body; i++) { let b = '', w = -1; for (const [n, x] of vertexBones(i)) if (x > w) { w = x; b = n; } k[i] = L.keep.test(b) ? 1 : L.end.test(b) ? 2 : 0; }
    limbKeep.set(L.key, k);
  }
  const J = poseView.restRig().joints;
  const at = (n) => { const b = POSE_BONES.find((x) => x.name === `${n}.${L.side}`); return [0, 1, 2].map((i) => J[b.head * 3 + i]); };
  return { key: L.key, label: L.label, joints: L.bones.map(at), keep: limbKeep.get(L.key), rest: (bodyGeo.attributes.rest || bodyGeo.attributes.position).array };
}
// A piece on an arm or leg, with the limb's line and how far round it reaches (cached per placement
// and shape). share is of about 2 pi r at its middle: rough, for deciding how to move it.
const wrapCache = new Map();
function wrapInfo(t) {
  if (!t) return null;
  const k = [t.pos, t.normal, t.width, t.aspect, t.rot || 0, shapeKey].join('|'), c = wrapCache.get(t.id);
  if (c && c.k === k) return c.v;
  let v = null;
  const tri = startTriangle(t), L = decalLimb(tri);
  if (L && L.keep[bodyGeo.index.array[tri * 3]] === 1) {
    const ax = limbAxis(L.joints), at = limbPlace(ax, t.pos), f = frameOf(t), h = t.width / t.aspect;
    const sr = shareRound(f.right.toArray(), f.up.toArray(), f.n.toArray(), t.width, h, at);
    v = { L, ax, at, tri, share: sr.share, reach: sr.reach };
    // the bone is seldom in the middle of the limb (the calf hangs behind the shin), so the real
    // loop of skin round it is the measure where it can be walked
    const g = girthHere(t, v); if (g) { v.girth = g; v.share = sr.reach / g; }
  }
  wrapCache.set(t.id, { k, v }); return v;
}
// wide enough round an arm or leg that it is moved like a ring on a rod
const isWrap = (t) => { const w = wrapInfo(t); return !!w && w.share >= 0.35; };
// The limb's own skin at a spot: looked for from outside along the way out, skipping the other leg,
// the body or a hand in between. Rest positions, like everything placed.
function limbSurface(keep, point, out) {
  const o = new V3(...out).normalize();
  ray.set(new V3(...point).addScaledVector(o, 0.12), o.clone().negate()); ray.far = 0.3;
  const hits = ray.intersectObject(body, false); ray.far = Infinity;
  const I = bodyGeo.index.array;
  for (const h of hits) { if (h.faceIndex == null || keep[I[h.faceIndex * 3]] !== 1) continue; return { pos: h.point.toArray(), normal: h.normal.clone().normalize().toArray(), tri: h.faceIndex }; }
  return null;
}
// The loop of skin round the limb at a piece's middle, square to the limb's line (metres), or null.
function girthHere(t, w = wrapInfo(t)) {
  if (!w) return null;
  if (!spotEdges) spotEdges = edgeTris(bodyGeo.index.array, bodyGeo.index.count / 3);
  try { const g = girthAt(bodyGeo.attributes.position.array, bodyGeo.index.array, w.tri, t.pos, w.at.dir, spotEdges); return g > 0.05 && g < 1.2 ? g : null; } catch { return null; }
}
// Lay a piece round its arm or leg: long side round the limb, top towards the body, sized so its
// ends meet at the back. One undo step.
function wrapRound(t) {
  const w = wrapInfo(t); if (!w || !t || t.locked || cannotMove(t)) return false;
  const girth = girthHere(t, w) || 2 * Math.PI * w.at.r;
  const f0 = frameOf({ ...t, rot: 0 }), rot = rotRound(f0.right.toArray(), f0.up.toArray(), w.at.dir, t.aspect);
  snapshot();
  t.rot = rot; t.width = THREE.MathUtils.clamp(t.aspect >= 1 ? girth : girth * t.aspect, 0.012, 0.9);
  markTried('wrapGrab'); commit(); return true;
}
function decalGeometry(t) {
  const st = startTriangle(t), { positions, uvs, supports, tris } = buildDecal(bodyGeo, bodyAdjacency(), t, frameOf(t), st, decalLimb(st));
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.userData.supports = supports; out.userData.tris = tris;
  return out;
}
// Whether a decal's artwork has ink at (u, v): a 256-wide copy, dark enough to show.
function artInk(d, W = 256) {
  const src = d.tex.image, H = Math.max(8, Math.round(W * src.height / src.width));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data, flipped = d.tex.flipY;
  return (u, v) => { const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))), y = Math.min(H - 1, Math.max(0, Math.floor((flipped ? 1 - v : v) * H))), o = (y * W + x) * 4; return 255 - Math.min(px[o], px[o + 1], px[o + 2]) > 70; };
}
// Where a tattoo actually has ink, as points on the body: each decal triangle is sampled on a
// small grid and kept where its artwork is dark. Cached per geometry and artwork.
const inkPointCache = new WeakMap();
function inkPoints(t) {
  const d = decals[t.id]; if (!d || !d.tex || !d.tex.image || !d.mesh.geometry.attributes.position) return null;
  const geo = d.mesh.geometry, key = d.texKey + ':' + geo.attributes.position.version, hit = inkPointCache.get(geo);
  if (hit && hit.key === key) return hit.pts;
  const ink = artInk(d);
  const P = geo.attributes.position.array, U = geo.attributes.uv.array, pts = [], N = Math.max(4, Math.min(12, Math.round(40000 / Math.max(1, P.length / 9))));
  for (let tri = 0; tri < P.length / 9; tri++) for (let i = 0; i <= N; i++) for (let j = 0; i + j <= N; j++) {
    const a = i / N, b = j / N, c0 = 1 - a - b, u = c0 * U[tri * 6] + a * U[tri * 6 + 2] + b * U[tri * 6 + 4], v = c0 * U[tri * 6 + 1] + a * U[tri * 6 + 3] + b * U[tri * 6 + 5];
    if (!ink(u, v)) continue;
    const o = tri * 9; pts.push(c0 * P[o] + a * P[o + 3] + b * P[o + 6], c0 * P[o + 1] + a * P[o + 4] + b * P[o + 7], c0 * P[o + 2] + a * P[o + 5] + b * P[o + 8]);
  }
  // keep the pairwise check quick on big, dense artwork: at most about 4000 points
  const step = Math.max(1, Math.ceil(pts.length / 3 / 4000)), keep = [];
  for (let i = 0; i < pts.length; i += 3 * step) keep.push(pts[i], pts[i + 1], pts[i + 2]);
  const out = new Float32Array(keep); inkPointCache.set(geo, { key, pts: out }); return out;
}
// The nearest other tattoo to t, by the gap between their ink: { name, inches } or null.
function nearestGap(t) {
  const a = inkPoints(t); if (!a || !a.length) return null;
  let best = null;
  for (const o of state.tattoos) {
    if (o.id === t.id || o.hidden) continue;
    const b = inkPoints(o); if (!b || !b.length) continue;
    // quick reject: far apart boxes can't beat the best so far
    let m = Infinity;
    for (let i = 0; i < a.length; i += 3) for (let j = 0; j < b.length; j += 3) { const dx = a[i] - b[j], dy = a[i + 1] - b[j + 1], dz = a[i + 2] - b[j + 2], dd = dx * dx + dy * dy + dz * dz; if (dd < m) m = dd; }
    const inches = Math.sqrt(m) * 100 * (state.heightCm / 175) / 2.54;
    if (!best || inches < best.inches) best = { name: o.name || 'another tattoo', inches };
  }
  return best;
}
// A planned tattoo over ones already on you: how much of the old ink its own ink lays over.
function coverOf(t) {
  if (t.status === 'existing') return null;
  const d = decals[t.id]; if (!d || !d.tex || !d.tex.image || !d.mesh.geometry.attributes.position) return null;
  let best = null, ink = null;
  for (const o of state.tattoos) {
    if (o.id === t.id || o.hidden || o.status !== 'existing') continue;
    const b = inkPoints(o); if (!b || !b.length) continue;
    if (!ink) ink = artInk(d);
    const geo = d.mesh.geometry, share = coverByArt({ tris: geo.attributes.position.array, uvs: geo.attributes.uv.array, oldPts: b, ink, reach: 0.6 / (state.heightCm || 175) });
    if (share > 0 && (!best || share > best.share)) best = { name: o.name || 'the tattoo under it', share };
  }
  return best;
}
function gapText(t) {
  const cv = coverOf(t), ct = cv ? coverText(cv.share, cv.name) : '';
  if (ct) { if (cv.share >= 0.02) markTried('cover'); return ct; }
  const g = nearestGap(t); if (!g) return '';
  if (g.inches < 0.15) return `Touches ${g.name}`;
  return `${g.inches < 10 ? g.inches.toFixed(1) : Math.round(g.inches)} in from ${g.name}`;
}
let gapTimer = 0;
function renderGap() { clearTimeout(gapTimer); gapTimer = setTimeout(() => { const t = sel(), el = $('#gap'); if (!t) { el.hidden = true; return; } const txt = gapText(t); el.textContent = txt; el.hidden = !txt; }, 120); }
let peek = null; // view only: an earlier version of one tattoo shown on the body, { id, v }
let agingYears = 0; // view only: how the ink looks after this many years
function texKeyOf(t) { return [t.img, t.imageTopDown ? 1 : 0, t.flip ? 1 : 0, (t.opacity ?? 0.92).toFixed(2), t.aspect.toFixed(3), agingYears ? agingYears + ':' + (t.width * (state.heightCm || 175)).toFixed(2) : 0].join('|'); }
function syncDecals() {
  const ids = new Set(state.tattoos.map((t) => t.id));
  for (const id of Object.keys(decals)) if (!ids.has(id)) { const d = decals[id]; decalGroup.remove(d.mesh, d.outline); d.mesh.geometry.dispose(); d.tex.dispose(); d.outline.material.map.dispose(); delete decals[id]; }
  state.tattoos.forEach((t0, i) => {
    const t = peek && peek.id === t0.id && imgEls[peek.v.img] ? { ...t0, img: peek.v.img, aspect: peek.v.aspect, flip: peek.v.flip, imageTopDown: peek.v.top } : t0;
    let d = decals[t.id];
    if (!d) {
      const mat = new THREE.MeshBasicMaterial({ blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false });
      const omat = new THREE.MeshBasicMaterial({ map: outlineTexture(t.aspect), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, toneMapped: false });
      d = decals[t.id] = { mesh: new THREE.Mesh(new THREE.BufferGeometry(), mat), outline: new THREE.Mesh(new THREE.BufferGeometry(), omat), tex: null, texKey: '', geoKey: '' };
      decalGroup.add(d.mesh, d.outline);
    }
    const tk = texKeyOf(t);
    if (d.texKey !== tk && imgEls[t.img]) { if (d.tex) d.tex.dispose(); d.tex = inkTexture(t); d.mesh.material.map = d.tex; d.mesh.material.needsUpdate = true; d.texKey = tk; }
    const gk = [t.pos, t.normal, t.width, t.rot, t.aspect, t.wrap || 0, t.bend || 0, t.taper || 0, shapeKey].join('|');
    if (d.geoKey !== gk) { d.mesh.geometry.dispose(); const g = decalGeometry(t); d.mesh.geometry = g; d.outline.geometry = g; d.geoKey = gk; }
    d.mesh.renderOrder = 10 + i; d.outline.renderOrder = 500;
    d.mesh.visible = !t.hidden && !!d.tex && (!soloIds || soloIds.has(t.id)); d.outline.visible = t.id === selectedId && d.mesh.visible && !exporting;
  });
  syncPaint();
  needsRender = true;
}
/* ---------- paint on the body (from Procreate's 3D painting, src/paint-layer.js) ---------- */
let paintSkin = null, paintSkinLoading = null;
function syncPaint() {
  const p = state.paint, im = p && imgEls[p.img];
  if (p && !im) { loadImg(p.img).then((el) => { if (el && state.paint && state.paint.img === p.img) syncPaint(); }); }
  if (!paintSkin) {
    if (!p) return;
    if (!paintSkinLoading) paintSkinLoading = import('./paint-layer.js').then(({ createPaintOverlay }) => { paintSkin = createPaintOverlay({ THREE, body }); syncPaint(); needsRender = true; });
    return;
  }
  paintSkin.set(im || null, !!p && !p.hidden && (!soloIds || !soloIds.size)); needsRender = true;
}
const paintPicture = async () => (state.paint && !state.paint.hidden ? loadImg(state.paint.img) : null);
let exporting = false;

/* ---------- persistence ---------- */
// store.js does the writing. Here: when to save, telling the truth about whether it
// worked, and keeping copies to go back to.
// Following someone else's view on a project worked on together: the camera goes where theirs
// goes until a touch on the body or Stop. Only the view follows; selection and edits stay yours.
const myView = () => [goal.theta, goal.phi, goal.roll || 0, goal.r, goal.tx, goal.ty, goal.tz].map((x) => Math.round(x * 1000) / 1000);
function followPeer(id) { followId = id; applyFollow(); renderFollow(); markTried('followView'); }
function stopFollow(why) { if (!followId) return; followId = null; renderFollow(); if (why) toast(why); }
function applyFollow() {
  if (!followId) return;
  const o = peersHere.find((x) => x.id === followId);
  if (!o) { stopFollow('They closed the project, so you are no longer following their view.'); return; }
  renderFollow();
  if (!o.view) return;
  const [theta, phi, roll, r, tx, ty, tz] = o.view;
  Object.assign(goal, { theta, phi, roll, r, tx, ty, tz }); glide = true; needsRender = true;
}
/* Pointing at a spot for the others on a shared project: in Point mode a tap on the body puts a
   pulsing ring there on everyone's screen, with the name of who pointed, for a few seconds.
   Nothing is saved; it travels with who is here now. */
const POINT_MS = 8000;
const pointing = { on: false, mine: null, mineAt: 0, seq: 0, seen: new Map(), els: [] };
const myPoint = () => (pointing.mine && performance.now() - pointing.mineAt < 30000 ? pointing.mine : null);
function pointMode(on) {
  pointing.on = !!on && peersHere.length > 0;
  if (pointing.on) { if (tape.on) tapeOff(); if (pain.on) painOff(); if (room.on) roomDone(); if (pins.on) pinsOff(); toast(`Tap the body to show ${peerNames()} a spot.`); }
  renderPoints();
}
const peerNames = () => { const n = peersHere.map((o) => o.name || 'Someone'); return n.length < 2 ? (n[0] || 'them') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; };
function pointTap(x, y) {
  const h = hitBody(x, y);
  if (!h || h.faceIndex == null || !h.barycoord) { toast('Tap directly on the body.'); return; }
  pointing.mine = [h.faceIndex, h.barycoord.x, h.barycoord.y, h.barycoord.z, ++pointing.seq]; pointing.mineAt = performance.now();
  renderPoints(); if (account && account.nudge) account.nudge(); markTried('pointAt');
}
function turnToSurface(s, r) {
  goal.theta = Math.atan2(s.n.x, s.n.z); goal.phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(s.n.y, -1, 1)), 0.75, 2.0); goal.roll = 0;
  goal.tx = s.pos.x; goal.ty = s.pos.y; goal.tz = s.pos.z; goal.r = THREE.MathUtils.clamp(r ?? cur.r, 1.1, 2.2);
  glide = true; needsRender = true;
}
const pointVisible = (s) => {
  const rc = canvas.getBoundingClientRect(), sc = screenOf(s.pos), dist = camera.position.distanceTo(s.pos);
  ray.set(camera.position, s.pos.clone().sub(camera.position).normalize());
  const hit = poseView.active ? poseView.withPosed(() => ray.intersectObject(body, false)[0]) : ray.intersectObject(body, false)[0];
  return { sc, shown: !(hit && hit.distance < dist - 0.012) && sc.x > rc.left && sc.x < rc.right && sc.y > rc.top && sc.y < rc.bottom };
};
// a new spot from someone here: shown for a few seconds; if it is out of sight, a Show to turn to it
function peerPoints() {
  const now = performance.now();
  for (const o of peersHere) {
    if (!o.point) continue;
    const key = o.id + ':' + o.point[4];
    if (pointing.seen.has(key)) continue;
    pointing.seen.set(key, now);
    const s = pinSpot({ tri: o.point[0], w: o.point.slice(1, 4) });
    if (s && !followId && !pointVisible(s).shown) toast(`${o.name || 'Someone'} is pointing at a spot.`, 'Show', () => turnToSurface(s));
  }
  if (pointing.seen.size > 200) for (const k of [...pointing.seen.keys()].slice(0, 100)) pointing.seen.delete(k);
  if (!peersHere.length && pointing.on) pointing.on = false;
  renderPoints();
}
function shownPoints() {
  const now = performance.now(), out = [];
  if (pointing.mine && now - pointing.mineAt < POINT_MS) out.push({ who: 'You', p: pointing.mine, mine: true });
  for (const o of peersHere) if (o.point) { const t = pointing.seen.get(o.id + ':' + o.point[4]); if (t != null && now - t < POINT_MS) out.push({ who: o.name || 'Someone', p: o.point }); }
  return out;
}
let pointTimer = 0;
function renderPoints() {
  const btn = $('#showSpotBtn');
  btn.hidden = !peersHere.length; btn.setAttribute('aria-pressed', String(pointing.on)); btn.classList.toggle('on', pointing.on);
  const layer = $('#spotLayer'), list = shownPoints();
  pointing.els = list.map((x) => { const d = el('div', { class: 'spotMark' + (x.mine ? ' mine' : '') }); d.append(el('i'), el('span', { text: x.who })); return { d, p: x.p }; });
  layer.replaceChildren(...pointing.els.map((e) => e.d));
  placePoints();
  clearTimeout(pointTimer); if (list.length) pointTimer = setTimeout(renderPoints, 600);
}
function placePoints() {
  for (const e of pointing.els) {
    const s = pinSpot({ tri: e.p[0], w: e.p.slice(1, 4) }); if (!s) { e.d.hidden = true; continue; }
    const v = pointVisible(s); e.d.hidden = !v.shown; if (!v.shown) continue;
    e.d.style.left = v.sc.x + 'px'; e.d.style.top = v.sc.y + 'px';
  }
}
function renderFollow() {
  const bar = document.getElementById('followBar'); if (!bar) return;
  const o = followId && peersHere.find((x) => x.id === followId);
  bar.hidden = !o; if (o) $('#followText').textContent = `Following ${o.name || 'their'}${o.name ? '\u2019s' : ''} view`;
}
let account = null, store = null, saveTimer = 0, saving = false, saveAgain = false, dirty = false, warnedSave = false, askedPersist = false, lastAuto = Date.now();
function usedImages() { const o = {}; for (const k of imageKeysFor(state)) if (images[k]) o[k] = images[k]; return o; }
function setSaved(text, bad) { const n = $('#saved'); n.textContent = text; n.classList.toggle('bad', !!bad); }
function save() {
  dirty = true; clearTimeout(saveTimer);
  if (!store || !store.ok) { setSaved('Not saved: storage is off in this view', true); return; }
  setSaved('Saving'); saveTimer = setTimeout(flushSave, 350);
}
async function flushSave() {
  clearTimeout(saveTimer); saveTimer = 0;
  if (!store || !store.ok || !dirty) return;
  if (saving) { saveAgain = true; return; }
  saving = true; dirty = false;
  try {
    await store.save(state, usedImages());
    if (!dirty) { setSaved('Saved on this device'); if (account) account.saved(); }
    warnedSave = false;
    if (!askedPersist) { askedPersist = true; store.persist(); }
    if (Date.now() - lastAuto > 5 * 60000) { lastAuto = Date.now(); keepRecovery('While you were working'); }
  } catch (err) {
    dirty = true;
    setSaved(err && err.name === 'QuotaExceededError' ? 'Not saved: this device is out of space' : 'Not saved: storage problem', true);
    if (!warnedSave) { warnedSave = true; toast('Your changes are not being saved on this device.', 'Back up now', backupNow); }
  } finally { saving = false; if (saveAgain) { saveAgain = false; flushSave(); } }
}
// iPadOS can drop a web page the moment it leaves the screen, so write straight away when that happens.
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
window.addEventListener('pagehide', () => { flushSave(); });
function keepRecovery(reason) { return store && store.ok ? store.addRecovery(state, usedImages(), reason).catch(() => false) : Promise.resolve(false); }
// Replace the working project with a stored one: this device's save, a backup file or a
// recovery copy. Everything is checked first; if it is not usable this throws and the
// project on screen is left exactly as it was.
async function openProject(rawState, imgs) {
  imgs = imgs && typeof imgs === 'object' ? imgs : {};
  const c = cleanState(rawState, (k) => typeof imgs[k] === 'string' && imgs[k].startsWith('data:image'));
  for (const k of imageKeysFor(c.state)) if (!images[k] && typeof imgs[k]==='string' && imgs[k].startsWith('data:image/')) images[k] = imgs[k];
  await Promise.all(c.state.tattoos.map((t) => loadImg(t.img)));
  const usable = c.state.tattoos.filter((t) => imgEls[t.img]);
  const dropped = c.dropped + c.state.tattoos.length - usable.length;
  if (!usable.length && rawState.tattoos.length) throw new Error('No usable artwork'); // never swap a real project for an empty one
  c.state.tattoos = usable;
  for (const t of usable) if (!t.aspect) t.aspect = imgEls[t.img].naturalWidth / imgEls[t.img].naturalHeight || 1;
  state = c.state; selectedId = null; skinMat.color.set(skinColor()); adoptState();
  for (const id of c.replace) { const t = state.tattoos.find((x) => x.id === id); if (t) { const h = nextSlot(); t.pos = h.pos; t.normal = h.normal; } }
  return { dropped, replaced: c.replace.length };
}
function whenText(at) {
  const d = new Date(at), now = new Date(), time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = d.toDateString() === now.toDateString() ? 'Today' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}, ${time}`;
}

/* ---------- history ---------- */
function snapshot() { undoStack.push(JSON.stringify(state)); if (undoStack.length > 40) undoStack.shift(); redoStack.length = 0; refreshUndo(); }
// The record of approval pages sent is not undone, so replies still match.
function restore(json) { const asks = state.asks; state = JSON.parse(json); if (asks) state.asks = asks; else delete state.asks; if (!state.tattoos.find((t) => t.id === selectedId)) selectedId = null; skinMat.color.set(skinColor()); applyShape(); syncDecals(); renderUI(); save(); if (wrapStudio) wrapStudio.refresh(); }
// each undo and redo says in a toast what it put back, so a tap never changes something unseen
function stepWords(a, b) { try { return changeWords(a, b); } catch { return ''; } }
function undo() { if (!undoStack.length) return; const now = JSON.stringify(state), back = undoStack.pop(), words = stepWords(JSON.parse(back), state); redoStack.push(now); restore(back); refreshUndo(); toast(undoToast(words)); markTried('undoWords'); }
function redo() { if (!redoStack.length) return; const now = JSON.stringify(state), next = redoStack.pop(), words = stepWords(state, JSON.parse(next)); undoStack.push(now); restore(next); refreshUndo(); toast(undoToast(words, true)); }
// Go back several steps at once (the history list): every step passed goes onto Redo, in order.
function undoSteps(n) {
  n = Math.min(n, undoStack.length); if (n < 1) return;
  if (n === 1) { undo(); return; }
  let now = JSON.stringify(state), words = '';
  for (let i = 0; i < n; i++) { const back = undoStack.pop(); if (i === n - 1) words = stepWords(JSON.parse(back), JSON.parse(now)); redoStack.push(now); now = back; }
  restore(now); refreshUndo(); markTried('history');
  toast(words ? `Went back ${n} steps, to before ${words}.` : `Went back ${n} steps.`);
}
function renderHistory() {
  const list = $('#historyList'), rows = historyList(undoStack, state);
  list.replaceChildren(...rows.map((r) => el('button', { class: 'btn', type: 'button', 'data-steps': String(r.steps) }, el('span', { text: r.words }), el('span', { class: 'spotsub', text: r.steps === 1 ? 'Last step' : `${r.steps} steps back` }))));
  $('#historyEmpty').hidden = rows.length > 0;
}
function openHistory() { cancelGesture(); renderHistory(); toggle('#historyPop', true); markTried('history'); }
function refreshUndo() { $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length; }
function commit() { if (spotPeek) peekSpot(false); syncDecals(); renderUI(); if (!$('#clothesPop').hidden) renderClothes(); save(); if (wrapStudio) wrapStudio.refresh(); }

/* ---------- tattoo ops ---------- */
const skinColor = () => state.skinHex || SKINS[state.skin] || SKINS[1];
let tried = readTried(); // features from New to try that were tried on this device
let skinOwnOpen = false, skinSlide = false; // the own-tone sliders: open, and mid-drag
const sel = () => state.tattoos.find((t) => t.id === selectedId) || null;
function select(id, focus) { if (id && tape.on) tapeOff(); if (id && pain.on) painOff(); if (id && room.on) roomDone(); if(selectedId!==id)$('#editorAdvanced').open=false;if(tapPlaceId!==id)tapPlaceId=null; const was = selectedId; selectedId = id; const t = sel(); syncDecals(); renderUI(); if (was !== id && account && account.nudge) account.nudge(); if (t && focus) requestAnimationFrame(() => { if (sel() === t && !gest) revealTattoo(t); }); }
// the size said as an everyday thing: about the size of a credit card
function likeOf(t) { if (!t) return ''; const k = (state.heightCm || 175) / 175, w = t.width * 100 * k / 2.54; return sizeLikeText(w, w / t.aspect); }
function likeRender(t) { const lk = likeOf(t); $('#likeLine').textContent = lk; $('#likeLine').hidden = !lk; }
function sizeText(t) {
  const k = state.heightCm / 175; const w = t.width * 100 * k, h = w / t.aspect;
  return `≈ ${(w / 2.54).toFixed(1)} × ${(h / 2.54).toFixed(1)} in  ·  ${w.toFixed(0)} × ${h.toFixed(0)} cm`;
}
const SLOTS = [
  [[0.06, 1.36, 2], [0, 0, -1]], [[2, 1.04, 0.0], [-1, 0, 0]], [[-2, 1.22, 0.0], [1, 0, 0]], [[0, 1.32, -2], [0, 0, 1]],
  [[0.1, 0.72, 2], [0, 0, -1]], [[-0.1, 1.08, 2], [0, 0, -1]], [[-0.1, 0.36, -2], [0, 0, 1]], [[0.12, 1.1, -2], [0, 0, 1]],
];
let slotI = 0;
function nextSlot() { for (let i = 0; i < SLOTS.length; i++) { const s = SLOTS[(slotI++) % SLOTS.length]; const h = surfaceAt(new V3(...s[0]), new V3(...s[1])); if (h) return h; } return { pos: [0, 1.3, 0.12], normal: [0, 0, 1] }; }
async function addImage(dataUrl, name, place) {
  if (commentOnly) { toast('You can comment and answer on this project, not add tattoos. Add it as a reference picture instead.'); return null; }
  const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = dataUrl; });
  if (!im) {toast('That picture could not be opened.');return null;}
  const ratio=im.naturalWidth/im.naturalHeight;
  if(im.naturalWidth*im.naturalHeight>24000000 || !Number.isFinite(ratio) || ratio<.05 || ratio>20){toast('Use artwork under 24 megapixels with an aspect ratio between 1:20 and 20:1.');return null;}
  let src = dataUrl;
  const max = 1600;
  if (im.naturalWidth > max || im.naturalHeight > max || dataUrl.length > 900000) {
    const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    src = c.toDataURL('image/png'); // Preserve transparency and line detail.
  }
  const k = uid(); images[k] = src; await loadImg(k);
  const p = place || nextSlot();
  const t = { id: uid(), name: name || 'Tattoo', img: k, imageTopDown:true, aspect: im.naturalWidth / im.naturalHeight, pos: p.pos, normal: p.normal, width: p.width || 0.11, rot: p.rot || 0, opacity: p.opacity ?? 0.92, flip: false, locked: false, hidden: false };
  for (const k of ['wrap', 'bend', 'taper']) if (p[k]) t[k] = p[k];
  state.artworks ||= {}; t.artworkId = uid(); const sourceKey = src === dataUrl ? k : uid(); if (sourceKey !== k) images[sourceKey] = dataUrl; state.artworks[t.artworkId] = { source: sourceKey, output: k, name: t.name };
  state.tattoos.push(t); return t;
}
function viewCenterSpot() { const r = canvas.getBoundingClientRect(); const h = hitBody(r.left + r.width / 2, r.top + r.height * 0.42); return h ? { pos: h.point.toArray(), normal: h.normal.clone().normalize().toArray() } : null; }

/* ---------- sample art (original, drawn in code → src/sample-art.js) ---------- */
async function seedSamples() {
  const a = surfaceAt(new V3(0.075, 1.34, 2), new V3(0, 0, -1));
  if (a) await addImage(sampleSun(), 'Sunburst (sample)', { ...a, width: 0.115 });
  const b = surfaceAt(new V3(2, 1.02, 0.01), new V3(-1, 0, 0)) || surfaceAt(new V3(0.11, 0.7, 2), new V3(0, 0, -1));
  if (b) await addImage(sampleSprig(), 'Sprig (sample)', { ...b, width: 0.05 });
}

/* ---------- gestures ---------- */
let liveGuidePlan=null,guideSnapApplied=false;
function clearLiveGuides(){liveGuidePlan=null;guideSnapApplied=false;$('#alignmentGuides').setAttribute('hidden','');$('#alignmentGuides').replaceChildren();}
function drawLiveGuides(){const svg=$('#alignmentGuides');if(!liveGuidePlan){svg.setAttribute('hidden','');return;}svg.removeAttribute('hidden');const box=svg.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${box.width||innerWidth} ${box.height||innerHeight}`);svg.replaceChildren();const ns='http://www.w3.org/2000/svg';
 for(const guide of liveGuidePlan.lines){const a=screenOf(new V3(...guide.from)),b=screenOf(new V3(...guide.to)),line=document.createElementNS(ns,'line');for(const [k,v]of Object.entries({x1:a.x-box.left,y1:a.y-box.top,x2:b.x-box.left,y2:b.y-box.top,stroke:guideSnapApplied?'#8ae2c0':'#f3c776','stroke-width':1.5,'stroke-dasharray':guideSnapApplied?'none':'5 4'}))line.setAttribute(k,String(v));svg.append(line);const label=document.createElementNS(ns,'text');label.setAttribute('x',String(Math.max(6,Math.min(box.width-100,b.x-box.left+6))));label.setAttribute('y',String(Math.max(18,Math.min(box.height-10,b.y-box.top-6))));label.setAttribute('fill',guideSnapApplied?'#8ae2c0':'#f3c776');label.setAttribute('font-size','12');label.setAttribute('paint-order','stroke');label.setAttribute('stroke','#20232c');label.setAttribute('stroke-width','3');label.textContent=`${guideSnapApplied?'Snap: ':''}${guide.kind}${liveGuidePlan.referenceName?' · '+liveGuidePlan.referenceName:''}`;svg.append(label);}
}
// the middle of the body: a guide down the centre line, snapped to when snapping is on
function centreGuide(t){const plan=findCentreLine(t);if(!plan)return;liveGuidePlan=plan;markTried('centre');if(!$('#snapGuides').checked)return;const n=new V3(...t.normal),hit=surfaceAt(new V3(...plan.candidate).addScaledVector(n,.03),n.clone().negate());if(hit&&Math.abs(hit.pos[0])<.001&&Math.hypot(...hit.pos.map((v,i)=>v-plan.candidate[i]))<.012&&new V3(...hit.normal).dot(n)>.85){t.pos=hit.pos;t.normal=hit.normal;guideSnapApplied=true;}}
function updateLiveGuides(t){clearLiveGuides();if(!$('#liveGuides').checked||poseView.active)return;const refs=state.tattoos.filter(r=>!soloIds||soloIds.has(r.id)),plan=findLiveAlignment(t,refs);if(!plan){centreGuide(t);return;}const ref=state.tattoos.find(r=>r.id===plan.referenceId);
 // A close normal match alone is not sufficient across adjacent body parts.
 const connected=projectGroupSurface(ref.pos,ref.normal,t);if(!connected||Math.hypot(...connected.pos.map((v,i)=>v-ref.pos[i]))>.012)return;
 liveGuidePlan=plan;if($('#snapGuides').checked){const hit=projectGroupSurface(plan.candidate,t.normal,t);if(hit&&Math.hypot(...hit.pos.map((v,i)=>v-plan.candidate[i]))<.012&&new V3(...hit.normal).dot(new V3(...t.normal))>.85){t.pos=hit.pos;t.normal=hit.normal;guideSnapApplied=true;}}
 drawLiveGuides();
}
const pts = new Map();
// While a finger is moving the body or a tattoo, the panels and buttons fade almost away so
// they never hide what you are looking at, and come back when the finger lifts.
let handsOnTimer = 0;
function handsOn(on) { clearTimeout(handsOnTimer); if (on) document.body.classList.add('hands-on'); else handsOnTimer = setTimeout(() => { document.body.classList.remove("hands-on"); needsRender = true; }, 120); }
let gest = null; let lastTap = { t: 0, x: 0, y: 0, empty: false };
// joined a shared project with a comment-only invite (src/account.js): tattoos can be looked at,
// answered, commented on and given reference pictures, but not moved, resized, added or removed
let commentOnly = false, suggesting = null; // suggesting: { id, before, undoLen, redo } while someone who can only comment tries a new spot
const cannotMove = (t) => commentOnly && !(suggesting && t && suggesting.id === t.id);
function setCommentOnly(on) {
  if (!on && suggesting) suggestEnd(false);
  commentOnly = !!on; document.body.classList.toggle('comment-only', commentOnly);
  if (commentOnly) { cancelGesture(); tapPlaceId = null; if (room.on && room.fitId) roomDone(); }
  renderUI();
}
function screenOf(v) { const p = v.clone().project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; }
// Whether the finger is on the selected tattoo's own decal (any part of its artwork, clear parts
// too), on the skin it lies on, not through the limb from behind.
function onSelectedDecal(x, y, h) {
  const t = sel(), d = t && decals[t.id]; if (!d || !d.mesh.visible || !h) return false;
  ray.setFromCamera(ndc(x, y), camera);
  const hits = poseView.withPosed(() => ray.intersectObject(d.mesh, false), [d.mesh]);
  return hits.some((q) => Math.abs(q.distance - h.distance) < 0.012);
}
function onSelectedInk(x, y, slop = 0) {
  const t = sel(); if (cannotMove(t) || tapPlaceId || !t || t.locked || t.status === 'existing' || t.hidden) return false;
  const h = hitBody(x, y), wrap = isWrap(t);
  // a piece that goes round an arm or leg is grabbed anywhere on it, front, side or back; the flat
  // box round its middle would reach onto the body beside the limb, so it is only for other pieces
  if (!wrap && h && h.normal.dot(new V3(...t.normal)) > 0 && insideTattoo(h.point, t)) return true;
  if (onSelectedDecal(x, y, h)) return true;
  // a fingertip is wide: a near miss on a thin band still takes hold of it
  if (slop) for (const [dx, dy] of [[slop, 0], [-slop, 0], [0, slop], [0, -slop]]) if (onSelectedDecal(x + dx, y + dy, hitBody(x + dx, y + dy))) return true;
  return false;
}
// Start moving a wrap like a ring on a rod: from where the finger first touched its skin.
function limbGrab(t, x, y, slop = 0) {
  const w = isWrap(t) ? wrapInfo(t) : null; if (!w) return null;
  // a fingertip that took hold just past the band's edge (off the limb, on the background or the
  // other leg) still turns the band like a ring: it starts from the first skin of this limb the
  // finger reaches, so it neither jumps nor falls back to the flat drag that sticks
  const I = bodyGeo.index.array, onLimb = (h) => h && h.faceIndex != null && w.L.keep[I[h.faceIndex * 3]] > 0;
  let h = hitBody(x, y);
  if (!onLimb(h)) h = [[slop, 0], [-slop, 0], [0, slop], [0, -slop]].map(([dx, dy]) => slop && hitBody(x + dx, y + dy)).find(onLimb) || null;
  const drag = new LimbDrag(w.ax, w.at, h ? limbPlace(w.ax, h.point.toArray()) : w.at, frameOf(t).up.toArray());
  if (!h) drag.lost = true;
  return { drag, keep: w.L.keep };
}
function limbMove(G, x, y) {
  const h = hitBody(x, y), I = bodyGeo.index.array;
  // off the limb (the background, the other leg, the body) the band holds still, and goes on from
  // wherever the finger comes back onto the limb, with no jump
  const on = h && h.faceIndex != null && G.keep[I[h.faceIndex * 3]] > 0;
  const sp = G.drag.step(on ? limbPlace(G.drag.ax, h.point.toArray()) : null); if (!sp) return null;
  const hit = limbSurface(G.keep, sp.point, sp.out); if (!hit) return null;
  const f = frameOf({ normal: hit.normal, rot: 0 });
  return { pos: hit.pos, normal: hit.normal, rot: rotFor(f.right.toArray(), f.up.toArray(), sp.up) };
}
function two() { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; }
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  clearLiveGuides(); if (!$('#lookMenu').hidden) showLook(false);
  if (followId) stopFollow();
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 1) {
    const t = sel();
    const onInk = onSelectedInk(e.clientX, e.clientY, e.pointerType === 'mouse' ? 0 : 10);
    const sc = t ? screenOf(new V3(...viewSpot(t).pos)) : { x: 0, y: 0 };
    if (onInk && poseView.motion.playing) poseView.pause(); // hold the pose still while the ink moves
    if (paint && hitBody(e.clientX, e.clientY)) { gest = { mode: 'paint', sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, t0: performance.now(), moved: true, snap: false, type: e.pointerType, dab: new Set() }; paintAt(e.clientX, e.clientY, gest.dab); return; }
    gest = { mode: onInk ? 'ink' : 'cam', sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, t0: performance.now(), moved: false, snap: false, ox: e.clientX - sc.x, oy: e.clientY - sc.y, type: e.pointerType };
    if (onInk) gest.limb = limbGrab(t, e.clientX, e.clientY, e.pointerType === 'mouse' ? 0 : 10);
  } else if (pts.size === 2 && gest) {
    const s = two();
    // two fingers that land together are a pan or zoom, not paint: take back the first finger's dab
    if (gest.mode === 'paint') { if (paint && gest.dab && !gest.stroked && performance.now() - gest.t0 < 400) { for (const t of gest.dab) paint.tris.delete(t); showPaint(); } gest.mode = 'cam'; }
    // Fingers that land together arrive in no fixed order, so "two fingers starting on it"
    // must not depend on which one the browser reports first: if the first finger has not
    // moved yet and the second one lands on the selected tattoo, it is a resize/turn of it.
    if (gest.mode === 'cam' && !gest.moved && performance.now() - gest.t0 < 350 && onSelectedInk(e.clientX, e.clientY, e.pointerType === 'mouse' ? 0 : 10)) gest.mode = 'ink';
    gest.moved = true; gest.hadTwo = true; handsOn(true); gest.intent = null; gest.pd = s.d; gest.pa = s.ang; gest.pcx = s.cx; gest.pcy = s.cy;
    const t = sel(); if (gest.mode === 'ink' && t) { gest.w0 = t.width; gest.r0 = t.rot; gest.d0 = s.d; gest.a0 = s.ang; if (!gest.snap) { snapshot(); gest.snap = true; } }
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId); if (!p || !gest) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pts.size === 1) {
    const dx = e.clientX - gest.px, dy = e.clientY - gest.py; gest.px = e.clientX; gest.py = e.clientY;
    if (gest.hadTwo) return; // the finger left behind after a pinch or pan must not jerk the view or the ink
    if (gest.mode === 'paint') { gest.stroked = gest.stroked || Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 12; paintAt(e.clientX, e.clientY, gest.stroked ? null : gest.dab); return; }
    if (!gest.moved && Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) < (gest.type === 'mouse' ? 4 : 9)) return;
    if (!gest.moved) handsOn(true);
    gest.moved = true;
    if (gest.mode === 'cam') {
      glide = false; goal.theta -= dx * 0.0085; goal.phi = THREE.MathUtils.clamp(goal.phi - dy * 0.0065, 0.2, Math.PI - 0.35); needsRender = true;
    } else {
      const t = sel(); if (!t) return;
      if (gest.limb) { const to = limbMove(gest.limb, e.clientX, e.clientY); if (to) { if (!gest.snap) { snapshot(); gest.snap = true; } Object.assign(t, to); inkDirty = true; markTried('wrapGrab'); } return; }
      const h = hitBody(e.clientX - gest.ox, e.clientY - gest.oy);
      if (h) { if (!gest.snap) { snapshot(); gest.snap = true; } t.pos = h.point.toArray(); t.normal = h.normal.clone().normalize().toArray(); updateLiveGuides(t); inkDirty = true; }
    }
  } else if (pts.size === 2) {
    clearLiveGuides();
    const s = two();
    const raw=twoPointerDelta({distance:gest.pd,angle:gest.pa,cx:gest.pcx,cy:gest.pcy},{distance:s.d,angle:s.ang,cx:s.cx,cy:s.cy});
    const delta=(gest.intent||=twoFingerIntent()).step(raw);
    if (gest.mode === 'ink' && sel()) {
      const t = sel(); t.width = THREE.MathUtils.clamp(gest.w0 * (s.d / gest.d0), 0.012, 0.9);
      let da = s.ang - gest.a0; da = Math.atan2(Math.sin(da), Math.cos(da)); t.rot = gest.r0 - da; inkDirty = true;
    } else {
      glide = false; if (!tried.has('pan')) markTried('pan'); goal.r = THREE.MathUtils.clamp(goal.r * delta.zoomRatio, 0.22, 7);
      goal.roll=wrapAngle((goal.roll||0)+delta.rollDelta);
      const k = (2 * cur.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / canvas.getBoundingClientRect().height;
      const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0), up = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
      const mx = -(s.cx - gest.pcx) * k, my = (s.cy - gest.pcy) * k;
      goal.tx = THREE.MathUtils.clamp(goal.tx + right.x * mx + up.x * my, -0.7, 0.7);
      goal.ty = THREE.MathUtils.clamp(goal.ty + right.y * mx + up.y * my, -0.1, 1.9);
      goal.tz = THREE.MathUtils.clamp(goal.tz + right.z * mx + up.z * my, -0.5, 0.5);
      needsRender = true;
    }
    gest.pd = s.d; gest.pa = s.ang; gest.pcx = s.cx; gest.pcy = s.cy;
  }
});
function cancelGesture() {
  clearLiveGuides();
  const g = gest; gest = null; handsOn(false);
  const ids = [...pts.keys()]; pts.clear();
  for (const id of ids) { try { canvas.releasePointerCapture(id); } catch (_) { /* already released */ } }
  if (g?.snap) commit();
  if(tapPlaceId){tapPlaceId=null;renderSheet();}
}
function endPointer(e) {
  clearLiveGuides();
  if (e.type === 'pointercancel') { cancelGesture(); return; }
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size === 1 && gest) { const p = [...pts.values()][0]; gest.px = p.x; gest.py = p.y; const t = sel(); if (t) { const sc = screenOf(new V3(...viewSpot(t).pos)); gest.ox = p.x - sc.x; gest.oy = p.y - sc.y; if (gest.limb) gest.limb = limbGrab(t, p.x, p.y, 10); } return; }
  if (pts.size > 0 || !gest) return;
  const g = gest; gest = null; handsOn(false);
  if (g.mode === 'ink' && g.moved && !taught.has('move')) { learnt('move'); renderSheet(); }
  if (g.limb && g.moved && !taught.has('wrapMove')) { learnt('wrapMove'); renderSheet(); }
  if (g.snap) { commit(); }
  if (!g.moved && performance.now() - g.t0 < 450 && e.type === 'pointerup') tap(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', (e) => { if (pts.has(e.pointerId)) cancelGesture(); });
window.addEventListener('blur', cancelGesture);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGesture(); });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); glide = false; goal.r = THREE.MathUtils.clamp(goal.r * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), 0.22, 7); needsRender = true; }, { passive: false });
function tap(x, y) {
  if (wrapStudio && wrapStudio.isOpen() && wrapStudio.tapBody(hitBody(x, y))) return;
  if (pointing.on) { pointTap(x, y); return; }
  if (tape.on) { tapeTap(x, y); return; }
  if (pain.on) { painTap(x, y); return; }
  if (room.on) { roomTap(x, y); return; }
  if (pins.on) { pinTap(x, y); return; }
  if(tapPlaceId){const t=sel(),h=hitBody(x,y);if(!t||t.id!==tapPlaceId||t.locked||t.hidden||t.status==='existing'){tapPlaceId=null;renderSheet();return;}if(!h){toast('Tap directly on the body, or cancel tap-to-place.');return;}try{const placed=planTapPlacement(t,{pos:h.point.toArray(),normal:h.normal.toArray()});snapshot();Object.assign(t,placed);tapPlaceId=null;commit();toast('Tattoo placed.', 'Undo', undo);}catch(e){toast(e.message);}return;}
  const h = hitBody(x, y),ids=inkIdsAt(x,y,h),now=performance.now();const id=cycleInkHit(ids,lastInkTap,{x,y,time:now});
  if(id){lastInkTap={ids,id,x,y,time:now};select(id,false);lastInkTap.time=performance.now(); // a repeat tap counts from when the selection has shown, so a slow panel never eats it
    const tapNow=lastInkTap,fresh=()=>{if(lastInkTap===tapNow)tapNow.time=Math.max(tapNow.time,performance.now());};requestAnimationFrame(()=>{fresh();const t=sel();if(t&&t.id===id&&!gest)keepClearOfPanels(t);requestAnimationFrame(fresh);});setTimeout(fresh,0);lastTap={t:0,x,y,empty:false};return;}
  lastInkTap=null;
  // a fingertip just off the selected tattoo, where a drag would take hold of it, keeps it selected
  if (selectedId && onSelectedInk(x, y, 10)) { lastTap = { t: 0, x, y, empty: false }; return; }
  const dbl = lastTap.empty && now - lastTap.t < 380 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40;
  lastTap = { t: now, x, y, empty: true };
  if (dbl) { fullBody(); lastTap.t = 0; }
  if (selectedId) select(null);
}
let inkDirty = false;
/* ---------- on-canvas handles ---------- */
// Two small handles on the selected tattoo, for one finger or the Apple Pencil: the corner
// one resizes, the round one above turns it. They sit on the tattoo's own corners, so they
// turn with it. Everything else keeps the usual gestures; the handles are just one more way.
const handleBox = $('#handles'), hSize = $('#hSize'), hTurn = $('#hTurn');
let handleDrag = null;
// A band round an arm or leg: its middle is often round the back, so the handles go on the part
// facing you, on its bottom and top edges (cached until the view or the band moves).
let wrapHandleCache = null;
function wrapFront(t) {
  const w = wrapInfo(t); if (!w || w.share < 0.35 || poseView.active) return null;
  const k = [t.id, t.pos, t.normal, t.width, t.rot || 0, shapeKey, camera.position.toArray().map((v) => v.toFixed(3))].join('|');
  if (wrapHandleCache && wrapHandleCache.k === k) return wrapHandleCache.v;
  const cam = limbPlace(w.ax, camera.position.toArray());
  let dA = wrapA(cam.angle - w.at.angle);
  // a piece part way round: the nearest of its own skin to you
  if (w.share < 0.95) { const half = Math.max(0, Math.PI * w.share - 0.4); dA = Math.max(-half, Math.min(half, dA)); }
  const p = limbPoint(w.ax, w.at.s, w.at.angle + dA, w.at.r), hit = limbSurface(w.L.keep, p.point, p.out);
  let v = null;
  if (hit) {
    const up0 = frameOf(t).up.toArray(), n = new V3(...hit.normal), c0 = Math.cos(dA), s0 = Math.sin(dA), k3 = new V3(...w.at.dir), u = new V3(...up0);
    const up = u.clone().multiplyScalar(c0).add(new V3().crossVectors(k3, u).multiplyScalar(s0)).add(k3.clone().multiplyScalar(k3.dot(u) * (1 - c0)));
    up.addScaledVector(n, -up.dot(n)).normalize();
    v = { pos: hit.pos, normal: hit.normal, up: up.toArray() };
  }
  wrapHandleCache = { k, v }; return v;
}
function handleSpots(t) {
  const wf = wrapFront(t);
  if (wf) {
    const c = new V3(...wf.pos), up = new V3(...wf.up), hh = t.width / t.aspect / 2;
    if (new V3(...wf.normal).dot(camera.position.clone().sub(c).normalize()) < 0.15) return null;
    const cs = screenOf(c), bot = screenOf(c.clone().addScaledVector(up, -hh)), top = screenOf(c.clone().addScaledVector(up, hh));
    const bx = bot.x - cs.x, by = bot.y - cs.y, bl = Math.hypot(bx, by) || 1, ux = top.x - cs.x, uy = top.y - cs.y, ul = Math.hypot(ux, uy) || 1;
    return { c: cs, size: { x: bot.x + bx / bl * 30, y: bot.y + by / bl * 30 }, turn: { x: top.x + ux / ul * 34, y: top.y + uy / ul * 34 } };
  }
  const spot = viewSpot(t), f = frameOf({ ...t, normal: spot.normal }), c = new V3(...spot.pos);
  const hw = t.width / 2, hh = t.width / t.aspect / 2;
  const toCam = camera.position.clone().sub(c).normalize();
  if (f.n.dot(toCam) < 0.15) return null; // facing away: nothing sensible to grab
  const cs = screenOf(c), corner = screenOf(c.clone().addScaledVector(f.right, hw).addScaledVector(f.up, -hh)), top = screenOf(c.clone().addScaledVector(f.up, hh));
  const ux = top.x - cs.x, uy = top.y - cs.y, ul = Math.hypot(ux, uy) || 1;
  // keep the corner handle clear of the middle on tiny tattoos, so a drag on the ink still moves it
  const cx = corner.x - cs.x, cy = corner.y - cs.y, cl = Math.hypot(cx, cy) || 1, cmin = 34;
  return { c: cs, size: cl < cmin ? { x: cs.x + cx / cl * cmin, y: cs.y + cy / cl * cmin } : corner, turn: { x: top.x + ux / ul * 34, y: top.y + uy / ul * 34 } };
}
function placeHandles() {
  const t = sel();
  const show = !!t && !cannotMove(t) && !t.locked && !t.hidden && t.status !== 'existing' && !tapPlaceId && !beforeAfter.on && !(gest && gest.mode === 'cam' && gest.moved);
  const s = show ? handleSpots(t) : null;
  if (!s) { if (!handleDrag) handleBox.hidden = true; return; }
  const r = canvas.getBoundingClientRect(), inView = (p) => p.x > r.left + 8 && p.x < r.right - 8 && p.y > r.top + 8 && p.y < r.bottom - 8;
  handleBox.hidden = false;
  for (const [b, p] of [[hSize, s.size], [hTurn, s.turn]]) { b.style.left = p.x + 'px'; b.style.top = p.y + 'px'; b.hidden = !inView(p); }
}
for (const [b, kind] of [[hSize, 'size'], [hTurn, 'turn']]) {
  b.addEventListener('pointerdown', (e) => {
    const t = sel(); if (!t || t.locked || cannotMove(t) || handleDrag) return;
    e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const s = handleSpots(t); if (!s) return; markTried('handles');
    if (poseView.motion.playing) poseView.pause();
    handleDrag = { id: e.pointerId, kind, c: s.c, d0: Math.hypot(e.clientX - s.c.x, e.clientY - s.c.y) || 1, a0: Math.atan2(e.clientY - s.c.y, e.clientX - s.c.x), w0: t.width, r0: t.rot || 0, snap: false };
    b.classList.add('on');
  });
  b.addEventListener('pointermove', (e) => {
    const g = handleDrag, t = sel(); if (!g || g.id !== e.pointerId || !t) return;
    if (!g.snap) { snapshot(); g.snap = true; }
    if (g.kind === 'size') t.width = THREE.MathUtils.clamp(g.w0 * Math.hypot(e.clientX - g.c.x, e.clientY - g.c.y) / g.d0, 0.012, 0.9);
    else {
      let da = Math.atan2(e.clientY - g.c.y, e.clientX - g.c.x) - g.a0; da = Math.atan2(Math.sin(da), Math.cos(da));
      let r = wrapAngle(g.r0 - da); const q = Math.round(r / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(r - q) < 0.05) r = wrapAngle(q); // settle on straight
      t.rot = r; $('#rTurn').value = Math.round(r * 180 / Math.PI);
    }
    inkDirty = true; needsRender = true;
  });
  const end = (e) => { const g = handleDrag; if (!g || g.id !== e.pointerId) return; handleDrag = null; b.classList.remove('on'); if (g.snap) commit(); needsRender = true; };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('lostpointercapture', end);
}

/* ---------- UI ---------- */
function el(tag, props = {}, ...kids) { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v); } for (const c of kids) if (c) n.append(c); return n; }
function renderTray() {
  const tray = $('#trayItems'); tray.replaceChildren();
  // paint brought back from Procreate lies on the skin as one layer: show it as its own item,
  // so it can be found, hidden, made into tattoos or removed
  if (state.paint) {
    const b = el('button', { id: 'paintChip', class: 'chip' + (state.paint.hidden ? ' off' : ''), type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Paint on skin', onclick: () => openPaintPop() },
      el('i', { class: 'pchip i-pencil', 'aria-hidden': 'true' }), el('span', { text: 'Paint on skin' }));
    if (state.paint.hidden) b.append(el('i', { class: 'lock', text: 'Hidden' }));
    tray.append(b);
  }
  for (const t of state.tattoos) {
    const b = el('button', { class: 'chip' + (t.id === selectedId ? ' on' : '') + (t.hidden ? ' off' : ''), type: 'button', 'aria-label': 'Select ' + t.name, 'aria-pressed': t.id === selectedId ? 'true' : 'false', onclick: () => { if (t.id === selectedId) focusTattoo(t); else select(t.id, true); } },
      el('img', { src: images[t.img], alt: '' }), el('span', { text: t.name }));
    if (t.status === 'existing') b.append(el('i', { class: 'lock', text: 'On me' })); else if (t.locked) b.append(el('i', { class: 'lock', text: 'Locked' }));
    else if (t.review) b.append(el('i', { class: 'lock ' + (t.review.verdict === 'approved' ? 'rv-ok' : 'rv-chg'), text: t.review.verdict === 'approved' ? 'Approved' : 'Change asked' }));
    const watching = peersHere.filter((o) => o.look === t.id);
    if (watching.length) { const names = watching.map((o) => o.name || 'Someone').join(' and '); b.append(el('b', { class: 'peer', text: (watching[0].name || '?').slice(0, 1).toUpperCase() + (watching.length > 1 ? '+' : ''), title: names + ' looking' })); b.setAttribute('aria-label', 'Select ' + t.name + ', ' + names + ' looking at it'); }
    // open comments pinned on it, with a dot when one has something new from someone else
    const cs = pinNotes().filter((x) => x.tattooId === t.id && !x.done);
    if (cs.length) {
      let fresh = false; try { fresh = cs.some(pinUnread); } catch { /* before comments are set up */ }
      b.append(el('b', { class: 'cmts' + (fresh ? ' new' : ''), text: String(cs.length), title: `${cs.length} open comment${cs.length === 1 ? '' : 's'}` }));
      b.setAttribute('aria-label', b.getAttribute('aria-label') + `, ${cs.length} open comment${cs.length === 1 ? '' : 's'}${fresh ? ', new' : ''}`);
    }
    tray.append(b);
  }
  $('#count').textContent = state.tattoos.length ? `${state.tattoos.length} on the body` : 'Nothing placed yet';
}
function renderSheet() {
  const t = sel(); const sh = $('#sheet'); sh.hidden = !t; renderReview(t); if (t && !taught.has('select')) learnt('select'); $('#hint').hidden = !!t || state.tattoos.length === 0 || taught.has('select');
  $('#empty').hidden = state.tattoos.length > 0;
  if(tapPlaceId&&(!t||t.id!==tapPlaceId||t.locked||t.hidden||t.status==='existing'))tapPlaceId=null;
  $('#tapPlaceBar').hidden=!tapPlaceId;$('#bTapPlace').setAttribute('aria-pressed',String(!!tapPlaceId));$('#bTapPlace').textContent=tapPlaceId?'Cancel tap to place':'Tap to place';$('#bTapPlace').disabled=!t||t.locked||t.hidden||t.status==='existing';canvas.style.cursor=tapPlaceId?'crosshair':'';
  if (!t) { if (peek) { peek = null; syncDecals(); } return; }
  if (document.activeElement !== $('#name')) $('#name').value = t.name;
  $('#name').readOnly = commentOnly; renderRefCount(t);
  for (const id of ['#tNote', '#madeArtist', '#madeStudio', '#madeWhen']) $(id).readOnly = commentOnly;
  if (document.activeElement !== $('#tNote')) $('#tNote').value = t.note || '';
  $('#madeBox').hidden = t.status !== 'existing';
  renderVersions(t);
  for (const [id, k] of [['#madeArtist', 'artist'], ['#madeStudio', 'studio'], ['#madeWhen', 'when']]) if (document.activeElement !== $(id)) $(id).value = (t.made && t.made[k]) || '';
  $('#size').textContent = sizeText(t); renderGap(); if ($('#editorAdvanced').open) renderInfo();
  const linkedCount=t.artworkId?state.tattoos.filter(x=>x.artworkId===t.artworkId).length:1;
  $('#bCleanupLinked').hidden=linkedCount<2; $('#bCleanupLinked').disabled=!!t.locked; $('#bCleanupLinked').textContent=`Clean up ${linkedCount} linked copies`;
  $('#exactWidth').value = (t.width * state.heightCm / 175 * 100 / 2.54).toFixed(2);
  for (const id of ['rSize','rTurn','rFade','rWrap','rBend','rTaper','bFlip','bFlipVertical','bDraft','bCleanup','bProcreate','exactWidth','resetTransform']) $('#'+id).toggleAttribute('disabled', !!t.locked);
  document.querySelectorAll('[data-inch],[data-nudge]').forEach(b => b.disabled = !!t.locked);
  $('#rSize').value = Math.round(Math.log(t.width / 0.012) / Math.log(0.9 / 0.012) * 1000);
  $('#rTurn').value = Math.round(((((t.rot * 180 / Math.PI) + 180) % 360 + 360) % 360) - 180);
  $('#rFade').value = Math.round((t.opacity ?? 0.92) * 100);
  $('#rWrap').value = Math.round((t.wrap || 0) * 100); $('#rBend').value = Math.round((t.bend || 0) * 100); $('#rTaper').value = Math.round((t.taper || 0) * 100);
  const shaped = (t.bend || 0) || (t.taper || 0); $('#wrapMark').textContent = shaped ? 'on' : ''; if (!shaped && !$('#wrapBox').open) { /* leave closed */ }
  $('#bLock').textContent = t.locked ? 'Unlock' : 'Lock in place'; $('#bLock').setAttribute('aria-pressed', t.locked ? 'true' : 'false');
  $('#bHide').textContent = t.hidden ? 'Show' : 'Hide';
  $('#bStatus').textContent = t.status === 'existing' ? 'Already on me' : 'Planned'; $('#bStatus').setAttribute('aria-pressed', t.status === 'existing' ? 'true' : 'false');
  $('#bFlip').setAttribute('aria-pressed', t.flip ? 'true' : 'false');
  // a piece on an arm or leg that is long or reaches far round it: how far round, and one tap to
  // lay it right round with its ends meeting at the back
  const wi = t.status !== 'existing' && !commentOnly ? wrapInfo(t) : null, longArt = Math.max(t.aspect, 1 / t.aspect) >= 2;
  const showWrap = !!wi && (longArt || wi.share >= 0.35);
  $('#wrapRow').hidden = !showWrap;
  if (showWrap) {
    const limb = /leg/.test(wi.L.key) ? 'leg' : 'arm', full = wi.share >= 0.95 && wi.share <= 1.08;
    $('#wrapText').textContent = full ? `Goes all the way round your ${limb}.` : wi.share > 1.08 ? `Longer than the way round your ${limb} here, so its ends overlap.` : `Goes about ${Math.max(5, Math.round(wi.share * 20) * 5)}% of the way round your ${limb}.`;
    $('#wrapFit').hidden = full || t.locked; $('#wrapFit').textContent = wi.share > 1.08 ? 'Fit it round' : 'Wrap it round';
  }
  $('#moveTip').textContent = commentOnly?'You can say yes or ask for a change, pin a comment under Preview, Comments, and add reference pictures. Only people who can edit can move tattoos.':tapPlaceId?'Tap a spot on the body to place this tattoo. Drag or pinch to adjust the view first.':t.status==='existing'?'Existing ink stays in place. Change to Planned before moving it.':t.locked?'Locked. Unlock to move it.':isWrap(t)&&!taught.has('wrapMove')?`Drag it sideways to turn it round your ${/leg/.test(wrapInfo(t).L.key)?'leg':'arm'}, up or down to slide it along. Grab it anywhere, even round the back.`:taught.has('move')?'':'Drag the tattoo to move it. Drag the corner to resize, the dot above to turn. Two fingers on it do both.';
}
function renderBody() {
  const sw = $('#skins'); sw.replaceChildren();
  SKINS.forEach((c, i) => sw.append(el('button', { class: 'sw' + (i === state.skin && !state.skinHex ? ' on' : ''), type: 'button', style: `background:${c}`, 'aria-label': 'Skin tone ' + (i + 1), onclick: () => { snapshot(); state.skin = i; state.skinHex = null; skinOwnOpen = false; skinMat.color.set(c); needsRender = true; renderBody(); save(); refreshUndo(); } })));
  // your own tone: any shade in between, warmer or cooler, or matched from a photo
  const own = el('button', { id: 'skinOwnBtn', class: 'sw own' + (state.skinHex ? ' on set' : ''), type: 'button', text: '+', style: state.skinHex ? `background:${state.skinHex}` : '', 'aria-label': 'Your own skin tone', 'aria-expanded': String(skinOwnOpen), onclick: () => {
    if (!state.skinHex) { snapshot(); state.skinHex = skinColor(); save(); refreshUndo(); skinOwnOpen = true; } else skinOwnOpen = !skinOwnOpen;
    renderBody();
  } });
  sw.append(own);
  $('#skinOwn').hidden = !skinOwnOpen;
  if (state.skinHex && !skinSlide) { const n = nearestTone(state.skinHex); $('#rSkinDepth').value = Math.round(n.depth * 100); $('#rSkinWarm').value = Math.round(n.warmth * 100); }
  document.querySelectorAll('[data-fig]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.fig === state.figure ? 'true' : 'false'));
  $('#rMuscle').value = Math.round((state.muscle ?? 0.5) * 100); $('#rWeight').value = Math.round((state.weight ?? 0.5) * 100);
  syncFitUI();
  $('#rHeight').value = state.heightCm; const inch = state.heightCm / 2.54; $('#hText').textContent = `${Math.floor(inch / 12)} ft ${Math.round(inch % 12)} in  ·  ${state.heightCm} cm`;
}
function renderUI() { needsRender = true; tuckHair(); renderProcreateBar(); $('#cV47Source').hidden=!state.v47Source; $('#openUnplaced').hidden=!(state.unplacedTattoos||[]).length; renderTray(); renderSheet(); renderBody(); refreshUndo(); if (room && room.on) roomRefresh(); renderPins(); }
function toast(msg, action, fn, ms = 5200) {
  const t = $('#toast'); t.replaceChildren(el('span', { text: msg })); if (action) t.append(el('button', { type: 'button', text: action, onclick: () => { fn(); t.hidden = true; } }));
  // below a bar that is showing at the top, never behind it
  const bar = ['#procreateBar', '#paintBar'].map((q) => $(q)).find((b) => b && !b.hidden);
  t.style.top = bar ? `${Math.round(bar.getBoundingClientRect().bottom + 8)}px` : '';
  t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, ms);
}
let slideSnap = false;
function slider(id, fn) { const r = $(id); r.addEventListener('input', () => { const t = sel(); if (!t || t.locked) return; if (!slideSnap) { snapshot(); slideSnap = true; } fn(t, +r.value); syncDecals(); $('#size').textContent = sizeText(t); likeRender(t); renderGap(); }); r.addEventListener('change', () => { slideSnap = false; commit(); }); }
slider('#rSize', (t, v) => { t.width = 0.012 * Math.pow(0.9 / 0.012, v / 1000); });
slider('#rTurn', (t, v) => { t.rot = v * Math.PI / 180; });
slider('#rFade', (t, v) => { t.opacity = v / 100; });
slider('#rWrap', (t, v) => { t.wrap = v / 100; });
slider('#rBend', (t, v) => { t.bend = v / 100; });
slider('#rTaper', (t, v) => { t.taper = v / 100; });
$('#name').addEventListener('change', () => { const t = sel(); if (!t || commentOnly) return; snapshot(); t.name = $('#name').value.trim() || 'Tattoo'; commit(); });
// a note for the artist, and who did ink that is already on and when: each change is one undo step
$('#tNote').addEventListener('change', () => { const t = sel(); if (!t || commentOnly) return; const v = $('#tNote').value.trim().slice(0, 500); if (v === (t.note || '')) return; snapshot(); if (v) t.note = v; else delete t.note; commit(); markTried('note'); });
for (const [id, k] of [['#madeArtist', 'artist'], ['#madeStudio', 'studio'], ['#madeWhen', 'when']]) $(id).addEventListener('change', () => {
  const t = sel(); if (!t || commentOnly) return; let v = $(id).value.trim().slice(0, 60); if (k === 'when' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) v = '';
  if (v === ((t.made && t.made[k]) || '')) return;
  snapshot(); const m = { ...(t.made || {}) }; if (v) m[k] = v; else delete m[k]; if (Object.keys(m).length) t.made = m; else delete t.made; commit(); markTried('made');
});
// Versions: every earlier artwork of the selected tattoo. Tapping one shows it on the body (view
// only); Use this one brings it back as one undo step; Side by side is a picture of the two.
function renderVersions(t) {
  if (peek && (!t || peek.id !== t.id)) { peek = null; syncDecals(); }
  const list = t ? versionList(t) : [];
  $('#verBox').hidden = list.length < 2; if (list.length < 2) return;
  const on = peek ? peek.v.name : list.find((v) => v.now).name;
  $('#verList').replaceChildren(...list.map((v) => el('button', { type: 'button', 'aria-pressed': String(v.name === on), 'aria-label': v.name + (v.now ? ', in use' : ''), onclick: () => peekVersion(v) },
    el('img', { src: images[v.img] || '', alt: '' }), el('span', { text: v.now ? v.name + ' now' : v.name }))));
  $('#verActs').hidden = !peek;
  $('#verText').textContent = peek ? `Showing ${peek.v.name} on the body. Nothing changes until you tap Use this one.` : `${list.length} versions. The one in use is marked now.`;
}
async function peekVersion(v) {
  const t = sel(); if (!t) return;
  if (v.now) { peek = null; syncDecals(); renderVersions(t); return; }
  if (!await loadImg(v.img)) { toast('That version could not be opened.'); return; }
  peek = { id: t.id, v }; syncDecals(); renderVersions(t); markTried('versions');
}
function useThisVersion() {
  const t = sel(); if (!t || !peek || peek.id !== t.id) return;
  if (t.locked) { toast('Unlock this tattoo first.'); return; }
  const i = (t.versions || []).findIndex((v) => v.name === peek.v.name && v.img === peek.v.img); if (i < 0) return;
  const name = peek.v.name; snapshot(); useVersion(t, i); peek = null; commit(); markTried('versions');
  toast(`${t.name || 'Tattoo'} is back to ${name}. The other versions are kept.`, 'Undo', undo);
}
$('#verUse').addEventListener('click', useThisVersion);
$('#verSide').addEventListener('click', () => { const url = versionsShot(); if (url) showPreview(url, 'ink-atlas-versions.png', 'Versions side by side'); });
$('#editorAdvanced').addEventListener('toggle', () => { if (!$('#editorAdvanced').open && peek) { peek = null; syncDecals(); renderVersions(sel()); } });
// the version being shown next to the one in use, same view, side by side
function versionsShot() {
  const t = sel(); if (!t || !peek || peek.id !== t.id) return null;
  const shown = peek, inset = curInset; curInset = 0; applyInset();
  exporting = true;
  const H = canvas.height, pad = Math.round(H * 0.02), head = Math.round(H * 0.075), W = canvas.width;
  const out = document.createElement('canvas'); out.width = W * 2 + pad * 3; out.height = H + head + pad;
  const g = out.getContext('2d'); g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  try {
    peek = null; syncDecals(); poseView.withPosed(() => renderer.render(scene, camera), posedInk()); g.drawImage(canvas, 0, 0, W, H, pad, head, W, H);
    peek = shown; syncDecals(); poseView.withPosed(() => renderer.render(scene, camera), posedInk()); g.drawImage(canvas, 0, 0, W, H, W + pad * 2, head, W, H);
  } finally { peek = shown; exporting = false; syncDecals(); curInset = inset; applyInset(); needsRender = true; }
  g.fillStyle = '#f2f2f5'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = `600 ${Math.round(head * 0.42)}px -apple-system, system-ui, sans-serif`;
  g.fillText(`${currentNameOf(t)} (in use)`, pad + W / 2, head / 2 + pad / 2); g.fillText(shown.v.name, W + pad * 2 + W / 2, head / 2 + pad / 2);
  return out.toDataURL('image/png');
}
const currentNameOf = (t) => versionList(t).find((v) => v.now).name;
// "By Mia Lopez at Black Rose, March 2023"
function madeText(m) {
  if (!m) return '';
  const when = m.when ? new Date(+m.when.slice(0, 4), +m.when.slice(5) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  const who = [m.artist && 'By ' + m.artist, m.studio && (m.artist ? 'at ' : 'At ') + m.studio].filter(Boolean).join(' ');
  return [who, when].filter(Boolean).join(', ');
}
$('#bFlip').addEventListener('click', () => { const t = sel(); if (!t) return; if (t.locked) { toast('Unlock this tattoo first.'); return; } snapshot(); t.flip = !t.flip; commit(); });
$('#bLock').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.locked = !t.locked; commit(); });
$('#bStatus').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.status = t.status === 'existing' ? 'planned' : 'existing'; t.locked = t.status === 'existing'; commit(); });
$('#bHide').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); t.hidden = !t.hidden; commit(); });
$('#bFlipVertical').addEventListener('click',()=>{const t=sel();if(!t||t.locked)return;snapshot();t.imageTopDown=!t.imageTopDown;commit();});
// Copy to other side: the same artwork, mirrored, at the matching spot on the other side of the
// body (the body is symmetric left to right). It shares the artwork, so cleaning one up offers
// to clean both.
function otherSide(t) {
  const p = new V3(-t.pos[0], t.pos[1], t.pos[2]), n = new V3(-t.normal[0], t.normal[1], t.normal[2]).normalize();
  const h = surfaceAt(p.clone().addScaledVector(n, 0.2), n.clone().negate());
  if (!h || Math.hypot(...h.pos.map((v, i) => v - p.getComponent(i))) > 0.03) return null;
  return { pos: h.pos, normal: h.normal, rot: wrapAngle(-(t.rot || 0)), flip: !t.flip };
}
$('#bOtherSide').addEventListener('click', () => {
  markTried('other-side');
  const t = sel(); if (!t) return;
  if (Math.abs(t.pos[0]) < Math.max(0.02, t.width * 0.3)) { toast('This tattoo sits in the middle of the body, so there is no other side.'); return; }
  const m = otherSide(t); if (!m) { toast('Could not find the matching spot on the other side.'); return; }
  snapshot();
  const base = t.name.replace(/ \((left|right)\)$/i, '');
  const sideName = (x) => (x > 0 ? 'left' : 'right'); // the body's own left is +x
  const c = { ...structuredClone(t), id: uid(), name: `${base} (${sideName(m.pos[0])})`.slice(0, 40), locked: false, ...m };
  if (!/\((left|right)\)$/i.test(t.name)) t.name = `${base} (${sideName(t.pos[0])})`.slice(0, 40);
  state.tattoos.push(c); selectedId = c.id; commit();
  toast('Copied to the other side.', 'Undo', undo);
});
// Real size on screen: the artwork at its true size, to hold the iPad against your skin. The
// screen's pixels per inch is a guess per device that a bank card can correct; it is kept on
// this device only, outside the project.
const PPI_KEY = 'ia-screen-ppi';
function guessPpi() {
  try { const v = +localStorage.getItem(PPI_KEY); if (v > 40 && v < 400) return v; } catch (_) { /* private mode */ }
  const ua = navigator.userAgent || '', touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad/.test(ua) || touchMac) return Math.min(screen.width, screen.height) <= 744 ? 163 : 132; // iPad mini is denser
  if (/iPhone/.test(ua)) return 160;
  return 96;
}
let rsPpi = 0, rsId = null;
function inchesOf(t) { const w = t.width * state.heightCm / 175 * 100 / 2.54; return { w, h: w / t.aspect }; }
function renderRealSize() {
  const t = state.tattoos.find((x) => x.id === rsId); if (!t) { $('#realSize').hidden = true; return; }
  const { w, h } = inchesOf(t), box = $('#rsArt'), img = $('#rsImg');
  box.style.width = w * rsPpi + 'px'; box.style.height = h * rsPpi + 'px';
  img.src = images[t.img]; img.style.transform = `scale(${t.flip ? -1 : 1},${t.imageTopDown ? 1 : -1})`;
  $('#realSize').style.setProperty('--rs-skin', skinColor());
  const big = w * rsPpi > innerWidth || h * rsPpi > innerHeight;
  $('#rsText').textContent = `${t.name}: ${w.toFixed(1)} × ${h.toFixed(1)} in (${(w * 2.54).toFixed(0)} × ${(h * 2.54).toFixed(0)} cm) at real size.` + (big ? ' Bigger than the screen, so the middle shows.' : ' Hold the screen against your skin.');
  const card = $('#rsCard'); card.style.width = 3.370 * rsPpi + 'px'; card.style.height = 2.125 * rsPpi + 'px';
}
function showRealSize(on) {
  $('#realSize').hidden = !on; if (!on) { $('#rsCal').hidden = true; $('#rsCard').hidden = true; $('#rsCheck').hidden = false; return; }
  markTried('real-size'); rsPpi = guessPpi(); rsId = selectedId; renderRealSize();
}
$('#bRealSize').addEventListener('click', () => showRealSize(true));
$('#rsClose').addEventListener('click', () => showRealSize(false));
$('#rsCheck').addEventListener('click', () => { $('#rsCal').hidden = false; $('#rsCard').hidden = false; $('#rsCheck').hidden = true; });
$('#rsSmaller').addEventListener('click', () => { rsPpi *= 0.99; renderRealSize(); });
$('#rsBigger').addEventListener('click', () => { rsPpi *= 1.01; renderRealSize(); });
$('#rsCalDone').addEventListener('click', () => { try { localStorage.setItem(PPI_KEY, String(Math.round(rsPpi * 10) / 10)); } catch (_) { /* kept until closed */ } $('#rsCal').hidden = true; $('#rsCard').hidden = true; $('#rsCheck').hidden = false; toast('Scale saved for this device.'); });
// Stencil for your artist: the selected tattoo's artwork as clean black lines on white, at its
// real size on the body and turned the way it sits there. Fills become outlines, thin lines stay
// whole. The files are made as the sheet opens, so a tap hands them straight to the share sheet.
// View only: the project never changes.
const st = { id: null, detail: 0.5, timer: 0, run: 0, png: null, pdf: null, base: '' };
const stReady = (on) => { $('#stShare').disabled = $('#stPrint').disabled = !on; };
// one tattoo's stencil on a white canvas at print resolution: { S, c, r }
function stencilCanvas(im, t, size, detail) {
  const S = stencilScale(size.wCm / 2.54, size.hCm / 2.54), c = document.createElement('canvas'); c.width = S.w; c.height = S.h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, S.w, S.h);
  g.save(); g.translate(t.flip ? S.w : 0, t.imageTopDown === false ? S.h : 0); g.scale(t.flip ? -1 : 1, t.imageTopDown === false ? -1 : 1); g.drawImage(im, 0, 0, S.w, S.h); g.restore();
  const r = stencilLines(g.getImageData(0, 0, S.w, S.h).data, S.w, S.h, { detail, line: S.line, solid: S.solid });
  g.putImageData(new ImageData(stencilPixels(r.lines, S.w, S.h), S.w, S.h), 0, 0);
  return { S, c, r };
}
// every planned piece's stencil in one PDF at real size, at the Detail now set
const planStencilList = () => state.tattoos.filter((q) => q.status !== 'existing' && !q.hidden);
async function planStencils() {
  const list = planStencilList(); if (list.length < 2) return null;
  const P = await import('./print-size.js'), pieces = [], art = {};
  for (const t of list) {
    const size = P.pieceSize(t, state.heightCm), im = imgEls[t.img] || await loadImg(t.img); if (!im) continue;
    const { S, c, r } = stencilCanvas(im, t, size, st.detail); if (!r.linePixels) continue;
    const jpg = new Uint8Array(await (await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95))).arrayBuffer());
    const name = t.name || 'Tattoo', note = P.sizeNote(size) + ', stencil' + (t.flip ? ', mirrored as on the body' : '');
    pieces.push({ id: t.id, w: size.w, h: size.h, labelW: (name.length + note.length + 2) * 4.6 });
    art[t.id] = { name, note, jpeg: { width: S.w, height: S.h, data: jpg } };
    await new Promise((res) => setTimeout(res, 0));
  }
  if (!pieces.length) return { count: 0 };
  const pages = P.layoutPrint(pieces), pdf = P.buildPrintPdf(pages, art, { title: 'Stencils for the whole plan' });
  return { count: pieces.length, of: list.length, pages: pages.length, pdf: new Blob([pdf], { type: 'application/pdf' }), bytes: pdf.length };
}
$('#stAll').addEventListener('click', async () => {
  const b = $('#stAll'); if (b.disabled) return; b.disabled = true;
  try {
    const out = await planStencils();
    window.__lastPlanStencils = out ? { count: out.count, of: out.of, pages: out.pages, bytes: out.bytes } : null;
    if (!out) return;
    if (!out.count) { toast('Nothing to trace at this detail. Slide Detail up and try again.'); return; }
    saveFile('tattoo-plan-stencils.pdf', out.pdf); markTried('planStencils');
    if (out.count < out.of) toast(`${out.count} of ${out.of} pieces had lines to trace at this detail.`);
  } finally { b.disabled = false; }
});
async function makeStencil() {
  const t = state.tattoos.find((x) => x.id === st.id); if (!t) { showStencil(false); return; }
  const run = ++st.run; st.png = st.pdf = null; stReady(false);
  const P = await import('./print-size.js'), size = P.pieceSize(t, state.heightCm);
  $('#stText').textContent = `${t.name || 'Tattoo'}: ${P.sizeNote(size)} at real size.` + (t.flip ? ' Mirrored as on your body.' : '') + ' Getting it ready.';
  const im = imgEls[t.img] || await loadImg(t.img);
  await new Promise((r) => setTimeout(r, 20)); // let the sheet show before the work
  if (run !== st.run) return;
  if (!im) { $('#stText').textContent = 'This artwork could not be read.'; return; }
  const { S, c, r } = stencilCanvas(im, t, size, st.detail);
  if (run !== st.run) return;
  const k = Math.min(1, 1600 / Math.max(S.w, S.h)), view = $('#stCanvas');
  view.width = Math.round(S.w * k); view.height = Math.round(S.h * k); view.getContext('2d').drawImage(c, 0, 0, view.width, view.height);
  const blob = (type, q) => new Promise((res) => c.toBlob(res, type, q));
  const png = pngWithDpi(new Uint8Array(await (await blob('image/png')).arrayBuffer()), S.dpi);
  const jpg = new Uint8Array(await (await blob('image/jpeg', 0.95)).arrayBuffer());
  if (run !== st.run) return;
  const name = t.name || 'Tattoo', note = P.sizeNote(size) + ', stencil' + (t.flip ? ', mirrored as on the body' : '');
  const pdf = P.buildPrintPdf(P.layoutPrint([{ id: t.id, w: size.w, h: size.h, labelW: (name.length + note.length + 2) * 4.6 }]), { [t.id]: { name, note, jpeg: { width: S.w, height: S.h, data: jpg } } }, { title: name + ': stencil at real size' });
  st.png = new Blob([png], { type: 'image/png' }); st.pdf = new Blob([pdf], { type: 'application/pdf' });
  st.base = name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'tattoo';
  window.__lastStencil = { w: S.w, h: S.h, dpi: S.dpi, line: S.line, inkPixels: r.inkPixels, linePixels: r.linePixels, png: png.length, pdf: pdf.length, wCm: size.wCm, hCm: size.hCm, detail: st.detail };
  const soft = artSharpness(im.naturalWidth, im.naturalHeight, size.wCm / 2.54);
  $('#stText').textContent = `${name}: ${P.sizeNote(size)} at real size.` + (t.flip ? ' Mirrored as on your body.' : '') + (r.linePixels ? '' : ' Nothing to trace at this detail, so slide Detail up.') + (soft ? ` The artwork file is small for this size (about ${soft.dpi} dots per inch), so the lines may print soft.` : '');
  if (soft) markTried('sharp');
  stReady(r.linePixels > 0);
}
function showStencil(on) {
  $('#stencil').hidden = !on; st.run++; clearTimeout(st.timer);
  if (!on) return;
  const t = sel(); if (!t) { $('#stencil').hidden = true; toast('Select a tattoo first.'); return; }
  markTried('stencil'); st.id = t.id; makeStencil();
  const n = planStencilList().length; $('#stAll').hidden = n < 2; $('#stAll').textContent = `All ${n} planned pieces`;
}
$('#bStencil').addEventListener('click', () => showStencil(true));
$('#stClose').addEventListener('click', () => showStencil(false));
$('#rStDetail').addEventListener('input', () => { st.detail = +$('#rStDetail').value / 100; stReady(false); clearTimeout(st.timer); st.timer = setTimeout(makeStencil, 220); });
$('#stShare').addEventListener('click', () => { if (st.png) saveFile(st.base + '-stencil.png', st.png); });
$('#stPrint').addEventListener('click', () => { if (st.pdf) saveFile(st.base + '-stencil.pdf', st.pdf); });
// Ink check: how the selected design reads on this skin at this size. Colours that barely show
// on the skin tone, lines too fine for the size and gaps so tight they fill in, marked on the
// artwork, with the width that would make the lines wide enough. Only a look: Make it bigger is
// the one change, and it is one undo step.
const ic = { id: null, run: 0, wantIn: null, last: null };
const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
async function runInkCheck() {
  const t = state.tattoos.find((x) => x.id === ic.id); if (!t) { showInkCheck(false); return; }
  const run = ++ic.run, k = state.heightCm / 175, wMm = t.width * 1000 * k, hMm = wMm / t.aspect, wIn = wMm / 25.4;
  const inTxt = (v) => (v < 10 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString());
  const name = t.name || 'This tattoo';
  $('#icText').textContent = `${name} at ${inTxt(wIn)} in wide, on your skin. Checking.`; $('#icList').replaceChildren(); $('#icResize').hidden = true;
  const im = imgEls[t.img] || await loadImg(t.img);
  await new Promise((r) => setTimeout(r, 20));
  if (run !== ic.run) return;
  if (!im) { $('#icText').textContent = 'This artwork could not be read.'; return; }
  const pxMm = Math.max(wMm, hMm) / 1400, w = Math.max(8, Math.round(wMm / pxMm)), h = Math.max(8, Math.round(hMm / pxMm));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.save(); g.translate(t.flip ? w : 0, t.imageTopDown === false ? h : 0); g.scale(t.flip ? -1 : 1, t.imageTopDown === false ? -1 : 1); g.drawImage(im, 0, 0, w, h); g.restore();
  const px = g.getImageData(0, 0, w, h).data, skin = hexRgb(skinColor()), op = t.opacity ?? 0.92;
  const r = inkCheck(px, w, h, { pxMm, skin, opacity: op });
  if (run !== ic.run) return;
  const view = $('#icCanvas'); view.width = w; view.height = h;
  view.getContext('2d').putImageData(new ImageData(inkCheckPixels(px, w, h, r, skin, op), w, h), 0, 0);
  const items = [], weak = r.colours.filter((x) => x.level !== 'ok');
  if (!r.inkPixels) items.push(['', 'No ink to check in this artwork.']);
  else {
    if (weak.length) for (const x of weak) items.push(['#d628a0', `The ${x.name} ${x.level === 'barely' ? 'barely shows' : 'shows only faintly'} on your skin (striped pink). A deeper shade, or a dark outline round it, would stand out more.`]);
    else items.push(['#5fd39a', r.colours.length > 1 ? 'Every colour shows well on your skin.' : 'The ink shows well on your skin.']);
    const fine = r.thinShare > 0.02;
    if (fine) items.push(['#ff6a00', `Some lines are under 0.5 mm at this size (orange). Fine lines soften as the ink spreads over the years.`]);
    else items.push(['#5fd39a', 'Every line is at least 0.5 mm wide at this size.']);
    if (r.tightMm2 > 1) items.push(['#0096ff', 'Some gaps between lines are under 0.7 mm (blue) and may fill in over time.']);
    ic.wantIn = null;
    const need = fine ? widthForLines(wIn, r.lineP10Mm) : null;
    if (need && need <= wIn * 4 && need * 2.54 / 100 / k <= 0.9) {
      ic.wantIn = Math.ceil(need * 2) / 2;
      items.push(['', `At about ${inTxt(ic.wantIn)} in wide, nearly every line is 0.5 mm or more.`]);
    } else if (need) items.push(['', 'This is fine line work: pick an artist who does fine line, and expect it to soften with time.']);
    const far = distanceText(r.lineP10Mm, r.gapP10Mm); if (far) items.push(['', far.text]);
    const soft = artSharpness(im.naturalWidth, im.naturalHeight, wIn);
    if (soft) { items.push(['', `The artwork file is ${im.naturalWidth} px wide, about ${soft.dpi} dots per inch at this size, so a print or stencil will look soft. A file at least ${soft.wantPx} px wide prints sharp.`]); markTried('sharp'); }
  }
  const list = $('#icList');
  for (const [col, text] of items) { const li = document.createElement('li'), key = document.createElement('span'); key.className = 'key'; if (col) key.style.background = col; else key.style.visibility = 'hidden'; const tx = document.createElement('span'); tx.textContent = text; li.append(key, tx); list.append(li); }
  $('#icResize').hidden = !ic.wantIn; if (ic.wantIn) $('#icResize').textContent = `Make it ${inTxt(ic.wantIn)} in wide`;
  $('#icText').textContent = `${name} at ${inTxt(wIn)} in wide, on your skin.`;
  ic.last = { id: t.id, w, h, pxMm, thinShare: r.thinShare, tightMm2: r.tightMm2, lineP10Mm: r.lineP10Mm, gapP10Mm: r.gapP10Mm, colours: r.colours, wantIn: ic.wantIn, items: items.map((i) => i[1]) };
}
function showInkCheck(on) {
  $('#inkCheck').hidden = !on; ic.run++;
  if (!on) return;
  const t = sel(); if (!t) { $('#inkCheck').hidden = true; toast('Select a tattoo first.'); return; }
  markTried('ink-check'); ic.id = t.id; runInkCheck();
}
$('#bInkCheck').addEventListener('click', () => showInkCheck(true));
$('#icClose').addEventListener('click', () => showInkCheck(false));
$('#icResize').addEventListener('click', () => {
  const t = state.tattoos.find((x) => x.id === ic.id); if (!t || !ic.wantIn) return;
  if (t.locked || t.status === 'existing') { toast(t.locked ? 'Unlock it first to change its size.' : 'Ink already on you keeps its size.'); return; }
  snapshot(); t.width = Math.max(0.012, Math.min(0.9, ic.wantIn * 2.54 / 100 * 175 / state.heightCm)); commit();
  toast('Made bigger.', 'Undo', () => { undo(); if (!$('#inkCheck').hidden) runInkCheck(); });
  runInkCheck();
});
// Try it on with the camera: the selected artwork over a live camera view or a photo of your
// own skin. One finger moves it, two size and turn it, Curve wraps it round an arm or a leg,
// and Take photo freezes the picture to save or share. View only: the project never changes.
const tryOn = { id: null, stream: null, facing: 'environment', t: { x: 0, y: 0, s: 1, r: 0 }, baseW: 300, img: null, art: null, curve: 0, frozen: null, frozenMirror: false, pts: new Map(), start: null };
function toView() { return { w: innerWidth, h: innerHeight }; }
function toRenderArt() {
  const t = state.tattoos.find((x) => x.id === tryOn.id); if (!t || !tryOn.img) return;
  tryOn.art = curvedArt(tryOn.img, { flipX: !!t.flip, flipY: !t.imageTopDown, curve: tryOn.curve });
  const c = $('#toArt'); c.width = tryOn.art.width; c.height = tryOn.art.height; c.getContext('2d').drawImage(tryOn.art, 0, 0);
  c.style.opacity = String(t.opacity ?? 0.92); toPlace();
}
function toPlace() {
  const c = $('#toArt'), a = tryOn.art; if (!a) return;
  const w = tryOn.baseW * tryOn.t.s, h = w * a.height / a.width;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  c.style.transform = `translate(${tryOn.t.x - w / 2}px,${tryOn.t.y - h / 2}px) rotate(${tryOn.t.r}rad)`;
}
function toStopCamera() { if (tryOn.stream) { for (const tr of tryOn.stream.getTracks()) tr.stop(); tryOn.stream = null; } $('#toVideo').srcObject = null; }
async function toStartCamera() {
  toStopCamera(); const v = $('#toVideo');
  if (!navigator.mediaDevices?.getUserMedia) { toNoCamera(); return; }
  try {
    tryOn.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: tryOn.facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if ($('#tryOn').hidden) { toStopCamera(); return; }
    v.srcObject = tryOn.stream; v.classList.toggle('mirror', tryOn.facing === 'user'); v.hidden = false; await v.play().catch(() => {});
    $('#toText').textContent = toLabel();
  } catch (_) { toNoCamera(); }
}
function toNoCamera() { $('#toVideo').hidden = true; $('#toSnap').disabled = true; $('#toSwitch').disabled = true; $('#toText').textContent = 'The camera is not available here. Use a photo of your skin instead.'; }
function toLabel() { const t = state.tattoos.find((x) => x.id === tryOn.id); if (!t) return ''; const { w, h } = inchesOf(t); return `${t.name}: ${w.toFixed(1)} × ${h.toFixed(1)} in on the body. Move it with one finger, size and turn it with two.`; }
async function openTryOn() {
  const t = sel(); if (!t) return; markTried('try-on');
  tryOn.id = t.id; tryOn.img = await loadImg(t.img); if (!tryOn.img) { toast('This artwork could not be opened.'); return; }
  const v = toView(); tryOn.baseW = Math.min(v.w, v.h) * 0.42; tryOn.t = { x: v.w / 2, y: v.h * 0.45, s: 1, r: 0 };
  tryOn.curve = 0; $('#rToCurve').value = 0; tryOn.frozen = null; tryOn.pts.clear();
  $('#tryOn').hidden = false; $('#toPhoto').hidden = true; $('#toLive').hidden = false; $('#toDone').hidden = true; $('#toSnap').disabled = false; $('#toSwitch').disabled = false;
  $('#toText').textContent = toLabel(); toRenderArt(); toStartCamera();
}
function closeTryOn() { toStopCamera(); $('#tryOn').hidden = true; tryOn.pts.clear(); }
function toFreeze(src, w, h, mirror) {
  tryOn.frozen = { src, w, h }; tryOn.frozenMirror = mirror;
  toStopCamera(); $('#toVideo').hidden = true;
  const p = $('#toPhoto'); p.hidden = false; p.style.transform = mirror ? 'scaleX(-1)' : '';
  $('#toLive').hidden = true; $('#toDone').hidden = false;
  $('#toText').textContent = 'Adjust it on the photo, then save or share the picture.';
}
$('#bTryOn').addEventListener('click', openTryOn);
$('#toClose').addEventListener('click', closeTryOn);
$('#toSwitch').addEventListener('click', () => { tryOn.facing = tryOn.facing === 'user' ? 'environment' : 'user'; toStartCamera(); });
$('#toSnap').addEventListener('click', () => {
  const v = $('#toVideo'); if (!v.videoWidth) return;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  $('#toPhoto').src = c.toDataURL('image/jpeg', 0.92); toFreeze(c, c.width, c.height, tryOn.facing === 'user');
});
$('#toPhotoBtn').addEventListener('click', () => $('#toFile').click());
$('#toFile').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); });
  if (!url) { toast('That photo could not be opened.'); return; }
  const im = new Image(); im.onload = () => { $('#toPhoto').src = url; toFreeze(im, im.naturalWidth, im.naturalHeight, false); }; im.onerror = () => toast('That photo could not be opened.'); im.src = url;
});
$('#toRetake').addEventListener('click', () => { tryOn.frozen = null; $('#toPhoto').hidden = true; $('#toLive').hidden = false; $('#toDone').hidden = true; $('#toSnap').disabled = false; $('#toSwitch').disabled = false; $('#toText').textContent = toLabel(); toStartCamera(); });
$('#toShare').addEventListener('click', async () => {
  const f = tryOn.frozen, t = state.tattoos.find((x) => x.id === tryOn.id); if (!f || !tryOn.art || !t) return;
  const v = toView(), c = compose(f.src, f.w, f.h, { mirror: tryOn.frozenMirror, art: tryOn.art, t: tryOn.t, baseW: tryOn.baseW, alpha: t.opacity ?? 0.92, viewW: v.w, viewH: v.h });
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) { toast('The picture could not be made.'); return; }
  const r = await shareOrDownload(`${(t.name || 'tattoo').replace(/[^\w -]+/g, '').trim() || 'tattoo'} try-on.jpg`, blob);
  if (r === 'downloaded') toast('Picture saved.');
});
$('#rToCurve').addEventListener('input', () => { tryOn.curve = +$('#rToCurve').value / 100; toRenderArt(); });
{
  const surf = $('#tryOn'), pt = (e) => ({ x: e.clientX, y: e.clientY });
  const begin = () => { const p = [...tryOn.pts.values()]; tryOn.start = { t: { ...tryOn.t }, a: { ...p[0] }, b: p[1] ? { ...p[1] } : null }; };
  surf.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#toTop,#toBar') || tryOn.pts.size >= 2) return;
    tryOn.pts.set(e.pointerId, pt(e)); try { surf.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ } begin();
  });
  surf.addEventListener('pointermove', (e) => {
    if (!tryOn.pts.has(e.pointerId) || !tryOn.start) return; tryOn.pts.set(e.pointerId, pt(e));
    const p = [...tryOn.pts.values()], s = tryOn.start;
    if (p.length >= 2 && s.b) tryOn.t = pinch(s.t, s.a, s.b, p[0], p[1]);
    else tryOn.t = { ...s.t, x: s.t.x + p[0].x - s.a.x, y: s.t.y + p[0].y - s.a.y };
    tryOn.t.s = Math.max(0.15, Math.min(6, tryOn.t.s)); toPlace();
  });
  const end = (e) => { if (!tryOn.pts.delete(e.pointerId)) return; if (tryOn.pts.size) begin(); else tryOn.start = null; };
  surf.addEventListener('pointerup', end); surf.addEventListener('pointercancel', end);
}
addEventListener('resize', () => { if (!$('#tryOn').hidden) toPlace(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && tryOn.stream) toStopCamera(); else if (!document.hidden && !$('#tryOn').hidden && !tryOn.frozen) toStartCamera(); });
$('#bDup').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); const f = frameOf(t); const p = new V3(...t.pos).addScaledVector(f.right, t.width * 0.6).addScaledVector(f.n, 0.2); const h = surfaceAt(p, f.n.clone().negate()); const c = { ...t, id: uid(), name: t.name + ' copy', locked: false, pos: h ? h.pos : t.pos, normal: h ? h.normal : t.normal }; state.tattoos.push(c); selectedId = c.id; commit(); });
// Remove always works, locked or already on me too: it is one undo step, and nothing on the body should be stuck
$('#bDelTop').addEventListener('click', () => $('#bDel').click());
$('#bDel').addEventListener('click', () => { const t = sel(); if (!t) return; snapshot(); state.tattoos = state.tattoos.filter((x) => x.id !== t.id); selectedId = null; commit(); toast(`Removed ${t.name}`, 'Undo', undo); });
function setWidthInches(value) {
 const t = sel(); if (!t || t.locked || !Number.isFinite(value) || value <= 0) return;
 snapshot(); t.width = Math.max(.012, Math.min(.9, value * 2.54 / 100 * 175 / state.heightCm)); commit();
}
$('#exactWidth').addEventListener('change', () => setWidthInches(+$('#exactWidth').value));
document.querySelectorAll('[data-inch]').forEach(b => b.addEventListener('click',()=>setWidthInches(+b.dataset.inch)));
document.querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click',()=>{
 const t=sel(); if(!t || t.locked) return; const [x,y]=b.dataset.nudge.split(',').map(Number), f=frameOf(t);
 const p=new V3(...t.pos).addScaledVector(f.right,x*.002*175/state.heightCm).addScaledVector(f.up,y*.002*175/state.heightCm).addScaledVector(f.n,.03);
 const h=surfaceAt(p,f.n.clone().negate()); if(!h) return; snapshot();t.pos=h.pos;t.normal=h.normal;commit();
}));
// With a keyboard (an iPad keyboard case): the arrows move the selected tattoo along the skin the
// way they point on screen (Shift for bigger steps), [ and ] turn it, - and = size it, Cmd+D
// duplicates and Delete removes it. Presses of one kind close together are one undo step, and
// nothing happens while typing in a field.
let keyAt = 0, keyKind = '';
function keyStep(kind) { const now = performance.now(); if (now - keyAt > 800 || keyKind !== kind) snapshot(); keyAt = now; keyKind = kind; }
function keyMove(t, dx, dy) {
  const n = new V3(...t.normal).normalize(), e = camera.matrixWorld.elements;
  const right = new V3(e[0], e[1], e[2]), up = new V3(e[4], e[5], e[6]);
  const dir = right.multiplyScalar(dx).add(up.multiplyScalar(dy)); dir.addScaledVector(n, -dir.dot(n));
  if (dir.lengthSq() < 1e-12) return false;
  dir.normalize().multiplyScalar(Math.hypot(dx, dy) * 0.002 * 175 / state.heightCm);
  const h = surfaceAt(new V3(...t.pos).add(dir).addScaledVector(n, 0.03), n.clone().negate()); if (!h) return false;
  keyStep('move'); t.pos = h.pos; t.normal = h.normal; commit(); return true;
}
const KEYS_HELP = 'Keys for the selected tattoo: arrows move it (Shift for bigger steps), [ and ] turn it, - and = size it, Cmd+D duplicates, Delete removes. Cmd+Z undoes, Shift+Cmd+Z redoes.';
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.defaultPrevented || document.querySelector('[aria-modal=true]')) return;
  const tgt = e.target; if (tgt && tgt.closest && tgt.closest('input,textarea,select,[contenteditable],ink-slider')) return;
  // ? lists the keys
  if (e.key === '?' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); toast(KEYS_HELP); markTried('keys'); return; }
  const t = sel(); if (!t || commentOnly) return;
  const k = e.key, mod = e.metaKey || e.ctrlKey, big = e.shiftKey ? 5 : 1;
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  let used = true;
  if (mod && k.toLowerCase() === 'd') $('#bDup').click();
  else if (mod) used = false;
  else if (k === 'Delete' || k === 'Backspace') $('#bDel').click();
  else if (arrows[k] || k === '[' || k === ']' || k === '{' || k === '}' || k === '-' || k === '_' || k === '=' || k === '+') {
    if (t.locked) toast('Unlock this tattoo first.');
    else if (arrows[k]) keyMove(t, arrows[k][0] * big, arrows[k][1] * big);
    else if ('[]{}'.includes(k)) { keyStep('turn'); t.rot = wrapAngle((t.rot || 0) + ('[{'.includes(k) ? -1 : 1) * (e.shiftKey ? 15 : 5) * Math.PI / 180); commit(); }
    else { keyStep('size'); const f = '-_'.includes(k) ? 1 / (e.shiftKey ? 1.2 : 1.05) : (e.shiftKey ? 1.2 : 1.05); t.width = Math.min(0.9, Math.max(0.012, t.width * f)); commit(); }
  } else used = false;
  if (used) { e.preventDefault(); markTried('keys'); }
});
$('#resetTransform').addEventListener('click',()=>{const t=sel();if(!t || t.locked)return;snapshot();t.rot=0;t.wrap=0;t.bend=0;t.taper=0;commit();});
async function cleanupSelected(linked=false) {
  const t = sel(); if (!t) return;
  if (t.locked) { toast('Unlock this tattoo before editing its artwork.'); return; }
  cancelGesture();
  const id = t.id, prior = t.img;
  const art = state.artworks?.[t.artworkId];
  const source = art?.source || prior;
  const result = await editArtwork(images[source] || images[prior], images[prior], art?.cleanupSession);
  if (!result) return;
  const current = state.tattoos.find(x => x.id === id);
  if (!current || current.img !== prior || current.locked) { toast('The artwork changed while cleanup was open. Nothing was replaced.'); return; }
  const key = uid(); images[key] = result.dataUrl;
  if(!await loadImg(key)){delete images[key];toast('The cleaned image could not be opened. Nothing changed.');return;}
  snapshot();
  const was=new Map(state.tattoos.map(q=>[q.id,q]));
  const revision=applyArtworkRevision(state,id,key,result.aspect,{linked,session:result.session,settings:result.settings});
  state=revision.nextState;
  for(const cid of revision.changedIds){const q=state.tattoos.find(x=>x.id===cid);keepVersion(was.get(cid),q);}
  if(revision.artworkId)state.artworks[revision.artworkId].cleanup=result.settings || {};
  commit(); toast(`${revision.changedIds.length} artwork updated. Original kept.${revision.skippedIds.length?' Locked copies unchanged.':''}`, 'Undo', undo);
}
/* ---------- edit in Procreate and bring it back to the same tattoo ---------- */
function editInProcreate() {
  markTried('edit-procreate');
  const t = sel(); if (!t) return;
  if (t.locked) { toast('Unlock this tattoo before editing its artwork.'); return; }
  cancelGesture();
  const im = imgEls[t.img];
  if (!im) { loadImg(t.img); toast('Getting the artwork ready. Tap Edit in Procreate again.'); return; }
  // made right here in the tap, so the share sheet is allowed to open
  const url = artworkAsSeen(im, { mirror: !!t.flip, upsideDown: !t.imageTopDown });
  writePending({ tattooId: t.id, name: t.name || 'Tattoo', at: Date.now(), width: im.naturalWidth, height: im.naturalHeight });
  renderProcreateBar();
  shareOrDownload(editFileName(t.name), dataUrlBlob(url)).then((how) => {
    if (how === 'cancelled') { writePending(null); renderProcreateBar(); return; }
    toast(how === 'shared' ? 'Choose Procreate. When you finish, use Copy All in Procreate and tap Paste here.' : 'Picture saved. Open it in Procreate, then Copy All and tap Paste here.');
  }).catch((e) => toast('Could not send the picture: ' + e.message));
}
function procreatePending() { const p = readPending(); if (p?.kind === 'new') return { p, t: null }; const t = p && state.tattoos.find((x) => x.id === p.tattooId); return t ? { p, t } : null; }
function renderProcreateBar() {
  const bar = $('#procreateBar'); if (!bar) return; const now = procreatePending();
  bar.hidden = !now || !!paint; if (!now) return;
  const fresh = now.p.kind === 'new';
  $('#pcHead').textContent = fresh ? 'Draw your new tattoo in Procreate.' : `Bring back ${now.t.name || 'your tattoo'} from Procreate.`;
  $('#pcHow').textContent = fresh ? 'Draw on a new layer, hide the guide layer, then swipe down with three fingers, tap Copy All and tap Paste here.' : 'When you finish, swipe down with three fingers in Procreate and tap Copy All, then tap Paste here.';
  $('#pcSend').hidden = !fresh;
}
/* ---------- draw a new tattoo in Procreate on a painted area ---------- */
// One finger (or the Pencil) that starts on the body paints the area; one that starts off the
// body still turns the view, and two fingers still zoom and pan. Nothing is saved until the
// drawing comes back as a new tattoo.
let paint = null, drawGuideUrl = null;
const paintMat = new THREE.MeshBasicMaterial({ color: 0x8474ff, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
function startPaint() {
  markTried('draw-new');
  if (poseView.active) { toast('Turn off the pose first, then paint the area.'); return; }
  cancelGesture(); select(null); showLook(false); tapPlaceId = null;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', bodyGeo.attributes.position); geo.setIndex([]);
  const mesh = new THREE.Mesh(geo, paintMat); mesh.renderOrder = 3; mesh.frustumCulled = false; scene.add(mesh);
  paint = { tris: new Set(), mesh }; renderPaint(); renderProcreateBar();
}
function endPaint() { if (!paint) return; scene.remove(paint.mesh); paint.mesh.geometry.dispose(); paint = null; renderPaint(); renderProcreateBar(); needsRender = true; }
function renderPaint() {
  $('#paintBar').hidden = !paint; document.body.classList.toggle('painting', !!paint);
  if (!paint) return; $('#paintGo').disabled = !paint.tris.size; $('#paintClear').disabled = !paint.tris.size;
}
function triCentre(tri, I = bodyGeo.index.array, P = bodyGeo.attributes.position.array) { const c = [0, 0, 0]; for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) c[j] += P[I[tri * 3 + k] * 3 + j] / 3; return c; }
function paintAt(x, y, added = null) {
  const h = hitBody(x, y); if (!h || h.faceIndex == null || !paint) return;
  const k = (2 * cur.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / canvas.getBoundingClientRect().height, R = Math.max(0.006, 26 * k);
  const A = bodyAdjacency(), seen = new Set([h.faceIndex]), queue = [h.faceIndex], p = h.point;
  while (queue.length) {
    const t = queue.pop(), c = triCentre(t); if (Math.hypot(c[0] - p.x, c[1] - p.y, c[2] - p.z) > R && t !== h.faceIndex) continue;
    if (!paint.tris.has(t)) { paint.tris.add(t); added?.add(t); }
    for (let j = 0; j < 3; j++) { const nx = A[t * 3 + j]; if (nx >= 0 && !seen.has(nx)) { seen.add(nx); queue.push(nx); } }
  }
  showPaint();
}
function showPaint() {
  const I = bodyGeo.index.array, idx = new Uint32Array(paint.tris.size * 3); let i = 0;
  for (const t of paint.tris) { idx[i++] = I[t * 3]; idx[i++] = I[t * 3 + 1]; idx[i++] = I[t * 3 + 2]; }
  paint.mesh.geometry.setIndex(new THREE.BufferAttribute(idx, 1)); needsRender = true; renderPaint();
}
// The guide square that covers the painted area, and the picture that goes to Procreate.
function paintedPatch() {
  const I = bodyGeo.index.array, P = bodyGeo.attributes.position.array, pts = [], n = new V3();
  for (const t of paint.tris) {
    const c = triCentre(t, I, P); pts.push(c);
    const a = new V3().fromArray(P, I[t * 3] * 3), b = new V3().fromArray(P, I[t * 3 + 1] * 3), d = new V3().fromArray(P, I[t * 3 + 2] * 3);
    n.add(b.sub(a).cross(d.sub(a))); // area-weighted
  }
  const mid = pts.reduce((s, p) => s.map((v, j) => v + p[j] / pts.length), [0, 0, 0]);
  if (n.lengthSq() < 1e-12) n.set(0, 0, 1); n.normalize();
  const f = frameOf({ normal: n.toArray(), rot: 0 });
  const ext = areaExtent(pts, mid, { right: f.right.toArray(), up: f.up.toArray() });
  const centre = new V3(...mid).addScaledVector(f.right, ext.mx).addScaledVector(f.up, ext.my);
  const hit = surfaceAt(centre.clone().addScaledVector(n, 0.3), n.clone().negate()) || { pos: centre.toArray() };
  const width = THREE.MathUtils.clamp(Math.max(ext.w, ext.h) * 1.25 + 0.012, 0.03, 0.6);
  const patch = { pos: hit.pos, normal: n.toArray(), width, aspect: 1, rot: 0, wrap: 0, bend: 0, taper: 0 };
  // which way the picture's x and y run on the body, read off the patch itself
  const geo = decalGeometry(patch), PP = geo.attributes.position.array, UV = geo.attributes.uv.array, c0 = new V3(...patch.pos);
  let sx = 0, sy = 0; const q = new V3();
  for (let i = 0; i < UV.length / 2; i++) { q.fromArray(PP, i * 3).sub(c0); sx += (UV[i * 2] - 0.5) * q.dot(f.right); sy += (UV[i * 2 + 1] - 0.5) * q.dot(f.up); }
  patch.sx = sx >= 0 ? 1 : -1; patch.sy = sy >= 0 ? 1 : -1;
  return { patch, geo, frame: f };
}
function makeDrawGuide() {
  const { patch, geo, frame } = paintedPatch();
  try {
    const uvs = Float32Array.from(geo.attributes.uv.array, (v) => (v - UV_MARGIN) / (1 - 2 * UV_MARGIN));
    const mask = patchMaskTriangles(geo.attributes.position.array, uvs);
    // the painted area in the guide's own coordinates
    const I = bodyGeo.index.array, P = bodyGeo.attributes.position.array, c0 = new V3(...patch.pos), q = new V3(), hl = [];
    const toUv = (v) => { q.fromArray(P, v * 3).sub(c0); return [0.5 + patch.sx * q.dot(frame.right) / patch.width, 0.5 + patch.sy * q.dot(frame.up) / patch.width]; };
    for (const t of paint.tris) hl.push([...toUv(I[t * 3]), ...toUv(I[t * 3 + 1]), ...toUv(I[t * 3 + 2])]);
    const near = state.tattoos.filter((t) => !t.hidden).map((t) => decals[t.id]).filter((d) => d && d.tex).map((d) => ({ geometry: d.mesh.geometry, texture: d.tex }));
    const ink = makePatchReference(geo, near, UV_MARGIN, GUIDE_SIZE, true);
    // the patch's own picture runs u along sx·right and v along sy·up; show it upright
    const guide = drawGuide({ mask, highlight: hl, skin: skinColor(), ink, label: 'New tattoo', widthCm: patch.width * 100 * state.heightCm / 175, flipX: patch.sx < 0, flipY: patch.sy > 0 });
    return { patch, url: guide.toDataURL('image/png') };
  } finally { geo.dispose(); }
}
function sendDrawGuide() {
  if (!drawGuideUrl) { toast('The guide is gone after a reload. Paint the area again to get a new one.'); return; }
  shareOrDownload('New tattoo guide.png', dataUrlBlob(drawGuideUrl)).then((how) => {
    if (how === 'shared') toast('Choose Procreate. Draw on a new layer, hide the guide, Copy All, then tap Paste here.');
    else if (how === 'downloaded') toast('Guide saved. Open it in Procreate, draw on a new layer, hide the guide, Copy All, then tap Paste here.');
  }).catch((e) => toast('Could not send the guide: ' + e.message));
}
$('#drawNew').addEventListener('click', () => { renderPcMenu(); toggle('#pcMenu', true); });
function renderPcMenu() {
  const p = state.paint; $('#pmPaint').hidden = !p;
  if (p) $('#pmPaintHide').textContent = p.hidden ? 'Show paint' : 'Hide paint';
}
$('#pmSpot').addEventListener('click', () => { toggle('#pcMenu', false); startPaint(); });
$('#pm3dSend').addEventListener('click', () => { toggle('#pcMenu', false); exportPainted('usdz'); });
$('#pm3dLayers').addEventListener('click', () => exportLayered());
$('#pm3dBack').addEventListener('click', () => { toggle('#pcMenu', false); $('#paintedFile').click(); });
$('#pmPaintHide').addEventListener('click', () => { if (!state.paint) return; snapshot(); state.paint.hidden = !state.paint.hidden; commit(); renderPcMenu(); });
$('#pmPaintSplit').addEventListener('click', () => paintToTattoos());
// Body > Reset to plain body: takes off everything painted onto the skin from Procreate, keeps every tattoo
function resetPlainBody() {
  const n = state.tattoos.length, tats = n === 1 ? 'Your tattoo stays in the tray' : n ? `Your ${n} tattoos stay in the tray` : 'No tattoos are placed';
  if (!state.paint) { toast(`The body is already plain: there is no paint from Procreate on it. ${tats}${n ? ': select one and tap the bin to remove it.' : '.'}`); return false; }
  snapshot(); delete state.paint; toggle('#paintPop', false); commit(); renderPcMenu();
  toast(`Plain body back. ${tats}.`, 'Undo', undo); return true;
}
$('#plainBody').addEventListener('click', resetPlainBody);
function renderPaintPop() { const p = state.paint; if (!p) { toggle('#paintPop', false); return; } $('#ppHide').firstChild.textContent = p.hidden ? 'Show paint' : 'Hide paint'; $('#ppHide small').textContent = p.hidden ? 'Put the paint back on the body.' : 'See the plain body with your tattoos, keep the paint for later.'; }
function openPaintPop() { cancelGesture(); for (const id of ['#bodyPop', '#lightPop', '#posePop', '#clothesPop', '#agePop', '#newPop']) toggle(id, false); toggle('#paintPop'); renderPaintPop(); renderTray(); }
$('#ppHide').addEventListener('click', () => { if (!state.paint) return; snapshot(); state.paint.hidden = !state.paint.hidden; commit(); renderPaintPop(); renderPcMenu(); });
$('#ppSplit').addEventListener('click', () => { toggle('#paintPop', false); paintToTattoos(); });
$('#ppRemove').addEventListener('click', () => { if (!state.paint) return; snapshot(); delete state.paint; toggle('#paintPop', false); commit(); renderPcMenu(); toast('Paint removed: the plain body is back with your tattoos. Undo brings the paint back.'); });
$('#pmPaintRemove').addEventListener('click', () => { if (!state.paint) return; snapshot(); delete state.paint; commit(); renderPcMenu(); toast('Paint removed. Undo brings it back.'); });
$('#paintCancel').addEventListener('click', endPaint);
$('#paintClear').addEventListener('click', () => { if (!paint) return; paint.tris.clear(); showPaint(); });
$('#paintGo').addEventListener('click', () => {
  if (!paint || !paint.tris.size) return;
  let made; try { made = makeDrawGuide(); } catch (e) { toast('Could not make the guide: ' + e.message); return; }
  drawGuideUrl = made.url;
  writePending({ kind: 'new', tattooId: '', name: 'New tattoo', at: Date.now(), patch: { pos: made.patch.pos, normal: made.patch.normal, width: made.patch.width, sx: made.patch.sx, sy: made.patch.sy } });
  endPaint(); sendDrawGuide(); // straight from the tap, so the share sheet may open
});
$('#pcSend').addEventListener('click', sendDrawGuide);
async function bringBackNewDrawing(blob, p) {
  const url = URL.createObjectURL(blob);
  let im; try { im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be opened.')); i.src = url; }); } finally { URL.revokeObjectURL(url); }
  const w = im.naturalWidth, h = im.naturalHeight;
  if (Math.abs(w - h) > Math.max(w, h) * 0.02) { toast('That picture is not the square guide. Copy All from the canvas the guide opened in.'); return; }
  const s = Math.min(1, 2048 / w), c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, c.width, c.height);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  if (clearShare(px) < 0.02) { toast('The guide came back too. In Procreate, hide the guide layer, then Copy All again and tap Paste.'); return; }
  const box = inkBox(px, c.width, c.height); if (!box) { toast('Nothing drawn came back. Show your drawing layer in Procreate and Copy All again.'); return; }
  const cut = document.createElement('canvas'); cut.width = box.px[2]; cut.height = box.px[3]; cut.getContext('2d').drawImage(c, box.px[0], box.px[1], box.px[2], box.px[3], 0, 0, box.px[2], box.px[3]);
  // The guide shows the body upright (x to the right, y down), like any picture you upload, so
  // the drawing goes on like an upload: its middle on the same plane, then onto the skin.
  const f = frameOf({ normal: p.normal, rot: 0 }), n = new V3(...p.normal).normalize();
  const ox = (box.x + box.w / 2 - 0.5) * p.width, oy = -(box.y + box.h / 2 - 0.5) * p.width;
  const at = new V3(...p.pos).addScaledVector(f.right, ox).addScaledVector(f.up, oy);
  const hit = surfaceAt(at.clone().addScaledVector(n, 0.3), n.clone().negate());
  cancelGesture(); snapshot();
  const t = await addImage(cut.toDataURL('image/png'), 'New tattoo', { pos: hit ? hit.pos : at.toArray(), normal: p.normal, width: p.width * box.w });
  if (!t) { toast('That drawing could not be added. Nothing changed.'); return; }
  t.status = 'planned'; writePending(null); drawGuideUrl = null; selectedId = t.id; commit();
  toast('Your drawing is on the body as a new tattoo, where you painted.', 'Undo', undo);
}
async function bringBackFromProcreate(blob) {
  const now = procreatePending();
  if (now?.p.kind === 'new') return bringBackNewDrawing(blob, now.p.patch);
  if (!now) { toast('That tattoo is no longer in this project.'); writePending(null); renderProcreateBar(); return; }
  if (now.t.locked) { toast('Unlock this tattoo first, then bring the picture back.'); return; }
  const pic = await normalisePicture(blob), key = uid(); images[key] = pic.dataUrl;
  if (!await loadImg(key)) { delete images[key]; toast('That picture could not be opened. Nothing changed.'); return; }
  const id = now.t.id; cancelGesture(); snapshot();
  const was = new Map(state.tattoos.map((q) => [q.id, q]));
  const rev = applyArtworkRevision(state, id, key, pic.aspect, { linked: false });
  state = rev.nextState;
  for (const cid of rev.changedIds) keepVersion(was.get(cid), state.tattoos.find((x) => x.id === cid));
  const t = state.tattoos.find((x) => x.id === id);
  // the picture came back as it looks on the body, mirror and flip already in it
  t.flip = false; t.imageTopDown = true;
  if (rev.artworkId) { const r = state.artworks[rev.artworkId]; delete r.cleanup; r.editedIn = 'Procreate'; }
  writePending(null); selectedId = id; commit();
  toast(`${t.name || 'Tattoo'} updated from Procreate, same place and size. Your earlier artwork is kept.`, 'Undo', undo);
}
$('#bProcreate').addEventListener('click', editInProcreate);
$('#pcPaste').addEventListener('click', async () => {
  let blob = null;
  try { blob = await clipboardImage(); } catch (_) { /* refused or nothing there */ }
  if (!blob) { toast('No picture copied yet. In Procreate, swipe down with three fingers, tap Copy All, then come back and tap Paste.'); return; }
  bringBackFromProcreate(blob).catch((e) => toast(e.message));
});
$('#pcFile').addEventListener('click', () => $('#procreateFile').click());
$('#procreateFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) bringBackFromProcreate(f).catch((err) => toast(err.message)); });
$('#pcCancel').addEventListener('click', () => { writePending(null); renderProcreateBar(); });
// a keyboard paste works too while a tattoo is out in Procreate
document.addEventListener('paste', (e) => {
  if (!procreatePending() || e.target.closest?.('input,textarea,[contenteditable]')) return;
  const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); bringBackFromProcreate(f).catch((err) => toast(err.message)); }
});
$('#bCleanup').addEventListener('click',()=>cleanupSelected(false).catch(e=>toast('Could not clean up artwork: '+e.message)));
$('#bCleanupLinked').addEventListener('click',()=>cleanupSelected(true).catch(e=>toast('Could not clean up artwork: '+e.message)));
$('#liveGuides').addEventListener('change',()=>{$('#snapGuides').disabled=!$('#liveGuides').checked;if(!$('#liveGuides').checked)$('#snapGuides').checked=false;clearLiveGuides();});
$('#snapGuides').addEventListener('change',clearLiveGuides);
$('#bTapPlace').addEventListener('click',()=>{if(tapPlaceId){tapPlaceId=null;renderSheet();return;}cancelGesture();const t=sel();if(!t||t.locked||t.hidden||t.status==='existing')return;tapPlaceId=t.id;renderSheet();toast('Tap the body to place it. Drag to adjust the view first.');});
$('#cancelTapPlace').addEventListener('click',()=>{tapPlaceId=null;renderSheet();});
$('#bDone').addEventListener('click', () => select(null));
// press and hold Undo (or right-click it) for the list of steps to go back through
let undoHold = 0, undoHeld = false;
$('#undo').addEventListener('pointerdown', () => { undoHeld = false; clearTimeout(undoHold); undoHold = setTimeout(() => { undoHeld = true; openHistory(); }, 500); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#undo').addEventListener(ev, () => clearTimeout(undoHold));
$('#undo').addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(undoHold); undoHeld = true; openHistory(); });
$('#historyList').addEventListener('click', (e) => { const b = e.target.closest('[data-steps]'); if (!b) return; toggle('#historyPop', false); undoSteps(+b.dataset.steps); });
$('#undo').addEventListener('click', (e) => { if (undoHeld) { undoHeld = false; e.preventDefault(); return; } undo(); });
$('#redo').addEventListener('click', redo);
$('#full').addEventListener('click', () => { cancelGesture(); toggle('#bodyPop', false); select(null); fullBody(); });
// Before / after: left of the line shows only ink already on the body, right shows the plans too.
const beforeAfter = createBeforeAfter({ after: $('#stage'), onChange: () => { needsRender = true; $('#baBtn').setAttribute('aria-pressed', String(beforeAfter.on)); } });
function plannedShown() { return state.tattoos.filter((t) => t.status !== 'existing' && decals[t.id] && decals[t.id].mesh.visible); }
function hidePlanned() {
  const off = [];
  for (const t of state.tattoos) { const d = decals[t.id]; if (!d || t.status === 'existing') continue; off.push([d.mesh, d.mesh.visible], [d.outline, d.outline.visible]); d.mesh.visible = false; d.outline.visible = false; }
  return () => { for (const [m, v] of off) m.visible = v; };
}
function posedInk() { return poseView.active ? Object.values(decals).flatMap((d) => [d.mesh, d.outline]) : []; }
function drawFrame() { clothes.sync(shapeKey, poseView.version); poseView.withPosed(() => { if (beforeAfter.on) beforeAfter.render(renderer, scene, camera, hidePlanned); else renderer.render(scene, camera); }, posedInk()); }
/* ---------- poses ---------- */
// The body poses in the main view; ink follows and can still be placed. Nothing is saved.
{
  const list = $('#poseList');
  for (const group of POSE_GROUPS) {
    const keys = Object.keys(POSE_CATALOG).filter((k) => POSE_CATALOG[k].group === group); if (!keys.length) continue;
    if (group !== 'Standing') { const h = document.createElement('h4'); h.textContent = group; list.append(h); }
    const grid = document.createElement('div'); grid.className = 'posegrid'; list.append(grid);
    for (const k of keys) { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.dataset.pose = k; b.textContent = POSE_CATALOG[k].label; grid.append(b); }
  }
  for (const [k, m] of Object.entries(MOTION_CATALOG)) { const o = document.createElement('option'); o.value = k; o.textContent = m.label; $('#motionKind').append(o); }
}
function poseLabel() { const k = poseView.key; return k === 'motion' ? MOTION_CATALOG[poseView.motion.kind].label : k === 'custom' ? 'Custom' : POSE_CATALOG[k] ? POSE_CATALOG[k].label : 'Standing'; }
function renderPose() {
  const k = poseView.key, m = poseView.motion;
  $('#poseBtn').textContent = poseView.active || m.playing ? 'Pose: ' + poseLabel() : 'Pose';
  $('#poseBtn').setAttribute('aria-expanded', String(!$('#posePop').hidden));
  document.querySelectorAll('#poseList [data-pose]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pose === k)));
  $('#motionKind').value = m.kind; $('#motionPlay').textContent = m.playing ? 'Pause' : 'Play'; $('#motionPlay').setAttribute('aria-pressed', String(m.playing));
  document.querySelectorAll('#posePop [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === m.speed)));
  if (!scrubbing) $('#motionScrub').value = k === 'motion' ? Math.round(m.phase * 100) : 0;
}
let scrubbing = false;
function afterPoseChange() { spotCache.clear(); const t = sel(); if (t && !gest) requestAnimationFrame(() => { if (sel() === t && poseView.settled()) revealTattoo(t); }); }
$('#poseBtn').addEventListener('click', () => { cancelGesture(); toggle('#bodyPop', false); toggle('#lightPop', false); toggle('#clothesPop', false); toggle('#agePop', false); toggle('#posePop'); renderPose(); });
$('#poseList').addEventListener('click', (e) => { const b = e.target.closest('[data-pose]'); if (!b) return; cancelGesture(); poseView.choose(b.dataset.pose); renderPose(); setTimeout(afterPoseChange, 320); });
$('#motionKind').addEventListener('change', () => { poseView.scrub(0, $('#motionKind').value); if ($('#motionPlay').getAttribute('aria-pressed') === 'true') poseView.play(); renderPose(); });
$('#motionPlay').addEventListener('click', () => { if (poseView.motion.playing) poseView.pause(); else poseView.play($('#motionKind').value); renderPose(); });
document.querySelectorAll('#posePop [data-speed]').forEach((b) => b.addEventListener('click', () => { poseView.speed = +b.dataset.speed; renderPose(); }));
$('#motionScrub').addEventListener('input', () => { scrubbing = true; poseView.scrub($('#motionScrub').value / 100, $('#motionKind').value); scrubbing = false; renderPose(); });
$('#motionScrub').addEventListener('change', afterPoseChange);
renderPose();
/* ---------- clothes ---------- */
// Everyday clothes drawn over the body, to see which tattoos show. Only for looking: not saved.
{
  const fill = (host, list, part) => { for (const [k, label] of Object.entries(list)) { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.dataset[part] = k; b.textContent = label; $(host).append(b); } };
  fill('#clothesTop', TOPS, 'top'); fill('#clothesBottom', BOTTOMS, 'bottom'); fill('#clothesHair', HAIR, 'hair');
}
function clothesLabel() { const c = clothes.choice, parts = []; if (c.top !== 'none') parts.push(TOPS[c.top]); if (c.bottom !== 'none') parts.push(BOTTOMS[c.bottom]); if (c.hair !== 'none') parts.push('hair'); return parts.join(' + '); }
// Which visible tattoos the clothes hide, partly hide or leave showing.
function clothesReport() {
  const c = clothes.choice; if (c.top === 'none' && c.bottom === 'none' && c.hair === 'none') return null;
  const out = { covered: [], partly: [], showing: [] };
  for (const t of state.tattoos) {
    if (t.hidden) continue; const d = decals[t.id]; const sup = d && d.mesh.geometry.userData.supports;
    const share = clothes.coveredShare(sup); (share >= 0.9 ? out.covered : share > 0.1 ? out.partly : out.showing).push(t.name || 'Untitled');
  }
  return out;
}
function renderClothes() {
  const c = clothes.choice, label = clothesLabel();
  $('#clothesBtn').textContent = label ? 'Clothes: ' + label : 'Clothes';
  $('#clothesBtn').setAttribute('aria-expanded', String(!$('#clothesPop').hidden));
  document.querySelectorAll('#clothesTop [data-top]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.top === c.top)));
  document.querySelectorAll('#clothesBottom [data-bottom]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bottom === c.bottom)));
  document.querySelectorAll('#clothesHair [data-hair]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hair === c.hair)));
  const r = clothesReport(), list = (a) => a.join(', ');
  $('#clothesShow').textContent = !r ? '' : !state.tattoos.some((t) => !t.hidden) ? 'Add a tattoo to see whether it shows.' :
    [r.covered.length ? 'Covered: ' + list(r.covered) + '.' : 'Nothing fully covered.', r.partly.length ? 'Partly showing: ' + list(r.partly) + '.' : '', r.showing.length ? 'Showing: ' + list(r.showing) + '.' : ''].filter(Boolean).join(' ');
}
function setClothes(next) { clothes.set(next); clothes.sync(shapeKey, poseView.version); needsRender = true; renderClothes(); }
$('#clothesBtn').addEventListener('click', () => { cancelGesture(); toggle('#posePop', false); toggle('#lightPop', false); toggle('#bodyPop', false); toggle('#agePop', false); toggle('#clothesPop'); renderClothes(); });
$('#clothesTop').addEventListener('click', (e) => { const b = e.target.closest('[data-top]'); if (b) setClothes({ top: b.dataset.top }); });
$('#clothesBottom').addEventListener('click', (e) => { const b = e.target.closest('[data-bottom]'); if (b) setClothes({ bottom: b.dataset.bottom }); });
$('#clothesHair').addEventListener('click', (e) => { const b = e.target.closest('[data-hair]'); if (b) setClothes({ hair: b.dataset.hair }); });
renderClothes();

/* ---------- aging: how the ink looks after some years (view only, not saved) ---------- */
function renderAging() {
  const a = AGES.find((x) => x.years === agingYears);
  $('#ageBtn').textContent = agingYears ? 'Aging: ' + a.label : 'Aging';
  $('#ageBtn').setAttribute('aria-expanded', String(!$('#agePop').hidden));
  document.querySelectorAll('#ageChoices [data-years]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.years === agingYears)));
}
function setAging(years) { agingYears = AGES.some((a) => a.years === years) ? years : 0; syncDecals(); renderAging(); }
$('#ageChoices').innerHTML = AGES.map((a) => `<button class="btn" type="button" data-years="${a.years}">${a.label}</button>`).join('');
$('#ageBtn').addEventListener('click', () => { cancelGesture(); toggle('#posePop', false); toggle('#lightPop', false); toggle('#bodyPop', false); toggle('#clothesPop', false); toggle('#agePop'); renderAging(); });
$('#ageChoices').addEventListener('click', (e) => { const b = e.target.closest('[data-years]'); if (b) setAging(+b.dataset.years); });
renderAging();
/* ---------- light: studio, daylight, warm room or midday sun (view only, kept on this device) ---------- */
let lightId = applyLight(readLight(), { hemi, key, rim, rim2 });
function renderLight() {
  const L = LIGHTS.find((l) => l.id === lightId);
  $('#lightBtn').textContent = lightId === 'studio' ? 'Light' : 'Light: ' + L.label;
  $('#lightBtn').setAttribute('aria-expanded', String(!$('#lightPop').hidden));
  document.querySelectorAll('#lightChoices [data-light]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.light === lightId)));
}
function setLight(id) { if (id !== 'studio') markTried('light'); lightId = applyLight(id, { hemi, key, rim, rim2 }); writeLight(lightId); needsRender = true; renderLight(); }
$('#lightChoices').innerHTML = LIGHTS.map((l) => `<button class="btn" type="button" data-light="${l.id}">${l.label}</button>`).join('');
$('#lightBtn').addEventListener('click', () => { cancelGesture(); toggle('#newPop', false); toggle('#posePop', false); toggle('#bodyPop', false); toggle('#clothesPop', false); toggle('#agePop', false); toggle('#lightPop'); renderLight(); });
$('#lightChoices').addEventListener('click', (e) => { const b = e.target.closest('[data-light]'); if (b) setLight(b.dataset.light); });
renderLight();
/* ---------- Quick spots: try the selected tattoo on the usual placements ---------- */
let spotSide = 'L', spotId = null;
function renderSpots() {
  const t = sel(); $('#spotTitle').textContent = t ? `Try ${t.name} on` : 'Try it on';
  document.querySelectorAll('#spotSide [data-side]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === spotSide)));
  document.querySelectorAll('#spotChoices [data-spot]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.spot === spotId)));
  spotNotes(t);
}
// where a spot meets the skin on the standing body: { point, normal, aim }, or null
function spotHit(spot, side) {
  const aim = spotAim(spot, side, POSE_BONES, poseView.restRig().joints); if (!aim) return null;
  const p = new V3(...aim.point), d = new V3(...aim.dir), from = p.clone().addScaledVector(d, 1.5);
  ray.set(from, d.clone().negate());
  // the last skin the ray meets before the bone is this limb's own skin, not an arm in the way
  const hits = ray.intersectObject(body, false).filter((h) => h.distance < 1.5 + 1e-6);
  const h = hits[hits.length - 1]; if (!h) return null;
  return { point: h.point, normal: h.normal.clone().transformDirection(body.matrixWorld).normalize(), aim, tri: h.faceIndex };
}
// Does a piece this size fit a limb spot: round the limb (the loop of skin through the spot, square
// to the limb) and up it (the share of the limb between its joints that a piece can use).
const LIMB_ROOM = {
  'forearm-front': ['lowerarm01', 'wrist', 0.8], 'forearm-back': ['lowerarm01', 'wrist', 0.8],
  'upperarm-out': ['upperarm01', 'lowerarm01', 0.75], 'upperarm-front': ['upperarm01', 'lowerarm01', 0.75],
  'thigh-front': ['upperleg01', 'lowerleg01', 0.75], 'thigh-out': ['upperleg01', 'lowerleg01', 0.75],
  calf: ['lowerleg01', 'foot', 0.75], shin: ['lowerleg01', 'foot', 0.75], wrist: [null, null, 0], ankle: [null, null, 0],
};
let spotEdges = null;
const LIMB_PAIR = { 'forearm-front': 'forearm-back', 'forearm-back': 'forearm-front', 'upperarm-out': 'upperarm-front', 'upperarm-front': 'upperarm-out', 'thigh-front': 'thigh-out', 'thigh-out': 'thigh-front', calf: 'shin', shin: 'calf' };
function spotFit(spot, side, h, t) {
  const lim = LIMB_ROOM[spot.id]; if (!lim || !h || h.tri == null) return '';
  if (!spotEdges) spotEdges = edgeTris(bodyGeo.index.array, bodyGeo.index.count / 3);
  const loop = (hh) => (hh && hh.tri != null ? girthAt(bodyGeo.attributes.position.array, bodyGeo.index.array, hh.tri, hh.point.toArray(), hh.aim.along, spotEdges) : null);
  // the same limb measured from the paired spot too (front and back), so both say the same
  const pair = SPOTS.find((x) => x.id === LIMB_PAIR[spot.id]), both = [loop(h), pair ? loop(spotHit(pair, side)) : null].filter((v) => v > 0);
  const girth = both.length ? both.reduce((a, b) => a + b, 0) / both.length : 0;
  let room = 0;
  if (lim[0]) {
    const J = poseView.restRig().joints, at = (n) => { const b = POSE_BONES.find((x) => x.name === `${n}.${side}`); return b ? [0, 1, 2].map((i) => J[b.head * 3 + i]) : null; };
    const a = at(lim[0]), b = at(lim[1]); if (a && b) room = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * lim[2];
  }
  // the piece's width goes round the limb and its height runs up it (Try other spots turns it so)
  spotFitLast[spot.id] = { girth, room };
  return fitNote(t.width, t.width / t.aspect, girth || 0, room);
}
const spotFitLast = {};
// compare spots: under each spot, how much it usually hurts there and what hides a piece this size
let spotNotesKey = '', spotNotesShown = null;
function spotNotes(t) {
  const off = !t || poseView.active, key = off ? '' : `${shapeKey}|${spotSide}|${t.width.toFixed(4)}|${t.aspect.toFixed(3)}`;
  if (key && key === spotNotesKey) return;
  spotNotesKey = key; spotNotesShown = off ? null : {};
  const d = off ? null : painData(), P = bodyGeo.attributes.position.array, list = off ? null : outfitList();
  const r = t ? Math.max(0.01, Math.min(t.width, t.width / t.aspect) / 2) : 0, r2 = r * r;
  document.querySelectorAll('#spotChoices [data-spot]').forEach((b) => {
    const spot = SPOTS.find((x) => x.id === b.dataset.spot), sub = b.querySelector('.spotsub');
    let note = '';
    const h = !off && spot && spotHit(spot, spotSide);
    if (h) {
      const c = h.point.toArray(), u = painUnder({ pos: P, count: PAIN_N, level: d.smooth, place: d.place, centre: c, radius: r });
      const near = []; for (let v = 0; v < PAIN_N; v++) { if (!d.place[v]) continue; const o = v * 3, x = P[o] - c[0], y = P[o + 1] - c[1], z = P[o + 2] - c[2]; if (x * x + y * y + z * z <= r2) near.push(v); }
      const shares = near.length ? list.map((f) => { let n = 0; for (const v of near) if (f(v)) n++; return n / near.length; }) : null;
      note = spotNote(u ? u.level : null, shares, /leg/.test(spot.bone));
      const fit = spotFit(spot, spotSide, h, t);
      if (fit) note = note ? `${note}, ${fit}` : fit[0].toUpperCase() + fit.slice(1);
    }
    if (sub) { sub.textContent = note; sub.hidden = !note; }
    if (spotNotesShown) spotNotesShown[b.dataset.spot] = note;
  });
}
function spotPlace(id) {
  const t = sel(), spot = SPOTS.find((s) => s.id === id); if (!t || !spot) return false;
  if (t.locked) { toast('Unlock this tattoo first.'); return false; }
  if (poseView.active) { toast('Turn off the pose first, then try spots.'); return false; }
  const hit = spotHit(spot, spotSide); if (!hit) { toast('That spot could not be found on this body.'); return false; }
  const h = hit, aim = hit.aim, n = hit.normal;
  snapshot();
  t.pos = h.point.toArray(); t.normal = n.toArray(); t.rot = 0;
  const up0 = frameOf(t).up.toArray(); t.rot = turnAlong(up0, aim.along, t.normal);
  spotId = id; markTried('spots'); if (spotNotesShown && spotNotesShown[id]) markTried('spotCompare'); commit(); focusTattoo(t); renderSpots();
  return true;
}
$('#spotChoices').innerHTML = SPOTS.map((s) => `<button class="btn" type="button" data-spot="${s.id}"><span>${s.label}</span><span class="spotsub" hidden></span></button>`).join('');
$('#spotChoices').addEventListener('click', (e) => { const b = e.target.closest('[data-spot]'); if (b) spotPlace(b.dataset.spot); });
$('#spotSide').addEventListener('click', (e) => { const b = e.target.closest('[data-side]'); if (!b) return; spotSide = b.dataset.side; renderSpots(); const s = SPOTS.find((x) => x.id === spotId); if (s && !s.mid) spotPlace(spotId); });
$('#bSpots').addEventListener('click', () => { cancelGesture(); toggle('#newPop', false); toggle('#lightPop', false); toggle('#agePop', false); toggle('#posePop', false); toggle('#bodyPop', false); toggle('#clothesPop', false); const t = sel(); if (t) spotSide = t.pos[0] >= 0 ? 'L' : 'R'; spotId = null; toggle('#spotPop'); renderSpots(); });
/* ---------- Match a photo of me: fit the body sliders to a full-length photo ---------- */
// The photo is read on this device and dropped when the panel closes; only the body settings
// it leads to are kept, and only when Keep this body is tapped. Undo puts the old body back.
const bm = { before: null, busy: false, token: 0, result: null, ink: null };
function bmShape() { return { figure: state.figure, muscle: state.muscle ?? 0.5, weight: state.weight ?? 0.5, fit: { ...(state.fit || {}) } }; }
function bmSetShape(p) {
  const a = anchorsNow();
  state.weight = p.weight; state.fit = { ...p.fit };
  for (const k of Object.keys(state.fit)) if (!state.fit[k]) delete state.fit[k];
  applyShape(); applyAnchors(a); syncDecals(); renderBody(); needsRender = true;
}
function bmText(msg) { $('#bmText').textContent = msg; }
function bmButtons(fitted) { $('#bmKeep').hidden = !fitted; $('#bmBack').hidden = !fitted; }
// move the body into the space beside the panel, seen from the front
function bmFrame() {
  fullBody(0);
  const b = canvas.getBoundingClientRect(), r = $('#bodyMatch').getBoundingClientRect();
  if (r.right < b.right - 200) { const wpp = 2 * goal.r * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) / b.height; goal.tx = -((r.right + 12 - b.left) / 2) * wpp; }
}
function bmDraw(res) {
  const c = $('#bmPic'); c.width = res.w; c.height = res.h; const g = c.getContext('2d');
  g.drawImage(res.canvas, 0, 0);
  // what was read: the outline lightly, then the joints and the widths measured
  const img = g.getImageData(0, 0, res.w, res.h), d = img.data;
  for (let i = 0; i < res.w * res.h; i++) if (res.mask[i] < 0.5) { d[i * 4] *= 0.45; d[i * 4 + 1] *= 0.45; d[i * 4 + 2] *= 0.45; }
  g.putImageData(img, 0, 0);
  const P = (i) => [res.lm[i].x * res.w, res.lm[i].y * res.h], lw = Math.max(2, res.w / 220);
  g.strokeStyle = '#ffd36b'; g.fillStyle = '#ffd36b'; g.lineWidth = lw;
  // only the joints the photo really shows
  const seen = (i) => { const p = res.lm[i]; return p && (p.visibility ?? 1) >= 0.5 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1; };
  for (const [a, b] of [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [11, 13], [13, 15], [12, 14], [14, 16]]) { if (!seen(a) || !seen(b)) continue; g.beginPath(); g.moveTo(...P(a)); g.lineTo(...P(b)); g.stroke(); }
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) { if (!seen(i)) continue; g.beginPath(); g.arc(...P(i), lw * 2, 0, Math.PI * 2); g.fill(); }
  if (bm.ink) { const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; k.getContext('2d').drawImage(c, 0, 0); bm.ink.drawn = k; }
  bmDrawInk();
}
// The tattoos found in the photo: a numbered box round each, solid when it will be added
function bmDrawInk() {
  const ink = bm.ink; if (!ink) return;
  const c = $('#bmPic'), g = c.getContext('2d'), lw = Math.max(2, c.width / 200);
  g.font = `700 ${Math.round(lw * 9)}px system-ui, sans-serif`; g.textBaseline = 'top';
  ink.pieces.forEach((p, i) => {
    const on = ink.on.has(i), m = lw * 3;
    g.setLineDash(on ? [] : [lw * 3, lw * 3]); g.lineWidth = lw * 1.5; g.strokeStyle = on ? '#7ee0b0' : '#ffffff99';
    g.strokeRect(p.x0 - m, p.y0 - m, p.x1 - p.x0 + 2 * m, p.y1 - p.y0 + 2 * m);
    g.setLineDash([]); g.fillStyle = on ? '#7ee0b0' : '#ffffffaa';
    g.fillText(String(i + 1), p.x0 - m, Math.max(0, p.y0 - m - lw * 10));
  });
}
function bmInkRender() {
  const ink = bm.ink; $('#bmInk').hidden = !ink;
  if (!ink) return;
  const n = ink.on.size, all = ink.pieces.length;
  $('#bmInkText').textContent = (all === 1 ? 'I see a tattoo in this photo.' : `I see ${all} tattoos in this photo.`) + (all > 1 ? ' Tap one in the picture to leave it out.' : ' Tap it in the picture to leave it out.');
  $('#bmMirror').hidden = ink.view === 'back'; $('#bmMirror').setAttribute('aria-pressed', String(!!ink.mirror));
  $('#bmInkAdd').disabled = !n || bm.busy;
  $('#bmInkAdd').textContent = n ? `Add ${n === 1 ? 'it' : n} to the body as already on me` : 'Nothing picked';
}
// Look for tattoos on the skin of a photo that was read
async function bmFindInk(res) {
  bm.ink = null;
  const { findInk } = await import('./photo-ink.js');
  const s = res.lm[11], t = res.lm[12];
  if (!s || !t || (s.visibility ?? 1) < 0.5 || (t.visibility ?? 1) < 0.5) return;
  const px = res.canvas.getContext('2d').getImageData(0, 0, res.w, res.h).data;
  const found = findInk(px, res.mask, res.w, res.h, res.lm);
  if (!found.pieces.length) return;
  bm.ink = { ...found, px, lm: res.lm, w: res.w, h: res.h, view: res.view, on: new Set(found.pieces.map((_, i) => i)), mirror: false };
}
// The 3D body's joints, flat, for the photo's landmark numbers
function bmJoints() {
  const J = poseView.restRig().joints, at = (name, end = 'head') => { const b = POSE_BONES.find((x) => x.name === name); return [J[b[end] * 3], J[b[end] * 3 + 1]]; };
  return { 11: at('upperarm01.L'), 12: at('upperarm01.R'), 13: at('lowerarm01.L'), 14: at('lowerarm01.R'), 15: at('wrist.L'), 16: at('wrist.R'), 23: at('upperleg01.L'), 24: at('upperleg01.R'), 25: at('lowerleg01.L'), 26: at('lowerleg01.R'), 27: at('lowerleg02.L', 'tail'), 28: at('lowerleg02.R', 'tail') };
}
// Put the picked tattoos on the body where the photo shows them, as already on me. Keeps the
// body the photo made too, all as one undo step.
async function bmInkAdd() {
  const ink = bm.ink; if (!ink || !ink.on.size || bm.busy) return;
  bm.busy = true; bmInkRender();
  try {
    const { cutPiece, inkMapper, mirrorLandmarks, mirrorArt } = await import('./photo-ink.js');
    if (bm.result) { bmSetShape(bm.before); snapshot(); bmSetShape(bm.result); } else snapshot();
    const lm = ink.mirror ? mirrorLandmarks(ink.lm) : ink.lm;
    const map = inkMapper(lm, ink.w, ink.h, bmJoints(), ink.view);
    const back = ink.view === 'back', added = [];
    let n = state.tattoos.filter((t) => /^From photo \d+$/.test(t.name || '')).length;
    for (const i of [...ink.on].sort((a, b) => a - b)) {
      let art = cutPiece(ink.px, ink.w, ink.h, ink.pieces[i], ink.ref, ink.sw);
      let cx = art.x0 + art.w / 2; const cy = art.y0 + art.h / 2;
      if (ink.mirror) { art = mirrorArt(art); cx = ink.w - cx; }
      const m = map && map(cx, cy); if (!m) continue;
      const k = body.scale.x || 1;
      const o = body.localToWorld(new V3(m.x, m.y, back ? -3 : 3)), hit = surfaceAt(o, new V3(0, 0, back ? 1 : -1));
      if (!hit) continue;
      const c = document.createElement('canvas'); c.width = art.w; c.height = art.h; c.getContext('2d').putImageData(new ImageData(art.pixels, art.w, art.h), 0, 0);
      const rot = back ? Math.atan2(m.up[0], m.up[1]) : Math.atan2(-m.up[0], m.up[1]);
      const t = await addImage(c.toDataURL('image/png'), `From photo ${++n}`, { ...hit, width: art.w * m.k * k, rot, opacity: 1 });
      if (!t) continue;
      t.status = 'existing'; t.locked = true; added.push(t);
    }
    if (!added.length) { undoStack.pop(); refreshUndo(); bmInkRender(); bmText('Those tattoos are off the edge of the body. Try a photo that shows more of you.'); return; }
    commit(); markTried('photo-ink');
    bm.result = null; bm.before = null; bm.ink = null;
    closeBodyMatch(true);
    Object.assign(goal, { theta: back ? Math.PI : 0 }); glide = true; needsRender = true;
    toast(added.length === 1 ? 'Added the tattoo from your photo, as already on you. Undo takes it off.' : `Added ${added.length} tattoos from your photo, as already on you. Undo takes them off.`, 'Undo', undo);
  } catch (e) { console.error('photo ink', e); bmText('Those tattoos could not be added. Try another photo.'); } finally { bm.busy = false; if (bm.ink) bmInkRender(); }
}
async function bmRun(file) {
  const token = ++bm.token; bm.busy = true; bm.tone = null; bm.ink = null; bmInkRender(); bmButtons(false); bmText('Finding you in the photo...');
  let url = null;
  try {
    url = URL.createObjectURL(file);
    const img = new Image(); img.src = url; await img.decode();
    const res = await readBodyPhotoLazy(img); if (token !== bm.token) return;
    try { await bmFindInk(res); } catch { bm.ink = null; } if (token !== bm.token) return;
    bmDraw(res); bmInkRender();
    bm.ratios = res.ratios; bm.read = { ref: res.ref, parts: res.parts, view: res.view }; bm.lm = res.lm;
    if (res.problems.length) { bmText(res.problems.join(' ')); return; }
    bmText('Shaping the body to match...');
    await new Promise((r) => setTimeout(r, 30));
    const { fitToPhoto } = await import('./body-match.js');
    // a second photo builds on the first: it starts from the body the first one made
    const fit = fitToPhoto(res, bm.result || bm.before); if (token !== bm.token) return;
    bmSetShape(fit.params); bm.result = fit.params; bmButtons(true); markTried('body-photo');
    if (res.ref !== 'height') markTried('body-photo-part');
    bmText(bmSaid(res));
    // a bare back also shows the skin tone: offer it when it differs a lot from the body's
    if (res.view === 'back' && res.canvas) {
      const { backTone } = await import('./body-photo.js');
      const raw = backTone(res.canvas.getContext('2d').getImageData(0, 0, res.w, res.h).data, res.mask, res.w, res.h, res.lm);
      if (raw && !skinCheck(raw)) {
        const n = nearestTone(raw), tone = toneColour(n.depth, n.warmth), [a, b] = [hexToRgb(tone), hexToRgb(skinColor())];
        bm.tone = tone;
        if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 30) toast('Your back shows your skin tone too. Use it on the body?', 'Use tone', () => { snapshot(); state.skinHex = tone; skinOwnOpen = true; skinMat.color.set(state.skinHex); needsRender = true; renderBody(); save(); refreshUndo(); markTried('body-photo-part'); });
      }
    }
  } catch (e) {
    if (token === bm.token) bmText(e && e.message && !/^[A-Z][a-z]+Error/.test(e.message) && e.message.length < 140 ? e.message : 'That photo could not be read. Try another one.');
  } finally { if (url) URL.revokeObjectURL(url); if (token === bm.token) { bm.busy = false; bmInkRender(); } }
}
// What a photo matched, in plain words: "Matched your shoulders, chest and waist from your back."
function bmSaid(res) {
  const names = res.parts.map((k) => PART_NAMES[k]);
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  const whole = res.ref === 'height';
  let msg = whole ? `Matched your whole body${res.view === 'back' ? ', from the back' : ''}.` : `Matched your ${list}${res.view === 'back' ? ', from your back' : ''}. The rest is as it was.`;
  if (res.notes.length) msg += ' ' + res.notes.join(' ');
  return msg + (whole ? ' Keep it, or put the old one back.' : ' Add another photo to fill in more, or keep this.');
}
async function readBodyPhotoLazy(img) { const { readBodyPhoto } = await import('./body-match.js'); return readBodyPhoto(img); }
function openBodyMatch(file) {
  cancelGesture(); closePanels(); toggle('#spotPop', false);
  bm.before = bmShape(); bm.result = null;
  toggle('#bodyMatch', true); bmFrame();
  const c = $('#bmPic'); c.width = 1; c.height = 1; bmButtons(false); bmText('');
  bmRun(file);
}
function closeBodyMatch(keep) {
  if ($('#bodyMatch').hidden) return;
  bm.token++;
  if (bm.result && !keep) bmSetShape(bm.before);
  if (bm.result && keep) { bmSetShape(bm.before); snapshot(); bmSetShape(bm.result); commit(); toast('Body matched to your photo. Undo puts the old one back.'); }
  bm.result = null; bm.before = null;
  const c = $('#bmPic'); c.width = 1; c.height = 1; $('#bodyPhotoFile').value = ''; // drop the photo
  toggle('#bodyMatch', false); fullBody(0);
}
$('#bodyPhotoBtn').addEventListener('click', () => { const f = $('#bodyPhotoFile'); f.value = ''; f.click(); });
$('#bodyPhotoFile').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; if ($('#bodyMatch').hidden) openBodyMatch(f); else bmRun(f); });
$('#bmAgain').addEventListener('click', () => { const f = $('#bodyPhotoFile'); f.value = ''; f.click(); }); // adds to what the earlier photos matched
$('#bmKeep').addEventListener('click', () => closeBodyMatch(true));
$('#bmBack').addEventListener('click', () => { if (bm.result) { bmSetShape(bm.before); bm.result = null; } bmButtons(false); bmText('Put back. Try another photo, or tap Done.'); });
$('#bmClose').addEventListener('click', () => closeBodyMatch(true)); // Done keeps what is showing
$('#bmInkAdd').addEventListener('click', () => bmInkAdd());
$('#bmMirror').addEventListener('click', () => { if (!bm.ink) return; bm.ink.mirror = !bm.ink.mirror; bmInkRender(); });
// tap a found tattoo in the picture to leave it out or put it back
$('#bmPic').addEventListener('click', (e) => {
  const ink = bm.ink; if (!ink || bm.busy) return;
  const c = $('#bmPic'), r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
  const slack = 22 * c.width / r.width; // a finger's worth round each box
  let best = -1, bd = Infinity;
  ink.pieces.forEach((p, i) => { const d = Math.hypot(Math.max(0, p.x0 - x, x - p.x1), Math.max(0, p.y0 - y, y - p.y1)); if (d <= slack && d < bd) { bd = d; best = i; } });
  if (best < 0) return;
  if (ink.on.has(best)) ink.on.delete(best); else ink.on.add(best);
  const g = c.getContext('2d'); g.drawImage(ink.drawn, 0, 0); bmDrawInk(); bmInkRender();
});

/* ---------- My face: a selfie on the 3D head, kept on this device only ---------- */
// The photo (cut to the face, 512px) and its face points live in localStorage 'ia-face', never in
// the project, backups or the shared files' data. Shared pictures show it only while it is on.
const FACE_KEY = 'ia-face';
function faceRead() { try { const f = JSON.parse(localStorage.getItem(FACE_KEY) || 'null'); return f && typeof f.photo === 'string' && Array.isArray(f.lm) && f.lm.length === 478 ? f : null; } catch { return null; } }
function faceWrite(f) { try { if (f) localStorage.setItem(FACE_KEY, JSON.stringify(f)); else localStorage.removeItem(FACE_KEY); return true; } catch { return false; } }
function faceRefresh() { applyShape(); if (typeof syncDecals === 'function') syncDecals(); }
// The head's shape from the photo, on top of the body shape (cached: slider drags call this often)
function faceShapeOffsets() {
  if (!face || !face.saved || face.saved.on === false || !face.uv) return null;
  const P = bodyGeo.attributes.position.array; let h = 0; for (let i = 0; i < P.length; i += 97) h = (h * 31 + Math.round(P[i] * 1e5)) | 0;
  const key = face.version + ':' + h;
  if (faceMorphCache.key !== key) {
    const lm3 = landmarks3D(P, bodyGeo.index.array, FACE_MAP);
    faceMorphCache = { key, off: faceMorph(P, bodyGeo.attributes.normal.array, COUNTS.body + COUNTS.eyes, lm3, face.uv, [EYES.l, EYES.r], 0.85, FACE_DEPTH) };
  }
  return faceMorphCache.off;
}
function faceButtons() {
  const has = !!face.saved, on = has && face.saved.on !== false;
  $('#faceBtn').textContent = face.busy ? 'Finding your face...' : has ? 'Use another face photo' : 'Add my face';
  $('#faceBtn').disabled = face.busy;
  $('#faceRow').hidden = !has; $('#faceShow').textContent = on ? 'Hide my face' : 'Show my face'; $('#faceShow').setAttribute('aria-pressed', String(on));
}
// Front view of the head
function viewFace() {
  const P = bodyGeo.attributes.position.array, c = new V3();
  for (let v = COUNTS.body; v < COUNTS.body + COUNTS.eyes; v++) c.add(new V3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
  c.multiplyScalar(1 / COUNTS.eyes); body.localToWorld(c);
  const k = body.scale.y || 1;
  Object.assign(goal, { theta: 0, phi: Math.PI / 2, roll: 0, tx: c.x, ty: c.y - 0.035 * k, tz: c.z, r: 0.75 * k }); glide = true; needsRender = true;
}
async function faceUse(saved, texture) {
  face.uv = texture.uv; face.version++;
  setSkinFace(texture); skinFaceOn(saved.on !== false); faceRefresh(); faceButtons(); if (typeof renderEyes === 'function') renderEyes();
}
async function faceRestore() {
  const f = faceRead(); if (!f) return;
  try {
    const { makeFaceTexture } = await import('./face.js');
    const img = new Image(); img.src = f.photo; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
    const t = makeFaceTexture(c, f.lm.map(([x, y, z]) => ({ x, y, z })), { x: 0, y: 0, s: c.width });
    face.saved = f; await faceUse(f, { canvas: t.texture, uv: t.uv, iris: t.iris });
  } catch { /* a face that can't be rebuilt just stays off; the photo is kept */ }
}
async function faceFromFile(file) {
  face.busy = true; faceButtons();
  let url = null;
  try {
    url = URL.createObjectURL(file);
    const img = new Image(); img.src = url; await img.decode();
    const { readFacePhoto } = await import('./face.js');
    const r = await readFacePhoto(img);
    const saved = { v: 1, photo: r.photo.toDataURL('image/jpeg', 0.9), lm: r.lm.map((q) => q.map((c) => +c.toFixed(5))), on: true };
    face.saved = saved; const kept = faceWrite(saved);
    face.busy = false; await faceUse(saved, { canvas: r.texture, uv: r.uv, iris: r.iris });
    viewFace(); markTried('face');
    const msg = r.problems[0] || (kept ? 'Your face is on. The photo stays on this device.' : 'Your face is on for now, but this device is out of room to keep it.');
    // the face takes the body's skin tone; offer the photo's tone when they differ a lot
    face.tone = r.tone; const [a, b] = [hexToRgb(r.tone || '#000000'), hexToRgb(skinColor())];
    if (r.tone && !skinCheck(r.tone) && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 40) {
      toast(msg + ' Use the skin tone from this photo too?', 'Use tone', () => { snapshot(); state.skinHex = r.tone; skinOwnOpen = true; skinMat.color.set(state.skinHex); needsRender = true; renderBody(); save(); refreshUndo(); });
    } else toast(msg);
  } catch (e) { toast((e && e.message) || 'That photo could not be read.'); }
  finally { if (url) URL.revokeObjectURL(url); face.busy = false; faceButtons(); $('#faceFile').value = ''; }
}
$('#faceBtn').addEventListener('click', () => { const f = $('#faceFile'); f.value = ''; f.click(); });
$('#faceFile').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) faceFromFile(f); });
$('#faceShow').addEventListener('click', () => { if (!face.saved) return; face.saved.on = face.saved.on === false; faceWrite(face.saved); skinFaceOn(face.saved.on); faceRefresh(); faceButtons(); if (face.saved.on) viewFace(); });
$('#faceRemove').addEventListener('click', () => { face.saved = null; face.uv = null; face.version++; faceWrite(null); setSkinFace(null); faceRefresh(); faceButtons(); renderEyes(); toast('Your face photo is removed from this device.'); });
faceButtons(); faceRestore();

// ---------- Hair ----------
// Very short hair painted on the scalp: bald, shaved or a buzz cut, in a few colours. Kept on this
// device like the Light (not in the project), so a shared project looks the same for everyone.
const HAIR_KEY = 'ia-hair';
const HAIR_NAMES = { black: 'Black', brown: 'Dark brown', chestnut: 'Brown', blond: 'Blond', grey: 'Grey' };
let hair = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(HAIR_KEY) || 'null');
    const hex = v && typeof v.hex === 'string' && /^#[0-9a-f]{6}$/i.test(v.hex) ? v.hex : null;
    if (v && HAIR_STYLES.includes(v.style) && (HAIR_COLOURS[v.colour] || (v.colour === 'photo' && hex))) return { style: v.style, colour: v.colour, hex };
  } catch (_) { /* no storage */ }
  return { style: 'none', colour: 'brown' };
})();
function renderHair() {
  document.querySelectorAll('#hairRow [data-hair]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hair === hair.style)));
  document.querySelectorAll('#beardRow [data-beard]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.beard === beard)));
  document.querySelectorAll('#bodyHairRow [data-bhair]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bhair === bodyHair)));
  const row = $('#hairCols'); row.hidden = hair.style === 'none' && beard === 'none' && bodyHair === 'none';
  row.replaceChildren();
  for (const [k, c] of Object.entries(HAIR_COLOURS)) row.append(el('button', { class: 'sw', type: 'button', 'data-hair-colour': k, style: `background:${c}`, 'aria-label': 'Hair: ' + HAIR_NAMES[k], onclick: () => setHair(hair.style, k) }));
  // the colour read from a photo of their hair, while there is one
  if (hair.hex) row.append(el('button', { class: 'sw photo', type: 'button', 'data-hair-colour': 'photo', style: `background:${hair.hex}`, 'aria-label': 'Hair: from your photo', onclick: () => setHair(hair.style, 'photo') }));
  for (const b of row.children) { const on = b.dataset.hairColour === hair.colour; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
}
const hairHex = (h) => (h.colour === 'photo' && h.hex) || HAIR_COLOURS[h.colour] || HAIR_COLOURS.brown;
function setHair(style, colour = hair.colour, hex = hair.hex) {
  hair = { style, colour, hex: hex || null }; try { localStorage.setItem(HAIR_KEY, JSON.stringify(hair)); } catch (_) { /* private mode: lasts until reload */ }
  if (style !== 'none') markTried('hair');
  if (style === 'medium') markTried('hair-medium');
  if (style === 'long') markTried('hair-long');
  setSkinHair(style, hairHex(hair)); hairShell.set(style, hairHex(hair)); hairStrands.set(style, hairHex(hair)); setSkinBeard(beard, hairHex(hair)); beardStrands.set(beard, hairHex(hair)); needsRender = true; renderHair(); tuckHair();
}
// A beard (Body > Hair): in the hair's colour, kept on this device like the hair.
const BEARD_KEY = 'ia-beard';
var beard = (() => { try { const v = localStorage.getItem(BEARD_KEY); if (BEARD_STYLES.includes(v)) return v; } catch (_) { /* no storage */ } return 'none'; })();
function setBeard(style) {
  beard = BEARD_STYLES.includes(style) ? style : 'none';
  try { localStorage.setItem(BEARD_KEY, beard); } catch (_) { /* private mode: lasts until reload */ }
  if (beard !== 'none') markTried('beard');
  setSkinBeard(beard, hairHex(hair)); beardStrands.set(beard, hairHex(hair)); needsRender = true; renderHair(); tuckHair();
}
// Body hair (Body > Hair): on the forearms, legs, chest and stomach, in the hair colour. Kept on
// this device like the hair, never in the project.
const BODY_HAIR_KEY = 'ia-body-hair', BODY_HAIR_LEVELS = ['none', 'light', 'full'];
var bodyHair = (() => { try { const v = localStorage.getItem(BODY_HAIR_KEY); if (BODY_HAIR_LEVELS.includes(v)) return v; } catch (_) { /* no storage */ } return 'none'; })();
function setBodyHair(level) {
  bodyHair = BODY_HAIR_LEVELS.includes(level) ? level : 'none';
  try { localStorage.setItem(BODY_HAIR_KEY, bodyHair); } catch (_) { /* private mode: lasts until reload */ }
  if (bodyHair !== 'none') markTried('bodyHair');
  setSkinBodyHair(bodyHair); needsRender = true; renderHair();
}
document.querySelectorAll('#bodyHairRow [data-bhair]').forEach((b) => b.addEventListener('click', () => setBodyHair(b.dataset.bhair)));
setSkinBodyHair(bodyHair);
// Match my hair: read the colour and length from a photo, and put on the nearest style this app
// can show. Undo isn't needed: it changes only how this device shows the body, and the old style
// and colour are a tap away.
const HAIR_STYLE_NAMES = { none: 'Bald', buzz: 'Shaved', short: 'Buzz cut', crop: 'Short', medium: 'Medium', long: 'Long' };
function applyHairReading(r) {
  hairLast = r;
  if (!r.found || r.style === 'none') { setHair('none'); toast('I could not see hair in that photo, so the head is bald. If that is wrong, try a photo with your whole head in it.'); }
  else {
    const style = r.style;
    setHair(style, r.colour ? 'photo' : hair.colour, r.colour || hair.hex);
    toast(style === 'long' ? 'Matched your hair: long, in your colour. It shows to just below the shoulders. The photo is not kept.' : `Matched your hair: ${HAIR_STYLE_NAMES[style].toLowerCase()}, in your colour. The photo is not kept.`);
  }
  markTried('hair-photo'); viewFace();
}
let hairLast = null;
async function hairFromFile(file) {
  const btn = $('#hairPhotoBtn'); btn.disabled = true; btn.textContent = 'Reading your hair...';
  let url = null;
  try {
    url = URL.createObjectURL(file);
    const img = new Image(); img.src = url; await img.decode();
    const { readHairPhoto } = await import('./face.js');
    applyHairReading(await readHairPhoto(img));
  } catch (e) { toast((e && e.message) || 'That photo could not be read.'); }
  finally { if (url) URL.revokeObjectURL(url); btn.disabled = false; btn.textContent = 'Match my hair from a photo'; $('#hairPhotoFile').value = ''; }
}
$('#hairPhotoBtn').addEventListener('click', () => { const f = $('#hairPhotoFile'); f.value = ''; f.click(); });
$('#hairPhotoFile').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) hairFromFile(f); });
document.querySelectorAll('#beardRow [data-beard]').forEach((b) => b.addEventListener('click', () => {
  const was = beard; setBeard(b.dataset.beard);
  if (was === 'none' && beard !== 'none') viewFace();
}));
document.querySelectorAll('#hairRow [data-hair]').forEach((b) => b.addEventListener('click', () => {
  const was = hair.style; setHair(b.dataset.hair);
  if (was === 'none' && hair.style !== 'none') viewFace();
}));
const hairShell = createHairShell({ THREE, body });
const hairStrands = createHairStrands({ THREE, body, skullMove, moving: () => poseView.motion.playing, build: (R, N, I, H, style) => buildStrands(R, N, I, H, COUNTS.body, style), onChange: () => { needsRender = true; } });
const beardStrands = createHairStrands({ THREE, body, skullMove, field: 'beard', styles: ['full'], build: (R, N, I, B) => buildBeard(R, N, I, B, COUNTS.body), onChange: () => { needsRender = true; } });
setSkinHair(hair.style, hairHex(hair)); hairShell.set(hair.style, hairHex(hair)); hairStrands.set(hair.style, hairHex(hair)); setSkinBeard(beard, hairHex(hair)); beardStrands.set(beard, hairHex(hair)); renderHair();
afterShape = () => { hairStrands.update(); beardStrands.update(); };
// Hair that hangs over the selected tattoo is moved aside while it is selected, so it can be seen
// and placed. Said once the first time.
// (var, not let: renderUI can run before this part of the module has)
var tuckSaid = false, hairReady = true;
function tuckHair() {
  if (!hairReady) return;
  const t = sel(), live = !!(t && !t.hidden), on = live && hairStrands.covers(t.pos), onB = live && beardStrands.covers(t.pos);
  const moved = hairStrands.tuck(on), movedB = beardStrands.tuck(onB);
  if ((moved && on) || (movedB && onB)) {
    if (!tuckSaid) { tuckSaid = true; toast(on ? 'Your hair is moved aside while this tattoo is selected.' : 'Your beard is trimmed back while this tattoo is selected.'); }
  }
}

/* ---------- Eye colour (Body > Eyes): kept on this device, like hair ---------- */
const EYES_KEY = 'ia-eyes';
const EYE_COLOURS = { dark: '#2a1c14', brown: '#4a3524', hazel: '#7a5a2c', green: '#4f6b3a', blue: '#4a6f96', grey: '#7d8790' };
const EYE_NAMES = { photo: 'From my photo', dark: 'Dark brown', brown: 'Brown', hazel: 'Hazel', green: 'Green', blue: 'Blue', grey: 'Grey' };
let eyes = (() => { try { const v = localStorage.getItem(EYES_KEY); if (EYE_COLOURS[v]) return v; } catch (_) { /* no storage */ } return null; })();
function renderEyes() {
  const row = $('#eyeCols'), photo = skinPhotoIrisHex();
  const keys = [...(photo ? ['photo'] : []), ...Object.keys(EYE_COLOURS)];
  if (row.dataset.keys !== keys.join()) {
    row.replaceChildren(...keys.map((k) => el('button', { class: 'sw' + (k === 'photo' ? ' photo' : ''), type: 'button', 'data-eye': k, style: `background:${k === 'photo' ? photo : EYE_COLOURS[k]}`, 'aria-label': 'Eyes: ' + EYE_NAMES[k], title: EYE_NAMES[k], onclick: () => setEyes(k === 'photo' ? null : k) })));
    row.dataset.keys = keys.join();
  }
  // with no pick: the photo's colour if there is a face photo, else brown
  const current = eyes || (photo ? 'photo' : 'brown');
  for (const b of row.children) { const on = b.dataset.eye === current; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
}
function setEyes(k) {
  eyes = k; try { if (k) localStorage.setItem(EYES_KEY, k); else localStorage.removeItem(EYES_KEY); } catch (_) { /* private mode: lasts until reload */ }
  setSkinIris(k ? EYE_COLOURS[k] : null); markTried('eyes'); needsRender = true; renderEyes();
}
$('#eyeCols').addEventListener('click', () => viewFace(), true);
setSkinIris(eyes ? EYE_COLOURS[eyes] : null); renderEyes();

/* ---------- New to try: the newest features, how to try them, and Show me ---------- */
let quietTry = false; // settings arriving from the account tick nothing in New to try
function markTried(id) { if (quietTry || tried.has(id)) return; tried.add(id); writeTried(tried); renderNew(); }
function renderNew() {
  const n = untriedCount(tried, NEW_FEATURES); $('#newBtn').hidden = n === 0;
  if (!$('#newPop').hidden) { let more = false; for (const f of NEW_FEATURES) if (!newSeen.has(f.id)) { newSeen.add(f.id); more = true; } if (more) writeSeen(newSeen); }
  const u = unseenCount(tried, newSeen, NEW_FEATURES); $('#newCount').textContent = String(u); $('#newCount').hidden = u === 0;
  $('#newBtn').setAttribute('aria-label', `New to try, ${n} not tried yet` + (u ? `, ${u} new` : '')); $('#newBtn').setAttribute('aria-expanded', String(!$('#newPop').hidden));
  if ($('#newPop').hidden) return;
  $('#newList').replaceChildren(...ordered(tried, NEW_FEATURES).map((f) => {
    const done = tried.has(f.id);
    const tick = el('button', { class: 'tick', type: 'button', role: 'checkbox', 'aria-checked': String(done), 'aria-label': (done ? 'Tried: ' : 'Not tried yet: ') + f.title, onclick: () => { if (tried.has(f.id)) tried.delete(f.id); else tried.add(f.id); writeTried(tried); renderNew(); } });
    const text = el('div', {}, el('b', { text: f.title }), el('small', { text: f.how }));
    return el('div', { class: 'newrow' + (done ? ' done' : ''), 'data-feature': f.id }, tick, text, el('button', { class: 'btn', type: 'button', text: 'Show me', onclick: () => showMe(f) }));
  }));
}
function openNew(on = true) { closePanels(); toggle('#planMenu', false); $('#newPop').hidden = !on; renderNew(); }
function closePanels() { cancelGesture(); showLook(false); for (const id of ['#posePop', '#clothesPop', '#agePop', '#lightPop', '#bodyPop', '#share', '#pcMenu', '#newPop']) toggle(id, false); }
function needTattoo() {
  const t = sel() || state.tattoos.find((x) => !x.hidden) || state.tattoos[0];
  if (!t) { toast('Add a tattoo first, then try this.'); return null; }
  if (sel() !== t) select(t.id, true); else revealTattoo(t);
  return t;
}
var infoQuietUntil = 0, infoByShow = false; // More controls opened by a Show me: pointed at, not tried
const SHOW = {
  wrapGrab: () => { const t = sel() || state.tattoos.find((x) => !x.hidden && isWrap(x)) || state.tattoos.find((x) => !x.hidden && wrapInfo(x)); if (!t) return [null, 'Put a long piece on an arm or leg, tap Wrap it round under its name, then drag it anywhere on it: sideways turns it round, up or down slides it along.']; if (sel() !== t) select(t.id, true); else revealTattoo(t); renderSheet(); return $('#wrapRow').hidden ? [null, 'Move the tattoo onto an arm or leg: Wrap it round shows under its name. Then drag it anywhere on it, even round the back.'] : [$('#wrapFit').hidden ? '#wrapRow' : '#wrapFit', $('#wrapFit').hidden ? 'It goes all the way round. Drag it anywhere on it: sideways turns it round the limb, up or down slides it along.' : 'Tap Wrap it round: the long side goes round the limb with the ends meeting at the back. Then drag it anywhere on it, sideways to turn it, up or down to slide it.']; },
  layersSheet: () => { toggle('#planMenu', true); return ['#openLayers', 'Tap Layers and groups. Each tattoo is one line with an eye to hide it and dots to move or lock it; tick several and the actions for them show below.']; },
  layouts: () => { toggle('#planMenu', true); return ['#openPlanning', 'Tap Layouts and views. Name the layout on the body and tap Save; each saved one has Open, and the dots beside it hold Rename, What’s different and Archive.']; },
  measuredWrap: () => { toggle('#planMenu', true); return ['#openWrap', 'Tap Measured wrap. Your ankle numbers are filled in to start; change any of them there.']; },
  together: () => (account && account.configured ? (account.showTogether(), ['#acctInvite', 'Tap Invite someone and send the link to Liv or your artist. Once they join, you both see the same tattoos and each other\'s changes as they happen.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  answer: () => {
    if (workingTogether()) { const t = needTattoo(); if (!t) return null; return ['#approveRow', 'On a project you work on together, tap Looks good or Ask for a change. Everyone on it sees your answer.']; }
    return account && account.configured ? ['#accountBtn', 'Open a project you work on together, then select a tattoo: Looks good and Ask for a change are under its name.'] : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.'];
  },
  commentInvite: () => (account && account.configured ? (account.showTogether(), ['#acctInvite', 'Tap Invite someone, then Comments only. They can comment, answer and add reference pictures, but your tattoos stay where you put them.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  changes: () => (account && account.configured ? (account.showTogether(), ['#acctChanges', 'On a project you work on together, this lists what the others changed since you last looked. Tap Show on a line to see it.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  ownCopy: () => { const b = account && account.configured && account.status() && account.status().bind; return account && account.configured ? (account.showTogether(), b && b.shared ? ['#acctCopy', 'Make my own copy puts this project in your own account as a separate project. Change it freely there; the shared one stays as it is for everyone on it.'] : ['#acctTogether', 'On a project someone shared with you, Make my own copy shows here. It gives you your own project to change freely, and the shared one stays as it is.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']; },
  pointAt: () => (peersHere.length ? ['#showSpotBtn', 'Tap Point, then the spot on the body you want to show them.'] : account && account.configured ? (account.showTogether(), ['#acctTogether', 'When someone else has this project open, a Point button shows at the top. Tap it, then the body, to show them a spot.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  followView: () => (account && account.configured ? (account.showTogether(), ['#acctTogether', 'When someone else has this project open, Follow their view is on their row here. Your screen then turns with theirs until you touch the body.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  hereNow: () => (account && account.configured ? (account.showTogether(), ['#acctTogether', 'When someone else on a project you work on together has it open, they are listed here, with the tattoo they are looking at. Their initial also shows by your account button.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  prefsSync: () => (account && account.configured ? (account.status().signedIn ? account.showPrefs() : account.showTogether(), account.status().signedIn ? ['#acctPrefs', 'Hair, beard, body hair, eye colour, light and your hourly rate come with you to every device you sign in on. Turn Same on every device off here to keep this device its own.'] : ['#acctTogether', 'Sign in here. Your hair, light and the other body settings then follow you to every device you sign in on.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  glance: () => (account && account.configured ? (account.showTogether(), ['#acctGlance', 'Every project you own or were invited to, with whose turn it is. Your turn shows only the ones waiting on you.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  refs: () => {
    toggle('#planMenu', true); return ['#openRefs', sel() ? 'Tap Reference board to add pictures for the selected tattoo or the whole project. Everyone on a shared project sees them.' : 'Tap Reference board, then Add pictures. Select a tattoo first to pin pictures to it.'];
  },
  pins: () => { showLook(true); return ['#pinsBtn', 'Tap Comments, then the spot on the body the comment is about.']; },
  pinFind: () => { if (pinNotes().length >= 4) { pinsOn(); pins.open = null; pins.forTattoo = null; pins.list = true; renderPins(); return ['#pinListFind', 'Type a word, a name or a tattoo to find the comments about it.']; } showLook(true); return ['#pinsBtn', 'Once there are a few comments, tap Comments, then List, and type in Find a comment.']; },
  pinReplies: () => { const n = pinNotes()[0]; if (n) { pinsOn(); openPin(n.id); return ['#pinResolve', 'Reply under the comment, or tap Resolve when it is sorted.']; } showLook(true); return ['#pinsBtn', 'Tap Comments and pin one first. Tap its pin to reply or resolve it.']; },
  forgot: () => (account && account.configured ? (account.showForgot(), ['#acctForgot', 'Type your email, then tap here. We email you a code to sign in and set a new password.']) : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  room: () => { showLook(true); return ['#roomBtn', 'Tap Open skin to see where you still have room, and how big a piece fits there.']; },
  roomFit: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bRoom', 'Find room for it shows in green everywhere this tattoo fits. Tap a green spot to move it there.']; },
  versions: () => { const t = state.tattoos.find((q) => (q.versions || []).length && !q.hidden); if (!t) { if (!needTattoo()) return null; return ['#bProcreate', 'Edit this tattoo in Procreate and bring it back: the earlier artwork is kept as a version you can compare and go back to.']; } if (sel() !== t) select(t.id, true); $('#editorAdvanced').open = true; renderVersions(t); return ['#verBox', 'Tap a version to see it on the body, then Use this one or Side by side.']; },
  straight: () => { const t = needTattoo(); if (!t) return null; $('#editorAdvanced').open = true; lineRender(t); return [$('#lineRow').hidden ? '#estRow' : '#lineRow', 'This line says how far the tattoo is turned off the line of the limb, or off upright on the body. Straighten lines it up in one step you can undo.']; },
  wear: () => { const t = needTattoo(); if (!t) return null; $('#editorAdvanced').open = true; const wr = wearOf(t); $('#wearLine').textContent = wr ? wr.text : ''; $('#wearLine').hidden = !wr; return [wr ? '#wearLine' : '#estRow', 'This line says how the spot treats a tattoo over the years, like sun, rubbing or creases.']; },
  shows: () => { const t = needTattoo(); if (!t) return null; $('#editorAdvanced').open = true; const sv = showsOf(t); $('#showsLine').textContent = sv; $('#showsLine').hidden = !sv; return [sv ? '#showsLine' : '#estRow', 'Under where it sits, a line says which everyday clothes hide this tattoo and which show it.']; },
  even: () => { const t = state.tattoos.find((q) => !q.hidden && evenOf(q)); if (!t) { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bOtherSide', 'Copy to other side makes a mirrored twin. Then More controls says how closely the two match, and Match the other side lines them up.']; } if (sel() !== t) select(t.id, true); $('#editorAdvanced').open = true; evenRender(t); return ['#evenRow', 'This line says how far it is off the centre line, or how closely it matches its twin. The button lines it up in one step you can undo.']; },
  covered: () => { if (!room.on || room.fitId) roomOn(); return [$('#roomCover').hidden ? '#roomText' : '#roomCover', 'This line says how much of each area is covered so far, and how much with your planned pieces: handy for planning a sleeve or a back piece.']; },
  message: () => { toggle('#share', true); return ['#cMessage', 'Every planned tattoo in a few lines of text, with its size, where it sits, the time it takes and your note, ready to paste into a message to your artist.']; },
  planCal: () => { const t = needTattoo(); if (!t) return null; $('#editorAdvanced').open = true; planSitsRender(t); if (!$('#planSits').hidden) return ['#planCal', 'Every planned piece’s sittings in date order, with a warning when one lands while another is still fresh. Add every sitting to calendar saves them all at once.']; return [null, 'Give two or more planned tattoos a first sitting date in More controls. Then the plan lists every sitting in date order and can add them all to your calendar.']; },
  bodySections: () => { toggle('#bodyPop', true); return ['#bodyPop .sec', 'Body in short sections: shape, your photos, skin, hair, eyes and each part.']; },
  plainBody: () => { toggle('#bodyPop', true); return ['#plainBody', 'Takes off anything painted on the skin from Procreate and keeps every tattoo in the tray as its own item. Undo puts it back.']; },
  paintChip: () => [state.paint ? '#paintChip' : null, state.paint ? 'Paint you brought back from Procreate shows here in the tattoo list. Tap it to make it movable tattoos, hide it, or remove it.' : 'Paint you bring back from Procreate now shows in the tattoo list as Paint on skin. Tap it to make it movable tattoos, hide it, or remove it for the plain body.'],
  layout: () => ['#top .toolbar', 'Everything starts here: Body, Preview, Plan and Share, with Undo and Redo as the arrows. Select a tattoo for its own controls.'],
  history: () => { if (!$('#undo').disabled) openHistory(); return ['#undo', 'Press and hold Undo for a list of your last steps. Tap one to go back to just before it. Redo brings them back.']; },
  undoWords: () => [null, 'Undo and Redo now say what they put back, like Undid moving Rose, so a tap never changes something you cannot see.'],
  labels: () => { toggle('#share', true); return ['#cLabels', 'A picture of this view with each tattoo’s name and size written beside it, to send to your artist.']; },
  centre: () => { const t = needTattoo(); if (!t) return null; $('#editorAdvanced').open = true; $('#preciseBox').open = true; return ['#snapLabel', 'Drag a tattoo on your chest, stomach or back across the middle and a line shows down the centre of the body. Turn on snapping here and it sits right on it.']; },
  keys: () => { if (!needTattoo()) return null; return [null, 'With a keyboard: the arrows move the selected tattoo (Shift for bigger steps), [ and ] turn it, - and = size it, Cmd+D duplicates, Delete removes. Undo puts any of it back.']; },
  like: () => { const t = needTattoo(); if (!t) return null; $('#editorAdvanced').open = true; renderInfo(); return ['#likeLine', 'This line says the size as an everyday thing, like about the size of a credit card, so the numbers are easy to picture.']; },
  sitWear: () => { const t = state.tattoos.find((q) => q.status !== 'existing' && !q.hidden); if (!t) { if (!needTattoo()) return null; return ['#bStatus', 'Tap Already on me to mark this tattoo as planned. Then More controls says what to wear to the sitting.']; } if (sel() !== t) select(t.id, true); $('#editorAdvanced').open = true; sitRender(t); return [$('#sitWear').hidden ? '#sitBox' : '#sitWear', 'Under the sittings, a line says what to wear so the spot is open without undressing more than you need to.']; },
  reads: () => { const t = needTattoo(); if (!t) return null; $('#editorAdvanced').open = true; readRender(t); return [$('#readRow').hidden ? '#estRow' : '#readRow', 'This line says who the tattoo reads the right way up for: others, or you looking down at it. The button turns it round in one step you can undo.']; },
  trip: () => { const t = state.tattoos.find((q) => q.status !== 'existing' && !q.hidden); if (!t) { if (!needTattoo()) return null; return ['#bStatus', 'Tap Already on me to mark this tattoo as planned. Then More controls splits it into sittings and checks them against a trip.']; } if (sel() !== t) select(t.id, true); $('#editorAdvanced').open = true; sitRender(t); return ['#sitAway', 'Pick the first sitting, then add a trip or beach day. If it lands while the ink is still fresh, it says so and moves the sittings in one tap.']; },
  sittings: () => { const t = state.tattoos.find((q) => q.status !== 'existing' && !q.hidden); if (!t) { if (!needTattoo()) return null; return ['#bStatus', 'Tap Already on me to mark this tattoo as planned. Then More controls splits it into sittings.']; } if (sel() !== t) select(t.id, true); $('#editorAdvanced').open = true; sitRender(t); return ['#sitBox', 'Pick the date of the first sitting and the weeks between. Each sitting gets its date, and the last line says when it is healed.']; },
  note: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#noteBox', 'Type what your artist should know about this one. It goes on the artist sheet and the artist packet.']; },
  made: () => { const t = state.tattoos.find((q) => q.status === 'existing' && !q.hidden); if (!t) { if (!needTattoo()) return null; return ['#bStatus', 'Tap Planned to mark this tattoo as already on me. Then More controls has who did it and when.']; } if (sel() !== t) select(t.id, true); $('#editorAdvanced').open = true; return ['#madeBox', 'Add who did this tattoo, the studio and the month. It goes on the artist sheet.']; },
  where: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; renderInfo(); return ['#whereLine', 'This line says where the tattoo sits the way your artist measures it, like 3 in below the elbow.']; },
  estimate: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; renderInfo(); return ['#estRow', 'A rough guess at how long this tattoo takes. Type your artist\'s hourly rate for a price.']; },
  pain: () => { showLook(true); return ['#painBtn', 'Tap Pain map, then any spot or tattoo to see how much it usually hurts there.']; },
  tape: () => { showLook(true); return ['#tapeBtn', 'Tap Tape measure, then two points on the body. Around wraps it round an arm, a leg or the waist.']; },
  posesSheet: () => { toggle('#share', true); return ['#cPoses', 'Tap for your tattoo in four poses that move it, in one picture.']; },
  sizesSheet: () => { toggle('#share', true); return ['#cSizes', 'Tap for your tattoo a size smaller, as it is and a size bigger, side by side on the body.']; },
  sleeve: () => { toggle('#share', true); return ['#cSleeve', 'Tap for each arm and leg’s skin laid flat with your tattoos on it, the way artists plan a sleeve.']; },
  mirror: () => { toggle('#share', true); return ['#cMirror', 'Tap for this view beside how it looks in a mirror, where lettering reads backwards.']; },
  bodyChange: () => { toggle('#share', true); return ['#cBodyChange', 'Tap for your tattoo on a slimmer, a heavier and a more muscular body, grown or shrunk with the skin under it.']; },
  distance: () => { toggle('#share', true); return ['#cDistance', 'Tap for your tattoo close up, across a table, a room and a street, with the detail an eye can’t make out at each distance run together.']; },
  agingSheet: () => { toggle('#share', true); return ['#cAging', 'Tap for your tattoo fresh, healed, at 10 and 20 years, in one picture.']; },
  eyes: () => { toggle('#bodyPop', true); viewFace(); return ['#eyeCols', 'Tap a colour for the eyes. The view moves to the face.']; },
  hair: () => { toggle('#bodyPop', true); viewFace(); return ['#hairRow', 'Pick Shaved, Buzz cut, Short, Medium or Long, then a colour.']; },
  hairMedium: () => { toggle('#bodyPop', true); viewFace(); return ['#hairRow [data-hair="medium"]', 'Tap Medium, then pick a colour.']; },
  bodyHair: () => { toggle('#bodyPop', true); return ['#bodyHairRow', 'Pick Light or Full. It grows on the forearms, legs, chest and stomach, in the hair colour. Zoom in on a forearm to see the hairs.']; },
  beard: () => { toggle('#bodyPop', true); viewFace(); return ['#beardRow', 'Under Beard, pick Stubble, Short or Full. It takes the hair colour above.']; },
  hairLong: () => { toggle('#bodyPop', true); viewFace(); return ['#hairRow [data-hair="long"]', 'Tap Long, then pick a colour.']; },
  hairPhoto: () => { toggle('#bodyPop', true); viewFace(); return ['#hairPhotoBtn', 'Pick a photo with your whole head in it, looking at the camera.']; },
  compareShot: () => { toggle('#share', true); return ['#cCompare', 'Tap for this view now and with your planned tattoos, side by side, to save or send.']; },
  cover: () => { const t = needTattoo(); if (!t) return null; renderGap(); return ['#gap', 'Put a planned tattoo over one marked already on me, and this line says how much of the old ink it covers.']; },
  gap: () => { const t = needTattoo(); if (!t) return null; renderGap(); return ['#gap', state.tattoos.filter((x) => !x.hidden).length > 1 ? 'This line says how far the tattoo is from the nearest other one.' : 'Add a second tattoo and this line says how far apart they are.']; },
  skinDetail: () => { toggle('#bodyPop', true); viewFace(); return ['#faceBtn', 'Eyebrows and fine skin texture now show on every body. Zoom in close to see them. Add my face puts your own face on.']; },
  face: () => { toggle('#bodyPop', true); return ['#faceBtn', 'Pick a clear photo of your face, looking straight at the camera.']; },
  bodyPhoto: () => { toggle('#bodyPop', true); return ['#bodyPhotoBtn', 'Pick a full-length photo of yourself, taken straight on. The body takes your shape.']; },
  photoInk: () => { toggle('#bodyPop', true); return ['#bodyPhotoBtn', 'Pick a photo that shows one of your tattoos on bare skin. I find it and put it on the body.']; },
  definition: () => { toggle('#bodyPop', true); return ['#rMuscle', 'Slide Muscle up, or Weight down, to see more muscle definition.']; },
  skinTone: () => { toggle('#bodyPop', true); return ['#skinOwnBtn', 'Tap + to make your own skin tone, or match a photo of your skin.']; },
  light: () => { showLook(true); return ['#lightBtn', 'Tap Light, then pick the light you will see it in most.']; },
  drawNew: () => ['#drawNew', 'Tap Procreate, then Draw on a spot you paint.'],
  account: () => (account && account.configured ? ['#accountBtn', 'Tap here to make your account or sign in. Share, then Send to someone, makes a link to a copy.'] : [null, 'Accounts are not switched on in this copy of Ink Atlas yet.']),
  paint3d: () => { renderPcMenu(); toggle('#pcMenu', true); return ['#pm3dSend', 'Send the 3D body, paint it in Procreate, then bring back your drawing.']; },
  layers3d: () => { renderPcMenu(); toggle('#pcMenu', true); return ['#pm3dLayers', 'Send the 3D body with each tattoo separate. In Procreate, open Layers: Skin and each tattoo are their own groups to paint on.']; },
  paintLayers: () => { renderPcMenu(); toggle('#pcMenu', true); return ['#pm3dBack', 'Paint each tattoo on its own layer in Procreate, share it as Procreate, then pick it here.']; },
  otherSide: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bOtherSide', 'Copy to other side puts a mirrored twin on the other side.']; },
  spotCompare: () => { const t = needTattoo(); if (!t) return null; if ($('#spotPop').hidden) $('#bSpots').click(); return ['#spotChoices [data-spot="forearm-front"]', 'Each spot says how much it usually hurts, the lightest clothes that hide this tattoo there, and on an arm or leg whether it fits at this size. Tap one to move it.']; },
  spots: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bSpots', 'Try other spots moves this tattoo to the forearm, calf, ribs and more, one tap each.']; },
  tryOn: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bTryOn', 'Try on with camera puts this tattoo over your camera. Point it at your skin.']; },
  approval: () => { toggle('#share', true); return ['#cApprove', 'Tap to make a page for your artist or client. They tap Yes or Change for each tattoo and send it back.']; },
  inkCheck: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bInkCheck', 'Ink check shows colours that barely show on your skin, and lines too fine for this size.']; },
  stretch: () => { const t = needTattoo(); if (!t) return null; $('#editorAdvanced').open = true; renderInfo(); return ['#stretchRow', 'This line says how much the skin under the tattoo stretches and squeezes in the poses that move it most. Show that pose puts the body in the one that moves it most.']; },
  flash: () => { const t = sel(); if (t && !$('#bSplit').hidden) { $('#editorAdvanced').open = true; return ['#bSplit', 'Split this picture into one tattoo per design. The first stays where the picture was, the rest go to free spots. Undo puts it back.']; } return ['#add', 'Upload a flash sheet or a page of sketches. When the picture holds several separate designs, Split them gives each its own tattoo.']; },
  sharp: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bInkCheck', 'Ink check and Stencil for your artist now say when the artwork file is too small to print sharp at its size, and how big a file would.']; },
  planStencils: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bStencil', 'Open Stencil for your artist. With two or more planned pieces, All planned pieces makes one PDF with every stencil at real size, at the Detail you set.']; },
  stencil: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bStencil', 'Stencil for your artist turns this tattoo into clean lines at its real size, to print or share.']; },
  realSize: () => { if (!needTattoo()) return null; $('#editorAdvanced').open = true; return ['#bRealSize', 'Real size on screen shows it at its true size. Hold the iPad to your skin.']; },
  handles: () => { if (!needTattoo()) return null; return ['#hSize', 'Drag this corner to resize. Drag the dot above the tattoo to turn it.']; },
  palette: () => { toggle('#share', true); paletteReady = buildPalette(); return ['#cSwatches', 'Saves your skin and ink colours as a palette Procreate opens.']; },
  editProcreate: () => { if (!needTattoo()) return null; return ['#bProcreate', 'Sends this tattoo to Procreate. Copy All there, then tap Paste here.']; },
  pan: () => [null, 'Put two fingers on the screen away from a tattoo and slide them to move the view. Twist clearly to turn it.'],
};
let coachTimer = 0, coachArmed = 0;
function showMe(f) {
  closePanels();
  infoQuietUntil = performance.now() + 1000; const r = SHOW[f.show]?.(); if ($('#editorAdvanced').open) infoByShow = true; if (!r) return;
  coach(r[0], r[1]);
}
function coach(target, text) {
  const ring = $('#pointRing'), tip = $('#pointTip');
  tip.textContent = text; tip.hidden = false; ring.hidden = !target; coachArmed = performance.now() + 350;
  cancelAnimationFrame(coachTimer);
  // the tip stays about 8 seconds on screen: time the page spent busy (opening a panel, a first
  // measurement) does not count, so on a slow device it is never gone before it is seen
  let scrolled = 0, shown = 0, last = 0;
  const place = () => {
    const now = performance.now(); if (last) shown += Math.min(now - last, 100); last = now;
    if (shown > 8000) return endCoach();
    const n = target && document.querySelector(target), vis = n && n.getClientRects().length && !n.hidden;
    // scrolled into view, and again if lines filling in above it push it off screen
    if (vis && scrolled < 6) { const r = n.getBoundingClientRect(); if (!scrolled || r.top < 0 || r.bottom > innerHeight) { n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); scrolled++; } }
    if (vis) {
      const b = n.getBoundingClientRect(), pad = 6; ring.hidden = false;
      Object.assign(ring.style, { left: b.left - pad + 'px', top: b.top - pad + 'px', width: b.width + pad * 2 + 'px', height: b.height + pad * 2 + 'px' });
      const tw = tip.offsetWidth, th = tip.offsetHeight, below = b.bottom + pad + 12 + th < innerHeight - 8;
      tip.style.left = Math.max(16, Math.min(innerWidth - tw - 16, b.left + b.width / 2 - tw / 2)) + 'px';
      tip.style.top = (below ? b.bottom + pad + 12 : Math.max(16, b.top - pad - 12 - th)) + 'px';
    } else {
      ring.hidden = true;
      tip.style.left = Math.max(16, innerWidth / 2 - tip.offsetWidth / 2) + 'px'; tip.style.top = Math.round(innerHeight * 0.42) + 'px';
    }
    coachTimer = requestAnimationFrame(place);
  };
  coachTimer = requestAnimationFrame(() => requestAnimationFrame(place));
}
function endCoach() { cancelAnimationFrame(coachTimer); $('#pointRing').hidden = true; $('#pointTip').hidden = true; }
document.addEventListener('pointerdown', () => { if (!$('#pointTip').hidden && performance.now() > coachArmed) endCoach(); }, true);
$('#newBtn').addEventListener('click', () => openNew($('#newPop').hidden));
$('#openNew').addEventListener('click', () => openNew(true));
renderNew();
$('#baBtn').addEventListener('click', () => {
  if (beforeAfter.on) { beforeAfter.set(false); return; }
  if (!plannedShown().length) { toast('Nothing planned to compare yet. Mark a tattoo as Planned to see it here.'); return; }
  beforeAfter.set(true); toast('Left: your skin now. Right: with your planned tattoos. Drag the line to compare.');
});
/* ---------- ask for approval ---------- */
// A page for your artist or client: each planned tattoo on the body, its artwork and real size,
// Yes or Change and a note. Their reply comes back as plain text you paste into Bring in answers,
// and each tattoo then shows who said yes or what they would change. No server: the page is one
// file, and its answers travel in whatever app they reply with.
function fmtDay(iso) { if (!iso) return ''; const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
function renderReview(t) {
  const el = $('#review'); if (!el) return;
  renderAnswer(t);
  const r = t && t.review; el.hidden = !r; if (!r) return;
  const who = r.by || 'They', day = r.at ? ' on ' + fmtDay(r.at) : '';
  el.className = r.verdict === 'approved' ? 'ok' : 'chg';
  el.textContent = r.verdict === 'approved' ? `${who} said yes${day}.` + (r.note ? ` "${r.note}"` : '') : `${who} asked for a change${day}` + (r.note ? `: "${r.note}"` : '.');
}
/* ---------- answering in the app, on a project worked on together ---------- */
// Looks good / Ask for a change save straight into the tattoo's review (the same field the
// approval page's answers fill), with who said it and when, so everyone on the project sees it.
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const myName = () => ((account && account.displayName && account.displayName()) || '').slice(0, 60);
const workingTogether = () => { const st = account && account.status && account.status(); return !!(st && st.bind && st.bind.shared); };
function renderAnswer(t) {
  const row = $('#approveRow'), box = $('#changeBox'); if (!row) return;
  row.hidden = !t || !workingTogether();
  if (!t || changeFor !== t.id) changeFor = null;
  box.hidden = row.hidden || !changeFor; $('#bAskChange').setAttribute('aria-expanded', String(!box.hidden));
  if (row.hidden) return;
  const r = t.review, mine = !!(r && (r.by || '') === myName());
  $('#bApprove').setAttribute('aria-pressed', String(!!(r && r.verdict === 'approved' && mine)));
  $('#bUnreview').hidden = !(r && mine);
  $('#bSuggest').hidden = !commentOnly || t.status === 'existing' || t.locked || !!suggesting;
  const left = unansweredPlanned(); $('#bApproveAll').hidden = left.length < 2;
  $('#bApproveAll').textContent = `Looks good on all ${left.length}`;
}
// Planned tattoos on show that nobody has answered yet, so a yes to all never covers up
// someone's ask for a change or their name on an answer.
function unansweredPlanned() { return state.tattoos.filter((x) => x.status !== 'existing' && !x.hidden && !x.review); }
function approveAll() {
  const left = unansweredPlanned(); if (left.length < 2) return;
  snapshot(); const at = todayIso(), by = myName(); changeFor = null;
  for (const x of left) x.review = { verdict: 'approved', note: '', by, at };
  markTried('approveAll'); commit();
  toast(`You said yes to ${left.length} tattoos.`, 'Undo', undo);
}
function setReview(verdict, note) {
  const t = sel(); if (!t) return;
  snapshot();
  if (verdict) t.review = { verdict, note: String(note || '').trim().slice(0, 300), by: myName(), at: todayIso() }; else delete t.review;
  changeFor = null; markTried('answer'); commit();
  toast(verdict === 'approved' ? `You said yes to ${t.name || 'this tattoo'}.` : verdict ? `Change asked on ${t.name || 'this tattoo'}.` : 'Answer taken back.', 'Undo', undo);
}
$('#bApprove').addEventListener('click', () => setReview('approved', ''));
$('#bAskChange').addEventListener('click', () => { const t = sel(); if (!t) return; changeFor = changeFor ? null : t.id; renderAnswer(t); if (changeFor) { const n = $('#changeNote'); n.value = t.review && t.review.verdict === 'changes' ? t.review.note : ''; n.focus(); } });
$('#bSendChange').addEventListener('click', () => { const v = $('#changeNote').value.trim(); if (!v) { toast('Say what should change, like: move it up an inch.'); $('#changeNote').focus(); return; } setReview('changes', v); });
$('#bCancelChange').addEventListener('click', () => { changeFor = null; renderAnswer(sel()); });
$('#bUnreview').addEventListener('click', () => setReview(null));
$('#bApproveAll').addEventListener('click', approveAll);

/* ---------- suggest a new spot ---------- */
// Someone who can only comment moves, sizes or turns a tattoo to show where they think it should
// go. Nothing changes for anyone else: Send puts the tattoo back and pins a comment there that
// carries the spot (note.suggest), and someone who can edit taps Use this spot.
function suggestStart() {
  const t = sel(); if (!t || !commentOnly || suggesting) return;
  suggesting = { id: t.id, before: JSON.stringify(t), undoLen: undoStack.length, redo: redoStack.slice() };
  document.body.classList.add('suggesting'); closePanels && closePanels();
  $('#suggestText').textContent = `Move, size or turn ${t.name || 'it'} to where you think it should go.`;
  $('#suggestNote').value = ''; $('#suggestBar').hidden = false;
  renderUI(); placeHandles(); needsRender = true;
}
function suggestEnd(send) {
  const s = suggesting; if (!s) return;
  const i = state.tattoos.findIndex((x) => x.id === s.id), t = state.tattoos[i], was = JSON.parse(s.before);
  const after = t ? Object.fromEntries(SUGGEST_KEYS.filter((k) => t[k] !== undefined).map((k) => [k, JSON.parse(JSON.stringify(t[k]))])) : null;
  if (i >= 0) state.tattoos[i] = was;
  undoStack.length = Math.min(undoStack.length, s.undoLen); redoStack.length = 0; redoStack.push(...s.redo);
  suggesting = null; document.body.classList.remove('suggesting'); $('#suggestBar').hidden = true;
  const moved = after && SUGGEST_KEYS.some((k) => JSON.stringify(after[k]) !== JSON.stringify(was[k]));
  if (!send || !moved) { commit(); refreshUndo(); if (send) toast('Move, size or turn it first, then send.'); return; }
  const n = new V3(...after.normal).normalize(); ray.set(new V3(...after.pos).addScaledVector(n, 0.06), n.clone().negate()); ray.far = 0.25;
  const h = ray.intersectObject(body, false)[0]; ray.far = Infinity;
  const note = { id: uid(), text: $('#suggestNote').value.trim().slice(0, 500) || `Suggested a new spot for ${was.name || 'this tattoo'}`, by: myName(), at: todayIso(), tattooId: was.id, suggest: { tattooId: was.id, ...after } };
  if (h && h.faceIndex != null && h.barycoord) note.pin = { tri: h.faceIndex, w: [h.barycoord.x, h.barycoord.y, h.barycoord.z] };
  else { const k = nearestIndex(after.pos), I = bodyGeo.index.array; let tri = 0; for (let q = 0; q < I.length; q++) if (I[q] === k) { tri = Math.floor(q / 3); break; } const w = [0, 0, 0]; w[[I[tri * 3], I[tri * 3 + 1], I[tri * 3 + 2]].indexOf(k)] = 1; note.pin = { tri, w }; }
  snapshot(); state.notes = [...(Array.isArray(state.notes) ? state.notes : []), note]; commit(); refreshUndo();
  markTried('suggestSpot');
  toast('Suggestion sent. The others see it as a comment and can use that spot.', 'Undo', undo);
}
function suggestUse(n) {
  const g = n && n.suggest, t = g && state.tattoos.find((x) => x.id === g.tattooId);
  if (!t) { toast('That tattoo is not on the body any more.'); return; }
  if (commentOnly) return;
  if (t.locked) { toast(`${t.name || 'This tattoo'} is locked. Unlock it first.`); return; }
  snapshot();
  for (const k of SUGGEST_KEYS) { if (g[k] !== undefined) t[k] = JSON.parse(JSON.stringify(g[k])); else if (k === 'wrap' || k === 'bend' || k === 'taper') delete t[k]; }
  state.notes = state.notes.map((x) => (x.id === n.id ? { ...x, done: { by: myName(), at: todayIso() } } : x));
  commit(); markTried('suggestSpot');
  toast(`Moved ${t.name || 'it'} to ${n.by || 'their'}${n.by ? "'s" : ''} spot.`, 'Undo', undo);
}
$('#bSuggest').addEventListener('click', suggestStart);
// Hold to see it there: while the finger is down the tattoo shows at the suggested spot, and it
// goes back the moment it lifts. Nothing is saved, so there is nothing to undo.
let spotPeek = null;
function peekSpot(on) {
  if (on && !spotPeek) {
    const n = pins.open && pinNotes().find((x) => x.id === pins.open), g = n && n.suggest, t = g && state.tattoos.find((x) => x.id === g.tattooId);
    if (!t) return;
    spotPeek = { id: t.id, before: JSON.stringify(t) };
    for (const k of SUGGEST_KEYS) { if (g[k] !== undefined) t[k] = JSON.parse(JSON.stringify(g[k])); else if (k === 'wrap' || k === 'bend' || k === 'taper') delete t[k]; }
    syncDecals(); needsRender = true; $('#pinSuggestPeek').setAttribute('aria-pressed', 'true'); markTried('suggestSpot');
  } else if (!on && spotPeek) {
    const i = state.tattoos.findIndex((x) => x.id === spotPeek.id); if (i >= 0) state.tattoos[i] = JSON.parse(spotPeek.before);
    spotPeek = null; syncDecals(); needsRender = true; $('#pinSuggestPeek').setAttribute('aria-pressed', 'false');
  }
}
{
  const b = $('#pinSuggestPeek');
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch { /* fine */ } peekSpot(true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => peekSpot(false));
  b.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); peekSpot(true); } });
  b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') peekSpot(false); });
  b.addEventListener('blur', () => peekSpot(false));
}
$('#pinSuggestUse').addEventListener('click', () => { const n = pins.open && pinNotes().find((x) => x.id === pins.open); if (n) suggestUse(n); });
$('#suggestSend').addEventListener('click', () => suggestEnd(true));
$('#suggestCancel').addEventListener('click', () => suggestEnd(false));
$('#suggestNote').addEventListener('keydown', (e) => e.stopPropagation());
$('#changeNote').addEventListener('keydown', (e) => e.stopPropagation());

/* ---------- comments pinned to the body ---------- */
// A comment on one spot of the skin ("move this up an inch"), kept with the artist notes in
// state.notes as { id, text, pin: { tri, w }, by, at, tattooId? }. The spot is a body triangle and
// weights in it, like tattoo anchors, so it stays on the same skin through every shape and pose.
function pinNotes() { return (Array.isArray(state.notes) ? state.notes : []).filter((n) => n && typeof n === 'object' && n.pin && typeof n.id === 'string'); } // a declaration: the edit sheet counts them before this line runs
function pinSpot(p) {
  const geo = poseView.active ? (poseView.ensure(), poseView.geometry || bodyGeo) : bodyGeo;
  const P = geo.attributes.position.array, I = bodyGeo.index.array, Nn = (geo.attributes.normal || bodyGeo.attributes.normal).array, pos = new V3(), n = new V3();
  if (p.tri * 3 + 2 >= I.length) return null;
  for (let k = 0; k < 3; k++) { const v = I[p.tri * 3 + k]; pos.x += P[v * 3] * p.w[k]; pos.y += P[v * 3 + 1] * p.w[k]; pos.z += P[v * 3 + 2] * p.w[k]; n.x += Nn[v * 3] * p.w[k]; n.y += Nn[v * 3 + 1] * p.w[k]; n.z += Nn[v * 3 + 2] * p.w[k]; }
  return { pos, n: n.normalize() };
}
// Which comments this person has not read yet, on a project worked on together: kept on this
// device only (localStorage ia-pins-seen), as how many things by others each comment had when opened.
const pinSeen = (() => { try { const o = JSON.parse(localStorage.getItem('ia-pins-seen') || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } })();
function othersIn(n) { const me = myName() || 'You'; return (n.by && n.by !== me ? 1 : 0) + (Array.isArray(n.replies) ? n.replies.filter((r) => r.by && r.by !== me).length : 0); }
function pinUnread(n) { return workingTogether() && !!myName() && othersIn(n) > (+pinSeen[n.id] || 0); }
function markPinRead(n) {
  if (!n || !workingTogether()) return;
  const c = othersIn(n); if ((+pinSeen[n.id] || 0) >= c) return;
  pinSeen[n.id] = c; markTried('pinNew'); renderTray();
  const keys = Object.keys(pinSeen); if (keys.length > 500) for (const k of keys.slice(0, keys.length - 500)) delete pinSeen[k];
  try { localStorage.setItem('ia-pins-seen', JSON.stringify(pinSeen)); } catch { /* no storage: it shows as new again next time */ }
}
function pinMarker(id, label, text) {
  const b = el('button', { type: 'button', 'aria-label': text }); b.append(el('i', { text: label }));
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => { e.stopPropagation(); if (id === 'new') return; openPin(id); });
  return b;
}
function renderPins() {
  const list = pinNotes(), layer = $('#pinLayer');
  const openCount = list.filter((n) => !n.done).length;
  $('#pinsBtn').textContent = 'Comments' + (openCount ? ` (${openCount})` : '');
  $('#pinsBtn').setAttribute('aria-pressed', String(pins.on));
  $('#pinBar').hidden = !pins.on;
  if (pins.open && !list.find((n) => n.id === pins.open)) pins.open = null;
  const open = pins.open && list.find((n) => n.id === pins.open);
  $('#pinEdit').hidden = !pins.pending; $('#pinRead').hidden = !open || !!pins.pending; renderTyping();
  if (!list.length || pins.pending || open) pins.list = false;
  if (!pins.list) pins.forTattoo = null;
  const forT = pins.forTattoo && state.tattoos.find((x) => x.id === pins.forTattoo);
  $('#pinListBtn').hidden = !list.length || !!pins.pending || !!open;
  $('#pinListBtn').textContent = pins.list ? 'Hide list' : 'List'; $('#pinListBtn').setAttribute('aria-expanded', String(pins.list));
  $('#pinList').hidden = !pins.list;
  if (pins.list) {
    const anyMine = list.some(mentionsMeIn); if (!anyMine && pins.filter === 'me') pins.filter = 'open';
    $('#pinListMe').hidden = !anyMine;
    for (const [b, f] of [['#pinListOpen', 'open'], ['#pinListAll', 'all'], ['#pinListMe', 'me']]) $(b).setAttribute('aria-pressed', String((pins.filter || 'all') === f));
    const findOn = list.length >= 4 && !forT; $('#pinListFind').hidden = !findOn; if (!findOn) pins.find = '';
    if ($('#pinListFind').value !== (pins.find || '')) $('#pinListFind').value = pins.find || '';
    const tName = (n) => { const t = n.tattooId && state.tattoos.find((x) => x.id === n.tattooId); return t ? t.name || '' : ''; };
    const shown = list.map((n, i) => [n, i]).filter(([n]) => (pins.filter !== 'open' || !n.done) && (pins.filter !== 'me' || mentionsMeIn(n)) && (!forT || n.tattooId === forT.id) && matchesComment(n, pins.find, tName(n)));
    $('#pinListEmpty').hidden = shown.length > 0;
    $('#pinListEmpty').textContent = (pins.find || '').trim() ? `No ${pins.filter === 'open' ? 'open ' : ''}comments mention "${pins.find.trim()}".${pins.filter === 'open' ? ' Tap All to look in resolved ones too.' : ''}` : 'No open comments. Tap All to see the resolved ones.';
    $('#pinListItems').replaceChildren(...shown.map(([n, i]) => {
      const t = n.tattooId && state.tattoos.find((x) => x.id === n.tattooId), r = Array.isArray(n.replies) ? n.replies.length : 0;
      const b = el('button', { type: 'button' }); b.append(el('b', { text: `${i + 1}. ${n.text || ''}` }), el('small', { text: [n.by || 'You', t ? 'on ' + (t.name || 'a tattoo') : '', r ? `${r} ${r === 1 ? 'reply' : 'replies'}` : '', mentionsMeIn(n) ? 'mentions you' : '', pinUnread(n) ? 'new' : '', n.done ? 'resolved' : ''].filter(Boolean).join(' · ') }));
      b.addEventListener('click', () => { pins.list = false; openPin(n.id); turnToPin(n.id); });
      const li = el('li'); li.classList.toggle('done', !!n.done); li.append(b); return li;
    }));
  }
  $('#pinText').textContent = pins.list && forT ? `Comments on ${forT.name || 'this tattoo'}` : pins.pending ? 'Type your comment for this spot.' : open ? `Comment ${list.indexOf(open) + 1} of ${list.length}` + (open.done ? ' · resolved' : '') : list.length ? 'Tap the body to pin a comment there. Tap a pin to read it.' : 'Tap the body to pin a comment there, like: move this up an inch.';
  if (open) {
    $('#pinBody').replaceChildren(...mentionNodes(open.text || ''));
    const t = open.tattooId && state.tattoos.find((x) => x.id === open.tattooId);
    $('#pinWho').textContent = [open.by || 'You', open.at ? fmtDay(open.at) : '', t ? 'on ' + (t.name || 'a tattoo') : ''].filter(Boolean).join(' · ') + (open.done ? `. Resolved by ${open.done.by || 'someone'}${open.done.at ? ' ' + fmtDay(open.done.at) : ''}.` : '');
    $('#pinReplies').replaceChildren(...(Array.isArray(open.replies) ? open.replies : []).map((r) => { const li = el('li'); li.append(...mentionNodes(r.text), el('small', { text: [r.by || 'Someone', r.at ? fmtDay(r.at) : ''].filter(Boolean).join(' · ') })); return li; }));
    renderReacts(open);
    const g = open.suggest, gt = g && state.tattoos.find((x) => x.id === g.tattooId);
    $('#pinSuggest').hidden = !g;
    if (g) {
      const inch = (w) => (w * state.heightCm / 175 * 100 / 2.54).toFixed(1);
      $('#pinSuggestText').textContent = !gt ? 'A suggested spot for a tattoo that is no longer on the body.' : `${open.by || 'Someone'} suggests this spot for ${gt.name || 'a tattoo'}: ${inch(g.width)} in wide${Math.abs(g.width - gt.width) > 0.002 ? ` (it is ${inch(gt.width)} in now)` : ''}. The pin shows where.`;
      $('#pinSuggestUse').hidden = !gt || commentOnly || !!open.done;
      $('#pinSuggestPeek').hidden = !gt;
    }
    $('#pinRead').classList.toggle('done', !!open.done);
    $('#pinResolve').textContent = open.done ? 'Reopen' : 'Resolve';
    $('#pinDelete').hidden = commentOnly && !(open.by && open.by === myName());
  }
  const key = pins.on ? list.map((n) => n.id + ':' + (n.text || '').length + (n.done ? 'd' : '')).join(',') + (pins.pending ? '+new' : '') : '';
  if (key !== pins.ids) {
    pins.ids = key; layer.replaceChildren(); pins.els.clear();
    if (pins.on) {
      list.forEach((n, i) => { const b = pinMarker(n.id, n.done ? '✓' : String(i + 1), `Comment ${i + 1}${n.done ? ', resolved' : ''}: ${n.text || ''}`); b.classList.toggle('done', !!n.done); pins.els.set(n.id, { b, p: n.pin }); layer.append(b); });
      if (pins.pending) { const b = pinMarker('new', '+', 'New comment here'); pins.els.set('new', { b, p: pins.pending }); layer.append(b); }
    }
  }
  if (open) markPinRead(open);
  const unread = new Set(list.filter(pinUnread).map((n) => n.id));
  for (const [id, e] of pins.els) { e.b.classList.toggle('on', id === pins.open || id === 'new'); e.b.classList.toggle('unread', unread.has(id)); }
  $('#pinsBtn').classList.toggle('has-new', unread.size > 0); $('#lookBtn').classList.toggle('has-new', unread.size > 0 && !pins.on);
  $('#pinsBtn').setAttribute('aria-label', 'Comments' + (openCount ? `, ${openCount} open` : '') + (unread.size ? `, ${unread.size} new` : ''));
  canvas.style.cursor = tape.on || pain.on || pins.on ? 'crosshair' : (tapPlaceId ? 'crosshair' : '');
  needsRender = true; placePins();
}
function placePins() {
  if (!pins.on) return;
  const rc = canvas.getBoundingClientRect();
  for (const [, e] of pins.els) {
    const s = pinSpot(e.p); if (!s) { e.b.hidden = true; continue; }
    const sc = screenOf(s.pos), dist = camera.position.distanceTo(s.pos);
    ray.set(camera.position, s.pos.clone().sub(camera.position).normalize());
    const hit = poseView.active ? poseView.withPosed(() => ray.intersectObject(body, false)[0]) : ray.intersectObject(body, false)[0];
    const behind = hit && hit.distance < dist - 0.012;
    const inView = sc.x > rc.left && sc.x < rc.right && sc.y > rc.top && sc.y < rc.bottom;
    e.b.hidden = !!behind || !inView; if (e.b.hidden) continue;
    e.b.style.left = sc.x + 'px'; e.b.style.top = sc.y + 'px';
  }
}
function pinsOn() {
  if (tape.on) tapeOff(); if (pain.on) painOff(); if (room.on) roomDone();
  cancelGesture(); closePanels(); tapPlaceId = null;
  if (selectedId) select(null);
  pins.on = true; pins.pending = null; pins.open = null; renderPins();
}
function pinsOff() { pins.on = false; pins.pending = null; pins.open = null; pins.list = false; renderPins(); }
function pinTap(x, y) {
  const h = hitBody(x, y);
  if (!h || h.faceIndex == null || !h.barycoord) { toast('Tap directly on the body to pin a comment.'); return; }
  const ink = inkIdsAt(x, y, h)[0];
  pins.pending = { tri: h.faceIndex, w: [h.barycoord.x, h.barycoord.y, h.barycoord.z], tattooId: ink || null }; pins.open = null;
  renderPins(); $('#pinNote').value = ''; setTimeout(() => $('#pinNote').focus(), 30);
}
function openPin(id) { pins.open = pins.open === id ? null : id; pins.pending = null; renderPins(); }
// Turn the view to a comment, but only when its pin is out of sight (the view never jumps for nothing).
function turnToPin(id) {
  const n = pinNotes().find((x) => x.id === id), s = n && pinSpot(n.pin); if (!s) return false;
  placePins(); const e = pins.els.get(id); if (e && !e.b.hidden) return false;
  goal.theta = Math.atan2(s.n.x, s.n.z); goal.phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(s.n.y, -1, 1)), 0.75, 2.0); goal.roll = 0;
  goal.tx = s.pos.x; goal.ty = s.pos.y; goal.tz = s.pos.z; goal.r = THREE.MathUtils.clamp(cur.r, 1.1, 2.2);
  glide = true; needsRender = true; return true;
}
$('#pinListBtn').addEventListener('click', () => { pins.list = !pins.list; renderPins(); });
$('#pinListOpen').addEventListener('click', () => { pins.filter = 'open'; renderPins(); });
$('#pinListAll').addEventListener('click', () => { pins.filter = 'all'; renderPins(); });
$('#pinListMe').addEventListener('click', () => { pins.filter = 'me'; renderPins(); markTried('mention'); });
$('#pinListFind').addEventListener('input', (e) => { pins.find = e.target.value.slice(0, 80); renderPins(); if (pins.find.trim()) markTried('findComment'); });
$('#pinsBtn').addEventListener('click', () => { showLook(false); if (pins.on) pinsOff(); else pinsOn(); });
$('#pinsDone').addEventListener('click', pinsOff);
$('#pinCancel').addEventListener('click', () => { pins.pending = null; renderPins(); });
$('#pinClose').addEventListener('click', () => { pins.open = null; renderPins(); });
$('#pinNote').addEventListener('keydown', (e) => e.stopPropagation());
$('#pinSave').addEventListener('click', () => {
  const text = $('#pinNote').value.trim(), p = pins.pending; if (!p) return;
  if (!text) { toast('Type the comment first.'); $('#pinNote').focus(); return; }
  snapshot();
  const note = { id: 'c' + Math.random().toString(36).slice(2, 10), text, pin: { tri: p.tri, w: p.w.map((v) => +v.toFixed(5)) }, by: myName(), at: todayIso() };
  if (p.tattooId) note.tattooId = p.tattooId;
  state.notes = [...(Array.isArray(state.notes) ? state.notes : []), note];
  pins.pending = null; pins.open = null; markTried('pins'); commit();
  toast('Comment pinned. It is also in your artist notes.', 'Undo', undo);
});
// Replies and resolving: anyone on the project, comment-only people included, since both are comments.
function changePin(id, fn) {
  if (!Array.isArray(state.notes)) return false;
  const i = state.notes.findIndex((n) => n && n.id === id); if (i < 0) return false;
  snapshot(); const n = { ...state.notes[i] }; fn(n);
  state.notes = state.notes.map((x, k) => (k === i ? n : x)); commit(); return true;
}
$('#pinReply').addEventListener('keydown', (e) => e.stopPropagation());
// typing a reply: the others here see "Liv is typing" under that comment for a few seconds
let typingOn = null, typingAt = 0, typingTimer = 0;
const myTyping = () => (typingOn && performance.now() - typingAt < 6000 ? typingOn : null);
$('#pinReply').addEventListener('input', () => {
  if (!peersHere.length) return;
  const was = myTyping(); typingOn = $('#pinReply').value.trim() ? pins.open : null; typingAt = performance.now();
  if (was !== myTyping() && account && account.nudge) account.nudge();
  clearTimeout(typingTimer); typingTimer = setTimeout(() => { if (account && account.nudge) account.nudge(); }, 6100);
});
function renderTyping() {
  const who = pins.open ? peersHere.filter((o) => o.typing === pins.open).map((o) => o.name || 'Someone') : [];
  $('#pinTyping').hidden = !who.length;
  if (who.length) markTried('typing');
  $('#pinTyping').textContent = who.length ? `${who.join(' and ')} ${who.length === 1 ? 'is' : 'are'} typing a reply…` : '';
}
// quick reactions to the open comment, on a project worked on together: one tap, no typing
function renderReacts(n) {
  const list = Array.isArray(n.reacts) ? n.reacts : [], me = myName() || 'You';
  $('#pinReacts').hidden = !workingTogether() && !list.length;
  $('#pinReacts').replaceChildren(...REACTIONS.map(([e, label]) => {
    const who = list.filter((r) => r.e === e).map((r) => r.by), mine = who.includes(me);
    const b = el('button', { class: 'btn react', type: 'button', 'aria-pressed': String(mine), 'data-e': e,
      'aria-label': `${label}${who.length ? ': ' + who.map((w) => (w === me ? 'you' : w)).join(', ') : ''}`, title: who.join(', ') || label,
      onclick: () => { if (changePin(n.id, (x) => { const rs = Array.isArray(x.reacts) ? x.reacts.filter((r) => r.id !== e + '|' + me) : []; if (!mine) rs.push({ id: e + '|' + me, e, by: me }); if (rs.length) x.reacts = rs; else delete x.reacts; })) markTried('reacts'); } });
    b.append(el('span', { text: e, 'aria-hidden': 'true' })); if (who.length) b.append(el('small', { text: String(who.length) }));
    return b;
  }));
}
// @mentions: a mention of this person stands out, and typing @ offers the names on the project
function mentionNodes(text) { return mentionPieces(text, myName()).map((p) => (p.me ? el('mark', { class: 'at-me', text: p.text }) : document.createTextNode(p.text))); }
function mentionsMeIn(n) { return !!myName() && (mentionsMe(n.text, myName()) || (Array.isArray(n.replies) && n.replies.some((r) => mentionsMe(r.text, myName())))); }
function mentionNames() {
  const out = [...((account && account.people && account.people()) || []), ...peersHere.map((o) => o.name)];
  for (const n of state.notes || []) { out.push(n.by); for (const r of Array.isArray(n.replies) ? n.replies : []) out.push(r.by); }
  for (const r of state.refs || []) out.push(r.by);
  for (const t of state.tattoos) if (t.review) out.push(t.review.by);
  return out.filter((x) => typeof x === 'string' && x.trim());
}
function mentionChips(input, box) {
  const at = typingMention(input.value, input.selectionStart);
  const names = at ? mentionOffer(at.partial, mentionNames(), myName()) : [];
  box.hidden = !names.length;
  box.replaceChildren(...names.map((n) => el('button', { class: 'btn', type: 'button', text: '@' + n, 'aria-label': 'Mention ' + n, onpointerdown: (e) => e.preventDefault(), onclick: () => {
    const now = typingMention(input.value, input.selectionStart) || at, r = insertMention(input.value, now, n);
    input.value = r.value; input.focus(); input.setSelectionRange(r.caret, r.caret); box.hidden = true; markTried('mention');
    input.dispatchEvent(new Event('input'));
  } })));
}
for (const [i, b] of [['#pinNote', '#pinNoteAt'], ['#pinReply', '#pinReplyAt']]) {
  const input = $(i), box = $(b);
  for (const ev of ['input', 'click', 'keyup']) input.addEventListener(ev, () => mentionChips(input, box));
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) box.hidden = true; }, 200));
}
$('#pinReplySend').addEventListener('click', () => {
  const id = pins.open, text = $('#pinReply').value.trim(); if (!id) return;
  if (!text) { toast('Type the reply first.'); $('#pinReply').focus(); return; }
  if ((pinNotes().find((n) => n.id === id)?.replies || []).length >= 50) { toast('This comment has 50 replies. Start a new comment for more.'); return; }
  if (changePin(id, (n) => { n.replies = [...(Array.isArray(n.replies) ? n.replies : []), { id: 'r' + Math.random().toString(36).slice(2, 10), text, by: myName(), at: todayIso() }]; })) { $('#pinReply').value = ''; $('#pinReplyAt').hidden = true; markTried('pinReplies'); if (typingOn) { typingOn = null; if (account && account.nudge) account.nudge(); } }
});
$('#pinResolve').addEventListener('click', () => {
  const id = pins.open, n = id && pinNotes().find((x) => x.id === id); if (!n) return;
  const was = !!n.done;
  if (changePin(id, (x) => { if (was) delete x.done; else x.done = { by: myName(), at: todayIso() }; })) { markTried('pinReplies'); toast(was ? 'Comment reopened.' : 'Comment resolved.', 'Undo', undo); }
});
$('#pinDelete').addEventListener('click', () => {
  const id = pins.open; if (!id || !Array.isArray(state.notes)) return;
  const n = pinNotes().find((x) => x.id === id);
  if (commentOnly && !(n && n.by && n.by === myName())) { toast('Only the person who wrote it, or someone who can edit, can delete a comment.'); return; }
  snapshot(); state.notes = state.notes.filter((n) => !(n && n.id === id)); pins.open = null; commit();
  toast('Comment deleted.', 'Undo', undo);
});
/* ---------- reference board: inspiration pictures for the project or one tattoo ---------- */
// Kept in state.refs ({ id, img, tattooId?, note?, by?, at?, aspect? }, cleaned in project.js);
// each picture is an ordinary artwork record, so it saves, backs up and syncs like the rest.
// Anyone on a shared project can add pictures, comment-only people included.
var refsUi = { filter: 'all', open: null }; // var: renderSheet may run before this line
function refList() { return Array.isArray(state.refs) ? state.refs : []; }
function canChangeRef(r) { return !commentOnly || (!!r.by && r.by === myName()); }
function renderRefCount(t) {
  const n = t ? refList().filter((r) => r.tattooId === t.id).length : 0;
  $('#bRefs').textContent = n ? `Reference pictures (${n})` : 'Add reference pictures';
  // the comments pinned on this tattoo, from anyone
  const c = t ? pinNotes().filter((x) => x.tattooId === t.id) : [], open = c.filter((x) => !x.done).length;
  $('#bPinsFor').hidden = !c.length;
  $('#bPinsFor').textContent = open ? `Comments (${open} open)` : `Comments (${c.length})`;
}
$('#bPinsFor').addEventListener('click', () => {
  const t = sel(); if (!t) return;
  const c = pinNotes().filter((x) => x.tattooId === t.id); if (!c.length) return;
  markTried('chipComments'); pinsOn();
  if (c.length === 1) { openPin(c[0].id); turnToPin(c[0].id); return; }
  pins.forTattoo = t.id; pins.list = true; pins.filter = c.some((x) => !x.done) ? 'open' : 'all'; renderPins();
});
function openRefs(filter, refId) {
  toggle('#planMenu', false);
  refsUi.filter = filter && filter !== 'all' && state.tattoos.some((t) => t.id === filter) ? filter : 'all';
  refsUi.open = refId && refList().some((r) => r.id === refId) ? refId : null;
  renderRefs(); toggle('#refs', true);
}
function renderRefs() {
  const all = refList(), t = refsUi.filter === 'all' ? null : state.tattoos.find((x) => x.id === refsUi.filter);
  if (!t) refsUi.filter = 'all';
  const open = refsUi.open && all.find((r) => r.id === refsUi.open);
  $('#refsList').hidden = !!open; $('#refView').hidden = !open;
  if (open) {
    $('#refImg').src = images[open.img] || '';
    const on = open.tattooId && state.tattoos.find((x) => x.id === open.tattooId);
    $('#refWho').textContent = [open.by ? 'Added by ' + open.by : '', open.at ? fmtDay(open.at) : '', on ? 'for ' + on.name : 'for the whole project'].filter(Boolean).join(' · ');
    const can = canChangeRef(open);
    if (document.activeElement !== $('#refText')) $('#refText').value = open.note || '';
    $('#refText').readOnly = !can; $('#refText').hidden = !can && !open.note;
    const selBox = $('#refTattoo'); selBox.replaceChildren(el('option', { value: '', text: 'The whole project' }), ...state.tattoos.map((x) => el('option', { value: x.id, text: x.name || 'Tattoo' })));
    selBox.value = open.tattooId || ''; selBox.disabled = !can;
    $('#refRemove').hidden = !can;
    $('#refTry').hidden = commentOnly || !images[open.img];
    return;
  }
  const seg = $('#refsFor'); seg.replaceChildren();
  const pick = (f, label) => el('button', { class: 'btn', type: 'button', 'aria-pressed': String(refsUi.filter === f), text: label, onclick: () => { refsUi.filter = f; renderRefs(); } });
  const s = sel();
  seg.append(pick('all', `Everything (${all.length})`));
  const forT = t || s; if (forT) seg.append(pick(forT.id, `${forT.name || 'Tattoo'} (${all.filter((r) => r.tattooId === forT.id).length})`));
  const list = t ? all.filter((r) => r.tattooId === t.id) : all;
  const grid = $('#refsGrid'); grid.replaceChildren();
  for (const r of list) {
    const on = r.tattooId && state.tattoos.find((x) => x.id === r.tattooId);
    grid.append(el('button', { class: 'refTile', type: 'button', 'aria-label': 'Open picture' + (r.note ? ': ' + r.note : ''), onclick: () => { refsUi.open = r.id; renderRefs(); } },
      el('img', { src: images[r.img] || '', alt: '' }), el('span', { text: r.note || (on ? on.name : 'Whole project') })));
  }
  $('#refsNote').textContent = list.length ? '' : t ? `No pictures for ${t.name || 'this tattoo'} yet. Add photos of styles, linework or placement you like.` : 'No reference pictures yet. Add photos of styles, linework or placement you like.';
  $('#refsAdd').textContent = t ? `Add pictures for ${t.name || 'this tattoo'}` : 'Add pictures';
}
// a reference picture is kept at most 1400 px on its long side, as a JPEG unless it has see-through parts
async function refPicture(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be opened.')); i.src = url; });
    const w0 = im.naturalWidth, h0 = im.naturalHeight; if (!w0 || !h0) throw new Error('That picture could not be opened.');
    const k = Math.min(1, 1400 / Math.max(w0, h0)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
    let clear = false;
    if (/png|webp|gif/.test(blob.type || '')) { const d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) { clear = true; break; } }
    if (!clear) { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const og = o.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, o.width, o.height); og.drawImage(c, 0, 0); return { src: o.toDataURL('image/jpeg', 0.85), aspect: w0 / h0 }; }
    return { src: c.toDataURL('image/png'), aspect: w0 / h0 };
  } finally { URL.revokeObjectURL(url); }
}
async function addRefPictures(blobs) {
  const pics = blobs.filter((b) => b && /^image\//.test(b.type || 'image/'));
  if (!pics.length) { toast('Choose a picture to add.'); return 0; }
  const room = 60 - refList().length;
  if (room <= 0) { toast('This project already has 60 reference pictures. Remove some first.'); return 0; }
  const made = [];
  for (const b of pics.slice(0, room)) { try { made.push(await refPicture(b)); } catch (e) { toast(e.message); } }
  if (!made.length) return 0;
  snapshot();
  const forId = refsUi.filter !== 'all' ? refsUi.filter : null;
  for (const m of made) {
    const k = uid(); images[k] = m.src;
    const r = { id: uid(), img: k, by: myName() || undefined, at: todayIso(), aspect: +m.aspect.toFixed(4) };
    if (forId) r.tattooId = forId;
    if (!r.by) delete r.by;
    state.refs = [...refList(), r];
  }
  markTried('refs'); commit(); renderRefs();
  toast(made.length === 1 ? 'Reference picture added.' : `${made.length} reference pictures added.`, 'Undo', undo);
  return made.length;
}
$('#bRefs').addEventListener('click', () => { const t = sel(); openRefs(t ? t.id : 'all'); });
$('#openRefs').addEventListener('click', () => openRefs(sel() ? sel().id : 'all'));
$('#refsAdd').addEventListener('click', () => $('#refsFile').click());
$('#refsFile').addEventListener('change', (e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; addRefPictures(fs); });
$('#refsPaste').addEventListener('click', async () => {
  let blob = null; try { blob = await clipboardImage(); } catch (_) { /* refused or nothing there */ }
  if (!blob) { toast('No picture copied yet. Copy one in Photos or Safari, then tap Paste.'); return; }
  addRefPictures([blob]);
});
$('#refBack').addEventListener('click', () => { refsUi.open = null; renderRefs(); });
$('#refText').addEventListener('change', () => { const r = refList().find((x) => x.id === refsUi.open); if (!r || !canChangeRef(r)) return; snapshot(); const v = $('#refText').value.trim().slice(0, 300); if (v) r.note = v; else delete r.note; commit(); });
$('#refTattoo').addEventListener('change', () => { const r = refList().find((x) => x.id === refsUi.open); if (!r || !canChangeRef(r)) return; snapshot(); const v = $('#refTattoo').value; if (v) r.tattooId = v; else delete r.tattooId; commit(); renderRefs(); });
// Try a reference picture on the body as a planned tattoo (its own artwork copy, so the board keeps its picture)
$('#refTry').addEventListener('click', async () => {
  const r = refList().find((x) => x.id === refsUi.open); if (!r || commentOnly || !images[r.img]) return;
  toggle('#refs', false); snapshot();
  const t = await addImage(images[r.img], (r.note || 'From the reference board').slice(0, 40), viewCenterSpot());
  if (!t) return;
  t.status = 'planned'; selectedId = t.id; markTried('refTry'); commit(); focusTattoo(t);
  toast('On the body as a planned tattoo. Clean up artwork in More controls cuts out a background.', 'Undo', undo);
});
$('#refRemove').addEventListener('click', () => {
  const r = refList().find((x) => x.id === refsUi.open); if (!r || !canChangeRef(r)) return;
  snapshot(); state.refs = refList().filter((x) => x.id !== r.id); if (!state.refs.length) delete state.refs; refsUi.open = null; commit(); renderRefs();
  toast('Reference picture removed.', 'Undo', undo);
});
// a change in the list "What changed since you last looked", shown where it happened
function showChange(it) {
  if (it.tattooId && state.tattoos.some((t) => t.id === it.tattooId)) { select(it.tattooId, true); return; }
  if (it.noteId) { const n = pinNotes().find((x) => x.id === it.noteId); if (n) { pinsOn(); openPin(n.id); turnToPin(n.id); return; } toast(it.text); return; }
  if (it.refId) { openRefs('all', it.refId); return; }
  toast(it.text);
}

// what someone else just added, said when their changes come in
function newFromOthers(before) {
  const fresh = pinNotes().filter((n) => !before.pins.has(n.id) && (n.by || '') !== myName());
  if (fresh.length) { const n = fresh[fresh.length - 1]; toast(`${n.by || 'Someone'} pinned a comment: "${(n.text || '').slice(0, 60)}${(n.text || '').length > 60 ? '…' : ''}"`, 'Show', () => { pinsOn(); openPin(n.id); turnToPin(n.id); }); return true; }
  for (const t of state.tattoos) {
    const r = t.review, was = before.reviews.get(t.id);
    if (r && JSON.stringify(r) !== was && (r.by || '') !== myName()) { toast(r.verdict === 'approved' ? `${r.by || 'Someone'} said yes to ${t.name || 'a tattoo'}.` : `${r.by || 'Someone'} asked for a change on ${t.name || 'a tattoo'}: "${(r.note || '').slice(0, 60)}"`, 'Show', () => select(t.id, true)); return true; }
  }
  return false;
}
const othersBefore = () => ({ pins: new Set(pinNotes().map((n) => n.id)), reviews: new Map(state.tattoos.map((t) => [t.id, t.review ? JSON.stringify(t.review) : ''])) });

// The tattoo close up on the body, as a square JPEG for the page.
function closeUpShot(t, size = 720) {
  const oldCur = { ...cur }, oldGoal = { ...goal }, oldGlide = glide, inset = curInset;
  const W = canvas.width, H = canvas.height, side = Math.min(W, H), sx = Math.round((W - side) / 2), sy = Math.round((H - side) / 2);
  const out = document.createElement('canvas'); out.width = out.height = size;
  try {
    curInset = 0; applyInset();
    focusTattoo(t); const spot = viewSpot(t), tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    goal.tx = spot.pos[0]; goal.ty = spot.pos[1]; goal.tz = spot.pos[2]; goal.roll = 0;
    goal.r = THREE.MathUtils.clamp((Math.max(t.width, t.width / t.aspect) * 3 + 0.12) / (2 * tn * Math.min(1, camera.aspect)), 0.35, 3.4);
    Object.assign(cur, goal); glide = false; applyCam();
    exporting = true; syncDecals();
    poseView.withPosed(() => renderer.render(scene, camera), posedInk());
    out.getContext('2d').drawImage(canvas, sx, sy, side, side, 0, 0, size, size);
  } finally {
    exporting = false; syncDecals();
    Object.assign(cur, oldCur); Object.assign(goal, oldGoal); glide = oldGlide; curInset = inset; applyInset(); applyCam(); needsRender = true;
  }
  return out.toDataURL('image/jpeg', 0.82);
}
function artThumb(t, size = 360) {
  const im = imgEls[t.img]; if (!im) return null;
  const k = Math.min(1, size / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height)), w = Math.max(1, Math.round((im.naturalWidth || im.width) * k)), h = Math.max(1, Math.round((im.naturalHeight || im.height) * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.save(); g.translate(t.flip ? w : 0, t.imageTopDown === false ? h : 0); g.scale(t.flip ? -1 : 1, t.imageTopDown === false ? -1 : 1); g.drawImage(im, 0, 0, w, h); g.restore();
  return c.toDataURL('image/jpeg', 0.86);
}
let approvalLast = null;
// a small JPEG of a reference picture for a page that is sent on
async function refThumb(key, size = 480) {
  const src = images[key]; if (typeof src !== 'string') return null;
  const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); if (!im) return null;
  const k = Math.min(1, size / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
async function askApproval() {
  const list = state.tattoos.filter((t) => t.status !== 'existing' && !t.hidden);
  if (!list.length) { toast('Mark a tattoo as planned first, then ask about it.'); return; }
  const shown = list.slice(0, 20), k = state.heightCm / 175;
  const ref = makeRef(), title = state.projectName || 'My tattoo plan';
  const items = shown.map((t, i) => {
    const wIn = t.width * 100 * k / 2.54, hIn = wIn / t.aspect, f = (v) => (v < 10 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString());
    return { n: i + 1, name: t.name || 'Tattoo', size: `${f(wIn)} x ${f(hIn)} in (${Math.round(wIn * 2.54 * 10) / 10} x ${Math.round(hIn * 2.54 * 10) / 10} cm)`, status: 'planned', closeUp: closeUpShot(t), art: artThumb(t) };
  });
  // each tattoo's reference pictures and open comments go with it on the page, so the artist sees the whole brief
  const openNotes = pinNotes().filter((n) => !n.done), noteOut = (n) => ({ text: n.text, by: n.by, replies: (n.replies || []).map((r) => ({ text: r.text, by: r.by })) });
  for (const it of items) {
    const t = shown[it.n - 1];
    it.refs = []; for (const r of refList().filter((x) => x.tattooId === t.id).slice(0, 6)) { const src = await refThumb(r.img); if (src) it.refs.push({ src, note: r.note }); }
    it.comments = openNotes.filter((n) => n.tattooId === t.id).map(noteOut);
  }
  const ids = new Set(state.tattoos.map((t) => t.id)), planRefs = [];
  for (const r of refList().filter((x) => !x.tattooId || !ids.has(x.tattooId)).slice(0, 8)) { const src = await refThumb(r.img); if (src) planRefs.push({ src, note: r.note }); }
  const planComments = openNotes.filter((n) => !n.tattooId || !shown.some((t) => t.id === n.tattooId)).map(noteOut);
  const html = approvalHtml({ title, ref, items, refs: planRefs, comments: planComments, date: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) });
  state.asks = [...(Array.isArray(state.asks) ? state.asks : []), { ref, ids: shown.map((t) => t.id), at: Date.now() }].slice(-10);
  save(); markTried('approval');
  const base = title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'tattoo-plan';
  approvalLast = { ref, ids: shown.map((t) => t.id), bytes: html.length, html };
  await saveFile(base + '-approval.html', new Blob([html], { type: 'text/html' }));
  toast(`Send it to your artist or client. When they reply, copy it and tap Bring in answers in Share.${list.length > 20 ? ' The first 20 planned tattoos are on it.' : ''}`);
}
let answersLast = null;
function bringInAnswers(text) {
  const r = parseAnswers(text, state.asks || [], state.tattoos);
  answersLast = r;
  const hits = r.answers.filter((a) => state.tattoos.some((t) => t.id === a.id));
  if (!hits.length) { $('#ansNote').textContent = 'No answers found in that. A reply looks like: 1 yes, 2 change: a little smaller.'; return false; }
  snapshot();
  const day = new Date(), at = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  for (const a of hits) { const t = state.tattoos.find((x) => x.id === a.id); t.review = { verdict: a.verdict, note: a.note, by: r.by, at }; }
  const ask = (state.asks || []).find((x) => x.ref === r.ask); if (ask && (r.by || r.note)) ask.reply = { by: r.by, note: r.note, at };
  commit(); markTried('approval');
  const yes = hits.filter((a) => a.verdict === 'approved').length, chg = hits.length - yes, who = r.by || 'They';
  const parts = []; if (yes) parts.push(`said yes to ${yes}`); if (chg) parts.push(`asked for changes to ${chg}`);
  toggle('#answers', false); $('#ansText').value = ''; $('#ansNote').textContent = '';
  const first = hits.find((a) => a.verdict === 'changes') || hits[0];
  toast(`${who} ${parts.join(' and ')}.${r.note ? ` "${r.note}"` : ''}`, 'Show', () => { const t = state.tattoos.find((x) => x.id === first.id); if (t) { select(t.id, true); focusTattoo(t); } });
  return true;
}
$('#cApprove').addEventListener('click', () => { toggle('#share', false); askApproval(); });
$('#cAnswers').addEventListener('click', () => { toggle('#share', false); $('#ansNote').textContent = ''; toggle('#answers', true); });
$('#ansPaste').addEventListener('click', async () => { try { const t = await navigator.clipboard.readText(); if (t) $('#ansText').value = t; else $('#ansNote').textContent = 'Nothing to paste. Copy their reply first.'; } catch (e) { $('#ansNote').textContent = 'Press and hold in the box, then Paste.'; } });
$('#ansRead').addEventListener('click', () => bringInAnswers($('#ansText').value));
/* ---------- tape measure ---------- */
// Measure the body like a tailor's tape: tap two points for the length along the skin between
// them, or one point for the way round an arm, leg, neck or the body there. Works on the
// rest body (a pose does not change your size) and drawn on the skin as it is shown, standing
// or posed; the points stay on the same skin when the shape changes. Only for looking.
tape.group = new THREE.Group(); tape.group.renderOrder = 5; scene.add(tape.group);
const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffc83d }), tapeEnd = new THREE.MeshBasicMaterial({ color: 0x1b1b1f });
function tapeNb() { const I = bodyGeo.index.array; if (tape.nbOf !== I) { tape.nb = meshNeighbours(I); tape.nbOf = I; } return tape.nb; }
// a stored point (triangle + barycentric weights) on the body as it is now
function tapeSpot(p) {
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array, I = bodyGeo.index.array, pos = [0, 0, 0], n = [0, 0, 0];
  for (let k = 0; k < 3; k++) { const v = I[p.tri * 3 + k]; for (let d = 0; d < 3; d++) { pos[d] += P[v * 3 + d] * p.w[k]; n[d] += N[v * 3 + d] * p.w[k]; } }
  const l = Math.hypot(...n) || 1; return { pos, n: n.map((x) => x / l) };
}
function tapeClear() { for (const c of [...tape.group.children]) { tape.group.remove(c); c.geometry.dispose(); } needsRender = true; }
// Where each piece of the tape sits on the rest skin (triangle + weights), so in a pose it can
// be laid on the same skin as shown: nearest vertex, then the closest of its triangles.
function tapeTris() {
  const I = bodyGeo.index.array;
  if (tape.trisOf !== I) { const n = bodyGeo.attributes.position.count, of = Array.from({ length: n }, () => []); for (let t = 0; t * 3 < I.length; t++) for (let k = 0; k < 3; k++) of[I[t * 3 + k]].push(t); tape.trisOf = I; tape.vTris = of; }
  if (tape.gridKey !== shapeKey) {
    const P = bodyGeo.attributes.position.array, g = new Map(), c = 0.03;
    for (let v = 0; v < PAIN_N; v++) { const k = `${Math.floor(P[v * 3] / c)},${Math.floor(P[v * 3 + 1] / c)},${Math.floor(P[v * 3 + 2] / c)}`; let a = g.get(k); if (!a) g.set(k, (a = [])); a.push(v); }
    tape.grid = g; tape.gridKey = shapeKey;
  }
  return tape;
}
const tapeTri = new THREE.Triangle(), tapeQ = new V3(), tapeW = new V3();
function tapeAnchor(p) {
  const { grid, vTris } = tapeTris(), P = bodyGeo.attributes.position.array, I = bodyGeo.index.array, c = 0.03;
  const cx = Math.floor(p[0] / c), cy = Math.floor(p[1] / c), cz = Math.floor(p[2] / c);
  let best = -1, bd = Infinity;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const v of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) { const d = (P[v * 3] - p[0]) ** 2 + (P[v * 3 + 1] - p[1]) ** 2 + (P[v * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = v; } }
  if (best < 0) return null;
  const at = new V3(...p); let tri = -1, td = Infinity, w = null;
  for (const t of vTris[best]) {
    tapeTri.set(new V3().fromArray(P, I[t * 3] * 3), new V3().fromArray(P, I[t * 3 + 1] * 3), new V3().fromArray(P, I[t * 3 + 2] * 3));
    tapeTri.closestPointToPoint(at, tapeQ); const d = tapeQ.distanceToSquared(at);
    if (d < td) { td = d; tri = t; tapeTri.getBarycoord(tapeQ, tapeW); w = [tapeW.x, tapeW.y, tapeW.z]; }
  }
  return tri < 0 ? null : { tri, w };
}
function pointAt(P, I, tri, w) { const out = [0, 0, 0]; for (let k = 0; k < 3; k++) for (let d = 0; d < 3; d++) out[d] += P[I[tri * 3 + k] * 3 + d] * w[k]; return out; }
// Before each draw, move the tape's vertices with the skin under them: the same offset from
// the same point on the shown skin (standing or posed).
function tapeFollow(mesh, centreOf) {
  const pa = mesh.geometry.attributes.position, rest = Float32Array.from(pa.array), anchors = [];
  const n = pa.count, own = new Int32Array(n);
  const byKey = new Map();
  for (let i = 0; i < n; i++) { const c = centreOf(i); let k = byKey.get(c.key); if (k === undefined) { k = anchors.length; byKey.set(c.key, k); anchors.push({ a: tapeAnchor(c.p) }); } own[i] = k; }
  let shownOf = '';
  mesh.onBeforeRender = () => {
    const geo = body.geometry, now = (geo === bodyGeo ? 'rest' : 'pose' + poseView.version) + '|' + shapeKey; if (now === shownOf) return;
    const P = geo.attributes.position.array, I = bodyGeo.index.array, RP = bodyGeo.attributes.position.array;
    const shift = anchors.map(({ a }) => { if (!a || geo === bodyGeo) return [0, 0, 0]; const q = pointAt(P, I, a.tri, a.w), r = pointAt(RP, I, a.tri, a.w); return [q[0] - r[0], q[1] - r[1], q[2] - r[2]]; });
    for (let i = 0; i < n; i++) { const d = shift[own[i]]; pa.array[i * 3] = rest[i * 3] + d[0]; pa.array[i * 3 + 1] = rest[i * 3 + 1] + d[1]; pa.array[i * 3 + 2] = rest[i * 3 + 2] + d[2]; }
    pa.needsUpdate = true; shownOf = now;
  };
  mesh.frustumCulled = false;
}
function tapeDraw(pts, closed, ends) {
  tapeClear();
  const v = []; for (const p of pts) { const q = new V3(...p); if (!v.length || q.distanceTo(v[v.length - 1]) > 1e-4) v.push(q); }
  if (closed && v.length > 2 && v[0].distanceTo(v[v.length - 1]) < 1e-3) v.pop();
  if (v.length > 1) {
    const curve = new THREE.CatmullRomCurve3(v, closed, 'centripetal');
    const segs = Math.min(1200, v.length * 3), tube = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 0.0028, 6, closed), tapeMat); tube.renderOrder = 5; tape.group.add(tube);
    const centres = []; for (let i = 0; i <= segs; i++) centres.push(curve.getPointAt(closed ? (i % segs) / segs : i / segs).toArray());
    tapeFollow(tube, (k) => { const i = Math.floor(k / 7); return { key: i, p: centres[i] }; });
  }
  for (const e of ends) { const g = new THREE.SphereGeometry(0.0065, 16, 12); g.translate(...e); const m = new THREE.Mesh(g, tapeEnd); tape.group.add(m); tapeFollow(m, () => ({ key: 0, p: e })); }
}
function tapeMeasure() {
  tape.key = shapeKey; tape.result = null; tapeClear();
  const P = bodyGeo.attributes.position.array, I = bodyGeo.index.array, s = tape.pts.map(tapeSpot);
  if (tape.mode === 'along') {
    if (s.length < 2) { if (s.length) tapeDraw([], false, [s[0].pos]); return; }
    const r = alongSkin(P, I, tapeNb(), s[0].pos, tape.pts[0].tri, s[0].n, s[1].pos, tape.pts[1].tri, s[1].n);
    if (!r) { tapeDraw([], false, [s[0].pos, s[1].pos]); tape.result = { fail: true }; return; }
    const straight = Math.hypot(s[0].pos[0] - s[1].pos[0], s[0].pos[1] - s[1].pos[1], s[0].pos[2] - s[1].pos[2]);
    tape.result = { len: r.len, straight, mid: r.pts[Math.floor(r.pts.length / 2)] };
    tapeDraw(r.pts, false, [s[0].pos, s[1].pos]);
  } else {
    if (!s.length) return;
    const r = aroundAt(P, I, tapeNb(), s[0].pos, tape.pts[0].tri, s[0].n);
    if (!r) { tapeDraw([], false, [s[0].pos]); tape.result = { fail: true }; return; }
    // the tattoo here, if any: how much of the way round it takes
    let ink = null, bd = Infinity;
    for (const t of state.tattoos) { if (t.hidden) continue; const d = Math.hypot(t.pos[0] - s[0].pos[0], t.pos[1] - s[0].pos[1], t.pos[2] - s[0].pos[2]); if (d < Math.max(t.width / 2, 0.02) && d < bd) { bd = d; ink = t; } }
    tape.result = { len: r.len, around: true, ink: ink && { name: ink.name || 'This tattoo', share: ink.width / r.len, width: ink.width }, mid: s[0].pos };
    tapeDraw(r.pts, true, [s[0].pos]);
  }
}
function tapeRender() {
  const along = tape.mode === 'along';
  $('#tapeAlong').setAttribute('aria-pressed', String(along)); $('#tapeAround').setAttribute('aria-pressed', String(!along));
  $('#tapeBtn').setAttribute('aria-pressed', String(tape.on)); $('#tapeBar').hidden = !tape.on;
  const r = tape.result, h = state.heightCm || 175;
  let text;
  if (r && r.fail) text = along ? 'Can’t lay the tape between those two points. Try two points closer together.' : 'Can’t wrap the tape round here. Try an arm, a leg, the neck or the waist.';
  else if (r && r.around) {
    text = 'Around: ' + tapeText(r.len, h).text;
    if (r.ink) { const pc = Math.round(r.ink.share * 100), w = tapeText(r.ink.width, h); text += `. ${r.ink.name} is ${w.inch < 10 ? w.inch.toFixed(1) : Math.round(w.inch)} in wide, ${pc >= 100 ? 'all' : 'about ' + pc + '%'} of the way round.`; }
  } else if (r) {
    text = 'Along the skin: ' + tapeText(r.len, h).text;
    if (r.len > r.straight * 1.05) text += `. Straight across: ${tapeText(r.straight, h).text.replace(/ \(.*/, '')}.`;
  } else text = along ? (tape.pts.length ? 'Now tap the second point.' : 'Tap two points on the body.') : 'Tap a spot on an arm, a leg, the neck or the body to measure round it.';
  $('#tapeText').textContent = text;
  canvas.style.cursor = tape.on || pain.on ? 'crosshair' : (tapPlaceId ? 'crosshair' : '');
  placeTape();
}
function tapeTap(x, y) {
  const h = hitBody(x, y);
  if (!h || h.faceIndex == null || !h.barycoord) { toast('Tap directly on the body to measure.'); return; }
  if (h.faceIndex * 3 >= bodyGeo.index.count) return;
  const p = { tri: h.faceIndex, w: [h.barycoord.x, h.barycoord.y, h.barycoord.z] };
  if (tape.mode === 'around' || tape.pts.length >= 2) tape.pts = [p]; else tape.pts.push(p);
  tapeMeasure(); tapeRender();
  if (tape.result && !tape.result.fail) { markTried('tape'); if (poseView.active) markTried('tapePose'); }
}
function placeTape() {
  const lab = $('#tapeLabel'), r = tape.result;
  if (tape.on && tape.key !== shapeKey && tape.pts.length) { tapeMeasure(); requestAnimationFrame(tapeRender); }
  tape.group.visible = tape.on;
  if (!tape.on || !r || r.fail) { lab.hidden = true; return; }
  // the middle of the tape on the skin as it is shown (standing or posed)
  if (!r.midAt || r.midKey !== shapeKey) { r.midAt = tapeAnchor(r.mid); r.midKey = shapeKey; }
  const m = new V3(...(poseView.active && r.midAt ? poseView.pointOn(r.midAt.tri, r.midAt.w).pos : r.mid)), sc = screenOf(m), rc = canvas.getBoundingClientRect();
  // hide the label when that bit of the tape is behind the body
  ray.set(camera.position, m.clone().sub(camera.position).normalize());
  const hit = poseView.withPosed(() => ray.intersectObject(body, false)[0]), hidden = hit && hit.distance < camera.position.distanceTo(m) - 0.012;
  const inView = sc.x > rc.left + 30 && sc.x < rc.right - 30 && sc.y > rc.top + 40 && sc.y < rc.bottom - 10;
  lab.hidden = !!hidden || !inView; if (lab.hidden) return;
  lab.textContent = tapeText(r.len, state.heightCm || 175).text;
  lab.style.left = sc.x + 'px'; lab.style.top = sc.y + 'px';
}
function tapeOn(mode) {
  if (pain.on) painOff(); if (room.on) roomDone();
  if (pins.on) pinsOff();
  cancelGesture(); closePanels(); tapPlaceId = null;
  if (selectedId) select(null);
  tape.on = true; tape.pts = []; tape.result = null; if (mode) tape.mode = mode; tapeClear(); tapeRender();
}
function tapeOff() { tape.on = false; tape.pts = []; tape.result = null; tapeClear(); tapeRender(); }
$('#tapeBtn').addEventListener('click', () => { if (tape.on) tapeOff(); else tapeOn(); });
$('#tapeDone').addEventListener('click', tapeOff);
for (const [id, mode] of [['#tapeAlong', 'along'], ['#tapeAround', 'around']]) $(id).addEventListener('click', () => { if (tape.mode === mode) return; tape.mode = mode; tape.pts = mode === 'around' && tape.pts.length ? [tape.pts[tape.pts.length - 1]] : []; tapeMeasure(); tapeRender(); if (tape.result && !tape.result.fail) markTried('tape'); });
/* ---------- pain map ---------- */
// How much a tattoo usually hurts on each part of the body (src/pain.js), shown as a soft
// green to red wash over the skin. Follows every shape and pose. Only for looking.
const pain = { on: false, key: null, level: null, smooth: null, place: null, nb: null, mesh: null, text: '' };
const PAIN_N = COUNTS.body + COUNTS.eyes + COUNTS.genital, isEye = (v) => v >= COUNTS.body && v < COUNTS.body + COUNTS.eyes;
function painData() {
  if (pain.key === shapeKey && pain.level) return pain;
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array, J = poseView.restRig().joints;
  const at = (name) => { const b = POSE_BONES.find((x) => x.name === name); return b ? [J[b.head * 3], J[b.head * 3 + 1], J[b.head * 3 + 2]] : [0, -9, 0]; };
  const both = (name) => [at(name + '.L'), at(name + '.R')];
  const joints = { knee: both('lowerleg01'), elbow: both('lowerarm01'), wrist: both('wrist'), ankle: both('foot'), shoulder: both('upperarm01') };
  const boneOf = (v) => { if (v >= COUNTS.body + COUNTS.eyes) return 'genital'; let best = 'root', w = -1; for (const [n, x] of vertexBones(v)) if (x > w) { w = x; best = n; } return best; };
  const r = painMap({ pos: P, nor: N, count: PAIN_N, boneOf, joints, skip: isEye });
  if (!pain.nb) pain.nb = vertexNeighbours(INDEX_ALL, PAIN_N);
  pain.level = r.level; pain.place = r.place; pain.smooth = smoothLevels(r.level, pain.nb, 4, isEye); pain.key = shapeKey;
  if (pain.mesh) painColours();
  return pain;
}
function painColours() {
  const c = pain.mesh.geometry.attributes.color.array, col = new THREE.Color();
  for (let v = 0; v < PAIN_N; v++) { const [r, g, b] = painColour(pain.smooth[v]); col.setRGB(r, g, b, THREE.SRGBColorSpace); c[v * 3] = col.r; c[v * 3 + 1] = col.g; c[v * 3 + 2] = col.b; }
  pain.mesh.geometry.attributes.color.needsUpdate = true;
}
// A soft see-through wash over the body's skin, coloured per vertex: the pain map and open skin.
function makeWash(name, skip = isEye) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PAIN_N * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PAIN_N * 3), 3));
  let idxOf = null, keyOf = null;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(g, mat); m.name = name; m.visible = false; m.frustumCulled = false; m.renderOrder = 4; m.raycast = () => {}; m.userData.notBody = true;
  // before each draw: the body's current skin (standing, reshaped or posed) and triangles
  const copy = () => {
    const geo = body.geometry, I = geo.index.array;
    if (idxOf !== I || keyOf !== shapeKey) { const keep = []; for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], c = I[i + 2]; if (a < PAIN_N && b < PAIN_N && c < PAIN_N && !skip(a) && !skip(b) && !skip(c) && !isEye(a) && !isEye(b) && !isEye(c)) keep.push(a, b, c); } g.setIndex(keep); idxOf = I; keyOf = shapeKey; }
    g.attributes.position.array.set(geo.attributes.position.array.subarray(0, PAIN_N * 3)); g.attributes.position.needsUpdate = true;
  };
  m.onBeforeRender = copy;
  body.add(m); copy();
  return m;
}
function painMesh() {
  if (pain.mesh) return pain.mesh;
  pain.mesh = makeWash('pain'); painColours();
  return pain.mesh;
}
// one tattoo: the usual pain over its ink
function painOfTattoo(t) {
  const d = painData(), r = painUnder({ pos: bodyGeo.attributes.position.array, count: PAIN_N, level: d.smooth, place: d.place, centre: t.pos, radius: Math.max(0.01, Math.min(t.width, t.width / t.aspect) / 2) });
  if (!r) return '';
  let line = `${t.name || 'This tattoo'} on the ${r.place.toLowerCase()}: ${painWords(r.level)}, about ${Math.round(r.level)} out of 10.`;
  if (r.max >= r.level + 1.5 && painWords(r.max) !== painWords(r.level)) line += ` Part of it reaches ${painWords(r.max)} on the ${r.maxPlace.toLowerCase()}.`;
  return line;
}
function painRender() {
  $('#painBtn').setAttribute('aria-pressed', String(pain.on)); $('#painBar').hidden = !pain.on; $('#painNote').hidden = taught.has('painNote'); if (!pain.on && !$('#painNote').hidden && painSeen) learnt('painNote'); if (pain.on) painSeen = true;
  document.body.classList.toggle('wash-on', pain.on || room.on);
  $('#painText').textContent = pain.text;
  if (pain.mesh) pain.mesh.visible = pain.on;
  canvas.style.cursor = pain.on ? 'crosshair' : (tape.on || tapPlaceId ? 'crosshair' : '');
  needsRender = true;
}
function painTap(x, y) {
  const h = hitBody(x, y), ids = inkIdsAt(x, y, h);
  const t = ids && ids.length && state.tattoos.find((q) => q.id === ids[0]);
  if (t) { pain.text = painOfTattoo(t); painRender(); markTried('pain'); return; }
  if (!h || !h.face || !h.barycoord) { pain.text = 'Tap on the body to read a spot.'; painRender(); return; }
  const d = painData(), vs = [h.face.a, h.face.b, h.face.c], w = [h.barycoord.x, h.barycoord.y, h.barycoord.z];
  let lv = 0, best = 0; for (let k = 0; k < 3; k++) { lv += d.smooth[vs[k]] * w[k]; if (w[k] > w[best]) best = k; }
  pain.text = painLine(lv, d.place[vs[best]] || 'Here'); painRender(); markTried('pain');
}
function painOn() {
  if (tape.on) tapeOff(); if (room.on) roomDone();
  if (pins.on) pinsOff();
  cancelGesture(); closePanels(); tapPlaceId = null;
  painData(); painMesh(); pain.on = true;
  const t = sel(); pain.text = t ? painOfTattoo(t) : 'Tap a spot or a tattoo to read it.';
  if (selectedId) select(null);
  painRender();
}
function painOff() { pain.on = false; painRender(); }
$('#painBtn').addEventListener('click', () => { showLook(false); if (pain.on) painOff(); else painOn(); });
$('#painDone').addEventListener('click', painOff);
/* ---------- open skin ---------- */
// How much room is left (src/room.js): a wash from grey (no room) to deep teal (lots), and with a
// planned tattoo picked, green where it fits with half an inch to spare. A tap on a green spot
// moves it there, one undo step. Distances are along the skin of the standing body.
var room = { on: false, fitId: null, inks: null, key: '', clear: null, across: null, cap: null, areaKey: null, areas: null, total: 0, mesh: null, text: '', need: 0, width: 0 };
const cmPerUnit = () => (state.heightCm || 175) / 1.75, toInches = (u) => u * cmPerUnit() / 2.54, fromInches = (i) => i * 2.54 / cmPerUnit();
const ROOM_MARGIN_IN = 0.5;
function roomOff(v) { return isEye(v) || OFF_LIMITS.has(painData().place[v]); }
// the tattoo's own reach from its centre to its furthest ink
function inkReach(t) {
  const pts = inkPoints(t); if (!pts || !pts.length) return Math.hypot(t.width, t.width / t.aspect) / 2;
  let m = 0; for (let i = 0; i < pts.length; i += 3) m = Math.max(m, Math.hypot(pts[i] - t.pos[0], pts[i + 1] - t.pos[1], pts[i + 2] - t.pos[2]));
  return m;
}
// how much of the artwork is ink, and how much of that ink is coloured (cached per artwork)
const artStatCache = new Map();
function artStats(t) {
  const d = decals[t.id]; if (!d || !d.tex || !d.tex.image) return null;
  const hit = artStatCache.get(d.texKey); if (hit) return hit;
  const src = d.tex.image, W = 128, H = Math.max(8, Math.round(W * src.height / src.width));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data; let ink = 0, col = 0;
  for (let o = 0; o < px.length; o += 4) { const mx = Math.max(px[o], px[o + 1], px[o + 2]), mn = Math.min(px[o], px[o + 1], px[o + 2]); if (255 - mn <= 70) continue; ink++; if (mx - mn > 60 && (mx - mn) / Math.max(1, mx) > 0.35) col++; }
  const out = { fill: ink / (W * H), colour: ink ? col / ink : 0 }; artStatCache.set(d.texKey, out); return out;
}
function roomData() {
  const d = painData(), list = state.tattoos.filter((t) => !t.hidden && t.id !== room.fitId), inks = list.map(inkPoints);
  const key = shapeKey + '|' + room.fitId;
  if (room.clear && room.key === key && room.inks && room.inks.length === inks.length && room.inks.every((p, i) => p === inks[i])) return room;
  const P = bodyGeo.attributes.position.array;
  room.clear = clearance(P, d.nb || pain.nb, inkSeeds(P, PAIN_N, inks, roomOff));
  room.inks = inks; room.key = key;
  if (room.areaKey !== shapeKey) { room.areas = vertexAreas(P, INDEX_ALL, COUNTS.body + COUNTS.eyes, isEye); room.total = room.areas.reduce((a, b) => a + b, 0); room.cap = roomCaps(P, d.nb || pain.nb); room.areaKey = shapeKey; }
  room.across = acrossAt(room.clear, room.cap);
  const t = room.fitId && state.tattoos.find((q) => q.id === room.fitId);
  room.need = t ? inkReach(t) + fromInches(ROOM_MARGIN_IN) : 0;
  room.width = t ? Math.min(t.width, t.width / t.aspect) : 0;
  if (room.mesh) roomColours();
  return room;
}
const roomFits = (v) => !roomOff(v) && room.clear[v] >= room.need && room.width <= room.cap[v];
// half the way round at each vertex: limbs wrap round their own bone, in rings along it; the
// torso, neck and head in rings by height round each ring's own middle
const TORSO_BONE = /^(root|spine0[1-5]|breast|clavicle|pelvis|shoulder01|neck0[1-3]|head|jaw)/;
let roomBones = null;
function roomCaps(P, nb) {
  const J = poseView.restRig().joints, jt = (i) => [J[i * 3], J[i * 3 + 1], J[i * 3 + 2]], byName = new Map(POSE_BONES.map((b) => [b.name, b]));
  if (!roomBones) { roomBones = new Array(PAIN_N); for (let v = 0; v < COUNTS.body; v++) { let best = 'root', w = -1; for (const [n, x] of vertexBones(v)) if (x > w) { w = x; best = n; } roomBones[v] = best; } }
  const torso = (v) => v >= COUNTS.body + COUNTS.eyes || TORSO_BONE.test(roomBones[v]), RING = 0.02;
  // the middle of each torso ring
  const mid = new Map();
  for (let v = 0; v < PAIN_N; v++) { if (isEye(v) || !torso(v)) continue; const k = Math.floor(P[v * 3 + 1] / RING), e = mid.get(k) || [0, 0, 0]; e[0] += P[v * 3]; e[1] += P[v * 3 + 2]; e[2]++; mid.set(k, e); }
  const limbAxes = new Map();
  const limbAxis = (name) => {
    if (limbAxes.has(name)) return limbAxes.get(name);
    const b0 = name.replace(/\.[LR]$/, ''), side = name.slice(b0.length), use = /^toe/.test(b0) ? 'foot' + side : /^(finger|metacarpal)/.test(b0) ? 'wrist' + side : name, b = byName.get(use);
    let a = null; if (b) { const h = jt(b.head), t = jt(b.tail), d = [t[0] - h[0], t[1] - h[1], t[2] - h[2]], L = Math.hypot(...d) || 1; a = { name: use, p: h, d: d.map((x) => x / L) }; }
    limbAxes.set(name, a); return a;
  };
  const axis = (v) => {
    if (isEye(v)) return null;
    if (torso(v)) { const k = Math.floor(P[v * 3 + 1] / RING), e = mid.get(k); return { p: [e[0] / e[2], P[v * 3 + 1], e[1] / e[2]], d: [0, 1, 0], ring: 'T' + k, k: 0.8 }; }
    const a = limbAxis(roomBones[v]); if (!a) return null;
    const t = (P[v * 3] - a.p[0]) * a.d[0] + (P[v * 3 + 1] - a.p[1]) * a.d[1] + (P[v * 3 + 2] - a.p[2]) * a.d[2];
    return { p: a.p, d: a.d, ring: a.name + ':' + Math.floor(t / RING) };
  };
  return halfGirth({ pos: P, count: PAIN_N, nb, axis });
}
function roomColours() {
  const c = room.mesh.geometry.attributes.color.array, col = new THREE.Color();
  for (let v = 0; v < PAIN_N; v++) {
    let rgb;
    if (roomOff(v)) rgb = [0.62, 0.6, 0.62];
    else if (room.fitId) rgb = roomFits(v) ? [0.16, 0.74, 0.44] : [0.6, 0.58, 0.6];
    else rgb = roomColour(toInches(room.across[v]));
    col.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace); c[v * 3] = col.r; c[v * 3 + 1] = col.g; c[v * 3 + 2] = col.b;
  }
  room.mesh.geometry.attributes.color.needsUpdate = true;
}
// the share of the skin under ink: each tattoo's box times how much of its artwork is ink
function inkShares() {
  const r = roomData(); let ink = 0, plan = 0;
  for (const t of state.tattoos) { if (t.hidden) continue; const st = artStats(t); if (!st) continue; const a = t.width * (t.width / t.aspect) * st.fill; if (t.status === 'existing') ink += a; else plan += a; }
  return { inkShare: Math.min(1, ink / r.total), planShare: Math.min(1, plan / r.total) };
}
function roomSummaryText() {
  const r = roomData(), d = painData();
  return roomSummary({ ...inkShares(), regions: roomByRegion(r.across, d.place, (v) => !roomOff(v)), toInches });
}
// how much of each area (left arm, chest, back...) is covered so far, and with the plans
function coverList() {
  const r = roomData(), d = painData(), P = bodyGeo.attributes.position.array, n = r.areas.length;
  if (r.coverAreaKey !== shapeKey) { r.coverAreaOf = new Array(n); for (let v = 0; v < n; v++) r.coverAreaOf[v] = isEye(v) || !d.place[v] ? null : coveredArea(d.place[v], P[v * 3]); r.coverAreaKey = shapeKey; }
  const tattoos = [];
  for (const t of state.tattoos) {
    if (t.hidden) continue; const st = artStats(t); if (!st) continue;
    tattoos.push({ pts: inkPoints(t), inkArea: t.width * (t.width / t.aspect) * st.fill, planned: t.status !== 'existing' });
  }
  return coveredByArea(P, n, (v) => r.coverAreaOf[v], r.areas, tattoos);
}
function coverRender() {
  const el = $('#roomCover'); if (!room.on || room.fitId) { el.hidden = true; return; }
  const key = room.key + '|' + (room.inks || []).length + '|' + state.tattoos.map((t) => t.id + (t.hidden ? 'h' : '') + t.status + t.width).join(',');
  if (room.coverKey !== key) { room.coverKey = key; room.coverWords = coveredText(coverList()); }
  el.textContent = room.coverWords; el.hidden = !room.coverWords;
}
function roomFitText(t) { return `Green is where ${t.name || 'it'} fits with half an inch to spare. Tap a green spot to move it there.`; }
function roomRender() {
  $('#roomBtn').setAttribute('aria-pressed', String(room.on)); $('#roomBar').hidden = !room.on; $('#roomNote').hidden = taught.has('roomNote'); if (!room.on && !$('#roomNote').hidden && roomSeen) learnt('roomNote'); if (room.on) roomSeen = true;
  document.body.classList.toggle('wash-on', pain.on || room.on);
  $('#roomText').textContent = room.text;
  $('#roomKeyAll').hidden = !!room.fitId; $('#roomKeyFit').hidden = !room.fitId; $('#roomAll').hidden = !room.fitId;
  coverRender();
  if (room.mesh) room.mesh.visible = room.on;
  canvas.style.cursor = room.on || pain.on || tape.on || tapPlaceId ? 'crosshair' : '';
  needsRender = true;
}
function roomPick(t) {
  if (commentOnly) { toast('You can comment and answer on this project, not move tattoos.'); return; }
  if (t.status === 'existing') { room.text = `${t.name || 'That tattoo'} is already on you, so it stays where it is.`; roomRender(); return; }
  if (t.locked) { room.text = `${t.name || 'That tattoo'} is locked. Unlock it to move it.`; roomRender(); return; }
  room.fitId = t.id; roomData(); room.text = roomFitText(t); roomRender();
}
function roomTap(x, y) {
  const h = hitBody(x, y), ids = inkIdsAt(x, y, h), hitT = ids && ids.length && state.tattoos.find((q) => q.id === ids[0]);
  const fit = room.fitId && state.tattoos.find((q) => q.id === room.fitId);
  if (hitT && hitT.id !== room.fitId) { roomPick(hitT); markTried('room'); return; }
  if (!h || !h.face || !h.barycoord) { room.text = 'Tap on the body to read a spot.'; roomRender(); return; }
  const r = roomData(), vs = [h.face.a, h.face.b, h.face.c], w = [h.barycoord.x, h.barycoord.y, h.barycoord.z];
  let best = 0; for (let k = 1; k < 3; k++) if (w[k] > w[best]) best = k;
  const v = vs[best], place = painData().place[v] || 'Here';
  if (!fit) {
    room.text = roomOff(v) ? `${place}: left out of the room count.` : `${place}: room for a piece about ${inchWords(toInches(r.across[v]))} across.`;
    roomRender(); markTried('room'); return;
  }
  if (poseView.active) { room.text = 'Turn off the pose first, then tap to move it.'; roomRender(); return; }
  if (!roomFits(v)) {
    room.text = roomOff(v) ? `${place} is left out of the room count. Pick a green spot.` : `Too tight here: room for about ${inchWords(toInches(r.across[v]))} across, and ${fit.name || 'it'} needs about ${inchWords(toInches(Math.max(r.need * 2, r.width)))}.`;
    roomRender(); return;
  }
  try {
    const placed = planTapPlacement(fit, { pos: h.point.toArray(), normal: h.normal.toArray() });
    snapshot(); Object.assign(fit, placed); commit();
    room.text = `Moved ${fit.name || 'it'} to the ${place.toLowerCase()}.`; roomRender(); markTried('roomFit');
    toast(`Moved ${fit.name || 'it'}.`, 'Undo', undo);
  } catch (e) { room.text = e.message; roomRender(); }
}
const ROOM_ASK = ' Tap a planned tattoo to see where it fits.';
let roomTimer = 0;
function roomRefresh() { if (!room.on) return; clearTimeout(roomTimer); roomTimer = setTimeout(() => { if (!room.on) return; const fit = room.fitId && state.tattoos.find((q) => q.id === room.fitId); if (room.fitId && !fit) room.fitId = null; roomData(); if (!room.fitId && room.text.endsWith(ROOM_ASK)) room.text = roomSummaryText() + ROOM_ASK; roomRender(); }, 60); }
function roomOn(fitId = null) {
  if (tape.on) tapeOff(); if (pain.on) painOff(); if (pins.on) pinsOff();
  cancelGesture(); closePanels(); tapPlaceId = null;
  if (selectedId) select(null);
  room.fitId = fitId; room.on = true;
  if (!room.mesh) room.mesh = makeWash('room', roomOff);
  roomData(); roomColours();
  const t = fitId && state.tattoos.find((q) => q.id === fitId);
  room.text = t ? roomFitText(t) : roomSummaryText() + ROOM_ASK;
  if (t) markTried('roomFit');
  roomRender();
}
function roomDone() { room.on = false; room.fitId = null; roomRender(); }
$('#roomBtn').addEventListener('click', () => { showLook(false); if (room.on) roomDone(); else { roomOn(); if (room.coverWords) markTried('covered'); } });
$('#roomDone').addEventListener('click', roomDone);
$('#roomAll').addEventListener('click', () => { room.fitId = null; roomData(); room.text = roomSummaryText() + ROOM_ASK; roomRender(); });
$('#bRoom').addEventListener('click', () => { const t = sel(); if (!t) return; if (t.status === 'existing') { toast('Already on you, so it stays where it is.'); return; } if (t.locked) { toast('Unlock this tattoo first.'); return; } roomOn(t.id); });
/* ---------- where it sits and time to tattoo, in More controls ---------- */
function whereOf(t) {
  const d = painData(), P = bodyGeo.attributes.position.array, J = poseView.restRig().joints;
  let nv = -1, nd = Infinity;
  for (let v = 0; v < PAIN_N; v++) { if (!d.place[v]) continue; const o = v * 3, dd = (P[o] - t.pos[0]) ** 2 + (P[o + 1] - t.pos[1]) ** 2 + (P[o + 2] - t.pos[2]) ** 2; if (dd < nd) { nd = dd; nv = v; } }
  if (nv < 0) return null;
  const side = t.pos[0] >= 0 ? 'left' : 'right', S = side === 'left' ? '.L' : '.R';
  const at = (name) => { const b = POSE_BONES.find((x) => x.name === name); return b ? [J[b.head * 3], J[b.head * 3 + 1], J[b.head * 3 + 2]] : null; };
  const j = { shoulder: at('upperarm01' + S), elbow: at('lowerarm01' + S), wrist: at('wrist' + S), hip: at('upperleg01' + S), knee: at('lowerleg01' + S), ankle: at('foot' + S), neck: at('neck01'), navel: [P[MARKS.navel * 3], P[MARKS.navel * 3 + 1], P[MARKS.navel * 3 + 2]] };
  return whereItSits({ p: t.pos, place: d.place[nv], side, j, toCm: cmPerUnit() });
}
function hoursOf(t) {
  const st = artStats(t); if (!st) return null;
  const w = toInches(t.width), h = w / t.aspect;
  return sessionHours({ widthIn: w, heightIn: h, fill: st.fill, colour: st.colour });
}
// the whole plan, under a planned tattoo's own guess: every planned piece that shows
function planRender(t) {
  const list = t && t.status !== 'existing' ? state.tattoos.filter((q) => q.status !== 'existing' && !q.hidden).map(hoursOf).filter(Boolean) : [];
  const line = planText(list, readRate()); $('#planLine').textContent = line; $('#planLine').hidden = !line;
  if (line && $('#editorAdvanced').open && !infoByShow && performance.now() > infoQuietUntil) markTried('plan');
  planSitsRender(t);
}
// every planned piece's sittings together: what is coming up, and any sitting while another is fresh
function planPieces() {
  return state.tattoos.filter((q) => q.status !== 'existing' && !q.hidden && q.sittings && q.sittings.start).map((q) => ({ t: q, name: (q.name || 'Tattoo').trim() || 'Tattoo', plan: sitPlan(q) })).filter((x) => x.plan);
}
function localToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
let planSitsShown = null;
function planSitsRender(t) {
  const pieces = t && t.status !== 'existing' ? planPieces() : [];
  const words = pieces.length >= 2 ? planCalendarText(planCalendar(pieces), localToday()) : { next: '', clash: [] };
  $('#planSits').hidden = !words.next; $('#planNext').textContent = words.next;
  $('#planClash').textContent = words.clash.join(' '); $('#planClash').hidden = !words.clash.length;
  planSitsShown = words.next ? words : null;
}
$('#planCal').addEventListener('click', () => {
  const pieces = planPieces(); if (pieces.length < 2) return;
  const file = planCalendarFile(pieces.map((x) => ({ name: x.name, plan: x.plan, wear: [sitWearOf(x.t), sleepLine(x.t.pos, x.t.normal)].filter(Boolean).join(' ') })), new Date());
  saveFile('tattoo-plan-sittings.ics', new Blob([file], { type: 'text/calendar' })); markTried('planCal');
});
// what it shows in: the share of the tattoo's skin each everyday outfit covers, cut the same
// way as Preview > Clothes, on the rest body (worked out once per body shape)
let outfitCover = null;
function outfitList() {
  if (!outfitCover || outfitCover.key !== shapeKey) {
    const P = bodyGeo.attributes.position.array, J = poseView.restRig().joints;
    outfitCover = { key: shapeKey, list: OUTFITS.map((o) => { const c = clothesCoverage(P, J, o.top, o.bottom, 'none'); return (v) => (c.top[v] > 0) || (c.bottom[v] > 0); }) };
  }
  return outfitCover.list;
}
function showsShares(t) {
  const d = decals[t.id], sup = d && d.mesh.geometry.userData.supports; if (!sup || !sup.length) return null;
  return outfitList().map((f) => { let n = 0; for (const v of sup) if (f(v)) n++; return n / sup.length; });
}
// what to wear to the sitting: each top alone and each bottom alone, on the rest body
let wearCover = null;
function sitWearOf(t) {
  const d = t && !t.hidden && decals[t.id], sup = d && d.mesh.geometry.userData.supports; if (!sup || !sup.length) return '';
  if (!wearCover || wearCover.key !== shapeKey) {
    const P = bodyGeo.attributes.position.array, J = poseView.restRig().joints, top = {}, bottom = {};
    for (const k of ['tank', 'tee', 'long']) { const c = clothesCoverage(P, J, k, 'none', 'none').top; top[k] = (v) => c[v] > 0; }
    for (const k of ['swim', 'shorts', 'pants']) { const c = clothesCoverage(P, J, 'none', k, 'none').bottom; bottom[k] = (v) => c[v] > 0; }
    wearCover = { key: shapeKey, top, bottom };
  }
  const share = (f) => { let n = 0; for (const v of sup) if (f(v)) n++; return n / sup.length; };
  const each = (o) => Object.fromEntries(Object.entries(o).map(([k, f]) => [k, share(f)]));
  return sittingWear(each(wearCover.top), each(wearCover.bottom));
}
// how it holds up here, from the place under most of the tattoo
function wearOf(t) {
  if (!t || t.hidden) return null;
  const d = painData(), r = painUnder({ pos: bodyGeo.attributes.position.array, count: PAIN_N, level: d.smooth, place: d.place, centre: t.pos, radius: Math.max(0.01, Math.min(t.width, t.width / t.aspect) / 2) });
  return r ? { ...wearAt(r.place), place: r.place } : null;
}
function showsOf(t) { return t && !t.hidden ? visibilityText(showsShares(t)) : ''; }
// even placement: off the centre line, or not quite matching its twin on the other side
function evenOf(t) { return evenness(t, state.tattoos, cmPerUnit()); }
function evenRender(t) {
  const e = t && evenOf(t); $('#evenRow').hidden = !e; if (!e) return;
  $('#evenLine').textContent = evennessText(e);
  $('#evenFix').hidden = e.even; $('#evenFix').textContent = e.kind === 'twin' ? 'Match the other side' : 'Centre it';
}
function evenFix() {
  const t = sel(), e = t && evenOf(t); if (!e || e.even) return;
  if (t.locked) { toast('Unlock this tattoo first.'); return; }
  if (poseView.active) { toast('Turn off the pose first, then line it up.'); return; }
  let m = null;
  if (e.kind === 'centre') {
    const n = new V3(0, t.normal[1], t.normal[2]); if (n.lengthSq() < 1e-6) n.set(0, 0, Math.sign(t.pos[2]) || 1); n.normalize();
    const at = new V3(0, t.pos[1], t.pos[2]), h = surfaceAt(at.clone().addScaledVector(n, 0.3), n.clone().negate());
    if (h && Math.abs(h.pos[0]) < 0.004) m = { pos: [0, h.pos[1], h.pos[2]], normal: h.normal };
  } else {
    const twin = state.tattoos.find((q) => q.id === e.twinId), o = twin && otherSide(twin);
    if (o) m = { ...o, width: twin.width };
  }
  if (!m) { toast('Could not find that spot on this body.'); return; }
  snapshot(); Object.assign(t, m); commit(); markTried('even');
  toast(e.kind === 'twin' ? `${t.name} now mirrors ${e.twinName}.` : `${t.name} is on the centre line.`, 'Undo', undo);
}
$('#evenFix').addEventListener('click', evenFix);
// straight along the limb (or upright on the torso): how far it is turned off that line
function lineOf(t) {
  if (!t || t.hidden) return null;
  const L = limbLine(t.pos, POSE_BONES, poseView.restRig().joints); if (!L) return null;
  const up0 = frameOf({ ...t, rot: 0 }).up.toArray(), target = turnAlong(up0, L.along, t.normal);
  return { ...straighten(t.rot || 0, target), name: L.name };
}
function lineRender(t) {
  const l = lineOf(t); $('#lineRow').hidden = !l; if (!l) return;
  const on = l.name === 'body' ? 'upright on the body' : `along the ${l.name}`;
  $('#lineText').textContent = l.offDeg < 1.5 ? `Straight ${on}.` : `Turned ${Math.round(l.offDeg)}° off straight ${on}.`;
  $('#lineFix').hidden = l.offDeg < 1.5;
}
$('#wrapFit').addEventListener('click', () => {
  const t = sel(); if (!t) return; const limb = /leg/.test(wrapInfo(t)?.L.key || '') ? 'leg' : 'arm';
  if (wrapRound(t)) toast(`Wrapped round your ${limb}, ends meeting at the back. Drag it sideways to turn it, up or down to slide it.`, 'Undo', undo);
});
$('#lineFix').addEventListener('click', () => {
  const t = sel(), l = lineOf(t); if (!l || l.offDeg < 1.5) return;
  if (t.locked) { toast('Unlock this tattoo first.'); return; }
  snapshot(); t.rot = l.rot; commit(); markTried('straight');
  toast(`${t.name} is straight ${l.name === 'body' ? 'up' : 'along the ' + l.name}.`, 'Undo', undo);
});
// who it reads the right way up for: others, or you looking down at it
function readOf(t) {
  if (!t || t.hidden) return null;
  return readsFor(frameOf(t).up.toArray(), t.normal, limbLine(t.pos, POSE_BONES, poseView.restRig().joints));
}
function readRender(t) {
  const r = readOf(t); $('#readRow').hidden = !r; if (!r) return;
  $('#readText').textContent = r.text; $('#readFix').textContent = r.turn; $('#readFix').hidden = !r.turn;
}
$('#readFix').addEventListener('click', () => {
  const t = sel(), r = readOf(t); if (!r || !r.turn) return;
  if (t.locked) { toast('Unlock this tattoo first.'); return; }
  snapshot(); t.rot = Math.atan2(Math.sin((t.rot || 0) + Math.PI), Math.cos((t.rot || 0) + Math.PI)); commit(); markTried('reads');
  const now = readOf(t); toast(now && now.who === 'you' ? `${t.name} now reads for you.` : `${t.name} now reads for others.`, 'Undo', undo);
});
// the session planner: a planned piece in sittings, with dates once a first one is picked
function sitPlan(t) {
  const hrs = t && t.status !== 'existing' && hoursOf(t); if (!hrs) return null;
  const st = artStats(t), s = t.sittings || {};
  return planSittings(hrs, { colour: st ? st.colour : 0, start: s.start || '', gapWeeks: s.gap || 3 });
}
function sitRender(t) {
  const plan = sitPlan(t); $('#sitBox').hidden = !plan; if (!plan) return;
  const list = $('#sitList'); list.replaceChildren();
  for (const x of plan.sittings) {
    const li = document.createElement('li'), b = document.createElement('b');
    const cost = sittingCost(x, readRate());
    b.textContent = x.what; li.append(b, `, ${sittingHours(x).toLowerCase()}${cost ? ', ' + cost : ''}${x.date ? ', ' + dayWords(x.date) : ''}`); list.append(li);
  }
  const s = t.sittings || {};
  if (document.activeElement !== $('#sitStart')) $('#sitStart').value = s.start || '';
  $('#sitGap').value = String(s.gap || 3); $('#sitGap').disabled = plan.sittings.length < 2;
  $('#sitHealed').textContent = plan.healed ? `Healed by about ${dayWords(plan.healed)}.` : 'Pick the first date to see when each sitting falls and when it is healed.';
  $('#sitHealed').hidden = false; $('#sitCal').hidden = !plan.healed;
  if (document.activeElement !== $('#sitAway')) $('#sitAway').value = s.away || '';
  const last = plan.sittings.at(-1);
  $('#sitDry').textContent = last.date ? `Keep it out of pools, the sea, baths and strong sun for two weeks after each sitting${plan.sittings.length > 1 ? `: after the last one, until ${dayWords(clearOn(last.date))}` : `, until ${dayWords(clearOn(last.date))}`}.` : '';
  $('#sitDry').hidden = !last.date;
  const wear = sitWearOf(t); $('#sitWear').textContent = wear; $('#sitWear').hidden = !wear;
  const sleep = sleepLine(t.pos, t.normal); $('#sitSleep').textContent = sleep; $('#sitSleep').hidden = !sleep;
  if (wear && $('#editorAdvanced').open && !infoByShow && performance.now() > infoQuietUntil) markTried('sitWear');
  const c = tripClash(plan, s.away, todayIso()); $('#sitClash').hidden = !c;
  if (c) {
    $('#sitClashText').textContent = `Your trip on ${dayWords(s.away)} is ${c.days === 0 ? 'the same day as' : c.days === 1 ? 'the day after' : c.days + ' days after'} ${plan.sittings.length > 1 ? 'sitting ' + c.n : 'the sitting'}, while the ink is still fresh. Move the first sitting so it heals first.`;
    $('#sitLater').dataset.to = c.later; $('#sitEarlier').dataset.to = c.earlier; $('#sitEarlier').hidden = !c.earlier;
  }
}
function setSittings(k, v) {
  const t = sel(); if (!t) return; const now = { ...(t.sittings || {}) };
  if (v) now[k] = v; else delete now[k];
  if (now.gap === 3) delete now.gap;
  if (JSON.stringify(now) === JSON.stringify(t.sittings || {})) return;
  snapshot(); if (Object.keys(now).length) t.sittings = now; else delete t.sittings; commit(); sitRender(t); markTried('sittings');
}
$('#sitStart').addEventListener('change', () => { const v = $('#sitStart').value; setSittings('start', /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''); });
$('#sitGap').addEventListener('change', () => setSittings('gap', +$('#sitGap').value));
$('#sitAway').addEventListener('change', () => { const v = $('#sitAway').value; setSittings('away', /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''); markTried('trip'); });
for (const id of ['#sitLater', '#sitEarlier']) $(id).addEventListener('click', () => { const v = $(id).dataset.to; if (v) { setSittings('start', v); markTried('trip'); } });
$('#sitCal').addEventListener('click', () => {
  const t = sel(), plan = sitPlan(t); if (!plan || !plan.healed) return;
  const name = (t.name || 'Tattoo').trim() || 'Tattoo';
  saveFile((name.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'tattoo') + '-sittings.ics', new Blob([sittingsCalendar(name, plan, new Date(), [sitWearOf(t), sleepLine(t.pos, t.normal)].filter(Boolean).join(' '))], { type: 'text/calendar' }));
  markTried('sittings');
});
const readRate = () => { try { const n = +localStorage.getItem('ia-rate'); return n > 0 && n < 5000 ? n : 0; } catch { return 0; } };
const writeRate = (n) => { try { if (n > 0) localStorage.setItem('ia-rate', String(n)); else localStorage.removeItem('ia-rate'); } catch {} };
let infoTimer = 0;
/* ---------- Flash sheet: a picture of several designs split into one tattoo each ---------- */
const flashCache = new Map(); // artwork key -> the designs found on it, or null for one design
async function flashOf(t) {
  if (!t || !t.img) return null;
  if (flashCache.has(t.img)) return flashCache.get(t.img);
  const im = imgEls[t.img] || await loadImg(t.img); if (!im) return null;
  const w = im.naturalWidth, h = im.naturalHeight, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const f = findDesigns(g.getImageData(0, 0, w, h).data, w, h), out = f.boxes.length >= 2 ? { ...f, w, h } : null;
  flashCache.set(t.img, out); return out;
}
let flashShown = 0;
function flashRender(t) {
  const b = $('#bSplit'); b.hidden = true; flashShown = 0;
  if (!t || t.locked || t.status === 'existing' || commentOnly) return;
  flashOf(t).then((f) => { if (sel() !== t || !f) return; b.hidden = false; b.textContent = `Split into ${f.boxes.length} designs`; flashShown = f.boxes.length; });
}
async function splitFlash(id) {
  const t = state.tattoos.find((q) => q.id === id); if (!t || commentOnly) return false;
  if (t.locked) { toast('Unlock this tattoo first.'); return false; }
  const f = await flashOf(t), im = imgEls[t.img]; if (!f || !im) { toast('This picture holds one design.'); return false; }
  snapshot();
  // each keeps its size next to the others; a small sheet is scaled up so the biggest piece is
  // at least about 8 cm across, a usable size to start from
  const base = (t.name || 'Design').replace(/\s*\(sample\)$/, ''), widest = Math.max(...f.boxes.map((b) => b.w)), made = [];
  const scale = t.width / f.w * Math.max(1, 0.08 / (widest * t.width / f.w));
  for (let i = 0; i < f.boxes.length; i++) {
    const b = f.boxes[i], c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    // only this design: the next one's strokes inside its box are left out
    const d = g.getImageData(0, 0, b.w, b.h), px = d.data;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (!inDesign(f, b.id, b.x + x, b.y + y)) px[(y * b.w + x) * 4 + 3] = 0;
    g.putImageData(d, 0, 0);
    let out = c;
    if (t.imageTopDown === false) { out = document.createElement('canvas'); out.width = b.w; out.height = b.h; const o = out.getContext('2d'); o.translate(0, b.h); o.scale(1, -1); o.drawImage(c, 0, 0); }
    const width = Math.min(0.3, Math.max(0.015, b.w * scale)), spot = i === 0 ? { pos: t.pos, normal: t.normal, rot: t.rot } : nextSlot();
    const n = await addImage(out.toDataURL('image/png'), `${base} ${i + 1}`, { ...spot, width, opacity: t.opacity ?? 0.92 });
    if (!n) continue;
    if (t.status) n.status = t.status; if (t.flip) n.flip = true; for (const k of ['wrap', 'bend', 'taper']) if (i === 0 && t[k]) n[k] = t[k];
    made.push(n);
  }
  if (!made.length) { undo(); toast('The designs could not be split.'); return false; }
  state.tattoos = state.tattoos.filter((q) => q !== t);
  selectedId = made[0].id; commit(); focusTattoo(made[0]); markTried('flash');
  toast(`Split into ${made.length} tattoos. The first is where the sheet was. Undo puts the sheet back.`);
  return made.length;
}
$('#bSplit').addEventListener('click', () => { const t = sel(); if (t) splitFlash(t.id); });
/* ---------- How it stretches: the skin under a tattoo in the poses that move it most ---------- */
const stretchCache = new Map(); // tattoo id -> { k, res }
const STRETCH_SKIP = new Set(['neutral']);
const stretchKey = (t) => [t.pos.join(','), t.width, t.aspect, t.rot || 0, t.wrap || 0, t.bend || 0, t.taper || 0, shapeKey].join('|');
function stretchOf(t) {
  const d = decals[t.id], tris = d && d.mesh.geometry.userData.tris; if (!tris || !tris.length) return null;
  const k = stretchKey(t), c = stretchCache.get(t.id); if (c && c.k === k) return c.res;
  let res = null;
  try {
    const pick = posesPicked(t), rest = poseView.restRig(), I = bodyGeo.index.array, A = bodyGeo.attributes.position.array, under = [...new Set(tris)];
    const out = [];
    for (const key of pick.keys) {
      if (STRETCH_SKIP.has(key) || !POSE_CATALOG[key]) continue;
      const B = skinPose(rest, catalogRotations(key), { muscle: state.muscle ?? 0.5 }).positions;
      out.push({ key, label: POSE_CATALOG[key].label, ...stretchUnder(A, B, I, under) });
    }
    res = stretchText(out);
  } catch (e) { res = null; }
  stretchCache.set(t.id, { k, res }); return res;
}
let stretchShown = null, stretchTimer = 0;
function stretchRender(t) {
  clearTimeout(stretchTimer);
  const row = $('#stretchRow'), c = t && stretchCache.get(t.id), fresh = c && c.k === stretchKey(t);
  if (!t || t.hidden || !$('#editorAdvanced').open) { if (!t) { row.hidden = true; stretchShown = null; } return; }
  const show = (res) => { if (sel() !== t) return; stretchShown = res; row.hidden = !res; $('#stretchText').textContent = res ? res.text : ''; $('#stretchShow').hidden = !res || res.top < 0.06; };
  if (fresh) { show(c.res); return; }
  // worked out a moment later, so opening the panel stays quick
  row.hidden = true; stretchShown = null;
  stretchTimer = setTimeout(() => { if (sel() === t) show(stretchOf(t)); }, 60);
}
$('#stretchShow').addEventListener('click', () => {
  const t = sel(), r = stretchShown; if (!t || !r || !POSE_CATALOG[r.key]) return;
  poseView.choose(r.key); renderPose(); markTried('stretch'); needsRender = true;
  requestAnimationFrame(() => { if (sel() === t) focusTattoo(t); });
  toast(`${POSE_CATALOG[r.key].label}. Preview, then Pose, then Standing puts you back.`);
});
function renderInfo() {
  clearTimeout(infoTimer);
  infoTimer = setTimeout(() => {
    const t = sel(); if (!t) return;
    likeRender(t);
    const w = whereOf(t); $('#whereLine').textContent = w ? w.line : ''; $('#whereLine').hidden = !w;
    const hrs = hoursOf(t); $('#estLine').textContent = hrs ? sessionText(hrs, readRate()) : '';
    planRender(t);
    sitRender(t);
    evenRender(t);
    lineRender(t);
    readRender(t);
    flashRender(t);
    stretchRender(t);
    const sv = showsOf(t); $('#showsLine').textContent = sv; $('#showsLine').hidden = !sv;
    const wr = wearOf(t); $('#wearLine').textContent = wr ? wr.text : ''; $('#wearLine').hidden = !wr;
    if (document.activeElement !== $('#estRate')) $('#estRate').value = readRate() || '';
  }, 150);
}
$('#estRate').addEventListener('input', () => { const n = Math.round(+$('#estRate').value); writeRate(n > 0 ? n : 0); const t = sel(), hrs = t && hoursOf(t); if (hrs) $('#estLine').textContent = sessionText(hrs, readRate()); planRender(t); if (t) sitRender(t); markTried('estimate'); });
// opened by a Show me, it is only being pointed at, not tried yet
$('#editorAdvanced').addEventListener('toggle', () => { if (!$('#editorAdvanced').open) infoByShow = false; else if (sel()) { renderInfo(); if (!infoByShow && performance.now() > infoQuietUntil) { markTried('where'); markTried('estimate'); markTried('like'); } } });
/* ---------- Preview menu: before/after, pose, clothes and aging behind one button ---------- */
function showLook(open) {
  const m = $('#lookMenu'); m.hidden = open == null ? !m.hidden : !open; $('#lookBtn').setAttribute('aria-expanded', String(!m.hidden));
  // it drops from its button in the toolbar
  if (!m.hidden) { const r = $('#lookBtn').getBoundingClientRect(); const w = m.offsetWidth; m.style.right = Math.max(8, Math.min(Math.round(innerWidth - r.right - 4), innerWidth - w - 8)) + 'px'; }
}
function renderLook() {
  const on = [];
  if ($('#baBtn').getAttribute('aria-pressed') === 'true') on.push('Before / after');
  for (const id of ['#poseBtn', '#clothesBtn', '#ageBtn', '#lightBtn']) { const t = $(id).textContent, i = t.indexOf(': '); $(id).classList.toggle('on', i > 0); if (i > 0) on.push(t.slice(i + 2)); }
  $('#lookBtn').textContent = on.length ? 'Preview: ' + on.join(', ') : 'Preview';
  $('#lookBtn').classList.toggle('active', on.length > 0);
}
$('#lookBtn').addEventListener('click', () => { cancelGesture(); toggle('#newPop', false); toggle('#posePop', false); toggle('#clothesPop', false); toggle('#agePop', false); toggle('#lightPop', false); showLook(); });
// picking one of them closes the little menu: its own panel (or the wipe) takes over
for (const id of ['#baBtn', '#poseBtn', '#clothesBtn', '#ageBtn', '#lightBtn', '#tapeBtn', '#pinsBtn']) $(id).addEventListener('click', () => showLook(false));
new MutationObserver(renderLook).observe($('#lookMenu'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed'] });
renderLook();
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => fullBody(+b.dataset.view * Math.PI / 2)));
$('#add').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async (e) => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
  snapshot(); let last = null; let first = true;
  for (const f of files) {
    if (/\.(usdz|zip|procreate)$/i.test(f.name) || /usdz|zip/.test(f.type)) { await bringBack(f); continue; }
    if (/json$/i.test(f.name) || f.type === 'application/json') { if (f.size > 300e6) { toast('That file is too large to open here.'); continue; } await importBackup(await f.text()); continue; }
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {toast('Choose a PNG, JPEG or WebP picture.');continue;}
    if (f.size > 10*1024*1024) { toast('Use a picture smaller than 10 MiB.'); continue; }
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f); });
    if (typeof url !== 'string') continue;
    const t = await addImage(url, f.name.replace(/\.[^.]+$/, '').slice(0, 100), first ? viewCenterSpot() : null); if (t) {first = false;last = t;}
  }
  if (last) {
    selectedId = last.id; commit(); focusTattoo(last);
    // one picture with several designs on it: offer to split it
    if (files.length === 1) flashOf(last).then((f) => { if (f && sel() === last) toast(`This picture has ${f.boxes.length} separate designs.`, 'Split them', () => splitFlash(last.id)); });
  } else commit();
});
function toggle(id, show) { const n = $(id); n.hidden = show == null ? !n.hidden : !show; if (id === '#agePop' && typeof renderAging === 'function') renderAging(); if (id === '#lightPop' && typeof renderLight === 'function') renderLight(); if (id === '#newPop' && typeof renderNew === 'function') renderNew(); if (id === '#bodyPop') updateInset(); if (id === '#posePop') renderPose(); if (id === '#clothesPop' && typeof renderClothes === 'function') renderClothes(); }
$('#bodyBtn').addEventListener('click', () => { showLook(false); toggle('#bodyPop'); });
$('#rHeight').addEventListener('input', () => { state.heightCm = +$('#rHeight').value; renderBody(); renderSheet(); save(); });
document.querySelectorAll('[data-fig]').forEach((b) => b.addEventListener('click', () => { if (state.figure === b.dataset.fig) return; snapshot(); reshape(() => { state.figure = b.dataset.fig; }); commit(); }));
/* ---------- body shape sliders ---------- */
// Every shape slider works the same way: pin the ink to its triangles when the drag
// starts, reshape live, and record one undo step when the finger lifts.
let shapeSlide = null;
function bindShape(r, set) {
  r.addEventListener('input', () => { if (!shapeSlide) { snapshot(); shapeSlide = anchorsNow(); } set(+r.value / 100); applyShape(); applyAnchors(shapeSlide); syncDecals(); });
  r.addEventListener('change', () => { shapeSlide = null; commit(); });
}
bindShape($('#rMuscle'), (v) => { state.muscle = v; markTried('definition'); });
bindShape($('#rWeight'), (v) => { state.weight = v; });
/* ---------- your own skin tone ---------- */
function skinFromSliders() {
  markTried('skin-tone');
  if (!skinSlide) { snapshot(); skinSlide = true; }
  state.skinHex = toneColour(+$('#rSkinDepth').value / 100, +$('#rSkinWarm').value / 100);
  skinMat.color.set(state.skinHex); needsRender = true;
  const b = $('#skinOwnBtn'); if (b) { b.style.background = state.skinHex; b.classList.add('on', 'set'); }
  document.querySelectorAll('#skins .sw:not(.own)').forEach((x) => x.classList.remove('on'));
}
for (const id of ['#rSkinDepth', '#rSkinWarm']) {
  $(id).addEventListener('input', skinFromSliders);
  $(id).addEventListener('change', () => { skinSlide = false; save(); refreshUndo(); });
}
// Match a photo: open it full screen, tap the skin, keep the middle colour of a small disc.
let skinPhoto = null;
$('#skinPhotoBtn').addEventListener('click', () => $('#skinPhotoFile').click());
$('#skinPhotoFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const url = URL.createObjectURL(f);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That photo could not be opened.')); i.src = url; });
    const s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s));
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, c.width, c.height);
    skinPhoto = { url, w: c.width, h: c.height, px: g.getImageData(0, 0, c.width, c.height).data, hex: null };
    $('#spImg').src = url; $('#spRing').hidden = true; $('#spSwatch').style.background = 'transparent';
    $('#spMsg').textContent = 'No spot picked yet.'; $('#spUse').disabled = true; $('#skinPick').hidden = false;
  } catch (err) { URL.revokeObjectURL(url); toast(err.message); }
});
function closeSkinPick() { $('#skinPick').hidden = true; if (skinPhoto) URL.revokeObjectURL(skinPhoto.url); skinPhoto = null; $('#spImg').removeAttribute('src'); }
$('#skinPick').addEventListener('pointerdown', (e) => {
  if (!skinPhoto || e.target.closest('#spBar,#spTop')) return;
  const r = $('#spImg').getBoundingClientRect(), k = Math.min(r.width / skinPhoto.w, r.height / skinPhoto.h);
  const ox = r.left + (r.width - skinPhoto.w * k) / 2, oy = r.top + (r.height - skinPhoto.h * k) / 2;
  const x = (e.clientX - ox) / k, y = (e.clientY - oy) / k;
  if (x < 0 || y < 0 || x >= skinPhoto.w || y >= skinPhoto.h) return;
  const hex = sampleSkin(skinPhoto.px, skinPhoto.w, skinPhoto.h, x, y, Math.max(4, 0.012 * Math.max(skinPhoto.w, skinPhoto.h)));
  const ring = $('#spRing'); ring.hidden = false; ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
  const why = hex ? skinCheck(hex) : 'Tap on the photo.';
  skinPhoto.hex = why ? null : hex; ring.style.background = hex || 'transparent'; $('#spSwatch').style.background = hex || 'transparent';
  $('#spMsg').textContent = why || 'This is the tone you tapped. Tap another spot to try again.'; $('#spUse').disabled = !!why;
});
$('#spCancel').addEventListener('click', closeSkinPick);
$('#spUse').addEventListener('click', () => {
  if (!skinPhoto?.hex) return;
  markTried('skin-tone'); snapshot(); state.skinHex = skinPhoto.hex; skinOwnOpen = true; skinMat.color.set(state.skinHex); needsRender = true;
  closeSkinPick(); renderBody(); save(); refreshUndo();
  toast('Your skin tone now matches the photo.', 'Undo', undo);
});
const fitEls = {}; const fitGroupEls = [];
(function buildFitUI() {
  const host = $('#fitGroups');
  for (const g of FIT_GROUPS) {
    const grp = el('div', { class: 'grp' }), mark = el('i'); let tog = null;
    if (g.toggle) { tog = el('button', { class: 'btn', type: 'button', text: 'Show on the body', onclick: () => { snapshot(); reshape(() => { state[g.toggle] = state[g.toggle] === false; }); commit(); } }); grp.append(tog); }
    for (const it of g.items) {
      const s = el('ink-slider', { min: -100, max: 100, 'aria-label': it.label });
      const row = el('div', { class: 'lbl' }, it.label, s);
      bindShape(s, (v) => { state.fit = state.fit || {}; if (v) state.fit[it.key] = v; else delete state.fit[it.key]; });
      grp.append(row); fitEls[it.key] = { s, row, when: it.when };
    }
    const d = el('details', {}, el('summary', {}, el('span', { text: g.title }), mark), grp);
    fitGroupEls.push({ g, d, mark, tog }); host.append(d);
  }
})();
function syncFitUI() {
  const fit = state.fit || {};
  for (const G of fitGroupEls) {
    let changed = 0, shown = 0;
    for (const it of G.g.items) {
      const e = fitEls[it.key], vis = fitVisible(it.when, state.figure);
      e.row.hidden = !vis; e.s.value = Math.round((fit[it.key] || 0) * 100);
      if (vis) { shown++; if (fit[it.key]) changed++; }
    }
    G.d.hidden = !shown || !fitVisible(G.g.when, state.figure);
    G.mark.textContent = changed ? `${changed} changed` : '';
    if (G.tog) G.tog.setAttribute('aria-pressed', state[G.g.toggle] !== false ? 'true' : 'false');
  }
}
$('#fitReset').addEventListener('click', () => { snapshot(); reshape(() => { state.fit = {}; state.muscle = 0.5; state.weight = 0.5; }); commit(); toast('Body shape back to standard', 'Undo', undo); });
// Keep browser/page zoom separate from the 3D camera. Single-finger panel
// scrolling is allowed; pinching panels must not zoom the entire app off-screen.
// A panel of its own marks its scrolling parts with data-scroll (the measured wrap does).
// A one-finger (or Pencil) touch that starts on a button is left alone, so the jitter of
// a tap never turns into a cancelled click; the page itself cannot scroll anyway.
document.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && controlAt(e.target)) return;
  if (e.touches.length > 1 || !(e.target instanceof Element) || !e.target.closest('.pop,.modal,#trayItems,#sheet,[aria-modal=true],[data-scroll],textarea')) e.preventDefault();
}, { passive: false });
installPenTap();
for (const name of ['gesturestart', 'gesturechange']) document.addEventListener(name, (e) => e.preventDefault(), { passive: false });
// iOS can still change its visual viewport (keyboard, accessibility/page zoom,
// browser chrome). Fit the whole studio to that visible rectangle rather than
// assuming fixed controls at layout-viewport corners are still reachable.
if (window.visualViewport) {
  const vv = window.visualViewport, viewport = $('#viewport');
  const onVV = () => {
    const scale = vv.scale || 1;
    viewport.style.width = `${vv.width * scale}px`;
    viewport.style.height = `${vv.height * scale}px`;
    viewport.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px) scale(${1 / scale})`;
    document.documentElement.style.setProperty('--kb', '0px');
  };
  vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV); onVV();
}
// An installed copy picks up a new build as soon as its service worker takes over.
// A new version arrives in the background (service worker autoUpdate). Never reload
// under Jake's hands: before he has touched anything it reloads straight away, after
// that it waits until the app leaves the screen or he taps Reload, and it always
// finishes writing the save first.
let touchedSinceBoot = false, updateReady = false;
window.addEventListener('pointerdown', () => { touchedSinceBoot = true; }, { capture: true, passive: true });
async function reloadForUpdate() {
  for (let i = 0; i < 100 && (saving || dirty); i++) { if (!saving) await flushSave(); else await new Promise((r) => setTimeout(r, 50)); }
  if (dirty || saving) return; // the save is failing: keep the page (and the work) rather than reload
  location.reload();
}
function onUpdateReady() {
  if (updateReady) return; updateReady = true;
  if (document.hidden || (!touchedSinceBoot && !gest)) { reloadForUpdate(); return; }
  toast('A new version of Ink Atlas is ready.', 'Reload', reloadForUpdate, 15000); // long enough to read and reach; leaving the screen applies it anyway
}
document.addEventListener('visibilitychange', () => { if (document.hidden && updateReady) reloadForUpdate(); });
if ('serviceWorker' in navigator) { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) onUpdateReady(); }); }
$('#projectsBtn').addEventListener('click', () => {cancelGesture();toggle('#planMenu',true);});
function previewInput() {return {THREE,state:JSON.parse(JSON.stringify(state)),bodyGeometry:bodyGeo,bodyMaterial:skinMat,decals:state.tattoos.filter(t=>!t.hidden).map(t=>decals[t.id]).filter(d=>d && d.tex).map(d=>({geometry:d.mesh.geometry,material:d.mesh.material}))};}
$('#openBodyTools').addEventListener('click',async()=>{
  cancelGesture();toggle('#planMenu',false);let originalNotes=JSON.stringify({notes:state.notes,drawings:state.drawings});
  try {const {openBodyTools}=await import('./body-tools.js');await openBodyTools({...previewInput(),onSaveState:({notes,drawings})=>{
    if(JSON.stringify({notes:state.notes,drawings:state.drawings})!==originalNotes)throw new Error('Notes changed while this window was open. Close and reopen to keep both versions safe.');
    snapshot();state.notes=notes;state.drawings=drawings;commit();originalNotes=JSON.stringify({notes:state.notes,drawings:state.drawings});
  }});}catch(e){toast('Could not open body tools: '+e.message);}
});
$('#openPhotoFit').addEventListener('click',async()=>{
 cancelGesture();toggle('#planMenu',false);const before=JSON.stringify(state);
 try{const {openPhotoFit}=await import('./photo-fit.js');await openPhotoFit({THREE,state:JSON.parse(before),bodyMaterial:skinMat,onApplyCopy:async params=>{
  if(JSON.stringify(state)!==before)throw new Error('The project changed. Reopen the fitting preview.');
  const proposed=cleanState({...state,figure:params.figure,muscle:params.muscle,weight:params.weight,heightCm:params.heightCm,fit:params.fit},k=>!!images[k]).state;
  const shelf=await openProjectShelf();try{await shelf.create((state.projectName||'My tattoos')+' · before fitting',{state,images:usedImages()});}finally{shelf.close();}
  if(JSON.stringify(state)!==before)throw new Error('The project changed. Its earlier copy is safely kept, but fitting was not applied.');
  snapshot();reshape(()=>{for(const k of ['figure','muscle','weight','heightCm','fit'])state[k]=proposed[k];});state.projectName=(state.projectName||'My tattoos')+' · fitted copy';if(account)account.unbind();commit();fullBody();toast('Fitted copy opened. The original is kept in Projects.');
 }});}catch(e){toast('Could not open photo fitting: '+e.message);}
});
$('#openNotes').addEventListener('click',async()=>{
  toggle('#planMenu',false);
  try {const {openBodyNotes}=await import('./body-notes.js');await openBodyNotes({getState:()=>state,change:fn=>{snapshot();fn(state);commit();}});}
  catch(e){toast('Could not open notes: '+e.message);}
});
function projectGroupSurface(position,normal,tattoo) {
  const n=new V3(...normal).normalize();ray.set(new V3(...position).addScaledVector(n,.12),n.clone().negate());ray.far=.24;
  const hit=ray.intersectObject(body,false)[0];ray.far=Infinity;if(!hit || hit.faceIndex==null)return null;
  const start=startTriangle(tattoo),target=hit.faceIndex,I=bodyGeo.index.array,P=bodyGeo.attributes.position.array,A=bodyAdjacency();
  const centre=tri=>{const p=[0,0,0];for(let k=0;k<3;k++)for(let j=0;j<3;j++)p[j]+=P[I[tri*3+k]*3+j]/3;return p;};
  const limit=Math.min(.3,Math.hypot(...position.map((v,i)=>v-tattoo.pos[i]))*3+.045);
  const best=new Float64Array(I.length/3);best.fill(Infinity);best[start]=0;const queue=[[start,0]];let found=false,guard=0;
  while(queue.length && guard++<8000){queue.sort((a,b)=>b[1]-a[1]);const [tri,cost]=queue.pop();if(cost!==best[tri])continue;if(tri===target){found=true;break;}const c=centre(tri);
    for(let k=0;k<3;k++){const next=A[tri*3+k];if(next<0)continue;const d=centre(next),value=cost+Math.hypot(...d.map((v,i)=>v-c[i]));if(value<=limit&&value<best[next]){best[next]=value;queue.push([next,value]);}}
  }
  return found?{pos:hit.point.toArray(),normal:hit.normal.clone().normalize().toArray()}:null;
}
async function transformSelection(options) {
  const {planGroupTransform}=await import('./group-transform.js');
  const result=planGroupTransform(state.tattoos,options.ids,options,projectGroupSurface);
  if(!result.updates.length)return {message:'No unlocked planned pieces selected.'};
  snapshot();for(const update of result.updates){const t=state.tattoos.find(x=>x.id===update.id);if(t)Object.assign(t,update);}
  commit();return {message:`${result.updates.length} pieces transformed.${result.skippedIds.length?' Locked/existing pieces unchanged.':''}`};
}
function placementProjection(position,normal,tattoo,{operation}={}) {
 if(operation!=='bodySymmetry')return projectGroupSurface(position,normal,tattoo);
 const n=new V3(...normal).normalize();ray.set(new V3(...position).addScaledVector(n,.04),n.clone().negate());ray.far=.08;
 try{const hit=ray.intersectObject(body,false)[0];if(!hit||hit.faceIndex==null)return null;return {pos:hit.point.toArray(),normal:hit.normal.clone().normalize().toArray()};}finally{ray.far=Infinity;}
}
function previewPlacement(plan){
 if(!plan)return null;
 const oldCur={...cur},oldGoal={...goal},oldGlide=glide,visibility=[],temporary=[];
 try{
  for(const t of plan.updates){const d=decals[t.id];if(d){visibility.push([d.mesh,d.mesh.visible],[d.outline,d.outline.visible]);d.mesh.visible=false;d.outline.visible=false;}}
  for(const t of [...plan.updates,...plan.additions]){
   const tex=inkTexture(t),geo=decalGeometry(t),mat=new THREE.MeshBasicMaterial({map:tex,blending:THREE.MultiplyBlending,premultipliedAlpha:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,toneMapped:false});
   const mesh=new THREE.Mesh(geo,mat);mesh.renderOrder=200;scene.add(mesh);temporary.push({mesh,geo,mat,tex});
  }
  const target=[...plan.updates,...plan.additions][0];fullBody(Math.atan2(target.normal[0],target.normal[2]));Object.assign(cur,goal);applyCam();renderer.render(scene,camera);return {dataUrl:canvas.toDataURL('image/png')};
 }finally{for(const x of temporary){scene.remove(x.mesh);x.geo.dispose();x.mat.dispose();x.tex.dispose();}for(const [mesh,visible]of visibility)mesh.visible=visible;Object.assign(cur,oldCur);Object.assign(goal,oldGoal);glide=oldGlide;applyCam();needsRender=true;}
}
$('#openArtworkLibrary').addEventListener('click',async()=>{
 toggle('#planMenu',false);cancelGesture();
 try{const {openArtworkLibrary}=await import('./artwork-library.js');await openArtworkLibrary({getState:()=>state,getImages:()=>images,onBoardsChange:async nextBoards=>{
  const {validateArtworkBoards}=await import('./artwork-boards.js');const boards=validateArtworkBoards(nextBoards),baseline=JSON.stringify(state);
  await flushSave();while(saving)await new Promise(r=>setTimeout(r,20));
  if(JSON.stringify(state)!==baseline)throw new Error('Project changed while saving the board. Try again.');
  if(!store?.ok)throw new Error('Project storage unavailable. Boards were not changed.');
  const next=structuredClone(state);next.artworkBoards=boards;const assets={};for(const k of imageKeysFor(next))if(images[k])assets[k]=images[k];
  await store.save(next,assets);snapshot();state=next;commit();
 },onPlace:async plan=>{
  if(!await loadImg(plan.outputKey))throw new Error('Artwork image unavailable. Nothing placed.');
  if(state.tattoos.some(t=>t.id===plan.tattoo.id))throw new Error('Placement identity already exists.');
  const place=viewCenterSpot()||nextSlot();snapshot();state.artworks||={};if(plan.artwork)state.artworks[plan.artworkId]=plan.artwork;
  const tattoo={...plan.tattoo,pos:place.pos,normal:place.normal};state.tattoos.push(tattoo);selectedId=tattoo.id;commit();focusTattoo(tattoo);toast('Artwork placed as a new planned tattoo.','Undo',undo);
 }});}catch(e){toast('Artwork library: '+e.message);}
});
async function openDraftEditor(){
 toggle('#planMenu',false);cancelGesture();
 try{await flushSave();while(saving)await new Promise(r=>setTimeout(r,20));const {openPlacementDraft}=await import('./placement-draft.js');await openPlacementDraft({getState:()=>state,selectedId,preview:previewPlacement,onApply:async next=>{
  if(!store?.ok)throw new Error('Project storage is unavailable. Draft retained; placement was not committed.');
  await flushSave();while(saving)await new Promise(r=>setTimeout(r,20));await store.save(next,usedImages());snapshot();state=next;commit();
 }});}catch(e){toast('Placement draft: '+e.message);}
}
$('#bDraft').addEventListener('click',openDraftEditor);
$('#openPlacement').addEventListener('click',async()=>{
 toggle('#planMenu',false);cancelGesture();const baseline=JSON.stringify(state);
 try{const {openPlacementTools}=await import('./placement-tools.js');await openPlacementTools({getState:()=>state,selectedId,projectToSurface:placementProjection,onPreview:previewPlacement,onApply:plan=>{
  if(JSON.stringify(state)!==baseline)throw new Error('Project changed while tools were open. Reopen tools.');
  for(const t of plan.updates){const old=state.tattoos.find(x=>x.id===t.id);if(!old||old.locked||old.status==='existing')throw new Error('Selected piece is no longer editable.');}
  if(plan.additions.some(t=>state.tattoos.some(x=>x.id===t.id)))throw new Error('Duplicate placement identity.');
  snapshot();for(const t of plan.updates)Object.assign(state.tattoos.find(x=>x.id===t.id),t);state.tattoos.push(...plan.additions);commit();toast('Placement applied.','Undo',undo);
 }});}catch(e){toast('Placement tools: '+e.message);}
});
$('#openLayers').addEventListener('click',()=>{toggle('#planMenu',false);markTried('layersSheet');openLayers({getState:()=>state,onTransform:transformSelection,getImages:()=>images,onSolo:ids=>{soloIds=ids?new Set(ids):null;syncDecals();},select:id=>select(id,true),change:fn=>{snapshot();fn(state);commit();}});});
$('#openUnplaced').addEventListener('click',()=>{
 toggle('#planMenu',false);const host=el('section',{class:'scrim',role:'dialog','aria-modal':'true','aria-label':'Saved artwork to place'});host.style.zIndex=10000;const panel=el('div',{class:'modal glass'},el('h2',{text:'Saved artwork to place'}),el('p',{text:'These pieces had no body position in the imported project. Place one deliberately, then adjust it on the body.'}));
 for(const record of state.unplacedTattoos||[])panel.append(el('button',{class:'card',text:'Place '+record.name+' on body',onclick:async()=>{
  const image=await loadImg(record.img);if(!image){toast('That saved image could not be opened.');return;}const spot=viewCenterSpot()||nextSlot();snapshot();state.unplacedTattoos=state.unplacedTattoos.filter(t=>t.id!==record.id);const t={...record,pos:spot.pos,normal:spot.normal,locked:false};state.tattoos.push(t);selectedId=t.id;commit();focusTattoo(t);host.remove();toast('Adjust the placement, then lock it when ready.');
 }}));panel.append(el('button',{class:'btn',text:'Done',onclick:()=>host.remove()}));host.append(panel);$('#viewport').append(host);host.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape')host.remove();};
});
async function compareSavedLayouts({a,b}){
 const {openLayoutCompare,compareBodyIdentity}=await import('./layout-compare.js');
 const baseline=JSON.stringify(state),identity=compareBodyIdentity(state),owned=[];
 try{
  const bundles=[];
  for(const record of [a,b]){
   const checked=cleanState(record.state,k=>typeof images[k]==='string');
   if(checked.dropped||checked.replace.length)throw new Error('This saved plan has missing artwork or invalid placements. Restore its backup before comparing.');
   const saved=checked.state;
   if(compareBodyIdentity(saved)!==identity)throw new Error('Live comparison currently needs both saved plans and the open project to use the same body, fit and skin. Saved-picture comparison remains available.');
   const entries=[];
   for(const t of saved.tattoos.filter(t=>!t.hidden)){
    if(!await loadImg(t.img))throw new Error('A saved artwork image could not be loaded.');
    const texture=inkTexture(t);owned.push(texture);const geometry=decalGeometry(t);owned.push(geometry);
    const material=new THREE.MeshBasicMaterial({map:texture,blending:THREE.MultiplyBlending,premultipliedAlpha:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,toneMapped:false});owned.push(material);entries.push({geometry,material});
   }
   bundles.push({name:record.name||'Saved plan',state:saved,bodyGeometry:bodyGeo,bodyMaterial:skinMat,decals:entries});
  }
  if(JSON.stringify(state)!==baseline)throw new Error('Project changed while preparing comparison. Open it again.');
  await openLayoutCompare({THREE,a:bundles[0],b:bundles[1]});
 }finally{owned.forEach(x=>x.dispose());}
}
$('#openPlanning').addEventListener('click',async()=>{
 toggle('#planMenu',false);
 try { await openPlanning({getState:()=>state,getPreview:()=>planningPreview(),onCompare3D:compareSavedLayouts,applyState:async next=>{snapshot();await openProject(next,images);commit();},getView:()=>({...goal}),setView:v=>{goal.roll=Number.isFinite(v.roll)?v.roll:0;for(const k of Object.keys(goal))if(Number.isFinite(v[k]))goal[k]=v[k];needsRender=true;}}); }
 catch(e){toast('Could not open planning: '+e.message);}
});
$('#openProjects').addEventListener('click', async () => {
 cancelGesture();toggle('#planMenu',false);
 try {
  const result = await openShelf({ current: () => ({state,images:usedImages()}), currentName:state.projectName || 'My tattoos' });
  if (!result) return;
  snapshot();
  if (result.action === 'new') { state = freshState(); state.projectName='New project'; selectedId=null; }
  else { await openProject(result.project.state,result.project.images); state.projectName=result.project.name; }
  if (account) account.unbind();
  commit();fullBody();toast('Project opened. Your previous work is saved in Projects.','Undo',undo);
 } catch(e) { toast('Could not open Projects: '+e.message); }
});
$('#shareBtn').addEventListener('click', () => { toggle('#share', true); paletteReady = buildPalette(); });
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { toggle('#' + b.dataset.close, false); }));
document.addEventListener('keydown', (e) => { if (document.querySelector('[aria-modal=true]')) return; if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (e.key === 'Escape') { if (!$('#skinPick').hidden) closeSkinPick(); if (!$('#tryOn').hidden) closeTryOn(); showRealSize(false); cancelGesture(); showLook(false); toggle('#posePop', false); renderPose(); toggle('#clothesPop', false); toggle('#agePop', false); toggle('#lightPop', false); toggle('#spotPop', false); closeBodyMatch(false); toggle('#newPop', false); endCoach(); toggle('#planMenu', false); toggle('#pcMenu', false); toggle('#share', false); toggle('#preview', false); toggle('#recover', false); toggle('#bodyPop', false); } });

/* ---------- export (share sheet / download → src/share.js) ---------- */
function shot(hideInk) {
  const inset = curInset; curInset = 0; applyInset(); // exports are always centred, panel open or not
  exporting = true; decalGroup.visible = !hideInk; syncDecals(); poseView.withPosed(() => renderer.render(scene, camera), posedInk());
  const url = canvas.toDataURL('image/png');
  exporting = false; decalGroup.visible = true; syncDecals(); curInset = inset; applyInset(); needsRender = true; return url;
}
// Before and after as one picture: this view without the planned tattoos, then with them,
// side by side with a plain label over each. Tattoos already on you show in both.
function compareShot() {
  const planned = state.tattoos.filter((t) => t.status !== 'existing' && !t.hidden);
  if (!planned.length) return null;
  const inset = curInset; curInset = 0; applyInset();
  exporting = true; syncDecals();
  const H = canvas.height, pad = Math.round(H * 0.02), head = Math.round(H * 0.075);
  // trim the empty sides: keep the width the body takes on screen, with a margin
  const geo = (poseView.active && poseView.geometry) || bodyGeo, P = geo.attributes.position.array, v = new THREE.Vector3();
  let lo = 1, hi = -1;
  camera.updateMatrixWorld(); for (let i = 0; i < P.length; i += 21) { v.set(P[i], P[i + 1], P[i + 2]).project(camera); if (v.z < 1 && v.y > -1.1 && v.y < 1.1) { lo = Math.min(lo, v.x); hi = Math.max(hi, v.x); } }
  let x0 = 0, W = canvas.width;
  if (hi > lo) { const m = (hi - lo) * 0.12 + 0.04; const a = Math.max(-1, lo - m), b = Math.min(1, hi + m); x0 = Math.round((a + 1) / 2 * canvas.width); W = Math.max(Math.round(H * 0.45), Math.round((b - a) / 2 * canvas.width)); x0 = Math.max(0, Math.min(canvas.width - W, x0 - Math.max(0, W - Math.round((b - a) / 2 * canvas.width)) / 2 | 0)); W = Math.min(W, canvas.width); }
  const out = document.createElement('canvas'); out.width = W * 2 + pad * 3; out.height = H + head + pad;
  const g = out.getContext('2d');
  g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  try {
    const restore = hidePlanned();
    try { poseView.withPosed(() => renderer.render(scene, camera), posedInk()); g.drawImage(canvas, x0, 0, W, H, pad, head, W, H); } finally { restore(); }
    poseView.withPosed(() => renderer.render(scene, camera), posedInk()); g.drawImage(canvas, x0, 0, W, H, W + pad * 2, head, W, H);
  } finally { exporting = false; syncDecals(); curInset = inset; applyInset(); needsRender = true; }
  g.fillStyle = '#f2f2f5'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = `600 ${Math.round(head * 0.42)}px -apple-system, system-ui, sans-serif`;
  g.fillText('Now', pad + W / 2, head / 2 + pad / 2);
  g.fillText(planned.length === 1 ? 'With the planned tattoo' : `With ${planned.length} planned tattoos`, W + pad * 2 + W / 2, head / 2 + pad / 2);
  compareLast = { W, H, x0 };
  return out.toDataURL('image/png');
}
let compareLast = null;
// In the mirror: this view as others see it beside the same view flipped, the way it looks when
// you check it in a mirror (lettering reads backwards there). Nothing changes on the body.
function mirrorShot() {
  if (!state.tattoos.some((t) => !t.hidden)) return null;
  const inset = curInset; curInset = 0; applyInset();
  exporting = true; syncDecals();
  const H = canvas.height, pad = Math.round(H * 0.02), head = Math.round(H * 0.075);
  const geo = (poseView.active && poseView.geometry) || bodyGeo, P = geo.attributes.position.array, v = new THREE.Vector3();
  let lo = 1, hi = -1;
  camera.updateMatrixWorld(); for (let i = 0; i < P.length; i += 21) { v.set(P[i], P[i + 1], P[i + 2]).project(camera); if (v.z < 1 && v.y > -1.1 && v.y < 1.1) { lo = Math.min(lo, v.x); hi = Math.max(hi, v.x); } }
  let x0 = 0, W = canvas.width;
  if (hi > lo) { const m = (hi - lo) * 0.12 + 0.04; const a = Math.max(-1, lo - m), b = Math.min(1, hi + m); x0 = Math.round((a + 1) / 2 * canvas.width); W = Math.max(Math.round(H * 0.45), Math.round((b - a) / 2 * canvas.width)); x0 = Math.max(0, Math.min(canvas.width - W, x0)); }
  const out = document.createElement('canvas'); out.width = W * 2 + pad * 3; out.height = H + head + pad;
  const g = out.getContext('2d');
  g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  try {
    poseView.withPosed(() => renderer.render(scene, camera), posedInk());
    g.drawImage(canvas, x0, 0, W, H, pad, head, W, H);
    g.save(); g.translate(W * 2 + pad * 2, 0); g.scale(-1, 1); g.drawImage(canvas, x0, 0, W, H, 0, head, W, H); g.restore();
  } finally { exporting = false; syncDecals(); curInset = inset; applyInset(); needsRender = true; }
  g.fillStyle = '#f2f2f5'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = `600 ${Math.round(head * 0.42)}px -apple-system, system-ui, sans-serif`;
  g.fillText('As others see it', pad + W / 2, head / 2 + pad / 2);
  g.fillText('In a mirror', W + pad * 2 + W / 2, head / 2 + pad / 2);
  mirrorLast = { W, H, pad, head };
  return out.toDataURL('image/png');
}
let mirrorLast = null;
// Picture with sizes: this view, with each tattoo that faces the camera labelled with its name
// and size just under it (or over it), the labels kept apart. Returns null with no tattoo shown,
// and '' when none faces the camera.
function labelsShot() {
  const list = state.tattoos.filter((t) => !t.hidden); if (!list.length) return null;
  const inset = curInset; curInset = 0; applyInset();
  exporting = true; syncDecals();
  const W = canvas.width, H = canvas.height, out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d'), found = []; let span = null;
  try {
    poseView.withPosed(() => renderer.render(scene, camera), posedInk()); g.drawImage(canvas, 0, 0);
    camera.updateMatrixWorld(); const eye = camera.position.clone();
    const toPx = (p) => { const v = p.clone().project(camera); return v.z < 1 ? [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H] : null; };
    for (const t of list) {
      const s = viewSpot(t), c = new V3(...s.pos), n = new V3(...s.normal).normalize(), to = c.clone().sub(eye), dist = to.length();
      if (n.dot(to) >= 0) continue; // facing away
      ray.set(eye, to.clone().normalize());
      const h = poseView.active ? poseView.withPosed(() => ray.intersectObject(body, false)[0]) : ray.intersectObject(body, false)[0];
      if (h && h.distance < dist - 0.02) continue; // behind another part of the body
      const f = frameOf({ ...t, pos: s.pos, normal: s.normal }), hw = t.width / 2, hh = t.width / t.aspect / 2;
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toPx(c.clone().addScaledVector(f.right, a * hw).addScaledVector(f.up, b * hh)));
      if (pts.some((q) => !q)) continue;
      const box = [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
      if (box[2] < 0 || box[0] > W || box[3] < 0 || box[1] > H) continue;
      found.push({ t, box });
    }
    // the body's span across the picture, so the labels can sit beside it
    const geo = (poseView.active && poseView.geometry) || bodyGeo, P = geo.attributes.position.array, v = new V3();
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < P.length; i += 21) { v.set(P[i], P[i + 1], P[i + 2]).project(camera); if (v.z < 1 && v.y > -1 && v.y < 1) { const x = (v.x + 1) / 2 * W; lo = Math.min(lo, x); hi = Math.max(hi, x); } }
    span = hi > lo ? [Math.max(0, lo), Math.min(W, hi)] : null;
  } finally { exporting = false; syncDecals(); curInset = inset; applyInset(); needsRender = true; }
  if (!found.length) return '';
  const fs = Math.max(12, Math.round(Math.min(W, H) * 0.024)), pad = Math.round(fs * 0.55), lh = Math.round(fs * 1.25);
  const bold = `600 ${fs}px -apple-system, system-ui, sans-serif`, plain = `${fs}px -apple-system, system-ui, sans-serif`;
  const sfs = Math.round(fs * 0.82), small = `${sfs}px -apple-system, system-ui, sans-serif`, sh = Math.round(sfs * 1.25);
  const items = found.map(({ t, box }) => {
    // the name, the size, then where it sits the way an artist measures it
    let at = ''; try { const wh = whereOf(t); at = wh && wh.line ? wh.line.slice(wh.line.indexOf(':') + 1).trim().replace(/\.$/, '') : ''; } catch { at = ''; }
    const w = toInches(t.width), lines = [t.name || 'Tattoo', sizeLabel(w, w / t.aspect), ...(at ? at.split(/, /).map((l) => l.charAt(0).toUpperCase() + l.slice(1)) : [])];
    const widths = lines.map((l, k) => { g.font = k > 1 ? small : k ? plain : bold; return g.measureText(l).width; });
    return { t, box, lines, w: Math.ceil(Math.max(...widths) + pad * 2), h: lh * 2 + sh * (lines.length - 2) + pad * 2 };
  });
  const spots = placeLabels(items, W, H, Math.round(fs * 0.4), span);
  // every line first, then the labels over them, so no line crosses a label's words
  g.strokeStyle = 'rgba(242,242,245,0.9)'; g.lineWidth = Math.max(1.5, fs * 0.09); g.fillStyle = 'rgba(242,242,245,0.95)';
  items.forEach((it, i) => {
    const [a, b] = leader(it.box, spots[i], it.w, it.h);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.beginPath(); g.arc(b[0], b[1], Math.max(2.5, fs * 0.16), 0, Math.PI * 2); g.fill();
    // a thin box round the tattoo so it is clear which one the label means
    g.save(); g.setLineDash([fs * 0.3, fs * 0.25]); g.strokeRect(it.box[0], it.box[1], it.box[2] - it.box[0], it.box[3] - it.box[1]); g.restore();
  });
  items.forEach((it, i) => {
    const { x, y } = spots[i];
    g.fillStyle = 'rgba(22,23,28,0.86)'; const r = Math.round(fs * 0.5);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + it.w, y, x + it.w, y + it.h, r); g.arcTo(x + it.w, y + it.h, x, y + it.h, r); g.arcTo(x, y + it.h, x, y, r); g.arcTo(x, y, x + it.w, y, r); g.closePath(); g.fill();
    g.fillStyle = '#f2f2f5'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = bold; g.fillText(it.lines[0], x + pad, y + pad + lh / 2);
    g.font = plain; g.fillStyle = '#c9cad3'; g.fillText(it.lines[1], x + pad, y + pad + lh * 1.5);
    g.font = small; g.fillStyle = '#a9abb6'; it.lines.slice(2).forEach((l, k) => g.fillText(l, x + pad, y + pad + lh * 2 + sh * (k + 0.5)));
  });
  labelsLast = items.map((it, i) => ({ id: it.t.id, box: it.box.map(Math.round), ...spots[i], w: it.w, h: it.h, lines: it.lines, span }));
  return out.toDataURL('image/png');
}
let labelsLast = null;
// How it ages, as one picture: the selected tattoo (or the first one showing) close up, fresh,
// healed, at 10 and at 20 years, in a two by two grid with a label on each.
function agingSheet() {
  const t = sel() && !sel().hidden ? sel() : state.tattoos.find((x) => !x.hidden);
  if (!t) return null;
  const oldCur = { ...cur }, oldGoal = { ...goal }, oldGlide = glide, oldYears = agingYears, inset = curInset;
  const W = canvas.width, H = canvas.height, side = Math.min(W, H), sx = Math.round((W - side) / 2), sy = Math.round((H - side) / 2);
  const tile = Math.min(side, 1100), pad = Math.round(tile * 0.03), lab = Math.round(tile * 0.085), head = Math.round(tile * 0.12);
  const out = document.createElement('canvas'); out.width = tile * 2 + pad * 3; out.height = head + (tile + lab) * 2 + pad * 2;
  const g = out.getContext('2d'); g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  g.fillStyle = '#f2f2f5'; g.textBaseline = 'middle'; g.textAlign = 'center';
  try {
    curInset = 0; applyInset();
    // straight at the tattoo, centred in the square, filling about half of it
    focusTattoo(t); const spot = viewSpot(t), tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    goal.tx = spot.pos[0]; goal.ty = spot.pos[1]; goal.tz = spot.pos[2]; goal.roll = 0;
    goal.r = THREE.MathUtils.clamp((Math.max(t.width, t.width / t.aspect) * 2 + 0.06) / (2 * tn * Math.min(1, camera.aspect)), 0.3, 3.2);
    Object.assign(cur, goal); glide = false; applyCam();
    exporting = true;
    AGES.forEach((a, i) => {
      agingYears = a.years; syncDecals();
      poseView.withPosed(() => renderer.render(scene, camera), posedInk());
      const x = pad + (i % 2) * (tile + pad), y = head + Math.floor(i / 2) * (tile + lab + pad);
      g.drawImage(canvas, sx, sy, side, side, x, y, tile, tile);
      g.font = `600 ${Math.round(lab * 0.42)}px -apple-system, system-ui, sans-serif`;
      g.fillText(a.years === 1 ? 'Healed, about a year' : a.label, x + tile / 2, y + tile + lab / 2);
    });
  } finally {
    exporting = false; agingYears = oldYears; syncDecals();
    Object.assign(cur, oldCur); Object.assign(goal, oldGoal); glide = oldGlide; curInset = inset; applyInset(); applyCam(); needsRender = true;
  }
  g.font = `600 ${Math.round(head * 0.3)}px -apple-system, system-ui, sans-serif`;
  g.fillText(`How ${t.name || 'this tattoo'} may age`, out.width / 2, head * 0.42);
  g.fillStyle = '#9a9cab'; g.font = `${Math.round(head * 0.19)}px -apple-system, system-ui, sans-serif`;
  g.fillText('A rough guide, not a promise. Fine lines soften first, and light colours fade sooner than black.', out.width / 2, head * 0.78);
  agingLast = { tile, pad, head, lab, id: t.id };
  return out.toDataURL('image/png');
}
let agingLast = null;
// The finest lines and gaps of a tattoo's artwork at its real size, in mm (ink check's measure).
async function finestOf(t) {
  const im = imgEls[t.img] || await loadImg(t.img); if (!im) return null;
  const k = state.heightCm / 175, wMm = t.width * 1000 * k, hMm = wMm / t.aspect;
  const pxMm = Math.max(wMm, hMm) / 900, w = Math.max(8, Math.round(wMm / pxMm)), h = Math.max(8, Math.round(hMm / pxMm));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
  const r = inkCheck(g.getImageData(0, 0, w, h).data, w, h, { pxMm, skin: hexRgb(skinColor()) });
  return { lineMm: r.lineP10Mm, gapMm: r.gapP10Mm };
}
// What an eye sees of a picture from further off: detail smaller than 1/f of a pixel runs together.
function softenTo(src, f) {
  if (f >= 0.999) return src;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height); softenRGBA(im.data, c.width, c.height, 1 / f); g.putImageData(im, 0, 0);
  return c;
}
// The selected tattoo as an eye sees it close up, across a table, a room and a street: the same
// view each time, with the detail an eye can't make out at that distance run together. The
// project never changes.
async function distanceSheet() {
  const t = sel() && !sel().hidden ? sel() : state.tattoos.find((x) => !x.hidden);
  if (!t) return null;
  const finest = await finestOf(t).catch(() => null), line = finest && distanceText(finest.lineMm, finest.gapMm);
  const oldCur = { ...cur }, oldGoal = { ...goal }, oldGlide = glide, inset = curInset;
  const W = canvas.width, H = canvas.height, side = Math.min(W, H), sx = Math.round((W - side) / 2), sy = Math.round((H - side) / 2);
  const tile = Math.min(side, 1100), pad = Math.round(tile * 0.03), lab = Math.round(tile * 0.085), head = Math.round(tile * 0.14);
  const out = document.createElement('canvas'); out.width = tile * 2 + pad * 3; out.height = head + (tile + lab) * 2 + pad * 2;
  const g = out.getContext('2d'); g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  g.fillStyle = '#f2f2f5'; g.textBaseline = 'middle'; g.textAlign = 'center';
  const shot = document.createElement('canvas'); shot.width = shot.height = tile;
  const shrinks = [];
  try {
    curInset = 0; applyInset();
    // straight at the tattoo, a little wider than for aging so the limb round it shows
    focusTattoo(t); const spot = viewSpot(t), tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    goal.tx = spot.pos[0]; goal.ty = spot.pos[1]; goal.tz = spot.pos[2]; goal.roll = 0;
    goal.r = THREE.MathUtils.clamp((Math.max(t.width, t.width / t.aspect) * 2.6 + 0.08) / (2 * tn * Math.min(1, camera.aspect)), 0.3, 3.2);
    Object.assign(cur, goal); glide = false; applyCam();
    exporting = true; syncDecals();
    poseView.withPosed(() => renderer.render(scene, camera), posedInk());
    shot.getContext('2d').drawImage(canvas, sx, sy, side, side, 0, 0, tile, tile);
    // the real size of one pixel of the tile, on the skin at the tattoo
    const pxMm = (2 * tn * goal.r * Math.min(1, camera.aspect)) * (state.heightCm / 175) * 1000 / tile;
    DISTANCES.forEach((d, i) => {
      const f = shrinkFor(pxMm, d.m); shrinks.push(f);
      const x = pad + (i % 2) * (tile + pad), y = head + Math.floor(i / 2) * (tile + lab + pad);
      g.drawImage(softenTo(shot, f), x, y, tile, tile);
      g.fillStyle = '#f2f2f5'; g.font = `600 ${Math.round(lab * 0.42)}px -apple-system, system-ui, sans-serif`;
      g.fillText(`${d.label}, ${d.ft} (${d.m < 1 ? Math.round(d.m * 100) + ' cm' : d.m + ' m'})`, x + tile / 2, y + tile + lab / 2);
    });
  } finally {
    exporting = false; syncDecals();
    Object.assign(cur, oldCur); Object.assign(goal, oldGoal); glide = oldGlide; curInset = inset; applyInset(); applyCam(); needsRender = true;
  }
  g.fillStyle = '#f2f2f5'; g.font = `600 ${Math.round(head * 0.26)}px -apple-system, system-ui, sans-serif`;
  g.fillText(`How ${t.name || 'this tattoo'} reads from a distance`, out.width / 2, head * 0.32);
  g.fillStyle = '#9a9cab'; g.font = `${Math.round(head * 0.16)}px -apple-system, system-ui, sans-serif`;
  const sub = line ? line.text : 'Detail an eye can’t make out at each distance is run together.';
  wrapCentre(g, sub, out.width / 2, head * 0.66, out.width - pad * 4, head * 0.2);
  distanceLast = { id: t.id, tile, head, lab, pad, shrinks, line: line ? line.text : null, upTo: line ? line.upTo : null };
  return out.toDataURL('image/png');
}
// centred text on at most two lines
function wrapCentre(g, text, x, y, maxW, lh) {
  if (g.measureText(text).width <= maxW) { g.fillText(text, x, y); return; }
  const words = text.split(' '); let a = '';
  for (let i = 0; i < words.length; i++) { const tryA = a ? a + ' ' + words[i] : words[i]; if (g.measureText(tryA).width > maxW && a) { g.fillText(a, x, y - lh / 2); g.fillText(words.slice(i).join(' '), x, y + lh / 2); return; } a = tryA; }
  g.fillText(a, x, y);
}
let distanceLast = null;
/* ---------- If your body changes: the tattoo on a slimmer, heavier and more muscular body ---------- */
// Each tattoo grows and shrinks with the skin under it (its body triangles' area), so the picture
// shows the real thing, not the same sticker on a different body. The body and the tattoos are put
// back exactly as they were afterwards; nothing is stored.
let bodyChangeLast = null;
async function bodyChangeSheet() {
  const t = sel() && !sel().hidden ? sel() : state.tattoos.find((x) => !x.hidden);
  if (!t) return null;
  if (poseView.active) return 'pose';
  const I = bodyGeo.index.array, base = { muscle: state.muscle ?? 0.5, weight: state.weight ?? 0.5 };
  const rawM = state.muscle, rawW = state.weight;
  const A = shapePositions(state);
  const under = (x) => { const d = decals[x.id]; return (d && d.mesh.geometry.userData.tris) || []; };
  syncDecals();
  const tris = Object.fromEntries(state.tattoos.map((x) => [x.id, under(x)]));
  const results = BODY_CHANGES.map((c) => {
    const sh = changedShape(base, c), B = c.key === 'now' ? A : shapePositions({ ...state, ...sh });
    return { ...c, shape: sh, B, growth: skinGrowth(A, B, I, tris[t.id]) };
  });
  const oldCur = { ...cur }, oldGoal = { ...goal }, oldGlide = glide, inset = curInset;
  const saved = state.tattoos.map((x) => ({ pos: [...x.pos], normal: [...x.normal], width: x.width })), an = anchorsNow();
  const W = canvas.width, H = canvas.height, side = Math.min(W, H), sx = Math.round((W - side) / 2), sy = Math.round((H - side) / 2);
  const tile = Math.min(side, 1100), pad = Math.round(tile * 0.03), lab = Math.round(tile * 0.085), head = Math.round(tile * 0.14);
  const out = document.createElement('canvas'); out.width = tile * 2 + pad * 3; out.height = head + (tile + lab) * 2 + pad * 2;
  const g = out.getContext('2d'); g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  const k = state.heightCm / 175, tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  let r0 = 0;
  try {
    curInset = 0; applyInset(); exporting = true;
    results.forEach((res, i) => {
      // the body changed, every tattoo pinned to the same skin and grown with it
      state.muscle = res.shape.muscle; state.weight = res.shape.weight;
      applyShape(); applyAnchors(an);
      state.tattoos.forEach((x, j) => { x.width = saved[j].width * (x.id === t.id ? res.growth : skinGrowth(A, res.B, I, tris[x.id])); });
      syncDecals();
      // the same distance for every tile, so the size change shows; aimed straight at it each time
      focusTattoo(t); const spot = viewSpot(t);
      goal.tx = spot.pos[0]; goal.ty = spot.pos[1]; goal.tz = spot.pos[2]; goal.roll = 0;
      if (!r0) r0 = THREE.MathUtils.clamp((Math.max(t.width, t.width / t.aspect) * 2.4 + 0.1) / (2 * tn * Math.min(1, camera.aspect)), 0.3, 3.2);
      goal.r = r0; Object.assign(cur, goal); glide = false; applyCam();
      renderer.render(scene, camera);
      const x = pad + (i % 2) * (tile + pad), y = head + Math.floor(i / 2) * (tile + lab + pad);
      g.drawImage(canvas, sx, sy, side, side, x, y, tile, tile);
      const wcm = t.width * 100 * k, hcm = wcm / t.aspect;
      res.size = [wcm, hcm];
      g.fillStyle = '#f2f2f5'; g.font = `600 ${Math.round(lab * 0.42)}px -apple-system, system-ui, sans-serif`;
      g.fillText(`${res.label}: ${wcm.toFixed(1)} × ${hcm.toFixed(1)} cm${res.key === 'now' ? '' : ', ' + growthWords(res.growth)}`, x + tile / 2, y + tile + lab / 2);
    });
  } finally {
    state.muscle = rawM; state.weight = rawW; applyShape();
    state.tattoos.forEach((x, j) => { x.pos = saved[j].pos; x.normal = saved[j].normal; x.width = saved[j].width; });
    exporting = false; syncDecals(); renderBody();
    Object.assign(cur, oldCur); Object.assign(goal, oldGoal); glide = oldGlide; curInset = inset; applyInset(); applyCam(); needsRender = true;
  }
  const line = changeLine(results.filter((r) => r.key !== 'now'));
  g.fillStyle = '#f2f2f5'; g.font = `600 ${Math.round(head * 0.26)}px -apple-system, system-ui, sans-serif`;
  g.fillText(`${t.name || 'This tattoo'} if your body changes`, out.width / 2, head * 0.32);
  g.fillStyle = '#9a9cab'; g.font = `${Math.round(head * 0.16)}px -apple-system, system-ui, sans-serif`;
  wrapCentre(g, line, out.width / 2, head * 0.66, out.width - pad * 4, head * 0.2);
  bodyChangeLast = { id: t.id, tile, head, lab, pad, line, results: results.map((r) => ({ key: r.key, growth: r.growth, size: r.size })) };
  return out.toDataURL('image/png');
}
/* ---------- Sleeve map: each arm and leg's skin laid flat, with the tattoos on it ---------- */
const LIMBS = [
  { key: 'armL', label: 'Left arm', side: 'L', bones: ['upperarm01', 'lowerarm01', 'wrist'], keep: /^(upperarm|lowerarm)0[12]\.L$/, end: /^(wrist|metacarpal|finger|thumb)[^.]*\.L$/, joint: 'Elbow' },
  { key: 'armR', label: 'Right arm', side: 'R', bones: ['upperarm01', 'lowerarm01', 'wrist'], keep: /^(upperarm|lowerarm)0[12]\.R$/, end: /^(wrist|metacarpal|finger|thumb)[^.]*\.R$/, joint: 'Elbow' },
  { key: 'legL', label: 'Left leg', side: 'L', bones: ['upperleg01', 'lowerleg01', 'foot'], keep: /^(upperleg|lowerleg)0[12]\.L$/, end: /^(foot|toe)[^.]*\.L$/, joint: 'Knee' },
  { key: 'legR', label: 'Right leg', side: 'R', bones: ['upperleg01', 'lowerleg01', 'foot'], keep: /^(upperleg|lowerleg)0[12]\.R$/, end: /^(foot|toe)[^.]*\.R$/, joint: 'Knee' },
];
function limbUnrolled(L) {
  const geo = bodyGeo, P = (geo.attributes.rest || geo.attributes.position).array, J = poseView.restRig().joints;
  const at = (n) => { const b = POSE_BONES.find((x) => x.name === `${n}.${L.side}`); return [0, 1, 2].map((i) => J[b.head * 3 + i]); };
  const top = (v) => { let best = '', w = -1; for (const [n, x] of vertexBones(v)) if (x > w) { w = x; best = n; } return best; };
  return unrollLimb({ pos: P, count: COUNTS.body, joints: L.bones.map(at), keep: (v) => L.keep.test(top(v)), outward: [L.side === 'L' ? 1 : -1, 0, 0], trim: true });
}
// Draw one limb's map: skin, then each visible tattoo's triangles multiplied over it, the same way
// the skin picture for Procreate is made. Returns a canvas with the background left clear.
function limbPicture(m, pxPerUnit) {
  const b = mapBounds(m), W = Math.ceil(b.half * 2 * pxPerUnit) + 4, H = Math.ceil(b.length * pxPerUnit) + 4;
  const scene = new THREE.Scene(), owned = [];
  const camera = new THREE.OrthographicCamera(-W / 2 / pxPerUnit, W / 2 / pxPerUnit, 2 / pxPerUnit, -(H - 2) / pxPerUnit, -1, 1);
  const add = (pos, material, order, uvs) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const mesh = new THREE.Mesh(g, material); mesh.renderOrder = order; mesh.frustumCulled = false; scene.add(mesh); owned.push(g, material);
  };
  // across the map is mirrored so the map reads as seen from the outside of the limb
  const put = (out, tri) => { for (const [x, y] of tri) out.push(-x, -y, 0); };
  const I = bodyGeo.index.array, triN = I.length / 3, skin = [];
  for (let t = 0; t < triN; t++) for (const tri of mapTriangle(m, I[t * 3], I[t * 3 + 1], I[t * 3 + 2])) put(skin, tri);
  add(skin, new THREE.MeshBasicMaterial({ color: new THREE.Color(skinColor()), side: THREE.DoubleSide, toneMapped: false }), 0);
  let inked = 0; const labels = [];
  state.tattoos.forEach((t, order) => {
    const d = decals[t.id]; if (t.hidden || !d || !d.tex) return;
    const tris = d.mesh.geometry.userData.tris, uv = d.mesh.geometry.getAttribute('uv'); if (!tris || !uv) return;
    const pos = [], tex = [];
    for (let k = 0; k < tris.length; k++) {
      const tt = tris[k]; if (tt >= triN) continue;
      for (const tri of mapTriangle(m, I[tt * 3], I[tt * 3 + 1], I[tt * 3 + 2])) { put(pos, tri); for (let j = 0; j < 3; j++) tex.push(uv.getX(k * 3 + j), uv.getY(k * 3 + j)); }
    }
    if (!pos.length) return;
    const mat = d.mesh.material.clone(); mat.side = THREE.DoubleSide; mat.depthTest = false; mat.polygonOffset = false;
    mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.ZeroFactor; mat.blendDst = THREE.SrcColorFactor; mat.blendSrcAlpha = THREE.ZeroFactor; mat.blendDstAlpha = THREE.OneFactor;
    add(pos, mat, 10 + order, tex); inked++;
    // where to write its name: under the middle of its ink (median across, lowest point down)
    const xs = [], ys = []; for (let i = 0; i < pos.length; i += 3) { xs.push(pos[i] * pxPerUnit + W / 2); ys.push(2 - pos[i + 1] * pxPerUnit); }
    xs.sort((a, b) => a - b);
    labels.push({ id: t.id, name: t.name || 'Tattoo', x: xs[xs.length >> 1], y: Math.max(...ys), w: t.width });
  });
  const target = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.SRGBColorSpace, depthBuffer: false, samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const prevTarget = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha(), prevScissor = renderer.getScissorTest();
  renderer.getClearColor(prevColor);
  const raw = new Uint8Array(W * H * 4);
  try {
    renderer.setScissorTest(false); renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, W, H, raw);
  } finally {
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha); renderer.setScissorTest(prevScissor);
    target.dispose(); for (const o of owned) o.dispose();
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const im = new ImageData(W, H), row = W * 4;
  for (let y = 0; y < H; y++) im.data.set(raw.subarray((H - 1 - y) * row, (H - y) * row), y * row);
  c.getContext('2d').putImageData(im, 0, 0);
  return { canvas: c, W, H, inked, labels, half: b.half, length: b.length };
}
function sleeveMap() {
  if (!bodyGeo.index) return null;
  syncDecals();
  const k = state.heightCm / 175, unitsPerCm = 1 / (k * 100), px = 1400;
  const maps = LIMBS.map((L) => { const m = limbUnrolled(L); const pic = limbPicture(m, px); return { L, m, ...pic }; });
  const pad = 60, head = 260, foot = 70, gap = 80;
  const out = document.createElement('canvas');
  out.width = pad * 2 + maps.reduce((a, x) => a + x.W, 0) + gap * (maps.length - 1); out.height = head + Math.max(...maps.map((x) => x.H)) + foot + pad;
  const g = out.getContext('2d'); g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  const step = 5 * unitsPerCm * px; // grid every 5 cm
  let x0 = pad;
  for (const mp of maps) {
    const { canvas: c, W, H } = mp;
    // a 5 cm grid on the skin only
    const grid = document.createElement('canvas'); grid.width = W; grid.height = H; const gg = grid.getContext('2d');
    gg.strokeStyle = 'rgba(40,40,60,0.18)'; gg.lineWidth = 1.5;
    for (let x = W / 2 % step; x < W; x += step) { gg.beginPath(); gg.moveTo(x, 0); gg.lineTo(x, H); gg.stroke(); }
    for (let y = 2; y < H; y += step) { gg.beginPath(); gg.moveTo(0, y); gg.lineTo(W, y); gg.stroke(); }
    gg.globalCompositeOperation = 'destination-in'; gg.drawImage(c, 0, 0);
    g.drawImage(c, x0, head); g.drawImage(grid, x0, head);
    // the elbow or knee
    const jy = head + 2 + jointDown(mp.L) * px;
    g.setLineDash([8, 8]); g.strokeStyle = 'rgba(242,242,245,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 - 10, jy); g.lineTo(x0 + W + 10, jy); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#9a9cab'; g.font = '22px -apple-system, system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(mp.L.joint, x0, jy - 6);
    // names and which way round
    g.fillStyle = '#f2f2f5'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 30px -apple-system, system-ui, sans-serif';
    g.fillText(mp.L.label, x0 + W / 2, head - 70);
    g.fillStyle = '#9a9cab'; g.font = '20px -apple-system, system-ui, sans-serif';
    const [l, r] = mp.L.side === 'L' ? ['Front', 'Back'] : ['Back', 'Front'];
    g.textAlign = 'left'; g.fillText(l, x0, head - 28); g.textAlign = 'center'; g.fillText('Outside', x0 + W / 2, head - 28); g.textAlign = 'right'; g.fillText(r, x0 + W, head - 28);
    g.textAlign = 'center'; g.fillText('Inside edges meet', x0 + W / 2, head + H + 26);
    // each tattoo's name and size under it, kept inside this limb's column
    for (const lb of mp.labels) {
      const t = state.tattoos.find((x) => x.id === lb.id), wcm = t.width * 100 * k, hcm = wcm / t.aspect;
      const text = `${lb.name}  ${wcm.toFixed(0)} × ${hcm.toFixed(0)} cm`;
      g.font = '600 20px -apple-system, system-ui, sans-serif'; const tw = g.measureText(text).width + 20;
      const cx = Math.min(x0 + W - tw / 2, Math.max(x0 + tw / 2, x0 + lb.x)), cy = Math.min(head + H - 18, head + lb.y + 24);
      g.fillStyle = 'rgba(22,23,28,0.82)'; g.beginPath(); g.roundRect(cx - tw / 2, cy - 16, tw, 32, 16); g.fill();
      g.fillStyle = '#f2f2f5'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cx, cy);
    }
    x0 += W + gap;
  }
  g.fillStyle = '#f2f2f5'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 40px -apple-system, system-ui, sans-serif';
  g.fillText('Arms and legs, unrolled', out.width / 2, 56);
  g.fillStyle = '#9a9cab'; g.font = '22px -apple-system, system-ui, sans-serif';
  g.fillText('Each limb’s skin laid flat, cut along the inside, as seen from the outside. Grid squares are 5 cm (about 2 in).', out.width / 2, 104);
  sleeveLast = { maps: maps.map((x) => ({ key: x.L.key, W: x.W, H: x.H, inked: x.inked, labels: x.labels.map((l) => l.name), lengthCm: x.length / unitsPerCm, roundCm: typicalRound(x.m) / unitsPerCm })), head, pad, gap, w: out.width, h: out.height };
  return out.toDataURL('image/png');
}
function jointDown(L) {
  const J = poseView.restRig().joints, at = (n) => { const b = POSE_BONES.find((x) => x.name === `${n}.${L.side}`); return [0, 1, 2].map((i) => J[b.head * 3 + i]); };
  const a = at(L.bones[0]), b = at(L.bones[1]); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
let sleeveLast = null;
// The selected tattoo at three sizes on the body, side by side: a size smaller, as it is now and
// a size bigger, each labelled with its real width, to choose between or send to the artist.
// The tattoo itself never changes.
function sizeSteps(wIn) {
  const half = (v) => Math.max(0.5, Math.round(v * 2) / 2);
  let a = half(wIn * 0.72), b = half(wIn * 1.35);
  if (a >= wIn - 0.2) a = Math.max(0.5, half(wIn - 0.5)); if (b <= wIn + 0.2) b = half(wIn + 0.5);
  return a < wIn - 0.2 ? [a, wIn, b] : [wIn, b, half(b * 1.3)];
}
function sizesSheet() {
  const t = sel() && !sel().hidden ? sel() : state.tattoos.find((x) => !x.hidden);
  if (!t) return null;
  const k = state.heightCm / 175, toIn = (w) => w * 100 * k / 2.54, fromIn = (i) => i * 2.54 / 100 / k;
  const nowIn = toIn(t.width), sizes = sizeSteps(nowIn), w0 = t.width;
  const oldCur = { ...cur }, oldGoal = { ...goal }, oldGlide = glide, inset = curInset;
  const W = canvas.width, H = canvas.height, side = Math.min(W, H), sx = Math.round((W - side) / 2), sy = Math.round((H - side) / 2);
  const tile = Math.min(side, 900), pad = Math.round(tile * 0.03), lab = Math.round(tile * 0.13), head = Math.round(tile * 0.15);
  const out = document.createElement('canvas'); out.width = tile * 3 + pad * 4; out.height = head + tile + lab + pad;
  const g = out.getContext('2d'); g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  try {
    curInset = 0; applyInset();
    // the same view for all three, framed round the biggest
    focusTattoo(t); const spot = viewSpot(t), tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), big = fromIn(Math.max(...sizes));
    goal.tx = spot.pos[0]; goal.ty = spot.pos[1]; goal.tz = spot.pos[2]; goal.roll = 0;
    goal.r = THREE.MathUtils.clamp((Math.max(big, big / t.aspect) * 1.6 + 0.08) / (2 * tn * Math.min(1, camera.aspect)), 0.3, 3.4);
    Object.assign(cur, goal); glide = false; applyCam();
    exporting = true;
    sizes.forEach((inch, i) => {
      t.width = Math.abs(inch - nowIn) < 0.01 ? w0 : fromIn(inch); syncDecals();
      poseView.withPosed(() => renderer.render(scene, camera), posedInk());
      const x = pad + i * (tile + pad), y = head, now = Math.abs(inch - nowIn) < 0.01;
      g.drawImage(canvas, sx, sy, side, side, x, y, tile, tile);
      if (now) { g.strokeStyle = '#8b7bff'; g.lineWidth = Math.max(4, tile * 0.008); g.strokeRect(x + g.lineWidth / 2, y + g.lineWidth / 2, tile - g.lineWidth, tile - g.lineWidth); }
      const inTxt = inch < 10 ? (Math.round(inch * 10) / 10).toString() : Math.round(inch).toString(), cm = inch * 2.54;
      g.fillStyle = '#f2f2f5'; g.font = `600 ${Math.round(lab * 0.36)}px -apple-system, system-ui, sans-serif`;
      g.fillText(`${inTxt} in wide (${cm < 10 ? cm.toFixed(1) : Math.round(cm)} cm)`, x + tile / 2, y + tile + lab * 0.36);
      g.fillStyle = now ? '#b3a9ff' : '#9a9cab'; g.font = `${Math.round(lab * 0.26)}px -apple-system, system-ui, sans-serif`;
      g.fillText(now ? 'As it is now' : inch < nowIn ? 'Smaller' : 'Bigger', x + tile / 2, y + tile + lab * 0.74);
    });
  } finally {
    t.width = w0; exporting = false; syncDecals();
    Object.assign(cur, oldCur); Object.assign(goal, oldGoal); glide = oldGlide; curInset = inset; applyInset(); applyCam(); needsRender = true;
  }
  g.fillStyle = '#f2f2f5'; g.font = `600 ${Math.round(head * 0.3)}px -apple-system, system-ui, sans-serif`;
  g.fillText(`${t.name || 'This tattoo'} at three sizes`, out.width / 2, head * 0.42);
  g.fillStyle = '#9a9cab'; g.font = `${Math.round(head * 0.19)}px -apple-system, system-ui, sans-serif`;
  const hInch = state.heightCm / 2.54;
  g.fillText(`On a body ${Math.floor(hInch / 12)} ft ${Math.round(hInch % 12)} in tall. Widths are across the skin.`, out.width / 2, head * 0.78);
  sizesLast = { tile, pad, head, lab, id: t.id, sizes };
  return out.toDataURL('image/png');
}
let sizesLast = null;
// The tattoo in four poses, as one picture: standing, then three poses that move the skin under
// it (an arm tattoo gets that arm flexed, overhead and forward; a leg tattoo a knee lift, a
// squat and a stride; a torso tattoo arms overhead, a turn and a stretch). The live pose, view
// and motion come back exactly as they were.
function posesPicked(t) {
  const tri = startTriangle(t), I = bodyGeo.index.array, sum = new Map();
  for (let j = 0; j < 3; j++) for (const [n, w] of vertexBones(I[tri * 3 + j])) sum.set(n, (sum.get(n) || 0) + w);
  return posesFor([...sum], t.normal[2] >= 0);
}
// A camera direction that sees the spot with nothing of the body in front of it: as square to the
// skin as it can be, a little from above or below at most, and never through the head or an arm.
function clearView(spot, r) {
  const n = new V3(...spot.normal).normalize(), at = new V3(...spot.pos), dir = new V3(), from = new V3();
  let best = null;
  poseView.withPosed(() => {
    for (const phi of [1.57, 1.3, 1.85, 1.05, 2.05]) for (let k = 0; k < 24; k++) {
      const theta = k / 24 * Math.PI * 2, s = Math.sin(phi);
      dir.set(s * Math.sin(theta), Math.cos(phi), s * Math.cos(theta));
      const facing = dir.dot(n); if (facing < 0.25) continue;
      const score = facing - Math.abs(phi - 1.57) * 0.15;
      if (best && score <= best.score) continue;
      from.copy(at).addScaledVector(dir, r); ray.set(from, dir.clone().negate()); ray.far = r + 0.02;
      const h = ray.intersectObject(body, false)[0];
      if (h && h.distance < r - 0.015) continue; // something is in the way
      best = { score, theta, phi };
    }
  });
  ray.far = Infinity;
  return best ? { theta: best.theta, phi: best.phi } : {};
}
function posesSheet() {
  const t = sel() && !sel().hidden ? sel() : state.tattoos.find((x) => !x.hidden);
  if (!t) return null;
  const pick = posesPicked(t);
  const oldCur = { ...cur }, oldGoal = { ...goal }, oldGlide = glide, inset = curInset, pose = poseView.snapshot();
  const W = canvas.width, H = canvas.height, side = Math.min(W, H), sx = Math.round((W - side) / 2), sy = Math.round((H - side) / 2);
  const tile = Math.min(side, 1100), pad = Math.round(tile * 0.03), lab = Math.round(tile * 0.085), head = Math.round(tile * 0.12);
  const out = document.createElement('canvas'); out.width = tile * 2 + pad * 3; out.height = head + (tile + lab) * 2 + pad * 2;
  const g = out.getContext('2d'); g.fillStyle = '#16171c'; g.fillRect(0, 0, out.width, out.height);
  g.fillStyle = '#f2f2f5'; g.textBaseline = 'middle'; g.textAlign = 'center';
  const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  try {
    curInset = 0; applyInset(); exporting = true; syncDecals();
    pick.keys.forEach((k, i) => {
      poseView.showNow(k);
      // straight at the tattoo where this pose puts it, with enough body round it to see the pose
      focusTattoo(t); const spot = viewSpot(t);
      goal.tx = spot.pos[0]; goal.ty = spot.pos[1]; goal.tz = spot.pos[2]; goal.roll = 0;
      goal.r = THREE.MathUtils.clamp((Math.max(t.width, t.width / t.aspect) * 4 + 0.36) / (2 * tn * Math.min(1, camera.aspect)), 0.7, 3.2);
      Object.assign(goal, clearView(spot, goal.r));
      Object.assign(cur, goal); glide = false; applyCam();
      poseView.withPosed(() => renderer.render(scene, camera), posedInk());
      const x = pad + (i % 2) * (tile + pad), y = head + Math.floor(i / 2) * (tile + lab + pad);
      g.drawImage(canvas, sx, sy, side, side, x, y, tile, tile);
      g.font = `600 ${Math.round(lab * 0.42)}px -apple-system, system-ui, sans-serif`;
      g.fillText(POSE_CATALOG[k].label, x + tile / 2, y + tile + lab / 2);
    });
  } finally {
    exporting = false; poseView.restore(pose); syncDecals();
    Object.assign(cur, oldCur); Object.assign(goal, oldGoal); glide = oldGlide; curInset = inset; applyInset(); applyCam(); needsRender = true;
    if (typeof renderPose === 'function') renderPose();
  }
  g.font = `600 ${Math.round(head * 0.3)}px -apple-system, system-ui, sans-serif`;
  g.fillText(`${t.name || 'This tattoo'} as you move`, out.width / 2, head * 0.42);
  g.fillStyle = '#9a9cab'; g.font = `${Math.round(head * 0.19)}px -apple-system, system-ui, sans-serif`;
  g.fillText('How it stretches and turns with the body.', out.width / 2, head * 0.78);
  posesLast = { tile, pad, head, lab, id: t.id, keys: pick.keys, region: pick.region };
  return out.toDataURL('image/png');
}
let posesLast = null;
function artistPacket() {
  const oldCur = {...cur}, oldGoal = {...goal}, oldGlide = glide, oldSolo = soloIds;
  const views = [];
  try {
    soloIds = null;
    for (const [label, theta] of [['Front',0],['Right',Math.PI/2],['Back',Math.PI],['Left',-Math.PI/2]]) {
      fullBody(theta); Object.assign(cur, goal); applyCam();
      views.push({label,dataUrl:shot(false)});
    }
    return makeArtistPacket({name:state.projectName || 'My tattoo plan',heightCm:state.heightCm,views,tattoos:state.tattoos,images,artworks:state.artworks || {},notes:state.notes || '',drawings:state.drawings || [],bodySurface:{positions:bodyGeo.attributes.position.array,index:bodyGeo.index.array}});
  } finally {
    Object.assign(cur,oldCur); Object.assign(goal,oldGoal); glide=oldGlide; soloIds=oldSolo;
    applyCam(); syncDecals(); needsRender=true;
  }
}
function planningPreview() {
  shot(false);
  const preview=document.createElement('canvas'); const scale=Math.min(1,640/canvas.width,640/canvas.height);
  preview.width=Math.max(1,Math.round(canvas.width*scale));preview.height=Math.max(1,Math.round(canvas.height*scale));
  preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);
  return preview.toDataURL('image/jpeg',.8);
}
async function artistSheet() {
  const view = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = shot(false); });
  const c = document.createElement('canvas'); c.width = 1800; c.height = 1300; const g = c.getContext('2d');
  g.fillStyle = '#fbfaf8'; g.fillRect(0, 0, c.width, c.height);
  const bx = 50, by = 50, bw = 980, bh = 1200; const s = Math.max(bw / view.width, bh / view.height); const sw = bw / s, sh = bh / s;
  g.drawImage(view, (view.width - sw) / 2, (view.height - sh) / 2, sw, sh, bx, by, bw, bh);
  g.fillStyle = '#17181d'; g.font = '600 46px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText('Ink Atlas placement sheet', 1080, 104);
  g.font = '24px Figtree, system-ui, sans-serif'; g.fillStyle = '#5b6070';
  const inch = state.heightCm / 2.54; g.fillText(`${new Date().toLocaleDateString()}  ·  body height ${Math.floor(inch / 12)} ft ${Math.round(inch % 12)} in`, 1080, 146);
  let y = 200; const list = state.tattoos.filter((t) => !t.hidden).slice(0, 7);
  for (const t of list) {
    g.fillStyle = '#fff'; g.strokeStyle = '#dcd9d2'; g.lineWidth = 2; g.fillRect(1080, y, 130, 130); g.strokeRect(1080, y, 130, 130);
    const im = imgEls[t.img]; if (im) { const k = Math.min(114 / im.naturalWidth, 114 / im.naturalHeight); g.drawImage(im, 1145 - im.naturalWidth * k / 2, y + 65 - im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); }
    g.fillStyle = '#17181d'; g.font = '600 28px Figtree, system-ui, sans-serif'; g.fillText(t.name.slice(0, 30), 1236, y + 50);
    g.fillStyle = '#5b6070'; g.font = '23px Figtree, system-ui, sans-serif'; g.fillText(sizeText(t).replace(/\s+/g, ' '), 1236, y + 90);
    const extra = t.status === 'existing' ? madeText(t.made) : (t.note || '').replace(/\s+/g, ' ');
    if (extra) { g.font = 'italic 21px Figtree, system-ui, sans-serif'; let e = extra; while (e.length > 4 && g.measureText(e).width > 500) e = e.slice(0, -2); if (e !== extra) e = e.replace(/\s*\S*$/, '') + '…'; g.fillText(e, 1236, y + 124); }
    y += 152;
  }
  g.fillStyle = '#8a8f9c'; g.font = '20px Figtree, system-ui, sans-serif'; g.fillText('Sizes are approximate. Confirm scale on skin with your artist.', 1080, 1250);
  return c.toDataURL('image/png');
}
let previewFile = null;
function showPreview(url, filename, title) {
  previewFile = { url, filename }; $('#pvImg').src = url; $('#pvTitle').textContent = title;
  $('#pvSave').hidden = false;
  $('#pvNote').textContent = canShareFiles()
    ? 'Save opens the share sheet to send it or keep it in Files. You can also touch and hold the picture to copy or share it.'
    : 'Save downloads the picture. You can also touch and hold it to save, copy or share it.';
  toggle('#planMenu', false); toggle('#share', false); toggle('#preview', true);
}
async function saveFile(filename, data) {
  try {
    const r = await shareOrDownload(filename, data);
    if (r === 'shared') toast('Shared ' + filename);
    else if (r === 'downloaded') toast('Saved ' + filename + ' to your downloads');
  } catch (err) { toast('Could not save: ' + ((err && err.message) || 'something went wrong')); }
}
$('#pvSave').addEventListener('click', () => { if (previewFile) saveFile(previewFile.filename, dataUrlBlob(previewFile.url)); });
$('#cView').addEventListener('click', () => showPreview(shot(false), 'ink-atlas-view.png', 'Picture of this view'));
$('#cPoses').addEventListener('click', () => { const url = posesSheet(); if (!url) { toast('Add a tattoo first, then try this.'); return; } markTried('poses-sheet'); showPreview(url, 'ink-atlas-poses.png', 'As you move'); });
// the plan as a message: every planned tattoo in a few lines, for a text to the artist
function planMessageText() {
  const k = (state.heightCm || 175) / 175, size = (t) => { const w = t.width * 100 * k, h = w / t.aspect; return `${(w / 2.54).toFixed(1)} × ${(h / 2.54).toFixed(1)} in (${w.toFixed(0)} × ${h.toFixed(0)} cm)`; };
  const shown = state.tattoos.filter((t) => !t.hidden);
  const planned = shown.filter((t) => t.status !== 'existing').map((t) => {
    const w = whereOf(t), hrs = hoursOf(t), plan = t.sittings && t.sittings.start ? sitPlan(t) : null;
    return { name: t.name, size: size(t), where: w ? w.line : '', time: hrs ? sessionText(hrs, 0) : '', first: plan && plan.sittings[0].date ? dayWords(plan.sittings[0].date) : '', note: t.note || '' };
  });
  const onMe = shown.filter((t) => t.status === 'existing').map((t) => { const w = whereOf(t); return { name: t.name, where: w ? w.where : '' }; });
  return planMessage(planned, onMe);
}
$('#cMessage').addEventListener('click', async () => {
  const text = planMessageText(); if (!text) { toast('Mark a tattoo as planned first, then try this.'); return; }
  markTried('message');
  if (navigator.share && (!navigator.canShare || navigator.canShare({ text }))) {
    try { await navigator.share({ text }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into a message to your artist.'); return; } catch {}
  await shareOrDownload('tattoo-plan.txt', new Blob([text], { type: 'text/plain' })); toast('Saved as a text file.');
});
$('#cSizes').addEventListener('click', () => { const url = sizesSheet(); if (!url) { toast('Add a tattoo first, then try this.'); return; } markTried('sizes-sheet'); showPreview(url, 'ink-atlas-sizes.png', 'Three sizes'); });
$('#cSleeve').addEventListener('click', () => { const url = sleeveMap(); if (!url) { toast('The map could not be made just now.'); return; } markTried('sleeve'); showPreview(url, 'ink-atlas-arms-and-legs.png', 'Arms and legs, unrolled'); });
$('#cBodyChange').addEventListener('click', async () => { const url = await bodyChangeSheet(); if (url === 'pose') { toast('Turn off the pose first, then try this picture.'); return; } if (!url) { toast('Add a tattoo first.'); return; } markTried('bodyChange'); showPreview(url, 'ink-atlas-if-your-body-changes.png', 'If your body changes'); });
$('#cDistance').addEventListener('click', async () => { const url = await distanceSheet(); if (!url) { toast('Add a tattoo first, then try this.'); return; } markTried('distance'); showPreview(url, 'ink-atlas-distance.png', 'From a distance'); });
$('#cAging').addEventListener('click', () => { const url = agingSheet(); if (!url) { toast('Add a tattoo first, then try this.'); return; } markTried('aging-sheet'); showPreview(url, 'ink-atlas-aging.png', 'How it may age'); });
$('#cLabels').addEventListener('click', () => { const url = labelsShot(); if (url === null) { toast('Add a tattoo first, then try this.'); return; } if (!url) { toast('Turn the body so a tattoo faces you, then try this.'); return; } markTried('labels'); showPreview(url, 'ink-atlas-sizes-labelled.png', 'Picture with sizes'); });
$('#cMirror').addEventListener('click', () => { const url = mirrorShot(); if (!url) { toast('Add a tattoo first.'); return; } markTried('mirror'); showPreview(url, 'ink-atlas-mirror.png', 'In a mirror'); });
$('#cCompare').addEventListener('click', () => { const url = compareShot(); if (!url) { toast('Mark a tattoo as planned to see before and after.'); return; } markTried('compare-shot'); showPreview(url, 'ink-atlas-before-after.png', 'Before and after'); });
$('#cSheet').addEventListener('click', async () => showPreview(await artistSheet(), 'ink-atlas-artist-sheet.png', 'Artist sheet'));
// Procreate colour palette: skin tone, its shade and highlight, then the project's ink colours.
// Built when the Share sheet opens, so the tap hands the file straight to the share sheet.
let paletteReady = null;
async function buildPalette() {
  const pics = [];
  for (const key of new Set(state.tattoos.filter((t) => !t.hidden).map((t) => t.img))) {
    const src = images[key]; if (!src) continue;
    try {
      const im = new Image(); im.src = src; await im.decode();
      const k = Math.min(1, 160 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, c.width, c.height); pics.push(g.getImageData(0, 0, c.width, c.height).data);
    } catch (_) { /* a picture that will not open adds no colours */ }
  }
  const colours = [...skinSet(skinColor()), ...inkColours(pics, { max: 12 })];
  const name = 'Ink Atlas ' + (state.projectName || 'My tattoos');
  return { name, colours, blob: swatchesFile(name, colours), file: (state.projectName || 'Ink Atlas').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) + ' colours.swatches' };
}
$('#cSwatches').addEventListener('click', async () => {
  markTried('palette');
  const p = await (paletteReady || (paletteReady = buildPalette()));
  toggle('#share', false); paletteReady = null;
  await saveFile(p.file, p.blob);
});
$('#cPacket').addEventListener('click', () => { const html=artistPacket(); toggle('#share',false); saveFile('ink-atlas-artist-packet.html',new Blob([html],{type:'text/html'})); });
function bodySignature(){return JSON.stringify([state.figure,state.muscle,state.weight,Object.keys(state.fit||{}).sort().map(k=>[k,state.fit[k]]),state.genitals,state.heightCm]);}
async function sketchPatch() {
  cancelGesture();toggle('#share',false);
  let geometry;
  try {const {createPatchGuide,openPatchExchange}=await import('./procreate-patch.js');
    let pending=state.sketchPatch;
    if(!pending){const selected=sel();const choices=[{id:'view',name:'Current view',spot:viewCenterSpot(),width:.18}];
      if(selected)choices.unshift({id:'selected',name:'Selected tattoo area',spot:selected,width:selected.width,rot:selected.rot,wrap:selected.wrap});
      for(const [id,name,o,d,width] of [['chest','Front chest',[0,1.3,2],[0,0,-1],.22],['back','Upper back',[0,1.3,-2],[0,0,1],.22],['arm','Upper arm',[2,1.13,.04],[-1,0,0],.11],['forearm','Forearm',[2,.95,.04],[-1,0,0],.10],['thigh','Front thigh',[.1,.52,2],[0,0,-1],.16]])choices.push({id,name,spot:surfaceAt(new V3(...o),new V3(...d)),width});
      const {choosePatchArea}=await import('./procreate-patch.js');const id=await choosePatchArea(choices.map(c=>({id:c.id,name:c.name,disabled:!c.spot})));if(!id)return;const choice=choices.find(c=>c.id===id),spot=choice.spot;
      const patch={pos:[...spot.pos],normal:[...spot.normal],width:choice.width,aspect:1,rot:choice.rot || 0,wrap:choice.wrap || 0,bend:0,taper:0};
      const shape=bodySignature();
      geometry=decalGeometry(patch);
      const guide=await createPatchGuide({positions:geometry.attributes.position.array,uvs:Float32Array.from(geometry.attributes.uv.array,v=>(v-UV_MARGIN)/(1-2*UV_MARGIN)),label:choice.name,widthCm:patch.width*100*state.heightCm/175});
      const {makePatchReference}=await import('./patch-reference.js');const existingInk=makePatchReference(geometry,state.tattoos.filter(t=>t.status==='existing'&&!t.hidden).map(t=>decals[t.id]).filter(d=>d&&d.tex).map(d=>({geometry:d.mesh.geometry,texture:d.tex})),UV_MARGIN);
      pending={id:uid(),patch,shape,guide:guide.dataUrl,maskTriangles:guide.maskTriangles,existingInk};snapshot();state.sketchPatch=pending;commit();await flushSave();
    }
    const pendingId=pending.id;
    await openPatchExchange({guide:pending.guide,existingInk:pending.existingInk,maskTriangles:pending.maskTriangles,onDiscard:()=>{
      if(state.sketchPatch?.id!==pendingId)throw new Error('The pending patch changed. Reopen to review it.');snapshot();delete state.sketchPatch;commit();
    },onApply:async result=>{
      if(state.sketchPatch?.id!==pendingId)throw new Error('The pending patch changed. Reopen to review it.');
      if(bodySignature()!==pending.shape)throw new Error('The body changed. Restore its earlier shape, or discard this guide and create a fresh patch.');
      snapshot();const t=await addImage(result.dataUrl,'Procreate patch',pending.patch);if(!t)throw new Error('The returned artwork could not be added.');t.status='planned';selectedId=t.id;delete state.sketchPatch;commit();focusTattoo(t);toast('Returned artwork added as a new planned tattoo.');
    }});
  }catch(e){toast('Could not open sketch patch: '+e.message);}finally{geometry?.dispose();}
}
$('#cSketch').addEventListener('click',sketchPatch);
$('#cBlank').addEventListener('click', () => showPreview(shot(true), 'ink-atlas-blank-body.png', 'Blank body to sketch on'));
$('#cGlb').addEventListener('click',async()=>{
 toggle('#share',false);try{const {exportSceneGlb}=await import('./three-export.js');const result=await exportSceneGlb(previewInput());await saveFile('ink-atlas-neutral-model.glb',result.blob);}catch(e){toast('Could not export 3D model: '+e.message);}
});
$('#cObj').addEventListener('click',async()=>{toggle('#share',false);try{const {exportSceneObjPackage}=await import('./obj-export.js');const result=await exportSceneObjPackage(previewInput());await saveFile('ink-atlas-neutral-obj.zip',result.blob);}catch(e){toast('Could not export OBJ package: '+e.message);}});
// Tattoos painted into one skin texture on the body's own UVs (src/uv-bake.js).
async function exportPainted(kind) {
  toggle('#share', false);
  const visible = state.tattoos.filter((t) => !t.hidden && decals[t.id] && decals[t.id].tex);
  toast(kind === 'usdz' ? 'Making the 3D body for Procreate. This takes a few seconds.' : 'Painting your tattoos onto the skin. This takes a few seconds.');
  try {
    syncDecals();
    const { exportPaintedModel } = await import('./uv-bake.js');
    const result = await exportPaintedModel({ THREE, renderer, bodyGeometry: bodyGeo, skinColor: skinMat.color, decals: visible.map((t) => ({ geometry: decals[t.id].mesh.geometry, material: decals[t.id].mesh.material })), state, kind, paint: await paintPicture() });
    window.__lastPainted = { kind, bytes: result.blob.size, size: result.size, inked: result.inked, paint: !!(state.paint && !state.paint.hidden) };
    await saveFile(result.name, result.blob);
  } catch (e) { toast('Could not make the 3D model: ' + ((e && e.message) || 'something went wrong')); }
  finally { needsRender = true; }
}
// The 3D body with each tattoo as its own part and material (src/layered-model.js), so
// Procreate shows the skin and every tattoo as separate, named texture sets in Layers.
async function exportLayered() {
  toggle('#share', false); toggle('#pcMenu', false);
  const visible = state.tattoos.filter((t) => !t.hidden && decals[t.id] && decals[t.id].tex);
  toast(visible.length ? 'Making the 3D body with each tattoo separate. This takes a few seconds.' : 'No tattoos showing, so this is the plain body. Making it now.');
  try {
    syncDecals();
    const { exportLayeredModel } = await import('./layered-model.js');
    const result = await exportLayeredModel({ THREE, renderer, bodyGeometry: bodyGeo, skinColor: skinMat.color, tattoos: visible.map((t) => ({ name: t.name || 'Tattoo', aspect: t.aspect, geometry: decals[t.id].mesh.geometry, material: decals[t.id].mesh.material })), state, paint: await paintPicture() });
    window.__lastLayered = { bytes: result.blob.size, size: result.size, parts: result.parts };
    await saveFile(result.name, result.blob);
    markTried('layers3d');
  } catch (e) { toast('Could not make the 3D model: ' + ((e && e.message) || 'something went wrong')); }
  finally { needsRender = true; }
}
// Back from Procreate: a painted model (USDZ, OBJ in a ZIP, or its skin picture) made
// from the 3D body sent from here. By default the paint comes back as paint on the body
// (bringBackPainted); it can also be turned into movable tattoos (importPainted, paintToTattoos).
const PAINT_SIZE = 2048;
function shrinkTo(src, S) { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, S, S); const d = g.getImageData(0, 0, S, S).data; c.width = c.height = 0; return d; }
// The same skin baked here without paint: plain skin plus the visible tattoos, at the
// picture's own size and then shrunk exactly as the picture is, so thin lines match.
async function bakeBaseline(skinColor, native, S, withPaint = true) {
  const { bakeSkin } = await import('./uv-bake.js');
  syncDecals();
  const visible = state.tattoos.filter((t) => !t.hidden && decals[t.id] && decals[t.id].tex);
  const baked = bakeSkin({ THREE, renderer, bodyGeometry: bodyGeo, skinColor, decals: visible.map((t) => ({ geometry: decals[t.id].mesh.geometry, material: decals[t.id].mesh.material })), size: native });
  const full = document.createElement('canvas'); full.width = full.height = baked.size; full.getContext('2d').putImageData(new ImageData(baked.pixels, baked.size, baked.size), 0, 0);
  let out = shrinkTo(full, S); full.width = full.height = 0;
  // paint on the body went out with the model too
  const paintIm = withPaint && await paintPicture();
  if (paintIm) { const { paintOver } = await import('./paint-layer.js'); out = paintOver(out, shrinkTo(paintIm, S)); }
  return out;
}
async function readPainted(file, withPaint = true) {
  const P = await import('./procreate-import.js'), S = PAINT_SIZE;
  const pic = await P.skinPictureOf(file);
  const bmp = await createImageBitmap(pic), native = Math.max(256, Math.min(bmp.width, renderer.capabilities.maxTextureSize || 4096, 4096));
  const raw = shrinkTo(bmp, S); bmp.close && bmp.close();
  const map = P.triangleMap(S), skin = P.skinColorOf(raw, null);
  const baseline = await bakeBaseline(new THREE.Color().setRGB(skin[0] / 255, skin[1] / 255, skin[2] / 255, THREE.SRGBColorSpace), native, S, withPaint);
  return { P, S, map, skin, baseline, quiet: P.inkZone(baseline, map, S, skin), pixels: P.uprightPixels(raw, baseline, map, S) };
}
// Separate drawings in a skin picture (or on one paint layer, given its mask and ink), each
// photographed straight on and added as a tattoo.
async function tattoosFrom({ P, S, map, skin, baseline, pixels, quiet = null, mask = null, ink = null, name = null, from = null }) {
  const groups = P.findDrawings({ pixels, baseline, map, size: S, skin, mask, quiet, positions: bodyGeo.attributes.position.array, normals: bodyGeo.attributes.normal.array, index: bodyGeo.index.array });
  if (!groups.length) return [];
  const { texturedBody } = await import('./uv-bake.js');
  const layer = document.createElement('canvas'); layer.width = layer.height = S; layer.getContext('2d').putImageData(ink || P.paintLayer({ pixels, baseline, map, size: S, skin, quiet }), 0, 0);
  const paint = new THREE.CanvasTexture(layer); paint.colorSpace = THREE.SRGBColorSpace; paint.flipY = true;
  const geometry = texturedBody({ THREE, bodyGeometry: bodyGeo });
  const caster = new THREE.Raycaster(), restBody = new THREE.Mesh(bodyGeo), added = [];
  const had = state.tattoos.filter((t) => /^From Procreate \d+$/.test(t.name || '')).length; // keep counting on
  try {
    for (const grp of groups.slice(0, 12)) {
      const box = P.drawingBox(grp), n = new V3(...grp.normal);
      caster.set(new V3(...box.mid).addScaledVector(n, 0.05), n.clone().negate()); caster.far = 0.15;
      const hit = caster.intersectObject(restBody, false)[0], pos = hit ? hit.point.toArray() : grp.center;
      const shot = P.photographDrawing({ THREE, renderer, geometry, paint, center: pos, normal: grp.normal, box });
      const span = 1 - 2 * UV_MARGIN;
      const label = name ? (groups.length > 1 ? `${name} ${added.length + 1}` : name) : 'From Procreate ' + (had + added.length + 1);
      const t = await addImage(shot.toDataURL('image/png'), label, { pos, normal: grp.normal, width: box.w / span, rot: 0, opacity: 1 });
      if (t) { t.status = 'planned'; if (from) t.fromLayer = from; added.push(t); }
    }
  } finally { paint.dispose(); geometry.dispose(); }
  return added;
}
// New drawing on a painted model becomes tattoos (kept for files dropped in as tattoos).
async function importPainted(file, undoStep = true) {
  toggle('#share', false);
  if (file.size > 300e6) { toast('That file is too large to open here.'); return []; }
  toast('Looking for new drawing on the model. This takes a few seconds.');
  try {
    const r = await readPainted(file);
    if (undoStep) snapshot();
    const added = await tattoosFrom(r);
    if (!added.length) { toast('No new drawing found on that model.'); return []; }
    selectedId = added[0].id; commit(); focusTattoo(added[0]);
    toast(added.length === 1 ? 'Added 1 new tattoo from the model.' : `Added ${added.length} new tattoos from the model.`);
    return added.map((t) => t.id);
  } catch (e) { toast('Could not read that model: ' + ((e && e.message) || 'something went wrong')); return []; }
  finally { needsRender = true; }
}
// Back from Procreate as paint: the whole of the paint on the model replaces the paint here,
// so painting more, changing it or rubbing it out in Procreate all come back.
async function bringBackPainted(file) {
  toggle('#share', false); toggle('#pcMenu', false);
  if (file.size > 300e6) { toast('That file is too large to open here.'); return null; }
  toast('Bringing back your paint. This takes a few seconds.');
  try {
    const r = await readPainted(file, false); // all of the paint comes back, not only what is new
    const { extractPaint } = await import('./paint-layer.js');
    const { image, painted, body: bodyPx } = extractPaint({ ...r, size: r.S });
    window.__lastPaint = { painted, body: bodyPx };
    if (bodyPx && painted / bodyPx > 0.9) { toast("That model doesn't look like the 3D body from Ink Atlas. Send the 3D body from here, paint on that one, then bring it back."); return null; }
    if (!painted) {
      if (!state.paint) { toast('No paint found on that model.'); return { painted: 0 }; }
      snapshot(); delete state.paint; commit();
      toast('No paint on that model, so the paint here is cleared. Undo brings it back.'); return { painted: 0 };
    }
    const c = document.createElement('canvas'); c.width = c.height = r.S; c.getContext('2d').putImageData(image, 0, 0);
    const k = uid(); images[k] = c.toDataURL('image/png'); c.width = c.height = 0;
    if (!await loadImg(k)) { delete images[k]; toast('The paint could not be opened. Nothing changed.'); return null; }
    snapshot(); state.paint = { img: k, hidden: false }; selectedId = null; commit();
    markTried('paint3d');
    toast('Your paint is on the body. It follows every pose and goes back out with the next 3D body.');
    return { painted, body: bodyPx, img: k };
  } catch (e) { toast('Could not read that model: ' + ((e && e.message) || 'something went wrong')); return null; }
  finally { needsRender = true; }
}
// Back from Procreate as new tattoos (one undo step). Procreate's own file (.procreate) keeps
// the layers, so each layer comes back as its own tattoo, named by the layer, and a layer that
// holds separate drawings gives one tattoo for each. A USDZ, OBJ or picture is flattened, so
// there each separate painted area becomes a tattoo. Ink already on the body (it went out with
// the model) is left out, and bringing the same file back twice adds nothing.
const layerMark = (px) => { let h = 2166136261; for (let i = 0; i < px.length; i += 4 * 61) h = Math.imul(h ^ (px[i] ^ (px[i + 1] << 8) ^ (px[i + 2] << 16) ^ (px[i + 3] << 24)), 16777619); return (h >>> 0).toString(36); };
async function layersFrom(bytes) {
  const P = await import('./procreate-import.js'), { readProcreate } = await import('./procreate-file.js');
  const doc = await readProcreate(bytes), S = Math.max(512, Math.min(PAINT_SIZE, doc.width)), map = P.triangleMap(S); // never scaled up, so it matches the skin baked here
  const read = await Promise.all(doc.layers.filter((l) => !l.hidden && l.opacity !== 0).map(async (l) => ({ ...l, px: await l.read(S) })));
  const body = map.reduce((n, t) => n + (t >= 0), 0), cover = (px) => { let n = 0; for (let p = 0; p < map.length; p++) if (map[p] >= 0 && px[p * 4 + 3] > 200) n++; return n / body; };
  for (const l of read) l.cover = cover(l.px);
  // the skin the model went out with: the composite, else the base layer, else the skin here
  const comp = doc.composite[0] ? await doc.composite[0].read(S) : null, base = read.find((l) => l.cover > 0.5);
  const ref = comp && cover(comp) > 0.5 ? comp : base ? base.px : null;
  const sc = { r: 0, g: 0, b: 0 }; skinMat.color.getRGB(sc, THREE.SRGBColorSpace);
  const skin = ref ? P.skinColorOf(ref, null) : [sc.r, sc.g, sc.b].map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255));
  const baseline = await bakeBaseline(new THREE.Color().setRGB(skin[0] / 255, skin[1] / 255, skin[2] / 255, THREE.SRGBColorSpace), Math.min(Math.max(doc.width, 256), renderer.capabilities.maxTextureSize || 4096, 4096), S);
  const flip = ref ? P.upsideDown(ref, baseline, map, S) : false;
  if (flip) for (const l of read) l.px = P.flipRows(l.px, S);
  return { P, S, map, skin, baseline, quiet: P.inkZone(baseline, map, S, skin), layers: read.reverse() /* bottom first */ };
}
async function bringBack(file) {
  toggle('#share', false); toggle('#pcMenu', false);
  if (file.size > 300e6) { toast('That file is too large to open here.'); return []; }
  let layered = /\.procreate$/i.test(file.name);
  if (!layered && /\.zip$/i.test(file.name)) { // Files can rename it; Procreate's own file is a zip with its document inside
    try { const { readZip } = await import('./procreate-import.js'); layered = (await readZip(new Uint8Array(await file.arrayBuffer()))).some((e) => e.name === 'Document.archive'); } catch { /* not a zip */ }
  }
  toast(layered ? 'Bringing back your layers as tattoos. This takes a few seconds.' : 'Bringing back your drawing as tattoos. This takes a few seconds.');
  const before = undoStack.length, added = [], replaced = [];
  try {
    if (layered) {
      const r = await layersFrom(new Uint8Array(await file.arrayBuffer()));
      snapshot();
      for (const l of r.layers) {
        const mark = l.uuid + ':' + layerMark(l.px);
        if (state.tattoos.some((t) => t.fromLayer === mark)) continue; // came back before, unchanged
        let got;
        const isBase = l.cover > 0.5;
        if (isBase) got = await tattoosFrom({ ...r, pixels: P_over(r, l), from: mark }); // the base layer: only what differs from the skin and ink here
        else {
          const mask = new Uint8Array(r.S * r.S); let n = 0;
          for (let p = 0; p < r.map.length; p++) if (r.map[p] >= 0 && l.px[p * 4 + 3] > 40) { mask[p] = 1; n++; }
          if (!n) continue;
          got = await tattoosFrom({ ...r, pixels: l.px, mask, ink: r.P.layerInk(l.px, r.map, r.S, l.opacity ?? 1), name: l.name || 'Layer', from: mark });
        }
        if (!got.length) continue;
        // a layer changed since it last came back: its new tattoos take the place of the old
        // (not the base layer: its earlier tattoos are on the skin it was compared with, so stay)
        const old = isBase ? [] : state.tattoos.filter((t) => t.fromLayer && t.fromLayer.split(':')[0] === l.uuid && t.fromLayer !== mark && !got.includes(t));
        for (const t of old) { state.tattoos = state.tattoos.filter((x) => x !== t); replaced.push(t.id); }
        added.push(...got);
      }
    } else {
      const r = await readPainted(file);
      snapshot();
      added.push(...await tattoosFrom(r));
    }
    if (!added.length) { if (undoStack.length > before) { undoStack.pop(); refreshUndo(); } toast(layered ? 'No new layers to bring back. Layers that came back before are already tattoos here.' : 'No new drawing found on that model.'); return []; }
    if (replaced.length) syncDecals();
    selectedId = added[0].id; commit(); focusTattoo(added[0]); markTried('paintLayers');
    const n = added.length;
    toast((n === 1 ? 'Added 1 new tattoo' : `Added ${n} new tattoos`) + (layered ? ' from your layers.' : ' from separate areas of paint. Share as Procreate to keep layers apart.'));
    return added.map((t) => t.id);
  } catch (e) {
    if (undoStack.length > before) undo();
    toast('Could not read that file: ' + ((e && e.message) || 'something went wrong')); return [];
  } finally { needsRender = true; }
}
// The base layer laid over the skin picture (it is opaque, so it is the picture).
function P_over(r, l) { const out = new Uint8ClampedArray(r.baseline); for (let o = 0; o < out.length; o += 4) { const a = l.px[o + 3] / 255; for (let k = 0; k < 3; k++) out[o + k] = Math.round(out[o + k] * (1 - a) + l.px[o + k] * a); } return out; }
// The paint on the body, split into movable tattoos (one undo step).
async function paintToTattoos() {
  toggle('#pcMenu', false);
  const im = state.paint && await loadImg(state.paint.img); if (!im) return [];
  toast('Making movable tattoos from your paint. This takes a few seconds.');
  try {
    const P = await import('./procreate-import.js'), S = PAINT_SIZE, sc = { r: 0, g: 0, b: 0 };
    skinMat.color.getRGB(sc, THREE.SRGBColorSpace);
    const skin = [sc.r, sc.g, sc.b].map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255));
    const baseline = await bakeBaseline(skinMat.color.clone(), Math.min(renderer.capabilities.maxTextureSize || 4096, 4096), S, false);
    const { paintOver } = await import('./paint-layer.js');
    const pixels = paintOver(baseline, shrinkTo(im, S)), map = P.triangleMap(S);
    snapshot();
    const added = await tattoosFrom({ P, S, map, skin, baseline, pixels });
    if (!added.length) { undoStack.pop(); refreshUndo(); toast('No separate drawings found in the paint.'); return []; }
    delete state.paint; selectedId = added[0].id; commit(); focusTattoo(added[0]);
    toast(added.length === 1 ? 'The paint is now 1 movable tattoo.' : `The paint is now ${added.length} movable tattoos.`);
    return added.map((t) => t.id);
  } catch (e) { toast('Could not make tattoos from the paint: ' + ((e && e.message) || 'something went wrong')); return []; }
  finally { needsRender = true; }
}
// Layered PSD for Procreate: this view with the body on one layer and each visible
// tattoo on its own layer above it (multiply, transparent around the ink), plus the
// flattened picture. Clothes, the floor shadow and the selection outline are left out.
// Each tattoo is drawn alone on white with the body hiding what is behind it, then white
// is turned into transparency, so the layers multiplied over the body give this view.
function inkToAlpha(px) {
  for (let o = 0; o < px.length; o += 4) {
    const r = px[o], g = px[o + 1], b = px[o + 2], a = 255 - Math.min(r, g, b);
    if (!a) { px[o] = px[o + 1] = px[o + 2] = px[o + 3] = 0; continue; }
    px[o] = 255 - Math.round((255 - r) * 255 / a); px[o + 1] = 255 - Math.round((255 - g) * 255 / a); px[o + 2] = 255 - Math.round((255 - b) * 255 / a); px[o + 3] = a;
  }
  return px;
}
async function exportLayers() {
  toggle('#share', false);
  const list = state.tattoos.filter((t) => !t.hidden && decals[t.id] && decals[t.id].tex && (!soloIds || soloIds.has(t.id))).slice(0, 60);
  const { writePsd, cropLayer } = await import('./psd.js');
  const inset = curInset, bg = scene.background, off = [];
  let layers, merged, W, H;
  try {
    curInset = 0; applyInset(); exporting = true; syncDecals();
    for (const m of [floorShadow]) if (m && m.visible) { m.visible = false; off.push(m); }
    W = canvas.width; H = canvas.height;
    const grab = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0); return g.getImageData(0, 0, W, H).data; };
    const render = (bodyColour = true) => clothes.bare(() => poseView.withPosed(() => { const m = body.material, cw = m.colorWrite; m.colorWrite = bodyColour; try { renderer.render(scene, camera); } finally { m.colorWrite = cw; } }, posedInk()));
    decalGroup.visible = true; render(); merged = grab();
    decalGroup.visible = false; render(); layers = [{ name: 'Body', rgba: grab() }];
    decalGroup.visible = true; scene.background = new THREE.Color(0xffffff);
    for (const t of list) {
      for (const [id, d] of Object.entries(decals)) { d.mesh.visible = id === t.id; d.outline.visible = false; }
      render(false);
      const { box, rgba } = cropLayer(inkToAlpha(grab()), W, H);
      if (box.bottom <= box.top) continue; // not seen from this side
      layers.push({ name: t.name || 'Tattoo', box, rgba, blend: 'mul ', opacity: 255 });
    }
  } catch (e) { toast('Could not make the layered file: ' + ((e && e.message) || 'something went wrong')); return null; }
  finally {
    scene.background = bg; for (const m of off) m.visible = true; decalGroup.visible = true;
    exporting = false; curInset = inset; applyInset(); syncDecals(); needsRender = true;
  }
  const blob = writePsd({ width: W, height: H, layers, merged });
  window.__lastPsd = { width: W, height: H, layers: layers.map((l) => l.name), bytes: blob.size };
  await saveFile('ink-atlas-layers.psd', blob);
  return blob;
}
// Print at real size: a PDF with each visible tattoo at its true size.
async function printRealSize() {
  toggle('#share', false);
  const list = state.tattoos.filter((t) => !t.hidden && imgEls[t.img]);
  if (!list.length) { toast('No visible tattoos to print.'); return; }
  try {
    const { pieceSize, layoutPrint, buildPrintPdf, sizeNote } = await import('./print-size.js');
    const pieces = [], art = {};
    for (const t of list) {
      const size = pieceSize(t, state.heightCm), im = imgEls[t.img];
      const name = t.name || 'Tattoo', note = sizeNote(size) + (t.status === 'existing' ? ', already on me' : '') + (t.flip ? ', mirrored as on the body' : '');
      // about 200 dots per inch, capped so a big back piece stays a sensible file
      const scale = Math.min(1, 3000 / Math.max(size.w, size.h) / (200 / 72)), cw = Math.max(1, Math.round(size.w / 72 * 200 * scale)), ch = Math.max(1, Math.round(size.h / 72 * 200 * scale));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
      if (t.flip) { g.translate(cw, 0); g.scale(-1, 1); }
      g.drawImage(im, 0, 0, cw, ch);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      art[t.id] = { name, note, jpeg: { width: cw, height: ch, data: new Uint8Array(await blob.arrayBuffer()) } };
      pieces.push({ id: t.id, w: size.w, h: size.h, labelW: (name.length + note.length + 2) * 4.6 });
    }
    const pdf = buildPrintPdf(layoutPrint(pieces), art, { title: (state.projectName || 'My tattoos') + ': real size' });
    window.__lastPrint = { bytes: pdf.length, pieces: pieces.map((p) => ({ id: p.id, w: p.w, h: p.h })) };
    await saveFile('ink-atlas-real-size.pdf', new Blob([pdf], { type: 'application/pdf' }));
  } catch (e) { toast('Could not make the print file: ' + ((e && e.message) || 'something went wrong')); }
}
$('#cPrint').addEventListener('click', printRealSize);
// Spin video: the whole body turning once, in the current pose, with visible ink.
let spinning = false;
async function spinVideo() {
  toggle('#share', false);
  if (spinning) return; spinning = true;
  toast('Making your spin video. Keep the app open for a few seconds.');
  let result = null;
  const oldCur = { ...cur }, oldGoal = { ...goal }, oldGlide = glide, inset = curInset;
  try {
    poseView.pause();
    const { makeSpinVideo } = await import('./spin-video.js');
    curInset = 0; applyInset(); exporting = true; syncDecals();
    const frames = 180;
    // Frame the body as it stands now (posed or not) so it fills the clip at every angle.
    if (poseView.active) poseView.ensure();
    const P = (poseView.active ? poseView.geometry : bodyGeo).attributes.position.array;
    let y0 = Infinity, y1 = -Infinity, reach = 0;
    for (let k = 0; k < P.length; k += 3) { y0 = Math.min(y0, P[k + 1]); y1 = Math.max(y1, P[k + 1]); reach = Math.max(reach, Math.hypot(P[k], P[k + 2] - 0.02)); }
    const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), span = Math.max((y1 - y0) * 1.1, reach * 2 * 1.1 / 0.75);
    result = await makeSpinVideo({ width: 720, height: 960, fps: 30, frames, draw: (i, g) => {
      Object.assign(goal, { theta: Math.PI * 2 * i / frames, phi: 1.5, roll: 0, tx: 0, ty: (y0 + y1) / 2, tz: 0.02, r: span / Math.min(1, canvas.width / (canvas.height * 0.75)) / (2 * tn) + reach });
      glide = false; Object.assign(cur, goal); applyCam();
      poseView.withPosed(() => renderer.render(scene, camera), posedInk());
      // the largest 3:4 window in the middle of the picture
      const cw = canvas.width, ch = canvas.height, w = Math.min(cw, ch * 0.75), h = w / 0.75;
      g.drawImage(canvas, (cw - w) / 2, (ch - h) / 2, w, h, 0, 0, 720, 960);
    } });
    window.__lastSpin = { bytes: result.blob.size, codec: result.codec, name: result.name };
  } catch (e) { toast('Could not make the video: ' + ((e && e.message) || 'something went wrong')); }
  finally {
    exporting = false; Object.assign(cur, oldCur); Object.assign(goal, oldGoal); glide = oldGlide; curInset = inset; applyInset(); applyCam(); syncDecals(); needsRender = true; spinning = false;
  }
  if (result) await saveFile(result.name, result.blob);
}
$('#cSpin').addEventListener('click', spinVideo);
$('#cUsdz').addEventListener('click', () => exportPainted('usdz'));
$('#cUsdzLayers').addEventListener('click', () => exportLayered());
$('#cPsd').addEventListener('click', () => exportLayers());
$('#cPainted').addEventListener('click', () => { toggle('#share', false); $('#paintedFile').click(); });
$('#paintedFile').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await bringBack(f); });
$('#cObjBaked').addEventListener('click', () => exportPainted('obj'));
$('#cModelOpen').addEventListener('click',()=>$('#modelFile').click());
$('#modelFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;toggle('#share',false);try{if(file.size>25*1024*1024)throw new Error('Use a GLB under 25 MiB.');const {openModelPreview}=await import('./model-preview.js');await openModelPreview({THREE,buffer:await file.arrayBuffer(),name:file.name});}catch(e){toast('Could not preview model: '+e.message);}});
$('#cV47Source').addEventListener('click',()=>{const source=state.v47Source;if(source)saveFile('ink-atlas-original-import.ink.json',JSON.stringify({format:'ink-atlas-portable',project:source.project,assets:source.assets}));});
$('#cV47').addEventListener('click',async()=>{
 toggle('#share',false);try{const {exportV47Project}=await import('./v47-export.js');const bundle=exportV47Project({state,images:usedImages(),savedAt:new Date().toISOString()});
 const host=el('section',{class:'scrim',id:'v47Export',role:'dialog','aria-modal':'true','aria-label':'Original v47 compatibility export'});host.style.zIndex=10000;
 const panel=el('div',{class:'modal glass'},el('h2',{text:'Original v47 compatibility export'}),el('p',{text:'Not a lossless or visually identical round trip. Keep the full rebuild backup. The original app has not been runtime-tested with this export.'}));
 const details=el('details',{},el('summary',{text:'What carries across and what stays in the backup'}));const list=el('ul');for(const text of bundle.report.limitations||[])list.append(el('li',{text}));details.append(list);panel.append(details);
 panel.append(el('button',{class:'btn',text:'Save full rebuild backup',onclick:()=>saveFile('ink-atlas-full-rebuild-backup.json',JSON.stringify(bundle.rebuildBackup))}),el('button',{class:'btn',text:'Save v47 compatibility copy',onclick:()=>saveFile('ink-atlas-v47-compatibility.ink.json',JSON.stringify(bundle.portable))}),el('button',{class:'btn',text:'Done',onclick:()=>host.remove()}));host.append(panel);$('#viewport').append(host);host.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')host.remove();});
 }catch(e){toast('v47 export stopped safely: '+e.message);}
});
function backupNow() { const d = new Date(), p2 = (n) => String(n).padStart(2, '0'); saveFile(`ink-atlas-backup-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`, JSON.stringify({ app: 'ink-atlas-proto', v: 2, savedAt: d.toISOString(), state, images: usedImages() })); }
$('#cBackup').addEventListener('click', () => { toggle('#share', false); backupNow(); });
/* ---------- earlier saves ---------- */
function renderRecovery() {
  const host = $('#rcList'), list = store && store.ok ? store.listRecovery() : []; host.replaceChildren();
  if (!list.length) { host.append(el('p', { class: 'tip', text: store && store.ok ? 'No earlier saves yet. Copies are kept as you work.' : 'Storage is off in this view, so no copies are kept.' })); return; }
  for (const r of list) host.append(el('button', { class: 'card slim', type: 'button', onclick: () => restoreRecovery(r.id) }, el('b', { text: whenText(r.at) }), el('span', { text: `${r.tattoos} tattoo${r.tattoos === 1 ? '' : 's'} · ${r.reason}` })));
}
async function restoreRecovery(id) {
  toggle('#recover', false);
  let rec = null; try { rec = await store.loadRecovery(id); } catch (e) { rec = null; }
  if (!rec) { toast('That copy is no longer available.'); return; }
  snapshot(); const before = JSON.stringify(state);
  await keepRecovery('Before going back');
  try { await openProject(rec.state, rec.images); commit(); fullBody(); toast('Went back to the earlier save', 'Undo', undo); }
  catch (e) { undoStack.pop(); refreshUndo(); state = JSON.parse(before); skinMat.color.set(skinColor()); applyShape(); syncDecals(); renderUI(); toast('That copy could not be opened, so nothing was changed.'); }
}
$('#cRecover').addEventListener('click', () => { toggle('#share', false); renderRecovery(); toggle('#recover', true); });
$('#cRestore').addEventListener('click', () => { toggle('#share', false); $('#file').click(); });

/* ---------- backup import (this app's files and older Ink Atlas .ink.json) ---------- */
function nearestSurface(p) {
  const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array, end = vertEnd(); let best = -1, bd = Infinity;
  for (let i = 0; i < end; i += 3) { const d = (P[i] - p[0]) ** 2 + (P[i + 1] - p[1]) ** 2 + (P[i + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
  return { pos: [P[best], P[best + 1], P[best + 2]], normal: [N[best], N[best + 1], N[best + 2]], dist: Math.sqrt(bd) };
}
async function importBackup(text) {
  let data; try { data = JSON.parse(text); } catch (e) { toast('That file is not a project backup.'); return; }
  if (data && data.app === 'ink-atlas-proto' && data.state) {
    const before = JSON.stringify(state);
    await keepRecovery('Before opening a backup');
    try {
      const r = await openProject(data.state, data.images);
      if (account) account.unbind();
      commit(); fullBody();
      toast(r.dropped ? `Project opened. ${r.dropped} piece${r.dropped === 1 ? ' had no usable artwork and was' : 's had no usable artwork and were'} left out.` : 'Project opened', 'Undo', undo);
    } catch (e) { state = JSON.parse(before); skinMat.color.set(skinColor()); applyShape(); syncDecals(); renderUI(); toast('That backup is damaged, so nothing was changed.'); }
    return;
  }
  const proj = data && data.format === 'ink-atlas-portable' ? data.project : (data && data.version === 1 && Array.isArray(data.tattoos) ? data : null);
  if (proj && Array.isArray(proj.tattoos)) { await importInkJson(proj, Array.isArray(data.assets) ? data.assets : []); return; }
  const found = []; const seen = new Set();
  (function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 12) return;
    if (!Array.isArray(o)) { for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string' && v.startsWith('data:image') && !seen.has(v)) { seen.add(v); found.push({ src: v, o }); break; } } }
    for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v, depth + 1);
  })(data, 0);
  if (!found.length) { toast('No artwork found in that file.'); return; }
  let n = 0, placed = 0;
  for (const f of found.slice(0, 40)) {
    let place = null; const p = f.o.position;
    if (Array.isArray(p) && p.length === 3 && p.every((x) => typeof x === 'number')) { const s = nearestSurface(p); if (s.dist < 0.25) { place = { pos: s.pos, normal: s.normal }; placed++; } }
    if (place && typeof f.o.width === 'number' && f.o.width > 0.01 && f.o.width < 1) place.width = f.o.width;
    if (place && typeof f.o.opacity === 'number') place.opacity = f.o.opacity;
    const t = await addImage(f.src, (typeof f.o.name === 'string' && f.o.name.slice(0, 40)) || 'Imported tattoo', place); if (t) n++;
  }
  commit(); fullBody(); toast(`Imported ${n} piece${n === 1 ? '' : 's'}${placed < n ? '. Some need placing by hand.' : '. Check the placements.'}`);
}

const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const ok3 = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => fin(x) && Math.abs(x) < 10);
// Opening an older Ink Atlas backup replaces the project, so keep a copy first and put
// everything back if the file turns out to be unusable part way through.
async function importInkJson(proj, assets) {
  const before = JSON.stringify(state);
  await keepRecovery('Before opening a backup');
  try { await readInkJson(proj, assets); }
  catch (e) { state = JSON.parse(before); selectedId = null; skinMat.color.set(skinColor()); applyShape(); commit(); toast('Could not open v47 backup: '+e.message+'. Current project unchanged.'); }
}
async function readInkJson(proj, assets) {
 const {importV47Project}=await import('./v47-import.js');const result=importV47Project({project:proj,assets});
 await openProject(result.state,result.images);if(account)account.unbind();commit();fullBody();
 toast(`Opened ${state.projectName||'v47 project'}: ${state.tattoos.length} placed, ${result.report.unplaced||0} saved to place. Original source kept; some metadata is archive-only.`, 'Undo',undo);
}
// Bring a loaded project up to the current body model without moving any ink:
// rebuild the exact shape it was saved on, pin every tattoo to its triangle, then
// switch to today's shape. Saves from before body types sit on the base mesh; v1
// saves sit on the first prototype's muscle / weight blend.
function adoptState() {
  const old = !state.figure ? legacyPositions() : (state.v || 1) < 2 ? shapePositionsV1(state.figure, state.muscle, state.weight) : null;
  if (!old) { state.fit = state.fit || {}; applyShape(); return; }
  setBodyPositions(old, false); const an = anchorsNow();
  if (!state.figure) { state.figure = 'male'; state.muscle = 0.6; state.weight = 0.5; }
  else { state.muscle = 0.5 + 0.5 * THREE.MathUtils.clamp(state.muscle || 0, 0, 1); state.weight = 0.5 + 0.5 * THREE.MathUtils.clamp(state.weight || 0, -1, 1); }
  state.fit = {}; state.genitals = true; state.v = 2;
  applyShape(); applyAnchors(an);
}
/* ---------- loop ---------- */
let last = performance.now();
let camMoving = false, booted = false;
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; // slow frames still glide in about the same time
  if (inkDirty) { inkDirty = false; syncDecals(); const t = sel(); if (t) { $('#size').textContent = sizeText(t); likeRender(t); } }
  if (Math.abs(goalInset - curInset) > 0.5) { curInset += (goalInset - curInset) * (1 - Math.exp(-dt * 12)); if (Math.abs(goalInset - curInset) <= 0.5) curInset = goalInset; applyInset(); needsRender = true; }
  const moving = stepCam(dt); camMoving = moving;
  if (moving || needsRender) { needsRender = false; drawFrame(); if(liveGuidePlan)drawLiveGuides(); placeHandles(); if (tape.on) placeTape(); if (pins.on) placePins(); if (pointing.els.length) placePoints(); }
  requestAnimationFrame(tick);
}

/* ---------- boot ---------- */
(async function boot() {
  store = await openStore();
  let opened = false, note = '';
  if (store.ok) {
    let loaded = null;
    try { loaded = await store.load(); } catch (e) { note = 'The save on this device could not be read, so a fresh project was started.'; }
    if (loaded) {
      try {
        const r = await openProject(loaded.state, loaded.images); opened = true;
        // The copy is of the save exactly as it was stored, before any upgrade or repair.
        await store.addRecovery(loaded.state, loaded.images, 'When you opened the app').catch(() => false);
        if (r.dropped || r.replaced) { await store.quarantine(loaded.raw, loaded.images); note = r.dropped ? `${r.dropped} piece${r.dropped === 1 ? '' : 's'} in your save had no usable artwork. The original save was kept on this device.` : 'Some ink had lost its place and was put back on the body. Check the placements.'; }
      } catch (e) {
        await store.quarantine(loaded.raw, loaded.images);
        for (const r of store.listRecovery()) {
          try { const rec = await store.loadRecovery(r.id); if (!rec) continue; await openProject(rec.state, rec.images); opened = true; note = `Your last save could not be opened, so this is the copy from ${whenText(r.at)}.`; break; } catch (_) { /* try the next copy */ }
        }
        if (!opened) note = 'Your last save could not be opened. It was kept on this device and a fresh project was started.';
      }
    }
  }
  if (!opened) { state = freshState(); selectedId = null; applyShape(); await seedSamples(); }
  skinMat.color.set(skinColor());
  syncDecals(); renderUI();
  if (store.ok) { save(); store.gc(Object.keys(usedImages())).catch(() => 0); } else setSaved('Not saved: storage is off in this view', true);
  if (note) toast(note);
  let seen = false; try { seen = localStorage.getItem('ia-coach') === '1'; } catch (e) { /* no storage */ }
  $('#coach').hidden = seen;
  $('#coachOk').addEventListener('click', () => { $('#coach').hidden = true; try { localStorage.setItem('ia-coach', '1'); } catch (e) { /* no storage */ } });
  booted = true;
  requestAnimationFrame(tick);
  startAccount();
})();
/* ---------- your account (src/account.js, src/cloud.js) ---------- */
// The project on screen stays on this device first; the account keeps a second copy in step.
function startAccount() {
  const keepOnShelf = async (reason) => { const shelf = await openProjectShelf(); try { await shelf.create(reason + ' · ' + new Date().toLocaleString(), { state, images: usedImages() }); } finally { shelf.close(); } };
  const clearHistory = () => { undoStack.length = 0; redoStack.length = 0; refreshUndo(); };
  account = createAccount({
    snapshot: () => ({ state, images: usedImages() }),
    projectName: () => state.projectName || 'My tattoos',
    async open(next, imgs, name, opts = {}) {
      if (opts.live) {
        // someone else's changes to a project worked on together: keep the view and selection
        const keep = selectedId, sheetOpen = !$('#sheet')?.hidden, before = othersBefore();
        const r = await openProject(next, imgs);
        state.projectName = name || state.projectName || 'My tattoos';
        if (keep && state.tattoos.find((t) => t.id === keep)) selectedId = keep;
        clearHistory(); commit(); if (sheetOpen && selectedId) renderSheet();
        r.toasted = newFromOthers(before);
        return r;
      }
      cancelGesture();
      if (opts.keepCopy) await keepOnShelf(opts.reason || 'Before switching');
      await keepRecovery(opts.reason || 'Before switching');
      const r = await openProject(next, imgs);
      state.projectName = name || state.projectName || 'My tattoos';
      clearHistory(); commit(); fullBody();
      return r;
    },
    async newProject(name, opts = {}) {
      cancelGesture();
      if (opts.keepCopy) await keepOnShelf('Before starting a new project');
      await keepRecovery('Before starting a new project');
      state = freshState(); state.projectName = name; selectedId = null; skinMat.color.set(skinColor()); applyShape();
      clearHistory(); commit(); fullBody();
    },
    rename(name) { state.projectName = name; commit(); },
    setSaved, toast, saveNow: () => save(), tried: (id = 'accounts') => markTried(id),
    // who else has the shared project open, and the tattoo each has selected
    setPeers(list) { peersHere = Array.isArray(list) ? list : []; renderTray(); applyFollow(); peerPoints(); renderTyping(); },
    looking: () => selectedId, view: myView, follow: followPeer, point: myPoint, typing: myTyping, tattooName: (id) => (state.tattoos.find((x) => x.id === id) || {}).name || '',
    setCommentOnly, showChange, inches: (w) => w * state.heightCm / 175 * 100 / 2.54,
    // in the middle of moving something or typing: changes from elsewhere wait a moment
    holding: () => !!suggesting || !!spotPeek,
    // settings from the account (prefs.js): write them here and show them, quietly
    applyPrefs(p) {
      const changed = writePrefs(p); if (!changed.length) return [];
      const now = readDevicePrefs(); quietTry = true;
      try {
        if (changed.includes('light')) setLight(readLight());
        if (changed.includes('hair')) { const h = now.hair || { style: 'none', colour: 'brown', hex: null }; setHair(h.style, h.colour, h.hex); }
        if (changed.includes('beard')) setBeard(now.beard || 'none');
        if (changed.includes('bodyHair')) setBodyHair(now.bodyHair || 'none');
        if (changed.includes('eyes')) setEyes(now.eyes || null);
        if (changed.includes('rate')) renderSheet();
      } finally { quietTry = false; }
      const words = { light: 'light', hair: 'hair', beard: 'beard', bodyHair: 'body hair', eyes: 'eye colour', rate: 'hourly rate' };
      const list = changed.map((k) => words[k]);
      toast(`Your ${list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0]} came over from your account.`);
      return changed;
    },
    busy: () => !!suggesting || !!spotPeek || !!gest || pts.size > 0 || (!!document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && !document.getElementById('account')?.contains(document.activeElement)),
  });
  account.start();
}
$('#followStop').addEventListener('click', () => stopFollow());
$('#showSpotBtn').addEventListener('click', () => pointMode(!pointing.on));
$('#views').addEventListener('click', () => stopFollow(), true);
// tell anyone else here where this view went, once it settles
let viewSent = '';
setInterval(() => { if (!account || !account.nudge || !peersHere.length) return; const k = myView().join(); if (k !== viewSent) { viewSent = k; account.nudge(); } }, 700);
$('#cLink').addEventListener('click', () => { toggle('#share', false); if (account) account.sendLink().catch(() => {}); });
// Test hooks for tools/tests. loadState runs the same upgrade path a saved project takes on open.
// Measured wrap: rings measured round an arm or leg, the existing tattoo registered on them, and the
// new design arranged on the flat shape (wrap-studio.js). Everything lives in state.regions.
async function readPicture(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const w = im.naturalWidth, h = im.naturalHeight; if (!(w > 0 && h > 0) || w * h > 40e6) return null;
    const s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
    // a see-through picture stays PNG; a photo becomes a good JPEG, so a full-size photo stays small enough to save
    let see = false; try { const d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) { see = true; break; } } catch (_) { see = true; }
    return { dataUrl: see ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92), w: c.width, h: c.height };
  } catch (_) { return null; } finally { URL.revokeObjectURL(url); }
}
wrapStudio = initWrapStudio({
  THREE, body: () => body, getState: () => state, snapshot, commit, toast, loadImg, markTried, requestRender: () => { needsRender = true; },
  putImage: (dataUrl) => { const k = uid(); images[k] = dataUrl; return k; }, readPicture,
  closePanels: () => { closePanels(); toggle('#planMenu', false); if (selectedId) select(null); },
  rig: () => ({ bones: POSE_BONES, joints: poseView.restRig().joints, count: COUNTS.body, vertexBones, rest: () => (bodyGeo.attributes.rest || bodyGeo.attributes.position).array, index: bodyGeo.index.array }),
  aim: (pos, normal, ext) => aimView(pos, normal, ext), shapeKey: () => shapeKey,
});
$('#openWrap').addEventListener('click', () => { toggle('#planMenu', false); wrapStudio.open(); });

window.__ink = {
  wrap: () => wrapStudio,   state: () => state, ready: () => booted, peers: () => peersHere, following: () => followId, followPeer, points: () => ({ on: pointing.on, mine: pointing.mine, marks: pointing.els.map((e) => ({ text: e.d.textContent, shown: !e.d.hidden, x: parseFloat(e.d.style.left), y: parseFloat(e.d.style.top) })), button: !$('#showSpotBtn').hidden }),
  sizes: () => sizesLast, sizeSteps, distance: () => distanceLast, distanceSheet, bodyChange: () => bodyChangeLast, mirror: () => mirrorLast, sleeve: () => sleeveLast, inkCheck: () => ic.last, approval: () => approvalLast, answers: () => answersLast, bringInAnswers,
  pain: () => ({ on: pain.on, text: $('#painText').textContent, shown: !!(pain.mesh && pain.mesh.visible), at: (v) => { const d = painData(); return { level: d.smooth[v], raw: d.level[v], place: d.place[v] }; }, stats: () => { const d = painData(), o = {}; for (let v = 0; v < PAIN_N; v++) { const k = d.place[v]; if (!k) continue; const e = o[k] || (o[k] = { n: 0, level: 0, x: 0, y: 0 }); e.n++; e.level += d.smooth[v]; e.x += bodyGeo.attributes.position.array[v * 3]; e.y += bodyGeo.attributes.position.array[v * 3 + 1]; } for (const k in o) { o[k].level /= o[k].n; o[k].x /= o[k].n; o[k].y /= o[k].n; } return o; }, ofTattoo: (id) => painOfTattoo(state.tattoos.find((t) => t.id === id)), colours: () => pain.mesh ? Array.from(pain.mesh.geometry.attributes.color.array.slice(0, 30)) : null, drawnAt: (v) => pain.mesh ? Array.from(pain.mesh.geometry.attributes.position.array.slice(v * 3, v * 3 + 3)) : null }),
  tape: () => ({ on: tape.on, mode: tape.mode, pts: tape.pts.length, result: tape.result && JSON.parse(JSON.stringify(tape.result)), text: $('#tapeText').textContent, label: $('#tapeLabel').hidden ? '' : $('#tapeLabel').textContent, meshes: tape.group.children.length, visible: tape.group.visible, start: tape.pts.length ? (poseView.active ? poseView.pointOn(tape.pts[0].tri, tape.pts[0].w).pos : tapeSpot(tape.pts[0]).pos) : null, ring0: (() => { drawFrame(); const m = tape.group.children.find((c) => c.geometry.type === 'TubeGeometry'); if (!m) return null; const a = m.geometry.attributes.position.array, o = [0, 0, 0]; for (let i = 0; i < 6; i++) for (let d = 0; d < 3; d++) o[d] += a[i * 3 + d] / 6; return o; })(), dot: (() => { const m = tape.group.children.find((c) => c.geometry.type === 'SphereGeometry'); if (!m) return null; m.geometry.computeBoundingSphere(); return m.geometry.boundingSphere.center.toArray(); })() }),
  face: () => { const F = bodyGeo.attributes.face; let alpha = 0; if (F) for (let i = 2; i < F.array.length; i += 3) if (F.array[i] > 0.05) alpha++; let morph = 0; const off = faceShapeOffsets(); if (off) for (const v of off) morph = Math.max(morph, Math.abs(v)); return { saved: !!face.saved, on: !!(face.saved && face.saved.on !== false), busy: face.busy, tone: face.tone || null, skin: skinColor(), alpha, morph, stored: !!faceRead() }; },
  cover: () => { const t = sel(); return t ? coverOf(t) : null; },
  covered: () => ({ text: $('#roomCover').hidden ? '' : $('#roomCover').textContent, list: room.on ? coverList() : null }),
  room: () => ({ on: room.on, fitId: room.fitId, text: $('#roomText').textContent, shown: !!(room.mesh && room.mesh.visible), need: room.need ? toInches(room.need * 2) : 0, at: (v) => { roomData(); return { across: toInches(room.across[v]), clear: toInches(room.clear[v]), cap: toInches(room.cap[v]), off: roomOff(v), fits: room.fitId ? roomFits(v) : null, place: painData().place[v] }; }, shares: () => inkShares(), summary: () => roomSummaryText(), regions: () => roomByRegion(roomData().across, painData().place, (v) => !roomOff(v)).map((r) => ({ region: r.region, across: toInches(r.across) })), fitsCount: () => { roomData(); let n = 0; for (let v = 0; v < PAIN_N; v++) if (room.fitId && roomFits(v)) n++; return n; }, pick: (id) => roomPick(state.tattoos.find((t) => t.id === id)), under: (x, y) => { const h = hitBody(x, y); if (!h || !h.face) return null; roomData(); const P = bodyGeo.attributes.position.array, vs = [h.face.a, h.face.b, h.face.c]; let v = vs[0], bd = Infinity; for (const u of vs) { const d = (P[u * 3] - h.point.x) ** 2 + (P[u * 3 + 1] - h.point.y) ** 2 + (P[u * 3 + 2] - h.point.z) ** 2; if (d < bd) { bd = d; v = u; } } return { v, off: roomOff(v), fits: room.fitId ? roomFits(v) : null, across: toInches(room.across[v]), place: painData().place[v], point: h.point.toArray() }; }, drawnAt: (v) => room.mesh ? Array.from(room.mesh.geometry.attributes.position.array.slice(v * 3, v * 3 + 3)) : null, colourAt: (v) => room.mesh ? Array.from(room.mesh.geometry.attributes.color.array.slice(v * 3, v * 3 + 3)) : null }),
  where: (id) => { const t = state.tattoos.find((q) => q.id === id); return t ? whereOf(t) : null; },
  estimate: (id) => { const t = state.tattoos.find((q) => q.id === id); const h = t && hoursOf(t); return h ? { ...h, text: sessionText(h, readRate()), stats: artStats(t) } : null; },
  cleanCheck: (f) => { const t = cleanState({ tattoos: [{ id: 'x', img: 'k', pos: [0, 1, 0.1], normal: [0, 0, 1], ...f }] }, () => true).state.tattoos[0]; const o = {}; if ('note' in t) o.note = t.note; if ('made' in t) o.made = t.made; if ('sittings' in t) o.sittings = t.sittings; return o; },
  madeText: (id) => { const t = state.tattoos.find((q) => q.id === id); return t ? madeText(t.made) : ''; },
  versions: (id) => { const t = state.tattoos.find((q) => q.id === id); return t ? versionList(t).map((v) => ({ name: v.name, now: v.now, img: v.img })) : []; },
  peek: () => (peek ? { id: peek.id, name: peek.v.name } : null),
  versionsShot: () => versionsShot(),
  sittings: (id) => { const t = state.tattoos.find((q) => q.id === id); return t ? sitPlan(t) : null; },
  line: () => $('#lineRow').hidden ? '' : $('#lineText').textContent + ($('#lineFix').hidden ? '' : ' | Straighten'),
  reads: () => $('#readRow').hidden ? '' : $('#readText').textContent + ($('#readFix').hidden ? '' : ' | ' + $('#readFix').textContent),
  wear: (id) => { const t = state.tattoos.find((q) => q.id === id); return t ? wearOf(t) : null; },
  planMessage: () => planMessageText(),
  planSits: () => { planSitsRender(sel()); return planSitsShown; },
  spotNotes: () => spotNotesShown,
  spotFit: () => spotFitLast, history: () => historyList(undoStack, state), undoSteps, flashShown: () => flashShown, splitFlash: (id) => splitFlash(id), stretchShown: () => stretchShown,
  labels: () => labelsLast,
  like: (id) => { const t = state.tattoos.find((q) => q.id === id); return t ? { text: likeOf(t), line: $('#likeLine').hidden ? '' : $('#likeLine').textContent } : null; },
  sitWear: (id) => { const t = state.tattoos.find((q) => q.id === id); return t ? { sleep: sleepLine(t.pos, t.normal), sleepLine: $('#sitSleep').hidden ? '' : $('#sitSleep').textContent, text: sitWearOf(t), shown: !$('#sitWear').hidden && !$('#sitBox').hidden, line: $('#sitWear').textContent } : null; },
  shows: (id) => { const t = state.tattoos.find((q) => q.id === id); return t ? { text: showsOf(t), shares: showsShares(t) } : null; },
  even: () => $('#evenRow').hidden ? '' : $('#evenLine').textContent + ($('#evenFix').hidden ? '' : ' | ' + $('#evenFix').textContent),
  sitShown: () => $('#sitBox').hidden ? null : [...$('#sitList').children].map((li) => li.textContent),
  planLine: () => $('#planLine').hidden ? '' : $('#planLine').textContent,
  gap: () => { const t = sel(); return t ? nearestGap(t) : null; }, gapPts: () => state.tattoos.map((t) => (inkPoints(t) || []).length / 3), gapText: () => $('#gap').hidden ? '' : $('#gap').textContent,
  bodyMatch: () => ({ open: !$('#bodyMatch').hidden, busy: bm.busy, fitted: !!bm.result, ratios: bm.ratios || null, read: bm.read || null, tone: bm.tone || null, skin: skinColor(), ink: bm.ink ? { pieces: bm.ink.pieces.map((p) => [p.x0, p.y0, p.x1, p.y1]), stats: bm.ink.pieces.map((p) => [+p.sharp.toFixed(3), +p.dark.toFixed(3), +p.mid.toFixed(3), +p.fill.toFixed(2), +p.cloth.toFixed(3), +p.out.toFixed(3), Math.round(p.area), Math.round(bm.ink.sw)]), on: [...bm.ink.on], view: bm.ink.view, mirror: bm.ink.mirror } : null }), bodyMatchLm: () => bm.lm || null,
  beforeAfter: () => ({ on: beforeAfter.on, split: beforeAfter.split }), hair: () => ({ ...hair }), beard: () => beard, setBeard: (s) => setBeard(s), beardStrands: () => ({ visible: beardStrands.mesh.visible, tucked: beardStrands.tucked, strands: beardStrands.mesh.userData.strands || 0, probe: beardStrands.probe(poseView.active ? poseView.geometry : null) }), beardCovers: (p) => beardStrands.covers(p), beardField: () => bodyGeo.attributes.beard && bodyGeo.attributes.beard.array, bodyHair: () => bodyHair, setBodyHair: (l) => setBodyHair(l), bodyHairField: () => bodyGeo.attributes.bhair && bodyGeo.attributes.bhair.array, bringBackPainted, bringBack, paintToTattoos, paintShown: () => !!(paintSkin && paintSkin.mesh.visible), paintAt: () => paintSkin ? { v: paintSkin.from[0], drawn: Array.from(paintSkin.mesh.geometry.attributes.position.array.slice(0, 3)) } : null, hairStrands: () => ({ visible: hairStrands.mesh.visible, tucked: hairStrands.tucked, strands: hairStrands.mesh.userData.strands || 0, probe: hairStrands.probe(poseView.active ? poseView.geometry : null) }), hairReading: (r) => applyHairReading(r), hairLast: () => hairLast, eyes: () => ({ pick: eyes, hex: skinIrisHex() }),
  hairProbe: () => {
    // brightness of a few spots on the head, looked at straight on, with this hair and with none
    const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array, lm = landmarks3D(P, bodyGeo.index.array, FACE_MAP);
    const nearest = (q) => { let b = 0, bd = Infinity; for (let v = 0; v < 13380; v++) { const d = (P[v * 3] - q[0]) ** 2 + (P[v * 3 + 1] - q[1]) ** 2 + (P[v * 3 + 2] - q[2]) ** 2; if (d < bd) { bd = d; b = v; } } return b; };
    let crown = 0; for (let v = 0; v < 13380; v++) if (P[v * 3 + 1] > P[crown * 3 + 1]) crown = v;
    let ear = 0; for (let v = 0; v < 13380; v++) if (Math.abs(P[v * 3 + 1] - lm[454][1]) < 0.012 && P[v * 3] > P[ear * 3]) ear = v;
    const spots = { crown, back: nearest([0, lm[454][1] + 0.025, -0.08]), forehead: nearest(lm[151]), cheek: nearest(lm[50]), ear, neck: nearest([0, lm[152][1] - 0.035, -0.08]) };
    const rt = new THREE.WebGLRenderTarget(32, 32), cam = new THREE.PerspectiveCamera(20, 1, 0.01, 10), px = new Uint8Array(4 * 32 * 32);
    const read = () => { const out = {}; for (const [k, v] of Object.entries(spots)) {
      const p = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]), n = new THREE.Vector3(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]).normalize();
      cam.position.copy(p).addScaledVector(n, 0.12); cam.lookAt(p); cam.updateMatrixWorld();
      renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 12, 12, 8, 8, px); renderer.setRenderTarget(null);
      let sum = 0; for (let i = 0; i < 64; i++) sum += 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; out[k] = sum / 64;
    } return out; };
    const decalsWere = decalGroup.visible; decalGroup.visible = false;
    const withHair = read(); setSkinHair('none'); const plain = read(); setSkinHair(hair.style, hairHex(hair));
    decalGroup.visible = decalsWere; rt.dispose(); needsRender = true;
    const r = {}; for (const k of Object.keys(spots)) { r[k] = withHair[k]; r[k + 'Plain'] = plain[k]; } return r;
  }, compareLast: () => compareLast, agingLast: () => agingLast, posesLast: () => posesLast,
  aging: () => agingYears, setAging: (y) => setAging(y),
  clothes: () => ({ ...clothes.choice, report: clothesReport(), meshes: clothes.meshes().map((m) => ({ visible: m.visible, tris: m.geometry.index ? m.geometry.index.count / 3 : 0 })) }), setClothes: (next) => setClothes(next), clothesBounds: () => { clothes.sync(shapeKey, poseView.version); const [top, bottom, hair] = clothes.meshes().map((m) => { const g = m.geometry; if (!g.index) return null; const P = g.attributes.position.array, I = g.index.array, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const v of I) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[v * 3 + k]); max[k] = Math.max(max[k], P[v * 3 + k]); } return { min, max }; }); return { top, bottom, hair }; },
  pose: () => ({ active: poseView.active, key: poseView.key, settled: poseView.settled(), ...poseView.motion }), setPose: (k) => { poseView.choose(k); renderPose(); }, setPoseRotations: (r) => { poseView.setCustom(r, { animate: false }); renderPose(); }, scrubMotion: (kind, phase) => { poseView.scrub(phase, kind); renderPose(); }, viewSpot: (id) => viewSpot(state.tattoos.find((t) => t.id === id)), hitBody: (x, y) => { const h = hitBody(x, y); return h && { point: h.point.toArray(), normal: h.normal.toArray(), faceIndex: h.faceIndex, bary: h.barycoord ? h.barycoord.toArray() : null }; }, findFace: async (url) => { const { findFace } = await import('./face.js'); const img = new Image(); img.src = url; await img.decode(); const lm = await findFace(img); return lm && lm.map((p) => [p.x, p.y, p.z]); }, posedGeometry: () => poseView.geometry, setBeforeAfterSplit: (v) => beforeAfter.setSplit(v),
  pixelAt: (x, y) => { drawFrame(); const gl = renderer.getContext(), r = renderer.getPixelRatio(), out = new Uint8Array(4); gl.readPixels(Math.round(x * r), Math.round(canvas.height - y * r - 1), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out); return [...out]; }, updateReady: onUpdateReady, updatePending: () => updateReady, settled: () => booted && !camMoving && Math.abs(goalInset - curInset) <= 0.5 && ['phi','r','tx','ty','tz'].every((k) => Math.abs(goal[k] - cur[k]) < 1e-3) && Math.abs(wrapAngle(goal.theta - cur.theta)) < 1e-3 && Math.abs(wrapAngle((goal.roll || 0) - (cur.roll || 0))) < 1e-3, inkIdsAt, selected:()=>selectedId, cur, goal, importBackup, importPainted, tapPlace:()=>tapPlaceId, liveGuides:()=>liveGuidePlan?{...structuredClone(liveGuidePlan),snapped:guideSnapApplied}:null, cameraUp:()=>camera.up.toArray(), cameraQuaternion:()=>camera.quaternion.toArray(), projectPoint:p=>screenOf(new V3(...p)),surfaceHit:(o,d)=>surfaceAt(new V3(...o),new V3(...d)),painting:()=>paint?paint.tris.size:0,
  setShape: (patch) => { reshape(() => { Object.assign(state, patch); }); commit(); },
  loadState: (s) => { state = s; selectedId = null; skinMat.color.set(skinColor()); adoptState(); commit(); },
  positions: () => bodyGeo.attributes.position.array, v1Positions: shapePositionsV1,
  store: () => store, flush: flushSave, account: () => account && account.status(), accountApi: () => account, undo, saved: () => ({ dirty, saving, text: $('#saved').textContent }),
  surfaceAt: (o, d) => surfaceAt(new V3(...o), new V3(...d)), addArt: (url, name, place) => addImage(url, name, place), commitTest: commit, grabsAt: (x, y, slop = 0) => onSelectedInk(x, y, slop), uvAt: (x, y) => { const t = sel(), d = t && decals[t.id], h = hitBody(x, y); if (!d || !h) return null; ray.setFromCamera(ndc(x, y), camera); const q = poseView.withPosed(() => ray.intersectObject(d.mesh, false), [d.mesh]).find((q) => Math.abs(q.distance - h.distance) < 0.012); return q && q.uv ? [q.uv.x, q.uv.y] : null; }, wrapShare: (id) => { const w = wrapInfo(state.tattoos.find((q) => q.id === id)); return w ? { share: w.share, limb: w.L.key, r: w.at.r } : null; }, wrapRound: (id) => wrapRound(state.tattoos.find((q) => q.id === id)), girthHere: (id) => girthHere(state.tattoos.find((q) => q.id === id)), gestMode: () => (gest ? (gest.limb ? 'wrap' : gest.mode) : null), cam: () => [camera.position.x, camera.position.y, camera.position.z].map((v) => +v.toFixed(4)), select: (id) => select(id, false), screenOfPos: (p) => { const v = screenOf(new V3(...p)); return { x: v.x, y: v.y }; }, pins: () => ({ on: pins.on, n: pinNotes().length, openCount: pinNotes().filter((n) => !n.done).length, listShown: !$('#pinList').hidden, listItems: [...document.querySelectorAll('#pinListItems li')].map((li) => li.textContent), replies: document.querySelectorAll('#pinReplies li').length, resolveLabel: $('#pinResolve').textContent, canDelete: !$('#pinDelete').hidden, pending: !!pins.pending, open: pins.open, shown: [...pins.els.values()].filter((e) => !e.b.hidden).length, label: $('#pinsBtn').textContent }), pinsOn, openPin, turnToPin, answerShown: () => !$('#approveRow').hidden, imageOf: (k) => images[k], commentOnly: () => commentOnly, suggesting: () => (suggesting ? suggesting.id : null), undoLen: () => undoStack.length, refs: () => ({ open: !$('#refs').hidden, viewing: refsUi.open, tiles: document.querySelectorAll('#refsGrid .refTile').length, count: $('#bRefs').textContent }),
  // how much of each artwork lands on the skin (share of its rectangle covered) and how evenly
  // (the worst 10% of triangles' skin area per picture area, against the piece's own scale)
  decalSpan: (axis = [0, 1, 0]) => state.tattoos.map((t) => { const d = decals[t.id], P = d && d.mesh.geometry.attributes.position.array, UV = d && d.mesh.geometry.attributes.uv.array; let lo = Infinity, hi = -Infinity; if (P) for (let f = 0; f < P.length / 9; f++) { const u = (UV[f * 6] + UV[f * 6 + 2] + UV[f * 6 + 4]) / 3, v = (UV[f * 6 + 1] + UV[f * 6 + 3] + UV[f * 6 + 5]) / 3; if (u < UV_MARGIN || u > 1 - UV_MARGIN || v < UV_MARGIN || v > 1 - UV_MARGIN) continue; let y = 0; for (let k = 0; k < 3; k++) { const i = f * 9 + k * 3; y += (P[i] * axis[0] + P[i + 1] * axis[1] + P[i + 2] * axis[2]) / 3; } lo = Math.min(lo, y); hi = Math.max(hi, y); } return { name: t.name, lo, hi, y: t.pos[1], tris: P ? P.length / 9 : 0 }; }), restJoint: (n) => { const J = poseView.restRig().joints, b = POSE_BONES.find((x) => x.name === n); return b ? [0, 1, 2].map((i) => J[b.head * 3 + i]) : null; }, decalCover: () => state.tattoos.map((t) => { const d = decals[t.id], g = d && d.mesh.geometry; if (!g || !g.attributes.uv) return { name: t.name, cover: 0, stretch: 0 };
    const P = g.attributes.position.array, UV = g.attributes.uv.array, n = 64, grid = new Uint8Array(n * n), m = UV_MARGIN, sp = 1 - 2 * m, scale = t.width * (t.width / t.aspect), ratios = [];
    for (let i = 0; i < UV.length / 2; i += 3) { const u = [0, 1, 2].map((k) => (UV[(i + k) * 2] - m) / sp), v = [0, 1, 2].map((k) => (UV[(i + k) * 2 + 1] - m) / sp);
      const ua = Math.abs((u[1] - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (v[1] - v[0])) / 2; const A = [0, 1, 2].map((k) => [P[(i + k) * 3], P[(i + k) * 3 + 1], P[(i + k) * 3 + 2]]);
      const e1 = A[1].map((x, j) => x - A[0][j]), e2 = A[2].map((x, j) => x - A[0][j]), cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], sa = Math.hypot(...cr) / 2;
      const inside = u.every((x) => x > 0.02 && x < 0.98) && v.every((x) => x > 0.02 && x < 0.98); if (ua > 1e-7 && inside) ratios.push(sa / (ua * scale));
      const x0 = Math.max(0, Math.floor(Math.min(...u) * n)), x1 = Math.min(n - 1, Math.ceil(Math.max(...u) * n)), y0 = Math.max(0, Math.floor(Math.min(...v) * n)), y1 = Math.min(n - 1, Math.ceil(Math.max(...v) * n));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const px = (x + 0.5) / n, py = (y + 0.5) / n, s1 = (u[1] - u[0]) * (py - v[0]) - (v[1] - v[0]) * (px - u[0]), s2 = (u[2] - u[1]) * (py - v[1]) - (v[2] - v[1]) * (px - u[1]), s3 = (u[0] - u[2]) * (py - v[2]) - (v[0] - v[2]) * (px - u[2]); if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) grid[y * n + x] = 1; } }
    let c = 0; for (const x of grid) c += x; ratios.sort((a, b) => a - b); return { name: t.name, cover: c / (n * n), stretch: ratios.length ? ratios[Math.floor(ratios.length * 0.9)] : 0, low: ratios.length ? ratios[Math.floor(ratios.length * 0.1)] : 0 }; }),
  decalReach: () => state.tattoos.map((t) => { const d = decals[t.id], g = d && d.mesh.geometry, P = g && g.attributes.position ? g.attributes.position.array : []; let max = 0; for (let i = 0; i < P.length; i += 3) { const dist = Math.hypot(P[i] - t.pos[0], P[i + 1] - t.pos[1], P[i + 2] - t.pos[2]); if (dist > max) max = dist; } return { name: t.name, tris: P.length / 9, max, w: t.width, h: t.width / t.aspect }; }),
};
