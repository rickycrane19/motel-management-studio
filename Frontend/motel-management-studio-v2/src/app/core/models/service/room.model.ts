/** Habitaciones del motel de El Rapidin (modelo alineado al backend motel). */

export interface Room {
  roomId: number;
  roomNumber: string;
  roomTypeId: number;
  roomTypeName: string;
  hasGarage: boolean;
  hasJacuzzi: boolean;
  capacity: number;
  statusCode: number;
  statusName: string;
  floorNumber: number;
  notes: string | null;
  isActive: boolean;
  currentRoomStayId: number | null;
}

export interface RoomPage {
  totalRecords: number;
  page: number;
  pageSize: number;
  items: readonly Room[];
  /** Contadores del SP (sin total: se deriva de activos + inactivos). */
  stats?: { active: number; inactive: number; available: number; occupied: number };
}

export type RoomPhysicalStatus = 'all' | 'available' | 'occupied' | 'cleaning' | 'maintenance';
export type RoomActivityFilter = 'all' | 'active' | 'inactive';

export interface RoomQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  roomTypeId: number | null;
  floor: number | null;
  physicalStatus: RoomPhysicalStatus;
  activity: RoomActivityFilter;
}

export interface RoomStats {
  total: number;
  active: number;
  inactive: number;
  available: number;
  occupied: number;
}

export interface RoomUpsert {
  id?: number | null;
  roomNumber: string;
  roomTypeId: number;
  floorNumber: number;
  notes: string | null;
}

/** Códigos de estado físico de [Service].[Room].Status. */
export const ROOM_STATUS_CODES: Record<number, string> = {
  0: 'Disponible',
  1: 'Ocupado',
  2: 'Limpieza',
  3: 'Mantenimiento',
  4: 'Reservado',
};

/** Nota de equipamiento según el tipo: cochera y jacuzzi se muestran como capacidades. */
export function roomEquipment(room: Room): string {
  const features: string[] = [];
  if (room.hasGarage) features.push('Con cochera');
  if (room.hasJacuzzi) features.push('Con jacuzzi');
  return features.join(' · ');
}
