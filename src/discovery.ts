import { EventEmitter } from 'events';
import { Logger } from 'homebridge';

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

interface GenericService {
  name?: string;
  fullname?: string;
  host?: string;
  address?: string;
  addresses?: string[];
  port?: number;
  txtRecord?: Record<string, string>;
  txt?: Record<string, string>;
}

export class ChromecastDiscovery extends EventEmitter {
  private logger: Logger;
  private browser?: {
    start(): void;
    stop(): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  private fallbackBrowser?: {
    start(): void;
    stop(): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  private isScanning = false;
  private scanTimeout?: NodeJS.Timeout;
  private useFallback = false;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  async start(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    this.isScanning = true;
    this.logger.info('Starting Chromecast discovery...');

    try {
      // First try the original mdns approach
      await this.startMdnsDiscovery();
    } catch (error) {
      this.logger.warn(
        'Primary mDNS discovery failed, trying fallback method:',
        error,
      );
      this.useFallback = true;
      await this.startFallbackDiscovery();
    }

    // Set a timeout to stop scanning after 30 seconds
    this.scanTimeout = setTimeout(() => {
      this.stop();
    }, 30000);
  }

  stop(): void {
    if (!this.isScanning) {
      return;
    }

    this.isScanning = false;
    this.logger.debug('Stopping Chromecast discovery...');

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = undefined;
    }

    if (this.browser && typeof this.browser.stop === 'function') {
      try {
        this.browser.stop();
      } catch (error) {
        this.logger.debug('Error stopping mdns browser:', error);
      }
    }

    if (
      this.fallbackBrowser &&
      typeof this.fallbackBrowser.stop === 'function'
    ) {
      try {
        this.fallbackBrowser.stop();
      } catch (error) {
        this.logger.debug('Error stopping fallback browser:', error);
      }
    }

    this.browser = undefined;
    this.fallbackBrowser = undefined;
  }

  private async startMdnsDiscovery(): Promise<void> {
    try {
      const mdns = await import('mdns');

      const sequence = [
        mdns.rst.DNSServiceResolve(),
        'DNSServiceGetAddrInfo' in mdns.dns_sd
          ? mdns.rst.DNSServiceGetAddrInfo()
          : mdns.rst.getaddrinfo({ families: [0] }),
        mdns.rst.makeAddressesUnique(),
      ];

      this.browser = mdns.createBrowser(mdns.tcp('googlecast'), {
        resolverSequence: sequence,
      });

      this.browser.on('serviceUp', (...args: unknown[]) => {
        const service = args[0] as GenericService;
        this.handleServiceDiscovery(service);
      });

      this.browser.on('error', (...args: unknown[]) => {
        const error = args[0] as Error;
        this.logger.error('mDNS browser error:', error);
        if (!this.useFallback) {
          this.useFallback = true;
          this.startFallbackDiscovery();
        }
      });

      this.browser.start();
      this.logger.debug('mDNS discovery started successfully');
    } catch (error) {
      this.logger.error('Failed to start mDNS discovery:', error);
      throw error;
    }
  }

  private async startFallbackDiscovery(): Promise<void> {
    try {
      const dnssd = await import('dnssd');

      this.fallbackBrowser = dnssd
        .Browser(dnssd.tcp('googlecast'))
        .on('serviceUp', (...args: unknown[]) => {
          const service = args[0] as GenericService;
          this.handleServiceDiscovery(service);
        })
        .on('error', (...args: unknown[]) => {
          const error = args[0] as Error;
          this.logger.error('Fallback browser error:', error);
        });

      this.fallbackBrowser.start();
      this.logger.info('Fallback discovery started successfully');
    } catch (error) {
      this.logger.error('Failed to start fallback discovery:', error);
      // As a last resort, try manual network scanning
      await this.startManualDiscovery();
    }
  }

  private async startManualDiscovery(): Promise<void> {
    this.logger.info('Starting manual network discovery...');

    // This is a basic implementation that scans common Chromecast ports
    // on the local network. This should be enhanced based on actual needs.
    const { networkInterfaces } = await import('os');
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
      const netInfo = nets[name];
      if (!netInfo) {
        continue;
      }

      for (const net of netInfo) {
        // Skip internal and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          await this.scanNetworkRange(net.address, net.netmask);
        }
      }
    }
  }

  private async scanNetworkRange(ip: string, netmask: string): Promise<void> {
    // Simple network scanning implementation
    // This is a basic example - in production you might want a more sophisticated approach
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);

    // Calculate network address
    const networkParts = ipParts.map((part, i) => part & maskParts[i]);

    // For simplicity, just scan .1 to .254 in the last octet
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${networkParts[0]}.${networkParts[1]}.${networkParts[2]}.${i}`;
      this.checkChromecastPort(targetIp, 8009); // Standard Chromecast port
    }
  }

  private async checkChromecastPort(ip: string, port: number): Promise<void> {
    const net = await import('net');

    const socket = new net.Socket();
    const timeout = 1000; // 1 second timeout

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      // If we can connect, it might be a Chromecast - do a simple discovery
      this.logger.debug(`Found potential Chromecast at ${ip}:${port}`);

      // Create a mock service object similar to what mDNS would return
      const mockService = {
        name: `Chromecast-${ip}`,
        host: ip,
        port: port,
        txtRecord: {
          id: `chromecast-${ip.replace(/\./g, '-')}`,
          md: 'Chromecast', // Assume it's a Chromecast
          fn: `Chromecast-${ip}`,
        },
      };

      this.handleServiceDiscovery(mockService);
    });

    socket.on('timeout', () => {
      socket.destroy();
    });

    socket.on('error', () => {
      // Ignore connection errors - device is not a Chromecast or not available
    });

    try {
      socket.connect(port, ip);
    } catch (error) {
      // Ignore connection errors
    }
  }

  private handleServiceDiscovery(service: GenericService): void {
    try {
      this.logger.debug(
        'Raw service discovered:',
        JSON.stringify(service, null, 2),
      );

      // Normalize the service object to match expected format
      const device: ChromecastDevice = {
        name: service.name || service.fullname || `Chromecast-${service.host}`,
        host: service.host || service.address || service.addresses?.[0] || '',
        port: service.port || 8009,
        txtRecord: {
          id:
            service.txtRecord?.id ||
            service.txt?.id ||
            `chromecast-${Date.now()}`,
          md: service.txtRecord?.md || service.txt?.md || 'Chromecast',
          fn: service.txtRecord?.fn || service.txt?.fn || service.name,
          ca: service.txtRecord?.ca || service.txt?.ca,
          st: service.txtRecord?.st || service.txt?.st,
          ic: service.txtRecord?.ic || service.txt?.ic,
        },
      };

      this.logger.info(
        `Discovered Chromecast device: ${device.name} (${device.txtRecord.md}) at ${device.host}:${device.port}`,
      );

      // Only emit devices that are likely to be Chromecasts
      if (this.isChromecastDevice(device)) {
        this.emit('serviceUp', device);
      }
    } catch (error) {
      this.logger.error('Error handling service discovery:', error);
    }
  }

  private isChromecastDevice(device: ChromecastDevice): boolean {
    const validModels = [
      'Chromecast',
      'Chromecast Ultra',
      'Chromecast with Google TV',
      'Google Nest Hub',
      'Google Nest Hub Max',
      'Google Home',
      'Google Home Mini',
      'Google Home Max',
    ];

    return validModels.some(
      (model) =>
        device.txtRecord.md?.includes(model) ||
        device.name?.toLowerCase().includes('chromecast') ||
        device.name?.toLowerCase().includes('google'),
    );
  }
}
