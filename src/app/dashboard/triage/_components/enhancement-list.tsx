"use client";

import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { Camera, Leaf, Phone, Lock, User, Loader2, Tag } from "lucide-react";
import { cn } from "~/lib/utils";

interface EnhancementListProps {
  reportId: string;
}

const TYPE_CONFIG = {
  label_hint: { icon: Tag, label: "Label Hint", color: "text-blue-700 bg-blue-50 border-blue-200" },
  quality: { icon: Camera, label: "Quality Issue", color: "text-orange-600 bg-orange-50 border-orange-200" },
  context: { icon: Leaf, label: "Context Info", color: "text-green-600 bg-green-50 border-green-200" },
  follow_up: { icon: Phone, label: "Follow Up", color: "text-amber-600 bg-amber-50 border-amber-200" },
  internal: { icon: Lock, label: "Internal Note", color: "text-purple-600 bg-purple-50 border-purple-200" },
} as const;

export function EnhancementList({ reportId }: EnhancementListProps) {
  const { data: enhancements, isLoading } = api.enhancements.getByReportId.useQuery(
    { reportId },
    { refetchOnMount: true }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading annotations...
      </div>
    );
  }

  if (!enhancements || enhancements.length === 0) {
    return (
      <div className="py-6 text-center text-muted-foreground text-sm">
        No annotations yet. Add one to provide context or flag issues.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        Annotations ({enhancements.length})
      </h4>
      <div className="space-y-2">
        {enhancements.map((enhancement) => {
          const config = TYPE_CONFIG[enhancement.enhancementType as keyof typeof TYPE_CONFIG];
          const Icon = config?.icon || Leaf;

          return (
            <div
              key={enhancement.id}
              className={cn(
                "p-3 rounded-lg border text-sm",
                enhancement.isInternal
                  ? "bg-purple-50/50 border-purple-200"
                  : "bg-muted/30"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
                      config?.color || "text-gray-600 bg-gray-50 border-gray-200"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {config?.label || enhancement.enhancementType}
                  </span>
                  {enhancement.isInternal && (
                    <span className="text-xs text-purple-600 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Internal
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(enhancement.createdAt), { addSuffix: true })}
                </span>
              </div>

              {/* Content */}
              <p className="text-foreground whitespace-pre-wrap">
                {enhancement.enhancementText}
              </p>

              {/* Author */}
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {enhancement.addedByUser?.fullName || "Unknown"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
