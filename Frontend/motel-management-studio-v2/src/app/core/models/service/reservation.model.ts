/** Reservación de habitación: listado paginado en servidor y cierre de estado. */

export interface RoomReservation {
  reservationId: number;
  roomId: number;
  roomNumber: string;
  roomTypeName: string;
  customerName: string;
  phone: string | null;
  serviceStayTypeId: number;
  serviceStayTypeName: string;
  reservationStartUtc: string;
  reservationEndUtc: string;
  reservationStartManagua: string | null;
  reservationEndManagua: string | null;
  depositAmount: number;
  statusCode: number;
  statusName: string;
  notes: string | null;
}

export interface RoomReservationStats {
  confirmed: number;
  today: number;
  cancelled: number;
  noShow: number;
}

export interface RoomReservationPage {
  items: readonly RoomReservation[];
  totalRecords: number;
  page: number;
  pageSize: number;
  stats?: RoomReservationStats;
}

export interface RoomReservationQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  status: number | null;
  fromDate: string | null;
  toDate: string | null;
}

export interface RoomReservationUpsert {
  roomId: number;
  customerId: number | null;
  customerName: string;
  phone: string | null;
  serviceStayTypeId: number;
  reservationStartUtc: string;
  reservationEndUtc: string;
  depositAmount: number;
  notes: string | null;
}

export const RESERVATION_STATUS = {
  confirmed: 1,
  checkedIn: 2,
  cancelled: 3,
  noShow: 4,
} as const;
