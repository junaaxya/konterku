import { z } from "zod"
import type {
  Product,
  InventoryMovement,
} from "../../generated/prisma/client"
import {
  InventoryMovementType,
  Prisma,
} from "../../generated/prisma/client"
import { getDatabase } from "../../lib/db"

const maxBigIntAmount = 9_223_372_036_854_775_807n

export class InsufficientStockError extends Error {
  readonly name = "InsufficientStockError"
  constructor(
    readonly productId: string,
    readonly requested: number,
    readonly available: number,
  ) {
    super(
      `Stok produk tidak mencukupi untuk ID ${productId}: diminta ${requested}, tersedia ${available}`,
    )
  }
}

export class BackdatedInventoryMovementRejectedError extends Error {
  readonly name = "BackdatedInventoryMovementRejectedError"
  constructor(
    readonly productId: string,
    readonly attemptedDate: Date,
    readonly latestOutDate: Date,
  ) {
    super(
      `Mutasi inventaris bertanggal ${attemptedDate.toISOString()} ditolak karena lebih lampau dari penjualan terakhir (${latestOutDate.toISOString()}) pada produk ${productId}.`,
    )
  }
}

export class PurchaseAlreadyConsumedError extends Error {
  readonly name = "PurchaseAlreadyConsumedError"
  constructor(readonly movementId: string, readonly productId: string) {
    super(
      `Pembelian (mutasi ${movementId}) tidak dapat dibatalkan karena stok telah terkonsumsi oleh penjualan atau pengeluaran inventaris berikutnya.`,
    )
  }
}

export class MovementAlreadyReversedError extends Error {
  readonly name = "MovementAlreadyReversedError"
  constructor(readonly movementId: string) {
    super(`Mutasi inventaris ${movementId} sudah pernah dibatalkan sebelumnya.`)
  }
}

export class ProductNotFoundError extends Error {
  readonly name = "ProductNotFoundError"
  constructor(readonly productId: string) {
    super(`Produk dengan ID ${productId} tidak ditemukan.`)
  }
}

const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  sellingPrice: z
    .string()
    .max(19)
    .regex(/^(0|[1-9]\d*)$/)
    .transform((val) => BigInt(val))
    .pipe(z.bigint().min(0n).max(maxBigIntAmount)),
  initialStock: z.number().int().min(0).default(0),
  initialCost: z
    .string()
    .max(19)
    .regex(/^(0|[1-9]\d*)$/)
    .transform((val) => BigInt(val))
    .pipe(z.bigint().min(0n).max(maxBigIntAmount))
    .default(0n),
})

export async function createProduct(input: unknown): Promise<Product> {
  const parsed = createProductSchema.parse(input)
  const database = getDatabase()

  return database.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        sku: parsed.sku ?? null,
        name: parsed.name,
        unit: parsed.unit,
        sellingPrice: parsed.sellingPrice,
        stockQuantity: 0,
        inventoryValue: 0n,
        averageCost: 0n,
      },
    })

    if (parsed.initialStock > 0) {
      await recordStockIn(
        {
          productId: product.id,
          quantity: parsed.initialStock,
          unitCost: parsed.initialCost,
          notes: "Saldo awal stok produk",
        },
        tx,
      )
    }

    return tx.product.findUniqueOrThrow({ where: { id: product.id } })
  })
}

export async function getProductById(id: string): Promise<Product> {
  const product = await getDatabase().product.findUnique({ where: { id } })
  if (!product) {
    throw new ProductNotFoundError(id)
  }
  return product
}

export async function listProducts(activeOnly = false): Promise<Product[]> {
  return getDatabase().product.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { name: "asc" },
  })
}

const updateProductSchema = z.object({
  sku: z.string().trim().max(50).optional().nullable(),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  sellingPrice: z
    .string()
    .max(19)
    .regex(/^(0|[1-9]\d*)$/)
    .transform((val) => BigInt(val))
    .pipe(z.bigint().min(0n).max(maxBigIntAmount)),
})

export async function updateProduct(id: string, input: unknown): Promise<Product> {
  const parsed = updateProductSchema.parse(input)
  const product = await getDatabase().product.findUnique({ where: { id } })
  if (!product) {
    throw new ProductNotFoundError(id)
  }
  return getDatabase().product.update({
    where: { id },
    data: {
      sku: parsed.sku ? parsed.sku : null,
      name: parsed.name,
      unit: parsed.unit,
      sellingPrice: parsed.sellingPrice,
    },
  })
}

export async function setProductActive(id: string, isActive: boolean): Promise<Product> {
  const product = await getDatabase().product.findUnique({ where: { id } })
  if (!product) {
    throw new ProductNotFoundError(id)
  }
  return getDatabase().product.update({
    where: { id },
    data: { isActive },
  })
}

