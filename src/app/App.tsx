import { lazy, Suspense, useEffect } from "react";
import { RouteBoundary } from "../components/RouteBoundary";
import { LoadingState } from "../components/LoadingState";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { AccountPage } from "../pages/AccountPage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { SearchPage } from "../pages/SearchPage";
import { routes } from "./routes";
import { AuthProvider } from "../auth/AuthProvider";
import type { AuthGateway } from "../auth/types";
import { RequireAuth } from "../auth/RequireAuth";

import { ProfessionalProvider } from "../professional/ProfessionalProvider";
import type { ProfessionalRepository } from "../professional/types";

import { WorkProvider } from "../work/WorkProvider";
import type { WorkRepository } from "../work/types";

import { MarketplaceProvider } from "../marketplace/MarketplaceProvider";
import type { PublicMarketplace } from "../marketplace/types";

import { PostsProvider } from "../posts/PostsProvider";
import type { ManagedPosts, PublicPosts } from "../posts/types";

import { AdminProvider } from "../admin/AdminProvider";
import type { AdminRepository } from "../admin/types";

import { SubscriptionProvider } from "../subscriptions/SubscriptionProvider";

import { BillingProvider } from "../billing/BillingProvider";

import type { SandboxBillingRepository } from "../billing/types";
import type { SubscriptionRepository } from "../subscriptions/types";
import { MessagesProvider } from "../messages/MessagesProvider";
import type { MessageRepository } from "../messages/repository";

const AuthPage = lazy(() => import("../pages/AuthPage").then(module => ({ default: module.AuthPage })));

const AuthCallbackPage = lazy(() => import("../pages/AuthCallbackPage").then(module => ({ default: module.AuthCallbackPage })));

const PersonalDataPage = lazy(() => import("../pages/PersonalDataPage").then(module => ({ default: module.PersonalDataPage })));

const ProfessionalRegistrationPage = lazy(() => import("../pages/ProfessionalRegistrationPage").then(module => ({ default: module.ProfessionalRegistrationPage })));

const ProfessionalSpacePage = lazy(() => import("../pages/ProfessionalSpacePage").then(module => ({ default: module.ProfessionalSpacePage })));

const AccountSecurityPage = lazy(() => import("../pages/AccountSecurityPage").then(module => ({ default: module.AccountSecurityPage })));

const ServicesPage = lazy(() => import("../pages/ServicesPage").then(module => ({ default: module.ServicesPage })));

const PortfolioPage = lazy(() => import("../pages/PortfolioPage").then(module => ({ default: module.PortfolioPage })));

const PublicProviderPage = lazy(() => import("../pages/PublicProviderPage").then(module => ({ default: module.PublicProviderPage })));

const WorkPostsPage = lazy(() => import("../pages/WorkPostsPage").then(module => ({ default: module.WorkPostsPage })));

const PublicWorkPage = lazy(() => import("../pages/PublicWorkPage").then(module => ({ default: module.PublicWorkPage })));

const AdminPage = lazy(() => import("../admin/AdminPage").then(module => ({ default: module.AdminPage })));

const SubscriptionsPage = lazy(() => import("../subscriptions/SubscriptionViews").then(module => ({ default: module.SubscriptionsPage })));

const SandboxBillingPage = lazy(() => import("../billing/BillingViews").then(module => ({ default: module.SandboxBillingPage })));
const MessagesInboxPage = lazy(() => import("../messages/MessagesPages").then(module => ({ default: module.MessagesInboxPage })));
const NewConversationPage = lazy(() => import("../messages/MessagesPages").then(module => ({ default: module.NewConversationPage })));
const ConversationPage = lazy(() => import("../messages/MessagesPages").then(module => ({ default: module.ConversationPage })));

const titles: Record<string, string> = {
  [routes.home]: "Início",
  [routes.search]: "Buscar",
  [routes.account]: "Conta",
  "/entrar": "Entrar",
  "/criar-conta": "Criar conta",
  "/recuperar-senha": "Recuperar senha",
  "/redefinir-senha": "Definir nova senha",
  "/auth/retorno": "Confirmar acesso",
  "/conta/dados": "Meus dados",
  "/conta/seguranca": "Segurança e acesso",
  "/admin": "Administração",
  "/conta/assinaturas": "Gratuidade e assinatura",
  "/mensagens": "Mensagens",
};

