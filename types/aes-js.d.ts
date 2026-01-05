declare module 'aes-js' {
  export const utils: {
    utf8: {
      toBytes: (text: string) => number[];
      fromBytes: (bytes: number[]) => string;
    };
    hex: {
      fromBytes: (bytes: number[]) => string;
      toBytes: (hex: string) => number[];
    };
  };

  export class Counter {
    constructor(initialValue: number);
  }

  export class ModeOfOperation {
    static ctr: new (key: Uint8Array, counter: Counter) => {
      encrypt: (bytes: number[]) => number[];
      decrypt: (bytes: number[]) => number[];
    };
  }
}