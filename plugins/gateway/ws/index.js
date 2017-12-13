const Nes = require('nes');
const { registerLuminaire } = require('../../../src/lights');

const register = async function(server, options) {
  await server.register(Nes);

  server.subscription('/luminaires/{luminaireId}');
  server.events.on('luminaireUpdate', luminaire => {
    /*
    console.log(
      `publishing to /luminaires/${luminaire.id}`,
      JSON.stringify(luminaire.lights),
    );
    */
    server.publish(`/luminaires/${luminaire.id}`, luminaire.lights);
  });

  server.route({
    method: 'POST',
    path: '/register',
    config: {
      id: 'register',
      handler: (req, h) => {
        registerLuminaire({
          ...req.payload,
          id: req.payload.id,
          gateway: 'ws',
        });

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
