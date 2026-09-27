import { z } from "zod"
import type {
  Supplier,
  SupplierPurchase,
  Payable,
  PayablePayment,
} from "../../generated/prisma/client"
import {
  PurchaseStatus,
  PayableStatus,
  LedgerDirection,
} from "../../generated/prisma/client"
import { getDatabase } from "../../lib/db"
import {
  recordStockIn,
  reversePurchaseMovement,
  executeLockedInventoryMutation,
} from "../inventory/inventory-service"
import {
  AccountNotFoundError,
  InactiveAccountError,
  accountIdSchema,
} from "../accounts/account-ledger"

const maxBigIntAmount = 9_223_372_036_854_775_807n

export class PurchasePayableHasPaymentsError extends Error {
  readonly name = "PurchasePayableHasPaymentsError"
  constructor(readonly payableId: string, readonly paidAmount: bigint) {
    super(
      `Pembelian supplier tidak dapat dibatalkan karena hutang terkait (${payableId}) telah memiliki pembayaran senilai ${paidAmount.toString()}.`,
    )
  }
}

export class SupplierNotFoundError extends Error {
  readonly name = "SupplierNotFoundError"
  constructor(readonly supplierId: string) {
    super(`Supplier dengan ID ${supplierId} tidak ditemukan.`)
  }
}

export class PayableNotFoundError extends Error {
  readonly name = "PayableNotFoundError"
  constructor(readonly payableId: string) {
    super(`Hutang supplier dengan ID ${payableId} tidak ditemukan.`)
  }
}

export class InvalidPaymentAmountError extends Error {
  readonly name = "InvalidPaymentAmountError"
  constructor(message: string) {
    super(message)
  }
}

export function generatePurchaseNumber(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `PUR-${y}${m}${d}-${rand}`
}

export function generatePayableNumber(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `HUT-${y}${m}${d}-${rand}`
}

const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
})

export async function createSupplier(input: unknown): Promise<Supplier> {
  const parsed = createSupplierSchema.parse(input)
  return getDatabase().supplier.create({
    data: {
      name: parsed.name,
      phone: parsed.phone ?? null,
      notes: parsed.notes ?? null,
    },
  })
}

export async function getSupplierById(id: string): Promise<Supplier> {
  const supplier = await getDatabase().supplier.findUnique({ where: { id } })
  if (!supplier) {
    throw new SupplierNotFoundError(id)
  }
  return supplier
}

export async function listSuppliers(): Promise<Supplier[]> {
  return getDatabase().supplier.findMany({
    orderBy: { name: "asc" },
  })
}

const purchaseItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
  unitCost: z
    .string()
    .max(19)
    .regex(/^(0|[1-9]\d*)$/)
    .transform((val) => BigInt(val))
    .pipe(z.bigint().min(0n).max(maxBigIntAmount)),
})

const createSupplierPurchaseSchema = z.object({
  supplierId: z.string().cuid(),
  items: z.array(purchaseItemSchema).min(1),
  isCredit: z.boolean().default(false),
  accountId: accountIdSchema.optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
  occurredAt: z.coerce.date().default(() => new Date()),
})

