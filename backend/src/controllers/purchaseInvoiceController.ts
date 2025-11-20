import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

// Alış fakturaları (purchase_invoices)
export const getAllPurchaseInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const invoices = await prisma.purchase_invoices.findMany({
      include: {
        suppliers: true,
        purchase_invoice_items: {
          include: {
            products: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    res.json(invoices)
  } catch (error) {
    console.error('Get purchase invoices error:', error)
    res.status(500).json({ message: 'Alış qaimələri yüklənərkən xəta baş verdi' })
  }
}

export const getPurchaseInvoiceById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const invoice = await prisma.purchase_invoices.findUnique({
      where: { id: parseInt(id) },
      include: {
        suppliers: true,
        purchase_invoice_items: {
          include: {
            products: true,
          },
        },
      },
    })

    if (!invoice) {
      return res.status(404).json({ message: 'Alış qaiməsi tapılmadı' })
    }

    res.json(invoice)
  } catch (error) {
    console.error('Get purchase invoice error:', error)
    res.status(500).json({ message: 'Alış qaiməsi yüklənərkən xəta baş verdi' })
  }
}

export const createPurchaseInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { supplier_id, items, notes, is_active } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Məhsul seçilməlidir' })
    }

    const response = await prisma.$transaction(async (tx) => {
      const lastInvoice = await tx.purchase_invoices.findFirst({
        where: { invoice_number: { startsWith: 'PI-' } },
        orderBy: { id: 'desc' },
      })

      let nextNumber = 1
      if (lastInvoice) {
        const match = lastInvoice.invoice_number.match(/PI-(\d+)/)
        if (match) {
          const lastNumber = parseInt(match[1], 10)
          nextNumber = lastNumber > 9999999999 ? 1 : lastNumber + 1
        }
      }

      const invoiceNumber = `PI-${String(nextNumber).padStart(10, '0')}`

      const normalizedItems = items.map((item: any) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
      }))

      const totalAmount = normalizedItems.reduce(
        (sum: number, item: { total_price: number }) => sum + item.total_price,
        0,
      )

      const invoice = await tx.purchase_invoices.create({
        data: {
          invoice_number: invoiceNumber,
          supplier_id: supplier_id ? Number(supplier_id) : null,
          total_amount: totalAmount,
          notes: notes || null,
          is_active: is_active !== undefined ? Boolean(is_active) : true,
        },
      })

      await Promise.all(
        normalizedItems.map((item: { product_id: number; quantity: number; unit_price: number; total_price: number }) =>
          tx.purchase_invoice_items.create({
            data: {
              invoice_id: invoice.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            },
          }),
        ),
      )

      for (const item of normalizedItems) {
        const warehouse = await tx.warehouse.findFirst({
          where: { product_id: item.product_id },
        })

        if (warehouse) {
          await tx.warehouse.update({
            where: { id: warehouse.id },
            data: {
              quantity: Number(warehouse.quantity || 0) + item.quantity,
            },
          })
        } else {
          await tx.warehouse.create({
            data: {
              product_id: item.product_id,
              quantity: item.quantity,
            },
          })
        }
      }

      return tx.purchase_invoices.findUnique({
        where: { id: invoice.id },
        include: {
          suppliers: true,
          purchase_invoice_items: {
            include: {
              products: true,
            },
          },
        },
      })
    })

    res.status(201).json(response)
  } catch (error) {
    console.error('Create purchase invoice error:', error)
    res.status(500).json({ message: 'Alış qaiməsi yaradılarkən xəta baş verdi' })
  }
}

export const updatePurchaseInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { supplier_id, items, notes, is_active } = req.body

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchase_invoices.findUnique({
        where: { id: parseInt(id, 10) },
        include: { purchase_invoice_items: true },
      })

      if (!invoice) {
        throw new Error('NOT_FOUND')
      }

      // Köhnə item-lərin təsirini geri al
      for (const item of invoice.purchase_invoice_items) {
        if (!item.product_id) {
          continue
        }
        const warehouse = await tx.warehouse.findFirst({
          where: { product_id: item.product_id },
        })
        if (!warehouse) {
          continue
        }
        const currentQuantity = Number(warehouse.quantity || 0)
        if (currentQuantity < Number(item.quantity)) {
          throw new Error(`Məhsul ID ${item.product_id} üçün stok düzəlişi mümkün deyil`)
        }
        await tx.warehouse.update({
          where: { id: warehouse.id },
          data: {
            quantity: currentQuantity - Number(item.quantity),
          },
        })
      }

      await tx.purchase_invoice_items.deleteMany({
        where: { invoice_id: invoice.id },
      })

      let normalizedItems: any[] = []
      if (items && Array.isArray(items)) {
        normalizedItems = items.map((item: any) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
        }))

        await Promise.all(
          normalizedItems.map((item) =>
            tx.purchase_invoice_items.create({
              data: {
                invoice_id: invoice.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
              },
            }),
          ),
        )

        for (const item of normalizedItems) {
          const warehouse = await tx.warehouse.findFirst({
            where: { product_id: item.product_id },
          })
          if (warehouse) {
            await tx.warehouse.update({
              where: { id: warehouse.id },
              data: {
                quantity: Number(warehouse.quantity || 0) + item.quantity,
              },
            })
          } else {
            await tx.warehouse.create({
              data: {
                product_id: item.product_id,
                quantity: item.quantity,
              },
            })
          }
        }
      }

      const totalAmount =
        normalizedItems.length > 0
          ? normalizedItems.reduce(
              (sum: number, item: { total_price: number }) => sum + item.total_price,
              0,
            )
          : invoice.total_amount

      const updateData: any = {}
      if (supplier_id !== undefined) updateData.supplier_id = supplier_id ? Number(supplier_id) : null
      if (totalAmount !== undefined) updateData.total_amount = totalAmount
      if (notes !== undefined) updateData.notes = notes || null
      if (is_active !== undefined) updateData.is_active = Boolean(is_active)

      return tx.purchase_invoices.update({
        where: { id: invoice.id },
        data: updateData,
        include: {
          suppliers: true,
          purchase_invoice_items: {
            include: {
              products: true,
            },
          },
        },
      })
    })

    res.json(updatedInvoice)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }
    if (error?.message?.includes('stok düzəlişi mümkün deyil')) {
      return res.status(400).json({ message: error.message })
    }
    console.error('Update purchase invoice error:', error)
    res.status(500).json({ message: 'Alış qaiməsi yenilənərkən xəta baş verdi' })
  }
}

export const updatePurchaseInvoiceStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    const invoice = await prisma.purchase_invoices.update({
      where: { id: parseInt(id) },
      data: {
        is_active: is_active,
      },
      include: {
        suppliers: true,
        purchase_invoice_items: {
          include: {
            products: true,
          },
        },
      },
    })

    res.json(invoice)
  } catch (error) {
    console.error('Update purchase invoice status error:', error)
    res.status(500).json({ message: 'Alış qaiməsi statusu yenilənərkən xəta baş verdi' })
  }
}

export const deletePurchaseInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Faktura maddələrini sil (cascade ilə avtomatik silinir, amma təhlükəsizlik üçün yoxlayırıq)
    await prisma.purchase_invoice_items.deleteMany({
      where: { invoice_id: parseInt(id) },
    })

    // Fakturanı sil
    await prisma.purchase_invoices.delete({
      where: { id: parseInt(id) },
    })

    res.json({ message: 'Alış qaiməsi silindi' })
  } catch (error) {
    console.error('Delete purchase invoice error:', error)
    res.status(500).json({ message: 'Alış qaiməsi silinərkən xəta baş verdi' })
  }
}

