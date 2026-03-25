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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pest Configuration" : "Add Pest Configuration"}</DialogTitle>
            <DialogDescription>
              Phase-1 editor for pest config records. Top-level settings are form-based. Observation methods, fields, and rules are edited as structured JSON.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
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

          <div className="space-y-2">
            <Label htmlFor="observation-config-json">Observation Config JSON</Label>
            <Textarea
              id="observation-config-json"
              value={observationConfigsJson}
              onChange={(e) => setObservationConfigsJson(e.target.value)}
              className="min-h-[320px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Include observation methods, fields, derived definitions, and severity rules. This internal editor is intentionally compact for phase 1.
            </p>
          </div>

          <DialogFooter>
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
