"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Plus, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Threshold {
  id: string;
  pestKey: string;
  normalMax: number;
  warningMax: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AlertThresholdsTableProps {
  thresholds: Threshold[];
  onUpdate: () => void;
  orgId?: string;
}

export function AlertThresholdsTable({
  thresholds: initialThresholds,
  onUpdate,
  orgId,
}: AlertThresholdsTableProps) {
  const [thresholds, setThresholds] = useState<Threshold[]>(initialThresholds);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    normalMax: number;
    warningMax: number;
  } | null>(null);
  const [newPestKey, setNewPestKey] = useState("");
  const [newNormalMax, setNewNormalMax] = useState("");
  const [newWarningMax, setNewWarningMax] = useState("");

  // Sync with prop changes
  useEffect(() => {
    if (editingId === null) {
      setThresholds(initialThresholds);
    }
  }, [initialThresholds, editingId]);

  const upsertMutation = api.alerts.upsertOrgThreshold.useMutation({
    onSuccess: () => {
      toast.success("Threshold updated successfully");
      onUpdate();
      setEditingId(null);
      setNewPestKey("");
      setNewNormalMax("");
      setNewWarningMax("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update threshold");
    },
  });

  const handleSave = (threshold: Threshold | null) => {
    const pestKey = threshold ? threshold.pestKey : newPestKey.trim();
    const normalMax = threshold
      ? editingValues?.normalMax ?? threshold.normalMax
      : parseInt(newNormalMax, 10);
    const warningMax = threshold
      ? editingValues?.warningMax ?? threshold.warningMax
      : parseInt(newWarningMax, 10);

    if (!pestKey) {
      toast.error("Pest name is required");
      return;
    }

    if (isNaN(normalMax) || isNaN(warningMax)) {
      toast.error("Values must be valid numbers");
      return;
    }

    if (normalMax >= warningMax) {
      toast.error("Normal max must be less than Warning max");
      return;
    }

    upsertMutation.mutate({
      orgId,
      pestKey,
      normalMax,
      warningMax,
    });
  };

  const handleEdit = (threshold: Threshold) => {
    setEditingId(threshold.id);
    setEditingValues({
      normalMax: threshold.normalMax,
      warningMax: threshold.warningMax,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingValues(null);
    setNewPestKey("");
    setNewNormalMax("");
    setNewWarningMax("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pest Alert Thresholds</CardTitle>
        <CardDescription>
          Configure severity levels based on pest count. HIGH severity is triggered when count &gt; Warning max.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Existing thresholds */}
          {thresholds.map((threshold) => (
            <div
              key={threshold.id}
              className="flex items-center gap-4 p-4 border rounded-lg"
            >
              {editingId === threshold.id ? (
                <>
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor={`pest-${threshold.id}`}>Pest</Label>
                      <Input
                        id={`pest-${threshold.id}`}
                        value={threshold.pestKey}
                        disabled
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`normal-${threshold.id}`}>Normal Max</Label>
                      <Input
                        id={`normal-${threshold.id}`}
                        type="number"
                        value={editingValues?.normalMax ?? threshold.normalMax}
                        onChange={(e) =>
                          setEditingValues({
                            normalMax: parseInt(e.target.value, 10) || 0,
                            warningMax: editingValues?.warningMax ?? threshold.warningMax,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`warning-${threshold.id}`}>Warning Max</Label>
                      <Input
                        id={`warning-${threshold.id}`}
                        type="number"
                        value={editingValues?.warningMax ?? threshold.warningMax}
                        onChange={(e) =>
                          setEditingValues({
                            normalMax: editingValues?.normalMax ?? threshold.normalMax,
                            warningMax: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(threshold)}
                        disabled={upsertMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={upsertMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm font-medium">{threshold.pestKey}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Normal: ≤ {threshold.normalMax}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Warning: {threshold.normalMax + 1} - {threshold.warningMax}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        High: &gt; {threshold.warningMax}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(threshold)}
                  >
                    Edit
                  </Button>
                </>
              )}
            </div>
          ))}

          {/* Add new threshold */}
          <div className="p-4 border-2 border-dashed rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex-1 grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="new-pest">Pest Name</Label>
                  <Input
                    id="new-pest"
                    placeholder="e.g., Moth"
                    value={newPestKey}
                    onChange={(e) => setNewPestKey(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="new-normal">Normal Max</Label>
                  <Input
                    id="new-normal"
                    type="number"
                    placeholder="e.g., 4"
                    value={newNormalMax}
                    onChange={(e) => setNewNormalMax(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="new-warning">Warning Max</Label>
                  <Input
                    id="new-warning"
                    type="number"
                    placeholder="e.g., 9"
                    value={newWarningMax}
                    onChange={(e) => setNewWarningMax(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(null)}
                    disabled={upsertMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {thresholds.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No thresholds configured. Add one above to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