export async function createSupplierPurchase(input: unknown): Promise<SupplierPurchase & {
  payable: Payable | null
}> {
  const parsed = createSupplierPurchaseSchema.parse(input)
  const database = getDatabase()

  if (!parsed.isCredit && !parsed.accountId) {
    throw new Error("Akun kas/bank wajib diisi untuk pembelian tunai (isCredit = false).")
  }

  return database.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: parsed.supplierId } })
    if (!supplier) {
      throw new SupplierNotFoundError(parsed.supplierId)
    }

    let calculatedTotal = 0n
    for (const item of parsed.items) {
      calculatedTotal += BigInt(item.quantity) * item.unitCost
    }

    if (calculatedTotal <= 0n) {
      throw new Error("Total nilai pembelian harus lebih besar dari 0.")
    }

    const purchaseNumber = generatePurchaseNumber(parsed.occurredAt)

    let createdPayable: Payable | null = null

    // Cash purchase creates ledger entry OUT immediately; Credit purchase creates Payable
    if (parsed.isCredit) {
      const payableNumber = generatePayableNumber(parsed.occurredAt)
      createdPayable = await tx.payable.create({
        data: {
          payableNumber,
          supplierId: parsed.supplierId,
          description: `Hutang pembelian ${purchaseNumber} dari ${supplier.name}`,
          totalAmount: calculatedTotal,
          paidAmount: 0n,
          remainingAmount: calculatedTotal,
          status: PayableStatus.OPEN,
          dueDate: parsed.dueDate ?? null,
          notes: parsed.notes ?? null,
        },
      })
    } else {
      const account = await tx.account.findUnique({ where: { id: parsed.accountId! } })
      if (!account) {
        throw new AccountNotFoundError(parsed.accountId!)
      }
      if (!account.isActive) {
        throw new InactiveAccountError(parsed.accountId!)
      }

      await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          direction: LedgerDirection.OUT,
          amount: calculatedTotal,
          description: `Pembelian inventaris tunai ${purchaseNumber} - ${supplier.name}`,
          occurredAt: parsed.occurredAt,
        },
      })
    }

    const purchase = await tx.supplierPurchase.create({
      data: {
        purchaseNumber,
        supplierId: parsed.supplierId,
        totalAmount: calculatedTotal,
        isCredit: parsed.isCredit,
        status: PurchaseStatus.COMPLETED,
        occurredAt: parsed.occurredAt,
      },
    })

    if (createdPayable) {
      createdPayable = await tx.payable.update({
        where: { id: createdPayable.id },
        data: { supplierPurchaseId: purchase.id },
      })
    }

    const uniqueProductIds = Array.from(new Set(parsed.items.map((i) => i.productId))).sort()

    return executeLockedInventoryMutation(
      uniqueProductIds,
      async (txInner) => {
        let totalMovementCost = 0n
        for (const item of parsed.items) {
          const mov = await recordStockIn(
            {
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              supplierPurchaseId: purchase.id,
              occurredAt: parsed.occurredAt,
              notes: `Pembelian ${purchaseNumber}`,
            },
            txInner,
          )
          totalMovementCost += mov.totalCost
        }

        if (totalMovementCost !== calculatedTotal) {
          throw new Error(
            `Total nilai mutasi inventaris (${totalMovementCost.toString()}) tidak cocok dengan total pembelian (${calculatedTotal.toString()}).`,
          )
        }

        return {
          ...purchase,
          payable: createdPayable,
        }
      },
      tx,
    )
  })
}

export async function cancelSupplierPurchase(input: {
  readonly purchaseId: string
  readonly reason?: string | undefined
}): Promise<SupplierPurchase> {
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const purchase = await tx.supplierPurchase.findUnique({
      where: { id: input.purchaseId },
      include: {
        payable: {
          include: { payments: true },
        },
        movements: {
          where: { type: "STOCK_IN" },
        },
      },
    })

    if (!purchase) {
      throw new Error(`Pembelian supplier ${input.purchaseId} tidak ditemukan.`)
    }

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new Error(`Pembelian ${purchase.purchaseNumber} sudah pernah dibatalkan.`)
    }

    // Credit purchase: validate that payable has no payments
    if (purchase.payable) {
      if (purchase.payable.paidAmount > 0n || purchase.payable.payments.length > 0) {
        throw new PurchasePayableHasPaymentsError(
          purchase.payable.id,
          purchase.payable.paidAmount,
        )
      }

      await tx.payable.update({
        where: { id: purchase.payable.id },
        data: { status: PayableStatus.CANCELLED },
      })
    } else {
      // Cash purchase: find original ledger entry and create reversal IN
      const originalEntry = await tx.ledgerEntry.findFirst({
        where: {
          description: { contains: purchase.purchaseNumber },
          direction: LedgerDirection.OUT,
        },
      })

      if (originalEntry) {
        await tx.ledgerEntry.create({
          data: {
            accountId: originalEntry.accountId,
            direction: LedgerDirection.IN,
            amount: originalEntry.amount,
            description: `[BATAL] ${originalEntry.description}`,
            occurredAt: new Date(),
          },
        })
      }
    }

    const uniqueProductIds = Array.from(
      new Set(purchase.movements.map((m) => m.productId)),
    ).sort()

    if (uniqueProductIds.length > 0) {
      await executeLockedInventoryMutation(
        uniqueProductIds,
        async (txInner) => {
          for (const movement of purchase.movements) {
            await reversePurchaseMovement(
              {
                movementId: movement.id,
                notes: input.reason || `Pembatalan pembelian ${purchase.purchaseNumber}`,
              },
              txInner,
            )
          }
        },
        tx,
      )
    }

    return tx.supplierPurchase.update({
      where: { id: purchase.id },
      data: { status: PurchaseStatus.CANCELLED },
    })
  })
}

const payPayableSchema = z.object({
  payableId: z.string().cuid(),
  accountId: accountIdSchema,
  amount: z
    .string()
    .max(19)
    .regex(/^(0|[1-9]\d*)$/)
    .transform((val) => BigInt(val))
    .pipe(z.bigint().positive().max(maxBigIntAmount)),
  paymentDate: z.coerce.date().default(() => new Date()),
  notes: z.string().trim().max(500).optional(),
})

