import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";

export type WhatsAppConnectionState = "idle" | "connecting" | "waiting_qr" | "connected" | "error";

export function useWhatsAppOrgInstance() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [state, setState] = useState<WhatsAppConnectionState>("idle");
  const [qrCode, setQrCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const invoke = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (!profile?.org_id) throw new Error("Organização não encontrada");
    const { data, error } = await supabase.functions.invoke("manage-evolution", {
      body: { action, org_id: profile.org_id, ...extra },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [profile?.org_id]);

  const checkStatus = useCallback(async () => {
    try {
      const data = await invoke("get_status");
      if (data.state === "open") {
        setState("connected");
        setPhoneNumber(data.phone_number || null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [invoke]);

  // On mount, check if there's already a connected instance for this org.
  useEffect(() => {
    if (!profile?.org_id) return;
    checkStatus();
  }, [profile?.org_id, checkStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const connected = await checkStatus();
      if (connected) {
        stopPolling();
        toast({ title: "✅ WhatsApp conectado!", description: "Seu número está online." });
        logActivity({ action: "whatsapp_conectado", description: "WhatsApp conectado via fluxo automático" });
      }
    }, 3000);
  }, [checkStatus, stopPolling, toast]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const connectWhatsApp = useCallback(async () => {
    setState("connecting");
    setError(null);
    try {
      await invoke("create_instance");
      await invoke("setup_webhook");
      const data = await invoke("connect");
      const qr = typeof data.qrcode === "string" ? data.qrcode : data.qrcode?.base64;
      if (!qr) throw new Error("QR Code não disponível. Tente novamente.");
      setQrCode(qr);
      setState("waiting_qr");
      startPolling();
    } catch (e: any) {
      setState("error");
      setError(e.message || "Erro ao conectar WhatsApp");
      toast({ title: "Erro ao conectar", description: e.message, variant: "destructive" });
      logActivity({ action: "whatsapp_conectado", description: "Falha ao conectar WhatsApp", success: false, errorMessage: e.message });
    }
  }, [invoke, startPolling, toast]);

  const disconnectWhatsApp = useCallback(async () => {
    try {
      stopPolling();
      await invoke("disconnect");
      setState("idle");
      setQrCode("");
      setPhoneNumber(null);
      toast({ title: "WhatsApp desconectado" });
    } catch (e: any) {
      toast({ title: "Erro ao desconectar", description: e.message, variant: "destructive" });
    }
  }, [invoke, stopPolling, toast]);

  return { state, qrCode, phoneNumber, error, connectWhatsApp, disconnectWhatsApp };
}
