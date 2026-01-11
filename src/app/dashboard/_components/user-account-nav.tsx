"use client";

import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "~/components/ui/popover";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { UserProfileCard } from "./user-profile-card";
import { cn } from "~/lib/utils";

interface UserAccountNavProps {
  user: {
    fullName: string | null;
    email: string | null;
    role: string;
    organization?: {
      name: string;
    } | null;
  };
  showLabel?: boolean;
  side?: "top" | "bottom" | "left" | "right";
}

export function UserAccountNav({ user, showLabel = false, side = "bottom" }: UserAccountNavProps) {
  const initials = user.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "CN";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={cn(
            "flex items-center gap-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            showLabel ? "px-3 py-1.5 hover:bg-muted" : "h-10 w-10 justify-center"
          )}
        >
          <div className="relative group">
            <Avatar className="h-9 w-9 border-2 border-primary/20 group-hover:border-primary transition-colors">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
          </div>
          
          {showLabel && (
            <div className="flex flex-col items-start gap-0.5 pr-2">
              <span className="text-sm font-bold leading-none">{user.fullName}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                {user.role.replace("_", " ")}
              </span>
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border-none shadow-2xl mr-4" align="end" side={side} sideOffset={16}>
        <UserProfileCard user={user} />
      </PopoverContent>
    </Popover>
  );
}
