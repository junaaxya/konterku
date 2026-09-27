import { z } from "zod"
import type {
  Customer,
  Receivable,
  ReceivablePayment,
  CustomerRefundLiability,
  CustomerRefundPayment,
} from "../../generated/prisma/client"
import {
  ReceivableStatus,
  RefundLiabilityStatus,
  LedgerDirection,
  TransactionStatus,
  Prisma,
} from "../../generated/prisma/client"
import { getDatabase } from "../../lib/db"
import {
  AccountNotFoundError,
  InactiveAccountError,
  accountIdSchema,
} from "../accounts/account-ledger"

const maxBigIntAmount = 9_223_372_036_854_775_807n

export class CustomerNotFoundError extends Error {
  readonly name = "CustomerNotFoundError"
  constructor(readonly customerId: string) {
    super(`Pelanggan dengan ID ${customerId} tidak ditemukan.`)
  }
}

export class ReceivableNotFoundError extends Error {
  readonly name = "ReceivableNotFoundError"
  constructor(readonly receivableId: string) {
    super(`Piutang dengan ID ${receivableId} tidak ditemukan.`)
  }
}

export class CustomerRefundLiabilityNotFoundError extends Error {
  readonly name = "CustomerRefundLiabilityNotFoundError"
  constructor(readonly liabilityId: string) {
    super(`Kewajiban refund pelanggan dengan ID ${liabilityId} tidak ditemukan.`)
  }
}

export class InvalidPaymentAmountError extends Error {
  readonly name = "InvalidPaymentAmountError"
  constructor(message: string) {
    super(message)
  }
}

export function generateReceivableNumber(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `PIU-${y}${m}${d}-${rand}`
}

export function generateRefundLiabilityNumber(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `REF-${y}${m}${d}-${rand}`
}

const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
})

export async function createCustomer(input: unknown): Promise<Customer> {
  const parsed = createCustomerSchema.parse(input)
  return getDatabase().customer.create({
    data: {
      name: parsed.name,
      phone: parsed.phone ?? null,
      notes: parsed.notes ?? null,
    },
  })
}

export async function getCustomerById(id: string): Promise<Customer> {
  const customer = await getDatabase().customer.findUnique({ where: { id } })
  if (!customer) {
    throw new CustomerNotFoundError(id)
  }
  return customer
}

export async function listCustomers(): Promise<Customer[]> {
  return getDatabase().customer.findMany({
    orderBy: { name: "asc" },
  })
}

const createReceivableSchema = z.object({
  customerId: z.string().cuid(),
  transactionId: z.string().cuid(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
})

export async function createReceivableFromTransaction(
  input: unknown,
  existingTx?: Prisma.TransactionClient,
): Promise<Receivable> {
  const parsed = createReceivableSchema.parse(input)
  const database = getDatabase()
  const dbOrTx = existingTx || database

  const customer = await dbOrTx.customer.findUnique({ where: { id: parsed.customerId } })
  if (!customer) {
    throw new CustomerNotFoundError(parsed.customerId)
  }

  const transaction = await dbOrTx.transaction.findUnique({
    where: { id: parsed.transactionId },
    include: { receivable: true },
  })

  if (!transaction) {
    throw new Error(`Transaksi ${parsed.transactionId} tidak ditemukan.`)
  }

  if (transaction.status === TransactionStatus.CANCELLED) {
    throw new Error("Tidak dapat membuat piutang dari transaksi yang sudah dibatalkan.")
  }

  if (transaction.receivable) {
    throw new Error(`Transaksi ${transaction.transactionNumber} sudah memiliki piutang terkait.`)
  }

  const receivableNumber = generateReceivableNumber(transaction.occurredAt)

  return dbOrTx.receivable.create({
    data: {
      receivableNumber,
      customerId: parsed.customerId,
      transactionId: parsed.transactionId,
      totalAmount: transaction.grossAmount,
      paidAmount: 0n,
      remainingAmount: transaction.grossAmount,
      status: ReceivableStatus.OPEN,
      dueDate: parsed.dueDate ?? null,
      notes: parsed.notes ?? null,
    },
  })
}

const payReceivableSchema = z.object({
  receivableId: z.string().cuid(),
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

export async function payReceivable(input: unknown): Promise<{
  receivable: Receivable
  payment: ReceivablePayment
}> {
  const parsed = payReceivableSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({
      where: { id: parsed.receivableId },
    })

    if (!receivable) {
      throw new ReceivableNotFoundError(parsed.receivableId)
    }

    if (receivable.status === ReceivableStatus.CANCELLED) {
      throw new Error(`Piutang ${receivable.receivableNumber} telah dibatalkan.`)
    }

    if (receivable.status === ReceivableStatus.PAID || receivable.remainingAmount === 0n) {
      throw new InvalidPaymentAmountError(`Piutang ${receivable.receivableNumber} sudah lunas.`)
    }

    if (parsed.amount > receivable.remainingAmount) {
      throw new InvalidPaymentAmountError(
        `Nominal bayar (${parsed.amount.toString()}) melebihi sisa piutang (${receivable.remainingAmount.toString()}).`,
      )
    }

    const account = await tx.account.findUnique({ where: { id: parsed.accountId } })
    if (!account) {
      throw new AccountNotFoundError(parsed.accountId)
    }
    if (!account.isActive) {
      throw new InactiveAccountError(parsed.accountId)
    }

    // Invariant: creates LedgerEntry IN, NO Transaction, NO revenue/profit/income
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        accountId: account.id,
        direction: LedgerDirection.IN,
        amount: parsed.amount,
        description: `Pembayaran piutang pelanggan: ${receivable.receivableNumber}`,
        occurredAt: parsed.paymentDate,
      },
    })

    const payment = await tx.receivablePayment.create({
      data: {
        receivableId: receivable.id,
        accountId: account.id,
        amount: parsed.amount,
        paymentDate: parsed.paymentDate,
        notes: parsed.notes ?? null,
        ledgerEntryId: ledgerEntry.id,
      },
    })

    const newPaidAmount = receivable.paidAmount + parsed.amount
    const newRemainingAmount = receivable.remainingAmount - parsed.amount
    const newStatus = newRemainingAmount === 0n ? ReceivableStatus.PAID : ReceivableStatus.PARTIAL

    const updatedReceivable = await tx.receivable.update({
      where: { id: receivable.id },
      data: {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
      },
    })

    return {
      receivable: updatedReceivable,
      payment,
    }
  })
}

