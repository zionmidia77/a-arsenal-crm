import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Eye } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Draggable } from "@hello-pangea/dnd";
import TagManager from "@/components/admin/TagManager";

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
}

const KanbanCard = ({ client, index }: KanbanCardProps) => {
  const navigate = useNavigate();

  return (
    <Draggable draggableId={client.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`rounded-xl border border-border/50 bg-card p-3 space-y-2 transition-shadow ${
            snapshot.isDragging ? "shadow-xl ring-2 ring-primary/30 rotate-2 scale-105" : "shadow-sm hover:shadow-md"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
              {tempEmoji[client.temperature]}
            </span>
            <span className="text-sm font-medium truncate flex-1">{client.name}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums font-mono">{client.lead_score}pts</span>
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
