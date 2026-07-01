import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [],
  async redirects() {
    return [
      {
        source: "/agents",
        destination: "/agent",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
