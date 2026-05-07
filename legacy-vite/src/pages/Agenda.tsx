import React, { useState } from 'react';
import { Calendar } from '../components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Truck,
  Plus,
  Clock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

export default function Agenda() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Mock events for the calendar
  const events = [
    { id: '1', date: new Date(), time: '09:00', type: 'FULL', title: 'FULL-2026-0001', status: 'AGENDADA', color: 'indigo' },
    { id: '2', date: new Date(), time: '14:30', type: 'LOJA', title: 'LOJA-2026-0012', status: 'CONFIRMADA', color: 'emerald' },
  ];

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda Mensal</h1>
          <p className="text-sm text-zinc-500">Visualização de cargas e recebimentos agendados</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="h-11">Hoje</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-indigo-100 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden p-6 bg-white shrink-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="w-full h-full flex justify-center"
            classNames={{
              day_today: "bg-indigo-50 text-indigo-700 font-bold",
              day_selected: "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white focus:bg-indigo-600 focus:text-white",
              head_cell: "text-zinc-500 font-bold uppercase text-[10px] tracking-wider py-3",
              cell: "h-14 w-14 sm:h-20 sm:w-20 p-0 text-center text-sm relative [&:has([aria-selected])]:bg-zinc-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-14 w-14 sm:h-20 sm:w-20 p-0 font-normal aria-selected:opacity-100 hover:bg-zinc-100 rounded-lg flex flex-col items-center justify-start pt-2",
            }}
          />
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm flex flex-col">
          <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {date?.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-2">Cargas do Dia</div>
            
            {events.map((event) => (
              <div key={event.id} className="group p-4 rounded-xl bg-white border border-zinc-100 shadow-sm hover:border-indigo-200 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-indigo-600">{event.title}</span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-bold",
                    event.color === 'indigo' ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                  )}>
                    {event.status}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    {event.time}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-tight">
                    <Truck className="w-3.5 h-3.5" />
                    {event.type}
                  </div>
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div className="text-center py-12 text-zinc-400 italic text-sm">
                Nenhum evento para este dia.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
