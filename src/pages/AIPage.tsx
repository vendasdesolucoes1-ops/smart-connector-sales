import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Zap, Brain, FileText, Sparkles, PlayCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentSimulator } from "@/components/ai/AgentSimulator";

const AIControlTab = lazy(() => import("@/components/ai/AIControlTab"));
const AIAssistantTab = lazy(() => import("@/components/ai/AIAssistantTab"));
const AIKnowledgeTab = lazy(() => import("@/components/ai/AIKnowledgeTab"));
const AIMessagesTab = lazy(() => import("@/components/ai/AIMessagesTab"));

const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function AIPage() {
  const { profile } = useAuth();
  const orgId = profile?.org_id;

  if (!orgId) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="page-title">Agente IA</h1>
        <p className="page-description">Configure chatbot, assistente, controle e geração de conteúdo</p>
      </div>

      <Tabs defaultValue="control">
        <TabsList className="bg-secondary/30 rounded-xl p-1 h-auto flex-wrap">
          <TabsTrigger value="control" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Zap className="h-3.5 w-3.5 mr-1.5" />Controle
          </TabsTrigger>
          <TabsTrigger value="assistant" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Brain className="h-3.5 w-3.5 mr-1.5" />Assistente
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <FileText className="h-3.5 w-3.5 mr-1.5" />Conhecimento
          </TabsTrigger>
          <TabsTrigger value="messages" className="rounded-lg text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 px-3">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />Mensagens
          </TabsTrigger>
          <TabsTrigger value="simulator" className="rounded-lg text-xs data-[state=active]:bg-success/10 data-[state=active]:text-success py-2 px-3">
            <PlayCircle className="h-3.5 w-3.5 mr-1.5" />Simulador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="mt-4">
          <Suspense fallback={<TabFallback />}><AIControlTab orgId={orgId} /></Suspense>
        </TabsContent>
        <TabsContent value="assistant" className="mt-4">
          <Suspense fallback={<TabFallback />}><AIAssistantTab orgId={orgId} /></Suspense>
        </TabsContent>
        <TabsContent value="knowledge" className="mt-4">
          <Suspense fallback={<TabFallback />}><AIKnowledgeTab orgId={orgId} /></Suspense>
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <Suspense fallback={<TabFallback />}><AIMessagesTab orgId={orgId} /></Suspense>
        </TabsContent>
        <TabsContent value="simulator" className="mt-4">
          <AgentSimulator orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
