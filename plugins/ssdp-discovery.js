/*
 * ssdp-discovery
 *
 * Allows hue-forwarder to be discovered by Hue apps.
 */

const { validateConfig } = require('../src/main');

const SsdpServer = require('node-ssdp').Server;

const DEVICE_TYPE = 'urn:schemas-upnp-org:device:Basic:1';
const generateUDN = config =>
  `uuid:2f402f80-da50-11e1-9b23-${config.SERIAL_NUMBER}`;

const generateDescription = config =>
  `<?xml version="1.0" encoding="UTF-8" ?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
<specVersion>
<major>1</major>
<minor>0</minor>
</specVersion>
<URLBase>http://${config.FORWARDER_IP}:80/</URLBase>
<device>
<deviceType>${DEVICE_TYPE}</deviceType>
<friendlyName>Philips hue (Forwarded) (${config.FORWARDER_IP})</friendlyName>
<manufacturer>Royal Philips Electronics</manufacturer>
<manufacturerURL>http://www.philips.com</manufacturerURL>
<modelDescription>Philips hue Personal Wireless Lighting</modelDescription>
<modelName>Philips hue bridge 2015</modelName>
<modelNumber>BSB002</modelNumber>
<modelURL>http://www.meethue.com</modelURL>
<serialNumber>${config.SERIAL_NUMBER}</serialNumber>
<UDN>${generateUDN(config)}</UDN>
<presentationURL>index.html</presentationURL>
<iconList>
<icon>
<mimetype>image/png</mimetype>
<height>48</height>
<width>48</width>
<depth>24</depth>
<url>hue_logo_0.png</url>
</icon>
</iconList>
</device>
</root>`;

const register = (server, options) => {
  if (
    !validateConfig(Object.keys(server.config), [
      'FORWARDER_IP',
      'SERIAL_NUMBER',
    ])
  ) {
    throw 'Missing keys from config!';
  }
  /* SSDP server setup */
  const ssdp = new SsdpServer({
    adInterval: 2000,
    ssdpSig: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.16.0',
    location: `http://${server.config.FORWARDER_IP}:80/description.xml`,
    udn: generateUDN(server.config),
  });
  ssdp.addUSN(DEVICE_TYPE);
  ssdp.start();

  server.route({
    method: 'GET',
    path: '/description.xml',
    handler: (req, reply) => reply(generateDescription(server.config)),
  });
};

module.exports = {
  name: 'ssdp-discovery',
  version: '1.0.0',
  register,
};
