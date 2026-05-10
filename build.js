const esbuild = require("esbuild");

// Cấu hình chung cho tất cả các file
const commonConfig = {
  bundle: true,
  minify: true, // Đổi thành false nếu bạn muốn đọc code ở file dist để debug
  logLevel: "info", // Báo cáo log ra terminal cho đẹp
};

async function buildAll() {
  try {
    // 1. Gatekeeper (Content Script)
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["src/content.ts"],
      outfile: "dist/content.bundle.js",
    });

    // 2. Main World Bridge & WASM Loader (Cần định dạng ESM cho WASM)
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["src/core_init.ts"],
      outfile: "dist/core_init.bundle.js",
      format: "esm",
    });

    // 3. Quyền năng tối cao (Background Script)
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["src/background.ts"],
      outfile: "dist/background.bundle.js",
    });

    await esbuild.build({
      ...commonConfig,
      entryPoints: ["src/anti_pause.ts"],
      outfile: "dist/anti_pause.bundle.js",
      // Không cần format: "esm" vì file này chỉ chạy script thuần túy hack Prototype,
      // không load WASM trực tiếp.
    });
  } catch (err) {
    console.error("❌ Lỗi trong quá trình build:", err);
    process.exit(1);
  }
}

buildAll();
