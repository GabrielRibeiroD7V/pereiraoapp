import { useEffect } from "react";
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
import { AuthPage } from "../pages/AuthPage";
import { AuthCallbackPage } from "../pages/AuthCallbackPage";
import { PersonalDataPage } from "../pages/PersonalDataPage";
import { ProfessionalProvider } from "../professional/ProfessionalProvider";
import type { ProfessionalRepository } from "../professional/types";
import { ProfessionalRegistrationPage } from "../pages/ProfessionalRegistrationPage";
import { ProfessionalSpacePage } from "../pages/ProfessionalSpacePage";
import { AccountSecurityPage } from "../pages/AccountSecurityPage";
import { WorkProvider } from "../work/WorkProvider";
import type { WorkRepository } from "../work/types";
import { ServicesPage } from "../pages/ServicesPage";
import { PortfolioPage } from "../pages/PortfolioPage";
import { MarketplaceProvider } from "../marketplace/MarketplaceProvider";
import type { PublicMarketplace } from "../marketplace/types";
import { PublicProviderPage } from "../pages/PublicProviderPage";
import { PostsProvider } from "../posts/PostsProvider";
import type { ManagedPosts, PublicPosts } from "../posts/types";
import { WorkPostsPage } from "../pages/WorkPostsPage";
import { PublicWorkPage } from "../pages/PublicWorkPage";
import { AdminProvider } from "../admin/AdminProvider";
import type { AdminRepository } from "../admin/types";
import { AdminPage } from "../admin/AdminPage";
import { SubscriptionProvider } from "../subscriptions/SubscriptionProvider";
import { SubscriptionsPage } from "../subscriptions/SubscriptionViews";
import { BillingProvider } from "../billing/BillingProvider";
import { SandboxBillingPage } from "../billing/BillingViews";
import type { SandboxBillingRepository } from "../billing/types";
import type { SubscriptionRepository } from "../subscriptions/types";

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
                    <AppRoutes />
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
        <Route path="/admin" element={<AdminPage />} />
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
