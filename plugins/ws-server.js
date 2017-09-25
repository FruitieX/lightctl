/*
 * ws-server
 *
 * Host a websocket server using the 'nes' library.
 * The server can push any API requests as websocket messages.
 * Furthermore, we can poll for events that are not possible to discover via
 * the API.
 *
 * SETUP:
 *
 * - Register plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     require('./plugins/ws-server'),
 *     ...
 *   ]
 * ...
 * ```
 */

const Nes = require('nes');

exports.register = async function (server, options, next) {
  await server.register(Nes);

  next();
};

exports.register.attributes = {
  name: 'ws-server',
  version: '1.0.0'
};
