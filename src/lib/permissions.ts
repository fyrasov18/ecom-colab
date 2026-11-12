import { redirect } from "next/navigation";
import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { getSetting } from "@/modules/settings/service";
import { SETTING_KEYS } from "@/modules/settings/defaults";

export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Granular application permissions decoupled from roles.
 */
export const PERMISSIONS = {
  // Existing financial & branding permissions
  MANAGE_CONTRIBUTION_SETTINGS: "MANAGE_CONTRIBUTION_SETTINGS",
  MANAGE_PLATFORM_BRANDING: "MANAGE_PLATFORM_BRANDING",
  MANAGE_PARTNER_BRANDING: "MANAGE_PARTNER_BRANDING",

  // Granular module permissions
  VIEW_PARTNERS: "VIEW_PARTNERS",
  MANAGE_PARTNERS: "MANAGE_PARTNERS",
  VIEW_PRODUCTS: "VIEW_PRODUCTS",
  MANAGE_PRODUCTS: "MANAGE_PRODUCTS",
  ASSIGN_PRODUCTS: "ASSIGN_PRODUCTS",
  VIEW_PRODUCT_SUGGESTIONS: "VIEW_PRODUCT_SUGGESTIONS",
  MANAGE_PRODUCT_SUGGESTIONS: "MANAGE_PRODUCT_SUGGESTIONS",
  VIEW_STOCKS: "VIEW_STOCKS",
  VIEW_ORDERS: "VIEW_ORDERS",
  MANAGE_ORDERS: "MANAGE_ORDERS",
  VIEW_COMMISSIONS: "VIEW_COMMISSIONS",
  MANAGE_FINANCE: "MANAGE_FINANCE",
  VIEW_ANALYTICS: "VIEW_ANALYTICS",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionCategory =
  | "Partenaires"
  | "Catalogue"
  | "Commandes & Logistique"
  | "Finance"
  | "Statistiques"
  | "Configuration";

export const PERMISSION_METADATA: Record<
  Permission,
  { label: string; description: string; category: PermissionCategory }
> = {
  VIEW_PARTNERS: {
    category: "Partenaires",
    label: "Consulter les partenaires",
    description: "Accès à la liste des partenaires et aux profils détaillés.",
  },
  MANAGE_PARTNERS: {
    category: "Partenaires",
    label: "Gérer les partenaires",
    description: "Validation, suspension et modification du statut des partenaires.",
  },
  VIEW_PRODUCTS: {
    category: "Catalogue",
    label: "Consulter les produits",
    description: "Accès au catalogue produits, catégories et fiches détaillées.",
  },
  MANAGE_PRODUCTS: {
    category: "Catalogue",
    label: "Ajouter et modifier les produits",
    description: "Création de produits, modification des tarifs, images et argumentaires.",
  },
  ASSIGN_PRODUCTS: {
    category: "Catalogue",
    label: "Assigner des produits",
    description: "Assignation de produits du catalogue aux partenaires.",
  },
  VIEW_PRODUCT_SUGGESTIONS: {
    category: "Catalogue",
    label: "Consulter les suggestions de produits",
    description: "Accès à la liste des suggestions de produits soumises par les partenaires.",
  },
  MANAGE_PRODUCT_SUGGESTIONS: {
    category: "Catalogue",
    label: "Gérer les suggestions de produits",
    description: "Examen, acceptation, refus et conversion des suggestions en produits officiels.",
  },
  VIEW_STOCKS: {
    category: "Catalogue",
    label: "Consulter les stocks",
    description: "Visualisation des niveaux de stock et alertes de seuil.",
  },
  VIEW_ORDERS: {
    category: "Commandes & Logistique",
    label: "Consulter les commandes",
    description: "Accès au listing global des commandes et aux détails clients.",
  },
  MANAGE_ORDERS: {
    category: "Commandes & Logistique",
    label: "Gérer commandes & expéditions",
    description: "Traitement des statuts de commande, colisage et logistique.",
  },
  VIEW_COMMISSIONS: {
    category: "Finance",
    label: "Consulter les commissions",
    description: "Visualisation des gains générés par les commandes partenaires.",
  },
  MANAGE_FINANCE: {
    category: "Finance",
    label: "Gérer paiements & règlements",
    description: "Traitement des retraits, règlements et clôtures financières.",
  },
  MANAGE_CONTRIBUTION_SETTINGS: {
    category: "Finance",
    label: "Règles financières & commissions",
    description: "Surcharges de commission et paramétrage du moteur de contribution.",
  },
  VIEW_ANALYTICS: {
    category: "Statistiques",
    label: "Accéder aux statistiques",
    description: "Visualisation des tableaux de bord analytiques et performances.",
  },
  MANAGE_SETTINGS: {
    category: "Configuration",
    label: "Gérer les paramètres globaux",
    description: "Accès à la configuration générale de la plateforme.",
  },
  MANAGE_PLATFORM_BRANDING: {
    category: "Configuration",
    label: "Design de la plateforme",
    description: "Gestion des logos, thèmes et personnalisation visuelle générale.",
  },
  MANAGE_PARTNER_BRANDING: {
    category: "Configuration",
    label: "Marque & identité partenaire",
    description: "Gestion des personnalisations de marque pour les partenaires.",
  },
};

/**
 * Explicit role-based default permission policy.
 * - SUPER_ADMIN receives all management permissions by default.
 * - ADMIN receives baseline operational permissions; custom grants are configured per-user.
 * - PARTNER has no admin capabilities.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.VIEW_PARTNERS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_STOCKS,
    PERMISSIONS.MANAGE_PARTNER_BRANDING,
    PERMISSIONS.VIEW_PRODUCT_SUGGESTIONS,
    PERMISSIONS.MANAGE_PRODUCT_SUGGESTIONS,
  ],
  PARTNER: [],
};

/**
 * Resolves whether a user possesses a specific permission.
 * Evaluates:
 * 1. Super Admin role (always has all permissions).
 * 2. Explicit per-user administrative grants stored in SystemSetting (security.admin_permission_grants).
 * 3. Default role policy for ADMIN.
 */
export async function hasPermission(
  user: { id: string; role: Role },
  permission: Permission,
  db: DbClient = prisma,
): Promise<boolean> {
  // 1. Super Admin always has full access
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // 2. Only active ADMINs can receive delegated administrative permissions
  if (user.role !== "ADMIN") {
    return false;
  }

  // 3. Explicit per-user grants from settings
  try {
    const grants = await getSetting<Record<string, string[]>>(
      SETTING_KEYS.ADMIN_PERMISSION_GRANTS as never,
      db,
    );
    const userGrants = grants?.[user.id];
    if (Array.isArray(userGrants)) {
      return userGrants.includes(permission);
    }
  } catch {
    // Setting read failure fallback to role defaults
  }

  // 4. Default baseline role policy for ADMIN
  return ROLE_DEFAULT_PERMISSIONS.ADMIN.includes(permission);
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Action non autorisée : permission ${permission} requise.`);
    this.name = "PermissionError";
  }
}

/**
 * Server-side gatekeeper: authenticates user and enforces the required permission.
 * Throws PermissionError if user lacks permission.
 */
export async function requirePermission(
  permission: Permission,
  db: DbClient = prisma,
): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;

  const allowed = await hasPermission(user, permission, db);
  if (!allowed) {
    throw new PermissionError(permission);
  }

  return user;
}
