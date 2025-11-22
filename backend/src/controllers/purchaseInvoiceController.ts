import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { logWarehouseChange, logInvoiceCreated, logInvoiceDeleted, logInvoiceRestored, logSupplierBalanceChange, createLog } from '../utils/logger'

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
  // Log məlumatlarını toplamaq üçün
  const logPromises: Promise<void>[] = []
  
  try {
    console.log('🟢 [CREATE INVOICE] Request gəldi:', {
      userId: req.userId,
      supplier_id: req.body.supplier_id,
      itemsCount: req.body.items?.length,
      is_active: req.body.is_active,
    })
    const { supplier_id, items, notes, is_active } = req.body

    if (!items || items.length === 0) {
      console.log('❌ [CREATE INVOICE] Xəta: Məhsul seçilməyib')
      return res.status(400).json({ message: 'Məhsul seçilməlidir' })
    }

    const response = await prisma.$transaction(async (tx) => {
      // Bütün mövcud qaimələrə bax (köhnə PI-... və yeni AL... daxil olmaqla)
      // və ID-yə görə ən son yaradılanı götür. Nömrə həmişə ardıcıl getsin: 01, 02, 03...
      const lastInvoice = await tx.purchase_invoices.findFirst({
        orderBy: { id: 'desc' },
      })

      let nextNumber = 1
      if (lastInvoice?.invoice_number) {
        // Prefiksdən (PI-, AL və s.) asılı olmayaraq yalnız rəqəm hissəsini çıxar
        const match = lastInvoice.invoice_number.match(/(\d+)/)
        if (match) {
          const lastNumber = parseInt(match[1], 10)
          nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1
        }
      }

      // Yeni alış qaiməsi nömrəsi: AL + 8 rəqəm, məsələn AL00000001, AL00000002 və s.
      const invoiceNumber = `AL${String(nextNumber).padStart(8, '0')}`

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

      // Yalnız təsdiqlənmiş qaimələr üçün anbar qalığını artır
      const invoiceIsActive = is_active !== undefined ? Boolean(is_active) : true
      if (invoiceIsActive) {
        for (const item of normalizedItems) {
          const warehouse = await tx.warehouse.findFirst({
            where: { product_id: item.product_id },
            include: { products: true },
          })

          if (warehouse) {
            const oldQuantity = Number(warehouse.quantity || 0)
            const newQuantity = oldQuantity + item.quantity
            await tx.warehouse.update({
              where: { id: warehouse.id },
              data: {
                quantity: newQuantity,
              },
            })

            // Log yaz (transaction-dan sonra)
            logPromises.push(
              logWarehouseChange(
                req.userId,
                item.product_id,
                warehouse.products?.name || `ID ${item.product_id}`,
                warehouse.products?.code || null,
                oldQuantity,
                newQuantity,
                item.quantity,
                invoiceNumber,
                'purchase',
                'confirmed'
              )
            )
          } else {
            const newWarehouse = await tx.warehouse.create({
              data: {
                product_id: item.product_id,
                quantity: item.quantity,
              },
              include: { products: true },
            })

            // Log yaz (transaction-dan sonra)
            logPromises.push(
              logWarehouseChange(
                req.userId,
                item.product_id,
                newWarehouse.products?.name || `ID ${item.product_id}`,
                newWarehouse.products?.code || null,
                0,
                item.quantity,
                item.quantity,
                invoiceNumber,
                'purchase',
                'confirmed'
              )
            )
          }
        }

        // Təchizatçının balansını artır (bizim borcumuz artır)
        // Əgər balans mənfidirsə (təchizatçı bizə borclu), yeni borc mənfi balansdan başlayır
        if (supplier_id) {
          const supplier = await tx.suppliers.findUnique({
            where: { id: supplier_id },
          })
          if (supplier) {
            const currentBalance = Number(supplier.balance || 0)
            const newBalance = currentBalance + totalAmount // Mənfi balansdan başlaya bilər
            await tx.suppliers.update({
              where: { id: supplier_id },
              data: {
                balance: newBalance,
              },
            })
            
            // Log yaz (transaction-dan sonra)
            logPromises.push(
              logSupplierBalanceChange(
                req.userId,
                supplier_id,
                supplier.name,
                currentBalance,
                newBalance,
                totalAmount,
                invoiceNumber,
                'invoice_confirmed'
              )
            )
          }
        }
      }

      // Supplier məlumatını topla (log üçün)
      const supplier = supplier_id ? await tx.suppliers.findUnique({ where: { id: supplier_id } }) : null

      return {
        invoice: await tx.purchase_invoices.findUnique({
          where: { id: invoice.id },
          include: {
            suppliers: true,
            purchase_invoice_items: {
              include: {
                products: true,
              },
            },
          },
        }),
        supplierName: supplier?.name || null,
      }
    }, {
      maxWait: 10000, // 10 saniyə gözlə
      timeout: 20000, // 20 saniyə timeout
    })

    // Qaimə yaradıldı log (transaction-dan sonra)
    logPromises.push(
      logInvoiceCreated(req.userId, response.invoice.id, response.invoice.invoice_number, 'purchase', response.supplierName)
    )

    // Log yazmalarını transaction-dan sonra et (async)
    Promise.all(logPromises).catch(err => {
      console.error('❌ [CREATE INVOICE] Log yazılarkən xəta:', err)
    })

    console.log('✅ [CREATE INVOICE] Qaimə yaradıldı:', {
      id: response.invoice.id,
      invoice_number: response.invoice.invoice_number,
      is_active: response.invoice.is_active,
    })
    res.status(201).json(response.invoice)
  } catch (error: any) {
    console.error('❌ [CREATE INVOICE] Xəta:', error)
    console.error('❌ [CREATE INVOICE] Xəta detalları:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })
    res.status(500).json({ 
      message: 'Alış qaiməsi yaradılarkən xəta baş verdi',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
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

      // Köhnə item-lərin təsirini geri al (yalnız təsdiqlənmiş qaimələr üçün)
      if (invoice.is_active) {
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
          const itemQuantity = Number(item.quantity)
          // Mənfi qalıq ola bilər (satışdan sonra mənfi qalıq yaranıbsa)
          const newQuantity = currentQuantity - itemQuantity
          await tx.warehouse.update({
            where: { id: warehouse.id },
            data: {
              quantity: newQuantity,
            },
          })
        }

        // Köhnə təchizatçının balansını azalt (bizim borcumuz azalır)
        if (invoice.supplier_id) {
          const oldSupplier = await tx.suppliers.findUnique({
            where: { id: invoice.supplier_id },
          })
          if (oldSupplier) {
            const oldTotalAmount = Number(invoice.total_amount || 0)
            const currentBalance = Number(oldSupplier.balance || 0)
            // Mənfi balans ola bilər (ödəniş borcdan çoxdursa)
            const newBalance = currentBalance - oldTotalAmount
            await tx.suppliers.update({
              where: { id: invoice.supplier_id },
              data: {
                balance: newBalance,
              },
            })
            
            // Log yaz
            await logSupplierBalanceChange(
              req.userId,
              invoice.supplier_id,
              oldSupplier.name,
              currentBalance,
              newBalance,
              -oldTotalAmount,
              invoice.invoice_number,
              'invoice_unconfirmed'
            )
          }
        }
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

        // Yalnız təsdiqlənmiş qaimələr üçün anbar qalığını artır
        const newIsActive = is_active !== undefined ? Boolean(is_active) : invoice.is_active
        if (newIsActive) {
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
      }

      const totalAmount =
        normalizedItems.length > 0
          ? normalizedItems.reduce(
              (sum: number, item: { total_price: number }) => sum + item.total_price,
              0,
            )
          : invoice.total_amount

      // Yeni təchizatçının balansını artır (bizim borcumuz artır)
      const newIsActiveForBalance = is_active !== undefined ? Boolean(is_active) : invoice.is_active
      if (newIsActiveForBalance) {
        const newSupplierId = supplier_id !== undefined ? (supplier_id ? Number(supplier_id) : null) : invoice.supplier_id
        if (newSupplierId) {
          const newSupplier = await tx.suppliers.findUnique({
            where: { id: newSupplierId },
          })
          if (newSupplier) {
            const currentBalance = Number(newSupplier.balance || 0)
            const newBalance = currentBalance + totalAmount
            await tx.suppliers.update({
              where: { id: newSupplierId },
              data: {
                balance: newBalance,
              },
            })
            
            // Log yaz
            await logSupplierBalanceChange(
              req.userId,
              newSupplierId,
              newSupplier.name,
              currentBalance,
              newBalance,
              totalAmount,
              invoice.invoice_number,
              'invoice_confirmed'
            )
          }
        }
      }

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

    // Log məlumatlarını toplamaq üçün
    const logPromises: Promise<void>[] = []

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchase_invoices.findUnique({
        where: { id: parseInt(id) },
        include: {
          purchase_invoice_items: true,
        },
      })

      if (!invoice) {
        throw new Error('NOT_FOUND')
      }

      // Silinmiş qaimələri təsdiqləmək olmaz (həm təsdiqsiz, həm də təsdiqlənmiş ola bilər)
      if (invoice.is_deleted) {
        throw new Error('CANNOT_CONFIRM_DELETED')
      }

      const oldIsActive = invoice.is_active
      const newIsActive = Boolean(is_active)

      // Status dəyişikliyi yalnız fərqli olduqda anbar qalığına təsir edir
      if (oldIsActive !== newIsActive) {
        if (newIsActive) {
          // Təsdiqlənir - anbar qalığını artır
          for (const item of invoice.purchase_invoice_items) {
            if (!item.product_id) {
              continue
            }
            const warehouse = await tx.warehouse.findFirst({
              where: { product_id: item.product_id },
              include: { products: true },
            })

            if (warehouse) {
              const oldQuantity = Number(warehouse.quantity || 0)
              const newQuantity = oldQuantity + Number(item.quantity)
              await tx.warehouse.update({
                where: { id: warehouse.id },
                data: {
                  quantity: newQuantity,
                },
              })

              // Log yaz (transaction-dan sonra)
              logPromises.push(
                logWarehouseChange(
                  req.userId,
                  item.product_id,
                  warehouse.products?.name || `ID ${item.product_id}`,
                  warehouse.products?.code || null,
                  oldQuantity,
                  newQuantity,
                  Number(item.quantity),
                  invoice.invoice_number,
                  'purchase',
                  'confirmed'
                )
              )
            } else {
              const newWarehouse = await tx.warehouse.create({
                data: {
                  product_id: item.product_id,
                  quantity: Number(item.quantity),
                },
                include: { products: true },
              })

              // Log yaz (transaction-dan sonra)
              logPromises.push(
                logWarehouseChange(
                  req.userId,
                  item.product_id,
                  newWarehouse.products?.name || `ID ${item.product_id}`,
                  newWarehouse.products?.code || null,
                  0,
                  Number(item.quantity),
                  Number(item.quantity),
                  invoice.invoice_number,
                  'purchase',
                  'confirmed'
                )
              )
            }
          }

          // Təchizatçının balansını artır (bizim borcumuz artır)
          if (invoice.supplier_id) {
            const supplier = await tx.suppliers.findUnique({
              where: { id: invoice.supplier_id },
            })
            if (supplier) {
              const totalAmount = Number(invoice.total_amount || 0)
              const currentBalance = Number(supplier.balance || 0)
              const newBalance = currentBalance + totalAmount
              await tx.suppliers.update({
                where: { id: invoice.supplier_id },
                data: {
                  balance: newBalance,
                },
              })
              
              // Log yaz (transaction-dan sonra)
              logPromises.push(
                logSupplierBalanceChange(
                  req.userId,
                  invoice.supplier_id,
                  supplier.name,
                  currentBalance,
                  newBalance,
                  totalAmount,
                  invoice.invoice_number,
                  'invoice_confirmed'
                )
              )
            }
          }
        } else {
          // Təsdiqsiz edilir - anbar qalığını azalt
          for (const item of invoice.purchase_invoice_items) {
            if (!item.product_id) {
              continue
            }
            const warehouse = await tx.warehouse.findFirst({
              where: { product_id: item.product_id },
              include: { products: true },
            })

            if (warehouse) {
              const currentQuantity = Number(warehouse.quantity || 0)
              const itemQuantity = Number(item.quantity)
              // Anbar qalığı 0-dan az ola bilməz
              const newQuantity = Math.max(0, currentQuantity - itemQuantity)
              await tx.warehouse.update({
                where: { id: warehouse.id },
                data: {
                  quantity: newQuantity,
                },
              })

              // Log yaz (transaction-dan sonra)
              logPromises.push(
                logWarehouseChange(
                  req.userId,
                  item.product_id,
                  warehouse.products?.name || `ID ${item.product_id}`,
                  warehouse.products?.code || null,
                  currentQuantity,
                  newQuantity,
                  -itemQuantity,
                  invoice.invoice_number,
                  'purchase',
                  'unconfirmed'
                )
              )
            }
          }

          // Təchizatçının balansını azalt (bizim borcumuz azalır)
          if (invoice.supplier_id) {
            const supplier = await tx.suppliers.findUnique({
              where: { id: invoice.supplier_id },
            })
            if (supplier) {
              const totalAmount = Number(invoice.total_amount || 0)
              const currentBalance = Number(supplier.balance || 0)
              // Mənfi balans ola bilər (ödəniş borcdan çoxdursa)
              const newBalance = currentBalance - totalAmount
              await tx.suppliers.update({
                where: { id: invoice.supplier_id },
                data: {
                  balance: newBalance,
                },
              })
              
              // Log yaz (transaction-dan sonra)
              logPromises.push(
                logSupplierBalanceChange(
                  req.userId,
                  invoice.supplier_id,
                  supplier.name,
                  currentBalance,
                  newBalance,
                  -totalAmount,
                  invoice.invoice_number,
                  'invoice_unconfirmed'
                )
              )
            }
          }
        }
      }

      return tx.purchase_invoices.update({
        where: { id: parseInt(id) },
        data: {
          is_active: newIsActive,
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
    }, {
      maxWait: 10000, // 10 saniyə gözlə
      timeout: 20000, // 20 saniyə timeout
    })

    // Log yazmalarını transaction-dan sonra et (async)
    Promise.all(logPromises).catch(err => {
      console.error('❌ [ERROR] Log yazılarkən xəta:', err)
    })

    res.json(updatedInvoice)
  } catch (error: any) {
    console.error('❌ [ERROR] Update purchase invoice status error:')
    console.error('❌ [ERROR] Error message:', error.message)
    console.error('❌ [ERROR] Error code:', error.code)
    console.error('❌ [ERROR] Error stack:', error.stack)
    console.error('❌ [ERROR] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    // Xətanı log faylına yaz
    try {
      await createLog({
        user_id: req.userId,
        action_type: 'error',
        entity_type: 'purchase_invoice',
        entity_id: req.params.id ? parseInt(req.params.id) : null,
        description: `Alış qaiməsi statusu yenilənərkən xəta baş verdi: ${error.message}`,
        details: {
          error_message: error.message,
          error_code: error.code,
          error_stack: error.stack,
          invoice_id: req.params.id,
        },
      })
    } catch (logError) {
      console.error('❌ [ERROR] Log yazıla bilmədi:', logError)
    }
    
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }
    if (error.message?.includes('stok düzəlişi mümkün deyil')) {
      return res.status(400).json({ message: error.message })
    }
    if (error.message === 'CANNOT_CONFIRM_DELETED') {
      return res.status(400).json({ message: 'Silinmiş qaiməni təsdiqləmək olmaz' })
    }
    res.status(500).json({ 
      message: 'Alış qaiməsi statusu yenilənərkən xəta baş verdi',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

export const deletePurchaseInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchase_invoices.findUnique({
        where: { id: parseInt(id) },
        include: {
          purchase_invoice_items: true,
        },
      })

      if (!invoice) {
        throw new Error('NOT_FOUND')
      }

      // Yalnız təsdiqlənmiş qaimələr üçün anbar qalığını azalt
      if (invoice.is_active) {
        for (const item of invoice.purchase_invoice_items) {
          if (!item.product_id) {
            continue
          }
          const warehouse = await tx.warehouse.findFirst({
            where: { product_id: item.product_id },
            include: { products: true },
          })

          if (warehouse) {
            const currentQuantity = Number(warehouse.quantity || 0)
            const itemQuantity = Number(item.quantity)
            // Mənfi qalıq ola bilər (satışdan sonra mənfi qalıq yaranıbsa)
            const newQuantity = currentQuantity - itemQuantity
            await tx.warehouse.update({
              where: { id: warehouse.id },
              data: {
                quantity: newQuantity,
              },
            })

            // Log yaz
            await logWarehouseChange(
              req.userId,
              item.product_id,
              warehouse.products?.name || `ID ${item.product_id}`,
              warehouse.products?.code || null,
              currentQuantity,
              newQuantity,
              -itemQuantity,
              invoice.invoice_number,
              'purchase',
              'deleted'
            )
          }
        }

        // Təchizatçının balansını azalt (bizim borcumuz azalır)
        if (invoice.supplier_id) {
          const supplier = await tx.suppliers.findUnique({
            where: { id: invoice.supplier_id },
          })
          if (supplier) {
            const totalAmount = Number(invoice.total_amount || 0)
            const currentBalance = Number(supplier.balance || 0)
            const newBalance = Math.max(0, currentBalance - totalAmount)
            await tx.suppliers.update({
              where: { id: invoice.supplier_id },
              data: {
                balance: newBalance,
              },
            })
            
            // Log yaz
            await logSupplierBalanceChange(
              req.userId,
              invoice.supplier_id,
              supplier.name,
              currentBalance,
              newBalance,
              -totalAmount,
              invoice.invoice_number,
              'invoice_deleted'
            )
          }
        }
      }

      // Qaiməni silmək əvəzinə, onu silinmiş kimi qeyd et (is_deleted = true, is_active = false)
      await tx.purchase_invoices.update({
        where: { id: parseInt(id) },
        data: {
          is_deleted: true,
          is_active: false,
        },
      })
    })

    // Qaimə silindi log
    const invoice = await prisma.purchase_invoices.findUnique({
      where: { id: parseInt(id) },
    })
    if (invoice) {
      await logInvoiceDeleted(req.userId, invoice.id, invoice.invoice_number, 'purchase')
    }

    res.json({ message: 'Alış qaiməsi silindi' })
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }
    if (error.message?.includes('stok düzəlişi mümkün deyil')) {
      return res.status(400).json({ message: error.message })
    }
    console.error('Delete purchase invoice error:', error)
    res.status(500).json({ message: 'Alış qaiməsi silinərkən xəta baş verdi' })
  }
}

// Silinmiş qaiməni geri qaytar (təsdiqsiz olaraq)
export const restorePurchaseInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const restoredInvoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchase_invoices.findUnique({
        where: { id: parseInt(id) },
      })

      if (!invoice) {
        throw new Error('NOT_FOUND')
      }

      if (!invoice.is_deleted) {
        throw new Error('ALREADY_ACTIVE')
      }

      // Qaiməni geri qaytar, amma təsdiqsiz olaraq saxla
      return tx.purchase_invoices.update({
        where: { id: parseInt(id) },
        data: {
          is_deleted: false,
          is_active: false, // Təsdiqsiz olaraq saxla
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
    })

    // Qaimə geri qaytarıldı log
    await logInvoiceRestored(req.userId, restoredInvoice.id, restoredInvoice.invoice_number, 'purchase')

    res.json(restoredInvoice)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }
    if (error.message === 'ALREADY_ACTIVE') {
      return res.status(400).json({ message: 'Qaimə artıq aktivdir' })
    }
    console.error('Restore purchase invoice error:', error)
    res.status(500).json({ message: 'Qaimə geri qaytarılarkən xəta baş verdi' })
  }
}

