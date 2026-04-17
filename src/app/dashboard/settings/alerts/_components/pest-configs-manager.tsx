"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, RefreshCw } from "lucide-react";

type PestConfigRecord = RouterOutputs["pestConfigs"]["list"][number];
type ObservationConfigRecord = PestConfigRecord["observationConfigs"][number];
type ObservationFieldRecord = ObservationConfigRecord["fields"][number];
type SeverityRuleRecord = ObservationConfigRecord["severityRules"][number];
type EditableObservationConfig = {
  method: ObservationConfigRecord["method"];
  active: boolean;
  displayOrder: number;
  countFieldKey?: string | null;
  summaryFieldKeys?: string[] | null;
  guidanceText?: string | null;
  derivedDefinitions?: Record<string, unknown> | null;
  confirmationNormalTemplate?: string | null;
  confirmationWarningTemplate?: string | null;
  confirmationHighTemplate?: string | null;
  fields: Array<{
    key: string;
    label: string;
    prompt: string;
    helpText?: string | null;
    fieldType: ObservationFieldRecord["fieldType"];
    required: boolean;
    displayOrder: number;
    defaultValue?: string | number | boolean | null;
    options?: string[] | null;
    validationRules?: Record<string, unknown> | null;
    captureMode: ObservationFieldRecord["captureMode"];
  }>;
  severityRules: Array<{
    ruleOrder: number;
    severity: SeverityRuleRecord["severity"];
    conditionKind: SeverityRuleRecord["conditionKind"];
    conditionExpression: Record<string, unknown>;
  }>;
};

const emptyObservationConfig = [
  {
    method: "PHEROMONE_TRAP",
    active: true,
    displayOrder: 1,
    countFieldKey: "count",
    summaryFieldKeys: ["count"],
    guidanceText: "",
    derivedDefinitions: null,
    confirmationNormalTemplate: null,
    confirmationWarningTemplate: null,
    confirmationHighTemplate: null,
    fields: [
      {
        key: "count",
        label: "Count",
        prompt: "How many were observed?",
        fieldType: "number",
        required: true,
        displayOrder: 1,
        defaultValue: null,
        options: null,
        validationRules: { min: 0 },
        captureMode: "RAW",
      },
    ],
    severityRules: [
      {
        ruleOrder: 99,
        severity: "NORMAL",
        conditionKind: "DEFAULT",
        conditionExpression: { fallback: true },
      },
    ],
  },
];

function toJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseObservationConfigs(
  observationConfigsJson: string
): { value: EditableObservationConfig[] | null; error: string | null } {
  try {
    const parsed = JSON.parse(observationConfigsJson) as unknown;
    if (!Array.isArray(parsed)) {
      return { value: null, error: "Observation config JSON must be an array." };
    }
    return { value: parsed as EditableObservationConfig[], error: null };
  } catch {
    return { value: null, error: "Observation config JSON is not valid." };
  }
}

