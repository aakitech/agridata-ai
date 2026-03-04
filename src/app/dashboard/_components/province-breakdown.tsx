"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { MapPin, AlertTriangle, AlertCircle, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";
import type { LocationWithReports } from "~/server/modules/analytics/analytics-service";

interface ProvinceBreakdownProps {
  locations: LocationWithReports[];
}

interface ProvinceRow {
  name: string;
  totalReports: number;
  highAlerts: number;
  warningAlerts: number;
  normalAlerts: number;
  locations: number;
}

export function ProvinceBreakdown({ locations }: ProvinceBreakdownProps) {
  // Get unique coordinates (deduplicate by rounding to reduce geocode calls)
  const uniqueCoords = useMemo(() => {
    const map = new Map<string, { lat: number; lon: number }>();
    for (const loc of locations) {
      const key = `${loc.coordinates.lat.toFixed(3)},${loc.coordinates.lon.toFixed(3)}`;
      if (!map.has(key)) {
        map.set(key, loc.coordinates);
      }
    }
    return Array.from(map.entries());
  }, [locations]);

  if (locations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg font-bold">Province Breakdown</CardTitle>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {locations.length} locations
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Geographic distribution of reports by administrative region
        </p>
      </CardHeader>
      <CardContent>
        <ProvinceTable locations={locations} uniqueCoords={uniqueCoords} />
      </CardContent>
    </Card>
  );
}

/**
 * Inner component that handles geocoding and table rendering.
 * We geocode all unique coordinates and aggregate by province on the client side.
 */
function ProvinceTable({
  locations,
  uniqueCoords,
}: {
  locations: LocationWithReports[];
  uniqueCoords: Array<[string, { lat: number; lon: number }]>;
}) {
  const router = useRouter();
  // Batch geocode: fetch all unique coordinates
  const geocodeQueries = uniqueCoords.map(([_key, coords]) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    api.reports.reverseGeocode.useQuery(
      { lat: coords.lat, lon: coords.lon },
      { staleTime: Infinity, refetchOnWindowFocus: false }
    )
  );

  const isLoading = geocodeQueries.some((q) => q.isLoading);

  // Build coordinate -> province mapping
  const coordToProvince = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 0; i < uniqueCoords.length; i++) {
      const [key] = uniqueCoords[i]!;
      const result = geocodeQueries[i]?.data;
      if (result) {
        map.set(key, result.state ?? result.county ?? "Unknown");
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueCoords, ...geocodeQueries.map((q) => q.data)]);

  // Aggregate locations by province
  const provinceRows = useMemo(() => {
    const provinces = new Map<string, ProvinceRow>();

    for (const loc of locations) {
      const coordKey = `${loc.coordinates.lat.toFixed(3)},${loc.coordinates.lon.toFixed(3)}`;
      const provinceName = coordToProvince.get(coordKey) ?? "Resolving...";

      const existing = provinces.get(provinceName) ?? {
        name: provinceName,
        totalReports: 0,
        highAlerts: 0,
        warningAlerts: 0,
        normalAlerts: 0,
        locations: 0,
      };

      existing.totalReports += loc.reportCount;
      existing.locations += 1;

      // Count severities from all reports in this location
      for (const report of loc.reports) {
        switch (report.severity) {
          case "HIGH":
            existing.highAlerts += 1;
            break;
          case "WARNING":
            existing.warningAlerts += 1;
            break;
          case "NORMAL":
            existing.normalAlerts += 1;
            break;
        }
      }

      provinces.set(provinceName, existing);
    }

    return Array.from(provinces.values()).sort((a, b) => b.totalReports - a.totalReports);
  }, [locations, coordToProvince]);

  if (isLoading && provinceRows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Resolving province data...</span>
      </div>
    );
  }

  if (provinceRows.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        No location data available for this period
      </div>
    );
  }

  const totalReports = provinceRows.reduce((acc, r) => acc + r.totalReports, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Province / Region</TableHead>
          <TableHead className="text-xs text-right">Reports</TableHead>
          <TableHead className="text-xs text-right">Sites</TableHead>
          <TableHead className="text-xs text-center">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span>High</span>
            </div>
          </TableHead>
          <TableHead className="text-xs text-center">
            <div className="flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span>Warn</span>
            </div>
          </TableHead>
          <TableHead className="text-xs text-center">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Normal</span>
            </div>
          </TableHead>
          <TableHead className="text-xs text-right">Share</TableHead>
          <TableHead className="text-xs text-center">Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {provinceRows.map((row) => {
          const pct = totalReports > 0 ? ((row.totalReports / totalReports) * 100).toFixed(1) : "0";
          return (
            <TableRow key={row.name}>
              <TableCell className="font-medium text-sm">{row.name}</TableCell>
              <TableCell className="text-right font-mono text-sm">{row.totalReports}</TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {row.locations}
              </TableCell>
              <TableCell className="text-center">
                {row.highAlerts > 0 ? (
                  <Badge variant="destructive" className="text-[10px] font-mono h-5 min-w-8 justify-center">
                    {row.highAlerts}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {row.warningAlerts > 0 ? (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 text-[10px] font-mono h-5 min-w-8 justify-center">
                    {row.warningAlerts}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {row.normalAlerts > 0 ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-[10px] font-mono h-5 min-w-8 justify-center">
                    {row.normalAlerts}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {pct}%
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-primary hover:text-primary/80 gap-1"
                  onClick={() => {
                    const params = new URLSearchParams({ province: row.name });
                    router.push(`/dashboard/reports?${params.toString()}`);
                  }}
                >
                  View <ExternalLink className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
