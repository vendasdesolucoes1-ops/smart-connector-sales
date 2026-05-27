import { useState } from "react";
import {
  Smartphone, QrCode, Wifi, WifiOff, Loader2, Plus, Trash2,
  RefreshCw, CheckCircle2, MessageCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import WhatsAppChatViewer from "@/components/whatsapp/WhatsAppChatViewer";
import { useEvolutionInstances } from "@/hooks/useEvolutionInstances";

export default function WhatsAppConnection() {
  const {
    instances, instancesLoading, newInstanceName, setNewInstanceName,
    creatingInstance, createInstance, deleteInstance, getQRCode, fetchInstances,
    qrDialogOpen, setQrDialogOpen, qrCode, qrLoading, qrInstanceName, connectionStatus,
  } = useEvolutionInstances();

  const [chatViewerInstance, setChatViewerInstance] = useState<string | null>(null);

  const getStatusInfo = (state: string) => {
    switch (state) {
      case "open": return { label: "Online", color: "bg-success/10 text-success border-success/30", icon: Wifi };
      case "connecting": return { label: "Conectando", color: "bg-warning/10 text-warning border-warning/30", icon: RefreshCw };
      default: return { label: "Desconectado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: WifiOff };
    }
  };

  const hasConnected = instances.some(i => i.state === "open");

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Conexão WhatsApp</h1>
          <p className="page-description">Gerencie suas instâncias de WhatsApp</p>
        </div>
        {hasConnected && (
          <Badge className="bg-success/10 text-success border-success/30 gap-1.5 px-3 py-1.5 text-xs">
            <Wifi className="h-3 w-3" /> Conectado
          </Badge>
        )}
      </div>

      {/* QR Code Setup Card — only show when no instance is connected */}
      {!hasConnected && (
        <div className="glass rounded-2xl p-8">
          <div className="flex flex-col lg:flex-row gap-8 items-center">
            <div className="flex h-52 w-52 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-secondary/20">
              <div className="text-center space-y-2">
                <QrCode className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">Crie uma instância<br />para gerar o QR Code</p>
              </div>
            </div>
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Como conectar</h3>
                <div className="space-y-3">
                  {[
                    { step: 1, text: "Abra o WhatsApp no seu celular" },
                    { step: 2, text: "Vá em Configurações → Aparelhos Conectados" },
                    { step: 3, text: 'Toque em "Conectar um aparelho" e escaneie o QR Code' },
                  ].map((s) => (
                    <div key={s.step} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                        {s.step}
                      </div>
                      <p className="text-sm">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da instância (ex: Vendas)"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  className="rounded-xl bg-secondary/30 border-border/30"
                  onKeyDown={(e) => e.key === "Enter" && createInstance()}
                />
                <Button onClick={createInstance} disabled={creatingInstance || !newInstanceName.trim()} className="rounded-xl gradient-primary shrink-0 gap-2">
                  {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Criar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instances List */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Suas Instâncias</h3>
          <div className="flex gap-2">
            {hasConnected && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2 text-xs" onClick={() => setNewInstanceName("")}>
                <Plus className="h-3.5 w-3.5" /> Nova instância
              </Button>
            )}
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={fetchInstances} disabled={instancesLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${instancesLoading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>

        {/* Inline create form when already connected */}
        {hasConnected && (
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nome da nova instância (ex: Suporte)"
              value={newInstanceName}
              onChange={(e) => setNewInstanceName(e.target.value)}
              className="rounded-xl bg-secondary/30 border-border/30"
              onKeyDown={(e) => e.key === "Enter" && createInstance()}
            />
            <Button onClick={createInstance} disabled={creatingInstance || !newInstanceName.trim()} className="rounded-xl gradient-primary shrink-0 gap-2">
              {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar
            </Button>
          </div>
        )}

        {instancesLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : instances.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma instância criada ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Crie uma instância acima para começar</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {instances.map((inst) => {
              const status = getStatusInfo(inst.state);
              const StatusIcon = status.icon;
              return (
                <div key={inst.name} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  inst.state === "open"
                    ? "bg-success/5 border-success/20"
                    : "bg-secondary/30 border-border/30"
                }`}>
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-4 w-4 ${inst.state === "open" ? "text-success" : inst.state === "connecting" ? "text-warning animate-spin" : "text-destructive"}`} />
                    <div>
                      <p className="text-sm font-semibold">{inst.name}</p>
                      <Badge variant="outline" className={`text-[10px] ${status.color}`}>{status.label}</Badge>
                    </div>
                  </div>
                   <div className="flex gap-1">
                     {inst.state === "open" && (
                       <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1" onClick={() => setChatViewerInstance(inst.name)}>
                         <MessageCircle className="h-3.5 w-3.5" /> Ver WhatsApp
                       </Button>
                     )}
                     {inst.state !== "open" && (
                       <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1" onClick={() => getQRCode(inst.name)}>
                         <QrCode className="h-3.5 w-3.5" /> Conectar
                       </Button>
                     )}
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteInstance(inst.name)}>
                       <Trash2 className="h-3.5 w-3.5" />
                     </Button>
                   </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Conectar: {qrInstanceName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {connectionStatus === "connected" ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle2 className="h-16 w-16 text-success animate-pulse-glow" />
                <p className="text-lg font-semibold text-success">Conectado!</p>
              </div>
            ) : qrLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrCode ? (
              <>
                <div className="bg-white p-4 rounded-2xl">
                  <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                  <p className="text-xs text-muted-foreground">Aguardando escaneamento...</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8">QR Code indisponível. Tente novamente.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* WhatsApp Chat Viewer */}
      {chatViewerInstance && (
        <WhatsAppChatViewer
          instanceName={chatViewerInstance}
          onClose={() => setChatViewerInstance(null)}
        />
      )}
    </div>
  );
}
