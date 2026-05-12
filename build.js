const esbuild = require("esbuild");

const isProd = process.argv.includes("--prod");

// Cấu hình chung cho tất cả các file
const commonConfig = {
  bundle: true,
  minify: true, // Đổi thành false nếu bạn muốn đọc code ở file dist để debug
  logLevel: "info", // Báo cáo log ra terminal cho đẹp
  define: {
    // Phép thuật tàng hình: Tiêm biến vào mọi ngóc ngách của code
    __DEV__: isProd ? "false" : "true",
  },
};

async function buildAll() {
  console.log(`🚀 BẮT ĐẦU DÂY CHUYỀN SẢN XUẤT`);
  console.log(
    `🎯 Chế độ: ${isProd ? "🔴 PRODUCTION (Tàng Hình)" : "🟢 DEVELOPMENT (Debug)"}\n`,
  );

  try {
    // 1. Gatekeeper (Content Script)
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["src/content.ts"],
      outfile: "dist/content.bundle.js",
    });

    // 2. Router (Background Script)
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

    console.log(
      "\n✅ [XUẤT XƯỞNG THÀNH CÔNG] - Code đã sẵn sàng cấy vào Chrome!",
    );
  } catch (err) {
    console.error("❌ Lỗi trong quá trình build:", err);
    process.exit(1);
  }
}

buildAll();
