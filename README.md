hue-forwarder
=============

Motivation
----------

This is a simple tool for forwarding and intercepting Hue API traffic from Hue
apps to your bridge.

The reason I wrote this was to be able to react to Hue app actions such as
scene changes, light state changes and more. The Hue API does not offer any way
of telling which scene is active, with polling light states being the only
(unreliable, slow) option. With hue-forwarder we can apply custom logic when
Hue app users change scenes or modify light states.

Setup
-----

1. Clone the repo, run `npm install`
2. Create a file with name `.env` in the root of the repository.
   Add the following lines to it, and edit them to match your setup:

   ```
   # IP address of the target Hue bridge
   HUE_IP=192.168.1.111

   # Name of the forwarded bridge
   BRIDGE_NAME="Philips Hue (Forwarded)"

   # FORWARDER_PORT is the listen port of this service.
   # Hue apps will only try port 80, so this service has to be reachable
   # on port 80 either directly or through a reverse proxy.
   FORWARDER_PORT=5678

   # Spoof all IP addresses with FORWARDER_IP, should match IP of this service
   FORWARDER_IP=192.168.1.101

   # This probably doesn't matter, as long as it's unique in your setup
   FORWARDER_MAC=de:ad:be:ef:13:37
   ```

  NOTE: If you already run something at port 80 (standard HTTP port) you will
  likely need to set up reverse proxying. I found the following nginx config
  to work well:

  ```
  location /api {
    proxy_pass http://127.0.0.1:5678;
    proxy_redirect off;
  }

  location /description.xml {
    proxy_pass http://127.0.0.1:5678;
    proxy_redirect off;
  }
  ```

  If not, just set `FORWARDER_PORT` to 80 and use setcap to allow node processes to bind
  ports < 1024 without root privileges:
  https://gist.github.com/firstdoit/6389682

3. Run hue-forwarder with `npm start`
4. Now you should be able to find a new Hue bridge in the Philips Hue app,
   named according to what you set as `BRIDGE_NAME`
5. With the hue-forwarder bridge selected in the Philips Hue app, as you use
   the app you should see similar output in the hue-forwarder console:

   ```
   Light 1 state changed to: { bri: 91 }
   Light 1 state changed to: { bri: 135 }
   Light 1 state changed to: { bri: 178 }
   Light 1 state changed to: { bri: 180 }
   Forwarding: get /api/{username}/lights
   Forwarding: get /api/{username}/groups
   Forwarding: get /api/{username}/lights
   Forwarding: get /api/{username}/groups
   Group 0 scene changed to: bO7ulRHLp5iDaTo
   Forwarding: get /api/{username}/lights
   Forwarding: get /api/{username}/groups
   ...
   ```

6. Now you can add your own handlers to `index.js` to do anything you want in
   response to API calls, or maybe spoof more API calls (like return more
   lights than you really have in the `/api/{username}/lights` calls, using this
   you could control any lights through your Hue apps even though Hue doesn't
   normally support them)

Notes
-----

* The forwarding isn't perfect, e.g. headers may not always be identical to
  what the Hue bridge returns. In practice I have found out this doesn't matter
  with the official Philips Hue app at least.
* For whatever reason, latency seems to play a huge part when using the
  official Philips Hue app. E.g. adjusting brightness of light groups with many
  lights was extremely slow in trials where I ran hue-forwarder over WiFi, but
  flawless when I switched to wired. This occurred even though network latency
  was nowhere near as bad as the delays caused.
