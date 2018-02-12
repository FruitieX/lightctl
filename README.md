# lightctl

## Motivation

Home automation lighting systems are not as open as they could be, even if that
is often one of their selling points. There are limits on what can be done with
the official APIs and gateways, with third party, often expensive home
automation gateways being the other alternative.

Luckily most products allow us to at least control the light states directly.
This allows us to throw out all "smart" functionalities of a gateway, and
consider them as dumb radio transmitters instead. We take care of managing
light states ourselves, and just send light state commands to the gateways.

[More info](/docs/motivation.md)

## Features

This project aims to both improve and unify various home automation
lighting systems. Some feature highlights:

* Lights from any supported home automation system are combined into one system
* Previous light state is used on state updates to send only necessary commands
* Hapi.js based plugin architecture, new plugins are easy to implement.
* API plugins allow you to continue using your favorite apps for controlling lights

## Setup

Start by cloning the repo, then run `yarn install`.

This project uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig),
and as such you have many choices on how to do the configuration. For getting
started, I can recommend creating a `.lightctlrc` file in the root of
the repository with the following contents:

```
plugins:
  # Hue gateway support (in dummy mode it creates a few fake lights)
  ./plugins/gateway/hue:
    dummy: true

  # Create a fake Hue bridge named 'lightctl' to support Hue apps
  ./plugins/api/hue:
    forwarderName: lightctl

  # Websocket plugin (hapijs/nes based)
  ./plugins/gateway/ws:
```

Start the server by running `yarn start`.

At this point you should be able to use for example [lightctl-debug](https://github.com/FruitieX/lightctl-debug)
to inspect the current state. Alternatively, as we enabled the Hue API plugin,
you should be able to use the official Philips Hue app to control lightctl.
Make sure the device is in the same network as your server if you attempt this.

TODO: Setup steps for non-dummy setups. (i.e. involving real gateways)
(Right now you will have to read the source code and find out :-))
