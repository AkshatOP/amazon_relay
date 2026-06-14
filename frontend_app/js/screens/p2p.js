/* p2p.js — Screens 5–7 (P2P resale exchange).
   5 Nudge   : /p2p/purchases + /p2p/nudge      (Stage-1 price)
   6 Grade   : /grade (or functional) + /p2p/list (Stage-2 price + Health Card)
   7 Handoff : /p2p/demand/generate + /find + /p2p/handoff (payout + CO₂ + green credits) */
(function () {
  "use strict";
  const { fmt, ui } = { fmt: App.fmt, ui: App.ui };
  const MAX_PHOTOS = 5;
  let p2pFiles = [];   // up to MAX_PHOTOS File objects, all sent to /grade

  // ---- Screen 5: Nudge --------------------------------------------------
  async function renderNudge() {
    const host = document.getElementById("screen-p2p-nudge");
    host.innerHTML = `<div class="flex items-center justify-center p-8 text-on-surface-variant gap-2"><span class="material-symbols-outlined animate-spin">autorenew</span> loading purchases…</div>`;

    const res = await App.api.purchases();
    const list = (res && res.purchases) || [];
    const p = list.find((x) => x.category === "baby_monitor") || list[0];
    App.state.p2p.purchase = p;
    if (!p) { host.innerHTML = `<p class="p-4 text-on-surface-variant">No purchases seeded. Run <code>python -m backend.seed.seed_all</code>.</p>`; return; }

    const sy = App.state.p2p.simulateYears;
    host.innerHTML = `
      <h2 class="font-headline-md text-headline-md text-primary">P2P Exchange</h2>
      <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md flex flex-col gap-stack-sm shadow-sm">
        <div class="relative overflow-hidden h-40 bg-surface-container rounded-md flex items-center justify-center text-on-surface-variant">
          ${App.ui.productImg(p.asin, iconFor(p.category), "text-[56px]")}</div>
        <h3 class="font-headline-sm text-headline-sm text-on-surface mt-2">${p.item_name}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant">Purchased: ${p.purchase_date} · ${fmt.inr(p.original_price)}</p>
        <div class="flex items-center gap-2 mt-2">
          <label class="font-label-md text-label-md text-on-surface-variant">Simulate years:</label>
          <input id="sim-years" type="number" step="0.5" min="0" max="12" value="${sy}" class="w-20 border border-outline-variant rounded p-1.5 font-body-md text-body-md"/>
          <button id="btn-nudge" class="ml-auto bg-primary text-on-primary font-label-bold text-label-bold py-2 px-4 rounded-full flex items-center gap-1">
            <span class="material-symbols-outlined text-[18px]">update</span> Simulate</button>
        </div>
      </div>
      <div id="nudge-sheet"></div>`;
    document.getElementById("btn-nudge").addEventListener("click", doNudge);
  }

  async function doNudge() {
    const p = App.state.p2p.purchase;
    const sy = parseFloat(document.getElementById("sim-years").value) || 0;
    App.state.p2p.simulateYears = sy;
    const n = await App.api.nudge(p.id, sy);
    if (!n || n._networkError || n.error) { App.toast(n && n.error ? n.error : "nudge failed", "err"); return; }
    App.state.p2p.nudge = n;
    const sheet = document.getElementById("nudge-sheet");
    sheet.innerHTML = `
      <div class="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_-4px_12px_rgba(0,0,0,0.05)] p-container-margin flex flex-col gap-stack-lg animate-enter">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-full ${n.in_window ? "bg-secondary-container" : "bg-surface-container-high"} flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-on-secondary-container">${n.in_window ? "notifications_active" : "schedule"}</span></div>
          <p class="font-body-md text-body-md text-on-surface">${n.message}</p>
        </div>
        <div class="text-center bg-amber/10 rounded-lg py-3">
          <div class="font-display-lg text-display-lg text-on-surface">${fmt.inr(n.estimated_price)}</div>
          <div class="font-label-md text-label-md text-on-surface-variant">Stage-1 estimate (assumes Grade C — grading can raise it)</div>
        </div>
        <button class="w-full bg-transparent border border-primary text-primary font-label-bold text-label-bold py-3 rounded-lg flex justify-center items-center gap-2" onclick="App.router.go('p2p-grade')">
          Scan to grade for a higher price <span class="material-symbols-outlined text-[18px]">arrow_forward</span></button>
      </div>`;
  }

  // ---- Screen 6: Grade + Health Card -----------------------------------
  function renderGradeScreen() {
    p2pFiles = [];
    const p = App.state.p2p.purchase;
    const host = document.getElementById("screen-p2p-grade");
    if (!p) { host.innerHTML = `<p class="p-4">Start from the Nudge screen.</p>`; return; }
    host.innerHTML = `
      <div class="flex items-center gap-2"><button class="p-1 -ml-1 text-on-surface-variant" onclick="App.router.go('p2p-nudge')"><span class="material-symbols-outlined">arrow_back</span></button>
        <h2 class="font-headline-md text-headline-md text-on-surface">Grade Condition</h2></div>

      <div id="p2p-drop" class="relative bg-near-black rounded-xl overflow-hidden min-h-[240px] flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-transparent transition-colors">
        <img id="p2p-preview" alt="" class="absolute inset-0 w-full h-full object-contain bg-near-black hidden"/>
        <div class="relative w-40 h-40 flex items-center justify-center pointer-events-none">
          <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber bracket-anim"></div>
          <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber bracket-anim"></div>
          <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber bracket-anim"></div>
          <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber bracket-anim"></div>
          <span class="material-symbols-outlined text-[48px] text-white/70 p2p-icon">${iconFor(p.category)}</span>
        </div>
        <span id="p2p-hint" class="font-label-md text-label-md text-white/70 z-[5] text-center px-4">Drag &amp; drop up to ${MAX_PHOTOS} photos, tap to choose, or use the live camera</span>
        <span id="p2p-count" class="hidden absolute top-2 right-2 z-10 bg-amber text-near-black font-label-bold text-label-bold px-2 py-0.5 rounded-full"></span>
        <input id="p2p-file" type="file" accept="image/*" multiple class="hidden"/>
      </div>

      <div id="p2p-strip" class="hidden grid-cols-5 gap-2"></div>

      <div class="grid grid-cols-2 gap-2">
        <button id="p2p-add" class="bg-surface border border-outline-variant rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors font-label-bold text-label-bold text-on-surface">
          <span class="material-symbols-outlined text-[18px]">add_photo_alternate</span> Add / drop photos</button>
        <button id="p2p-cam" class="bg-surface border border-primary text-primary rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors font-label-bold text-label-bold">
          <span class="material-symbols-outlined text-[18px]">photo_camera</span> Live camera</button>
      </div>
      <p class="font-label-md text-label-md text-on-surface-variant -mt-1">Add 1–${MAX_PHOTOS} photos (more angles + close-ups of any worn/damaged part grade more accurately). All photos are sent to the AI together. No photo → functional checklist grade (still a real API call).</p>

      <button id="btn-p2p-grade" class="w-full bg-primary text-on-primary py-3 rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-2">
        <span class="material-symbols-outlined">memory</span> Grade &amp; reveal Stage-2 price</button>
      <div id="p2p-grade-result" class="hidden flex-col gap-stack-lg"></div>`;

    const drop = document.getElementById("p2p-drop");
    const fileInput = document.getElementById("p2p-file");
    drop.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => { addP2pFiles(e.target.files); fileInput.value = ""; });
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("border-amber"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("border-amber"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("border-amber"); addP2pFiles(e.dataTransfer.files); });
    document.getElementById("p2p-add").addEventListener("click", () => fileInput.click());
    document.getElementById("p2p-cam").addEventListener("click", () => App.ui.openCamera((f) => addP2pFiles([f])));
    document.getElementById("btn-p2p-grade").addEventListener("click", doP2pGrade);
  }

  function addP2pFiles(fileList) {
    const imgs = [...(fileList || [])].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    let added = 0;
    for (const f of imgs) {
      if (p2pFiles.length >= MAX_PHOTOS) { App.toast(`Max ${MAX_PHOTOS} photos`, "info"); break; }
      p2pFiles.push(f); added++;
    }
    if (added) App.toast(`${added} photo${added > 1 ? "s" : ""} added (${p2pFiles.length}/${MAX_PHOTOS})`, "ok");
    refreshP2pPhotos();
  }

  function removeP2pAt(i) { p2pFiles.splice(i, 1); refreshP2pPhotos(); }

  function refreshP2pPhotos() {
    const n = p2pFiles.length;
    const preview = document.getElementById("p2p-preview");
    const icon = document.querySelector("#p2p-drop .p2p-icon");
    const hint = document.getElementById("p2p-hint");
    const count = document.getElementById("p2p-count");
    const strip = document.getElementById("p2p-strip");

    if (n > 0) {
      preview.src = URL.createObjectURL(p2pFiles[n - 1]); preview.classList.remove("hidden");
      if (icon) icon.classList.add("hidden");
      hint.textContent = `${n} photo${n > 1 ? "s" : ""} ready ✓ — tap Grade to analyze`;
      count.textContent = `${n}/${MAX_PHOTOS}`; count.classList.remove("hidden");
    } else {
      preview.src = ""; preview.classList.add("hidden");
      if (icon) icon.classList.remove("hidden");
      hint.textContent = `Drag & drop up to ${MAX_PHOTOS} photos, tap to choose, or use the live camera`;
      count.classList.add("hidden");
    }

    // thumbnail strip with remove buttons
    strip.classList.toggle("hidden", n === 0);
    strip.classList.toggle("grid", n > 0);
    strip.innerHTML = p2pFiles.map((f, i) => `
      <div class="relative aspect-square rounded-md overflow-hidden border border-outline-variant">
        <img src="${URL.createObjectURL(f)}" class="w-full h-full object-cover" alt=""/>
        <button class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center" data-i="${i}">
          <span class="material-symbols-outlined text-[14px]">close</span></button>
      </div>`).join("");
    strip.querySelectorAll("button[data-i]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); removeP2pAt(Number(b.dataset.i)); }));
  }

  async function doP2pGrade() {
    const p = App.state.p2p.purchase;
    const btn = document.getElementById("btn-p2p-grade");
    const orig = btn.innerHTML; btn.innerHTML = ui.spinnerBtnHTML("Grading…"); btn.disabled = true;

    let g;
    if (p2pFiles.length > 0) g = await App.api.grade(p.category, { inspection: p2pFiles }, p.asin);
    else g = await App.api.gradeFunctional(p.category, [true, true, true]);

    if (!g || g.grade === "ERROR" || g._networkError) { btn.innerHTML = orig; btn.disabled = false; App.toast("Grading failed", "err"); return; }

    const listing = await App.api.list(p.id, g.grade, g.score, g.defects || [], App.state.p2p.simulateYears);
    btn.innerHTML = orig; btn.disabled = false;
    if (!listing || listing.error || listing._networkError) { App.toast(listing && listing.error ? listing.error : "listing failed", "err"); return; }
    App.state.p2p.listing = listing;
    renderHealthCard(g, listing);
  }

  function renderHealthCard(g, l) {
    const hc = l.health_card || {};
    const box = document.getElementById("p2p-grade-result");
    box.classList.remove("hidden"); box.classList.add("flex");
    const up = l.price_went_up;
    box.innerHTML = `
      <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm flex flex-col gap-stack-md">
        <div class="flex justify-between items-end border-b border-outline-variant pb-stack-md">
          <div><p class="font-label-md text-label-md text-on-surface-variant">Condition</p>
            <p class="font-display-lg text-display-lg text-on-surface">${ui_word(g.grade)} <span class="text-primary">${(g.score||0).toFixed(1)}</span></p></div>
          <div class="text-right"><p class="font-label-md text-label-md text-on-surface-variant">Stage-2 value</p>
            <p class="font-headline-md text-headline-md text-on-surface">${fmt.inr(l.asking_price)} ${up ? '<span class="text-success text-sm">▲</span>' : ""}</p>
            <p class="font-label-md text-label-md text-on-surface-variant">from ${fmt.inr(l.stage1_price)}</p></div>
        </div>
        <div class="bg-surface-container-low rounded-lg p-stack-md border border-outline-variant flex flex-col gap-stack-sm">
          <p class="font-label-bold text-label-bold text-on-surface flex items-center gap-2"><span class="material-symbols-outlined text-[16px] text-primary">verified</span> Product Health Card</p>
          <div class="grid grid-cols-2 gap-stack-md mt-1">
            ${hcItem("Condition", hc.condition_summary)}
            ${hcItem("Warranty", hc.warranty)}
            ${hcItem("Age", hc.age_display)}
            ${hcItem("Defects", (hc.defects||[]).join(", "))}
          </div>
          <div class="flex flex-wrap gap-1 mt-2">${(hc.trust_anchors||[]).map((t)=>`<span class="bg-success/10 text-success border border-success/30 rounded px-2 py-0.5 font-label-md text-label-md">✓ ${t}</span>`).join("")}</div>
          <p class="font-label-md text-label-md text-on-surface-variant mt-1">${l.price_note || ""}</p>
        </div>
        <button class="w-full bg-amber-action text-near-black font-label-bold text-label-bold py-3 rounded-lg" onclick="App.router.go('p2p-handoff')">List it → find a buyer</button>
      </div>`;
  }

  // ---- Screen 7: Match + Handoff ---------------------------------------
  function renderHandoff() {
    const l = App.state.p2p.listing;
    const host = document.getElementById("screen-p2p-handoff");
    if (!l) { host.innerHTML = `<p class="p-4">List an item first (Grade screen).</p>`; return; }
    host.innerHTML = `
      <div class="flex items-center gap-2"><button class="p-1 -ml-1 text-on-surface-variant" onclick="App.router.go('p2p-grade')"><span class="material-symbols-outlined">arrow_back</span></button>
        <h2 class="font-headline-md text-headline-md text-on-surface">P2P Handoff</h2></div>
      <p class="font-body-md text-body-md text-on-surface-variant">Listed: ${l.item_name} · ${fmt.inr(l.asking_price)}</p>
      <button id="btn-demand" class="w-full bg-surface border border-outline-variant rounded-lg py-3 px-4 flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors">
        <span class="material-symbols-outlined text-primary">radar</span>
        <span class="font-label-bold text-label-bold text-primary">Simulate nearby demand</span></button>
      <div id="handoff-result" class="flex flex-col gap-stack-lg"></div>`;
    document.getElementById("btn-demand").addEventListener("click", doDemand);
  }

  async function doDemand() {
    const l = App.state.p2p.listing;
    const btn = document.getElementById("btn-demand");
    btn.innerHTML = ui.spinnerBtnHTML("Scanning network…"); btn.disabled = true;

    await App.api.demandGenerate(l.listing_id);
    const find = await App.api.demandFind(l.listing_id);
    btn.disabled = false; btn.innerHTML = `<span class="material-symbols-outlined text-primary">radar</span><span class="font-label-bold text-label-bold text-primary">Re-scan demand</span>`;

    if (!find || find.error || !find.buyers || find.buyers.length === 0) { App.toast("No buyers found in range", "info"); return; }
    App.state.p2p.demand = find;
    const buyer = find.buyers[0];

    const out = document.getElementById("handoff-result");
    out.innerHTML = `
      <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm animate-enter">
        <div class="flex items-start gap-4">
          <div class="h-10 w-10 rounded-full bg-secondary-container flex items-center justify-center"><span class="material-symbols-outlined text-primary-container fill-icon">person</span></div>
          <div><h3 class="font-headline-sm text-headline-sm text-on-surface">Match found!</h3>
            <p class="font-body-md text-body-md text-on-surface-variant">${buyer.buyer_name} · <span class="font-bold text-primary">${fmt.km(buyer.road_km)} away</span> · budget ${fmt.inr(buyer.max_budget)}</p></div>
        </div>
      </div>
      <div class="bg-surface border border-outline-variant rounded-lg p-5 flex flex-col gap-stack-md animate-enter">
        <div class="flex justify-between items-center"><span class="font-label-md text-label-md text-on-surface-variant">Routing</span>
          <span class="bg-surface-variant px-2 py-1 rounded text-[10px] uppercase tracking-wide font-bold">same-town · near-zero haul</span></div>
        <div class="flex items-center justify-between mt-2 px-2">
          ${node("Seller")}<div class="flex-1 h-[2px] bg-primary mx-1"></div>${node("Local Station", true)}<div class="flex-1 h-[2px] bg-primary mx-1"></div>${node("Buyer")}
        </div>
      </div>
      <button id="btn-handoff" class="w-full bg-primary text-on-primary font-headline-sm text-headline-sm py-4 rounded-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
        <span class="material-symbols-outlined">handshake</span> Confirm Handoff</button>
      <div id="handoff-final"></div>`;
    document.getElementById("btn-handoff").addEventListener("click", () => doConfirm(buyer));
  }

  async function doConfirm(buyer) {
    const l = App.state.p2p.listing;
    const station = App.state.coordFor(l.station_id) || App.state.coordFor("Udupi City (Service Bus Stand)") || [13.3409, 74.7421];
    const h = await App.api.handoff({
      listing_id: l.listing_id, demand_id: buyer.demand_id,
      seller_lat: station[0], seller_lng: station[1],
      buyer_lat: buyer.lat || station[0], buyer_lng: buyer.lng || station[1],
    });
    if (!h || h.error || h._networkError) { App.toast(h && h.error ? h.error : "handoff failed", "err"); return; }
    App.state.p2p.handoff = h;
    const fin = h.financials || {}, legs = h.legs || {}, co2 = h.co2 || {}, gc = h.green_credits || {};
    document.getElementById("handoff-final").innerHTML = `
      <div class="bg-surface-container-low border border-primary-fixed-dim rounded-lg p-4 flex flex-col gap-stack-md animate-enter mt-2">
        <div class="flex items-center gap-2"><span class="material-symbols-outlined text-primary fill-icon">check_circle</span>
          <span class="font-headline-sm text-headline-sm text-on-surface">Handoff confirmed</span></div>
        <div class="grid grid-cols-3 gap-2 text-center">
          ${fStat("Distance", fmt.km(legs.total_km))}
          ${fStat("Platform fee", fmt.inr(fin.platform_fee))}
          ${fStat("Seller payout", fmt.inr(fin.seller_payout))}
        </div>
        <div class="bg-primary-fixed/40 rounded-lg p-3 flex items-center justify-between">
          <div class="flex items-center gap-2"><span class="material-symbols-outlined text-primary fill-icon">eco</span>
            <div><div class="font-headline-sm text-headline-sm text-on-surface">+${(gc.credits_rs||0).toLocaleString("en-IN")} green credits</div>
              <div class="font-label-md text-label-md text-on-surface-variant">${fmt.kg(co2.saved_kg)} CO₂ saved vs a fresh unit from the ${fmt.km(co2.fc_road_km_used)} FC haul</div></div></div>
          <span class="font-headline-md text-headline-md font-bold text-primary">${fmt.inr(fin.total_seller_value)}</span>
        </div>
        <p class="font-label-md text-label-md text-on-surface-variant">${h.logistics_note || ""}</p>
      </div>`;
  }

  // ---- helpers ----------------------------------------------------------
  function node(label, active) {
    return `<div class="flex flex-col items-center gap-1 relative">
      <div class="w-4 h-4 rounded-full border-2 ${active ? "border-primary bg-primary" : "border-primary bg-surface"} flex items-center justify-center">
        ${active ? '<span class="material-symbols-outlined text-[10px] text-on-primary">storefront</span>' : '<div class="w-1.5 h-1.5 bg-primary rounded-full"></div>'}</div>
      <span class="font-mono-code text-mono-code text-on-surface-variant absolute top-6 whitespace-nowrap">${label}</span></div>`;
  }
  function hcItem(k, v) { return `<div><p class="font-label-md text-label-md text-on-surface-variant">${k}</p><p class="font-body-md text-body-md text-on-surface">${v || "—"}</p></div>`; }
  function fStat(k, v) { return `<div class="bg-surface-container-lowest rounded p-2"><div class="font-label-md text-label-md text-on-surface-variant text-[10px] uppercase">${k}</div><div class="font-headline-sm text-headline-sm text-on-surface">${v}</div></div>`; }
  function iconFor(cat) { return { baby_monitor: "baby_changing_station", shoes: "footprint", headphones: "headphones", laptop: "laptop_mac", camera: "photo_camera", watch: "watch" }[cat] || "inventory_2"; }
  function ui_word(g) { return { A: "Excellent", B: "Good", C: "Fair", D: "Poor" }[g] || g; }

  App.screens = App.screens || {};
  App.screens["p2p-nudge"] = { render: renderNudge };
  App.screens["p2p-grade"] = { render: renderGradeScreen };
  App.screens["p2p-handoff"] = { render: renderHandoff };
})();
