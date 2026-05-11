/**
 * Constants & shared types for cigarette sales app
 */
export const SALES_CODES = ["BP01","BP02","BP03","BP04","BP05","BP06","BP07","BP08","BP09","BP10"];

export const formatRupiah = (n: number) =>
  "Rp " + (n || 0).toLocaleString("id-ID");

export const formatDateID = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};
