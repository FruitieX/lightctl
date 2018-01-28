/*
 * lights
 */

const convert = require('color-convert');
const request = require('request-promise-native');
const forEach = require('lodash/forEach');
const uuidv4 = require('uuid/v4');

let state = {
  luminaires: [],
  changesToDispatch: [],
  willDispatch: false,
};
let server;

const dispatchChanges = () => {
  state.willDispatch = false;
  //console.log('dispatching changes:', JSON.stringify(state.changesToDispatch));

  // TODO: merge / get rid of potential duplicates?
  state.changesToDispatch.forEach(luminaire =>
    server.events.emit('luminaireUpdate', luminaire),
  );

  state.changesToDispatch = [];
};

class Light {
  constructor(
    parentLuminaire,
    initialState = [0, 0, 255], // White in HSV
    index = 0,
    uuid = uuidv4(),
  ) {
    this.parentLuminaire = parentLuminaire;
    this.index = 0;
    this.uuid = uuid;

    this.state = initialState;
    this.prevState = initialState;

    this.transitionStart = new Date().getTime();
    this.transitionEnd = new Date().getTime();
  }

  getState() {
    // Calculate current state from transition times
    let q = 1;

    if (this.transitionEnd !== this.transitionStart) {
      q = Math.max(
        0,
        Math.min(
          1,
          (new Date().getTime() - this.transitionStart) /
            (this.transitionEnd - this.transitionStart),
        ),
      );
    }

    const currentState = this.state.map((value, index) => {
      const prevValue = this.prevState[index];

      return prevValue * (1 - q) + value * q;
    });

    /*
    // TODO: DEBUG
    if (this.parentLuminaire.id === 'Nattbord') {
      console.log('\n\n');
      console.log('getState()\n=========');
      console.log('state', this.state);
      console.log('prevState', this.prevState);
      console.log('currentState', currentState);
      console.log('q', q);
      console.log('\n\n');
    }
    */

    return {
      prevState: this.prevState,
      currentState,
      nextState: this.state,
      transitionTime: Math.max(0, this.transitionEnd - this.transitionStart),
    };
  }

  debug() {
    return {
      parentId: this.parentLuminaire.id,
      index: this.index,
      state: this.state,
      prevState: this.prevState,
      transitionStart: this.transitionStart,
      transitionEnd: this.transitionEnd,
    };
  }

  toJSON() {
    return this.getState();
  }

  setState(nextState, options = {}) {
    if (!nextState || !Array.isArray(nextState) || nextState.length !== 3) {
      console.log(
        'ERROR: setState() first parameter must be an array of length 3!',
      );
      return;
    }

    // TODO: DEBUG
    if (this.parentLuminaire.id === 'Nattbord') {
      console.log('\n\n');
      console.log('setState()\n=========');
      console.log('state', this.state);
      console.log('prevState', this.prevState);
      console.log('\n\n');
    }

    // Set prevState to whatever values the light has right now
    this.prevState = this.getState().currentState;
    //this.prevState = this.state;
    this.state = nextState;

    this.transitionStart = new Date().getTime();
    this.transitionEnd = new Date().getTime() + (options.transitionTime || 500);

    // TODO: some form of diffing here?
    if (!state.changesToDispatch.includes(this.parentLuminaire)) {
      state.changesToDispatch.push(this.parentLuminaire);
    }

    if (!state.willDispatch) {
      state.willDispatch = true;
      process.nextTick(dispatchChanges);
    }
  }
}

class Luminaire {
  constructor({
    id = 'Unnamed Light',
    gateway = 'unknown',
    numLights = 1,
    initialStates = [],
  }) {
    this.id = id;
    this.gateway = gateway;
    this.lights = [...Array(numLights)].map(
      (_, index) => new Light(this, initialStates[index], index),
    );
  }

  setState(nextState, options) {
    this.lights.forEach(light => light.setState(nextState, options));
  }
}

const luminaireRegister = fields => {
  if (state.luminaires.find(luminaire => luminaire.id === fields.id)) {
    return console.log('Error: luminaireRegister() with already existing id!');
  }

  console.log('luminaireRegister():', JSON.stringify(fields));

  const luminaire = new Luminaire(fields);
  console.log('created luminaire:', JSON.stringify(luminaire));
  state.luminaires.push(luminaire);

  server.events.emit('luminaireDidRegister', luminaire);
};

const setLight = ({ luminaireId, lightId, state: nextState, options }) => {
  const luminaire = state.luminaires.find(
    luminaire => luminaire.id === luminaireId,
  );
  if (!luminaire) {
    return console.log('Error: setLight() called with unknown luminaire id!');
  }

  const light = luminaire.lights[lightId];
  if (!light) {
    return console.log('Error: setLight() called with unknown light id!');
  }

  console.log('setLight():', JSON.stringify(nextState));
  light.setState(nextState, options);

  /*
  //const light = lights[lightId];

  //console.log('lights: sending lightstate updates to', lightId, needsUpdate);

  lights.forEach(light => {
    lightsCache[light.id] = {
      ...lightsCache[light.id],
      ...light,
    };
  });

  if (!state.willDispatch) {
    state.willDispatch = true;
    process.nextTick(dispatchChanges);
  }
  */
};

const getLuminaires = () => state.luminaires;

const getLuminaire = luminaireId =>
  state.luminaires.find(luminaire => luminaire.id === luminaireId);

const getLight = (luminaireId, lightId) => {
  const luminaire = getLuminaire(luminaireId);

  if (!luminaire) return;

  return luminaire.lights[lightId];
};

const register = async function(_server, options) {
  server = _server;
  /*
  if (!server.config.hue.username) {
    throw 'lights: USERNAME env var not supplied, aborting...';
  }
  */

  server.events.on('start', async () => {
    // TODO: light discovery (plugins should do this, and we should support updates)
    /*
    // Discover existing lights
    lights = await server.emitAwait('getLights');
    */
    server.events.on('setLight', setLight);
    //server.events.on('getLights', getLights);
    // server.events.on('lightChanged', lightChanged);
  });

  server.event({ name: 'luminaireUpdate', clone: true });
  server.event({ name: 'luminaireDidUpdate', clone: true });
  server.event({ name: 'luminaireRegister', clone: true });
  server.event({ name: 'luminaireDidRegister' });
  server.event({ name: 'removeLights', clone: true });
  server.event({ name: 'setLight', clone: true });
  // server.event({ name: 'lightChanged', clone: true });
};

module.exports = {
  name: 'lights',
  version: '1.0.0',
  register,
  getLuminaires,
  getLuminaire,
  getLight,
  setLight,
  luminaireRegister,
  Luminaire,
};
