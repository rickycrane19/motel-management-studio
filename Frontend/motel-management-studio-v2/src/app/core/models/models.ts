export interface UserSession {
  token: string;
  user: {
    userId: number;
    tenantId: string;
    tenantName: string;
    locationId: string | null;
    username: string;
    fullName: string;
    role: string;
    timeZone: string;
    currencyCode: string;
  };
}

export interface RoomItem {
  roomId: number;
  tenantId: string;
  locationId: string | null;
  roomNumber: string;
  roomTypeId: number;
  roomTypeName: string;
  hasGarage: boolean;
  hasJacuzzi: boolean;
  capacity: number;
  statusCode: number; // 0=Libre, 1=Ocupado, 2=Limpieza, 3=Mantenimiento, 4=Reservado
  statusName: string;
  floorNumber: number;
  notes?: string;
  imageUrl?: string;
  currentRoomStayId?: number;
  customerId?: number;
  customerName?: string;
  arrivalType?: number; // 1=A pie, 2=En vehiculo
  arrivalTypeName?: string;
  vehiclePlate?: string;
  serviceStayTypeId?: number;
  serviceStayTypeName?: string;
  baseServiceCost?: number;
  startTimeUtc?: string;
  expectedEndTimeUtc?: string;
  extendedHours?: number;
  extensionCost?: number;
  productsTotal?: number;
  finesTotal?: number;
  totalAmount?: number;
  startTimeManagua?: string;
  expectedEndTimeManagua?: string;
  elapsedMinutes?: number;
  remainingMinutes?: number;
  isExpiringSoon?: boolean;
}

export interface RoomStayDetail {
  stay: {
    roomStayId: number;
    roomId: number;
    roomNumber: string;
    roomTypeName: string;
    customerId?: number;
    customerName: string;
    arrivalType: number;
    arrivalTypeName: string;
    vehiclePlate?: string;
    serviceStayTypeId: number;
    serviceStayTypeName: string;
    baseServiceCost: number;
    startTimeUtc: string;
    expectedEndTimeUtc: string;
    actualEndTimeUtc?: string;
    startTimeManagua: string;
    expectedEndTimeManagua: string;
    statusCode: number;
    extendedHours: number;
    extensionCost: number;
    productsTotal: number;
    finesTotal: number;
    totalAmount: number;
    paidAmount: number;
    isPaid: boolean;
    paymentMethod?: string;
    notes?: string;
  };
  consumptions: Array<{
    consumptionId: number;
    productId: number;
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    subTotal: number;
    createdOnUtc: string;
    createdOnManagua: string;
  }>;
  extensions: Array<{
    extensionId: number;
    serviceStayTypeId: number;
    serviceStayTypeName: string;
    extraHours: number;
    cost: number;
    newExpectedEndTimeUtc: string;
    newExpectedEndTimeManagua: string;
    createdOnUtc: string;
  }>;
  fines: Array<{
    fineId: number;
    fineTypeId?: number;
    fineTypeName?: string;
    description: string;
    amount: number;
    currencyCode: string;
    amountInBase: number;
    isWaived: boolean;
    waivedReason?: string;
    recordedAtManagua: string;
  }>;
}

export interface ProductItem {
  productId: number;
  tenantId: string;
  locationId: string | null;
  categoryId: number;
  categoryName: string;
  code: string;
  name: string;
  description?: string;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  minStock: number;
  unitOfMeasure: string;
  imageUrl?: string;
  isActive: boolean;
  isLowStock: boolean;
}

export interface CategoryItem {
  categoryId: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface ServiceStayTypeItem {
  serviceStayTypeId: number;
  roomTypeId?: number;
  name: string;
  durationHours: number;
  price: number;
  isExtension: boolean;
  isActive: boolean;
}

export interface FineTypeItem {
  fineTypeId: number;
  name: string;
  description?: string;
  defaultAmount: number;
  isActive: boolean;
}

export interface DenominationItem {
  denominationId: number;
  currencyCode: string;
  currencyName: string;
  currencySymbol?: string;
  value: number;
  label: string;
  exchangeRateToNIO: number;
}

export interface CashSessionSummary {
  cashBoxSessionId: number;
  cashBoxId: number;
  cashBoxName: string;
  userId: number;
  cashierName: string;
  shiftName: string;
  openedAtManagua: string;
  closedAtManagua?: string;
  status: number;
  statusName: string;
  openingBalanceBase: number;
  totalSalesBase: number;
  totalInAdjustmentsBase: number;
  totalOutAdjustmentsBase: number;
  closingCalculatedBase: number;
  closingActualBase?: number;
  differenceBase?: number;
  resultStatus: string; // 'Cuadrada', 'Sobrante (+)', 'Faltante (-)'
}
