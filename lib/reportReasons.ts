export const REPORT_REASONS = [
  { key: "spam", label: "Спам или реклама" },
  { key: "harassment", label: "Оскорбления или травля" },
  { key: "inappropriate", label: "Неприемлемый контент" },
  { key: "other", label: "Другое" },
] as const;

export type ReportReasonKey = (typeof REPORT_REASONS)[number]["key"];

export function isValidReportReason(value: unknown): value is ReportReasonKey {
  return typeof value === "string" && REPORT_REASONS.some((r) => r.key === value);
}
