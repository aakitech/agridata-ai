"use client";

import { formatDistanceToNow } from "date-fns";

type Report = {
  id: string;
  mediaUrl: string | null;
  createdAt: Date;
  category: "PEST" | "DISEASE" | "WEATHER" | null;
  user?: {
    phoneNumber: string;
    languagePref: string | null;
  };
};

interface ReportsListProps {
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ReportsList({ reports, selectedId, onSelect }: ReportsListProps) {
  return (
    <div className="divide-y divide-gray-200">
      {reports.map((report) => (
        <button
          key={report.id}
          onClick={() => onSelect(report.id)}
          className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
            selectedId === report.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
          }`}
        >
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
              {report.mediaUrl ? (
                <img
                  src={report.mediaUrl}
                  alt="Report"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">
                  {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                </span>
                {report.category && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                    {report.category}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1 truncate">
                Report #{report.id.slice(0, 8)}
              </p>
              {report.user && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {report.user.phoneNumber}
                </p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
