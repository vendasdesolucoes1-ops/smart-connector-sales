import { createRoot } from "react-dom/client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import "./index.css";

type RecoveryScreenProps = {
  error?: unknown;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Falha inesperada ao carregar a aplicação.";
}

function RecoveryScreen({ error }: RecoveryScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-normal text-primary">VS Sales</p>
          <h1 className="text-2xl font-semibold tracking-normal">Não foi possível carregar a página</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            O preview encontrou uma falha de inicialização. Recarregue a página para restaurar a sessão.
          </p>
        </div>
        <pre className="max-h-32 overflow-auto rounded-md border border-border bg-secondary p-3 text-xs text-muted-foreground">
          {getErrorMessage(error)}
        </pre>
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={() => window.location.reload()}
        >
          Recarregar preview
        </button>
      </section>
    </main>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Falha ao renderizar aplicação:", error, errorInfo);
  }

  render() {
    if (this.state.error) return <RecoveryScreen error={this.state.error} />;
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento raiz da aplicação não foi encontrado.");
}

rootElement.innerHTML = `
  <main class="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
    <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Carregando"></div>
  </main>
`;

const root = createRoot(rootElement);

async function boot() {
  try {
    const { default: App } = await import("./App.tsx");

    root.render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </ThemeProvider>,
    );
  } catch (error) {
    console.error("Falha ao iniciar aplicação:", error);
    root.render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <RecoveryScreen error={error} />
      </ThemeProvider>,
    );
  }
}

boot();
