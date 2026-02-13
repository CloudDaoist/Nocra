import React from "react";
import { cn } from "@/lib/utils";
import { Book, Compass, Settings } from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  version?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, version }) => {
  const tabs = [
    { id: "library", label: "Library", icon: Book },
    { id: "browse", label: "Browse", icon: Compass },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="w-64 bg-card/30 border-r border-border flex flex-col p-4 pt-14 shrink-0">
      <div className="flex items-center gap-3 px-4 mb-10">
        <div className="w-10 h-10 flex items-center justify-center">
          <img src="src/assets/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
        </div>
        <div className="text-xl font-bold text-foreground tracking-tight">
          Nocra
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-sm font-medium transition-all duration-200 group relative",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={18} className={cn("transition-transform group-hover:scale-110", isActive && "text-primary")} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute left-0 w-1 h-5 bg-primary rounded-r-full" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-6 border-t border-border/50">
        <div className="bg-muted/50 rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Status</p>
          <div className="flex items-center gap-2 text-xs text-foreground font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Ready
          </div>
        </div>
        <div className="mt-4 text-[10px] text-muted-foreground text-center opacity-40">
          v{version || '1.1.0'}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
