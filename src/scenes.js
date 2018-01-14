const { getGroup, groupExists } = require('./groups');
const { getLuminaire } = require('./lights');

let scenes = {};
let prevScene = null;
let activeScene = null;
let server = null;

const register = async (_server, options) => {
  server = _server;
  scenes = options;

  // Default to first scene
  activeScene = Object.keys(scenes)[0];

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

const getScenes = () => scenes;
const getScene = sceneId => scenes[sceneId];

const modifyScene = ({ sceneId, scene, transitionTime }) => {
  scenes[sceneId] = scene;

  if (sceneId === activeScene) {
    doSceneUpdate({ transitionTime });
  }
};

const getSceneCmds = sceneId => {
  const scene = scenes[sceneId];
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

const getActiveScene = () => activeScene;

const doSceneUpdate = ({
  sceneId = activeScene,
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

  const scene = scenes[sceneId];
  if (!scene) {
    return console.log('No scene found with sceneId', sceneId);
  }

  prevScene = activeScene;
  activeScene = sceneId;

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
  const currentIndex = scenes.indexOf(activeScene);

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
