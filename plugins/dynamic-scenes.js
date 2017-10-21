/*
 * dynamic-scenes
 *
 * Store id of currently active scene in a Hue bridge sensor.
 * Additionally, we poll for the currently active scene and store it in
 * sceneForGroup. Other plugins can import sceneForGroup and perform logic
 * based on the current active scene.
 *
 * Any scene change through the API will trigger this function.
 * Any light state changes will reset the scene value to "null".
 *
 * DEPENDENCIES:
 *
 * - scene-spy

 * SETUP:
 *
 * - Register plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     {
 *       register: require('./plugins/scene-spy'),
 *       options: { groups: [ 0, 1 ], pollDelay: 100, duplicateSceneChange: true }
 *     },
 * ...
 * ```
 *
 * - If you want your Dimmer Switches to also sync the active scene, append the
 *   following to the actions array of each dimmer switch rule (replace
 *   ${SENSOR_ID} and ${SCENE_ID} with relevant values):
 *
 * ```
 * {
 *   "address": "/sensors/${SENSOR_ID}",
 *   "method": "PUT",
 *   "body": {
 *     "name": "${SCENE_ID}"
 *   }
 * }
 * ```
 *
 * NOTE: Special scenes include:
 *
 * - "null": No scene active (light states changed manually since last scene recall)
 * - "off": Can be reported by dimmer switches to signify turning group off
 *
 */

const EventEmitter = require('events').EventEmitter;
const sceneChangeEmitter = require('./scene-spy').sceneChangeEmitter;
const request = require('request-promise-native');

const groupActionRegex = /\/api\/([\w-]+)\/groups\/(\d+)\/action/;
const lightStateRegex = /\/api\/([\w-]+)\/lights\/(\d+)\/state/;

const sceneSensorForGroup = {};
const sceneForGroup = {};

let groups = {};

// Contain IDs of registered scenes that should be excempt from recall duplication
const registeredScenes = {};

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
  };

  return registeredScenes[sceneId];
};

const handleSceneActivation = async ({ sceneId, groupId }) => {
  const prevSceneId = groups[groupId].activeScene;
  groups[groupId].activeScene = sceneId;

  const scene = registeredScenes[sceneId];
  const prevScene = registeredScenes[prevSceneId];

  if (prevScene && prevScene !== scene) {
    prevScene.events.emit('deactivate', { sceneId, prevSceneId, groupId });
  }
  if (scene) {
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

  // Discover existing groups
  groups = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups`,
    json: true,
  });

  Object.keys(groups).forEach(groupId => {
    groups[groupId].activeScene = null;
  });

  groups = {
    ...groups,
    '0': { activeScene: null },
  };

  sceneChangeEmitter.on('activate', handleSceneActivation);
  next();
};

exports.register.attributes = {
  name: 'dynamic-scenes',
  version: '1.0.0',
};
