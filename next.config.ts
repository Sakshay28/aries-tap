import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 defaults images.qualities to [75]; anything higher is coerced
    // down. We serve at 100 (near-lossless) so the optimizer never adds
    // compression on top of the source — low-res source images are still
    // limited by their own pixels, not this.
    qualities: [100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Private review feedback can carry up to 5 client-compressed photos
      // (~0.9 MB each) as base64 in the action payload, which inflates ~33%.
      // 8 MB leaves headroom over the 1 MB default without inviting abuse —
      // the action itself re-validates and hard-caps every image server-side.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
