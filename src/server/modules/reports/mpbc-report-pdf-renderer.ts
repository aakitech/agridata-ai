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

function formatLocation(location: string | null): string {
  if (!location) return "N/A";
  const pointMatch = location.match(/POINT\(([^ ]+)\s+([^ ]+)\)/);
  if (pointMatch) {
    const lat = parseFloat(pointMatch[2]!);
    const lon = parseFloat(pointMatch[1]!);
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
  return location.length > 40 ? `${location.slice(0, 40)}...` : location;
}

function severityColor(sev: Severity): { fill: string; text: string } {
  if (sev === "HIGH") return { fill: "#fee2e2", text: "#991b1b" };
  if (sev === "WARNING") return { fill: "#fef3c7", text: "#92400e" };
  return { fill: "#d1fae5", text: "#065f46" };
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

    doc.font("Helvetica-Bold").fontSize(22).text(`${periodType} Trap Monitoring Report`, left, 120, {
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
      { label: "Trap Locations Visited", value: reportData.summaryMetrics.uniqueLocations, emphasize: false },
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

    // ---- Page 2: High Alert Focus ----
    doc.addPage();
    doc.font("Helvetica-Bold").fillColor("#111").fontSize(16).text("High Alert Trap Observations", left, 60);

    let y = 95;

    if (highAlerts.length === 0) {
      doc.font("Helvetica-Oblique").fillColor("#666").fontSize(11).text(
        "No high-risk trap counts were detected during this reporting period.",
        left,
        y + 30,
        { width: contentWidth, align: "center" }
      );
    } else {
      // Table header
      const cols = [
        { key: "date", label: "Date", w: 70 },
        { key: "location", label: "Location", w: 110 },
        { key: "pest", label: "Pest", w: 90 },
        { key: "count", label: "Count", w: 55 },
        { key: "severity", label: "Severity", w: 70 },
        { key: "officer", label: "Officer", w: contentWidth - (70 + 110 + 90 + 55 + 70) },
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

      const rowH = 22;
      doc.font("Helvetica").fillColor("#111").fontSize(9);
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
          location: formatLocation(r.location),
          pest: r.label || "N/A",
          count: r.observedCount ?? "N/A",
          severity: r.severity ?? "NORMAL",
          officer: r.user?.fullName || r.user?.phoneNumber || "Unknown",
        };

        // cells
        doc.text(String(values.date), cx + 6, y + 6, { width: cols[0].w - 12 }); cx += cols[0].w;
        doc.text(String(values.location), cx + 6, y + 6, { width: cols[1].w - 12 }); cx += cols[1].w;
        doc.text(String(values.pest), cx + 6, y + 6, { width: cols[2].w - 12 }); cx += cols[2].w;
        doc.text(String(values.count), cx + 6, y + 6, { width: cols[3].w - 12 }); cx += cols[3].w;

        // severity badge-like cell
        const sev = r.severity ?? "NORMAL";
        const sevColors = severityColor(sev);
        doc.save();
        doc.roundedRect(cx + 6, y + 5, cols[4].w - 12, 12, 3).fill(sevColors.fill);
        doc.restore();
        doc.fillColor(sevColors.text).font("Helvetica-Bold").fontSize(8).text(sev, cx + 6, y + 6, {
          width: cols[4].w - 12,
          align: "center",
        });
        doc.fillColor("#111").font("Helvetica").fontSize(9);
        cx += cols[4].w;

        doc.text(String(values.officer), cx + 6, y + 6, { width: cols[5].w - 12 });

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

    // ---- Page 3: Trap Activity Summary ----
    doc.addPage();
    doc.font("Helvetica-Bold").fillColor("#111").fontSize(16).text("Trap Activity Summary", left, 60);
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
        { label: "Date", w: 70 },
        { label: "Location", w: 140 },
        { label: "Pest", w: 120 },
        { label: "Count", w: 55 },
        { label: "Severity", w: contentWidth - (70 + 140 + 120 + 55) },
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

      const rowH = 22;
      doc.font("Helvetica").fillColor("#111").fontSize(9);
      for (const r of allReports) {
        if (y + rowH > pageHeight - 60) {
          doc.addPage();
          y = 60;
        }

        doc.save();
        doc.moveTo(left, y).lineTo(right, y).strokeColor("#e5e5e5").stroke();
        doc.restore();

        cx = left;
        doc.text(format(r.createdAt, "MMM dd"), cx + 6, y + 6, { width: cols[0].w - 12 }); cx += cols[0].w;
        doc.text(formatLocation(r.location), cx + 6, y + 6, { width: cols[1].w - 12 }); cx += cols[1].w;
        doc.text(r.label || "N/A", cx + 6, y + 6, { width: cols[2].w - 12 }); cx += cols[2].w;
        doc.text(String(r.observedCount ?? "N/A"), cx + 6, y + 6, { width: cols[3].w - 12 }); cx += cols[3].w;

        const sev = r.severity ?? "NORMAL";
        const sevColors = severityColor(sev);
        doc.save();
        doc.roundedRect(cx + 6, y + 5, cols[4].w - 12, 12, 3).fill(sevColors.fill);
        doc.restore();
        doc.fillColor(sevColors.text).font("Helvetica-Bold").fontSize(8).text(sev, cx + 6, y + 6, {
          width: cols[4].w - 12,
          align: "center",
        });
        doc.fillColor("#111").font("Helvetica").fontSize(9);

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


