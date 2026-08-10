"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motivoPerdaPresetValues } from "@/modules/crm/schemas";

const OUTRO = "Outro";

export function MotivoPerdaDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string) => void;
}) {
  const [preset, setPreset] = useState<string>("");
  const [outro, setOutro] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function reset() {
    setPreset("");
    setOutro("");
    setObservacoes("");
  }

  const motivoFinal = preset === OUTRO ? outro.trim() : preset;
  const podeConfirmar = preset !== "" && (preset !== OUTRO || outro.trim() !== "");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Motivo da perda</DialogTitle>
          <DialogDescription>
            Obrigatório para mover uma oportunidade para &quot;Perdido&quot; — alimenta o KPI
            de motivos de perda do Forecast.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>Motivo</Label>
            <Select
              items={Object.fromEntries(motivoPerdaPresetValues.map((m) => [m, m]))}
              value={preset}
              onValueChange={(v) => setPreset(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivoPerdaPresetValues.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preset === OUTRO && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="motivo-outro">Descreva o motivo</Label>
              <Input
                id="motivo-outro"
                value={outro}
                onChange={(e) => setOutro(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="motivo-observacoes">Observações (opcional)</Label>
            <Textarea
              id="motivo-observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais sobre a perda…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!podeConfirmar}
            onClick={() => {
              const motivo = observacoes.trim() ? `${motivoFinal} — ${observacoes.trim()}` : motivoFinal;
              onConfirm(motivo);
              reset();
            }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
