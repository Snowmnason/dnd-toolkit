import {
  buildAdaptiveQueryParams,
  getAdaptivePayloadOptions,
  getCacheKeyQualityComponent,
  type AdaptivePayloadOptions,
  type PayloadQuality
} from "@/lib/network";
import { ConnectionQuality, NetworkStatus } from "@/system/Network";

import { describe, expect, it } from "vitest";

describe("Adaptive Payload Sizing (lib/network/adaptive-payload)", () => {
  describe("getAdaptivePayloadOptions", () => {
    it("returns 4G options for 4g connection", () => {
      const status: NetworkStatus = {
        isOnline: true,
        type: "wifi",
        isExpensive: false,
        connectionQuality: ConnectionQuality.GOOD,
        isInternetReachable: true,
        effectiveType: "4g",
      };

      const options = getAdaptivePayloadOptions(status);

      expect(options.imageQuality).toBe("hd");
      expect(options.includeImages).toBe(true);
      expect(options.includeDetails).toBe(true);
      expect(options.includeMaps).toBe(true);
      expect(options.maxPayloadSize).toBe(5 * 1024 * 1024); // 5MB
      expect(options.compressionEnabled).toBe(true);
    });

    it("returns 3G options for 3g connection", () => {
      const status: NetworkStatus = {
        isOnline: true,
        type: "wifi",
        isExpensive: false,
        connectionQuality: ConnectionQuality.GOOD,
        isInternetReachable: true,
        effectiveType: "3g",
      };

      const options = getAdaptivePayloadOptions(status);

      expect(options.imageQuality).toBe("sd");
      expect(options.includeImages).toBe(true);
      expect(options.includeDetails).toBe(true);
      expect(options.includeMaps).toBe(false);
      expect(options.maxPayloadSize).toBe(2 * 1024 * 1024); // 2MB
      expect(options.compressionEnabled).toBe(true);
    });

    it("returns 2G options for 2g connection", () => {
      const status: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: true,
        connectionQuality: ConnectionQuality.BAD,
        isInternetReachable: true,
        effectiveType: "2g",
      };

      const options = getAdaptivePayloadOptions(status);

      expect(options.imageQuality).toBe("thumb");
      expect(options.includeImages).toBe(true);
      expect(options.includeDetails).toBe(false);
      expect(options.includeMaps).toBe(false);
      expect(options.maxPayloadSize).toBe(500 * 1024); // 500KB
      expect(options.compressionEnabled).toBe(true);
    });

    it("returns 2G options for slow-2g connection", () => {
      const status: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: true,
        connectionQuality: ConnectionQuality.BAD,
        isInternetReachable: true,
        effectiveType: "slow-2g",
      };

      const options = getAdaptivePayloadOptions(status);

      expect(options.imageQuality).toBe("thumb");
      expect(options.includeImages).toBe(true);
      expect(options.includeDetails).toBe(false);
      expect(options.includeMaps).toBe(false);
      expect(options.maxPayloadSize).toBe(500 * 1024); // 500KB
    });

    it("returns offline options for offline state", () => {
      const status: NetworkStatus = {
        isOnline: false,
        type: "none",
        isExpensive: false,
        connectionQuality: ConnectionQuality.OFFLINE,
        isInternetReachable: false,
        effectiveType: "offline",
      };

      const options = getAdaptivePayloadOptions(status);

      expect(options.imageQuality).toBe("text-only");
      expect(options.includeImages).toBe(false);
      expect(options.includeDetails).toBe(false);
      expect(options.includeMaps).toBe(false);
      expect(options.maxPayloadSize).toBe(0); // No limit
      expect(options.compressionEnabled).toBe(true);
    });

    it("returns safe default for unknown effectiveType", () => {
      const status: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: true,
        connectionQuality: ConnectionQuality.BAD,
        isInternetReachable: true,
        effectiveType: "unknown" as any,
      };

      const options = getAdaptivePayloadOptions(status);

      expect(options.imageQuality).toBe("sd");
      expect(options.includeImages).toBe(true);
      expect(options.includeDetails).toBe(true);
      expect(options.includeMaps).toBe(false);
      expect(options.maxPayloadSize).toBe(2 * 1024 * 1024); // 2MB
    });

    it("returns safe default for null status", () => {
      const options = getAdaptivePayloadOptions(null);

      expect(options.imageQuality).toBe("sd");
      expect(options.includeImages).toBe(true);
      expect(options.includeDetails).toBe(true);
      expect(options.includeMaps).toBe(false);
      expect(options.maxPayloadSize).toBe(2 * 1024 * 1024); // 2MB
    });

    it("returns safe default for undefined status", () => {
      const options = getAdaptivePayloadOptions(undefined);

      expect(options.imageQuality).toBe("sd");
      expect(options.includeImages).toBe(true);
      expect(options.includeDetails).toBe(true);
      expect(options.includeMaps).toBe(false);
      expect(options.maxPayloadSize).toBe(2 * 1024 * 1024); // 2MB
    });

    it("verifies payload reduction: 4G vs 2G is at least 50%", () => {
      const status4G: NetworkStatus = {
        isOnline: true,
        type: "wifi",
        isExpensive: false,
        connectionQuality: ConnectionQuality.GOOD,
        isInternetReachable: true,
        effectiveType: "4g",
      };
      const status2G: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: true,
        connectionQuality: ConnectionQuality.BAD,
        isInternetReachable: true,
        effectiveType: "2g",
      };

      const options4G = getAdaptivePayloadOptions(status4G);
      const options2G = getAdaptivePayloadOptions(status2G);

      // 4G (WIFI) allows 5MB, 2G allows 500KB = 90% reduction
      const reduction = (1 - options2G.maxPayloadSize / options4G.maxPayloadSize) * 100;
      expect(reduction).toBeGreaterThanOrEqual(50);
      expect(reduction).toBeGreaterThan(89); // ~90% reduction
      expect(reduction).toBeLessThan(91);
    });
  });

  describe("buildAdaptiveQueryParams", () => {
    it("builds correct params for 4G options", () => {
      const options: AdaptivePayloadOptions = {
        includeImages: true,
        imageQuality: "hd",
        includeDetails: true,
        includeMaps: true,
        maxPayloadSize: 5 * 1024 * 1024,
        compressionEnabled: true,
      };

      const params = buildAdaptiveQueryParams(options);

      expect(params.imageQuality).toBe("hd");
      expect(params.maxPayloadBytes).toBe(5 * 1024 * 1024);
      expect(params.compress).toBe(true);
      expect(params.summaryOnly).toBeUndefined();
      expect(params.excludeMaps).toBeUndefined();
      expect(params.noImages).toBeUndefined();
    });

    it("builds correct params for 2G options", () => {
      const options: AdaptivePayloadOptions = {
        includeImages: true,
        imageQuality: "thumb",
        includeDetails: false,
        includeMaps: false,
        maxPayloadSize: 500 * 1024,
        compressionEnabled: true,
      };

      const params = buildAdaptiveQueryParams(options);

      expect(params.imageQuality).toBe("thumb");
      expect(params.summaryOnly).toBe(true);
      expect(params.excludeMaps).toBe(true);
      expect(params.maxPayloadBytes).toBe(500 * 1024);
      expect(params.compress).toBe(true);
      expect(params.noImages).toBeUndefined();
    });

    it("builds correct params for offline options", () => {
      const options: AdaptivePayloadOptions = {
        includeImages: false,
        imageQuality: "text-only",
        includeDetails: false,
        includeMaps: false,
        maxPayloadSize: 0,
        compressionEnabled: true,
      };

      const params = buildAdaptiveQueryParams(options);

      expect(params.noImages).toBe(true);
      expect(params.summaryOnly).toBe(true);
      expect(params.excludeMaps).toBe(true);
      expect(params.compress).toBe(true);
      expect(params.imageQuality).toBeUndefined(); // text-only not sent
      expect(params.maxPayloadBytes).toBeUndefined(); // 0 not sent
    });

    it("omits zero maxPayloadSize from params", () => {
      const options: AdaptivePayloadOptions = {
        includeImages: false,
        imageQuality: "text-only",
        includeDetails: false,
        includeMaps: false,
        maxPayloadSize: 0, // Should be omitted
        compressionEnabled: true,
      };

      const params = buildAdaptiveQueryParams(options);

      expect(params.maxPayloadBytes).toBeUndefined();
    });

    it("includes positive maxPayloadSize in params", () => {
      const options: AdaptivePayloadOptions = {
        includeImages: true,
        imageQuality: "sd",
        includeDetails: true,
        includeMaps: false,
        maxPayloadSize: 2 * 1024 * 1024, // Should be included
        compressionEnabled: true,
      };

      const params = buildAdaptiveQueryParams(options);

      expect(params.maxPayloadBytes).toBe(2 * 1024 * 1024);
    });

    it("omits text-only from params", () => {
      const options: AdaptivePayloadOptions = {
        includeImages: true,
        imageQuality: "text-only",
        includeDetails: false,
        includeMaps: false,
        maxPayloadSize: 0,
        compressionEnabled: true,
      };

      const params = buildAdaptiveQueryParams(options);

      expect(params.imageQuality).toBeUndefined(); // text-only not sent
    });

    it("omits unnecessary params when all defaults", () => {
      const options: AdaptivePayloadOptions = {
        includeImages: false,
        imageQuality: "text-only",
        includeDetails: false,
        includeMaps: false,
        maxPayloadSize: 0,
        compressionEnabled: true,
      };

      const params = buildAdaptiveQueryParams(options);

      // Should only contain explicit boolean flags for the "text-only" case
      expect(params).toMatchObject({
        noImages: true,
        summaryOnly: true,
        excludeMaps: true,
        compress: true,
      });

      // Should NOT include properties that represent non-default values
      expect(params).not.toHaveProperty("imageQuality");
      expect(params).not.toHaveProperty("maxPayloadBytes");
    });
  });

  describe("getCacheKeyQualityComponent", () => {
    it("returns effectiveType for 4G", () => {
      const status: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: false,
        connectionQuality: ConnectionQuality.GOOD,
        isInternetReachable: true,
        effectiveType: "4g",
      };

      const component = getCacheKeyQualityComponent(status);

      expect(component).toBe("4g");
    });

    it("returns effectiveType for 2G", () => {
      const status: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: true,
        connectionQuality: ConnectionQuality.BAD,
        isInternetReachable: true,
        effectiveType: "2g",
      };

      const component = getCacheKeyQualityComponent(status);

      expect(component).toBe("2g");
    });

    it("returns 'unknown' for null status", () => {
      const component = getCacheKeyQualityComponent(null);

      expect(component).toBe("unknown");
    });

    it("returns 'unknown' for undefined status", () => {
      const component = getCacheKeyQualityComponent(undefined);

      expect(component).toBe("unknown");
    });

    it("returns 'unknown' when effectiveType is null", () => {
      const status: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: false,
        connectionQuality: ConnectionQuality.GOOD,
        isInternetReachable: true,
        effectiveType: null as any,
      };

      const component = getCacheKeyQualityComponent(status);

      expect(component).toBe("unknown");
    });

    it("enables cache key differentiation: 4G vs 2G separate", () => {
      const status4G: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: false,
        connectionQuality: ConnectionQuality.GOOD,
        isInternetReachable: true,
        effectiveType: "4g",
      };
      const status2G: NetworkStatus = {
        isOnline: true,
        type: "cellular",
        isExpensive: true,
        connectionQuality: ConnectionQuality.BAD,
        isInternetReachable: true,
        effectiveType: "2g",
      };

      const key4G = getCacheKeyQualityComponent(status4G);
      const key2G = getCacheKeyQualityComponent(status2G);

      expect(key4G).not.toBe(key2G);
      // Example: ['worlds', '4g'] vs ['worlds', '2g'] stored separately
      const cacheKey4G = ["worlds", key4G];
      const cacheKey2G = ["worlds", key2G];
      expect(cacheKey4G).not.toEqual(cacheKey2G);
    });
  });

  describe("Integration: Quality Tiers", () => {
    it("all 5 tiers return valid AdaptivePayloadOptions", () => {
      const tiers: {
        status: NetworkStatus;
        expectedQuality: PayloadQuality;
        tierName: string;
      }[] = [
        {
          status: {
            isOnline: true,
            type: "wifi",
            isExpensive: false,
            connectionQuality: ConnectionQuality.GOOD,
            isInternetReachable: true,
            effectiveType: "4g",
          },
          expectedQuality: "hd",
          tierName: "4G",
        },
        {
          status: {
            isOnline: true,
            type: "wifi",
            isExpensive: false,
            connectionQuality: ConnectionQuality.GOOD,
            isInternetReachable: true,
            effectiveType: "3g",
          },
          expectedQuality: "sd",
          tierName: "3G",
        },
        {
          status: {
            isOnline: true,
            type: "cellular",
            isExpensive: true,
            connectionQuality: ConnectionQuality.BAD,
            isInternetReachable: true,
            effectiveType: "2g",
          },
          expectedQuality: "thumb",
          tierName: "2G",
        },
        {
          status: {
            isOnline: true,
            type: "cellular",
            isExpensive: true,
            connectionQuality: ConnectionQuality.BAD,
            isInternetReachable: true,
            effectiveType: "slow-2g",
          },
          expectedQuality: "thumb",
          tierName: "slow-2g",
        },
        {
          status: {
            isOnline: false,
            type: "none",
            isExpensive: false,
            connectionQuality: ConnectionQuality.OFFLINE,
            isInternetReachable: false,
            effectiveType: "offline",
          },
          expectedQuality: "text-only",
          tierName: "offline",
        },
      ];

      tiers.forEach(({ status, expectedQuality, tierName }) => {
        const options = getAdaptivePayloadOptions(status);
        expect(options.imageQuality).toBe(expectedQuality);
        expect(options.maxPayloadSize).toBeGreaterThanOrEqual(0);
        expect(typeof options.compressionEnabled).toBe("boolean");
      });
    });

    it("payload sizes decrease monotonically: 4G > 3G > 2G", () => {
      const options4G = getAdaptivePayloadOptions({
        isOnline: true,
        type: "wifi",
        isExpensive: false,
        connectionQuality: ConnectionQuality.GOOD,
        isInternetReachable: true,
        effectiveType: "4g",
      });
      const options3G = getAdaptivePayloadOptions({
        isOnline: true,
        type: "wifi",
        isExpensive: false,
        connectionQuality: ConnectionQuality.GOOD,
        isInternetReachable: true,
        effectiveType: "3g",
      });
      const options2G = getAdaptivePayloadOptions({
        isOnline: true,
        type: "cellular",
        isExpensive: true,
        connectionQuality: ConnectionQuality.BAD,
        isInternetReachable: true,
        effectiveType: "2g",
      });

      expect(options4G.maxPayloadSize).toBeGreaterThan(options3G.maxPayloadSize);
      expect(options3G.maxPayloadSize).toBeGreaterThan(options2G.maxPayloadSize);
    });

    it("map inclusion disabled for 3G and below", () => {
      const tiers = ["4g", "3g", "2g", "slow-2g"];

      tiers.forEach((tier) => {
        const status: NetworkStatus = {
          isOnline: true,
          type: tier === "4g" ? "wifi" : "cellular",
          isExpensive: tier !== "4g",
          connectionQuality: tier === "4g" ? ConnectionQuality.GOOD : ConnectionQuality.BAD,
          isInternetReachable: true,
          effectiveType: tier as any,
        };
        const options = getAdaptivePayloadOptions(status);

        if (tier === "4g") {
          expect(options.includeMaps).toBe(true);
        } else {
          expect(options.includeMaps).toBe(false);
        }
      });
    });

    it("detail inclusion disabled for 2G and offline", () => {
      const tiers = [
        { tier: "4g", expected: true },
        { tier: "3g", expected: true },
        { tier: "2g", expected: false },
        { tier: "slow-2g", expected: false },
        { tier: "offline", expected: false },
      ];

      tiers.forEach(({ tier, expected }) => {
        const status: NetworkStatus = {
          isOnline: tier !== "offline",
          type: tier === "offline" ? "none" : tier === "4g" || tier === "3g" ? "wifi" : "cellular",
          isExpensive: tier !== "4g" && tier !== "3g" && tier !== "offline",
          connectionQuality:
            tier === "offline" ? ConnectionQuality.OFFLINE : tier === "2g" || tier === "slow-2g" ? ConnectionQuality.BAD : ConnectionQuality.GOOD,
          isInternetReachable: tier !== "offline",
          effectiveType: tier as any,
        };

        const options = getAdaptivePayloadOptions(status);

        expect(options.includeDetails).toBe(expected);
      });
    });
  });
});
