"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import { Camera, Leaf, Phone, Lock, Send, Loader2, Tag, Info } from "lucide-react";

interface EnhancementFormProps {
  reportId: string;
  onSuccess?: () => void;
}

const ENHANCEMENT_TYPES = [
  { value: "label_hint", label: "🏷️ Label Hint", icon: Tag, placeholder: "Suggest a diagnosis name, or refine the category..." },
  { value: "quality", label: "📸 Quality Issue", icon: Camera, placeholder: "Photo is blurry, needs better lighting, bad angle..." },
  { value: "context", label: "🌱 Context Info", icon: Leaf, placeholder: "Field conditions: moderate rain, 2-week growth stage, soil type..." },
  { value: "follow_up", label: "📞 Follow Up", icon: Phone, placeholder: "Contact scout for clearer photo, need verification of damage extent..." },
  { value: "internal", label: "🔒 Internal Note", icon: Lock, placeholder: "Discuss with field supervisor, coordinate with regional team..." },
] as const;

export function EnhancementForm({ reportId, onSuccess }: EnhancementFormProps) {
  const [type, setType] = useState<typeof ENHANCEMENT_TYPES[number]["value"]>("label_hint");
  const [text, setText] = useState("");
  
  const utils = api.useUtils();
  
  const createEnhancement = api.enhancements.create.useMutation({
    onSuccess: () => {
      toast.success("Annotation added successfully");
      setText("");
      void utils.enhancements.getByReportId.invalidate({ reportId });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const selectedType = ENHANCEMENT_TYPES.find((t) => t.value === type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Please enter annotation text");
      return;
    }

    createEnhancement.mutate({
      reportId,
      enhancementType: type,
      enhancementText: text.trim(),
      isInternal: type === "internal",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Add Annotation</Label>
        <Select value={type} onValueChange={(val) => setType(val as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENHANCEMENT_TYPES.map((enhType) => (
              <SelectItem key={enhType.value} value={enhType.value}>
                {enhType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder={selectedType?.placeholder || "Enter your annotation..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="resize-none"
        />
        {type === "internal" && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 p-2 bg-blue-50/50 rounded-md">
            <Lock className="h-3 w-3 mt-0.5 text-blue-600" />
            <span><strong>Visibility</strong>: Only visible to your organization members and super admins.</span>
          </p>
        )}
        {type === "follow_up" && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 p-2 bg-amber-50/50 rounded-md">
            <Info className="h-3 w-3 mt-0.5 text-amber-600" />
            <span><strong>Informational</strong>: This note is for tracking and does not block the expert verification process.</span>
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="sm"
        disabled={createEnhancement.isPending || !text.trim()}
        className="w-full"
      >
        {createEnhancement.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Adding...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Add Annotation
          </>
        )}
      </Button>
    </form>
  );
}
