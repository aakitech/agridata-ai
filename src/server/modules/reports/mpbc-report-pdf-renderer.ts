import { format } from "date-fns";
import type { MpbcReportData } from "./report-types";
import { createRequire } from "node:module";

type Severity = "NORMAL" | "WARNING" | "HIGH" | null;

const require = createRequire(import.meta.url);
// Force pdfkit CommonJS build (avoids Next bundling the ESM build that pulls in fontkit/module.mjs)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
const PDFDocument: typeof import("pdfkit") = require("pdfkit");

function severityRank(sev: Severity): number {
  if (sev === "HIGH") return 0;
  if (sev === "WARNING") return 1;
  return 2;
}

function formatLocation(location: string | null, geocoded?: string | null): string {
  if (!location) return "N/A";
  let coords = "";
  const pointMatch = location.match(/POINT\(([^ ]+)\s+([^ ]+)\)/);
  if (pointMatch) {
    const lat = parseFloat(pointMatch[2]!);
    const lon = parseFloat(pointMatch[1]!);
    coords = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  if (geocoded) {
    return coords ? `${geocoded} (${coords})` : geocoded;
  }
  return coords || (location.length > 40 ? `${location.slice(0, 40)}...` : location);
}

function severityColor(sev: Severity): { fill: string; text: string } {
  if (sev === "HIGH") return { fill: "#fee2e2", text: "#991b1b" };
  if (sev === "WARNING") return { fill: "#fef3c7", text: "#92400e" };
  return { fill: "#d1fae5", text: "#065f46" };
}

function formatObservationMethod(method: string | null | undefined): string {
  switch (method) {
    case "PHEROMONE_TRAP":
      return "Trap";
    case "FIELD_OBSERVATION":
      return "Field";
    case "EVENT_OBSERVATION":
      return "Event";
    case "SIGN_BASED":
      return "Sign";
    default:
      return "";
  }
}

export class MpbcReportPdfRenderer {
  async render(reportData: MpbcReportData): Promise<Buffer> {
    // Ensure deterministic ordering beyond the service (defensive)
    const allReports = [...reportData.allReports].sort((a, b) => {
      const aRank = severityRank(a.severity ?? "NORMAL");
      const bRank = severityRank(b.severity ?? "NORMAL");
      if (aRank !== bRank) return aRank - bRank;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    const highAlerts = [...reportData.highAlertReports].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));
    });

    // ---- Page 1: Cover & Executive Summary ----
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const left = doc.page.margins.left;
    const right = pageWidth - doc.page.margins.right;
    const contentWidth = right - left;

    // Calculate the number of days in the period
    const daysDiff = Math.ceil(
      (reportData.period.endDate.getTime() - reportData.period.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const periodType = daysDiff <= 14 ? "Weekly" : "Monthly";
    const periodLabel = daysDiff <= 14 ? "Last 7 Days" : "Last 30 Days";

    doc.font("Helvetica-Bold").fontSize(22).text(`${periodType} Pest Surveillance Report`, left, 120, {
      width: contentWidth,
      align: "center",
    });
    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(14).text("MPBC – African Armyworm Surveillance", {
      width: contentWidth,
      align: "center",
    });

    doc.moveDown(2);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Organization: ${reportData.organization.name}`, { align: "center" });
    
    doc.text(
      `Reporting Period: ${periodLabel} (${format(reportData.period.startDate, "MMM dd, yyyy")} to ${format(
        reportData.period.endDate,
        "MMM dd, yyyy"
      )})`,
      { align: "center" }
    );
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy 'at' HH:mm")}`, { align: "center" });

    // Metrics boxes
    const boxTop = 320;
    const boxGap = 16;
    const boxW = (contentWidth - boxGap) / 2;
    const boxH = 80;

    const metrics = [
      { label: "Total Reports Submitted", value: reportData.summaryMetrics.totalReports, emphasize: false },
      { label: "Active Officers", value: reportData.summaryMetrics.activeOfficers, emphasize: false },
      { label: "Reporting Locations", value: reportData.summaryMetrics.uniqueLocations, emphasize: false },
      { label: "High Alert Reports", value: reportData.summaryMetrics.highAlertCount, emphasize: reportData.summaryMetrics.highAlertCount > 0 },
    ] as const;

    metrics.forEach((m, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = left + col * (boxW + boxGap);
      const y = boxTop + row * (boxH + boxGap);

      doc.save();
      if (m.emphasize) {
        doc.rect(x, y, boxW, boxH).fillAndStroke("#fee2e2", "#dc2626");
      } else {
        doc.rect(x, y, boxW, boxH).fillAndStroke("#f5f5f5", "#e5e5e5");
      }
      doc.restore();

      doc.font("Helvetica").fillColor("#666").fontSize(9).text(m.label, x + 12, y + 12, {
        width: boxW - 24,
      });
      doc.font("Helvetica-Bold").fillColor("#111").fontSize(22).text(String(m.value), x + 12, y + 32, {
        width: boxW - 24,
      });
    });

    // ---- Province Breakdown Page ----
    doc.addPage();
    doc.font("Helvetica-Bold").fillColor("#111").fontSize(16).text("Province Breakdown", left, 60);
    doc.font("Helvetica").fillColor("#666").fontSize(10).text(
      "Geographic distribution of pest reports by administrative region",
      left,
      85,
      { width: contentWidth }
    );

    let y = 115;

    if (reportData.provinceBreakdown.length === 0) {
      doc.font("Helvetica-Oblique").fillColor("#666").fontSize(11).text(
        "No province data available for this reporting period.",
        left,
        y + 30,
        { width: contentWidth, align: "center" }
      );
    } else {
      // Province breakdown table
      const provCols = [
        { label: "Province / Region", w: 120 },
        { label: "Reports", w: 50 },
        { label: "Sites", w: 40 },
        { label: "High Severity", w: 60 },
        { label: "Moderate Severity", w: 70 },
        { label: "Low Severity", w: 60 },
        { label: "Share of Total Reports", w: contentWidth - (120 + 50 + 40 + 60 + 70 + 60) },
      ] as const;

      const provHeaderH = 24;
      doc.save();
      doc.rect(left, y, contentWidth, provHeaderH).fill("#f3f4f6");
      doc.restore();

      let cx = left;
      doc.font("Helvetica-Bold").fillColor("#111").fontSize(8);
      for (const c of provCols) {
        doc.text(c.label, cx + 6, y + 6, { width: c.w - 12 });
        cx += c.w;
      }
      y += provHeaderH;

      const provRowH = 24;
      doc.font("Helvetica").fillColor("#111").fontSize(8);
      
      for (const prov of reportData.provinceBreakdown) {
        if (y + provRowH > pageHeight - 60) {
          doc.addPage();
          y = 60;
        }

        // Row border
        doc.save();
        doc.moveTo(left, y).lineTo(right, y).strokeColor("#e5e5e5").stroke();
        doc.restore();

        cx = left;
        const vPad = 6;

        // Province name
        doc.text(prov.province, cx + 6, y + vPad, { width: provCols[0].w - 12 });
        cx += provCols[0].w;

        // Total Reports
        doc.text(String(prov.totalReports), cx + 6, y + vPad, { width: provCols[1].w - 12, align: "right" });
        cx += provCols[1].w;

        // Sites
        doc.text(String(prov.locations), cx + 6, y + vPad, { width: provCols[2].w - 12, align: "right" });
        cx += provCols[2].w;

        // High Alerts
        if (prov.highAlerts > 0) {
          doc.save();
          doc.roundedRect(cx + 6, y + vPad - 1, provCols[3].w - 12, 12, 3).fill("#fee2e2");
          doc.restore();
          doc.fillColor("#991b1b").font("Helvetica-Bold").fontSize(7.5).text(
            String(prov.highAlerts),
            cx + 6,
            y + vPad,
            { width: provCols[3].w - 12, align: "center" }
          );
          doc.fillColor("#111").font("Helvetica").fontSize(8);
        } else {
          doc.fillColor("#999").text("—", cx + 6, y + vPad, { width: provCols[3].w - 12, align: "center" });
          doc.fillColor("#111");
        }
        cx += provCols[3].w;

        // Warning Alerts
        if (prov.warningAlerts > 0) {
          doc.save();
          doc.roundedRect(cx + 6, y + vPad - 1, provCols[4].w - 12, 12, 3).fill("#fef3c7");
          doc.restore();
          doc.fillColor("#92400e").font("Helvetica-Bold").fontSize(7.5).text(
            String(prov.warningAlerts),
            cx + 6,
            y + vPad,
            { width: provCols[4].w - 12, align: "center" }
          );
          doc.fillColor("#111").font("Helvetica").fontSize(8);
        } else {
          doc.fillColor("#999").text("—", cx + 6, y + vPad, { width: provCols[4].w - 12, align: "center" });
          doc.fillColor("#111");
        }
        cx += provCols[4].w;

        // Normal Alerts
        if (prov.normalAlerts > 0) {
          doc.save();
          doc.roundedRect(cx + 6, y + vPad - 1, provCols[5].w - 12, 12, 3).fill("#d1fae5");
          doc.restore();
          doc.fillColor("#065f46").font("Helvetica-Bold").fontSize(7.5).text(
            String(prov.normalAlerts),
            cx + 6,
            y + vPad,
            { width: provCols[5].w - 12, align: "center" }
          );
          doc.fillColor("#111").font("Helvetica").fontSize(8);
        } else {
          doc.fillColor("#999").text("—", cx + 6, y + vPad, { width: provCols[5].w - 12, align: "center" });
          doc.fillColor("#111");
        }
        cx += provCols[5].w;

        // Share percentage
        doc.text(`${prov.sharePercentage.toFixed(1)}%`, cx + 6, y + vPad, {
          width: provCols[6].w - 12,
          align: "right",
        });

        y += provRowH;
      }

      // Summary footer note
      doc.moveDown(1);
      doc.font("Helvetica").fillColor("#666").fontSize(8).text(
        `${reportData.provinceBreakdown.length} province${reportData.provinceBreakdown.length !== 1 ? "s" : ""} recorded during this period.`,
        left,
        y + 15,
        { width: contentWidth, align: "left" }
      );
    }

    // ---- Page 2: High Alert Focus ----
    doc.addPage();
    doc.font("Helvetica-Bold").fillColor("#111").fontSize(16).text("High Alert Observations", left, 60);

    y = 95;

    if (highAlerts.length === 0) {
      doc.font("Helvetica-Oblique").fillColor("#666").fontSize(11).text(
        "No high-alert pest observations were detected during this reporting period.",
        left,
        y + 30,
        { width: contentWidth, align: "center" }
      );
    } else {
      // Table header
      const cols = [
        { key: "date", label: "Date", w: 55 },
        { key: "location", label: "Location", w: 165 },
        { key: "pest", label: "Pest", w: 85 },
        { key: "count", label: "Primary", w: 45 },
        { key: "severity", label: "Severity", w: 65 },
        { key: "officer", label: "Officer", w: contentWidth - (55 + 165 + 85 + 45 + 65) },
      ] as const;

      const headerH = 20;
      doc.save();
      doc.rect(left, y, contentWidth, headerH).fill("#f3f4f6");
      doc.restore();

      let cx = left;
      doc.font("Helvetica-Bold").fillColor("#111").fontSize(9);
      for (const c of cols) {
        doc.text(c.label, cx + 6, y + 6, { width: c.w - 12 });
        cx += c.w;
      }
      y += headerH;

      const rowH = 36;
      doc.font("Helvetica").fillColor("#111").fontSize(8);
      for (const r of highAlerts) {
        if (y + rowH > pageHeight - 60) {
          doc.addPage();
          y = 60;
        }

        // Row border
        doc.save();
        doc.moveTo(left, y).lineTo(right, y).strokeColor("#e5e5e5").stroke();
        doc.restore();

        cx = left;
        const values = {
          date: format(r.createdAt, "MMM dd"),
          location: formatLocation(r.location, r.geocodedLocation),
          pest: [r.label || "N/A", formatObservationMethod(r.observationMethod)].filter(Boolean).join(" • "),
          count: r.observedCount ?? "N/A",
          severity: r.severity ?? "NORMAL",
          officer: r.user?.fullName || r.user?.phoneNumber || "Unknown",
        };

        // cells
        const vPad = 8;
        doc.text(String(values.date), cx + 6, y + vPad, { width: cols[0].w - 12 }); cx += cols[0].w;
        doc.text(String(values.location), cx + 6, y + vPad, { width: cols[1].w - 12, lineGap: 1 }); cx += cols[1].w;
        doc.text(String(values.pest), cx + 6, y + vPad, { width: cols[2].w - 12 }); cx += cols[2].w;
        doc.text(String(values.count), cx + 6, y + vPad, { width: cols[3].w - 12 }); cx += cols[3].w;

        // severity badge-like cell
        const sev = r.severity ?? "NORMAL";
        const sevColors = severityColor(sev);
        doc.save();
        doc.roundedRect(cx + 6, y + vPad - 1, cols[4].w - 12, 12, 3).fill(sevColors.fill);
        doc.restore();
        doc.fillColor(sevColors.text).font("Helvetica-Bold").fontSize(7.5).text(sev, cx + 6, y + vPad, {
          width: cols[4].w - 12,
          align: "center",
        });
        doc.fillColor("#111").font("Helvetica").fontSize(8);
        cx += cols[4].w;

        doc.text(String(values.officer), cx + 6, y + vPad, { width: cols[5].w - 12, lineGap: 1 });

        y += rowH;
      }
    }

    // Footer note (page 2)
    doc.font("Helvetica").fillColor("#666").fontSize(8).text(
      "Severity levels are based on MPBC-configured thresholds at the time of data submission.",
      left,
      pageHeight - 45,
      { width: contentWidth, align: "center" }
    );

    // ---- Page 3: Observation Summary ----
    doc.addPage();
    doc.font("Helvetica-Bold").fillColor("#111").fontSize(16).text("Observation Summary", left, 60);
    y = 95;

    if (allReports.length === 0) {
      doc.font("Helvetica-Oblique").fillColor("#666").fontSize(11).text(
        "No reports were submitted during this reporting period.",
        left,
        y + 30,
        { width: contentWidth, align: "center" }
      );
    } else {
      const cols = [
        { label: "Date", w: 55 },
        { label: "Location", w: 165 },
        { label: "Pest", w: 85 },
        { label: "Primary", w: 45 },
        { label: "Severity", w: 65 },
        { label: "Officer", w: contentWidth - (55 + 165 + 85 + 45 + 65) },
      ] as const;

      const headerH = 20;
      doc.save();
      doc.rect(left, y, contentWidth, headerH).fill("#f3f4f6");
      doc.restore();

      let cx = left;
      doc.font("Helvetica-Bold").fillColor("#111").fontSize(9);
      for (const c of cols) {
        doc.text(c.label, cx + 6, y + 6, { width: c.w - 12 });
        cx += c.w;
      }
      y += headerH;

      const rowH = 36;
      doc.font("Helvetica").fillColor("#111").fontSize(8);
      for (const r of allReports) {
        if (y + rowH > pageHeight - 60) {
          doc.addPage();
          y = 60;
        }

        doc.save();
        doc.moveTo(left, y).lineTo(right, y).strokeColor("#e5e5e5").stroke();
        doc.restore();

        cx = left;
        const vPad = 8;
        doc.text(format(r.createdAt, "MMM dd"), cx + 6, y + vPad, { width: cols[0].w - 12 }); cx += cols[0].w;
        doc.text(formatLocation(r.location, r.geocodedLocation), cx + 6, y + vPad, { width: cols[1].w - 12, lineGap: 1 }); cx += cols[1].w;
        doc.text([r.label || "N/A", formatObservationMethod(r.observationMethod)].filter(Boolean).join(" • "), cx + 6, y + vPad, { width: cols[2].w - 12 }); cx += cols[2].w;
        doc.text(String(r.observedCount ?? "N/A"), cx + 6, y + vPad, { width: cols[3].w - 12 }); cx += cols[3].w;

        const sev = r.severity ?? "NORMAL";
        const sevColors = severityColor(sev);
        doc.save();
        doc.roundedRect(cx + 6, y + vPad - 1, cols[4].w - 12, 12, 3).fill(sevColors.fill);
        doc.restore();
        doc.fillColor(sevColors.text).font("Helvetica-Bold").fontSize(7.5).text(sev, cx + 6, y + vPad, {
          width: cols[4].w - 12,
          align: "center",
        });
        doc.fillColor("#111").font("Helvetica").fontSize(8);
        cx += cols[4].w;

        doc.text(r.user?.fullName || r.user?.phoneNumber || "Unknown", cx + 6, y + vPad, {
          width: cols[5].w - 12,
          lineGap: 1,
        });

        y += rowH;
      }
    }

    doc.font("Helvetica").fillColor("#666").fontSize(8).text(
      "Severity levels are based on MPBC-configured thresholds at the time of data submission.",
      left,
      pageHeight - 45,
      { width: contentWidth, align: "center" }
    );

    // Finalize
    doc.end();
    return await done;
  }
}


