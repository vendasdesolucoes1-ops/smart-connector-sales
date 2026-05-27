import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, MessageCircle, Loader2, User, Bot, Phone,
  Clock, RefreshCw, Search, X, Sparkles
} from "lucide-react";
import ConversationReview from "./ConversationReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Contact = {
  remote_jid: string;
  push_name: string | null;
  customer_msg_count: number;
  last_customer_msg_at: string;
  last_bot_msg_at: string | null;
  pipeline_stage_key: string | null;
  detected_audience: string | null;
};

type ChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  pushName: string | null;
  type: string;
};

interface Props {
  instanceName: string;
  onClose: () => void;
}

export default function WhatsAppChatViewer({ instanceName, onClose }: Props) {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.org_id) fetchContacts();
  }, [profile?.org_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: { action: "list_contacts", org_id: profile?.org_id, instance_name: instanceName },
      });
      if (error) throw error;
      setContacts(data?.contacts || []);
    } catch (e) {
      console.error("Failed to fetch contacts:", e);
    } finally {
      setContactsLoading(false);
    }
  };

  const fetchMessages = async (contact: Contact) => {
    setSelectedContact(contact);
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-evolution", {
        body: {
          action: "fetch_messages",
          org_id: profile?.org_id,
          instance_name: instanceName,
          remote_jid: contact.remote_jid,
          limit: 200,
        },
      });
      if (error) throw error;
      setMessages(data?.messages || []);
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    } finally {
      setMessagesLoading(false);
    }
  };

  const formatPhone = (jid: string) => {
    const digits = jid.replace(/@.*/, "");
    if (digits.length >= 12) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return `+${digits}`;
  };

  const formatTime = (ts: number) => {
    if (!ts || ts < 1000000000) return "";
    return format(new Date(ts), "HH:mm", { locale: ptBR });
  };

  const formatDate = (ts: number) => {
    if (!ts || ts < 1000000000) return "";
    return format(new Date(ts), "dd/MM/yyyy", { locale: ptBR });
  };

  const filteredContacts = contacts.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      (c.push_name || "").toLowerCase().includes(term) ||
      c.remote_jid.includes(term)
    );
  });

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const dateStr = formatDate(msg.timestamp);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateStr) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateStr, msgs: [msg] });
    }
  });

  // If review mode is active, show the review component
  if (reviewMode && profile?.org_id) {
    return (
      <ConversationReview
        contacts={contacts}
        onClose={() => setReviewMode(false)}
        orgId={profile.org_id}
        instanceName={instanceName}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -mx-4 -mt-2 sm:-mx-6 lg:-mx-8 rounded-2xl overflow-hidden border border-border/50 bg-card">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur shrink-0">
        <Button variant="ghost" size="icon" onClick={selectedContact ? () => setSelectedContact(null) : onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {selectedContact ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {selectedContact.push_name || formatPhone(selectedContact.remote_jid)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {formatPhone(selectedContact.remote_jid)}
                {selectedContact.detected_audience && (
                  <span className="ml-2 uppercase">{selectedContact.detected_audience}</span>
                )}
              </p>
            </div>
            {selectedContact.pipeline_stage_key && (
              <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                {selectedContact.pipeline_stage_key}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex-1">
            <h2 className="font-semibold">WhatsApp — {instanceName}</h2>
            <p className="text-xs text-muted-foreground">{contacts.length} conversas rastreadas</p>
          </div>
        )}
        {!selectedContact && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => setReviewMode(true)}
              disabled={contacts.length === 0}
            >
              <Sparkles className="h-3.5 w-3.5" /> Revisar com IA
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchContacts} disabled={contactsLoading}>
              <RefreshCw className={`h-4 w-4 ${contactsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        )}
        {selectedContact && (
          <Button variant="ghost" size="icon" onClick={() => fetchMessages(selectedContact)} disabled={messagesLoading}>
            <RefreshCw className={`h-4 w-4 ${messagesLoading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {/* Content */}
      {!selectedContact ? (
        /* Contact list */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 rounded-full bg-secondary/40 border-border/30 text-sm"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {contactsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredContacts.map((c) => (
                  <button
                    key={c.remote_jid}
                    onClick={() => fetchMessages(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-6 w-6 text-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm truncate">
                          {c.push_name || formatPhone(c.remote_jid)}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {c.last_customer_msg_at
                            ? format(new Date(c.last_customer_msg_at), "dd/MM HH:mm", { locale: ptBR })
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {formatPhone(c.remote_jid)}
                        </span>
                        {c.detected_audience && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5">{c.detected_audience.toUpperCase()}</Badge>
                        )}
                        {c.customer_msg_count > 0 && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-primary/20 text-primary border-0">
                            {c.customer_msg_count} msgs
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      ) : (
        /* Chat view */
        <div
          className="flex-1 overflow-y-auto px-3 py-4"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        >
          {messagesLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma mensagem encontrada</p>
              <p className="text-xs mt-1">As mensagens podem ter expirado na API</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-1">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="flex justify-center my-3">
                    <span className="text-[10px] bg-secondary/80 text-muted-foreground px-3 py-1 rounded-full shadow-sm">
                      {group.date}
                    </span>
                  </div>
                  {group.msgs.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex mb-1 ${msg.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`relative max-w-[80%] px-3 py-2 rounded-2xl shadow-sm text-sm ${
                          msg.fromMe
                            ? "bg-primary/90 text-primary-foreground rounded-br-md"
                            : "bg-card border border-border/50 rounded-bl-md"
                        }`}
                      >
                        {/* Sender label */}
                        {!msg.fromMe && (
                          <div className="flex items-center gap-1 mb-0.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {msg.pushName || selectedContact?.push_name || "Lead"}
                            </span>
                          </div>
                        )}
                        {msg.fromMe && (
                          <div className="flex items-center gap-1 mb-0.5">
                            <Bot className="h-3 w-3 text-primary-foreground/70" />
                            <span className="text-[10px] font-semibold text-primary-foreground/70">
                              IA Vendedor
                            </span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                        <div className={`flex justify-end mt-0.5 ${msg.fromMe ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                          <span className="text-[9px]">{formatTime(msg.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
