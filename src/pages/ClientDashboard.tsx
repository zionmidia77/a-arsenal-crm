import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRightLeft, DollarSign, TrendingUp, Calculator, ChevronRight, Bell, Bike } from "lucide-react";

const alerts = [
  { text: "Sua moto está valorizada! Bom momento pra troca 🔥", icon: TrendingUp },
  { text: "Você pode melhorar sua parcela em R$ 45/mês", icon: DollarSign },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const ClientDashboard = () => {
  const navigate = useNavigate();
  const clientName = "Lucas";

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <motion.h1 {...fadeUp} transition={{ delay: 0.1 }} className="text-2xl font-display font-bold">
            Fala, {clientName} 👋
          </motion.h1>
          <p className="text-sm text-muted-foreground mt-1">Sua central Arsenal Motors</p>
        </div>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </Button>
      </div>

      {/* Alerts */}
      <div className="px-5 space-y-2 mb-5">
        {alerts.map((alert, i) => (
          <motion.div key={i} {...fadeUp} transition={{ delay: 0.2 + i * 0.1 }} className="glass-card px-4 py-3 flex items-center gap-3 border-primary/20">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <alert.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-foreground/90 flex-1">{alert.text}</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        ))}
      </div>

      {/* Cards */}
      <div className="px-5 space-y-4">
        {/* Valor da moto */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bike className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">Valor da sua moto</span>
          </div>
          <p className="text-3xl font-display font-bold text-gradient">R$ 18.500 - R$ 22.000</p>
          <p className="text-xs text-muted-foreground mt-1">Valor estimado atual de mercado</p>
        </motion.div>

        {/* Dinheiro disponível */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-sm text-muted-foreground">Dinheiro disponível</span>
          </div>
          <p className="text-3xl font-display font-bold">R$ 8.500</p>
          <p className="text-xs text-muted-foreground mt-1">Você pode liberar até esse valor</p>
          <Button onClick={() => navigate("/simulator")} className="mt-4 w-full rounded-xl glow-red">
            Simular agora
          </Button>
        </motion.div>

        {/* Progresso */}
        <motion.div {...fadeUp} transition={{ delay: 0.5 }} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Seu progresso</span>
            <span className="text-sm font-semibold text-primary">18 / 36</span>
          </div>
          <Progress value={50} className="h-2.5 bg-secondary" />
          <p className="text-xs text-muted-foreground mt-2">Você já pagou 18 de 36 parcelas 🎯</p>
        </motion.div>

        {/* Oportunidade */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }} className="glass-card p-5 border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Momento pra troca!</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Sua moto tá num ótimo momento. Condições especiais disponíveis.</p>
          <Button variant="outline" className="w-full rounded-xl border-primary/30 hover:bg-primary hover:text-primary-foreground">
            Ver opções <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </motion.div>
      </div>

      {/* Fixed bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border/50 px-5 py-3 z-20">
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: ArrowRightLeft, label: "Trocar" },
            { icon: DollarSign, label: "Vender" },
            { icon: TrendingUp, label: "Dinheiro" },
            { icon: Calculator, label: "Simular", route: "/simulator" },
          ].map((item, i) => (
            <Button
              key={i}
              variant="ghost"
              onClick={() => item.route && navigate(item.route)}
              className="flex flex-col items-center gap-1 h-auto py-2 hover:bg-primary/10"
            >
              <item.icon className="w-5 h-5 text-primary" />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
