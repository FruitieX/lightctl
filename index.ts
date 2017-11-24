import * as Hapi from 'hapi';
import * as request from 'request-promise-native';

import initConfig from './config';

// Server setup
// @ts-ignore: until @types/hapi v17
const server = new Hapi.Server({ port: process.env.FORWARDER_PORT });

// Helper for emitting events and awaiting results from listeners
const emitAwait = async (event: string) => {
  const promises: any[] = [];
  await new Promise(resolve => server.emit(event, promises, resolve));
  const results = await promises;
  return Object.assign({}, ...results);
};
server.decorate('server', 'emitAwait', emitAwait);

const initServer = async () => {
  // "Catch-all" route
  server.route({
    method: '*',
    path: '/{p*}',
    handler: async (req: Hapi.Request, reply: Hapi.ReplyNoContinue) => {
      console.log(`Forwarding: ${req.method} ${req.url.path}`);

      const response = await request({
        url: `http://${process.env.HUE_IP}${req.url.path}`,
        method: req.method,
        body: req.payload || undefined,
        json: true,
      });

      reply(response);
    },
  });

  const config = await initConfig();
  // @ts-ignore: Yes it is
  server.decorate('server', 'config', config);

  const plugins = [
    // require('./plugins/hue-api'),
    require('./plugins/ssdp-discovery'),
    /*
    require('./plugins/config-spoofer'),
    // require('./plugins/ws-server'),
    require('./plugins/virtualized-scenes'),
    require('./plugins/virtualized-lights'),
    require('./plugins/virtualized-groups'),
    require('./plugins/cycle-scenes'),
    require('./plugins/api-spy'),
    {
      register: require('./plugins/smart-switches'),
      options: {
        autoCreateSensor: true,
        reprogramSwitches: true,
        switchActions: {
          15: {
            ON_SHORT_RELEASED: [
              {
                event: 'cycleScenes',
                scenes: ['NFdJj2xpbz9mivi', 'Qx9hz1m1zB4BX1a'],
              },
            ],
            ON_HOLD: [
              { event: 'setScene', groupId: 0, sceneId: 'cei1B4IvHsf4YkK' },
            ],

            UP_PRESSED: [{ event: 'dimBrightness', rate: 0.25 }],
            UP_SHORT_RELEASED: [{ event: 'dimBrightness', rate: 0 }],
            UP_LONG_RELEASED: [{ event: 'dimBrightness', rate: 0 }],
            DOWN_PRESSED: [{ event: 'dimBrightness', rate: -0.25 }],
            DOWN_SHORT_RELEASED: [{ event: 'dimBrightness', rate: 0 }],
            DOWN_LONG_RELEASED: [{ event: 'dimBrightness', rate: 0 }],

            OFF_SHORT_RELEASED: [
              { event: 'setScene', groupId: 0, sceneId: 'wLGvlizDZ2AEzqO' },
            ],
            OFF_HOLD: [
              { event: 'setScene', groupId: 0, sceneId: 'DNzH2x2TBhCfOzo' },
            ],
          },
          13: {
            ON_SHORT_RELEASED: [
              { event: 'setScene', groupId: 0, sceneId: 'NFdJj2xpbz9mivi' },
            ],
            ON_HOLD: [
              { event: 'setScene', groupId: 0, sceneId: 'cei1B4IvHsf4YkK' },
            ],

            UP_PRESSED: [{ event: 'dimBrightness', rate: 0.25 }],
            UP_SHORT_RELEASED: [{ event: 'dimBrightness', rate: 0 }],
            UP_LONG_RELEASED: [{ event: 'dimBrightness', rate: 0 }],
            DOWN_PRESSED: [{ event: 'dimBrightness', rate: -0.25 }],
            DOWN_SHORT_RELEASED: [{ event: 'dimBrightness', rate: 0 }],
            DOWN_LONG_RELEASED: [{ event: 'dimBrightness', rate: 0 }],

            OFF_SHORT_RELEASED: [{ event: 'setGroup', groupId: 0, on: false }],
            OFF_HOLD: [{ event: 'setGroup', groupId: 0, on: false }],
          },
        },
      },
    },
    require('./plugins/scene-middleware/auto-brightness'),
    require('./plugins/scene-middleware/dim-brightness'),
    {
      register: require('./plugins/dynamic-scenes/sunlight'),
      options: { sceneId: 'NFdJj2xpbz9mivi' },
    },
    {
      register: require('./plugins/dynamic-scenes/colorloop'),
      options: { sceneId: 'Qx9hz1m1zB4BX1a', delayMs: 5000 },
    },
    {
      register: require('./plugins/dynamic-scenes/colorloop'),
      options: { sceneId: 'AumuKhjg5hJyJad', delayMs: 500 },
    },
    {
      register: require('./plugins/dynamic-scenes/colorloop'),
      options: { sceneId: '8ZXrWIUytImoY7n' },
    },
    {
      register: require('./plugins/dynamic-scenes/colorloop'),
      options: { sceneId: '1Y-uBXA0TK6gwnU' },
    },
    {
      register: require('./plugins/dynamic-scenes/nightlight'),
      options: { sceneId: 'DNzH2x2TBhCfOzo' },
    },
    */
    /*
      {
        register: require('./plugins/dynamic-scenes/party'),
        options: { sceneId: 'gQ0XG0Jf0KaBFPY' },
      },
      */
  ];

  // Load any plugins
  try {
    await server.register(plugins);
  } catch (e) {
    console.log('Error while registering plugins:', e);
  }

  await server.start();
  console.log(`Server running at: ${server.info.uri}`);
};

initServer();
