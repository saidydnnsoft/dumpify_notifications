import { formatInTimeZone } from "date-fns-tz";

export function formatDate(dateStr) {
  if (!dateStr) return null;
  const datePart = dateStr.split(" ")[0];
  const [month, day, year] = datePart.split("/");
  if (!year || !month || !day) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function getBogotaDateString(format = "yyyy-MM-dd") {
  return formatInTimeZone(new Date(), "America/Bogota", format);
}
