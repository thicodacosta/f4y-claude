"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search, UserPlus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buscarCandidatos, criarCandidato, adicionarCandidatoAVaga } from "@/modules/ats/actions";
import type { CandidatoClient } from "@/modules/ats/serialize";

export function AdicionarCandidatoDialog({
  open,
  onOpenChange,
  vagaId,
  candidatosJaNaVaga,
  onAdicionado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vagaId: string;
  candidatosJaNaVaga: string[];
  onAdicionado: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<CandidatoClient[]>([]);
  const [buscando, startBusca] = useTransition();
  const [adicionando, startAdicionar] = useTransition();

  const [nome, setNome] = useState("");
  const [cargoAtual, setCargoAtual] = useState("");
  const [email, setEmail] = useState("");
  const [skills, setSkills] = useState("");
  const [criando, startCriar] = useTransition();

  function handleBuscar(valor: string) {
    setBusca(valor);
    startBusca(async () => {
      const r = await buscarCandidatos(valor);
      setResultados(r);
    });
  }

  function handleAdicionar(candidatoId: string) {
    startAdicionar(async () => {
      try {
        await adicionarCandidatoAVaga({ vagaId, candidatoId });
        toast.success("Candidato adicionado ao processo.");
        onAdicionado();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível adicionar o candidato.");
      }
    });
  }

  function handleCriarENovo() {
    if (!nome.trim()) return;
    startCriar(async () => {
      try {
        const candidato = await criarCandidato({ nome: nome.trim(), cargoAtual, email, skills });
        await adicionarCandidatoAVaga({ vagaId, candidatoId: candidato.id });
        toast.success("Candidato cadastrado e adicionado ao processo.");
        setNome("");
        setCargoAtual("");
        setEmail("");
        setSkills("");
        onAdicionado();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível cadastrar o candidato.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar candidato</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="buscar">
          <TabsList className="w-full">
            <TabsTrigger value="buscar">Buscar existente</TabsTrigger>
            <TabsTrigger value="novo">Cadastrar novo</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="flex flex-col gap-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Nome, cargo ou empresa atual…"
                value={busca}
                onChange={(e) => handleBuscar(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {buscando && <p className="text-sm text-muted-foreground">Buscando…</p>}
              {!buscando && busca && resultados.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum candidato encontrado.</p>
              )}
              {resultados.map((c) => {
                const jaAdicionado = candidatosJaNaVaga.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.cargoAtual ?? "—"} {c.empresaAtual ? `· ${c.empresaAtual}` : ""}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={jaAdicionado || adicionando}
                      onClick={() => handleAdicionar(c.id)}
                    >
                      {jaAdicionado ? "Já no processo" : "Adicionar"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="novo" className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="novo-nome">Nome</Label>
              <Input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="novo-cargo">Cargo atual</Label>
                <Input id="novo-cargo" value={cargoAtual} onChange={(e) => setCargoAtual(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="novo-email">E-mail</Label>
                <Input id="novo-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="novo-skills">Skills</Label>
              <Input
                id="novo-skills"
                placeholder="React, Node.js, PostgreSQL…"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={!nome.trim() || criando} onClick={handleCriarENovo}>
                {criando ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Cadastrar e adicionar
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
