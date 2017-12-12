const Nes = require('nes');
const { setLights } = require('../../../src/lights');

const gatewayRegex = /ws\/(.*)/;

const register = async function(server, options) {
  await server.register(Nes);

  server.subscription('/lights/{lightId}');
  server.events.on('lightsChanged', lights => {
    lights.forEach(light => {
      const result = gatewayRegex.exec(light.id);
      if (result) {
        console.log(`publishing to /lights/${result[1]}`);
        server.publish(`/lights/${result[1]}`, light);
      }
    });
  });

  server.route({
    method: 'POST',
    path: '/register',
    config: {
      id: 'register',
      handler: (req, h) => {
        setLights([{ ...req.payload, id: `ws/${req.payload.id}` }]);

        return { status: 'ok' };
      },
    },
  });

  /*
  const wss = new WebSocket.Server({ server: server.listener });

  wss.on('connection', ws => {
    const registeredLights = [];

    const lightsChanged = lights => {
      lights = lights.filter(light => (light.gateway = 'ws'));
      lights = lights.filter(light => registeredLights.includes(light.id));

      ws.send(JSON.stringify(lights));
    };

    server.events.on('lightsChanged', lightsChanged);
    ws.on('close', () =>
      server.events.removeListener('lightsChanged', lightsChanged),
    );

    ws.on('message', message => {
      console.log('received: %s', message);

      const lightIds = message.lights.map(light => light.id);
      registeredLights.push(...lightIds);

      setLights(message.lights);
    });
  });
  */
};

module.exports = {
  name: 'gateway/ws',
  version: '1.0.0',
  register,
};
