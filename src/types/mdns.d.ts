declare module 'mdns' {
  export interface ServiceType {
    name: string;
    protocol: string;
  }

  export interface Service {
    type: ServiceType;
    name: string;
    host: string;
    port: number;
    addresses: string[];
    txtRecord: Record<string, string>;
  }

  export interface BrowserOptions {
    resolverSequence?: unknown[];
  }

  export interface Browser {
    start(): void;
    stop(): void;
    on(event: 'serviceUp', callback: (service: Service) => void): void;
    on(event: 'serviceDown', callback: (service: Service) => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
  }

  export function tcp(name: string): ServiceType;
  export function udp(name: string): ServiceType;

  export function createBrowser(
    serviceType: ServiceType,
    options?: BrowserOptions,
  ): Browser;

  export namespace rst {
    export function DNSServiceResolve(): unknown;
    export function DNSServiceGetAddrInfo(): unknown;
    export function getaddrinfo(options: { families: number[] }): unknown;
    export function makeAddressesUnique(): unknown;
  }

  export namespace dns_sd {
    export const DNSServiceGetAddrInfo: unknown;
  }
}
