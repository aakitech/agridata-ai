"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Badge } from "~/components/ui/badge";
import { format } from "date-fns";

// Fix for default marker icons in Leaflet + Next.js
// Use local icons instead of unpkg.com to avoid CSP issues
const DefaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  pest: string | null;
  severity: "NORMAL" | "WARNING" | "HIGH" | null;
  count: number | null;
  date: Date;
  officerName: string;
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
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Standard">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        {points.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lon]}>
            <Popup>
              <div className="space-y-2 min-w-[150px]">
                <p className="font-semibold text-sm">{point.pest || "Unknown Pest"}</p>
                <div className="flex gap-1 flex-wrap items-center">
                    {point.severity && (
                        <Badge 
                          variant={point.severity === "HIGH" ? "destructive" : point.severity === "WARNING" ? "default" : "secondary"} 
                          className="text-[10px]"
                        >
                          {point.severity}
                        </Badge>
                    )}
                    {point.count !== null && (
                      <span className="text-xs font-medium">
                        Count: {point.count}
                      </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(point.date), "MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Officer: {point.officerName}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
