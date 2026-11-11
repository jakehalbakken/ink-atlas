import sys, struct, base64, json, os
src_dir, out = sys.argv[1], sys.argv[2]
keep = {'body', 'helper-l-eye', 'helper-r-eye'}
verts = []; faces = []; g = None
for line in open(os.path.join(src_dir, 'base.obj'), encoding='utf-8', errors='replace'):
    if line.startswith('v '):
        p = line.split(); verts.append((float(p[1]), float(p[2]), float(p[3])))
    elif line.startswith('g '):
        g = line.split()[1]
    elif line.startswith('f ') and g in keep:
        idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
        for i in range(1, len(idx) - 1):
            faces.append((idx[0], idx[i], idx[i + 1]))
used = sorted({i for f in faces for i in f})
remap = {v: i for i, v in enumerate(used)}
n = len(used)
def target(name):
    d = [0.0] * (n * 3)
    for line in open(os.path.join(src_dir, name + '.target'), encoding='utf-8', errors='replace'):
        if line.startswith('#') or not line.strip(): continue
        p = line.split(); i = int(p[0])
        if i in remap:
            j = remap[i] * 3; d[j] = float(p[1]); d[j+1] = float(p[2]); d[j+2] = float(p[3])
    return d
def avg(names):
    ds = [target(x) for x in names]
    return [sum(v) / len(ds) for v in zip(*ds)]
sets = {
  'male': avg(['caucasian-male-young', 'african-male-young', 'asian-male-young']),
  'female': avg(['caucasian-female-young', 'african-female-young', 'asian-female-young']),
  'mMuscle': target('universal-male-young-maxmuscle-averageweight'),
  'mLight': target('universal-male-young-averagemuscle-minweight'),
  'mHeavy': target('universal-male-young-averagemuscle-maxweight'),
  'fMuscle': target('universal-female-young-maxmuscle-averageweight'),
  'fLight': target('universal-female-young-averagemuscle-minweight'),
  'fHeavy': target('universal-female-young-averagemuscle-maxweight'),
}
base = b''.join(struct.pack('<3f', *verts[i]) for i in used)
ind = b''.join(struct.pack('<3H', remap[a], remap[b], remap[c]) for a, b, c in faces)
o = ['export const BODY_BASE="%s";' % base64.b64encode(base).decode(), 'export const BODY_IDX="%s";' % base64.b64encode(ind).decode()]
D = {}
for k, d in sets.items():
    m = max(abs(x) for x in d) or 1.0
    q = struct.pack('<%dh' % len(d), *[int(round(x / m * 32767)) for x in d])
    D[k] = {'s': m / 32767, 'd': base64.b64encode(q).decode()}
    print(k, 'max delta', round(m, 3))
o.append('export const DELTAS=' + json.dumps(D) + ';')
open(out, 'w').write('\n'.join(o) + '\n')
