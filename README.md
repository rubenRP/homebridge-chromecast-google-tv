# Chromecast Television Accessory

This plugin will discover all chromecasts on the network and create a Television/Streaming Accessory. Supported are Chromecast with Google TV.

It triggers on/off when the Chromecast is activated or deactivated. Useful for automatizations

## Installation

```sh
npm i -g homebridge-chromecast-google-tv
```

Add this to your config.json.

```json
"platforms":[
    {
        "name": "Google TV",
        "category": "TELEVISION",
        "platform": "HomebridgeChromecastGoogleTV"
    }
]
```

You can specify category for HomeKit accessory - TELEVISION, TV_STREAMING_STICK, TV_SET_TOP_BOX, APPLE_TV. This does not change the device functions, but allows you to choose how the device is displayed in the Home app.
![Image](https://user-images.githubusercontent.com/8211291/123853650-b295ad80-d8eb-11eb-8d75-9ff557671ec9.jpeg)

## Add to HomeKit

This plugin adds the Chromecast as an external device. Once the plugin is configured you will have to add a new accessory in the Home app using the same code as your homebridge instance.

Due to an Apple limitation TV-type devices cannot be controlled in 3rd party HomeKit apps such as Eve.

## Credits

[@homebridge-chromecast-television](https://github.com/benov84/homebridge-chromecast-television#readme)
[@homebridge-control-chromecast](https://github.com/yotamtal/homebridge-control-chromecast#readme)

### Build Plugin

TypeScript needs to be compiled into JavaScript before it can run. The following command will compile the contents of your [`src`](./src) directory and put the resulting code into the `dist` folder.

```shell
$ npm run build
```

### Link To Homebridge

Run this command so your global installation of Homebridge can discover the plugin in your development environment:

```shell
$ npm link
```

You can now start Homebridge, use the `-D` flag, so you can see debug log messages in your plugin:

```shell
$ homebridge -D
```

### Watch For Changes and Build Automatically

If you want to have your code compile automatically as you make changes, and restart Homebridge automatically between changes, you first need to add your plugin as a platform in `~/.homebridge/config.json`:

```
{
...
    "platforms": [
        {
            "name": "Config",
            "port": 8581,
            "platform": "config"
        },
        {
            "name": "<PLUGIN_NAME>",
            //... any other options, as listed in config.schema.json ...
            "platform": "<PLATFORM_NAME>"
        }
    ]
}
```

and then you can run:

```shell
$ npm run watch
```

This will launch an instance of Homebridge in debug mode which will restart every time you make a change to the source code. It will load the config stored in the default location under `~/.homebridge`. You may need to stop other running instances of Homebridge while using this command to prevent conflicts. You can adjust the Homebridge startup command in the [`nodemon.json`](./nodemon.json) file.
