"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Plus, Save, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

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
  pestOptions: Array<{
    key: string;
    label: string;
  }>;
}

function SeverityPreview({ normalMax, warningMax }: { normalMax: number; warningMax: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Badge variant="secondary" className="h-5 px-1.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
        🟢 0–{normalMax}
      </Badge>
      <Badge variant="default" className="h-5 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
        🟠 {normalMax + 1}–{warningMax}
      </Badge>
      <Badge variant="destructive" className="h-5 px-1.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
        🔴 {warningMax + 1}+
      </Badge>
    </div>
  );
}

export function AlertThresholdsTable({
  thresholds: initialThresholds,
  onUpdate,
  orgId,
  pestOptions,
}: AlertThresholdsTableProps) {
  const [thresholds, setThresholds] = useState<Threshold[]>(initialThresholds);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    normalMax: number;
    warningMax: number;
  } | null>(null);
  
  // Add Pest Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPestKey, setNewPestKey] = useState("");
  const [newNormalMax, setNewNormalMax] = useState("");
  const [newWarningMax, setNewWarningMax] = useState("");
  const [validationError, setValidationError] = useState("");

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
      setEditingValues(null);
      setAddDialogOpen(false);
      setNewPestKey("");
      setNewNormalMax("");
      setNewWarningMax("");
      setValidationError("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update threshold");
    },
  });

  const availablePestOptions = pestOptions.filter(
    (option) => !thresholds.some((threshold) => threshold.pestKey === option.key)
  );

  const validateThreshold = (normalMax: number, warningMax: number): string => {
    if (isNaN(normalMax) || isNaN(warningMax)) {
      return "Values must be valid numbers";
    }
    if (normalMax < 0 || warningMax < 0) {
      return "Values must be positive";
    }
    if (normalMax >= warningMax) {
      return "Warning Max must be greater than Normal Max";
    }
    return "";
  };

  const handleSave = (threshold: Threshold | null) => {
    const pestKey = threshold ? threshold.pestKey : newPestKey;
    const normalMax = threshold
      ? editingValues?.normalMax ?? threshold.normalMax
      : parseInt(newNormalMax, 10);
    const warningMax = threshold
      ? editingValues?.warningMax ?? threshold.warningMax
      : parseInt(newWarningMax, 10);

    if (!pestKey) {
      const error = "Select a pest first";
      setValidationError(error);
      toast.error(error);
      return;
    }

    const error = validateThreshold(normalMax, warningMax);
    if (error) {
      setValidationError(error);
      toast.error(error);
      return;
    }

    setValidationError("");
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
  };

  const handleAddDialogOpen = (open: boolean) => {
    setAddDialogOpen(open);
    if (!open) {
      setNewPestKey("");
      setNewNormalMax("");
      setNewWarningMax("");
      setValidationError("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>Pest Alert Thresholds</span>
          <Dialog open={addDialogOpen} onOpenChange={handleAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Pest Threshold
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Pest Threshold</DialogTitle>
                <DialogDescription>
                  Define severity thresholds for a new pest type.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Pest</Label>
                  <Select value={newPestKey} onValueChange={setNewPestKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pest" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePestOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availablePestOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      All configured pests already have threshold records.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-normal">Normal Max</Label>
                    <Input
                      id="new-normal"
                      type="number"
                      placeholder="e.g., 4"
                      value={newNormalMax}
                      onChange={(e) => setNewNormalMax(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-warning">Warning Max</Label>
                    <Input
                      id="new-warning"
                      type="number"
                      placeholder="e.g., 10"
                      value={newWarningMax}
                      onChange={(e) => setNewWarningMax(e.target.value)}
                    />
                  </div>
                </div>
                {validationError && (
                  <p className="text-sm text-destructive">{validationError}</p>
                )}
                {newNormalMax && newWarningMax && !validationError && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Preview</Label>
                    <SeverityPreview
                      normalMax={parseInt(newNormalMax, 10)}
                      warningMax={parseInt(newWarningMax, 10)}
                    />
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleAddDialogOpen(false)}
                  disabled={upsertMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSave(null)}
                  disabled={upsertMutation.isPending || availablePestOptions.length === 0}
                  className="w-full sm:w-auto"
                >
                  {upsertMutation.isPending ? "Adding..." : "Add Threshold"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {thresholds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No thresholds configured yet.</p>
            <p className="text-sm mt-1">Click "Add Pest Threshold" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pest</TableHead>
                <TableHead>Normal Max</TableHead>
                <TableHead>Warning Max</TableHead>
                <TableHead>Severity Preview</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {thresholds.map((threshold) => (
                <TableRow key={threshold.id}>
                  {editingId === threshold.id ? (
                    <>
                      <TableCell className="font-medium">
                        {threshold.pestKey}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editingValues?.normalMax ?? threshold.normalMax}
                          onChange={(e) =>
                            setEditingValues({
                              normalMax: parseInt(e.target.value, 10) || 0,
                              warningMax: editingValues?.warningMax ?? threshold.warningMax,
                            })
                          }
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={editingValues?.warningMax ?? threshold.warningMax}
                          onChange={(e) =>
                            setEditingValues({
                              normalMax: editingValues?.normalMax ?? threshold.normalMax,
                              warningMax: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <SeverityPreview
                          normalMax={editingValues?.normalMax ?? threshold.normalMax}
                          warningMax={editingValues?.warningMax ?? threshold.warningMax}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">
                        {threshold.pestKey}
                      </TableCell>
                      <TableCell>{threshold.normalMax}</TableCell>
                      <TableCell>{threshold.warningMax}</TableCell>
                      <TableCell>
                        <SeverityPreview
                          normalMax={threshold.normalMax}
                          warningMax={threshold.warningMax}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(threshold)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
