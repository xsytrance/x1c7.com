/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 public buckets (*.r2.dev)
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
      // Custom R2 domain — uncomment and update when configured:
      // {
      //   protocol: "https",
      //   hostname: "images.x1c7.com",
      //   pathname: "/**",
      // },
    ],
  },
};

export default nextConfig;
