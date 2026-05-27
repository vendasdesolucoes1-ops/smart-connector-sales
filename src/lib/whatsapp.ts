export const WHATSAPP_NUMBER = "5512981606113";

export type WhatsAppIntent =
  | "explore"
  | "demo"
  | "start"
  | "case"
  | "support"
  | "partner";

const intentMessages: Record<WhatsAppIntent, string> = {
  explore:
    "Oi, VS! Vi a página de vocês e fiquei curioso pra entender melhor como o VS Sales pode funcionar no meu negócio. Pode me contar um pouco mais?",
  demo:
    "Oi! Adoraria ver o VS Sales rodando na prática antes de qualquer coisa. Conseguem me mostrar uma demonstração?",
  start:
    "Oi! Já entendi o que o VS Sales faz e quero começar a usar. Como dou o próximo passo?",
  case:
    "Oi! Tô comparando opções pro time comercial e queria entender se faz sentido pro meu caso. Posso te contar um pouquinho?",
  support:
    "Oi! Já sou cliente do VS Sales e preciso de ajuda — pode me dar um retorno?",
  partner:
    "Oi! Tenho uma agência/operação e quero entender o programa white-label do VS Sales.",
};

export function whatsappLink(intent: WhatsAppIntent = "explore", extra?: string) {
  const base = intentMessages[intent];
  const text = extra ? `${base}\n\n${extra}` : base;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
