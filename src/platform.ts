import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import mdns from 'mdns';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { mdnsSequence } from './helpers';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ChromecastGoogleTVPlatformAccessory } from './platformAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ChromecastGoogleTVPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public castScanner: any;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    /*     this.castScanner = mdns.createBrowser(mdns.tcp('googlecast'), {
      resolverSequence: mdnsSequence,
    }); */

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

    /*     setTimeout(
      () => {
        this.castScanner.stop();
        this.log.info('scanAccesories() - Restarting Chromecast Scanner');

        this.castScanner = mdns.createBrowser(mdns.tcp('googlecast'), {
          resolverSequence: mdnsSequence,
        });
        this.discoverDevices();
      },
      30 * 60 * 1000,
    ); */
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    const device = {
      exampleUniqueId: 'ABCD',
      name: 'Bedroom',
    };

    const uuid = this.api.hap.uuid.generate(device.exampleUniqueId);

    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === uuid,
    );

    if (existingAccessory) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        existingAccessory,
      ]);
    }

    const accessory = new this.api.platformAccessory(device.name, uuid);

    // store a copy of the device object in the `accessory.context`
    // the `context` property can be used to store any data about the accessory you may need
    accessory.context.device = device;

    // create the accessory handler for the newly create accessory
    // this is imported from `platformAccessory.ts`
    new ChromecastGoogleTVPlatformAccessory(this, accessory);

    // link the accessory to your platform
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      accessory,
    ]);

    return;

    this.log.info('Searching for Chromecast devices...');
    this.castScanner.start();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.castScanner.on('serviceUp', (device: any) => {
      this.log.info(
        'Found device. Adding if supported: ' + device.txtRecord.md,
      );

      if (
        device &&
        device.txtRecord &&
        ['Chromecast', 'Chromecast Ultra'].indexOf(device.txtRecord.md) !== -1
      ) {
        const uuid = this.api.hap.uuid.generate(device.txtRecord.id);
        const existingAccessory = this.accessories.find(
          (accessory) => accessory.UUID === uuid,
        );

        if (existingAccessory) {
          this.log.info(
            'Restoring existing accessory from cache:',
            existingAccessory.displayName,
          );

          // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          //  existingAccessory,
          // ]);

          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);

          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          new ChromecastGoogleTVPlatformAccessory(this, existingAccessory);

          // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
          // remove platform accessories when no longer present
          // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);

          this.castScanner.stop();
        } else {
          this.log.info('Adding new accessory:', device.name);

          const accessory = new this.api.platformAccessory(device.name, uuid);

          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = device;

          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          new ChromecastGoogleTVPlatformAccessory(this, accessory);

          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
          ]);

          this.castScanner.stop();
        }
      }
    });
  }
}
