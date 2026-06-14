/* router.js — client-side screen switching, drawer, bottom nav, init.
   Loaded last; calls each screen's render() on navigation. */
(function () {
  "use strict";
  const SCREENS = {
    orders: "screen-orders", return: "screen-return", rider: "screen-rider", map: "screen-map",
    "p2p-nudge": "screen-p2p-nudge", "p2p-grade": "screen-p2p-grade", "p2p-handoff": "screen-p2p-handoff",
    hub: "screen-hub",
  };

  // Drawer + bottom-nav definitions.
  const DRAWER = [
    { key: "hub", icon: "dashboard", label: "Hub" },
    { key: "orders", icon: "person", label: "Customer (return)" },
    { key: "rider", icon: "local_shipping", label: "Rider grading" },
    { key: "map", icon: "map", label: "Logistics map" },
    { key: "p2p-nudge", icon: "sync_alt", label: "P2P resale" },
  ];
  const BOTTOM = [
    { key: "hub", icon: "home", label: "Home" },
    { key: "orders", icon: "package_2", label: "Orders" },
    { key: "rider", icon: "photo_camera", label: "Scan" },
    { key: "map", icon: "map", label: "Map" },
  ];

  let current = "hub";

  function go(key) {
    if (!SCREENS[key]) return;
    current = key;
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(SCREENS[key]).classList.add("active");
    document.getElementById("screen-host").scrollTo(0, 0);

    // AI pill only on grading-ish screens
    const aiPill = document.getElementById("ai-pill");
    aiPill.classList.toggle("hidden", !["rider", "p2p-grade"].includes(key));
    aiPill.classList.toggle("flex", ["rider", "p2p-grade"].includes(key));

    renderNav();
    const scr = App.screens[key];
    if (scr && scr.render) scr.render();
  }

  function renderNav() {
    // drawer
    document.getElementById("drawer-list").innerHTML = DRAWER.map((d) => {
      const active = d.key === current || (d.key === "p2p-nudge" && current.startsWith("p2p"));
      return `<li><button class="w-full flex items-center px-4 py-3 mx-2 rounded-lg text-left transition-colors ${active ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high"}" onclick="App.router.go('${d.key}'); App.drawer.toggle()">
        <span class="material-symbols-outlined mr-3">${d.icon}</span><span class="font-body-lg text-body-lg">${d.label}</span></button></li>`;
    }).join("");
    // bottom nav
    document.getElementById("bottom-nav").innerHTML = BOTTOM.map((b) => {
      const active = b.key === current || (b.key === "rider" && current === "rider");
      return `<button class="flex flex-col items-center justify-center flex-1 h-full pt-1 transition-colors ${active ? "text-primary border-t-2 border-primary" : "text-on-surface-variant hover:bg-surface-container-low"}" onclick="App.router.go('${b.key}')">
        <span class="material-symbols-outlined ${active ? "fill-icon" : ""}">${b.icon}</span>
        <span class="font-label-md text-label-md mt-1">${b.label}</span></button>`;
    }).join("");
  }

  const drawer = {
    toggle() {
      const d = document.getElementById("drawer"), o = document.getElementById("drawer-overlay");
      const open = !d.classList.contains("-translate-x-full");
      d.classList.toggle("-translate-x-full", open);
      o.classList.toggle("hidden", open);
    },
  };

  App.router = { go };
  App.drawer = drawer;

  // ---- init -------------------------------------------------------------
  function init() {
    // backend health → drawer chip
    App.api.health().then((h) => {
      const chip = document.getElementById("health-chip");
      if (!chip) return;
      const ok = h && h.status === "ok";
      chip.innerHTML = `<span class="w-2 h-2 rounded-full ${ok ? "bg-success" : "bg-error"}"></span><span>backend: ${ok ? "live on :8000" : "unreachable"}</span>`;
      if (!ok) App.toast("Backend not reachable on :8000 — run: uvicorn backend.main:app", "err", 6000);
    });
    go("hub");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
