import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Truck, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  DollarSign,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LoadGeneralStatus } from '../types';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  trend?: string;
  color?: string;
}

function StatCard({ title, value, icon: Icon, description, trend, color = 'indigo' }: StatCardProps) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
  };

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.indigo} border`}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {(description || trend) && (
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
            {trend && <span className="font-semibold text-emerald-600">{trend}</span>}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    todayLoads: 0,
    weekLoads: 0,
    pendingRequests: 0,
    delayedLoads: 0,
    monthlyRevenue: 0,
    monthlyCmv: 0,
  });

  useEffect(() => {
    // In a real app, these would be separate queries or a cloud function
    // For MVP, we'll just simulate or do simple counts
    const fetchStats = async () => {
      // Simulate fetching
      setStats({
        todayLoads: 4,
        weekLoads: 28,
        pendingRequests: 7,
        delayedLoads: 2,
        monthlyRevenue: 450000,
        monthlyCmv: 280000,
      });
    };

    fetchStats();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 capitalize">Bem-vindo, {profile?.name.split(' ')[0]}</h1>
          <p className="text-zinc-500">Resumo da operação da Central de Cargas hoje.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-lg border border-zinc-200 shadow-sm flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="w-4 h-4 text-zinc-400" />
            {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Cargas do Dia" 
          value={stats.todayLoads} 
          icon={Truck} 
          description="programadas para hoje"
          color="indigo"
        />
        <StatCard 
          title="Cargas da Semana" 
          value={stats.weekLoads} 
          icon={TrendingUp} 
          description="+12% em relação à última"
          trend="↑"
          color="blue"
        />
        <StatCard 
          title="Solicitações Pendentes" 
          value={stats.pendingRequests} 
          icon={Clock} 
          description="aguardando aprovação"
          color="amber"
        />
        <StatCard 
          title="Cargas em Atraso" 
          value={stats.delayedLoads} 
          icon={AlertTriangle} 
          description="requerem atenção imediata"
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Faturamento Est. (Mês)" 
          value={formatCurrency(stats.monthlyRevenue)} 
          icon={DollarSign} 
          color="emerald"
        />
        <StatCard 
          title="CMV Total (Mês)" 
          value={formatCurrency(stats.monthlyCmv)} 
          icon={Package} 
          color="blue"
        />
        <StatCard 
          title="Margem Est. (Mês)" 
          value={formatCurrency(stats.monthlyRevenue - stats.monthlyCmv)} 
          icon={TrendingUp} 
          description={`${((stats.monthlyRevenue - stats.monthlyCmv) / stats.monthlyRevenue * 100).toFixed(1)}% de margem`}
          color="emerald"
        />
        <StatCard 
          title="Frete Médio" 
          value={formatCurrency(1200)} 
          icon={Truck} 
          description="por carga"
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm h-[400px]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Cargas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-zinc-500 text-sm italic py-12 text-center">
              Sem cargas registradas no momento.
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm h-[400px]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Checklist Operacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-100">
               <div className="flex items-center gap-3">
                 <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                 <span className="text-sm font-medium">Separação</span>
               </div>
               <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">OK</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-100 opacity-60">
               <div className="flex items-center gap-3">
                 <CheckCircle2 className="w-5 h-5 text-zinc-300" />
                 <span className="text-sm font-medium">Etiquetagem</span>
               </div>
               <span className="text-xs font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded">PENDENTE</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-100 opacity-60">
               <div className="flex items-center gap-3">
                 <CheckCircle2 className="w-5 h-5 text-zinc-300" />
                 <span className="text-sm font-medium">Emissão de NF</span>
               </div>
               <span className="text-xs font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded">PENDENTE</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