export async function getReceivableById(id: string): Promise<Receivable & {
  payments: ReceivablePayment[]
  customer: Customer
  refundLiability: CustomerRefundLiability | null
}> {
  const receivable = await getDatabase().receivable.findUnique({
    where: { id },
    include: { payments: true, customer: true, refundLiability: true },
  })
  if (!receivable) {
    throw new ReceivableNotFoundError(id)
  }
  return receivable
}

export async function cancelReceivableForTransaction(
  transactionId: string,
  reason?: string | undefined,
  existingTx?: Prisma.TransactionClient,
): Promise<{
  receivable: Receivable | null
  refundLiability: CustomerRefundLiability | null
}> {
  const database = getDatabase()
  const dbOrTx = existingTx || database

  const receivable = await dbOrTx.receivable.findUnique({
    where: { transactionId },
    include: { payments: true },
  })

  if (!receivable) {
    return { receivable: null, refundLiability: null }
  }

  if (receivable.status === ReceivableStatus.CANCELLED) {
    return { receivable, refundLiability: null }
  }

  let refundLiability: CustomerRefundLiability | null = null

  // If customer already paid anything, form CustomerRefundLiability. Do NOT automatically refund cash/bank!
  if (receivable.paidAmount > 0n) {
    const liabilityNumber = generateRefundLiabilityNumber()
    refundLiability = await dbOrTx.customerRefundLiability.create({
      data: {
        liabilityNumber,
        customerId: receivable.customerId,
        receivableId: receivable.id,
        totalAmount: receivable.paidAmount,
        refundedAmount: 0n,
        remainingAmount: receivable.paidAmount,
        status: RefundLiabilityStatus.OPEN,
        reason: reason || `Kewajiban pengembalian dana pembatalan piutang ${receivable.receivableNumber}`,
      },
    })
  }

  const updatedReceivable = await dbOrTx.receivable.update({
    where: { id: receivable.id },
    data: {
      status: ReceivableStatus.CANCELLED,
    },
  })

  return {
    receivable: updatedReceivable,
    refundLiability,
  }
}

