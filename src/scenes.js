const state = require('./state');
const R = require('ramda');
const { getGroup, groupExists } = require('./groups');
const { getLuminaire } = require('./lights');

let server = null;

const register = async (_server, scenes) => {
  server = _server;
  state.set(['scenes', 'entries'], scenes);

  // Default to first scene
  state.set(['scenes', 'active'], Object.keys(scenes)[0]);

  server.event({ name: 'modifyScene', clone: true });
  server.event({ name: 'activateScene', clone: true });
  server.event({ name: 'forceSceneUpdate', clone: true });
  server.event({ name: 'cycleScenes', clone: true });
  server.event({ name: 'sceneMiddleware' });

  server.events.on('start', () => {
    server.events.on('modifyScene', modifyScene);
    server.events.on('activateScene', activateScene);
    server.events.on('forceSceneUpdate', doSceneUpdate);
    server.events.on('cycleScenes', cycleScenes);
  });
};

const getScenes = () => state.get(['scenes', 'entries']);
const getScene = sceneId => state.get(['scenes', 'entries', sceneId]);
const getActiveSceneId = () => state.get(['scenes', 'active']);

const modifyScene = ({ sceneId, scene, transitionTime }) => {
  state.set(['scenes', 'entries', sceneId], scene);

  if (sceneId === getActiveSceneId()) {
    doSceneUpdate({ transitionTime });
  }
};

const getSceneCmds = sceneId => {
  const scene = getScene(sceneId);
  if (!scene) {
    console.log('No scene found with sceneId', sceneId);
    return [];
  }

  const sceneCmds = [];
  Object.entries(scene).forEach(([sceneGroupId, cmds]) => {
    if (groupExists(sceneGroupId)) {
      const group = getGroup(sceneGroupId);
      group.forEach((luminaire, index) => {
        const sceneCmd = {};
        sceneCmd.luminaire = luminaire;

        if (!Array.isArray(cmds)) {
          sceneCmd.cmd = cmds;
        } else if (cmds.length === 1) {
          sceneCmd.cmd = cmds[0];
        } else {
          // TODO: this is a weird case to support
          sceneCmd.cmd = cmds[index];
        }

        sceneCmds.push(sceneCmd);
      });
    } else {
      const luminaire = getLuminaire(sceneGroupId);

      const sceneCmd = {};

      sceneCmd.luminaire = luminaire;
      sceneCmd.cmd = cmds;

      sceneCmds.push(sceneCmd);
    }
  });

  return sceneCmds;
};

const doSceneUpdate = ({
  sceneId = getActiveSceneId(),
  transitionTime = 500,
  useExistingTransition = false,
} = {}) => {
  const sceneCmds = getSceneCmds(sceneId);

  // TODO: cmd could be luminaireCmd
  sceneCmds.forEach(({ luminaire, cmd }) => {
    if (Array.isArray(cmd)) {
      cmd.forEach((lightCmd, index) =>
        applySceneCmd(luminaire.lights[index], {
          ...lightCmd,
          transitionTime,
          useExistingTransition,
        }),
      );
    } else {
      luminaire.lights.forEach(light =>
        applySceneCmd(light, { ...cmd, transitionTime, useExistingTransition }),
      );
    }
  });
};

const activateScene = ({ sceneId, transitionTime }) => {
  console.log('activateScene', sceneId);

  const scene = getScene(sceneId);
  if (!scene) {
    return console.log('No scene found with sceneId', sceneId);
  }

  state.set(['scenes', 'prev'], getActiveSceneId());
  state.set(['scenes', 'active'], sceneId);

  doSceneUpdate({ sceneId, transitionTime });
};

const applySceneCmd = async (light, cmd) => {
  // Let scene middleware modify a deep clone of cmd
  cmd = JSON.parse(JSON.stringify(cmd));
  await server.events.emit('sceneMiddleware', { light, cmd });

  // If useExistingTransition was specified, use transitionTime from ongoing
  // transition if it is longer than cmd.transitionTime.
  if (cmd.useExistingTransition) {
    cmd.transitionTime = Math.max(
      cmd.transitionTime,
      light.getState().transitionTime,
    );
  }

  light.setState(cmd);
};

const cycleScenes = ({ scenes }) => {
  const currentIndex = scenes.indexOf(getActiveSceneId());

  activateScene({ sceneId: scenes[(currentIndex + 1) % scenes.length] });
};

module.exports = {
  name: 'scenes',
  version: '1.0.0',
  register,
  getScenes,
  getScene,
  getSceneCmds,
  modifyScene,
  activateScene,
};