export function PestConfigsManager({ orgId }: { orgId?: string }) {
  const utils = api.useUtils();
  const { data, isLoading, refetch } = api.pestConfigs.list.useQuery(
    orgId ? { orgId } : undefined
  );

  const saveMutation = api.pestConfigs.save.useMutation({
    onSuccess: async () => {
      toast.success("Pest configuration saved");
      await utils.pestConfigs.list.invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: (error) => toast.error(error.message || "Failed to save pest configuration"),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PestConfigRecord | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [active, setActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState("1");
  const [defaultObservationMethod, setDefaultObservationMethod] = useState<
    "PHEROMONE_TRAP" | "FIELD_OBSERVATION" | "EVENT_OBSERVATION" | "SIGN_BASED"
  >("PHEROMONE_TRAP");
  const [alertTrigger, setAlertTrigger] = useState<
    "WARNING_AND_HIGH" | "HIGH_ONLY" | "NONE"
  >("WARNING_AND_HIGH");
  const [observationConfigsJson, setObservationConfigsJson] = useState(
    toJson(emptyObservationConfig)
  );

  const methodCount = useMemo(
    () => data?.reduce((acc, item) => acc + item.observationConfigs.length, 0) ?? 0,
    [data]
  );
  const parsedObservationConfigs = useMemo(
    () => parseObservationConfigs(observationConfigsJson),
    [observationConfigsJson]
  );

  function updateObservationConfigs(
    updater: (configs: EditableObservationConfig[]) => EditableObservationConfig[]
  ) {
    if (!parsedObservationConfigs.value) {
      toast.error("Fix the observation config JSON before editing thresholds.");
      return;
    }

    const next = updater(parsedObservationConfigs.value);
    setObservationConfigsJson(toJson(next));
  }

  function openCreate() {
    setEditing(null);
    setLabel("");
    setKey("");
    setActive(true);
    setDisplayOrder(String((data?.length ?? 0) + 1));
    setDefaultObservationMethod("PHEROMONE_TRAP");
    setAlertTrigger("WARNING_AND_HIGH");
    setObservationConfigsJson(toJson(emptyObservationConfig));
    setOpen(true);
  }

  function openEdit(config: PestConfigRecord) {
    setEditing(config);
    setLabel(config.label);
    setKey(config.key);
    setActive(config.active);
    setDisplayOrder(String(config.displayOrder));
    setDefaultObservationMethod(config.defaultObservationMethod);
    setAlertTrigger(config.alertTrigger);
    setObservationConfigsJson(
      toJson(
        config.observationConfigs.map((item: PestConfigRecord["observationConfigs"][number]) => ({
          method: item.method,
          active: item.active,
          displayOrder: item.displayOrder,
          countFieldKey: item.countFieldKey,
          summaryFieldKeys: item.summaryFieldKeys,
          guidanceText: item.guidanceText,
          derivedDefinitions: item.derivedDefinitions,
          confirmationNormalTemplate: item.confirmationNormalTemplate,
          confirmationWarningTemplate: item.confirmationWarningTemplate,
          confirmationHighTemplate: item.confirmationHighTemplate,
          fields: item.fields.map((field: PestConfigRecord["observationConfigs"][number]["fields"][number]) => ({
            key: field.key,
            label: field.label,
            prompt: field.prompt,
            helpText: field.helpText,
            fieldType: field.fieldType,
            required: field.required,
            displayOrder: field.displayOrder,
            defaultValue: field.defaultValue,
            options: field.options,
            validationRules: field.validationRules,
            captureMode: field.captureMode,
          })),
          severityRules: item.severityRules.map((rule: PestConfigRecord["observationConfigs"][number]["severityRules"][number]) => ({
            ruleOrder: rule.ruleOrder,
            severity: rule.severity,
            conditionKind: rule.conditionKind,
            conditionExpression: rule.conditionExpression,
          })),
        }))
      )
    );
    setOpen(true);
  }

  function handleSave() {
    let parsedObservationConfigs: unknown;
    try {
      parsedObservationConfigs = JSON.parse(observationConfigsJson);
    } catch {
      toast.error("Observation config JSON is not valid");
      return;
    }

    if (!label.trim() || !key.trim()) {
      toast.error("Label and key are required");
      return;
    }

    saveMutation.mutate({
      id: editing?.id,
      orgId,
      label: label.trim(),
      key: key.trim(),
      active,
      displayOrder: Number.parseInt(displayOrder, 10) || 0,
      defaultObservationMethod,
      alertTrigger,
      observationConfigs: parsedObservationConfigs as never,
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div>Pest Configurations</div>
              <div className="mt-1 text-sm font-normal text-muted-foreground">
                Manage phase-1 multi-pest runtime configs, observation methods, fields, and severity rules.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Pest Config
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{data?.length ?? 0} pests</Badge>
            <Badge variant="outline">{methodCount} observation methods</Badge>
          </div>

          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading pest configurations...</div>
          ) : !data || data.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              No pest configurations found for this organization.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pest</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Default Method</TableHead>
                    <TableHead>Alert Trigger</TableHead>
                    <TableHead>Methods</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div className="font-medium">{config.label}</div>
                        <div className="text-xs text-muted-foreground">
                          Display order: {config.displayOrder}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{config.key}</TableCell>
                      <TableCell>
                        <Badge variant={config.active ? "secondary" : "outline"}>
                          {config.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{config.defaultObservationMethod}</TableCell>
                      <TableCell>{config.alertTrigger}</TableCell>
                      <TableCell>{config.observationConfigs.length}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(config)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-1rem)] max-w-4xl flex-col overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
            <DialogTitle>{editing ? "Edit Pest Configuration" : "Add Pest Configuration"}</DialogTitle>
            <DialogDescription>
              Phase-1 editor for pest config records. Top-level settings are form-based. Observation methods, fields, and rules are edited as structured JSON.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pest-label">Label</Label>
                <Input id="pest-label" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pest-key">Key</Label>
                <Input id="pest-key" value={key} onChange={(e) => setKey(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-order">Display Order</Label>
                <Input
                  id="display-order"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Observation Method</Label>
                <Select value={defaultObservationMethod} onValueChange={(value) => setDefaultObservationMethod(value as typeof defaultObservationMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHEROMONE_TRAP">PHEROMONE_TRAP</SelectItem>
                    <SelectItem value="FIELD_OBSERVATION">FIELD_OBSERVATION</SelectItem>
                    <SelectItem value="EVENT_OBSERVATION">EVENT_OBSERVATION</SelectItem>
                    <SelectItem value="SIGN_BASED">SIGN_BASED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Alert Trigger</Label>
                <Select value={alertTrigger} onValueChange={(value) => setAlertTrigger(value as typeof alertTrigger)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WARNING_AND_HIGH">WARNING_AND_HIGH</SelectItem>
                    <SelectItem value="HIGH_ONLY">HIGH_ONLY</SelectItem>
                    <SelectItem value="NONE">NONE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <Label>Active</Label>
                  <div className="text-xs text-muted-foreground">Controls whether officers can select this pest</div>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <Label>Threshold Editor</Label>
              {parsedObservationConfigs.error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {parsedObservationConfigs.error}
                </div>
              ) : parsedObservationConfigs.value && parsedObservationConfigs.value.length > 0 ? (
                <div className="space-y-3">
                  {parsedObservationConfigs.value.map((config, configIndex) => {
                    const numericRules = config.severityRules.filter(
                      (rule) => rule.conditionKind === "NUMERIC"
                    );
                    const highRule = numericRules.find((rule) => rule.severity === "HIGH");
                    const warningRule = numericRules.find((rule) => rule.severity === "WARNING");
                    const thresholdFieldKey =
                      (typeof highRule?.conditionExpression?.field === "string"
                        ? highRule.conditionExpression.field
                        : null) ??
                      (typeof warningRule?.conditionExpression?.field === "string"
                        ? warningRule.conditionExpression.field
                        : null) ??
                      config.countFieldKey ??
                      null;
                    const thresholdField = config.fields.find((field) => field.key === thresholdFieldKey);
                    const supportsQuickEdit =
                      numericRules.length > 0 &&
                      thresholdFieldKey !== null &&
                      (highRule || warningRule);

                    return (
                      <div key={`${config.method}-${configIndex}`} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-medium">{config.method}</div>
                            <div className="text-xs text-muted-foreground">
                              {thresholdField
                                ? `Threshold field: ${thresholdField.label}`
                                : "No numeric threshold field detected"}
                            </div>
                          </div>
                          <Badge variant={config.active ? "secondary" : "outline"}>
                            {config.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>

                        {supportsQuickEdit ? (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`warning-threshold-${configIndex}`}>Warning Threshold</Label>
                              <Input
                                id={`warning-threshold-${configIndex}`}
                                type="number"
                                value={String(
                                  typeof warningRule?.conditionExpression?.value === "number"
                                    ? warningRule.conditionExpression.value
                                    : warningRule?.conditionExpression?.value ?? ""
                                )}
                                onChange={(e) => {
                                  const nextValue = e.target.value === "" ? "" : Number(e.target.value);
                                  updateObservationConfigs((configs) =>
                                    configs.map((item, index) => {
                                      if (index !== configIndex) return item;
                                      return {
                                        ...item,
                                        severityRules: item.severityRules.map((rule) =>
                                          rule.severity === "WARNING" && rule.conditionKind === "NUMERIC"
                                            ? {
                                                ...rule,
                                                conditionExpression: {
                                                  ...rule.conditionExpression,
                                                  field:
                                                    typeof rule.conditionExpression.field === "string"
                                                      ? rule.conditionExpression.field
                                                      : thresholdFieldKey,
                                                  operator:
                                                    typeof rule.conditionExpression.operator === "string"
                                                      ? rule.conditionExpression.operator
                                                      : ">",
                                                  value: nextValue,
                                                },
                                              }
                                            : rule
                                        ),
                                      };
                                    })
                                  );
                                }}
                              />
                              <p className="text-xs text-muted-foreground">
                                Reports above this value will be marked as warning.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`high-threshold-${configIndex}`}>High Threshold</Label>
                              <Input
                                id={`high-threshold-${configIndex}`}
                                type="number"
                                value={String(
                                  typeof highRule?.conditionExpression?.value === "number"
                                    ? highRule.conditionExpression.value
                                    : highRule?.conditionExpression?.value ?? ""
                                )}
                                onChange={(e) => {
                                  const nextValue = e.target.value === "" ? "" : Number(e.target.value);
                                  updateObservationConfigs((configs) =>
                                    configs.map((item, index) => {
                                      if (index !== configIndex) return item;
                                      return {
                                        ...item,
                                        severityRules: item.severityRules.map((rule) =>
                                          rule.severity === "HIGH" && rule.conditionKind === "NUMERIC"
                                            ? {
                                                ...rule,
                                                conditionExpression: {
                                                  ...rule.conditionExpression,
                                                  field:
                                                    typeof rule.conditionExpression.field === "string"
                                                      ? rule.conditionExpression.field
                                                      : thresholdFieldKey,
                                                  operator:
                                                    typeof rule.conditionExpression.operator === "string"
                                                      ? rule.conditionExpression.operator
                                                      : ">",
                                                  value: nextValue,
                                                },
                                              }
                                            : rule
                                        ),
                                      };
                                    })
                                  );
                                }}
                              />
                              <p className="text-xs text-muted-foreground">
                                Reports above this value will be marked as high.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Quick threshold editing is available for numeric severity rules. Use the JSON editor
                            below for categorical or more advanced rule setups.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Add an observation config to edit thresholds.
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2">
              <Label htmlFor="observation-config-json">Observation Config JSON</Label>
              <Textarea
                id="observation-config-json"
                value={observationConfigsJson}
                onChange={(e) => setObservationConfigsJson(e.target.value)}
                className="min-h-[240px] font-mono text-xs sm:min-h-[320px]"
              />
              <p className="text-xs text-muted-foreground">
                Include observation methods, fields, derived definitions, and severity rules. This internal editor is intentionally compact for phase 1.
              </p>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-4 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
