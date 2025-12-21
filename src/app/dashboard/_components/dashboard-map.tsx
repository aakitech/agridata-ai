"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Badge } from "~/components/ui/badge";

// Fix for default marker icons in Leaflet + Next.js
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  diagnosis: string | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
}

export function DashboardMap({ points }: { points: MapPoint[] }) {
  // Zimbabwe center roughly [-19.0154, 29.1549]
  const center: [number, number] = [-19.0154, 29.1549];
  const zoom = 6;

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border shadow-inner">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lon]}>
            <Popup>
              <div className="space-y-2">
                <p className="font-semibold text-sm">{point.diagnosis || "Unverified Report"}</p>
                <div className="flex gap-1">
                    {point.riskLevel && (
                        <Badge variant={point.riskLevel === "HIGH" ? "destructive" : "secondary"} className="text-[10px]">
                            {point.riskLevel} Risk
                        </Badge>
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">ID: {point.id.slice(0, 8)}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
