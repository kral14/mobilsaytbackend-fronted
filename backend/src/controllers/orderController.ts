import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

// Satış fakturaları (sale_invoices) - bu bizim "orders" kimi işləyir
export const getAllOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const invoices = await prisma.sale_invoices.findMany({
      include: {
        customers: true,
        sale_invoice_items: {
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
  } catch (error: any) {
    console.error('❌ [ERROR] Get orders error:')
    console.error('❌ [ERROR] Error message:', error.message)
    console.error('❌ [ERROR] Error code:', error.code)
    console.error('❌ [ERROR] Error stack:', error.stack)
    console.error('❌ [ERROR] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    res.status(500).json({ 
      message: 'Sifarişlər yüklənərkən xəta baş verdi',
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const invoice = await prisma.sale_invoices.findUnique({
      where: { id: parseInt(id) },
      include: {
        customers: true,
        sale_invoice_items: {
          include: {
            products: true,
          },
        },
      },
    })

    if (!invoice) {
      return res.status(404).json({ message: 'Sifariş tapılmadı' })
    }

    res.json(invoice)
  } catch (error) {
    console.error('Get order error:', error)
    res.status(500).json({ message: 'Sifariş yüklənərkən xəta baş verdi' })
  }
}

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { customer_id, items, notes, payment_date, invoice_number, is_active } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Məhsul seçilməlidir' })
    }

    const response = await prisma.$transaction(async (tx) => {
      let invoiceNumber = invoice_number
      if (!invoiceNumber) {
        const lastInvoice = await tx.sale_invoices.findFirst({
          where: { invoice_number: { startsWith: 'SI-' } },
          orderBy: { id: 'desc' },
        })

        let nextNumber = 1
        if (lastInvoice) {
          const match = lastInvoice.invoice_number.match(/SI-(\d+)/)
          if (match) {
            const lastNumber = parseInt(match[1], 10)
            nextNumber = lastNumber > 9999999999 ? 1 : lastNumber + 1
          }
        }

        invoiceNumber = `SI-${String(nextNumber).padStart(10, '0')}`
      }

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

      // Stok mövcudluğunu əvvəlcədən yoxla
      for (const item of normalizedItems) {
        const warehouse = await tx.warehouse.findFirst({
          where: { product_id: item.product_id },
        })
        const currentQuantity = Number(warehouse?.quantity ?? 0)

        if (!warehouse || currentQuantity < item.quantity) {
          throw new Error(`Məhsul ID ${item.product_id} üçün anbarda kifayət qədər qalığ yoxdur`)
        }
      }

      const invoice = await tx.sale_invoices.create({
        data: {
          invoice_number: invoiceNumber,
          customer_id: customer_id ? Number(customer_id) : null,
          total_amount: totalAmount,
          notes: notes || null,
          payment_date: payment_date ? new Date(payment_date) : null,
          is_active: is_active !== undefined ? Boolean(is_active) : false,
        },
      })

      await Promise.all(
        normalizedItems.map((item: { product_id: number; quantity: number; unit_price: number; total_price: number }) =>
          tx.sale_invoice_items.create({
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

        if (!warehouse) {
          throw new Error(`Məhsul ID ${item.product_id} üçün anbar qeydiyyatı tapılmadı`)
        }

        await tx.warehouse.update({
          where: { id: warehouse.id },
          data: {
            quantity: Number(warehouse.quantity || 0) - item.quantity,
          },
        })
      }

      return tx.sale_invoices.findUnique({
        where: { id: invoice.id },
        include: {
          customers: true,
          sale_invoice_items: {
            include: {
              products: true,
            },
          },
        },
      })
    })

    res.status(201).json(response)
  } catch (error: any) {
    if (error?.message?.includes('anbarda kifayət qədər qalığ yoxdur')) {
      return res.status(400).json({ message: error.message })
    }

    console.error('Create order error:', error)
    res.status(500).json({ message: 'Sifariş yaradılarkən xəta baş verdi' })
  }
}

export const updateOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { customer_id, items, notes, payment_date } = req.body

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.sale_invoices.findUnique({
        where: { id: parseInt(id, 10) },
        include: { sale_invoice_items: true },
      })

      if (!invoice) {
        throw new Error('NOT_FOUND')
      }

      // Köhnə item-lərin stokunu geri qaytar
      for (const item of invoice.sale_invoice_items) {
        if (!item.product_id) {
          continue
        }
        const warehouse = await tx.warehouse.findFirst({
          where: { product_id: item.product_id },
        })
        if (warehouse) {
          await tx.warehouse.update({
            where: { id: warehouse.id },
            data: {
              quantity: Number(warehouse.quantity || 0) + Number(item.quantity),
            },
          })
        }
      }

      await tx.sale_invoice_items.deleteMany({
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

        for (const item of normalizedItems) {
          const warehouse = await tx.warehouse.findFirst({
            where: { product_id: item.product_id },
          })
          const currentQuantity = Number(warehouse?.quantity ?? 0)

          if (!warehouse || currentQuantity < item.quantity) {
            throw new Error(`Məhsul ID ${item.product_id} üçün anbarda kifayət qədər qalığ yoxdur`)
          }
        }

        await Promise.all(
          normalizedItems.map((item) =>
            tx.sale_invoice_items.create({
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
          if (!warehouse) {
            throw new Error(`Məhsul ID ${item.product_id} üçün anbar qeydiyyatı tapılmadı`)
          }
          await tx.warehouse.update({
            where: { id: warehouse.id },
            data: {
              quantity: Number(warehouse.quantity || 0) - item.quantity,
            },
          })
        }
      }

      const totalAmount =
        normalizedItems.length > 0
          ? normalizedItems.reduce(
              (sum: number, item: { total_price: number }) => sum + item.total_price,
              0,
            )
          : invoice.total_amount

      return tx.sale_invoices.update({
        where: { id: invoice.id },
        data: {
          ...(customer_id !== undefined && { customer_id: customer_id ? Number(customer_id) : null }),
          ...(totalAmount !== undefined && { total_amount: totalAmount }),
          ...(notes !== undefined && { notes }),
          ...(payment_date !== undefined && { payment_date: payment_date ? new Date(payment_date) : null }),
        },
        include: {
          customers: true,
          sale_invoice_items: {
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
    if (error?.message?.includes('anbarda kifayət qədər qalığ yoxdur')) {
      return res.status(400).json({ message: error.message })
    }
    console.error('Update order error:', error)
    res.status(500).json({ message: 'Qaimə yenilənərkən xəta baş verdi' })
  }
}

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    const invoice = await prisma.sale_invoices.findUnique({
      where: { id: parseInt(id) },
    })

    if (!invoice) {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }

    const updatedInvoice = await prisma.sale_invoices.update({
      where: { id: parseInt(id) },
      data: {
        ...(is_active !== undefined && { is_active }),
      },
      include: {
        customers: true,
        sale_invoice_items: {
          include: {
            products: true,
          },
        },
      },
    })

    res.json(updatedInvoice)
  } catch (error) {
    console.error('Update order status error:', error)
    res.status(500).json({ message: 'Qaimə statusu yenilənərkən xəta baş verdi' })
  }
}