export async function paySupplierPayable(input: unknown): Promise<{
  payable: Payable
  payment: PayablePayment
}> {
  const parsed = payPayableSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const payable = await tx.payable.findUnique({
      where: { id: parsed.payableId },
    })

    if (!payable) {
      throw new PayableNotFoundError(parsed.payableId)
    }

    if (payable.status === PayableStatus.CANCELLED) {
      throw new Error(`Hutang ${payable.payableNumber} telah dibatalkan.`)
    }

    if (payable.status === PayableStatus.PAID || payable.remainingAmount === 0n) {
      throw new InvalidPaymentAmountError(`Hutang ${payable.payableNumber} sudah lunas.`)
    }

    if (parsed.amount > payable.remainingAmount) {
      throw new InvalidPaymentAmountError(
        `Nominal bayar (${parsed.amount.toString()}) melebihi sisa hutang (${payable.remainingAmount.toString()}).`,
      )
    }

    const account = await tx.account.findUnique({ where: { id: parsed.accountId } })
    if (!account) {
      throw new AccountNotFoundError(parsed.accountId)
    }
    if (!account.isActive) {
      throw new InactiveAccountError(parsed.accountId)
    }

    // Invariant: creates LedgerEntry OUT, NO Transaction, NO expense/profit
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        accountId: account.id,
        direction: LedgerDirection.OUT,
        amount: parsed.amount,
        description: `Pelunasan hutang: ${payable.payableNumber} (${payable.description})`,
        occurredAt: parsed.paymentDate,
      },
    })

    const payment = await tx.payablePayment.create({
      data: {
        payableId: payable.id,
        accountId: account.id,
        amount: parsed.amount,
        paymentDate: parsed.paymentDate,
        notes: parsed.notes ?? null,
        ledgerEntryId: ledgerEntry.id,
      },
    })

    const newPaidAmount = payable.paidAmount + parsed.amount
    const newRemainingAmount = payable.remainingAmount - parsed.amount
    const newStatus = newRemainingAmount === 0n ? PayableStatus.PAID : PayableStatus.PARTIAL

    const updatedPayable = await tx.payable.update({
      where: { id: payable.id },
      data: {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
      },
    })

    return {
      payable: updatedPayable,
      payment,
    }
  })
}

export async function getPayableById(id: string): Promise<Payable & {
  payments: PayablePayment[]
  supplier: Supplier
}> {
  const payable = await getDatabase().payable.findUnique({
    where: { id },
    include: { payments: true, supplier: true },
  })
  if (!payable) {
    throw new PayableNotFoundError(id)
  }
  return payable
}

const updateSupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function updateSupplier(id: string, input: unknown): Promise<Supplier> {
  const parsed = updateSupplierSchema.parse(input)
  const supplier = await getDatabase().supplier.findUnique({ where: { id } })
  if (!supplier) {
    throw new SupplierNotFoundError(id)
  }
  return getDatabase().supplier.update({
    where: { id },
    data: {
      name: parsed.name,
      phone: parsed.phone ? parsed.phone : null,
      notes: parsed.notes ? parsed.notes : null,
    },
  })
}

export async function getSupplierWithHistory(id: string) {
  const supplier = await getDatabase().supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { occurredAt: "desc" },
        include: {
          payable: true,
          movements: {
            include: { product: true },
          },
        },
      },
      payables: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: {
            orderBy: { paymentDate: "desc" },
          },
        },
      },
    },
  })
  if (!supplier) {
    throw new SupplierNotFoundError(id)
  }
  return supplier
}

export async function listPurchases() {
  return getDatabase().supplierPurchase.findMany({
    orderBy: { occurredAt: "desc" },
    include: {
      supplier: true,
      payable: true,
      movements: {
        include: { product: true },
      },
    },
  })
}

export async function getPurchaseById(id: string) {
  const purchase = await getDatabase().supplierPurchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      payable: {
        include: {
          payments: {
            include: { account: true },
            orderBy: { paymentDate: "desc" },
          },
        },
      },
      movements: {
        include: { product: true },
      },
    },
  })
  if (!purchase) {
    throw new Error(`Pembelian supplier ${id} tidak ditemukan.`)
  }
  return purchase
}

export async function listPayables(filter?: { status?: PayableStatus }) {
  return getDatabase().payable.findMany({
    where: filter?.status ? { status: filter.status } : {},
    orderBy: { createdAt: "desc" },
    include: {
      supplier: true,
      supplierPurchase: true,
      payments: {
        orderBy: { paymentDate: "desc" },
        include: { account: true },
      },
    },
  })
}
