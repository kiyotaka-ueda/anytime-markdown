import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const result = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      authorization: { params: { scope: "public_repo" } },
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
});

export const { handlers, auth, signIn, signOut } = result;

export async function getGitHubToken(): Promise<string | null> {
  const session = await auth();
  if (!session) return null;
  return session.accessToken ?? null;
}
