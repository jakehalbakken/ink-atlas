# Bake the MakeHuman base mesh and shape targets into src/body.js.
#   python3 -I tools/mesh.py data-src src/body.js
# Vertex order is body, then eyes, then the genital geometry, so body and eye
# indices never change when later groups are added (saved anchors depend on it).
# MakeHuman's genital helper is very low-poly, so it is Catmull-Clark subdivided
# here. Subdivision is linear, so every shape target is carried through exactly.
import sys, struct, base64, json, os

src_dir, out = sys.argv[1], sys.argv[2]
dirs = [src_dir, os.path.join(src_dir, 'mh-targets')]
PARTS = [('body', {'body'}), ('eyes', {'helper-l-eye', 'helper-r-eye'}), ('genital', {'helper-genital'})]
GENITAL_LEVELS = 1
part_of = {g: name for name, gs in PARTS for g in gs}

verts = []; polys = {name: [] for name, _ in PARTS}; group_verts = {}; g = None
for line in open(os.path.join(src_dir, 'base.obj'), encoding='utf-8', errors='replace'):
    if line.startswith('v '):
        p = line.split(); verts.append((float(p[1]), float(p[2]), float(p[3])))
    elif line.startswith('g '):
        g = line.split()[1]
    elif line.startswith('f ') and g in part_of:
        idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
        group_verts.setdefault(g, set()).update(idx); polys[part_of[g]].append(idx)

def mix(pairs):
    o = {}
    for c, w in pairs:
        for k, v in c.items(): o[k] = o.get(k, 0.0) + v * w
    return o

def subdivide(faces, pts):
    """One Catmull-Clark step. pts are weighted combinations of original OBJ vertices."""
    fpts = [mix([(pts[v], 1.0 / len(f)) for v in f]) for f in faces]
    edge_faces = {}; v_faces = {}; v_edges = {}
    for fi, f in enumerate(faces):
        for j, v in enumerate(f):
            e = tuple(sorted((v, f[(j + 1) % len(f)]))); edge_faces.setdefault(e, []).append(fi)
            v_faces.setdefault(v, []).append(fi)
    for e in edge_faces:
        for v in e: v_edges.setdefault(v, []).append(e)
    mid = lambda e: mix([(pts[e[0]], .5), (pts[e[1]], .5)])
    epts = {e: (mix([(mid(e), .5), (fpts[fs[0]], .25), (fpts[fs[1]], .25)]) if len(fs) == 2 else mid(e)) for e, fs in edge_faces.items()}
    new = []
    for v in range(len(pts)):
        es = v_edges.get(v, []); fs = v_faces.get(v, [])
        border = [e for e in es if len(edge_faces[e]) != 2]
        if not es or (border and len(border) != 2): new.append(pts[v])
        elif border: new.append(mix([(pts[v], .75)] + [(pts[e[0] if e[1] == v else e[1]], .125) for e in border]))
        else:
            n = float(len(fs))
            new.append(mix([(fpts[f], 1 / n / n) for f in fs] + [(mid(e), 2 / n / n) for e in es] + [(pts[v], (n - 3) / n)]))
    eidx = {}
    for e in epts: eidx[e] = len(new); new.append(epts[e])
    f0 = len(new); new += fpts
    quads = []
    for fi, f in enumerate(faces):
        k = len(f)
        for j, a in enumerate(f):
            quads.append([a, eidx[tuple(sorted((a, f[(j + 1) % k])))], f0 + fi, eidx[tuple(sorted((f[j - 1], a)))]])
    return quads, new

