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
      mesh.visible = style === 'crop';
      if (colour) { U.uHairCol.value.set(colour); mat.sheenColor.set(colour).lerp(new THREE.Color('#ffffff'), 0.35); }
    },
  };
}
