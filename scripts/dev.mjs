if (process.platform === "darwin") process.env.BROWSER = "Safari";

process.argv.splice(2, 0, "--host", "127.0.0.1", "--open");
await import(new URL("bin/vite.js", import.meta.resolve("vite/package.json")));
