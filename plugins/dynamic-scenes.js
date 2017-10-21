/*
 * dynamic-scenes
 *
 * Allows registering scenes that can change light states dynamically.
 * Manages active scene state with scene-spy, and only allows the currently
 * scene to change light states.
 *
 * TODO: Cache light states of inactive scenes so the up to date state can be
 * recalled instantly.
 *
 * DEPENDENCIES:
 *
 * - scene-spy

 * SETUP:
 *
 * - Register plugin and dependencies in index.js:
 *
 * ```
 * server.register(
 *   [
 *     {
 *       register: require('./plugins/dynamic-scenes'),
 *       options: { groups: [ 0, 1 ], duplicateSceneChange: true }
 *     },
 * ...
 * ```
 *
 */

const EventEmitter = require('events').EventEmitter;
const sceneChangeEmitter = require('./scene-spy').sceneChangeEmitter;
const request = require('request-promise-native');

let groups = {};

// Contains IDs of registered scenes
const registeredScenes = {};

const setLight = sceneId => (lightId, body) => {
  if (!registeredScenes[sceneId].active) return;

  return request({
    url: `http://${process.env.HUE_IP}/api/${process.env
      .USERNAME}/lights/${lightId}/state`,
    method: 'PUT',
    body,
    json: true,
    timeout: 1000,
  });
};

const setGroup = sceneId => (groupId, body) => {
  if (!registeredScenes[sceneId].active) return;

  return request({
    url: `http://${process.env.HUE_IP}/api/${process.env
      .USERNAME}/groups/${groupId}/action`,
    method: 'PUT',
    body,
    json: true,
    timeout: 1000,
  });
};

exports.registerScene = async sceneId => {
  if (registeredScenes[sceneId]) {
    throw 'Scene already registered!';
  }

  // Fetch scene from bridge
  scene = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env
      .USERNAME}/scenes/${sceneId}`,
    json: true,
  });

  registeredScenes[sceneId] = {
    ...scene,
    events: new EventEmitter(),
    setLight: setLight(sceneId),
    setGroup: setGroup(sceneId),
  };

  return registeredScenes[sceneId];
};

const handleSceneActivation = async ({ sceneId, groupId }) => {
  const prevSceneId = groups[groupId].activeScene;
  groups[groupId].activeScene = sceneId;

  const scene = registeredScenes[sceneId];
  const prevScene = registeredScenes[prevSceneId];

  if (prevScene && prevScene !== scene) {
    prevScene.active = false;
    prevScene.events.emit('deactivate', { sceneId, prevSceneId, groupId });
  }
  if (scene) {
    scene.active = true;
    scene.events.emit('activate', { sceneId, prevSceneId, groupId });
  } else {
    // No dynamic scene registered for sceneId

    // Do nothing if scene is 'null' or 'off'
    // TODO: handle 'off' scene (turn off group)
    if (sceneId === 'null' || sceneId === 'off') {
      return;
    }

    // Work around a race-condition issue where we might have overwritten
    // a recent scene change before we got notified about the scene change.
    // Solution: re-send the scene recall to the bridge.
    console.log(`dynamic-scenes: Re-sending scene change to ${sceneId}`);

    await request({
      url: `http://${process.env.HUE_IP}/api/${process.env
        .USERNAME}/groups/${groupId}/action`,
      timeout: 1000,
      method: 'PUT',
      body: { scene: sceneId },
      json: true,
    });
  }
};

exports.register = async function(server, options, next) {
  if (!process.env.USERNAME) {
    return next('dynamic-scenes: USERNAME env var not supplied, aborting...');
  }
  if (!process.env.HUE_IP) {
    return next('dynamic-scenes: HUE_IP env var not supplied, aborting...');
  }

  // Discover existing groups
  groups = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups`,
    json: true,
  });

  groups = {
    ...groups,
    '0': {},
  };

  Object.entries(groups).forEach(([groupId, group]) => {
    group.activeScene = null;
    group.requests = [];
  });

  sceneChangeEmitter.on('activate', handleSceneActivation);
  next();
};

exports.register.attributes = {
  name: 'dynamic-scenes',
  version: '1.0.0',
};
