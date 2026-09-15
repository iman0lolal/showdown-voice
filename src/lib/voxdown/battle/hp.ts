import type { HpState, StatusId } from "../types.ts";

const STATUS_IDS = new Set<StatusId>(["brn", "par", "slp", "frz", "psn", "tox", "fnt"]);

export function parseHpStatus(raw: string | undefined): { hp: HpState; status?: StatusId } {
  if (!raw || raw === "0") {
    return { hp: { current: 0, max: 100, percent: 0 }, status: "fnt" };
  }
  const parts = raw.trim().split(/\s+/);
  const hpPart = parts[0] ?? "0";
  const statusPart = parts[1];
  let status: StatusId | undefined;
  if (statusPart && STATUS_IDS.has(statusPart as StatusId)) {
    status = statusPart as StatusId;
  }
  if (hpPart === "0" || hpPart.endsWith("fnt") || status === "fnt") {
    const maxFrom = hpPart.includes("/") ? Number(hpPart.split("/")[1]) || 100 : 100;
    return { hp: { current: 0, max: maxFrom, percent: 0 }, status: "fnt" };
  }
  const [curStr, maxStr] = hpPart.split("/");
  const current = Number(curStr);
  const max = maxStr ? Number(maxStr) : 100;
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return { hp: { current: 100, max: 100, percent: 100 }, status };
  }
  const percent = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  return { hp: { current, max, percent }, status };
}

export function formatHp(hp: HpState): string {
  return `${hp.percent}%`;
}
