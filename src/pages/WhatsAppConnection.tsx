import { useState } from "react";
import { Smartphone, QrCode, Wifi, Loader2, CheckCircle2, MessageCircle, LogOut, Settings2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import WhatsAppChatViewer from "@/components/whatsapp/WhatsAppChatViewer";
import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppOrgInstance } from "@/hooks/useWhatsAppOrgInstance";

export default function WhatsAppConnection() {
  const { profile } = useAuth();
  const { state, qrCode, phoneNumber, error, connectWhatsApp, disconnectWhatsApp, checkStatus } = useWhatsAppOrgInstance();
  const [chatViewerOpen, setChatViewerOpen] = useState(false);

  const orgInstanceName = profile?.org_id ? `org_${profile.org_id.replace(/-/g, "")}` : "";

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Conexão WhatsApp</h1>
          <p className="page-description">Conecte o WhatsApp da sua empresa</p>
        </div>
        {state === "connected" && (
          <Badge className="bg-success/10 text-success border-success/30 gap-1.5 px-3 py-1.5 text-xs">
            <Wifi className="h-3 w-3" /> Conectado
          </Badge>
        )}
      </div>

      <div className="glass rounded-2xl p-8">
        {/* Estado 1 — sem instância */}
        {state === "idle" && (
          <div className="flex flex-col items-center text-center gap-6 py-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10">
              <Smartphone className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Conecte o WhatsApp da sua empresa</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Clique no botão abaixo para gerar um QR Code e conectar seu número.
              </p>
            </div>
            <Button onClick={connectWhatsApp} className="rounded-xl gradient-primary gap-2 px-6">
              <QrCode className="h-4 w-4" /> Conectar WhatsApp
            </Button>
          </div>
        )}

        {/* Estado de configuração ausente — não é uma falha da página */}
        {state === "unconfigured" && (
          <div className="flex flex-col items-center text-center gap-5 py-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-warning/10">
              <Settings2 className="h-9 w-9 text-warning" />
            </div>
            <div className="max-w-md">
              <h3 className="font-semibold text-lg mb-2">Integração ainda não configurada</h3>
              <p className="text-sm text-muted-foreground">
                O WhatsApp precisa ser habilitado pelo administrador da plataforma antes de conectar um número.
              </p>
            </div>
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => void checkStatus()}>
              <RefreshCw className="h-4 w-4" /> Verificar novamente
            </Button>
          </div>
        )}

        {/* Falha transitória ao consultar o serviço */}
        {state === "error" && (
          <div className="flex flex-col items-center text-center gap-5 py-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
              <Smartphone className="h-9 w-9 text-destructive" />
            </div>
            <div className="max-w-md">
              <h3 className="font-semibold text-lg mb-2">Não foi possível carregar a conexão</h3>
              <p className="text-sm text-muted-foreground">{error || "Tente consultar o status novamente."}</p>
            </div>
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => void checkStatus()}>
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        )}

        {/* Estado conectando (entre clicar e ter QR pronto) */}
        {state === "connecting" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Preparando conexão...</p>
          </div>
        )}

        {/* Estado 2 — aguardando QR */}
        {state === "waiting_qr" && (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="bg-white p-4 rounded-2xl">
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code"
                className="w-64 h-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
              <p className="text-xs text-muted-foreground">Aguardando escaneamento...</p>
            </div>
            <p className="text-sm text-center max-w-sm">
              Abra o WhatsApp no seu celular {'>'} Dispositivos conectados {'>'} Conectar dispositivo
            </p>
          </div>
        )}

        {/* Estado 3 — conectado */}
        {state === "connected" && (
          <div className="flex flex-col items-center text-center gap-5 py-6">
            <CheckCircle2 className="h-16 w-16 text-success" />
            <div>
              <p className="text-lg font-semibold text-success">WhatsApp conectado!</p>
              {phoneNumber && <p className="text-sm text-muted-foreground mt-1">Número: {phoneNumber}</p>}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => setChatViewerOpen(true)}>
                <MessageCircle className="h-4 w-4" /> Ver WhatsApp
              </Button>
              <Button variant="outline" className="rounded-xl gap-2 text-destructive hover:text-destructive" onClick={disconnectWhatsApp}>
                <LogOut className="h-4 w-4" /> Desconectar
              </Button>
            </div>
          </div>
        )}
      </div>

      {chatViewerOpen && orgInstanceName && (
        <WhatsAppChatViewer
          instanceName={orgInstanceName}
          onClose={() => setChatViewerOpen(false)}
        />
      )}
    </div>
  );
}
