import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import consultantAvatar from "@/assets/consultant-avatar.png";

const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    className="flex items-end gap-2.5 mb-4"
  >
    <Avatar className="h-8 w-8 border border-primary/30 shrink-0">
      <AvatarImage src={consultantAvatar} alt="Consultor" />
      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">L</AvatarFallback>
    </Avatar>
    <div className="glass-card px-4 py-3.5 flex gap-1.5 rounded-2xl rounded-bl-sm">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground"
          style={{
            animation: "typing-bounce 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  </motion.div>
);

export default TypingIndicator;
