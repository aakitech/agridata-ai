"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Create custom colored marker for single report
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
  DEFAULT: createColoredIcon('#3b82f6'),   // Blue for triage reports
};

interface ReportMapProps {
  latitude: number;
  longitude: number;
  reportId?: string;
  severity?: "NORMAL" | "WARNING" | "HIGH" | null;
}

export function ReportMap({ latitude, longitude, reportId, severity }: ReportMapProps) {
  const icon = severity 
    ? severityIcons[severity]
    : severityIcons.DEFAULT;
  
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-full w-full rounded-lg"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={icon}>
        <Popup>
          Report Location
          {reportId && <br />}
          {reportId && `ID: ${reportId.slice(0, 8)}`}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
