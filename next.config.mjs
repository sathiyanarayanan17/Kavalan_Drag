/** @type {import('next').NextConfig} */
const nextConfig = {
	// Produce a self-contained server bundle for Docker deployment.
	output: "standalone",
	// node:sqlite is a Node 22+ built-in; tell webpack not to bundle it.
	// better-sqlite3 ships a native addon and must stay external too.
	webpack: (config, { isServer }) => {
		if (isServer) {
			config.externals = [
				...(config.externals || []),
				"node:sqlite",
				"better-sqlite3",
			];
		}
		return config;
	},
};

export default nextConfig;
