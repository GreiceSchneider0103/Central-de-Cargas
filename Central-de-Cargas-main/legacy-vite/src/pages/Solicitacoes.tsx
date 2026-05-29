import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadRequest, LoadStatus, LoadPriority, UserRole } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight,
  MoreVertical,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function Solicitacoes() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LoadRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  // Form states
  const [newType, setNewType] = useState<'LOJA_FISICA' | 'FULL_MARKETPLACE'>('LOJA_FISICA');
  const [newCompany, setNewCompany] = useState('');
  const [newPriority, setNewPriority] = useState<LoadPriority>(LoadPriority.MEDIUM);
  const [newDate, setNewDate] = useState('');
  const [newObservations, setNewObservations] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'load_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoadRequest));
      setRequests(data);
      setIsLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar solicitações');
    });

    return unsubscribe;
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const countSnapshot = await getDocs(collection(db, 'load_requests'));
      const nextId = countSnapshot.size + 1;
      const code = `${newType === 'LOJA_FISICA' ? 'LOJA' : 'FULL'}-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;

      await addDoc(collection(db, 'load_requests'), {
        code,
        type: newType,
        companyId: newCompany,
        channelId: 'placeholder', // Ideally selected from a list
        priority: newPriority,
        desiredDate: newDate ? new Date(newDate) : null,
        status: LoadStatus.PENDING,
        requesterId: profile.id,
        observations: newObservations,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Solicitação criada com sucesso!');
      setIsAdding(false);
      // Reset form
      setNewObservations('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar solicitação');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: LoadStatus) => {
    try {
      await updateDoc(doc(db, 'load_requests', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success('Status atualizado');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusBadge = (status: LoadStatus) => {
    const variants: Record<LoadStatus, { color: string, label: string, icon: any }> = {
      [LoadStatus.PENDING]: { color: 'bg-amber-100 text-amber-700', label: 'Pendente', icon: Clock },
      [LoadStatus.ANALYSIS]: { color: 'bg-blue-100 text-blue-700', label: 'Em Análise', icon: Search },
      [LoadStatus.APPROVED]: { color: 'bg-emerald-100 text-emerald-700', label: 'Aprovada', icon: CheckCircle },
      [LoadStatus.REJECTED]: { color: 'bg-rose-100 text-rose-700', label: 'Recusada', icon: XCircle },
      [LoadStatus.ADJUSTMENT_REQUESTED]: { color: 'bg-amber-100 text-amber-700', label: 'Ajuste Sol.', icon: AlertCircle },
      [LoadStatus.TRANSFORMED_TO_LOAD]: { color: 'bg-indigo-100 text-indigo-700', label: 'Virou Carga', icon: Truck },
      [LoadStatus.CANCELLED]: { color: 'bg-zinc-100 text-zinc-700', label: 'Cancelada', icon: XCircle },
    };

    const config = variants[status];
    return (
      <Badge className={`${config.color} border-none flex items-center gap-1 w-fit`}>
        <config.icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.observations?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'ALL' || r.status === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solicitações de Carga</h1>
          <p className="text-sm text-zinc-500">Gerencie e acompanhe as solicitações internas</p>
        </div>
        
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-indigo-100 shadow-lg">
              <Plus className="w-4 h-4 mr-2" />
              Nova Solicitação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nova Solicitação de Carga</DialogTitle>
              <DialogDescription>Preencha os dados básicos para iniciar o processo.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRequest} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-left">
                  <Label>Tipo de Carga</Label>
                  <Select value={newType} onValueChange={(val: any) => setNewType(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOJA_FISICA">Loja Física</SelectItem>
                      <SelectItem value="FULL_MARKETPLACE">Full Marketplace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-left">
                  <Label>Prioridade</Label>
                  <Select value={newPriority} onValueChange={(val: any) => setNewPriority(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LoadPriority.LOW}>Baixa</SelectItem>
                      <SelectItem value={LoadPriority.MEDIUM}>Média</SelectItem>
                      <SelectItem value={LoadPriority.HIGH}>Alta</SelectItem>
                      <SelectItem value={LoadPriority.URGENT}>Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2 text-left">
                <Label>Empresa</Label>
                <Select value={newCompany} onValueChange={setNewCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lessul_matriz">Lessul Matriz</SelectItem>
                    <SelectItem value="modifika">Modifika</SelectItem>
                    {/* Dynamic list would be better */}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-left">
                <Label>Data Desejada</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="space-y-2 text-left">
                <Label>Observações</Label>
                <textarea 
                  className="w-full min-h-[100px] rounded-md border border-zinc-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Produtos, quantidades, urgências específicas..."
                  value={newObservations}
                  onChange={(e) => setNewObservations(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsAdding(false)}>Cancelar</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Enviar Solicitação</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-white border-b border-zinc-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-zinc-100/50 p-1">
              <TabsTrigger value="ALL">Todas</TabsTrigger>
              <TabsTrigger value="PENDING">Pendentes</TabsTrigger>
              <TabsTrigger value="APPROVED">Aprovadas</TabsTrigger>
              <TabsTrigger value="REJECTED">Recusadas</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              placeholder="Buscar por código ou obs..." 
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
                <TableHead className="w-[150px]">Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Data Desejada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">Carregando solicitações...</TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-zinc-500 italic">Nenhuma solicitação encontrada.</TableCell>
                </TableRow>
              ) : filteredRequests.map((request) => (
                <TableRow key={request.id} className="group hover:bg-zinc-50/50 transition-colors">
                  <TableCell className="font-mono text-xs font-bold text-indigo-600">{request.code}</TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {request.type === 'LOJA_FISICA' ? 'Loja Física' : 'Full Marketplace'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "font-semibold",
                      request.priority === LoadPriority.URGENT ? "text-red-600 border-red-200 bg-red-50" :
                      request.priority === LoadPriority.HIGH ? "text-orange-600 border-orange-200 bg-orange-50" :
                      "text-zinc-600 border-zinc-200 bg-zinc-50"
                    )}>
                      {request.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                      <Calendar className="w-3 h-3" />
                      {request.desiredDate ? new Date(request.desiredDate.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      
                      {profile && [UserRole.ADMIN, UserRole.STOCK_MANAGER].includes(profile.role) && request.status === LoadStatus.PENDING && (
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleUpdateStatus(request.id, LoadStatus.APPROVED)}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleUpdateStatus(request.id, LoadStatus.REJECTED)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
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

import { getDocs } from 'firebase/firestore';
