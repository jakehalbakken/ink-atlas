import assert from 'node:assert/strict';
import {imageKeysFor} from '../../src/project.js';
const board={id:'b',entryIds:['old'],entries:{old:{sourceKey:'original',outputKey:'cleaned'}}};
assert.deepEqual(new Set(imageKeysFor({tattoos:[],artworkBoards:[board]})),new Set(['original','cleaned']));
assert.deepEqual(new Set(imageKeysFor({tattoos:[],layouts:[{state:{tattoos:[],artworkBoards:[board]}}]})),new Set(['original','cleaned']));
assert.deepEqual(imageKeysFor({tattoos:[],artworkBoards:null}),[]);
console.log('PASS board-only artwork retained by active and historical asset traversal');
