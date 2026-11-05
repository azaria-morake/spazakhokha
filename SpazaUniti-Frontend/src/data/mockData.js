/**
 * Mock & Initial Data for Spaza Uniti Marketplace
 * Accurately matching the reference UI
 */

export const INITIAL_SHOPS = [
  {
    id: "shop-1",
    name: "Mzansi Spaza",
    unit_id: "unit-104",
    image: "/shop_mzansi.jpg",
    rating: 4.6,
    reviewCount: 120,
    distanceKm: 0.4,
    categories: ["Groceries", "Household"],
    badge: "5% off",
    badgeType: "discount",
    highlightText: "5% off selected items",
    highlightType: "tag",
    open_payments_id: "$spazauniti.org/mzansi-spaza",
    township: "Katlehong",
    address: "Section 4, Katlehong",
    owner_name: "Thabo Mzansi",
    hours: "06:00 - 21:00 Daily"
  },
  {
    id: "shop-2",
    name: "Fresh Foods",
    unit_id: "unit-108",
    image: "/shop_fresh.jpg",
    rating: 4.7,
    reviewCount: 98,
    distanceKm: 0.6,
    categories: ["Groceries", "Fresh Produce"],
    badge: "10 pts",
    badgeType: "points",
    highlightText: "Earn 10 loyalty points",
    highlightType: "star",
    open_payments_id: "$spazauniti.org/fresh-foods",
    township: "Katlehong",
    address: "Block B, Katlehong",
    owner_name: "Nomsa Dlamini",
    hours: "06:30 - 20:00 Daily"
  },
  {
    id: "shop-3",
    name: "The Daily Shop",
    unit_id: "unit-102",
    image: "/shop_daily.jpg",
    rating: 4.5,
    reviewCount: 76,
    distanceKm: 0.8,
    categories: ["Groceries", "Household"],
    badge: "R20 off",
    badgeType: "discount",
    highlightText: "R20 off on essentials",
    highlightType: "tag",
    open_payments_id: "$spazauniti.org/daily-shop",
    township: "Katlehong",
    address: "Mandela St, Katlehong",
    owner_name: "Baba Khumalo",
    hours: "07:00 - 20:30 Daily"
  }
];

export const INITIAL_CART_ITEMS = [
  {
    id: "prod-1",
    name: "Cooking Oil 2L",
    price: 35.00,
    quantity: 1,
    image: "/oil_2l.jpg",
    unit: "2L"
  },
  {
    id: "prod-2",
    name: "White Bread",
    price: 14.00,
    quantity: 1,
    image: "/bread_loaf.jpg",
    unit: "700g"
  }
];

export const TOWNSHIPS = [
  { id: "katlehong", name: "Katlehong", lat: -26.3317, lng: 28.1511 },
  { id: "dobsonville", name: "Dobsonville, Soweto", lat: -26.2234, lng: 27.8681 },
  { id: "meadowlands", name: "Meadowlands Zone 2", lat: -26.2290, lng: 27.8720 },
  { id: "orlando", name: "Orlando West (Vilakazi)", lat: -26.2360, lng: 27.9150 },
  { id: "diepkloof", name: "Diepkloof Zone 6", lat: -26.2550, lng: 27.9400 }
];

export const DEMO_CUSTOMERS = [
  { username: "mannini", name: "Mannini Morake", avatar: "M", balance: 150.00, points: 245, stamps: 6 },
  { username: "sipho", name: "Sipho Dlamini", avatar: "S", balance: 84.00, points: 130, stamps: 6 },
  { username: "azaria", name: "Azaria Morake", avatar: "A", balance: 250.00, points: 310, stamps: 2 },
  { username: "thandi", name: "Mama Thandi", avatar: "T", balance: 400.00, points: 520, stamps: 9 }
];