const payRefundSchema = z.object({
  refundLiabilityId: z.string().cuid(),
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

export async function payCustomerRefund(input: unknown): Promise<{
  liability: CustomerRefundLiability
  payment: CustomerRefundPayment
}> {
  const parsed = payRefundSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const liability = await tx.customerRefundLiability.findUnique({
      where: { id: parsed.refundLiabilityId },
    })

    if (!liability) {
      throw new CustomerRefundLiabilityNotFoundError(parsed.refundLiabilityId)
    }

    if (liability.status === RefundLiabilityStatus.CANCELLED) {
      throw new Error(`Kewajiban refund ${liability.liabilityNumber} telah dibatalkan.`)
    }

    if (liability.status === RefundLiabilityStatus.PAID || liability.remainingAmount === 0n) {
      throw new InvalidPaymentAmountError(`Kewajiban refund ${liability.liabilityNumber} sudah lunas.`)
    }

    if (parsed.amount > liability.remainingAmount) {
      throw new InvalidPaymentAmountError(
        `Nominal refund (${parsed.amount.toString()}) melebihi sisa kewajiban (${liability.remainingAmount.toString()}).`,
      )
    }

    const account = await tx.account.findUnique({ where: { id: parsed.accountId } })
    if (!account) {
      throw new AccountNotFoundError(parsed.accountId)
    }
    if (!account.isActive) {
      throw new InactiveAccountError(parsed.accountId)
    }

    // Invariant: creates LedgerEntry OUT, NO Transaction, NO fake expense
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        accountId: account.id,
        direction: LedgerDirection.OUT,
        amount: parsed.amount,
        description: `Pengembalian dana pelanggan (Refund): ${liability.liabilityNumber}`,
        occurredAt: parsed.paymentDate,
      },
    })

    const payment = await tx.customerRefundPayment.create({
      data: {
        refundLiabilityId: liability.id,
        accountId: account.id,
        amount: parsed.amount,
        paymentDate: parsed.paymentDate,
        notes: parsed.notes ?? null,
        ledgerEntryId: ledgerEntry.id,
      },
    })

    const newRefundedAmount = liability.refundedAmount + parsed.amount
    const newRemainingAmount = liability.remainingAmount - parsed.amount
    const newStatus =
      newRemainingAmount === 0n ? RefundLiabilityStatus.PAID : RefundLiabilityStatus.PARTIAL

    const updatedLiability = await tx.customerRefundLiability.update({
      where: { id: liability.id },
      data: {
        refundedAmount: newRefundedAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
      },
    })

    return {
      liability: updatedLiability,
      payment,
    }
  })
}

export async function getRefundLiabilityById(id: string): Promise<CustomerRefundLiability & {
  refundPayments: CustomerRefundPayment[]
  customer: Customer
  receivable: Receivable
}> {
  const liability = await getDatabase().customerRefundLiability.findUnique({
    where: { id },
    include: { refundPayments: true, customer: true, receivable: true },
  })
  if (!liability) {
    throw new CustomerRefundLiabilityNotFoundError(id)
  }
  return liability
}

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function updateCustomer(id: string, input: unknown): Promise<Customer> {
  const parsed = updateCustomerSchema.parse(input)
  const customer = await getDatabase().customer.findUnique({ where: { id } })
  if (!customer) {
    throw new CustomerNotFoundError(id)
  }
  return getDatabase().customer.update({
    where: { id },
    data: {
      name: parsed.name,
      phone: parsed.phone ? parsed.phone : null,
      notes: parsed.notes ? parsed.notes : null,
    },
  })
}

export async function getCustomerWithHistory(id: string) {
  const customer = await getDatabase().customer.findUnique({
    where: { id },
    include: {
      receivables: {
        orderBy: { createdAt: "desc" },
        include: {
          transaction: true,
          payments: {
            orderBy: { paymentDate: "desc" },
          },
        },
      },
      refunds: {
        orderBy: { createdAt: "desc" },
        include: {
          receivable: true,
          refundPayments: {
            orderBy: { paymentDate: "desc" },
          },
        },
      },
    },
  })
  if (!customer) {
    throw new CustomerNotFoundError(id)
  }
  return customer
}

export async function listReceivables(filter?: { status?: ReceivableStatus }) {
  return getDatabase().receivable.findMany({
    where: filter?.status ? { status: filter.status } : {},
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      transaction: true,
      payments: {
        orderBy: { paymentDate: "desc" },
        include: { account: true },
      },
      refundLiability: true,
    },
  })
}

export async function listCustomerRefundLiabilities(filter?: { status?: RefundLiabilityStatus }) {
  return getDatabase().customerRefundLiability.findMany({
    where: filter?.status ? { status: filter.status } : {},
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      receivable: {
        include: { transaction: true },
      },
      refundPayments: {
        orderBy: { paymentDate: "desc" },
        include: { account: true },
      },
    },
  })
}
