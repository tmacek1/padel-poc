import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { sendWelcomeEmail } from './email'
import { generateUniqueHandle } from './handleGenerator'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email i lozinka su obavezni')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          throw new Error('Korisnik nije pronađen')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error('Pogrešna lozinka')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        // Fetch profile completion status and admin flags
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { name: true, profileCompleted: true, isAdmin: true, isSuperAdmin: true },
        })
        token.name = dbUser?.name ?? token.name
        token.profileCompleted = dbUser?.profileCompleted ?? false
        token.isAdmin = dbUser?.isAdmin ?? false
        token.isSuperAdmin = dbUser?.isSuperAdmin ?? false
      }

      // Refresh on update trigger
      if (trigger === 'update' && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, profileCompleted: true, isAdmin: true, isSuperAdmin: true },
        })
        token.name = dbUser?.name ?? token.name
        token.profileCompleted = dbUser?.profileCompleted ?? false
        token.isAdmin = dbUser?.isAdmin ?? false
        token.isSuperAdmin = dbUser?.isSuperAdmin ?? false
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.profileCompleted = token.profileCompleted as boolean
        session.user.isAdmin = token.isAdmin as boolean
        session.user.isSuperAdmin = token.isSuperAdmin as boolean
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // If url is relative, prepend baseUrl
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      // If url is on the same site, allow it
      if (url.startsWith(baseUrl)) {
        return url
      }
      return baseUrl
    },
  },
  events: {
    async createUser({ user }) {
      // Send welcome email when a new user is created via OAuth
      // Check if user has password - if yes, they registered via email form
      // and welcome email was already sent from /api/auth/register
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true, handle: true },
      })

      // Generiraj handle za OAuth korisnike ako ga nemaju
      if (!dbUser?.handle && user.name) {
        const nameParts = user.name.split(' ')
        const firstName = nameParts[0] || null
        const lastName = nameParts.slice(1).join(' ') || null
        const handle = await generateUniqueHandle(firstName, lastName)

        await prisma.user.update({
          where: { id: user.id },
          data: {
            handle,
            firstName,
            lastName,
          },
        })
      }

      // Only send for OAuth users (no password)
      if (user.email && !dbUser?.password) {
        sendWelcomeEmail(user.email, user.name ?? null).catch((err) => {
          console.error('Failed to send welcome email:', err)
        })
      }
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
}
