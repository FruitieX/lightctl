/*
 * ssdp-discovery
 *
 * Allows hue-forwarder to be discovered by Hue apps.
 */

const SsdpServer = require('node-ssdp').Server;

const DEVICE_TYPE = 'urn:schemas-upnp-org:device:Basic:1';
const generateUDN = hueConfig =>
  `uuid:2f402f80-da50-11e1-9b23-${hueConfig.forwarderSN}`;

const generateDescription = hueConfig =>
  `<?xml version="1.0" encoding="UTF-8" ?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
<specVersion>
<major>1</major>
<minor>0</minor>
</specVersion>
<URLBase>http://${hueConfig.forwarderAddr}:80/</URLBase>
<device>
<deviceType>${DEVICE_TYPE}</deviceType>
<friendlyName>Philips hue (Forwarded) (${
    hueConfig.forwarderAddr
  })</friendlyName>
<manufacturer>Royal Philips Electronics</manufacturer>
<manufacturerURL>http://www.philips.com</manufacturerURL>
<modelDescription>Philips hue Personal Wireless Lighting</modelDescription>
<modelName>Philips hue bridge 2015</modelName>
<modelNumber>BSB002</modelNumber>
<modelURL>http://www.meethue.com</modelURL>
<serialNumber>${hueConfig.forwarderSN}</serialNumber>
<UDN>${generateUDN(hueConfig)}</UDN>
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

exports.initSSDPServer = (server, hueConfig) => {
  /* SSDP server setup */
  const ssdp = new SsdpServer({
    adInterval: 2000,
    ssdpSig: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.16.0',
    location: `http://${hueConfig.forwarderAddr}:80/description.xml`,
    udn: generateUDN(hueConfig),
  });
  ssdp.addUSN(DEVICE_TYPE);
  ssdp.start();

  server.route({
    method: 'GET',
    path: '/description.xml',
    handler: () => generateDescription(hueConfig),
  });
};
