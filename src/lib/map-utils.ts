import L from "leaflet";

/**
 * Custom color palette for markers
 */
export const MARKER_COLORS = {
  HIGH: "#ef4444",    // Red 500
  WARNING: "#f59e0b", // Amber 500
  NORMAL: "#22c55e",  // Green 500
  DEFAULT: "#3b82f6", // Blue 500
  MUTED: "#94a3b8",   // Slate 400
};

export type SeverityType = "HIGH" | "WARNING" | "NORMAL" | null;
export type RecencyType = "fresh" | "recent" | "stale";

/**
 * Get opacity based on recency
 * - fresh: 100% (fully opaque)
 * - recent: 80% (slightly faded)
 * - stale: 60% (more faded but still visible)
 */
const getRecencyOpacity = (recency: RecencyType): number => {
  switch (recency) {
    case "fresh": return 1;
    case "recent": return 0.8;
    case "stale": return 0.6;
  }
};

/**
 * Creates a premium-looking custom SVG marker icon
 * Now supports recency-based visual weight per MVP spec
 */
export const createCustomMarkerIcon = (
  severity: SeverityType,
  options: {
    showPulse?: boolean;
    label?: string;
    recency?: RecencyType;
  } = {}
) => {
  const color = severity ? MARKER_COLORS[severity] : MARKER_COLORS.DEFAULT;
  const isHigh = severity === "HIGH";
  const showPulse = options.showPulse ?? isHigh;
  const opacity = options.recency ? getRecencyOpacity(options.recency) : 1;
  const opacityStyle = opacity < 1 ? `opacity: ${opacity};` : "";

  // Modern pin SVG with better shadows and depth
  const svgIcon = `
    <div class="relative flex items-center justify-center" style="${opacityStyle}">
      ${showPulse ? `<div class="absolute w-10 h-10 rounded-full animate-ping opacity-25" style="background-color: ${color}"></div>` : ""}
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-md">
        <path d="M16 42L11 31.5C11 31.5 0 27 0 16C0 7.16344 7.16344 0 16 0C24.8366 0 32 7.16344 32 16C32 27 21 31.5 21 31.5L16 42Z" fill="${color}"/>
        <circle cx="16" cy="16" r="10" fill="white" fill-opacity="0.9"/>
        <circle cx="16" cy="16" r="6" fill="${color}"/>
      </svg>
      ${options.label ? `
        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-white px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm whitespace-nowrap pointer-events-none">
          ${options.label}
        </div>
      ` : ""}
    </div>
  `;

  return L.divIcon({
    html: svgIcon,
    className: "custom-leaflet-marker",
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -40],
  });
};

/**
 * CSS for custom animations and marker styles
 * Should be imported in globals.css or injected
 */
export const injectMarkerStyles = () => {
  if (typeof document === "undefined") return;
  
  const styleId = "agridata-marker-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
    @keyframes ping {
      75%, 100% {
        transform: scale(2);
        opacity: 0;
      }
    }
    .animate-ping {
      animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    .custom-leaflet-marker {
      background: none !important;
      border: none !important;
    }
    /* Cluster styles */
    .marker-cluster-small { background-color: rgba(181, 226, 140, 0.6); }
    .marker-cluster-small div { background-color: rgba(110, 204, 57, 0.6); }
    .marker-cluster-medium { background-color: rgba(241, 211, 87, 0.6); }
    .marker-cluster-medium div { background-color: rgba(240, 194, 12, 0.6); }
    .marker-cluster-large { background-color: rgba(253, 156, 115, 0.6); }
    .marker-cluster-large div { background-color: rgba(241, 128, 23, 0.6); }
    .marker-cluster {
      background-clip: padding-box;
      border-radius: 20px;
    }
    .marker-cluster div {
      width: 30px;
      height: 30px;
      margin-left: 5px;
      margin-top: 5px;
      text-align: center;
      border-radius: 15px;
      font-size: 12px;
      font-weight: bold;
      line-height: 30px;
      color: white;
      text-shadow: 0 1px 1px rgba(0,0,0,0.5);
    }
  `;
  document.head.appendChild(style);
};
