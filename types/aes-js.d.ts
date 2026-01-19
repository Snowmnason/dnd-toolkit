declare module "aes-js" {
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
    constructor(initialValue: number | number[]);
    setBytes(bytes: number[]): void;
  }

  export namespace ModeOfOperation {
    class ctr {
      constructor(key: number[] | Uint8Array, counter: Counter);
      encrypt(bytes: number[] | Uint8Array): Uint8Array;
      decrypt(bytes: number[] | Uint8Array): Uint8Array;
    }
  }
}
