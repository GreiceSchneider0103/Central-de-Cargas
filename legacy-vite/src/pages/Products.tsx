import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { 
  Package, 
  Search, 
  RefreshCw, 
  Plus, 
  Filter,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export default function Products() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('sku', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
      setIsLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar produtos');
    });

    return unsubscribe;
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const filteredProducts = products.filter(p => 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleManualSync = () => {
    toast.info('Sincronização com Google Sheets iniciada...');
    // In a real app, this would trigger a cloud function
    setTimeout(() => {
      toast.success('Sincronização concluída com sucesso!');
    }, 2000);
  };

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos e CMV</h1>
          <p className="text-sm text-zinc-500">Gestão de SKUs e custos de mercadoria vendida</p>
        </div>
        
        <div className="flex gap-2">
          {profile?.role === 'ADMIN' && (
            <Button variant="outline" onClick={handleManualSync} className="h-11 px-6">
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar Sheets
            </Button>
          )}
          <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-indigo-100 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm md:col-span-2 overflow-hidden">
          <div className="p-4 bg-white border-b border-zinc-100 flex items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input 
                placeholder="Buscar por SKU ou nome..." 
                className="pl-10 h-11 bg-zinc-50 border-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-zinc-50/50">
                <TableRow>
                  <TableHead className="w-[120px]">SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>CMV</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sincronizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20">Carregando produtos...</TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-zinc-500 italic">Nenhum produto cadastrado.</TableCell>
                  </TableRow>
                ) : filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs font-bold text-indigo-600 uppercase">{product.sku}</TableCell>
                    <TableCell className="text-sm font-medium">{product.name}</TableCell>
                    <TableCell className="font-bold text-emerald-600">
                      {product.cmv ? formatCurrency(product.cmv) : (
                        <div className="flex items-center gap-1 text-rose-500">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Pendente</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.active ? "outline" : "secondary"} className={product.active ? "text-emerald-600 bg-emerald-50 border-emerald-100" : ""}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-[10px] text-zinc-400 font-medium">
                      {product.lastSyncedAt ? new Date(product.lastSyncedAt.seconds * 1000).toLocaleString('pt-BR') : 'Manual'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Resumo de Cadastro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Total de SKUs</span>
                <span className="font-bold uppercase tracking-tight">{products.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Com CMV Pendente</span>
                <span className="font-bold text-rose-600 uppercase tracking-tight">
                  {products.filter(p => !p.cmv).length}
                </span>
              </div>
            </div>
            
            <Separator className="bg-zinc-100" />
            
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                <RefreshCw className="w-3.5 h-3.5" />
                Sincronização
              </div>
              <p className="text-xs text-indigo-600 leading-relaxed font-medium">
                Os produtos são importados automaticamente do Google Sheets toda semana às 8h.
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Última Sincronização Geral</span>
              <p className="text-sm font-bold text-zinc-700">01/05/2026 08:00:24</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