export function App({
  authGateway,
  professionalRepository,
  workRepository,
  marketplaceRepository,
  managedPosts,
  publicPosts,
  adminRepository,
  subscriptionRepository,
  billingRepository,
  messageRepository,
}: {
  authGateway?: AuthGateway | null;
  professionalRepository?: ProfessionalRepository | null;
  workRepository?: WorkRepository | null;
  marketplaceRepository?: PublicMarketplace | null;
  managedPosts?: ManagedPosts | null;
  publicPosts?: PublicPosts | null;
  adminRepository?: AdminRepository | null;
  subscriptionRepository?: SubscriptionRepository | null;
  billingRepository?: SandboxBillingRepository | null;
  messageRepository?: MessageRepository | null;
}) {
  return (
    <AuthProvider gateway={authGateway}>
      <ProfessionalProvider repository={professionalRepository}>
        <WorkProvider repository={workRepository}>
          <MarketplaceProvider repository={marketplaceRepository}>
            <PostsProvider managed={managedPosts} publicPosts={publicPosts}>
              <AdminProvider repository={adminRepository}>
                <SubscriptionProvider repository={subscriptionRepository}>
                  <BillingProvider repository={billingRepository}>
                    <MessagesProvider repository={messageRepository}><AppRoutes /></MessagesProvider>
                  </BillingProvider>
                </SubscriptionProvider>
              </AdminProvider>
            </PostsProvider>
          </MarketplaceProvider>
        </WorkProvider>
      </ProfessionalProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${titles[pathname] ?? (pathname.startsWith("/trabalhos/") ? "Trabalho realizado" : pathname.endsWith("/publicacoes") ? "Publicações" : pathname.startsWith("/prestadores/") ? "Perfil profissional" : pathname.endsWith("/servicos") ? "Meus serviços" : pathname.endsWith("/trabalhos") ? "Meus trabalhos" : pathname.startsWith("/conta/profissional") ? "Espaço profissional" : "Página não encontrada")} | PEREIRÃO`;
  }, [pathname]);

  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/admin" element={<RouteBoundary><Suspense fallback={<LoadingState>Carregando administração…</LoadingState>}><AdminPage /></Suspense></RouteBoundary>} />
      </Route>
      <Route element={<AppShell />}>
        <Route path={routes.home} element={<HomePage />} />
        <Route path={routes.search} element={<SearchPage />} />
        <Route
          path="/prestadores/:slug"
          element={<PublicProviderPage key={pathname} />}
        />
        <Route
          path="/trabalhos/:postId"
          element={<PublicWorkPage key={pathname} />}
        />
        <Route path={routes.account} element={<AccountPage />} />
        <Route path="/entrar" element={<AuthPage key="login" mode="login" />} />
        <Route
          path="/criar-conta"
          element={<AuthPage key="signup" mode="signup" />}
        />
        <Route
          path="/recuperar-senha"
          element={<AuthPage key="recovery" mode="recovery" />}
        />
        <Route path="/auth/retorno" element={<AuthCallbackPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/mensagens" element={<MessagesInboxPage />} />
          <Route path="/mensagens/iniciar/:businessId" element={<NewConversationPage />} />
          <Route path="/mensagens/:conversationId" element={<ConversationPage key={pathname} />} />
          <Route path="/conta/assinaturas" element={<SubscriptionsPage />} />
          <Route
            path="/conta/profissional/:businessId/assinatura"
            element={<SandboxBillingPage key={pathname} />}
          />
          <Route path="/conta/dados" element={<PersonalDataPage />} />
          <Route path="/conta/seguranca" element={<AccountSecurityPage />} />
          <Route
            path="/redefinir-senha"
            element={<AuthPage key="password" mode="password" />}
          />
          <Route
            path="/conta/profissional"
            element={<ProfessionalSpacePage />}
          />
          <Route
            path="/conta/profissional/cadastro"
            element={<ProfessionalRegistrationPage key="create" />}
          />
          <Route
            path="/conta/profissional/:businessId/editar"
            element={<ProfessionalRegistrationPage key="edit" />}
          />
          <Route
            path="/conta/profissional/:businessId/servicos"
            element={<ServicesPage key={pathname} />}
          />
          <Route
            path="/conta/profissional/:businessId/trabalhos"
            element={<PortfolioPage key={pathname} />}
          />
          <Route
            path="/conta/profissional/:businessId/publicacoes"
            element={<WorkPostsPage key={pathname} />}
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
