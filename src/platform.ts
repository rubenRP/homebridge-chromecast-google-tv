import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { ChromecastDiscovery } from './discovery.js';
import { ChromecastGoogleTVPlatformAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

interface ChromecastDevice {
  name: string;
  host: string;
  port: number;
  txtRecord: {
    id: string;
    md: string;
    fn?: string;
    ca?: string;
    st?: string;
    ic?: string;
  };
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ChromecastGoogleTVPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  // Discovery service for Chromecast devices
  public discovery: ChromecastDiscovery;

  public deviceDiscovered = false;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // Initialize Service and Characteristic after api is available
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    // Initialize the discovery service
    this.discovery = new ChromecastDiscovery(this.log);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

    setTimeout(() => {
      this.restartScanner();
    }, 30 * 60 * 1000);
  }

  private async restartScanner() {
    try {
      this.discovery.stop();
      this.log.info('scanAccesories() - Restarting Chromecast Scanner');
      this.deviceDiscovered = false;
      this.discoverDevices();
    } catch (error) {
      this.log.error('Failed to restart scanner:', error);
    }
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
    this.log.info('Searching for Chromecast devices...');

    // Set up event listener for discovered devices
    this.discovery.on('serviceUp', (device: ChromecastDevice) => {
      this.log.info(
        'Found device. Adding if supported: ' + device.txtRecord.md,
      );

      if (
        device &&
        device.txtRecord &&
        ['Chromecast', 'Chromecast Ultra'].indexOf(device.txtRecord.md) !==
          -1 &&
        !this.deviceDiscovered
      ) {
        this.deviceDiscovered = true;
        const uuid = this.api.hap.uuid.generate(device.txtRecord.id);
        const existingAccessory = this.accessories.find(
          (accessory) => accessory.UUID === uuid,
        );

        if (existingAccessory) {
          this.log.info(
            'Restoring existing accessory from cache:',
            existingAccessory.displayName,
          );

          // Set accessory category based on configuration for cached accessories too
          const categoryConfig = this.config.category || 'TELEVISION';
          let categoryValue: number;

          switch (categoryConfig) {
            case 'TV_STREAMING_STICK':
              categoryValue = this.api.hap.Categories.TV_STREAMING_STICK;
              break;
            case 'TV_SET_TOP_BOX':
              categoryValue = this.api.hap.Categories.TV_SET_TOP_BOX;
              break;
            case 'APPLE_TV':
              categoryValue = this.api.hap.Categories.APPLE_TV;
              break;
            case 'TELEVISION':
            default:
              categoryValue = this.api.hap.Categories.TELEVISION;
              break;
          }

          existingAccessory.category = categoryValue;
          this.log.info(
            `Setting existing accessory category to: ${categoryConfig} (${categoryValue})`,
          );

          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);

          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          new ChromecastGoogleTVPlatformAccessory(this, existingAccessory);

          this.discovery.stop();
        } else {
          this.log.info('Adding new accessory:', device.name);

          const accessory = new this.api.platformAccessory(device.name, uuid);

          // Set accessory category based on configuration BEFORE registering
          const categoryConfig = this.config.category || 'TELEVISION';
          let categoryValue: number;

          switch (categoryConfig) {
            case 'TV_STREAMING_STICK':
              categoryValue = this.api.hap.Categories.TV_STREAMING_STICK;
              break;
            case 'TV_SET_TOP_BOX':
              categoryValue = this.api.hap.Categories.TV_SET_TOP_BOX;
              break;
            case 'APPLE_TV':
              categoryValue = this.api.hap.Categories.APPLE_TV;
              break;
            case 'TELEVISION':
            default:
              categoryValue = this.api.hap.Categories.TELEVISION;
              break;
          }

          accessory.category = categoryValue;
          this.log.info(
            `Setting accessory category to: ${categoryConfig} (${categoryValue})`,
          );

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

          this.discovery.stop();
        }
      }
    });

    // Start discovery
    this.discovery.start();
  }
}
