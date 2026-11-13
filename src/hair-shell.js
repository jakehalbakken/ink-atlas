// Short hair with some volume: a thin shell over the scalp, drawn from the body's own mesh. Each
// vertex moves out along its normal by how far it sits inside the hairline (the body's 'hair'
// attribute, from hair.js), so the shell grows from nothing at the hairline to its full depth on
// top. It always draws whatever geometry the body has (standing or posed), so it follows every
// shape and pose without a mesh of its own. Strands are shaded in the fragment shader.
export function createHairShell({ THREE, body }) {
  const U = { uThick: { value: 0.012 }, uHairCol: { value: new THREE.Color('#3b2a1f') } };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color('#3b2a1f'), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float hair;\nuniform float uThick;\nvarying float vHairS;\nvarying vec3 vPosS;\nvarying vec3 vNorS;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vHairS = hair; vec3 nn = normalize(objectNormal);
  // full depth a little inside the hairline, more on top of the head than at the sides
  float th = uThick * smoothstep(-0.002, 0.016, hair) * (0.7 + 0.5 * max(0.0, nn.y));
  transformed += nn * th; vPosS = transformed; vNorS = nn;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uHairCol;
varying float vHairS;
varying vec3 vPosS;
varying vec3 vNorS;
float hsHash(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float hsNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hsHash(i),hsHash(i+vec3(1,0,0)),f.x),mix(hsHash(i+vec3(0,1,0)),hsHash(i+vec3(1,1,0)),f.x),f.y),
  mix(mix(hsHash(i+vec3(0,0,1)),hsHash(i+vec3(1,0,1)),f.x),mix(hsHash(i+vec3(0,1,1)),hsHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float hsStrands;
// strands lie along the way the hair falls: forward on top, down at the sides and back
float hsField(vec3 p, vec3 n) {
  vec3 flow = mix(vec3(0.0, -1.0, -0.25), vec3(0.0, 0.25, 1.0), smoothstep(0.35, 0.9, n.y));
  flow = normalize(flow - n * dot(flow, n) + vec3(1e-4));
  vec3 across = normalize(cross(n, flow));
  float a = dot(p, flow), c = dot(p, across);
  return hsNoise(vec3(c * 2400.0, a * 140.0, 0.5)) * 0.55 + hsNoise(vec3(c * 5200.0, a * 300.0, 3.5)) * 0.3 + hsNoise(vec3(c * 600.0, a * 60.0, 7.5)) * 0.15;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    // a ragged edge at the hairline, where the shell is thin and the painted hair below shows
    float edge = vHairS + (hsNoise(vPosS * 900.0) * 0.6 + hsNoise(vPosS * 260.0) * 0.4 - 0.5) * 0.004;
    if (edge < 0.0015) discard;
    hsStrands = hsField(vPosS, normalize(vNorS));
    float clump = hsNoise(vPosS * 160.0);
    diffuseColor.rgb = uHairCol * (0.55 + 0.75 * hsStrands) * (0.85 + 0.3 * clump);
  }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    float hb = hsStrands * 0.00025;
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection;
    vec3 grad = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
    normal = normalize(abs(det) * normal - grad);
  }`);
  };
  const mesh = new THREE.Mesh(body.geometry, mat);
  // always the body's current geometry: the posed body is swapped in only while it draws
  Object.defineProperty(mesh, 'geometry', { get: () => body.geometry, set: () => {}, configurable: true });
  mesh.raycast = () => {}; mesh.visible = false; mesh.renderOrder = 1; mesh.userData.notBody = true;
  body.add(mesh);
  return {
    mesh,
    set(style, colour) {
      mesh.visible = style === 'crop' || style === 'medium';
      U.uThick.value = style === 'medium' ? 0.0035 : 0.012; // under strands, only a thin dark base
      if (colour) { U.uHairCol.value.set(colour); mat.sheenColor.set(colour).lerp(new THREE.Color('#ffffff'), 0.35); }
    },
  };
}

// Medium hair: strands from hair-strands.js over the Short shell. Built on the rest body when the
// style is first shown or the head's shape changes; in a pose it follows the skull as one piece
// (the head barely bends), read from four skull vertices each time it draws.
export function createHairStrands({ THREE, body, build, skullMove }) {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x3b2a1f, roughness: 0.55, metalness: 0, sheen: 0.3, sheenRoughness: 0.4, sheenColor: new THREE.Color('#5a4535'), side: THREE.DoubleSide, vertexColors: true });
  // both sides of a ribbon light as the outside of the hair (three.js would light the back side
  // as if it faced into the head, which shows as dark spikes)
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize( vNormal );\nvec3 nonPerturbedNormal = normal;'); };
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.raycast = () => {}; mesh.visible = false; mesh.renderOrder = 2; mesh.userData.notBody = true; mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  body.add(mesh);
  let builtFor = null, anchors = null, restCopy = null, want = false;
  const m4 = new THREE.Matrix4();
  function rebuild() {
    const geo = body.geometry, key = geo.userData.hairKey;
    if (!want || !key || key === builtFor || !geo.attributes.hair) return;
    const R = geo.attributes.rest ? geo.attributes.rest.array : geo.attributes.position.array;
    const s = build(R, geo.attributes.normal.array, geo.index.array, geo.attributes.hair.array);
    builtFor = key; if (!s) { mesh.visible = false; return; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(s.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(s.normal, 3));
    const col = new Float32Array(s.shade.length * 3); for (let i = 0; i < s.shade.length; i++) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = s.shade[i];
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(s.index, 1));
    mesh.geometry.dispose(); mesh.geometry = g;
    anchors = s.anchors; restCopy = Float32Array.from(anchors.flatMap((v) => [R[v * 3], R[v * 3 + 1], R[v * 3 + 2]]));
    mesh.visible = true;
  }
  mesh.onBeforeRender = () => {
    // in a pose the body's geometry is the posed one while it draws
    const geo = body.geometry;
    if (!geo.attributes.rest || !anchors) { mesh.matrix.identity(); }
    else {
      const P = geo.attributes.position.array;
      const now = Float32Array.from(anchors.flatMap((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]));
      mesh.matrix.fromArray(skullMove(restCopy, now, [0, 1, 2, 3]));
    }
    mesh.matrixWorld.multiplyMatrices(body.matrixWorld, mesh.matrix);
  };
  return {
    mesh,
    set(style, colour) {
      want = style === 'medium'; mesh.visible = want && !!anchors && builtFor === body.geometry.userData.hairKey;
      if (colour) { mat.color.set(colour); mat.sheenColor.set(colour).lerp(new THREE.Color('#ffffff'), 0.15); }
      if (want) rebuild();
    },
    update() { if (want) rebuild(); },
    // for tests: how far the first root sits from each skull anchor, at rest and as last drawn
    probe(posed) {
      const g = mesh.geometry; if (!anchors || !g.attributes.position) return null;
      const a = g.attributes.position.array, root = new THREE.Vector3((a[0] + a[3]) / 2, (a[1] + a[4]) / 2, (a[2] + a[5]) / 2);
      const now = root.clone().applyMatrix4(mesh.matrix), P = posed ? posed.attributes.position.array : null;
      return anchors.map((v, i) => {
        const rest = new THREE.Vector3(restCopy[i * 3], restCopy[i * 3 + 1], restCopy[i * 3 + 2]).distanceTo(root);
        const drawn = P ? new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).distanceTo(now) : null;
        return [rest, drawn];
      });
    },
  };
}
