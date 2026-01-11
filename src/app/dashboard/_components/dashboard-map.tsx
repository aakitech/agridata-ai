"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import { Badge } from "~/components/ui/badge";
import { format } from "date-fns";
import { createCustomMarkerIcon, injectMarkerStyles, type SeverityType } from "~/lib/map-utils";

interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  pest: string | null;
  severity: SeverityType;
  count: number | null;
  date: Date;
  officerName: string;
}

export function DashboardMap({ points }: { points: MapPoint[] }) {
  // Zimbabwe center roughly [-19.0154, 29.1549]
  const center: [number, number] = [-19.0154, 29.1549];
  const zoom = 6;

  useEffect(() => {
    injectMarkerStyles();
  }, []);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border shadow-inner bg-muted/5">
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

        <MarkerClusterGroup
          chunkedLoading
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
        >
          {points.map((point) => {
            const icon = createCustomMarkerIcon(point.severity);
            
            return (
              <Marker 
                key={point.id} 
                position={[point.lat, point.lon]} 
                icon={icon}
              >
                <Popup className="premium-popup">
                  <div className="p-1 space-y-3 min-w-[180px]">
                    <div className="flex justify-between items-start gap-2">
                       <p className="font-bold text-sm text-foreground leading-tight">
                        {point.pest || "Unspecified Pest"}
                      </p>
                      {point.severity && (
                          <Badge 
                            variant={point.severity === "HIGH" ? "destructive" : point.severity === "WARNING" ? "default" : "secondary"} 
                            className="text-[9px] px-1.5 h-4 uppercase tracking-wider font-bold"
                          >
                            {point.severity}
                          </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-muted-foreground/10">
                      <div>
                        <p className="text-muted-foreground font-medium uppercase text-[10px]">Count</p>
                        <p className="font-semibold">{point.count ?? "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-medium uppercase text-[10px]">Date</p>
                        <p className="font-semibold">{format(new Date(point.date), "MMM d, yy")}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {point.officerName.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[10px] text-muted-foreground leading-none mb-1">Field Officer</p>
                        <p className="text-xs font-medium leading-none">{point.officerName}</p>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
