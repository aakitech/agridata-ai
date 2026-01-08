"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Badge } from "~/components/ui/badge";
import { format } from "date-fns";

// Create custom colored markers based on severity
const createColoredIcon = (color: string) => {
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.5 12.5 28.5S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0z" 
            fill="${color}" stroke="#000" stroke-width="1"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white" opacity="0.9"/>
    </svg>
  `;
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
};

// Severity-based icons
const severityIcons = {
  HIGH: createColoredIcon('#ec353d'),      // Red
  WARNING: createColoredIcon('#f59e0b'),   // Amber/Orange (more visible than #fef3c6)
  NORMAL: createColoredIcon('#449c47'),    // Green
  DEFAULT: createColoredIcon('#6b7280'),   // Gray for unknown
};

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
        {points.map((point) => {
          const icon = point.severity 
            ? severityIcons[point.severity]
            : severityIcons.DEFAULT;
          
          return (
          <Marker key={point.id} position={[point.lat, point.lon]} icon={icon}>
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
          );
        })}
      </MapContainer>
    </div>
  );
}
