/* Demo return items for the Orders screen "Change item" picker.
   Each ASIN matches a row in the backend `catalog` table (seed_catalog.py), so the catalog
   photo (GET /catalog/image/{asin}) and the grading auto-reference both work once you drop
   backend/catalog_images/<asin>.jpg in. Categories are all valid grading + routing categories.
   The pickup location (region/lat/lng) is NOT part of an item — it's chosen separately on the
   map and preserved when you switch items. */
export const DEMO_ITEMS = [
  { order_id: "AZ-9921-X", product_name: "Trail Runner Shoes (niche brand)", category: "shoes",    asin: "B0SH_UDUPI_NICHE", original_price: 459,  icon: "footprint" },
  { order_id: "AZ-7782-B", product_name: "Skybags Laptop Backpack",          category: "backpack", asin: "B0BP001",          original_price: 2499, icon: "backpack" },
  { order_id: "AZ-4410-S", product_name: "Leather Formal Shoes",             category: "shoes",    asin: "B0SH001",          original_price: 679,  icon: "footprint" },
  { order_id: "AZ-3055-W", product_name: "Analog Wrist Watch",               category: "watch",     asin: "B0WT001",   original_price: 899,  icon: "watch" },
  { order_id: "AZ-6621-B", product_name: "Power Bank (20000mAh)",            category: "power_bank", asin: "B0PB001",  original_price: 900,  icon: "battery_charging_full" },
  { order_id: "AZ-9134-F", product_name: "Running Shoes Pro",                category: "footwear",   asin: "B0FW001",  original_price: 1500, icon: "footprint" },
  { order_id: "AZ-2208-P", product_name: "Silicone Phone Case",              category: "phonecase",  asin: "B0PC001",  original_price: 299,  icon: "smartphone" },
];

export const ICON_FOR = (cat) =>
  ({ shoes: "footprint", footwear: "footprint", backpack: "backpack", bag: "shopping_bag",
     watch: "watch", toy: "toys", book: "menu_book", power_bank: "battery_charging_full",
     phonecase: "smartphone", phone_case: "smartphone" }[cat] || "inventory_2");
