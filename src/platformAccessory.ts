import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { Client as CastClient } from 'castv2-client';
// import { DefaultMediaReceiver } from 'castv2-client';

import { ChromecastGoogleTVPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ChromecastGoogleTVPlatformAccessory {
  private service: Service;

  private chromecastStates = {
    On: false,
    Volume: 100,
    Muted: false,
    App: 'Chromecast',
  };

  private connected = false;

  private castClient: CastClient;

  constructor(
    private readonly platform: ChromecastGoogleTVPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Launch Cast Client
    if (accessory.context.device.addresses[0]) {
      this.castManager(accessory.context.device.addresses[0]);
    }

    const tvName = 'Google TV';

    this.accessory.category = this.platform.api.hap.Categories.TELEVISION;

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        accessory.context.device.txtRecord.md +
          ' ' +
          accessory.context.device.txtRecord.fn,
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        accessory.context.device.txtRecord.md || 'Google',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        accessory.context.device.txtRecord.id,
      );

    this.service =
      this.accessory.getService(this.platform.Service.Television) ||
      this.accessory.addService(this.platform.Service.Television);

    // set sleep discovery characteristic
    this.service.setCharacteristic(
      this.platform.Characteristic.SleepDiscoveryMode,
      this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
    );

    // handle input source changes
    this.service.setCharacteristic(
      this.platform.Characteristic.ActiveIdentifier,
      1,
    );

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, tvName);

    // handle on / off events using the Active characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getOn.bind(this)) // GET - bind to the `getOn` method below
      .onSet(this.setOn.bind(this)); // SET - bind to the `setOn` method below

    // handle remote control input
    this.service
      .getCharacteristic(this.platform.Characteristic.RemoteKey)
      .onSet((newValue) => {
        switch (newValue) {
          case this.platform.Characteristic.RemoteKey.REWIND: {
            this.platform.log.info('set Remote Key Pressed: REWIND');
            break;
          }
          case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
            this.platform.log.info('set Remote Key Pressed: FAST_FORWARD');
            break;
          }
          case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
            this.platform.log.info('set Remote Key Pressed: NEXT_TRACK');
            break;
          }
          case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
            this.platform.log.info('set Remote Key Pressed: PREVIOUS_TRACK');
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_UP: {
            this.platform.log.info('set Remote Key Pressed: ARROW_UP');
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
            this.platform.log.info('set Remote Key Pressed: ARROW_DOWN');
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
            this.platform.log.info('set Remote Key Pressed: ARROW_LEFT');
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
            this.platform.log.info('set Remote Key Pressed: ARROW_RIGHT');
            break;
          }
          case this.platform.Characteristic.RemoteKey.SELECT: {
            this.platform.log.info('set Remote Key Pressed: SELECT');
            break;
          }
          case this.platform.Characteristic.RemoteKey.BACK: {
            this.platform.log.info('set Remote Key Pressed: BACK');
            break;
          }
          case this.platform.Characteristic.RemoteKey.EXIT: {
            this.platform.log.info('set Remote Key Pressed: EXIT');
            break;
          }
          case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
            this.platform.log.info('set Remote Key Pressed: PLAY_PAUSE');
            break;
          }
          case this.platform.Characteristic.RemoteKey.INFORMATION: {
            this.platform.log.info('set Remote Key Pressed: INFORMATION');
            break;
          }
        }
      });
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const isOn = this.chromecastStates.On;

    this.platform.log.debug('Get Characteristic On ->', isOn);

    if (isOn) {
      return this.platform.Characteristic.Active.ACTIVE;
    }
    return this.platform.Characteristic.Active.INACTIVE;

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }

  castManager(host: string) {
    this.castClient = new CastClient();

    if (this.connected) {
      this.platform.log.info('Client is already connected');
      return;
    }

    this.castClient.connect(host, () => {
      this.platform.log.info('Connected to Chromecast at ' + host);
      this.connected = true;

      if (
        this.castClient &&
        this.castClient.connection &&
        this.castClient.heartbeat &&
        this.castClient.receiver
      ) {
        this.platform.log.info('Client is connected');
        this.castClient.receiver.on('status', (status) => {
          this.platform.log.debug('status broadcast', status);
          this.updateChromecastState(status);
        });
        this.castClient.heartbeat.on('timeout', () => {
          this.platform.log.info('Client heartbeat timeout');
        });
        this.castClient.heartbeat.on('pong', () => {
          // this.platform.log.debug("Client heartbeat pong");
        });
        this.castClient.receiver.on('close', () => {
          this.platform.log.info('Client receiver close');
          this.connected = false;
          this.castManager(host);
        });
        this.castClient.receiver.on('error', (e) => {
          this.platform.log.info('Client receiver error', e);
          this.connected = false;
          this.castManager(host);
        });
        this.castClient.getStatus((err, status) => {
          this.platform.log.debug('status', status);
          this.updateChromecastState(status);
        });
      }
    });
  }

  updateChromecastState(status) {
    this.platform.log.debug('Updating Chromecast state: ', status);

    // Triggers and updates the HomeKit accessory with the new Chromecast state
    if (this.chromecastStates.On !== !status.isStandBy) {
      this.platform.log.info('Updating Chromecast state change');
      this.service.updateCharacteristic(
        this.platform.Characteristic.Active,
        !status.isStandBy,
      );
    }

    this.chromecastStates.On = !status.isStandBy;
    this.chromecastStates.Volume = status.volume.level * 100;
    this.chromecastStates.Muted = status.volume.muted;
    if (status.applications && status.applications[0]) {
      this.chromecastStates.App = status.applications[0].displayName;
    }
  }
}
