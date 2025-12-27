const nextConfig = {
  // Only treat files with these extensions as legacy Pages Router routes.
  // Prevents Next from treating files in src/pages/*.tsx as routes.
  pageExtensions: ["page.tsx", "page.ts", "api.ts", "api.tsx"],
};

export default nextConfig;
