/*
 * ssdp-discovery
 *
 * Allows hue-forwarder to be discovered by Hue apps.
 */

const SsdpServer = require('node-ssdp').Server;

const DEVICE_TYPE = 'urn:schemas-upnp-org:device:Basic:1';
const UDN = `uuid:2f402f80-da50-11e1-9b23-${process.env.SERIAL_NUMBER}`;

const generateDescription = () => `<?xml version="1.0" encoding="UTF-8" ?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
<specVersion>
<major>1</major>
<minor>0</minor>
</specVersion>
<URLBase>http://${process.env.FORWARDER_IP}:80/</URLBase>
<device>
<deviceType>${DEVICE_TYPE}</deviceType>
<friendlyName>Philips hue (Forwarded) (${process.env.FORWARDER_IP})</friendlyName>
<manufacturer>Royal Philips Electronics</manufacturer>
<manufacturerURL>http://www.philips.com</manufacturerURL>
<modelDescription>Philips hue Personal Wireless Lighting</modelDescription>
<modelName>Philips hue bridge 2015</modelName>
<modelNumber>BSB002</modelNumber>
<modelURL>http://www.meethue.com</modelURL>
<serialNumber>${process.env.SERIAL_NUMBER}</serialNumber>
<UDN>${UDN}</UDN>
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

exports.register = function (server, options, next) {
  /* SSDP server setup */
  const ssdp = new SsdpServer({
    adInterval: 2000,
    ssdpSig: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.16.0',
    location: `http://${process.env.FORWARDER_IP}:80/description.xml`,
    udn: UDN,
  });
  ssdp.addUSN(DEVICE_TYPE);
  ssdp.start();

  server.route({
    method: 'GET',
    path: '/description.xml',
    handler: (req, reply) =>
      reply(generateDescription())
  });

  next();
};

exports.register.attributes = {
  name: 'ssdp-discovery',
  version: '1.0.0'
};
