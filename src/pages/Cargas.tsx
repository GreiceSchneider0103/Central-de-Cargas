import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Load, LoadGeneralStatus, LoadPriority, UserRole } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { 
  Truck, 
  Search, 
  MoreVertical, 
  Plus, 
  Calendar, 
  MapPin, 
  CreditCard,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Cargas() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState<Load[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'loads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Load));
      setLoads(data);
      setIsLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar cargas');
    });

    return unsubscribe;
  }, []);

  const getStatusBadge = (status: LoadGeneralStatus) => {
    const variants: Record<LoadGeneralStatus, { color: string, label: string }> = {
      [LoadGeneralStatus.DRAFT]: { color: 'bg-zinc-100 text-zinc-600', label: 'Rascunho' },
      [LoadGeneralStatus.AWAITING_APPROVAL]: { color: 'bg-amber-100 text-amber-700', label: 'Aguard. Aprovação' },
      [LoadGeneralStatus.APPROVED]: { color: 'bg-indigo-100 text-indigo-700', label: 'Aprovada' },
      [LoadGeneralStatus.AWAITING_SUPPLIER]: { color: 'bg-orange-100 text-orange-700', label: 'Aguard. Fornecedor' },
      [LoadGeneralStatus.ORDER_PLACED]: { color: 'bg-blue-100 text-blue-700', label: 'Pedido Realizado' },
      [LoadGeneralStatus.ORDER_CONFIRMED]: { color: 'bg-cyan-100 text-cyan-700', label: 'Pedido Confirmado' },
      [LoadGeneralStatus.AWAITING_RECEIVING]: { color: 'bg-purple-100 text-purple-700', label: 'Aguard. Recebimento' },
      [LoadGeneralStatus.PRODUCT_RECEIVED]: { color: 'bg-emerald-100 text-emerald-700', label: 'Produto Recebido' },
      [LoadGeneralStatus.PREPARING]: { color: 'bg-indigo-50 text-indigo-600', label: 'Em Preparação' },
      [LoadGeneralStatus.SEPARATING]: { color: 'bg-amber-50 text-amber-600', label: 'Separando' },
      [LoadGeneralStatus.LABELLING]: { color: 'bg-blue-50 text-blue-600', label: 'Etiquetando' },
      [LoadGeneralStatus.AWAITING_NF]: { color: 'bg-orange-50 text-orange-600', label: 'Aguardando NF' },
      [LoadGeneralStatus.READY_TO_SCHEDULE]: { color: 'bg-cyan-50 text-cyan-600', label: 'Pronta p/ Agendar' },
      [LoadGeneralStatus.SCHEDULED]: { color: 'bg-emerald-50 text-emerald-600', label: 'Agendada' },
      [LoadGeneralStatus.READY_TO_COLLECT]: { color: 'bg-emerald-100 text-emerald-800', label: 'Pronta p/ Coleta' },
      [LoadGeneralStatus.LOADED]: { color: 'bg-emerald-600 text-white', label: 'Carregada' },
      [LoadGeneralStatus.IN_TRANSIT]: { color: 'bg-indigo-600 text-white', label: 'Em Trânsito' },
      [LoadGeneralStatus.DELIVERED]: { color: 'bg-zinc-800 text-white', label: 'Entregue' },
      [LoadGeneralStatus.FINISHED]: { color: 'bg-black text-white', label: 'Finalizada' },
      [LoadGeneralStatus.CANCELLED]: { color: 'bg-rose-100 text-rose-700', label: 'Cancelada' },
      [LoadGeneralStatus.WITH_DIVERGENCE]: { color: 'bg-rose-600 text-white', label: 'Com Divergência' },
    };

    const config = variants[status] || { color: 'bg-zinc-100 text-zinc-600', label: status };
    return (
      <Badge className={`${config.color} border-none font-semibold text-[10px] uppercase tracking-wider`}>
        {config.label}
      </Badge>
    );
  };

  const filteredLoads = loads.filter(l => 
    l.internalCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.marketplaceLoadNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.observations?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cargas</h1>
          <p className="text-sm text-zinc-500">Controle operacional e financeiro de todas as cargas</p>
        </div>
        
        <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-indigo-100 shadow-lg">
          <Plus className="w-4 h-4 mr-2" />
          Nova Carga Direta
        </Button>
      </header>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-white border-b border-zinc-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-zinc-50 border-none shadow-none text-xs font-semibold uppercase tracking-wider h-8">Filtros</Button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              placeholder="Buscar por código ou ref..." 
              className="pl-10 h-10 bg-zinc-50 border-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow>
                <TableHead className="w-[180px]">Cód. Interno / Mkt</TableHead>
                <TableHead>Tipo / Destino</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Agenda</TableHead>
                <TableHead>Financeiro</TableHead>
                <TableHead className="text-right">Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">Carregando cargas...</TableCell>
                </TableRow>
              ) : filteredLoads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-zinc-500 italic">Nenhuma carga encontrada.</TableCell>
                </TableRow>
              ) : filteredLoads.map((load) => (
                <TableRow 
                  key={load.id} 
                  className="group hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/cargas/${load.id}`)}
                >
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-bold text-indigo-600">{load.internalCode}</span>
                      {load.marketplaceLoadNumber && (
                        <span className="text-[10px] text-zinc-400 font-medium">#{load.marketplaceLoadNumber}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-zinc-900">{load.type === 'LOJA_FISICA' ? 'Loja Física' : 'Full Marketplace'}</span>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase font-bold tracking-tight">
                        <MapPin className="w-2.5 h-2.5" />
                        Placeholder Destino
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(load.status)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        {load.scheduledAt ? new Date(load.scheduledAt.seconds * 1000).toLocaleDateString('pt-BR') : 'A definir'}
                      </div>
                      {load.priority === LoadPriority.URGENT && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 border-red-200 bg-red-50 text-red-600 w-fit">URGENTE</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-emerald-600">{formatCurrency(load.estimatedRevenue)}</span>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium italic">
                        <CreditCard className="w-2.5 h-2.5" />
                        CMV: {formatCurrency(load.totalCmv)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-medium">Responsável</span>
                        <span className="text-[10px] text-zinc-400">Placeholder ID</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
