const Nes = require('nes');
const {
  luminaireRegister,
  getLuminaire,
  getLuminaires,
} = require('../../../src/lights');

const register = async function(server, options) {
  await server.register(Nes);

  // Send initial state as soon as client subscribes to luminaires
  server.subscription('/luminaires/{luminaireId}', {
    onSubscribe: async (socket, path, params) =>
      socket.publish(
        `/luminaires/${params.luminaireId}`,
        getLuminaire(params.luminaireId),
      ),
  });
  server.subscription('/luminaires/all', {
    onSubscribe: async (socket, path, params) =>
      getLuminaires().forEach(luminaire =>
        socket.publish(`/luminaires/all`, luminaire),
      ),
  });

  server.events.on('luminaireUpdate', luminaire => {
    server.publish(`/luminaires/${luminaire.id}`, luminaire.lights);
    server.publish(`/luminaires/all`, luminaire);
  });
  server.events.on('luminaireDidRegister', luminaire => {
    server.publish(`/luminaires/${luminaire.id}`, luminaire.lights);
    server.publish(`/luminaires/all`, luminaire);
  });

  server.route({
    method: 'POST',
    path: '/register',
    config: {
      id: 'register',
      handler: (req, h) => {
        luminaireRegister({
          ...req.payload,
          id: req.payload.id,
          gateway: 'ws',
        });

        return { status: 'ok' };
      },
    },
  });
};

module.exports = {
  name: 'gateway/ws',
  version: '1.0.0',
  register,
};
