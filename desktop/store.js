'use strict';
/* 数据层：读写 state.json（原子写），以及节点 id 分配 */
const fs = require('fs');
const path = require('path');

let DATA_DIR = null;
let FILES_DIR = null;
let STATE_PATH = null;

function init(dir) {
  DATA_DIR = dir;
  FILES_DIR = path.join(dir, 'files');
  STATE_PATH = path.join(dir, 'state.json');
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

let state = null;

function load() {
  if (fs.existsSync(STATE_PATH)) {
    state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } else {
    state = {
      projects: [
        { id: 'p_default', name: '默认项目', lane: 0, color: '#5aa9d6', keywords: [] },
      ],
      types: [
        { id: 'plan', name: '方案', color: '#5aa9d6', fields: [] },
        { id: 'decision', name: '决策', color: '#e06c62', fields: [{ key: '结论', kind: '文本' }] },
        { id: 'asset', name: '资产', color: '#7fb069', fields: [] },
        { id: 'retro', name: '复盘', color: '#9b8ad4', fields: [] },
        { id: 'version', name: '版本', color: '#8d9aa8', fields: [] },
      ],
      nodes: [], edges: [], queue: [], choices: [], edits: [],
      meta: { name: '项目Git', version: 1 },
    };
  }
  state.queue = state.queue || [];
  state.choices = state.choices || [];
  state.edits = state.edits || [];
  state.edges = state.edges || [];
  return state;
}

function save() {
  const tmp = STATE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1), 'utf8');
  fs.renameSync(tmp, STATE_PATH);
}

function get() { return state; }

const undoStack = [];
const redoStack = [];
const snap = () => JSON.stringify({ nodes: state.nodes, edges: state.edges });

function pushUndo() {
  undoStack.push(snap());
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snap());
  const s = JSON.parse(undoStack.pop());
  state.nodes = s.nodes; state.edges = s.edges;
  save(); return true;
}
function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snap());
  const s = JSON.parse(redoStack.pop());
  state.nodes = s.nodes; state.edges = s.edges;
  save(); return true;
}

function nodeById(id) { return state.nodes.find((n) => n.id === id) || null; }

function nextId(prefix = 'n') {
  let i = state.nodes.length + 1;
  while (nodeById(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}

function dataDir() { return DATA_DIR; }
function filesDir() { return FILES_DIR; }

module.exports = { init, load, save, get, pushUndo, undo, redo, nodeById, nextId, dataDir, filesDir };