# body and eyes keep their OBJ vertices one to one
plain = sorted({i for name in ('body', 'eyes') for f in polys[name] for i in f})
assert max(group_verts['body']) < min(group_verts['helper-l-eye'] | group_verts['helper-r-eye']), 'body must come before eyes'
remap = {v: i for i, v in enumerate(plain)}
# genital geometry: local ids over its own OBJ vertices, then subdivide
gsrc = sorted({i for f in polys['genital'] for i in f}); glocal = {v: i for i, v in enumerate(gsrc)}
gfaces = [[glocal[i] for i in f] for f in polys['genital']]; gpts = [{v: 1.0} for v in gsrc]
for _ in range(GENITAL_LEVELS): gfaces, gpts = subdivide(gfaces, gpts)
# The helper is an open shell whose rim lies almost flush with the skin, which shows as
# slivers. Sink the rim and the few rings next to it back under the skin (a fixed offset
# that fades out by ring, on top of the normal shape targets).
ys = [verts[i][1] for i in group_verts['body']]; H = max(ys) - min(ys)
directed = {(f[j], f[(j + 1) % len(f)]) for f in gfaces for j in range(len(f))}
near = {}
for a, b in directed: near.setdefault(a, set()).add(b); near.setdefault(b, set()).add(a)
ring = {v: 0 for e in directed if (e[1], e[0]) not in directed for v in e}; front = list(ring)
while front:
    nxt = []
    for v in front:
        for u in near[v]:
            if u not in ring: ring[u] = ring[v] + 1; nxt.append(u)
    front = nxt
SINK = [1.0, 0.8, 0.5, 0.22]
goff = [tuple(c * (SINK[ring[v]] if ring.get(v, 99) < len(SINK) else 0.0) for c in (0.0, 0.006 * H, -0.024 * H)) for v in range(len(gpts))]
g0 = len(plain); n = g0 + len(gpts)
needed = set(plain) | set(gsrc)
counts = {'body': len(group_verts['body']), 'eyes': len(plain) - len(group_verts['body']), 'genital': len(gpts)}

def spread(raw):
    """OBJ-indexed vectors -> baked-vertex-indexed vectors."""
    o = {remap[i]: v for i, v in raw.items() if i in remap}
    for j, combo in enumerate(gpts):
        x = y = z = 0.0; hit = False
        for k, w in combo.items():
            d = raw.get(k)
            if d: x += d[0] * w; y += d[1] * w; z += d[2] * w; hit = True
        if hit: o[g0 + j] = (x, y, z)
    return o

basepos = spread({i: verts[i] for i in needed}); basepos = [basepos[i] for i in range(n)]
for j, d in enumerate(goff): basepos[g0 + j] = tuple(basepos[g0 + j][k] + d[k] for k in range(3))

def read(name):
    for d in dirs:
        path = os.path.join(d, name + '.target')
        if os.path.exists(path): break
    else:
        raise SystemExit('missing target ' + name)
    raw = {}
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('#') or not line.strip(): continue
        p = line.split(); i = int(p[0])
        if i in needed: raw[i] = (float(p[1]), float(p[2]), float(p[3]))
    return spread(raw)

def combine(names, scale=1.0):
    o = {}
    for nm in names:
        for i, v in read(nm).items():
            a = o.get(i, (0.0, 0.0, 0.0)); o[i] = (a[0] + v[0] * scale, a[1] + v[1] * scale, a[2] + v[2] * scale)
    return o

T = {}
# gender (average of the three ethnic macros, as before)
T['male'] = combine(['caucasian-male-young', 'african-male-young', 'asian-male-young'], 1 / 3)
T['female'] = combine(['caucasian-female-young', 'african-female-young', 'asian-female-young'], 1 / 3)
# muscle x weight grid; the average/average cell is the zero target
for gk, gn in (('m', 'male'), ('f', 'female')):
    for mu in ('min', 'average', 'max'):
        for we in ('min', 'average', 'max'):
            if mu == 'average' and we == 'average': continue
            T['%s_%s_%s' % (gk, mu[:3], we[:3])] = read('universal-%s-young-%smuscle-%sweight' % (gn, mu, we))
# breast cup x firmness grid (female, average build)
for cup in ('min', 'average', 'max'):
    for firm in ('min', 'average', 'max'):
        if cup == 'average' and firm == 'average': continue
        T['cup_%s_%s' % (cup[:3], firm[:3])] = read('female-young-averagemuscle-averageweight-%scup-%sfirmness' % (cup, firm))
