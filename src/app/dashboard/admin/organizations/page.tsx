
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";

export default function OrganizationsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");

  const utils = api.useUtils();
  const { data: organizations, isLoading } = api.organizations.getAll.useQuery();
  const { data: readiness } = api.organizations.getAllReadiness.useQuery();
  const readinessByOrgId = new Map(
    readiness?.map((item) => [item.organization.id, item]) ?? []
  );

  const createOrg = api.organizations.create.useMutation({
    onSuccess: () => {
      toast.success("Organization created successfully");
      setIsOpen(false);
      setName("");
      void utils.organizations.getAll.invalidate();
      void utils.organizations.getAllReadiness.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrg.mutate({ name });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Create Organization</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Organization</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. MPBC"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={createOrg.isPending}>
                {createOrg.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Slug</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : organizations?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No organizations found.
                </td>
              </tr>
            ) : (
              organizations?.map((org) => {
                const orgReadiness = readinessByOrgId.get(org.id);
                const failedChecks =
                  orgReadiness?.checks.filter((check) => !check.ok) ?? [];

                return (
                  <tr key={org.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{org.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{org.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{org.slug}</td>
                    <td className="px-4 py-3">
                      <span className="rounded border bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700">
                        {org.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {orgReadiness?.isOperationallyReady ? (
                        <span className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          Ready for test
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            Needs setup
                          </span>
                          {failedChecks.length > 0 && (
                            <p className="max-w-md text-xs text-gray-500">
                              Missing: {failedChecks.map((check) => check.label).join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
