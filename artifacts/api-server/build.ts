import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile, copyFile, mkdir } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times without risking some
// packages that are not bundle compatible
const allowlist = [
  "@google/generative-ai",
  "axios",
  "bcryptjs",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "bcryptjs",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("building server...");
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter(
    (dep) =>
      !allowlist.includes(dep) &&
      !(pkg.dependencies?.[dep]?.startsWith("workspace:")),
  );

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(distDir, "index.mjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    banner: {
      js: [
        `import { createRequire as _cr } from 'module';`,
        `import { fileURLToPath as _fup } from 'url';`,
        `import { dirname as _dn } from 'path';`,
        `const require = _cr(import.meta.url);`,
      ].join("\n"),
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  await mkdir(distDir, { recursive: true });

  const staticFiles = [
    "admin.html",
    "merchant-portal.html",
    "advertiser.html",
    "portal-supermercado.html",
    "logo-dark.png",
    "logo-light.png",
    "logo-white.png",
  ];
  for (const file of staticFiles) {
    await copyFile(
      path.resolve(__dirname, "src", file),
      path.resolve(distDir, file),
    );
    console.log(`copied ${file} to dist/`);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
