export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  images: string[];
  price: number;
  offerPrice?: number;
  stock: number;
  sizes: string[];
  colors: string[];
  packageTypes: string[];
  packagePrices?: Record<string, number>;
  sizePrices?: Record<string, number>;
  clothShopOwner?: string;
  status: "active" | "draft";
  createdAt: string;
  hasDualSizes?: boolean;
  dualSizesTitle1?: string;
  dualSizesTitle2?: string;
  sizes2?: string[];
  colorImageMap?: Record<string, string>;
  purchasePrice?: number;
  isTrending?: boolean;
  rating?: number;
  isGroupOrder?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  nameAr?: string;
  nameFil?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  selectedColor: string;
  selectedSize: string;
  selectedPackageType: string;
  purchasePrice?: number;
  clothShopOwner?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  whatsapp: string;
  areaId: string;
  areaName: string;
  houseNo: string;
  fullAddress: string;
  notes?: string;
  lat?: number;
  lng?: number;
  mapLink?: string;
  items: OrderItem[];
  productTotal: number;
  deliveryCharge: number;
  discountAmount?: number;
  grandTotal: number;
  status: "Pending" | "Confirmed" | "Packed" | "Shipped" | "Delivered" | "Cancelled";
  driverDeliveryCharge?: number;
  deliveryTime?: string;
  paymentMethod?: string;
}

export interface DeliveryArea {
  id: string;
  name: string;
  charge: number;
  freeDeliveryAbove?: number | null;
  minOrderValue?: number | null;
  driverCharge?: number;
  deliveryTime?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  expiryDate: string;
}

export interface ShopSettings {
  shopName: string;
  whatsappContact: string; // Admin whatsapp number e.g. "966500000000"
  currency: string;
  bannerImages: string[];
  aboutUs?: string;
  contactEmail?: string;
  contactAddress?: string;
  metaPixelId?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  messengerPageId?: string;
  adminEmail?: string;
  adminPassword?: string;
  fbAccessToken?: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalProfit: number;
  monthlyProfit: number;
  salesByDay: { date: string; amount: number }[];
  ordersByDay: { date: string; count: number }[];
}
