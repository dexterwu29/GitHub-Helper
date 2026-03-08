import { PrismaClient } from '@prisma/client'

// Prisma returns BigInt for Int8/BigInt columns; JSON.stringify can't handle it natively
// eslint-disable-next-line no-extend-native
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString()
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
