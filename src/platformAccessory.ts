import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { ChromecastGoogleTVPlatform } from './platform.js';

// Dynamic import for castv2-client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CastClient: any;

// Types for cast client responses
interface CastStatus {
  isStandBy?: boolean;
  volume?: {
    level?: number;
    muted?: boolean;
  };
  applications?: Array<{
    displayName: string;
    isIdleScreen?: boolean;
  }>;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ChromecastGoogleTVPlatformAccessory {
  private service: Service;
  private inputSources: Map<string, Service> = new Map();
  private currentActiveIdentifier = 0;

  private chromecastStates = {
    On: false, // Start in standby/off state
    Volume: 100,
    Muted: false,
    App: 'Standby', // Start with standby app
  };

  private connected = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private castClient: any;

  constructor(
    private readonly platform: ChromecastGoogleTVPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Launch Cast Client - handle both new and legacy device formats
    let hostAddress: string | undefined;

    if (accessory.context.device.host) {
      // New format from discovery service
      hostAddress = accessory.context.device.host;
    } else if (
      accessory.context.device.addresses &&
      accessory.context.device.addresses.length > 0
    ) {
      // Legacy format
      hostAddress = this.getPreferredAddress(
        accessory.context.device.addresses,
      );
    }

    if (hostAddress) {
      this.platform.log.info(`Connecting to Chromecast at: ${hostAddress}`);
      this.castManager(hostAddress);
    } else {
      this.platform.log.error(
        'No valid host address found for Chromecast device',
      );
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

    // Create default input sources
    this.setupDefaultInputSources();

    // handle input source changes
    this.service.setCharacteristic(
      this.platform.Characteristic.ActiveIdentifier,
      1,
    );

    // Handle input source selection
    this.service
      .getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .onSet((inputIdentifier: CharacteristicValue) => {
        this.platform.log.info(
          `Input source changed to ID: ${inputIdentifier}`,
        );
        // Note: We mainly update this characteristic from Chromecast state changes
        // but this handler allows for future input switching functionality
      });

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, tvName);

    // handle on / off events using the Active characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getOn.bind(this)) // GET - bind to the `getOn` method below
      .onSet(this.setOn.bind(this)); // SET - bind to the `setOn` method below
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    const targetState = value === this.platform.Characteristic.Active.ACTIVE;

    this.platform.log.info(
      `HomeKit requested power state change -> ${
        targetState ? 'ON' : 'OFF (STANDBY)'
      }`,
    );

    // Note: Most Chromecast devices don't support being turned on/off programmatically
    // The state is primarily determined by what the device is actually doing
    // This method mainly serves to log user intentions from HomeKit

    // Update internal state to reflect user's intention
    // The actual state will be updated when we receive status updates from the Chromecast
    this.platform.log.debug('Set Characteristic Active ->', targetState);
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
    // Return the current power state: true = active/on, false = standby/off
    const isOn = this.chromecastStates.On;

    this.platform.log.debug(
      `Get Characteristic Active -> ${
        isOn ? 'ACTIVE (ON)' : 'INACTIVE (STANDBY/OFF)'
      }`,
    );

    // Return appropriate HomeKit Active characteristic value
    if (isOn) {
      return this.platform.Characteristic.Active.ACTIVE;
    }
    return this.platform.Characteristic.Active.INACTIVE;

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }

  async castManager(host: string) {
    try {
      if (!CastClient) {
        const castModule = await import('castv2-client');
        CastClient = castModule.Client;
      }

      this.castClient = new CastClient();

      if (this.connected) {
        this.platform.log.info('Client is already connected');
        return;
      }

      this.platform.log.info(`Attempting to connect to Chromecast at ${host}`);

      this.castClient.connect(host, () => {
        this.platform.log.info('Connected to Chromecast at ' + host);
        this.connected = true;

        if (
          this.castClient &&
          this.castClient.connection &&
          this.castClient.heartbeat &&
          this.castClient.receiver
        ) {
          this.platform.log.info('Client is connected and ready');

          // Set up event listeners
          this.castClient.receiver.on('status', (status: CastStatus) => {
            this.platform.log.debug(
              'Status broadcast received:',
              JSON.stringify(status, null, 2),
            );
            this.updateChromecastState(status);
          });

          this.castClient.heartbeat.on('timeout', () => {
            this.platform.log.warn(
              'Client heartbeat timeout - connection lost',
            );
            this.connected = false;
          });

          this.castClient.heartbeat.on('pong', () => {
            this.platform.log.debug('Client heartbeat pong received');
          });

          this.castClient.receiver.on('close', () => {
            this.platform.log.info(
              'Client receiver closed - attempting reconnection',
            );
            this.connected = false;
            setTimeout(() => {
              this.castManager(host);
            }, 5000);
          });

          this.castClient.receiver.on('error', (e: Error) => {
            this.platform.log.error('Client receiver error:', e);
            this.connected = false;
            setTimeout(() => {
              this.castManager(host);
            }, 5000);
          });

          // Get initial status
          this.castClient.getStatus((err: Error | null, status: CastStatus) => {
            if (err) {
              this.platform.log.error('Error getting initial status:', err);
              return;
            }
            this.platform.log.info(
              'Initial status received:',
              JSON.stringify(status, null, 2),
            );
            this.updateChromecastState(status);
          });

          // Set up periodic status polling to ensure we don't miss updates
          const statusInterval = setInterval(() => {
            if (this.connected && this.castClient) {
              this.castClient.getStatus(
                (err: Error | null, status: CastStatus) => {
                  if (err) {
                    this.platform.log.debug('Error polling status:', err);
                    return;
                  }
                  this.platform.log.debug(
                    'Polled status:',
                    JSON.stringify(status, null, 2),
                  );
                  this.updateChromecastState(status);
                },
              );
            } else {
              clearInterval(statusInterval);
            }
          }, 30000); // Poll every 30 seconds (2 times per minute)
        }
      });

      // Add error handling for connection failures
      this.castClient.on('error', (error: Error & { code?: string }) => {
        this.platform.log.warn(
          `Failed to connect to Chromecast at ${host}:`,
          error.message,
        );
        this.connected = false;

        // Don't retry immediately on network errors to avoid spam
        if (
          error.code === 'ENETUNREACH' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT'
        ) {
          this.platform.log.warn(
            `Network unreachable for ${host}, will retry in 30 seconds`,
          );
          setTimeout(() => {
            this.castManager(host);
          }, 30000);
          return;
        }

        // Retry for other errors after a shorter delay
        setTimeout(() => {
          this.castManager(host);
        }, 10000);
      });
    } catch (error) {
      this.platform.log.error('Failed to initialize cast client:', error);
      // Retry after a delay
      setTimeout(() => {
        this.castManager(host);
      }, 15000);
    }
  }

  /**
   * Helper method to prefer IPv4 addresses over IPv6 to avoid network connectivity issues
   */
  private getPreferredAddress(addresses: string[]): string {
    // First try to find an IPv4 address
    const ipv4Address = addresses.find((addr) => {
      // Simple IPv4 pattern check (not containing colons)
      return !addr.includes(':') || addr.includes('.');
    });

    if (ipv4Address) {
      this.platform.log.debug(`Using IPv4 address: ${ipv4Address}`);
      return ipv4Address;
    }

    // Fall back to the first address if no IPv4 found
    this.platform.log.debug(`Using fallback address: ${addresses[0]}`);
    return addresses[0];
  }

  updateChromecastState(status: CastStatus) {
    this.platform.log.debug('Updating Chromecast state: ', status);

    // Determine if Chromecast should be considered "on" or "off"
    // Standby mode = OFF, Active mode = ON
    const isActive = !status.isStandBy;

    // Triggers and updates the HomeKit accessory with the new Chromecast state
    if (this.chromecastStates.On !== isActive) {
      this.platform.log.info(
        `Chromecast power state changed: ${isActive ? 'ON' : 'OFF (Standby)'}`,
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.Active,
        isActive
          ? this.platform.Characteristic.Active.ACTIVE
          : this.platform.Characteristic.Active.INACTIVE,
      );
    }

    // Update internal state - standby mode means device is OFF
    this.chromecastStates.On = isActive;
    this.chromecastStates.Volume = status.volume?.level
      ? status.volume.level * 100
      : 100;
    this.chromecastStates.Muted = status.volume?.muted || false;

    // Handle different states and update input sources accordingly
    if (status.isStandBy) {
      this.platform.log.info('Chromecast is in standby mode (OFF)');
      this.chromecastStates.App = 'Standby';
      this.updateActiveInputSource('Standby');
    } else if (status.applications && status.applications.length > 0) {
      // Chromecast is active and running an application
      const app = status.applications[0];
      this.platform.log.info(
        'Chromecast is active (ON) - Running application:',
      );
      this.platform.log.info(`App Name: ${app.displayName}`);

      this.chromecastStates.App = app.displayName;

      // Update input source to show the current app
      if (app.isIdleScreen) {
        this.updateActiveInputSource('Home Screen');
      } else {
        this.updateActiveInputSource(app.displayName);
      }
    } else {
      // Chromecast is active but no specific application is running
      this.platform.log.info(
        'Chromecast is active (ON) but no applications are running',
      );
      this.chromecastStates.App = 'Home Screen';
      this.updateActiveInputSource('Home Screen');
    }
  }

  /**
   * Create an input source for an app
   */
  private createInputSource(appName: string, identifier: number): Service {
    const subtype = appName.toLowerCase().replace(/\s+/g, '_');

    // Check if service already exists
    let inputService = this.accessory.getServiceById(
      this.platform.Service.InputSource,
      subtype,
    );

    if (!inputService) {
      // Create new service only if it doesn't exist
      inputService = this.accessory.addService(
        this.platform.Service.InputSource,
        appName,
        subtype,
      );

      inputService
        .setCharacteristic(this.platform.Characteristic.Identifier, identifier)
        .setCharacteristic(this.platform.Characteristic.ConfiguredName, appName)
        .setCharacteristic(this.platform.Characteristic.Name, appName)
        .setCharacteristic(
          this.platform.Characteristic.InputSourceType,
          this.platform.Characteristic.InputSourceType.APPLICATION,
        )
        .setCharacteristic(
          this.platform.Characteristic.IsConfigured,
          this.platform.Characteristic.IsConfigured.CONFIGURED,
        );

      // Link the input source to the TV service
      this.service.addLinkedService(inputService);

      this.platform.log.info(
        `Created input source: ${appName} (ID: ${identifier})`,
      );
    } else {
      // Update existing service characteristics if needed
      inputService
        .setCharacteristic(this.platform.Characteristic.Identifier, identifier)
        .setCharacteristic(this.platform.Characteristic.ConfiguredName, appName)
        .setCharacteristic(this.platform.Characteristic.Name, appName);

      this.platform.log.info(
        `Restored existing input source: ${appName} (ID: ${identifier})`,
      );
    }

    return inputService;
  }

  /**
   * Get or create an input source for an app
   */
  private getOrCreateInputSource(appName: string): {
    service: Service;
    identifier: number;
  } {
    let inputService = this.inputSources.get(appName);
    let identifier: number;

    if (!inputService) {
      // Create new input source
      identifier = this.inputSources.size + 1;
      inputService = this.createInputSource(appName, identifier);
      this.inputSources.set(appName, inputService);
    } else {
      // Get existing identifier
      identifier = inputService.getCharacteristic(
        this.platform.Characteristic.Identifier,
      ).value as number;
    }

    return { service: inputService, identifier };
  }

  /**
   * Update the active input source
   */
  private updateActiveInputSource(appName: string) {
    const { identifier } = this.getOrCreateInputSource(appName);

    if (this.currentActiveIdentifier !== identifier) {
      this.currentActiveIdentifier = identifier;
      this.service.updateCharacteristic(
        this.platform.Characteristic.ActiveIdentifier,
        identifier,
      );
      this.platform.log.info(
        `Switched to input source: ${appName} (ID: ${identifier})`,
      );
    }
  }

  /**
   * Setup default input sources
   */
  private setupDefaultInputSources() {
    // First, restore any existing input sources from cache
    this.restoreExistingInputSources();

    // Create default "Standby" input source if not already exists
    if (!this.inputSources.has('Standby')) {
      const standbySource = this.createInputSource('Standby', 1);
      this.inputSources.set('Standby', standbySource);
      this.currentActiveIdentifier = 1;
    }

    // Create "Home Screen" input source if not already exists
    if (!this.inputSources.has('Home Screen')) {
      const homeSource = this.createInputSource('Home Screen', 2);
      this.inputSources.set('Home Screen', homeSource);
    }

    // If we restored from cache, set current identifier appropriately
    if (this.currentActiveIdentifier === 0) {
      this.currentActiveIdentifier = 1; // Default to Standby
    }
  }

  /**
   * Restore existing input sources from accessory cache
   */
  private restoreExistingInputSources() {
    // Get all InputSource services from the accessory
    const inputSourceServices = this.accessory.services.filter(
      (service) => service.UUID === this.platform.Service.InputSource.UUID,
    );

    for (const service of inputSourceServices) {
      const nameChar = service.getCharacteristic(
        this.platform.Characteristic.Name,
      );
      const identifierChar = service.getCharacteristic(
        this.platform.Characteristic.Identifier,
      );

      if (nameChar && identifierChar) {
        const appName = nameChar.value as string;
        const identifier = identifierChar.value as number;

        this.inputSources.set(appName, service);
        this.platform.log.info(
          `Restored input source from cache: ${appName} (ID: ${identifier})`,
        );

        // Update currentActiveIdentifier if this was the previously active one
        const activeId = this.service.getCharacteristic(
          this.platform.Characteristic.ActiveIdentifier,
        ).value as number;
        if (identifier === activeId) {
          this.currentActiveIdentifier = identifier;
        }
      }
    }
  }
}
