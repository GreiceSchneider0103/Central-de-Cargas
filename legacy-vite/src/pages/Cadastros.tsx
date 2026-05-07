import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Building2, 
  Store, 
  Warehouse, 
  Truck, 
  Users, 
  MapPin, 
  Radio,
  Plus
} from 'lucide-react';

export default function Cadastros() {
  const categories = [
    { id: 'companies', label: 'Empresas', icon: Building2 },
    { id: 'stores', label: 'Lojas', icon: Store },
    { id: 'cds', label: 'CDs', icon: Warehouse },
    { id: 'suppliers', label: 'Fornecedores', icon: Users },
    { id: 'channels', label: 'Canais', icon: Radio },
    { id: 'destinations', label: 'Destinos Full', icon: MapPin },
    { id: 'transports', label: 'Transportes', icon: Truck },
  ];

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastros Operacionais</h1>
          <p className="text-sm text-zinc-500">Gerencie as entidades base do sistema</p>
        </div>
      </header>

      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList className="bg-white p-1 border border-zinc-200 h-14 w-full justify-start gap-2 shadow-sm">
          {categories.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="h-full rounded-md px-6 data-[state=active]:bg-zinc-950 data-[state=active]:text-white transition-all flex gap-2"
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.id} value={cat.id}>
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 bg-zinc-50/30">
                <div>
                  <CardTitle>{cat.label}</CardTitle>
                  <CardDescription>Gerenciar registros de {cat.label.toLowerCase()}</CardDescription>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Cadastro
                </Button>
              </CardHeader>
              <CardContent className="p-12 text-center text-zinc-500 italic">
                Nenhum registro encontrado em {cat.label}.
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