export async function getProductWithMovements(id: string) {
  const product = await getDatabase().product.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        include: {
          transaction: true,
          supplierPurchase: {
            include: { supplier: true },
          },
        },
      },
    },
  })
  if (!product) {
    throw new ProductNotFoundError(id)
  }
  return product
}

export async function executeLockedInventoryMutation<T>(
  productIds: readonly string[],
  fn: (tx: Prisma.TransactionClient, lockedProducts: Map<string, Product>) => Promise<T>,
  existingTx?: Prisma.TransactionClient,
): Promise<T> {
  if (productIds.length === 0) {
    throw new Error("Paling sedikit satu productId harus disediakan untuk locking.")
  }

  const sortedUniqueIds = Array.from(new Set(productIds)).sort()

  const executeWithLock = async (tx: Prisma.TransactionClient) => {
    // Acquire deterministic row-level locks
    const lockedRows = await tx.$queryRaw<Product[]>`
      SELECT * FROM "Product"
      WHERE "id" = ANY(${sortedUniqueIds}::text[])
      ORDER BY "id" ASC
      FOR UPDATE
    `

    if (lockedRows.length !== sortedUniqueIds.length) {
      const foundIds = new Set(lockedRows.map((r) => r.id))
      const missing = sortedUniqueIds.find((id) => !foundIds.has(id))
      throw new ProductNotFoundError(missing || "unknown")
    }

    const lockedMap = new Map<string, Product>()
    for (const row of lockedRows) {
      lockedMap.set(row.id, row)
    }

    return fn(tx, lockedMap)
  }

  if (existingTx) {
    return executeWithLock(existingTx)
  }

  const database = getDatabase()
  const maxAttempts = 3
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await database.$transaction(executeWithLock, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      })
    } catch (err: unknown) {
      lastError = err
      const isTransient =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2034" || err.code === "40P01" || err.code === "40001")

      if (isTransient && attempt < maxAttempts) {
        const delay = 50 * Math.pow(2, attempt) + Math.floor(Math.random() * 25)
        await new Promise((res) => setTimeout(res, delay))
        continue
      }
      throw err
    }
  }

  throw lastError
}

async function checkBackdatedGuard(
  tx: Prisma.TransactionClient,
  productId: string,
  attemptedDate: Date,
): Promise<void> {
  const latestOut = await tx.inventoryMovement.findFirst({
    where: {
      productId,
      type: InventoryMovementType.STOCK_OUT,
    },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  })

  if (latestOut && attemptedDate.getTime() < latestOut.occurredAt.getTime()) {
    throw new BackdatedInventoryMovementRejectedError(
      productId,
      attemptedDate,
      latestOut.occurredAt,
    )
  }
}

export async function recordStockIn(
  input: {
    readonly productId: string
    readonly quantity: number
    readonly unitCost: bigint
    readonly supplierPurchaseId?: string | undefined
    readonly occurredAt?: Date | undefined
    readonly notes?: string | undefined
  },
  existingTx?: Prisma.TransactionClient,
): Promise<InventoryMovement> {
  if (input.quantity <= 0) {
    throw new Error("Kuantitas stok masuk harus lebih besar dari 0.")
  }
  if (input.unitCost < 0n) {
    throw new Error("Biaya modal per unit tidak boleh negatif.")
  }

  const occurredAt = input.occurredAt || new Date()

  return executeLockedInventoryMutation(
    [input.productId],
    async (tx, locked) => {
      const product = locked.get(input.productId)!
      await checkBackdatedGuard(tx, input.productId, occurredAt)

      const totalCost = BigInt(input.quantity) * input.unitCost
      const newStockQuantity = product.stockQuantity + input.quantity
      const newInventoryValue = product.inventoryValue + totalCost
      const newAverageCost =
        newStockQuantity > 0 ? newInventoryValue / BigInt(newStockQuantity) : 0n

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: input.productId,
          type: InventoryMovementType.STOCK_IN,
          quantityChange: input.quantity,
          unitCost: input.unitCost,
          totalCost,
          supplierPurchaseId: input.supplierPurchaseId ?? null,
          occurredAt,
          notes: input.notes ?? null,
        },
      })

      await tx.product.update({
        where: { id: input.productId },
        data: {
          stockQuantity: newStockQuantity,
          inventoryValue: newInventoryValue,
          averageCost: newAverageCost,
        },
      })

      return movement
    },
    existingTx,
  )
}

