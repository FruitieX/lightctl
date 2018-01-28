const EventEmitter = require('events');
const R = require('ramda');

let state = {};
const changeEmitter = new EventEmitter();

const get = path => R.view(R.lensPath(path), state);
const set = (path, value) => {
  const oldState = state;
  state = R.set(R.lensPath(path), value, state);
  const subState = get(path);

  // Notify all subscribers at this and all parent levels
  while (path.length) {
    path = R.init(path);
    changeEmitter.emit(path.toString(), state, oldState);
  }

  return subState;
};
const subscribe = (path, f) => changeEmitter.on(path.toString(), f);

module.exports = {
  get,
  set,
  subscribe,
};
