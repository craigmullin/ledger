import { describe, expect, it } from "vitest";
import { parseMaintenanceCsv } from "./csv";

describe("maintenance CSV import", () => {
  it("maps Ledger's GTI export columns, including estimated dealer cost", () => {
    const [entry] = parseMaintenanceCsv('Date,Odom.,Shop,Total Cost,Service,Estimated Dealer Cost\n5/10/2025,"146,600",Craig,$22.00,"replaced hatch actuator",$180.00');
    expect(entry).toMatchObject({ serviceDate: "2025-05-10", mileage: 146600, description: "replaced hatch actuator", totalCostCents: 2200, estimatedShopCostCents: 18000, providerType: "diy" });
  });
});
