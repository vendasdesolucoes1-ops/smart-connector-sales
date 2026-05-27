import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";

export type EvolutionInstance = { name: string; state: string; owner: string | null };

export function useEvolutionInstances() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"waiting" | "connected" | "error">("waiting");

  const fetchInstances = useCallback(async () => {
    if (!profile?.org_id) return;
    setInstancesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "list", org_id: profile.org_id },
      });
      if (error) throw error;
      const list: EvolutionInstance[] = data?.instances || [];
      setInstances(list);
      if (list.length && !selectedInstance) {
        const connected = list.find((i) => i.state === "open");
        setSelectedInstance(connected?.name || list[0].name);
      }
    } catch { /* silently fail */ }
    finally { setInstancesLoading(false); }
  }, [profile?.org_id, selectedInstance]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  const createInstance = useCallback(async () => {
    if (!profile?.org_id || !newInstanceName.trim()) return;
    setCreatingInstance(true);
    const sanitizedName = newInstanceName.trim().replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    if (!sanitizedName) {
      toast({ title: "Nome inválido", description: "Use letras, números, - ou _", variant: "destructive" });
      setCreatingInstance(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "create", org_id: profile.org_id, instance_name: sanitizedName },
      });
      if (error) throw error;
      toast({ title: "Instância criada!", description: `${sanitizedName} pronta para conexão.` });
      logActivity({ action: "whatsapp_instancia_criada", description: `Instância "${sanitizedName}" criada` });
      if (data?.qrcode?.base64 || data?.qrcode) {
        const qr = typeof data.qrcode === "string" ? data.qrcode : data.qrcode.base64;
        if (qr) { setQrCode(qr); setQrInstanceName(sanitizedName); setConnectionStatus("waiting"); setQrDialogOpen(true); }
      }
      setNewInstanceName("");
      await fetchInstances();
      setSelectedInstance(sanitizedName);
    } catch (error: any) {
      toast({ title: "Erro ao criar instância", description: error.message, variant: "destructive" });
      logActivity({ action: "whatsapp_instancia_criada", description: `Falha ao criar instância "${sanitizedName}"`, success: false, errorMessage: error.message });
    } finally { setCreatingInstance(false); }
  }, [profile?.org_id, newInstanceName, fetchInstances, toast]);

  const deleteInstance = useCallback(async (instanceName: string) => {
    if (!profile?.org_id) return;
    try {
      const { error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "delete", org_id: profile.org_id, instance_name: instanceName },
      });
      if (error) throw error;
      toast({ title: "Instância removida" });
      if (selectedInstance === instanceName) setSelectedInstance("");
      await fetchInstances();
    } catch (error: any) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
  }, [profile?.org_id, selectedInstance, fetchInstances, toast]);

  const getQRCode = useCallback(async (instanceName: string) => {
    if (!profile?.org_id) return;
    setQrLoading(true); setQrInstanceName(instanceName); setQrDialogOpen(true); setQrCode(""); setConnectionStatus("waiting");
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "qrcode", org_id: profile.org_id, instance_name: instanceName },
      });
      if (error) throw error;
      setQrCode(data?.qrcode || "");
    } catch (error: any) {
      toast({ title: "Erro ao obter QR Code", description: error.message, variant: "destructive" });
      setQrDialogOpen(false);
    } finally { setQrLoading(false); }
  }, [profile?.org_id, toast]);

  // Poll QR status
  useEffect(() => {
    if (!qrDialogOpen || !qrInstanceName || !profile?.org_id) return;
    let qrRefreshCount = 0;
    const statusInterval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("manage-evolution", {
          body: { action: "status", org_id: profile.org_id, instance_name: qrInstanceName },
        });
        if (data?.state === "open") {
          setConnectionStatus("connected");
          toast({ title: "✅ WhatsApp conectado!", description: `Instância ${qrInstanceName} online.` });
          logActivity({ action: "whatsapp_conectado", description: `WhatsApp conectado na instância "${qrInstanceName}"` });
          setTimeout(() => { setQrDialogOpen(false); fetchInstances(); setSelectedInstance(qrInstanceName); }, 1500);
        }
      } catch { /* ignore */ }
      qrRefreshCount++;
      if (qrRefreshCount % 8 === 0) {
        try {
          const { data } = await supabase.functions.invoke("manage-evolution", {
            body: { action: "qrcode", org_id: profile.org_id, instance_name: qrInstanceName },
          });
          if (data?.qrcode) setQrCode(data.qrcode);
        } catch { /* ignore */ }
      }
    }, 3000);
    return () => clearInterval(statusInterval);
  }, [qrDialogOpen, qrInstanceName, profile?.org_id, fetchInstances, toast]);

  return {
    instances,
    instancesLoading,
    selectedInstance,
    setSelectedInstance,
    newInstanceName,
    setNewInstanceName,
    creatingInstance,
    createInstance,
    deleteInstance,
    getQRCode,
    fetchInstances,
    qrDialogOpen,
    setQrDialogOpen,
    qrCode,
    qrLoading,
    qrInstanceName,
    connectionStatus,
  };
}
