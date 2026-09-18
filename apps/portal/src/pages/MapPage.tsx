import type { MapBand } from "@mycare/api-client";
import { Async, Card, Count, PageHeader, useAsync } from "@mycare/ui";
import { api } from "../api";
import { PrivacyNote, RangeFilters, useRangeFilters } from "./filters";

const BAND_LABEL: Record<MapBand, string> = {
  high: "High",
  elevated: "Elevated",
  low: "Lower",
  suppressed: "Too few to show",
};

/**
 * Figure 35, Aggregate Map (the optional module).
 *
 * Deliberately a grid of barangay tiles, not a drawn map: the manuscript
 * provides no barangay boundaries, and inventing coordinates would put made-up
 * geography in a health record system. The figure's own guarantee holds either
 * way — shading is area-level, drawn from the barangay a patient chose during
 * onboarding, never from GPS.
 */
export function MapPage() {
  const { range, setRange, today } = useRangeFilters(30);
  const state = useAsync(() => api.staff.map({ from: range.from, to: range.to }), [range.from, range.to]);

  return (
    <>
      <PageHeader
        title="Aggregate map"
        subtitle="Relative triage load by barangay, so hotspots stand out."
        actions={<RangeFilters range={range} onChange={setRange} today={today} showBarangay={false} />}
      />

      <Async state={state}>
        {(map) => (
          <Card>
            <div className="mc-tile-grid">
              {map.barangays.map((barangay) => (
                <div key={barangay.id} className={`mc-tile mc-band-${barangay.band}`}>
                  <strong>{barangay.name}</strong>
                  <span>
                    <Count cell={barangay.total} />
                    <span className="mc-small mc-muted"> · {BAND_LABEL[barangay.band]}</span>
                  </span>
                </div>
              ))}
            </div>
            <PrivacyNote>
              Shading is relative to the busiest barangay that can be displayed. A barangay with fewer than five sessions gets its own hatched band, so
              the shading itself never hints at a hidden count. Area level only — never GPS or any individual location.
            </PrivacyNote>
          </Card>
        )}
      </Async>
    </>
  );
}