export async function recordStockOut(
  input: {
    readonly productId: string
    readonly quantity: number
    readonly transactionId?: string | undefined
    readonly occurredAt?: Date | undefined
    readonly notes?: string | undefined
  },
  existingTx?: Prisma.TransactionClient,
): Promise<InventoryMovement> {
  if (input.quantity <= 0) {
    throw new Error("Kuantitas stok keluar harus lebih besar dari 0.")
  }

  const occurredAt = input.occurredAt || new Date()

  return executeLockedInventoryMutation(
    [input.productId],
    async (tx, locked) => {
      const product = locked.get(input.productId)!

      if (product.stockQuantity < input.quantity) {
        throw new InsufficientStockError(
          input.productId,
          input.quantity,
          product.stockQuantity,
        )
      }

      const costPerUnit = product.averageCost
      let totalCost: bigint
      let newInventoryValue: bigint

      if (input.quantity === product.stockQuantity) {
        totalCost = product.inventoryValue
        newInventoryValue = 0n
      } else {
        totalCost = BigInt(input.quantity) * costPerUnit
        newInventoryValue = product.inventoryValue - totalCost
      }

      const newStockQuantity = product.stockQuantity - input.quantity
      const newAverageCost =
        newStockQuantity > 0 ? newInventoryValue / BigInt(newStockQuantity) : 0n

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: input.productId,
          type: InventoryMovementType.STOCK_OUT,
          quantityChange: -input.quantity,
          unitCost: costPerUnit,
          totalCost,
          transactionId: input.transactionId ?? null,
          occurredAt,
          notes: input.notes ?? null,
        },
      })

      await tx.product.update({
        where: { id: input.productId },
        data: {
          stockQuantity: newStockQuantity,
          inventoryValue: newInventoryValue,
          averageCost: newAverageCost,
        },
      })

      return movement
    },
    existingTx,
  )
}

export async function recordAdjustment(
  input: {
    readonly productId: string
    readonly quantityChange: number
    readonly unitCost?: bigint | undefined
    readonly occurredAt?: Date | undefined
    readonly notes?: string | undefined
  },
  existingTx?: Prisma.TransactionClient,
): Promise<InventoryMovement> {
  if (input.quantityChange === 0) {
    throw new Error("Kuantitas penyesuaian tidak boleh 0.")
  }

  const occurredAt = input.occurredAt || new Date()

  return executeLockedInventoryMutation(
    [input.productId],
    async (tx, locked) => {
      await checkBackdatedGuard(tx, input.productId, occurredAt)

      const product = locked.get(input.productId)!

      let totalCost: bigint
      let unitCost: bigint
      let newInventoryValue: bigint
      let newStockQuantity: number

      if (input.quantityChange > 0) {
        unitCost = input.unitCost !== undefined ? input.unitCost : product.averageCost
        if (unitCost < 0n) {
          throw new Error("Biaya unit penyesuaian tidak boleh negatif.")
        }
        totalCost = BigInt(input.quantityChange) * unitCost
        newStockQuantity = product.stockQuantity + input.quantityChange
        newInventoryValue = product.inventoryValue + totalCost
      } else {
        const absQty = Math.abs(input.quantityChange)
        if (product.stockQuantity < absQty) {
          throw new InsufficientStockError(
            input.productId,
            absQty,
            product.stockQuantity,
          )
        }
        unitCost = product.averageCost
        if (absQty === product.stockQuantity) {
          totalCost = product.inventoryValue
          newInventoryValue = 0n
        } else {
          totalCost = BigInt(absQty) * unitCost
          newInventoryValue = product.inventoryValue - totalCost
        }
        newStockQuantity = product.stockQuantity - absQty
      }

      const newAverageCost =
        newStockQuantity > 0 ? newInventoryValue / BigInt(newStockQuantity) : 0n

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: input.productId,
          type: InventoryMovementType.ADJUSTMENT,
          quantityChange: input.quantityChange,
          unitCost,
          totalCost,
          occurredAt,
          notes: input.notes ?? null,
        },
      })

      await tx.product.update({
        where: { id: input.productId },
        data: {
          stockQuantity: newStockQuantity,
          inventoryValue: newInventoryValue,
          averageCost: newAverageCost,
        },
      })

      return movement
    },
    existingTx,
  )
}

