import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Users, 
  Search, 
  Plus, 
  Shield, 
  Mail,
  CheckCircle2,
  XCircle,
  MoreVertical
} from 'lucide-react';
import { toast } from 'sonner';

export default function Usuarios() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users_profile'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
      setIsLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar usuários');
    });

    return unsubscribe;
  }, []);

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users_profile', uid), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      toast.success('Perfil atualizado com sucesso');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar perfil');
    }
  };

  const handleToggleActive = async (uid: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users_profile', uid), {
        active: !currentStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Usuário ${!currentStatus ? 'ativado' : 'desativado'}`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status do usuário');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-sm text-zinc-500">Controle de acessos e permissões por perfil</p>
        </div>
        
        <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-indigo-100 shadow-lg">
          <Plus className="w-4 h-4 mr-2" />
          Convidar Usuário
        </Button>
      </header>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-white border-b border-zinc-100 flex items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input 
              placeholder="Buscar por nome ou e-mail..." 
              className="pl-10 h-11 bg-zinc-50 border-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil / Cargo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20">Carregando usuários...</TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-zinc-500 italic">Nenhum usuário encontrado.</TableCell>
                </TableRow>
              ) : filteredUsers.map((user) => (
                <TableRow key={user.id} className="group transition-colors hover:bg-zinc-50/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-zinc-900">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={user.role} 
                      onValueChange={(val: any) => handleUpdateRole(user.id, val)}
                    >
                      <SelectTrigger className="w-[180px] h-9 text-xs font-semibold uppercase tracking-wider border-none bg-zinc-100 hover:bg-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(UserRole).map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "outline" : "secondary"} className={user.active ? "text-emerald-600 bg-emerald-50 border-emerald-100" : ""}>
                      {user.active ? (
                        <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ativo</div>
                      ) : (
                        <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Inativo</div>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className={user.active ? "text-rose-500 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"}
                         onClick={() => handleToggleActive(user.id, user.active)}
                       >
                         {user.active ? 'Desativar' : 'Ativar'}
                       </Button>
                       <Button variant="ghost" size="icon" className="h-9 w-9">
                         <MoreVertical className="w-4 h-4" />
                       </Button>
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
