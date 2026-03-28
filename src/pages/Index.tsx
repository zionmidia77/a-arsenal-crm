import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bike, ArrowRight, Shield, Zap, Users } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mb-8 glow-red animate-pulse-glow">
          <Bike className="w-10 h-10 text-primary" />
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-4xl md:text-5xl font-display font-bold mb-4">
          Arsenal <span className="text-gradient">Motors</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-muted-foreground text-lg mb-10 max-w-md">
          Sua próxima moto está a uma conversa de distância
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="w-full max-w-sm space-y-3">
          <Button onClick={() => navigate("/chat")} className="w-full h-14 rounded-2xl text-base font-semibold glow-red gap-2">
            Começar agora <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex gap-3">
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="flex-1 h-12 rounded-xl border-border/50">
              Área do cliente
            </Button>
            <Button onClick={() => navigate("/admin")} variant="outline" className="flex-1 h-12 rounded-xl border-border/50">
              CRM Admin
            </Button>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="grid grid-cols-3 gap-6 mt-16 max-w-md">
          {[
            { icon: Zap, label: "Rápido" },
            { icon: Shield, label: "Seguro" },
            { icon: Users, label: "Pessoal" },
          ].map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <f.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
