export interface PickupOrder {
  orderCode: string;
  itemName: string;
  status: "ready" | "processing";
  pickupSpotId: string;
}

export const pickupOrders: PickupOrder[] = [
  { orderCode: "LQ-2048", itemName: "林泉四季明信片套装", status: "ready", pickupSpotId: "visitor-hub" },
  { orderCode: "LQ-3150", itemName: "溪谷观察手册", status: "processing", pickupSpotId: "visitor-hub" },
];
