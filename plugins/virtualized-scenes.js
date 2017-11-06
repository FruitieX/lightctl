/*
 * virtualized-scenes
 */

const forEach = require('lodash/forEach');
const cloneDeep = require('lodash/cloneDeep');
const findKey = require('lodash/findKey');

let refreshTimeout = null;
let scenes = {};

const findActiveSceneId = () => {
  for (const sceneId in scenes) {
    if (scenes[sceneId].active) return sceneId;
  }
};

const refresh = () => {
  const sceneId = findKey(scenes, scene => scene.active);

  setScene({ sceneId });
};

const setScene = (server, options, activated) => async ({ sceneId }) => {
  clearTimeout(refreshTimeout);
  const prevSceneId = findActiveSceneId();

  // Deactivate previous scene if not equal to this scene
  let prevScene = scenes[prevSceneId];
  if (prevScene && prevSceneId !== sceneId) {
    prevScene.active = false;
  }

  if (!sceneId || sceneId === 'null') {
    return;
  }

  let scene = scenes[sceneId];
  scene.active = true;

  scene = cloneDeep(scene);

  // Allow scene middleware to modify scene before applying it
  await new Promise(resolve =>
    server.emit(
      'sceneMiddleware',
      { prevScene, prevSceneId, scene, sceneId, activated },
      resolve,
    ),
  );

  console.log('setScene()', scene.lightstates);
  for (const lightId in scene.lightstates) {
    server.emit('setLight', {
      lightId,
      payload: scene.lightstates[lightId],
    });
  }

  refreshTimeout = setTimeout(refresh, options.refreshInterval || 60 * 1000);
};

const modifyScene = (server, options) => ({ sceneId, payload }) => {
  scenes[sceneId] = {
    ...scenes[sceneId],
    ...payload,
  };

  const scene = scenes[sceneId];

  if (scene.active) {
    setScene(server, options)({ sceneId });
  }
};

exports.register = async function(server, options, next) {
  // Discover existing scenes
  scenes = await server.emitAwait('getScenes');

  // Mark each scene as inactive
  forEach(scenes, scene => (scene.active = false));

  server.expose('scenes', cloneDeep(scenes));

  server.on('start', () => {
    server.on('setScene', setScene(server, options, true));
    server.on('refreshScene', () =>
      setScene(server, options)({ sceneId: findActiveSceneId() }),
    );
    server.on('modifyScene', modifyScene(server, options));
  });

  server.event({ name: 'setScene', clone: true });
  server.event({ name: 'modifyScene', clone: true });
  server.event('refreshScene');
  server.event('sceneMiddleware');

  next();
};

exports.register.attributes = {
  name: 'virtualized-scenes',
  version: '1.0.0',
};