# two-sided sliders: key -> MakeHuman target stem (decr = key0, incr = key1). Keep in step with src/fit.js.
PAIRS = {
    'shoulders': 'measure-shoulder-dist', 'chest': 'measure-bust-circ', 'waist': 'measure-waist-circ', 'hips': 'measure-hips-circ',
    'torsoLen': 'measure-napetowaist-dist', 'depth': 'torso-scale-depth', 'back': 'torso-muscle-dorsi', 'pecs': 'torso-muscle-pectoral',
    'belly': 'stomach-pregnant', 'abs': 'stomach-tone', 'butt': 'buttocks-volume',
    'upperArmLen': 'measure-upperarm-length', 'foreArmLen': 'measure-lowerarm-length', 'upperArmSize': 'measure-upperarm-circ',
    'thighLen': 'measure-upperleg-height', 'shinLen': 'measure-lowerleg-height', 'thighSize': 'measure-thigh-circ', 'calfSize': 'measure-calf-circ',
    'neckLen': 'measure-neck-height', 'neckSize': 'measure-neck-circ',
    'breastGap': 'breast-dist', 'nippleSize': 'nipple-size',
    'penisLen': 'penis-length', 'penisGirth': 'penis-circ', 'testicles': 'penis-testicles',
}
for key, stem in PAIRS.items():
    T[key + '0'] = read(stem + '-decr'); T[key + '1'] = read(stem + '-incr')
for key, stem in (('hand', 'hand-scale'), ('foot', 'foot-scale')):
    T[key + '0'] = combine(['l-%s-decr' % stem, 'r-%s-decr' % stem]); T[key + '1'] = combine(['l-%s-incr' % stem, 'r-%s-incr' % stem])

def peak(d, side=0):
    best, bm = -1, -1.0
    for i, v in d.items():
        if side and basepos[i][0] * side <= 0: continue
        m = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
        if m > bm: bm, best = m, i
    return best

nip = read('nipple-point-incr')
marks = {'nipL': peak(nip, 1), 'nipR': peak(nip, -1), 'navel': peak(read('stomach-navel-in'))}
eyes = {}
for key, grp in (('l', 'helper-l-eye'), ('r', 'helper-r-eye')):
    s = sorted(remap[i] for i in group_verts[grp])
    assert s[-1] - s[0] + 1 == len(s), 'eye verts must be contiguous'
    eyes[key] = [s[0], len(s)]

# lips mask from the mouth-ring bone weights
W = json.load(open(os.path.join(src_dir, 'rig', 'default_weights.mhw')))['weights']
lips = [0.0] * n
for bone, pairs in W.items():
    if bone.startswith('oris'):
        for i, w in pairs:
            if i in remap: lips[remap[i]] += w
lips_b = bytes(min(255, int(round(x * 255))) for x in lips)

def tris(faces, off=0, rm=None):
    b = b''
    for f in faces:
        idx = [(rm[i] if rm else i) + off for i in f]
        for i in range(1, len(idx) - 1): b += struct.pack('<3H', idx[0], idx[i], idx[i + 1])
    return b

b64 = lambda b: base64.b64encode(b).decode()
o = [
    '// Generated by tools/mesh.py. Do not edit by hand.',
    'export const BODY_BASE="%s";' % b64(b''.join(struct.pack('<3f', *p) for p in basepos)),
    'export const BODY_IDX="%s";' % b64(tris(polys['body'] + polys['eyes'], 0, remap)),
    'export const BODY_IDX_GENITAL="%s";' % b64(tris(gfaces, g0)),
    'export const COUNTS=%s;' % json.dumps(counts),
    'export const MARKS=%s;' % json.dumps(marks),
    'export const EYES=%s;' % json.dumps(eyes),
    'export const LIPS="%s";' % b64(lips_b),
]
D = {}; total = 0
for k, d in T.items():
    m = max((max(abs(c) for c in v) for v in d.values()), default=0.0) or 1.0
    idx = []; q = []
    for i in sorted(d):
        v = [int(round(c / m * 32767)) for c in d[i]]
        if v[0] or v[1] or v[2]: idx.append(i); q += v
    D[k] = {'s': m / 32767, 'i': b64(struct.pack('<%dH' % len(idx), *idx)), 'd': b64(struct.pack('<%dh' % len(q), *q))}
    total += len(idx)
o.append('export const TARGETS=' + json.dumps(D) + ';')
open(out, 'w').write('\n'.join(o) + '\n')
print('verts', n, counts, 'targets', len(D), 'sparse entries', total, 'marks', marks, 'eyes', eyes)
print('body.js', round(os.path.getsize(out) / 1e6, 2), 'MB')
