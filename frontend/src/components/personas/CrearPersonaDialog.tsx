import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCrearPersona } from '@/hooks/usePersonas';
import type { Sexo } from '@/types/persona.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iglesiaId: string | undefined;
  onCreada: (personaId: string) => void;
}

const VACIO = {
  primerNombre: '',
  segundoNombre: '',
  primerApellido: '',
  segundoApellido: '',
  sexo: '' as Sexo | '',
  fechaNacimiento: '',
  ci: '',
  correo: '',
};

export function CrearPersonaDialog({ open, onOpenChange, iglesiaId, onCreada }: Props) {
  const [form, setForm] = useState(VACIO);
  const crear = useCrearPersona();

  const valido = form.primerNombre.trim() !== '' && form.primerApellido.trim() !== '' && form.sexo !== '';

  function cerrar(abierto: boolean) {
    if (!abierto) setForm(VACIO);
    onOpenChange(abierto);
  }

  function handleCrear() {
    if (!iglesiaId || !valido) return;
    crear.mutate(
      {
        iglesia_id: iglesiaId,
        primer_nombre: form.primerNombre.trim(),
        segundo_nombre: form.segundoNombre.trim() || null,
        primer_apellido: form.primerApellido.trim(),
        segundo_apellido: form.segundoApellido.trim() || null,
        sexo: form.sexo as Sexo,
        fecha_nacimiento: form.fechaNacimiento || null,
        ci: form.ci.trim() || null,
        correo: form.correo.trim() || null,
      },
      {
        onSuccess: (persona) => {
          toast.success('Persona creada.');
          cerrar(false);
          onCreada(persona.id);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo crear la persona'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva persona</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="primer_nombre">Primer nombre *</Label>
            <Input
              id="primer_nombre"
              value={form.primerNombre}
              onChange={(e) => setForm((f) => ({ ...f, primerNombre: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segundo_nombre">Segundo nombre</Label>
            <Input
              id="segundo_nombre"
              value={form.segundoNombre}
              onChange={(e) => setForm((f) => ({ ...f, segundoNombre: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="primer_apellido">Primer apellido *</Label>
            <Input
              id="primer_apellido"
              value={form.primerApellido}
              onChange={(e) => setForm((f) => ({ ...f, primerApellido: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segundo_apellido">Segundo apellido</Label>
            <Input
              id="segundo_apellido"
              value={form.segundoApellido}
              onChange={(e) => setForm((f) => ({ ...f, segundoApellido: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sexo">Sexo *</Label>
            <Select value={form.sexo} onValueChange={(v) => setForm((f) => ({ ...f, sexo: v as Sexo }))}>
              <SelectTrigger id="sexo">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Femenino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha_nacimiento">Fecha de nacimiento</Label>
            <Input
              id="fecha_nacimiento"
              type="date"
              value={form.fechaNacimiento}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ci">Carnet de identidad</Label>
            <Input id="ci" value={form.ci} onChange={(e) => setForm((f) => ({ ...f, ci: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correo">Correo</Label>
            <Input
              id="correo"
              type="email"
              value={form.correo}
              onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Dirección, teléfono, censo y familia se agregan después, desde la ficha de la persona.
        </p>
        <DialogFooter>
          <Button type="button" onClick={handleCrear} disabled={!valido || crear.isPending}>
            {crear.isPending ? 'Creando...' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
