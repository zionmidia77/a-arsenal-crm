import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Eye, AlertCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Draggable } from "@hello-pangea/dnd";
import TagManager from "@/components/admin/TagManager";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const tempBadge: Record<string, string> = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-yellow-500/15 text-yellow-600",
  cold: "bg-blue-500/15 text-blue-500",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempEmoji: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "🔵", frozen: "⚪" };

interface KanbanCardProps {
  client: Tables<"clients">;
  index: number;
  highlight?: boolean;
  chatCount?: number;
  hasActiveChat?: boolean;
  interactionCount?: number;
  compact?: boolean;
}

const KanbanCard = ({ client, index, highlight, chatCount = 0, hasActiveChat = false, interactionCount = 0, compact = false }: KanbanCardProps) => {
  const navigate = useNavigate();

  const noContact = interactionCount === 0 && client.pipeline_stage === "new";

  return (
    <Draggable draggableId={client.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          id={`kanban-card-${client.id}`}
          className={`rounded-xl border bg-card p-3 space-y-2 transition-all ${
            highlight
              ? "ring-2 ring-primary border-primary shadow-lg shadow-primary/20 animate-pulse"
              : "border-border/50 shadow-sm hover:shadow-md"
          } ${snapshot.isDragging ? "shadow-xl ring-2 ring-primary/30 rotate-2 scale-105" : ""}`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
              {tempEmoji[client.temperature]}
            </span>
            <span className="text-sm font-medium truncate flex-1">{client.name}</span>
            <div className="flex items-center gap-1">
              {hasActiveChat && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="relative flex items-center">
                        <MessageCircle className="w-3 h-3 text-primary" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Conversa IA ativa
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {chatCount > 0 && !hasActiveChat && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <MessageCircle className="w-2.5 h-2.5" />
                        {chatCount}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {chatCount} conversa{chatCount > 1 ? "s" : ""} IA
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {noContact && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="w-3 h-3 text-destructive" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Sem contato ainda
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span className="text-[10px] text-muted-foreground tabular-nums font-mono">{client.lead_score}pts</span>
            </div>
          </div>

          {client.interest && (
            <p className="text-[11px] text-muted-foreground truncate">{client.interest}</p>
          )}

          <TagManager clientId={client.id} compact />

          <div className="flex gap-1.5">
            {client.phone && (
              <Button
                size="sm"
                className="h-7 rounded-full text-[10px] gap-1 flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://wa.me/55${client.phone?.replace(/\D/g, "")}`);
                }}
              >
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full text-[10px] gap-1"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/client/${client.id}`);
              }}
            >
              <Eye className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default KanbanCard;
