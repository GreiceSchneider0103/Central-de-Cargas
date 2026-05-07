import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Load, LoadItem, LoadChecklist, LoadGeneralStatus, LoadPriority, UserRole } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  ArrowLeft, 
  Truck, 
  Calendar, 
  MapPin, 
  Package, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  History,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function CargaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [load, setLoad] = useState<Load | null>(null);
  const [items, setItems] = useState<LoadItem[]>([]);
  const [checklist, setChecklist] = useState<LoadChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const unsubLoad = onSnapshot(doc(db, 'loads', id), (doc) => {
      if (doc.exists()) {
        setLoad({ id: doc.id, ...doc.data() } as Load);
      } else {
        toast.error('Carga não encontrada');
        navigate('/cargas');
      }
      setIsLoading(false);
    });

    const unsubItems = onSnapshot(query(collection(db, 'loads', id, 'items')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoadItem));
      setItems(data);
    });

    // In a real app, checklist would be a separate doc or subcollection
    // For MVP, we can simulate or use a specific doc
    const unsubChecklist = onSnapshot(doc(db, 'load_checklists', id), (doc) => {
      if (doc.exists()) {
        setChecklist({ id: doc.id, ...doc.data() } as LoadChecklist);
      }
    });

    return () => {
      unsubLoad();
      unsubItems();
      unsubChecklist();
    };
  }, [id, navigate]);

  const handleUpdateChecklist = async (field: keyof LoadChecklist, value: boolean) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'load_checklists', id), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
      toast.success('Checklist atualizado');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar checklist');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (isLoading) return <div className="p-20 text-center text-zinc-500">Carregando detalhes da carga...</div>;
  if (!load) return null;

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cargas')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{load.internalCode}</h1>
              <Badge variant="outline" className="text-zinc-500 font-mono text-[10px]">#{load.id.substring(0, 8)}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-zinc-500">
              <span className="flex items-center gap-1"><Truck className="w-4 h-4" /> {load.type}</span>
              <span className="flex items-center gap-1 border-l pl-4 border-zinc-200 uppercase font-semibold text-[10px] tracking-wider text-indigo-600">MODIFIKA</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 border-zinc-200">Editar</Button>
          <Button className="h-10 bg-indigo-600 hover:bg-indigo-700">Finalizar Carga</Button>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">Informações Gerais</CardTitle>
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                load.status === LoadGeneralStatus.FINISHED ? "bg-black text-white" : "bg-indigo-100 text-indigo-700"
              )}>
                {load.status}
              </div>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Nº Carga Marketplace</span>
                  <span className="text-sm font-mono font-bold text-zinc-900">{load.marketplaceLoadNumber || 'N/A'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Cód. Agendamento</span>
                  <span className="text-sm font-mono font-bold text-zinc-900">{load.scheduleCode || 'N/A'}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Origem</span>
                  <span className="text-sm font-bold flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-zinc-400" /> CD Matriz</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Destino</span>
                  <span className="text-sm font-bold flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-500" /> Mercado Livre - Cajamar</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Agenda</span>
                  <span className="text-sm font-bold flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-zinc-400" /> {load.scheduledAt ? new Date(load.scheduledAt.seconds * 1000).toLocaleString('pt-BR') : 'A definir'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Prioridade</span>
                  <Badge variant="outline" className={cn(
                    "w-fit font-bold",
                    load.priority === LoadPriority.URGENT ? "border-red-200 bg-red-50 text-red-600" : "border-zinc-200 text-zinc-600"
                  )}>{load.priority}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">Itens da Carga</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">CMV Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-[10px] font-bold text-indigo-600">{item.sku}</TableCell>
                      <TableCell className="text-sm font-medium">{item.productName}</TableCell>
                      <TableCell className="text-center text-sm font-bold">{item.quantity}</TableCell>
                      <TableCell className="text-xs text-zinc-500 font-medium">Placeholder Forn.</TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm">{formatCurrency(item.totalCmv)}</TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-zinc-400 italic text-sm">Sem produtos vinculados.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* Checklist Card */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-zinc-950 text-white py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Checklist Operacional
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {[
                { label: 'Pedido Realizado', key: 'orderPlaced' },
                { label: 'Pedido Confirmado', key: 'orderConfirmed' },
                { label: 'Produto Recebido', key: 'productReceived' },
                { label: 'Carga Montada', key: 'mounted' },
                { label: 'Agenda Confirmada', key: 'scheduled' },
                { label: 'Etiqueta Impressa', key: 'labelPrinted' },
                { label: 'Carga Separada', key: 'separated' },
                { label: 'Carga Etiquetada', key: 'labelled' },
                { label: 'NF Emitida', key: 'nfIssued' },
                { label: 'Carga Carregada', key: 'loaded' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <Label htmlFor={item.key} className="text-sm font-medium cursor-pointer">{item.label}</Label>
                  <Checkbox 
                    id={item.key} 
                    checked={(checklist as any)?.[item.key] || false}
                    onCheckedChange={(val) => handleUpdateChecklist(item.key as keyof LoadChecklist, !!val)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Financial Card */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-emerald-600 text-white py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Financeiro Estimado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Faturamento Est.</span>
                <p className="text-xl font-bold tracking-tight">{formatCurrency(load.estimatedRevenue)}</p>
              </div>
              <Separator className="bg-zinc-100" />
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">CMV Total</span>
                    <p className="text-sm font-bold">{formatCurrency(load.totalCmv)}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Frete</span>
                    <p className="text-sm font-bold">{formatCurrency(load.freightCost)}</p>
                 </div>
              </div>
              <Separator className="bg-zinc-100" />
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Margem Est.</span>
                  <Badge className="bg-emerald-600 border-none font-bold">{load.estimatedMarginPercent}%</Badge>
                </div>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(load.estimatedMarginValue)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Footer details like comments/history would go here */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm overflow-hidden">
           <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-4 flex flex-row items-center gap-2">
              <MessageSquare className="w-4 h-4 text-zinc-400" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">Comentários e Observações</CardTitle>
           </CardHeader>
           <CardContent className="p-6">
              <div className="text-zinc-500 text-sm italic text-center py-6">
                 {load.observations || 'Nenhuma observação informada.'}
              </div>
           </CardContent>
        </Card>

        <Card className="border-none shadow-sm overflow-hidden">
           <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-4 flex flex-row items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">Histórico de Alterações</CardTitle>
           </CardHeader>
           <CardContent className="p-0">
              <div className="p-6 text-zinc-500 text-sm italic text-center">
                 Sem histórico registrado.
              </div>
           </CardContent>
        </Card>
      </div>
    </div>
  );
}
