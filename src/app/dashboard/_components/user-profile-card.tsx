"use client";

import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { 
  LogOut, 
  Building2, 
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { logout } from "../../login/actions";
import { Separator } from "~/components/ui/separator";

interface UserProfileCardProps {
  user: {
    fullName: string | null;
    email: string | null;
    role: string;
    organization?: {
      name: string;
    } | null;
  };
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const initials = user.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "CN";

  return (
    <div className="w-80 p-0 overflow-hidden bg-card border-none shadow-none">
      <div className="p-4 bg-primary/5 border-b flex flex-col items-center gap-3">
        <div className="relative group">
          <Avatar className="h-20 w-20 border-4 border-background shadow-xl">
            <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 border-2 border-background shadow-sm" title="Online" />
        </div>
        
        <div className="text-center space-y-1">
          <h4 className="font-bold text-lg leading-tight">{user.fullName}</h4>
          <p className="text-xs text-muted-foreground font-medium">{user.email}</p>
          <div className="pt-2 flex justify-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-tight h-5">
              {user.role.replace("_", " ")}
            </Badge>
            {user.organization && (
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight h-5 bg-background">
                {user.organization.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="p-2 space-y-1">
        {user.role === "super_admin" && (
          <Button variant="ghost" className="w-full justify-between h-10 px-3 text-sm font-medium group transition-all" asChild>
            <div className="cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <span className="group-hover:translate-x-0.5 transition-transform">Admin Panel</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
          </Button>
        )}
      </div>

      <Separator />

      <div className="p-2">
        <form action={logout}>
          <Button 
            variant="ghost" 
            type="submit"
            className="w-full justify-start h-10 px-3 text-sm font-medium text-destructive hover:text-destructive hover:bg-destructive/5 group transition-all"
          >
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
              <LogOut className="h-4.5 w-4.5" />
            </div>
            Sign Out
          </Button>
        </form>
      </div>
      
      <div className="p-3 bg-muted/30 border-t flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
        <span>AgriData Technologies v1.0</span>
        <div className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
          Support <ExternalLink className="h-2.5 w-2.5" />
        </div>
      </div>
    </div>
  );
}
