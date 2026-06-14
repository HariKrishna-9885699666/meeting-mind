/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
  serverExternalPackages: ['onnxruntime-node'],
  turbopack: {
    resolveAlias: {
      fs: './lib/empty-module.js',
      // Use path-browserify instead of empty module — @ffmpeg/util needs path.posix.join()
      path: 'path-browserify',
      url: './lib/empty-module.js',
    },
  },
};

export default nextConfig;