export async function reverseSaleMovement(
  input: {
    readonly movementId: string
    readonly notes?: string | undefined
  },
  existingTx?: Prisma.TransactionClient,
): Promise<InventoryMovement> {
  const database = getDatabase()
  const dbOrTx = existingTx || database

  const original = await dbOrTx.inventoryMovement.findUnique({
    where: { id: input.movementId },
    include: { reversedByMovement: true },
  })

  if (!original) {
    throw new Error(`Mutasi penjualan ${input.movementId} tidak ditemukan.`)
  }

  if (original.type !== InventoryMovementType.STOCK_OUT) {
    throw new Error("Hanya mutasi penjualan (STOCK_OUT) yang dapat dibatalkan via reverseSaleMovement.")
  }

  if (original.reversedByMovement) {
    throw new MovementAlreadyReversedError(input.movementId)
  }

  const cancelDate = new Date()
  const qtyToRestore = Math.abs(original.quantityChange)

  return executeLockedInventoryMutation(
    [original.productId],
    async (tx, locked) => {
      const product = locked.get(original.productId)!

      const newStockQuantity = product.stockQuantity + qtyToRestore
      const newInventoryValue = product.inventoryValue + original.totalCost
      const newAverageCost =
        newStockQuantity > 0 ? newInventoryValue / BigInt(newStockQuantity) : 0n

      const reversal = await tx.inventoryMovement.create({
        data: {
          productId: original.productId,
          type: InventoryMovementType.SALE_CANCELLED,
          quantityChange: qtyToRestore,
          unitCost: original.unitCost,
          totalCost: original.totalCost,
          transactionId: original.transactionId,
          reversesMovementId: original.id,
          occurredAt: cancelDate,
          notes: input.notes || `Pembatalan penjualan mutasi ${original.id}`,
        },
      })

      await tx.product.update({
        where: { id: original.productId },
        data: {
          stockQuantity: newStockQuantity,
          inventoryValue: newInventoryValue,
          averageCost: newAverageCost,
        },
      })

      return reversal
    },
    existingTx,
  )
}

export async function reversePurchaseMovement(
  input: {
    readonly movementId: string
    readonly notes?: string | undefined
  },
  existingTx?: Prisma.TransactionClient,
): Promise<InventoryMovement> {
  const database = getDatabase()
  const dbOrTx = existingTx || database

  const original = await dbOrTx.inventoryMovement.findUnique({
    where: { id: input.movementId },
    include: { reversedByMovement: true },
  })

  if (!original) {
    throw new Error(`Mutasi pembelian ${input.movementId} tidak ditemukan.`)
  }

  if (original.type !== InventoryMovementType.STOCK_IN) {
    throw new Error("Hanya mutasi pembelian (STOCK_IN) yang dapat dibatalkan via reversePurchaseMovement.")
  }

  if (original.reversedByMovement) {
    throw new MovementAlreadyReversedError(input.movementId)
  }

  // Check if consumed: any reducing movement (quantityChange < 0) occurring AFTER original movement
  const laterOut = await dbOrTx.inventoryMovement.findFirst({
    where: {
      productId: original.productId,
      quantityChange: { lt: 0 },
      occurredAt: { gt: original.occurredAt },
    },
  })

  if (laterOut) {
    throw new PurchaseAlreadyConsumedError(original.id, original.productId)
  }

  const cancelDate = new Date()
  const qtyToRemove = original.quantityChange

  return executeLockedInventoryMutation(
    [original.productId],
    async (tx, locked) => {
      const product = locked.get(original.productId)!

      if (product.stockQuantity < qtyToRemove) {
        throw new InsufficientStockError(
          original.productId,
          qtyToRemove,
          product.stockQuantity,
        )
      }

      const newStockQuantity = product.stockQuantity - qtyToRemove
      const newInventoryValue = product.inventoryValue - original.totalCost
      const newAverageCost =
        newStockQuantity > 0 ? newInventoryValue / BigInt(newStockQuantity) : 0n

      const reversal = await tx.inventoryMovement.create({
        data: {
          productId: original.productId,
          type: InventoryMovementType.PURCHASE_CANCELLED,
          quantityChange: -qtyToRemove,
          unitCost: original.unitCost,
          totalCost: original.totalCost,
          supplierPurchaseId: original.supplierPurchaseId,
          reversesMovementId: original.id,
          occurredAt: cancelDate,
          notes: input.notes || `Pembatalan pembelian mutasi ${original.id}`,
        },
      })

      await tx.product.update({
        where: { id: original.productId },
        data: {
          stockQuantity: newStockQuantity,
          inventoryValue: newInventoryValue,
          averageCost: newAverageCost,
        },
      })

      return reversal
    },
    existingTx,
  )
}

export async function rebuildProductInventory(
  productId: string,
  existingTx?: Prisma.TransactionClient,
): Promise<{
  stockQuantity: number
  inventoryValue: bigint
  averageCost: bigint
}> {
  return executeLockedInventoryMutation(
    [productId],
    async (tx) => {
      const movements = await tx.inventoryMovement.findMany({
        where: { productId },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      })

      let stock = 0
      let value = 0n

      for (const m of movements) {
        stock += m.quantityChange
        if (m.quantityChange >= 0) {
          value += m.totalCost
        } else {
          value -= m.totalCost
        }
      }

      const avg = stock > 0 ? value / BigInt(stock) : 0n

      await tx.product.update({
        where: { id: productId },
        data: {
          stockQuantity: stock,
          inventoryValue: value,
          averageCost: avg,
        },
      })

      return {
        stockQuantity: stock,
        inventoryValue: value,
        averageCost: avg,
      }
    },
    existingTx,
  )
}
