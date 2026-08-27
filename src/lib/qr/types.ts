export type QrCodeRow = {
  id: string;
  tenantId: string;
  code: string;
  destinationUrl: string;
  label: string;
  /** The table this tag sits on, e.g. "12". Drives silent attribution. */
  table: string;
  isActive: boolean;
  scanCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QrScanRow = {
  id: string;
  qrCodeId: string;
  tenantId: string;
  scannedAt: string;
  userAgent: string;
  referer: string;
};

export type QrAuditAction =
  | "created"
  | "destination_changed"
  | "activated"
  | "deactivated"
  | "archived";

export type QrAuditRow = {
  id: string;
  qrCodeId: string;
  tenantId: string;
  action: QrAuditAction;
  fromValue: string;
  toValue: string;
  actor: string;
  createdAt: string;
};

export type QrScanStats = {
  total: number;
  today: number;
  week: number;
  month: number;
};

// A code plus its permanent URL — the shape the dashboard consumes. The
// permanent URL is always computed server-side so the client can never
// reconstruct (and therefore never get wrong) the printed origin.
export type QrCodeView = QrCodeRow & { permanentUrl: string };
