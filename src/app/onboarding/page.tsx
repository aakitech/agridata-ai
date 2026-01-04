"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgId, setOrgId] = useState("");

  const { data: orgs, isLoading: orgsLoading } = api.organizations.getAll.useQuery();
  const onboard = api.users.onboard.useMutation({
    onSuccess: () => {
      toast.success("Profile created successfully!");
      router.push("/dashboard");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create profile");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !orgId) {
      toast.error("Please fill in all fields");
      return;
    }
    onboard.mutate({ fullName, orgId });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to AgriData AI</CardTitle>
          <CardDescription>
            Please complete your profile to access the dashboard.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={onboard.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org">Organization</Label>
              <Select
                value={orgId}
                onValueChange={setOrgId}
                disabled={orgsLoading || onboard.isPending}
              >
                <SelectTrigger id="org">
                  <SelectValue placeholder={orgsLoading ? "Loading organizations..." : "Select an organization"} />
                </SelectTrigger>
                <SelectContent>
                  {orgs?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={onboard.isPending}
            >
              {onboard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Setup
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
