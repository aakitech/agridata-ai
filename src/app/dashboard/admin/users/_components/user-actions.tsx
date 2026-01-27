"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Pencil, Trash2, Loader2 } from "lucide-react";

interface UserActionsProps {
  user: {
    id: string;
    fullName: string | null;
    phoneNumber: string | null;
    email: string | null;
    role: "super_admin" | "org_admin" | "officer";
    status: "ACTIVE" | "PENDING" | "SUSPENDED";
    orgId: string;
  };
  organizations: { id: string; name: string }[] | undefined;
  currentUserId: string | undefined;
}

export function UserActions({ user, organizations, currentUserId }: UserActionsProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Prevent editing/deleting yourself
  if (user.id === currentUserId) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowEdit(true)}
        className="h-8 w-8 text-muted-foreground hover:text-primary"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowDelete(true)}
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {showEdit && (
        <EditUserDialog 
            open={showEdit} 
            onOpenChange={setShowEdit} 
            user={user} 
            organizations={organizations} 
        />
      )}
      
      {showDelete && (
        <DeleteUserDialog 
            open={showDelete} 
            onOpenChange={setShowDelete} 
            user={user} 
        />
      )}
    </div>
  );
}

function EditUserDialog({ 
    open, 
    onOpenChange, 
    user, 
    organizations 
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void;
    user: UserActionsProps["user"];
    organizations: UserActionsProps["organizations"];
}) {
    const utils = api.useUtils();
    const [name, setName] = useState(user.fullName || "");
    // Strip whatsapp: prefix for editing
    const [phone, setPhone] = useState(user.phoneNumber?.replace("whatsapp:", "") || "");
    const [orgId, setOrgId] = useState(user.orgId);
    const [role, setRole] = useState(user.role);
    const [status, setStatus] = useState(user.status);

    const update = api.users.update.useMutation({
        onSuccess: () => {
            toast.success("User updated successfully");
            void utils.users.getAll.invalidate();
            onOpenChange(false);
        },
        onError: (err) => {
            toast.error(err.message);
        }
    });

    const isBotUser = !!user.phoneNumber;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>
                        Modify user details. Changes take effect immediately.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    
                    {isBotUser && (
                         <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input 
                                value={phone} 
                                onChange={(e) => {
                                    // Automatically remove spaces and prefix if pasted
                                    const val = e.target.value.trim().replace(/\s+/g, "").replace(/^whatsapp:/i, "");
                                    setPhone(val);
                                }} 
                            />
                            <p className="text-xs text-muted-foreground">Changing this will move the account to the new number. (e.g. +263...)</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Organization</Label>
                        <Select value={orgId} onValueChange={setOrgId}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {organizations?.map((org) => (
                                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={(val: any) => setRole(val)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="org_admin">Org Admin</SelectItem>
                                <SelectItem value="officer">Field Officer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={() => {
                            // Final cleanup before submission
                            const cleanPhone = phone.trim().replace(/\s+/g, "").replace(/^whatsapp:/i, "");
                            
                            if (isBotUser && !cleanPhone.startsWith("+")) {
                                toast.error("Phone number must start with +");
                                return;
                            }
                            
                            update.mutate({ 
                                id: user.id, 
                                fullName: name, 
                                phoneNumber: isBotUser ? cleanPhone : undefined, 
                                orgId, 
                                role, 
                                status 
                            });
                        }}
                        disabled={update.isPending}
                    >
                        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteUserDialog({ 
    open, 
    onOpenChange, 
    user 
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void;
    user: UserActionsProps["user"];
}) {
    const utils = api.useUtils();
    const deleteUser = api.users.delete.useMutation({
         onSuccess: () => {
             toast.success("User deleted successfully");
             void utils.users.getAll.invalidate();
             onOpenChange(false);
         },
         onError: (err) => {
             toast.error(err.message);
         }
     });
 
     return (
         <Dialog open={open} onOpenChange={onOpenChange}>
             <DialogContent>
                 <DialogHeader>
                     <DialogTitle className="text-destructive">Delete User</DialogTitle>
                     <DialogDescription>
                         Are you sure you want to delete <strong>{user.fullName}</strong>? 
                         This action cannot be undone.
                     </DialogDescription>
                 </DialogHeader>
                 
                 <div className="py-4 text-sm text-muted-foreground bg-destructive/10 p-3 rounded-md border border-destructive/20 text-destructive-foreground">
                    Warning: Deletion will only succeed if the user has no reports, sessions, or other dependent data.
                 </div>
 
                 <DialogFooter>
                     <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                     <Button 
                         variant="destructive"
                         onClick={() => deleteUser.mutate({ id: user.id })}
                         disabled={deleteUser.isPending}
                     >
                         {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                         Delete User
                     </Button>
                 </DialogFooter>
             </DialogContent>
         </Dialog>
     );
 }
