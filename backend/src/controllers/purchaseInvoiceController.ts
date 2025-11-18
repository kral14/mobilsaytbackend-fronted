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

    // Faktura nömrəsi yarat (ardıcıl format: PI-0000000001)
    const lastInvoice = await prisma.purchase_invoices.findFirst({
      where: {
        invoice_number: {
          startsWith: 'PI-'
        }
      },
      orderBy: {
        id: 'desc'
      }
    })
    
    let nextNumber = 1
    if (lastInvoice) {
      // Son qaimə nömrəsindən rəqəmi çıxar (PI-0000000001 və ya PI-1763327417457 -> rəqəm)
      const match = lastInvoice.invoice_number.match(/PI-(\d+)/)
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
    
    // 10 rəqəmli format: PI-0000000001
    const invoiceNumber = `PI-${String(nextNumber).padStart(10, '0')}`

    // Ümumi məbləği hesabla
    let totalAmount = 0
    items.forEach((item: any) => {
      totalAmount += parseFloat(item.total_price)
    })

    // Faktura yarat
    const invoice = await prisma.purchase_invoices.create({
      data: {
        invoice_number: invoiceNumber,
        supplier_id: supplier_id || null,
        total_amount: totalAmount,
        notes: notes || null,
        is_active: is_active !== undefined ? is_active : true,
      },
    })

    // Faktura maddələrini yarat
    const invoiceItems = await Promise.all(
      items.map((item: any) =>
        prisma.purchase_invoice_items.create({
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

    // Anbar qalığını artır
    for (const item of items) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { product_id: item.product_id },
      })

      if (warehouse) {
        await prisma.warehouse.update({
          where: { id: warehouse.id },
          data: {
            quantity: Number(warehouse.quantity || 0) + parseFloat(item.quantity),
          },
        })
      } else {
        // Əgər warehouse yoxdursa, yarat
        await prisma.warehouse.create({
          data: {
            product_id: item.product_id,
            quantity: parseFloat(item.quantity),
          },
        })
      }
    }

    const result = await prisma.purchase_invoices.findUnique({
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

    res.status(201).json(result)
  } catch (error) {
    console.error('Create purchase invoice error:', error)
    res.status(500).json({ message: 'Alış qaiməsi yaradılarkən xəta baş verdi' })
  }
}

export const updatePurchaseInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { supplier_id, items, notes, is_active } = req.body

    const invoice = await prisma.purchase_invoices.findUnique({
      where: { id: parseInt(id) },
      include: {
        purchase_invoice_items: true,
      },
    })

    if (!invoice) {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }

    // Köhnə item-ləri sil
    await prisma.purchase_invoice_items.deleteMany({
      where: { invoice_id: parseInt(id) },
    })

    // Yeni item-ləri əlavə et
    if (items && Array.isArray(items)) {
      await Promise.all(
        items.map((item: any) =>
          prisma.purchase_invoice_items.create({
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

    // Ümumi məbləği hesabla
    const totalAmount = items && Array.isArray(items)
      ? items.reduce((sum: number, item: any) => sum + parseFloat(item.total_price || 0), 0)
      : invoice.total_amount

    // Qaiməni yenilə
    const updateData: any = {}
    if (supplier_id !== undefined) updateData.supplier_id = supplier_id || null
    if (totalAmount !== undefined) updateData.total_amount = totalAmount
    if (notes !== undefined) updateData.notes = notes || null
    if (is_active !== undefined) updateData.is_active = is_active

    const updatedInvoice = await prisma.purchase_invoices.update({
      where: { id: parseInt(id) },
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

    res.json(updatedInvoice)
  } catch (error) {
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