// Anbar qalığını təsdiqlənmiş qaimələrə görə düzəlt
export const syncWarehouseStock = async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Bütün təsdiqlənmiş və silinməmiş qaimələri götür
      const activeInvoices = await tx.purchase_invoices.findMany({
        where: {
          is_active: true,
          is_deleted: false,
        },
        include: {
          purchase_invoice_items: {
            where: {
              product_id: { not: null },
            },
          },
        },
      })

      // Məhsul ID-yə görə miqdarları topla
      const calculatedStock: Record<number, number> = {}
      
      for (const invoice of activeInvoices) {
        for (const item of invoice.purchase_invoice_items) {
          if (item.product_id) {
            const productId = item.product_id
            const quantity = Number(item.quantity || 0)
            calculatedStock[productId] = (calculatedStock[productId] || 0) + quantity
          }
        }
      }

      // Mövcud anbar qalıqlarını götür
      const warehouses = await tx.warehouse.findMany({
        where: {
          product_id: { in: Object.keys(calculatedStock).map(Number) },
        },
      })

      const updates: Array<{ productId: number; oldQuantity: number; newQuantity: number }> = []
      const creates: Array<{ productId: number; quantity: number }> = []

      // Mövcud anbar qeydlərini yenilə və ya yarat
      for (const [productIdStr, calculatedQuantity] of Object.entries(calculatedStock)) {
        const productId = Number(productIdStr)
        const existingWarehouse = warehouses.find(w => w.product_id === productId)

        if (existingWarehouse) {
          const oldQuantity = Number(existingWarehouse.quantity || 0)
          if (oldQuantity !== calculatedQuantity) {
            await tx.warehouse.update({
              where: { id: existingWarehouse.id },
              data: { quantity: calculatedQuantity },
            })
            updates.push({ productId, oldQuantity, newQuantity: calculatedQuantity })
          }
        } else {
          await tx.warehouse.create({
            data: {
              product_id: productId,
              quantity: calculatedQuantity,
            },
          })
          creates.push({ productId, quantity: calculatedQuantity })
        }
      }

      // Hesablanmış qalığı olmayan məhsulların qalığını 0-a endir (yalnız təsdiqlənmiş qaimələrdə olmayan məhsullar)
      // Amma bu təhlükəlidir, çünki satış qaimələri də var. Ona görə də bu hissəni atlayaq.

      return {
        totalInvoices: activeInvoices.length,
        updatedWarehouses: updates.length,
        createdWarehouses: creates.length,
        updates,
        creates,
      }
    })

    res.json({
      message: 'Anbar qalığı uğurla sinxronizasiya edildi',
      ...result,
    })
  } catch (error: any) {
    console.error('Sync warehouse stock error:', error)
    res.status(500).json({ message: 'Anbar qalığı sinxronizasiya edilərkən xəta baş verdi' })
  }
}

