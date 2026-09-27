import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      partnerId: string | null;
      firstName: string;
      lastName: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    partnerId?: string | null;
    firstName: string;
    lastName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    partnerId: string | null;
    firstName: string;
    lastName: string;
  }
}
