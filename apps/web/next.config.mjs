/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  ...(isStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        ...(basePath
          ? {
              assetPrefix: `${basePath}/`,
              basePath
            }
          : {}),
        images: {
          unoptimized: true
        }
      }
    : {})
};

export default nextConfig;
