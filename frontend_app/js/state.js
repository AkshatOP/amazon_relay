/* state.js — tiny shared state passed between screens (no framework). */
(function () {
  "use strict";
  window.App = window.App || {};

  App.state = {
    // ---- Rider / routing hero scenario --------------------------------
    // Defaults to the seeded Udupi niche-shoe scenario, which is the ONLY one
    // with a seeded nearby buyer → genuinely returns RESELL_LOCAL + real savings.
    // (Headphones etc. honestly route to REFURBISH: no local buyer seeded.)
    order: {
      product_name: "Trail Runner Shoes (niche brand)",
      category: "shoes",
      asin: "B0SH_UDUPI_NICHE",
      original_price: 400,
      order_id: "AZ-9921-X",
      region: "udupi",
      customer_lat: 13.3409,
      customer_lng: 74.7421,
      customer_area: "Udupi City",
    },

    lastGrade: null,   // GradeResult from /grade or /grade/functional
    lastRoute: null,   // routing JSON from /route

    // ---- P2P -----------------------------------------------------------
    p2p: {
      purchase: null,    // chosen purchase row
      nudge: null,
      listing: null,     // /p2p/list result (has listing_id, health_card)
      demand: null,      // /p2p/demand/find result
      handoff: null,
      simulateYears: 3,
    },

    // ---- Static coordinate lookup (demo convenience) -------------------
    // The /route response gives node NAMES/CODES but not lat/lng, so the map
    // screen resolves them here. Mirrors backend/routing/seed_locations.py.
    coords: {
      // Udupi local delivery stations
      "Udupi City (Service Bus Stand)": [13.3409, 74.7421],
      "Manipal": [13.3490, 74.7869],
      "Malpe": [13.3494, 74.7039],
      "Kundapura": [13.6260, 74.6920],
      "Karkala": [13.2160, 74.9930],
      "Brahmavar": [13.4280, 74.7460],
      // Bengaluru RCCs
      "Mysore Road": [12.9456, 77.5236], "Sahakarnagar": [13.0586, 77.5806],
      "Chickpet": [12.9698, 77.5793], "Bannerghatta Road": [12.8911, 77.5970],
      "BTM 1st Stage": [12.9166, 77.6101], "Indira Nagar": [12.9784, 77.6408],
      "Rajajinagar": [12.9911, 77.5526], "Brigade Road": [12.9719, 77.6076],
      // FCs (by code)
      "BLR_CLUSTER": [13.0707, 77.7796], "BLR5": [13.0707, 77.7796],
      "BLR7": [13.0707, 77.7796], "BLR8": [13.2437, 77.7172], "Jigani": [12.7889, 77.6406],
    },

    coordFor(nameOrCode) { return this.coords[nameOrCode] || null; },
  };
})();
