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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";

export default function UsersPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  // Invite User State
  const utils = api.useUtils();
  const { data: users, isLoading } = api.users.getAll.useQuery();
  const { data: organizations } = api.organizations.getAll.useQuery();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteOrgId, setInviteOrgId] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<"org_admin" | "officer">("org_admin");

  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [createdLink, setCreatedLink] = useState("");

  const inviteUser = api.invites.create.useMutation({
    onSuccess: (data) => {
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteOrgId("");
      void utils.users.getAll.invalidate();
      
      if (data.inviteLink) {
          setCreatedLink(data.inviteLink);
          setShowLinkDialog(true);
          toast.success("User invited! Email failed, but link generated.");
      } else {
          toast.success("Invitation sent successfully!");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteOrgId) {
        toast.error("Please select an organization");
        return;
    }
    
    inviteUser.mutate({
      email: inviteEmail,
      fullName: inviteName,
      orgId: inviteOrgId,
      role: inviteRole,
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Field Officers</h1>
        
        {/* Invite User Dialog */}
        <Dialog open={inviteOpen} onOpenChange={(open) => {
          setInviteOpen(open);
          if (open) {
            void utils.organizations.getAll.invalidate();
          }
        }}>
          <DialogTrigger asChild>
            <Button>Invite New User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInviteSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteName">Full Name</Label>
                <Input
                  id="inviteName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="inviteOrg">Organization</Label>
                <Select value={inviteOrgId} onValueChange={setInviteOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

               <div className="space-y-2">
                <Label htmlFor="inviteRole">Role</Label>
                <Select value={inviteRole} onValueChange={(val: "org_admin" | "officer") => setInviteRole(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org_admin">Organization Admin</SelectItem>
                    <SelectItem value="officer">Field Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={inviteUser.isPending}>
                {inviteUser.isPending ? "Inviting..." : "Send Invitation"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Copy Link Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Link Generated</DialogTitle>
              <div className="text-sm text-gray-500">
                The email could not be sent (likely rate limited). Copy this link and send it to the user manually.
              </div>
            </DialogHeader>
            <div className="flex items-center space-x-2 pb-4">
              <Input value={createdLink} readOnly />
              <Button size="sm" onClick={() => {
                  navigator.clipboard.writeText(createdLink);
                  toast.success("Link copied!");
              }}>
                Copy
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Identity</th>
              <th className="px-4 py-2 text-left">Organization</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : users?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No users found. Invite one to get started.
                </td>
              </tr>
            ) : (
              users?.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{user.fullName}</td>
                  <td className="px-4 py-3">
                    {user.email ? (
                        <div className="flex flex-col">
                            <span className="text-gray-900">{user.email}</span>
                            <span className="text-xs text-blue-600 bg-blue-50 w-fit px-1 rounded">Dashboard User</span>
                        </div>
                    ) : user.phoneNumber ? (
                        <div className="flex flex-col">
                             <span className="text-gray-900">{user.phoneNumber}</span>
                             <span className="text-xs text-orange-600 bg-orange-50 w-fit px-1 rounded">WhatsApp Bot</span>
                        </div>
                    ) : (
                        <span className="text-gray-400 italic">No Identity</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {user.organization?.name || "N/A"}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    <span className={`px-2 py-1 rounded text-xs border ${
                        user.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        user.role === 'org_admin' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                        {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                        user.status === "PENDING" ? "bg-yellow-100 text-yellow-800 animate-pulse" :
                        "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.email && (
                        <ResendButton email={user.email} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResendButton({ email }: { email: string }) {
    const utils = api.useUtils();
    const resend = api.invites.resend.useMutation({
        onSuccess: () => {
            toast.success(`Invite resent to ${email}`);
        },
        onError: (err) => {
            toast.error(err.message);
        }
    });

    return (
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => resend.mutate({ email })}
            disabled={resend.isPending}
            className="text-xs h-7"
        >
            {resend.isPending ? "Sending..." : "Resend Invite"}
        </Button>
    )
}
