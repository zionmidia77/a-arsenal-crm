import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Bike, DollarSign, Clock } from "lucide-react";

const Simulator = () => {
  const navigate = useNavigate();
  const [motoValue, setMotoValue] = useState([20000]);
  const [downPayment, setDownPayment] = useState([5000]);
  const [months, setMonths] = useState([36]);

  const financed = motoValue[0] - downPayment[0];
  const rate = 0.019;
  const monthly = financed > 0 ? (financed * rate * Math.pow(1 + rate, months[0])) / (Math.pow(1 + rate, months[0]) - 1) : 0;
  const freeValue = Math.max(0, motoValue[0] * 0.4 - downPayment[0] * 0.1);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display font-bold text-lg">Simulador</h1>
      </div>

      <div className="px-5 py-6 space-y-6">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground text-sm">
          Com sua moto hoje, veja o que é possível 👇
        </motion.p>

        {/* Valor da moto */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-2"><Bike className="w-4 h-4" /> Valor da moto</span>
            <span className="font-display font-bold text-lg">R$ {motoValue[0].toLocaleString("pt-BR")}</span>
          </div>
          <Slider value={motoValue} onValueChange={setMotoValue} min={5000} max={80000} step={1000} className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary" />
        </motion.div>

        {/* Entrada */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="w-4 h-4" /> Entrada</span>
            <span className="font-display font-bold text-lg">R$ {downPayment[0].toLocaleString("pt-BR")}</span>
          </div>
          <Slider value={downPayment} onValueChange={setDownPayment} min={0} max={motoValue[0] * 0.5} step={500} className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary" />
        </motion.div>

        {/* Parcelas */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Parcelas</span>
            <span className="font-display font-bold text-lg">{months[0]}x</span>
          </div>
          <Slider value={months} onValueChange={setMonths} min={12} max={60} step={6} className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary" />
        </motion.div>

        {/* Results */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6 border-primary/20 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Parcela estimada</p>
            <p className="text-4xl font-display font-bold text-gradient">
              R$ {monthly.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">/mês</p>
          </div>
          <div className="h-px bg-border/50" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor liberado</span>
            <span className="font-semibold text-green-400">R$ {freeValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">* Simulação aproximada. Condições sujeitas a análise.</p>
        </motion.div>

        <Button className="w-full rounded-xl h-12 text-base glow-red">
          Quero essa condição 🔥
        </Button>
      </div>
    </div>
  );
};

export default Simulator;
