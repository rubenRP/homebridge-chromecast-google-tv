declare module 'castv2-client' {
  export interface Volume {
    level: number;
    muted: boolean;
  }

  export interface Application {
    appId: string;
    displayName: string;
    isIdleScreen: boolean;
    sessionId: string;
    statusText: string;
  }

  export interface ReceiverStatus {
    isStandBy: boolean;
    volume: Volume;
    applications?: Application[];
  }

  export interface Connection {
    [key: string]: any;
  }

  export interface Heartbeat {
    on(event: 'timeout', callback: () => void): void;
    on(event: 'pong', callback: () => void): void;
  }

  export interface Receiver {
    on(event: 'status', callback: (status: ReceiverStatus) => void): void;
    on(event: 'close', callback: () => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
  }

  export class Client {
    connection?: Connection;
    heartbeat?: Heartbeat;
    receiver?: Receiver;

    connect(host: string, callback: () => void): void;
    getStatus(
      callback: (err: Error | null, status: ReceiverStatus) => void,
    ): void;
  }
}
