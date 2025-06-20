// Type definitions for dnssd
declare module 'dnssd' {
  export interface ServiceType {
    name: string;
    protocol: string;
  }

  export interface Service {
    name: string;
    type: ServiceType;
    host: string;
    port: number;
    addresses?: string[];
    txt?: Record<string, string>;
    txtRecord?: Record<string, string>;
  }

  export interface Browser {
    start(): void;
    stop(): void;
    on(event: 'serviceUp', listener: (service: Service) => void): Browser;
    on(event: 'serviceDown', listener: (service: Service) => void): Browser;
    on(event: 'error', listener: (error: Error) => void): Browser;
  }

  export function tcp(name: string): ServiceType;
  export function Browser(type: ServiceType): Browser;
}
