"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { createCustomMarkerIcon, injectMarkerStyles, type SeverityType } from "~/lib/map-utils";

interface ReportMapProps {
  latitude: number;
  longitude: number;
  reportId?: string;
  severity?: SeverityType;
}

export function ReportMap({ latitude, longitude, reportId, severity = null }: ReportMapProps) {
  useEffect(() => {
    injectMarkerStyles();
  }, []);

  const icon = createCustomMarkerIcon(severity, {
    showPulse: severity === "HIGH" || !severity // Pulse for focus if no severity (triage)
  });
  
  return (
    <div className="h-full w-full rounded-lg overflow-hidden border shadow-sm">
      <MapContainer
        center={[latitude, longitude]}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={icon}>
          <Popup className="premium-popup">
            <div className="p-1">
              <p className="font-bold text-sm mb-1 text-foreground">Report Location</p>
              {reportId && (
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                  ID: <span className="font-mono text-primary">{reportId.slice(0, 8)}</span>
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
