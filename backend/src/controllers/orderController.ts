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

    // Faktura nömrəsi yarat (əgər göndərilməyibsə)
    let invoiceNumber = invoice_number
    if (!invoiceNumber) {
      // Ən son yaradılan qaiməni tap (id-yə görə sırala)
      const lastInvoice = await prisma.sale_invoices.findFirst({
        where: {
          invoice_number: {
            startsWith: 'SI-'
          }
        },
        orderBy: {
          id: 'desc'
        }
      })
      
      let nextNumber = 1
      if (lastInvoice) {
        // Son qaimə nömrəsindən rəqəmi çıxar (SI-0000000001 və ya SI-1763327417457 -> rəqəm)
        const match = lastInvoice.invoice_number.match(/SI-(\d+)/)
        if (match) {
          const lastNumber = parseInt(match[1], 10)
          // Əgər köhnə formatdırsa (timestamp kimi böyük rəqəm), yeni formatdan başla
          // Yeni format: 10 rəqəmli (maksimum 9999999999)
          if (lastNumber > 9999999999) {
            nextNumber = 1
          } else {
            nextNumber = lastNumber + 1
          }
        }
      }
      
      // 10 rəqəmli format: SI-0000000001
      invoiceNumber = `SI-${String(nextNumber).padStart(10, '0')}`
    }

    // Ümumi məbləği hesabla
    let totalAmount = 0
    items.forEach((item: any) => {
      totalAmount += parseFloat(item.total_price)
    })

    // Faktura yarat
    const invoice = await prisma.sale_invoices.create({
      data: {
        invoice_number: invoiceNumber,
        customer_id: customer_id || null,
        total_amount: totalAmount,
        notes: notes || null,
        payment_date: payment_date ? new Date(payment_date) : null,
        is_active: is_active !== undefined ? is_active : false, // Default false, yalnız OK düyməsinə basılanda true olacaq
      },
    })

    // Faktura maddələrini yarat
    const invoiceItems = await Promise.all(
      items.map((item: any) =>
        prisma.sale_invoice_items.create({
          data: {
            invoice_id: invoice.id,
            product_id: item.product_id,
            quantity: parseFloat(item.quantity),
            unit_price: parseFloat(item.unit_price),
            total_price: parseFloat(item.total_price),
          },
        })
      )
    )

    // Anbar qalığını azalt
    for (const item of items) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { product_id: item.product_id },
      })

      if (warehouse) {
        await prisma.warehouse.update({
          where: { id: warehouse.id },
          data: {
            quantity: Number(warehouse.quantity || 0) - parseFloat(item.quantity),
          },
        })
      }
    }

    const result = await prisma.sale_invoices.findUnique({
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

    res.status(201).json(result)
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({ message: 'Sifariş yaradılarkən xəta baş verdi' })
  }
}

export const updateOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { customer_id, items, notes, payment_date } = req.body

    const invoice = await prisma.sale_invoices.findUnique({
      where: { id: parseInt(id) },
      include: {
        sale_invoice_items: true,
      },
    })

    if (!invoice) {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }

    // Köhnə item-ləri sil
    await prisma.sale_invoice_items.deleteMany({
      where: { invoice_id: parseInt(id) },
    })

    // Yeni item-ləri əlavə et
    if (items && Array.isArray(items)) {
      await Promise.all(
        items.map((item: any) =>
          prisma.sale_invoice_items.create({
            data: {
              invoice_id: parseInt(id),
              product_id: item.product_id,
              quantity: parseFloat(item.quantity),
              unit_price: parseFloat(item.unit_price),
              total_price: parseFloat(item.total_price),
            },
          })
        )
      )
    }

    // Qaiməni yenilə
    const totalAmount = items && Array.isArray(items)
      ? items.reduce((sum: number, item: any) => sum + parseFloat(item.total_price || 0), 0)
      : invoice.total_amount

    const updatedInvoice = await prisma.sale_invoices.update({
      where: { id: parseInt(id) },
      data: {
        ...(customer_id !== undefined && { customer_id }),
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

    res.json(updatedInvoice)
  } catch (error) {
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
