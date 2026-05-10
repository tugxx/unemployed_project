function injectAntiPause() {
  if (globalThis.__antiPauseInjected) return;
  globalThis.__antiPauseInjected = true;

  if (globalThis.self === window.top || window.innerWidth > 300) {
    console.log("🌌 [Universal Anti-Pause]: Khởi động Lỗ Đen Đa Vũ Trụ...");
  }

  // 1. TỪ ĐIỂN TÍN HIỆU CỦA TẤT CẢ GAME ENGINE
  // Bất kỳ engine nào muốn biết bạn đi vắng, đều phải dùng 1 trong các từ khóa này
  const awayEvents = [
    "mouseleave",
    "mouseout",
    "pointerleave",
    "pointerout",
    "lostpointercapture",
    "blur",
    "focusout",
    "visibilitychange",
    "pagehide",
    "webkitvisibilitychange",
  ];

  // ==========================================
  // LỚP PHÒNG NGỰ 1: "THAY TÊN ĐỔI HỌ" (Bypass mọi hàm check Event.type như OpenFL)
  // ==========================================
  const originalTypeDescriptor = Object.getOwnPropertyDescriptor(
    Event.prototype,
    "type",
  );
  if (originalTypeDescriptor?.get) {
    const origGet = originalTypeDescriptor.get;

    Object.defineProperty(Event.prototype, "type", {
      get: function (this: Event) {
        const realType = origGet.call(this);

        if (typeof realType === "string" && awayEvents.includes(realType)) {
          // Kính chiếu yêu: Nếu sự kiện này xảy ra trên chính cái Tool của ta thì tha cho nó
          // Để egui vẫn nhận được sự kiện chuột bình thường
          const target = this.target as HTMLElement;
          if (target?.id === "wasm-stealth-canvas") {
            return realType;
          }
          // Nếu là của Game -> Đổi tên thành rác để Engine Game không nhận ra!
          return "blocked_by_wasm_hacker";
        }
        return realType;
      },
      configurable: true,
    });
  }

  // ==========================================
  // LỚP PHÒNG NGỰ 2: "LỖ ĐEN CAPTURE PHASE" (Bắt mọi addEventListener / onBlur inline)
  // ==========================================
  const eventBlackhole = (e: Event) => {
    const target = e.target as HTMLElement;
    // Bỏ qua nếu là Tool của mình
    if (target?.id === "wasm-stealth-canvas") return;

    // Tiêu diệt sự kiện ngay từ trên không, không cho rơi xuống Canvas của Game
    e.stopImmediatePropagation();
    e.stopPropagation();
  };

  awayEvents.forEach((eventName) => {
    // Cắm bẫy ở tầng cao nhất của Trình duyệt (Window & Document) với quyền ưu tiên tuyệt đối (capture: true)
    globalThis.addEventListener(eventName, eventBlackhole, {
      capture: true,
      passive: true,
    });
    document.addEventListener(eventName, eventBlackhole, {
      capture: true,
      passive: true,
    });
  });

  // ==========================================
  // LỚP PHÒNG NGỰ 3: ẢO GIÁC TRẠNG THÁI (Dành riêng cho Unity / Godot Polling)
  // ==========================================
  const _Document_prototype = Document.prototype as unknown as Document;
  try {
    Object.defineProperty(_Document_prototype, "visibilityState", {
      get: () => "visible",
      configurable: true,
    });
    Object.defineProperty(_Document_prototype, "hidden", {
      get: () => false,
      configurable: true,
    });
    Object.defineProperty(_Document_prototype, "hasFocus", {
      value: () => true,
      configurable: true,
    });
  } catch (err) {
    console.warn("⚠️ [Anti-Pause]: Lớp 3 bị block bởi trình duyệt", err);
  }

  // ==========================================
  // LỚP ĐẶC TRỊ: GAME DISTRIBUTION SDK (Hầu hết game web dùng SDK này)
  // ==========================================
  let _gdsdk = globalThis.gdsdk;
  Object.defineProperty(globalThis, "gdsdk", {
    get: () => _gdsdk,
    set: (val: typeof globalThis.gdsdk) => {
      if (val)
        val.pause = () => {
          console.log("🛡️ GD SDK Pause -> Blocked!");
        };
      _gdsdk = val;
    },
    configurable: true,
  });
  if (globalThis.gdsdk && typeof globalThis.gdsdk.pause === "function") {
    globalThis.gdsdk.pause = () => {};
  }
}

injectAntiPause();
