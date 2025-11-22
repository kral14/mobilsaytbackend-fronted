import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { logWarehouseChange, logInvoiceCreated, logInvoiceDeleted, logInvoiceRestored, logCustomerBalanceChange } from '../utils/logger'

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

      const invoiceIsActive = is_active !== undefined ? Boolean(is_active) : false

      // Yalnız təsdiqlənmiş qaimələr üçün stok yoxlaması və anbar qalığını azalt
      if (invoiceIsActive) {
        // Stok mövcudluğunu əvvəlcədən yoxla
        for (const item of normalizedItems) {
          const warehouse = await tx.warehouse.findFirst({
            where: { product_id: item.product_id },
            include: { products: true },
          })
          const currentQuantity = Number(warehouse?.quantity ?? 0)

          if (!warehouse || currentQuantity < item.quantity) {
            const productName = warehouse?.products?.name || `ID ${item.product_id}`
            const availableQuantity = currentQuantity
            if (currentQuantity <= 0) {
              throw new Error(`Seçilən məhsul "${productName}" üçün anbar qalığı yoxdur və ya azdır. Mövcud qalıq: ${availableQuantity}`)
            } else {
              throw new Error(`Seçilən məhsul "${productName}" üçün anbarda kifayət qədər qalığ yoxdur. Mövcud qalıq: ${availableQuantity}, Tələb olunan: ${item.quantity}`)
            }
          }
        }
      }

      const invoice = await tx.sale_invoices.create({
        data: {
          invoice_number: invoiceNumber,
          customer_id: customer_id ? Number(customer_id) : null,
          total_amount: totalAmount,
          notes: notes || null,
          payment_date: payment_date ? new Date(payment_date) : null,
          is_active: invoiceIsActive,
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

      // Yalnız təsdiqlənmiş qaimələr üçün anbar qalığını azalt
      if (invoiceIsActive) {
        for (const item of normalizedItems) {
          const warehouse = await tx.warehouse.findFirst({
            where: { product_id: item.product_id },
            include: { products: true },
          })

          if (!warehouse) {
            throw new Error(`Məhsul ID ${item.product_id} üçün anbar qeydiyyatı tapılmadı`)
          }

          const oldQuantity = Number(warehouse.quantity || 0)
          const newQuantity = oldQuantity - item.quantity

          await tx.warehouse.update({
            where: { id: warehouse.id },
            data: {
              quantity: newQuantity,
            },
          })

          // Log yaz
          await logWarehouseChange(
            req.userId ? parseInt(req.userId as string, 10) : null,
            item.product_id,
            warehouse.products?.name || `ID ${item.product_id}`,
            warehouse.products?.code || null,
            oldQuantity,
            newQuantity,
            -item.quantity,
            invoiceNumber,
            'sale',
            'confirmed'
          )
        }

        // Müştərinin balansını artır (onların borcu artır)
        if (customer_id) {
          const customer = await tx.customers.findUnique({
            where: { id: customer_id },
          })
          if (customer) {
            const currentBalance = Number(customer.balance || 0)
            const newBalance = currentBalance + totalAmount
            await tx.customers.update({
              where: { id: customer_id },
              data: {
                balance: newBalance,
              },
            })
            
            // Log yaz
            await logCustomerBalanceChange(
              req.userId ? parseInt(req.userId as string, 10) : null,
              customer_id,
              customer.name,
              currentBalance,
              newBalance,
              totalAmount,
              invoiceNumber,
              'invoice_confirmed'
            )
          }
        }
      }

      // Qaimə yaradıldığı üçün log yaz
      await logInvoiceCreated(
        req.userId ? parseInt(req.userId as string, 10) : null,
        invoice.id,
        invoiceNumber,
        'sale',
        customer_id ? (await tx.customers.findUnique({ where: { id: customer_id } }))?.name || null : null
      )

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

      // Köhnə item-lərin stokunu geri qaytar (yalnız təsdiqlənmiş qaimələr üçün)
      if (invoice.is_active) {
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
          } else {
            await tx.warehouse.create({
              data: {
                product_id: item.product_id,
                quantity: Number(item.quantity),
              },
            })
          }
        }

        // Köhnə müştərinin balansını azalt (onların borcu azalır)
        if (invoice.customer_id) {
          const oldCustomer = await tx.customers.findUnique({
            where: { id: invoice.customer_id },
          })
          if (oldCustomer) {
            const oldTotalAmount = Number(invoice.total_amount || 0)
            const currentBalance = Number(oldCustomer.balance || 0)
            // Mənfi balans ola bilər (ödəniş borcdan çoxdursa)
            const newBalance = currentBalance - oldTotalAmount
            await tx.customers.update({
              where: { id: invoice.customer_id },
              data: {
                balance: newBalance,
              },
            })
            
            // Log yaz
            await logCustomerBalanceChange(
              req.userId ? parseInt(req.userId as string, 10) : null,
              invoice.customer_id,
              oldCustomer.name,
              currentBalance,
              newBalance,
              -oldTotalAmount,
              invoice.invoice_number,
              'invoice_unconfirmed'
            )
          }
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

        // Yalnız təsdiqlənmiş qaimələr üçün stok yoxlaması və anbar qalığını azalt
        const newIsActive = invoice.is_active // Mövcud statusu saxla
        if (newIsActive) {
          for (const item of normalizedItems) {
            const warehouse = await tx.warehouse.findFirst({
              where: { product_id: item.product_id },
              include: { products: true },
            })
            const currentQuantity = Number(warehouse?.quantity ?? 0)

            if (!warehouse || currentQuantity < item.quantity) {
              const productName = warehouse?.products?.name || `ID ${item.product_id}`
              const availableQuantity = currentQuantity
              if (currentQuantity <= 0) {
                throw new Error(`Seçilən məhsul "${productName}" üçün anbar qalığı yoxdur və ya azdır. Mövcud qalıq: ${availableQuantity}`)
              } else {
                throw new Error(`Seçilən məhsul "${productName}" üçün anbarda kifayət qədər qalığ yoxdur. Mövcud qalıq: ${availableQuantity}, Tələb olunan: ${item.quantity}`)
              }
            }
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

        // Yalnız təsdiqlənmiş qaimələr üçün anbar qalığını azalt
        if (newIsActive) {
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
      }

      const totalAmount =
        normalizedItems.length > 0
          ? normalizedItems.reduce(
              (sum: number, item: { total_price: number }) => sum + item.total_price,
              0,
            )
          : invoice.total_amount

      // Yeni müştərinin balansını artır (onların borcu artır)
      const newIsActive = invoice.is_active // Mövcud statusu saxla
      if (newIsActive) {
        const newCustomerId = customer_id !== undefined ? (customer_id ? Number(customer_id) : null) : invoice.customer_id
        if (newCustomerId) {
          const newCustomer = await tx.customers.findUnique({
            where: { id: newCustomerId },
          })
          if (newCustomer) {
            const currentBalance = Number(newCustomer.balance || 0)
            const newBalance = currentBalance + totalAmount
            await tx.customers.update({
              where: { id: newCustomerId },
              data: {
                balance: newBalance,
              },
            })
            
            // Log yaz
            await logCustomerBalanceChange(
              req.userId ? parseInt(req.userId as string, 10) : null,
              newCustomerId,
              newCustomer.name,
              currentBalance,
              newBalance,
              totalAmount,
              invoice.invoice_number,
              'invoice_confirmed'
            )
          }
        }
      }

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

    // Log məlumatlarını toplamaq üçün
    const logPromises: Promise<void>[] = []

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.sale_invoices.findUnique({
        where: { id: parseInt(id) },
        include: {
          sale_invoice_items: {
            include: {
              products: true,
            },
          },
        },
      })

      if (!invoice) {
        throw new Error('NOT_FOUND')
      }

      // Silinmiş qaimələri təsdiqləmək olmaz
      if (invoice.is_deleted) {
        throw new Error('CANNOT_CONFIRM_DELETED')
      }

      const oldIsActive = invoice.is_active
      const newIsActive = Boolean(is_active)

      // Status dəyişikliyi yalnız fərqli olduqda anbar qalığına və balansa təsir edir
      if (oldIsActive !== newIsActive) {
        const totalAmount = Number(invoice.total_amount || 0)
        
        if (newIsActive) {
          // Təsdiqlənir - anbar qalığını azalt (satış qaiməsi)
          // Frontend-də artıq yoxlama edilir, burada yalnız azaltırıq (mənfiyə də gedə bilər)
          for (const item of invoice.sale_invoice_items) {
            if (!item.product_id) {
              continue
            }
            const warehouse = await tx.warehouse.findFirst({
              where: { product_id: item.product_id },
            })

            if (warehouse) {
              const currentQuantity = Number(warehouse.quantity || 0)
              const itemQuantity = Number(item.quantity)
              // Anbar qalığı mənfiyə gedə bilər (satış qaiməsi üçün)
              const newQuantity = currentQuantity - itemQuantity
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
                  item.products?.name || `ID ${item.product_id}`,
                  item.products?.code || null,
                  currentQuantity,
                  newQuantity,
                  -itemQuantity,
                  invoice.invoice_number,
                  'sale',
                  'confirmed'
                )
              )
            } else {
              // Warehouse yoxdursa, yaradırıq mənfi qalıqla
              const newWarehouse = await tx.warehouse.create({
                data: {
                  product_id: item.product_id,
                  quantity: -Number(item.quantity),
                },
                include: { products: true },
              })

              // Log yaz (transaction-dan sonra)
              logPromises.push(
                logWarehouseChange(
                  req.userId,
                  item.product_id,
                  item.products?.name || newWarehouse.products?.name || `ID ${item.product_id}`,
                  item.products?.code || newWarehouse.products?.code || null,
                  0,
                  -Number(item.quantity),
                  -Number(item.quantity),
                  invoice.invoice_number,
                  'sale',
                  'confirmed'
                )
              )
            }
          }

          // Müştərinin balansını artır (onların borcu artır)
          if (invoice.customer_id) {
            const customer = await tx.customers.findUnique({
              where: { id: invoice.customer_id },
            })
            if (customer) {
              const currentBalance = Number(customer.balance || 0)
              const newBalance = currentBalance + totalAmount
              await tx.customers.update({
                where: { id: invoice.customer_id },
                data: {
                  balance: newBalance,
                },
              })
              
              // Log yaz (transaction-dan sonra)
              logPromises.push(
                logCustomerBalanceChange(
                  req.userId,
                  invoice.customer_id,
                  customer.name,
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
          // Təsdiqsiz edilir - anbar qalığını artır (satış qaiməsi geri qaytarılır)
          for (const item of invoice.sale_invoice_items) {
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
                  item.products?.name || warehouse.products?.name || `ID ${item.product_id}`,
                  item.products?.code || warehouse.products?.code || null,
                  oldQuantity,
                  newQuantity,
                  Number(item.quantity),
                  invoice.invoice_number,
                  'sale',
                  'unconfirmed'
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
                  item.products?.name || newWarehouse.products?.name || `ID ${item.product_id}`,
                  item.products?.code || newWarehouse.products?.code || null,
                  0,
                  Number(item.quantity),
                  Number(item.quantity),
                  invoice.invoice_number,
                  'sale',
                  'unconfirmed'
                )
              )
            }
          }

          // Müştərinin balansını azalt (onların borcu azalır)
          if (invoice.customer_id) {
            const customer = await tx.customers.findUnique({
              where: { id: invoice.customer_id },
            })
            if (customer) {
              const currentBalance = Number(customer.balance || 0)
              // Mənfi balans ola bilər (ödəniş borcdan çoxdursa)
              const newBalance = currentBalance - totalAmount
              await tx.customers.update({
                where: { id: invoice.customer_id },
                data: {
                  balance: newBalance,
                },
              })
              
              // Log yaz (transaction-dan sonra)
              logPromises.push(
                logCustomerBalanceChange(
                  req.userId,
                  invoice.customer_id,
                  customer.name,
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

      return tx.sale_invoices.update({
        where: { id: parseInt(id) },
        data: {
          is_active: newIsActive,
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
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }
    if (error.message === 'CANNOT_CONFIRM_DELETED') {
      return res.status(400).json({ message: 'Silinmiş qaiməni təsdiqləmək olmaz' })
    }
    console.error('Update order status error:', error)
    res.status(500).json({ message: 'Qaimə statusu yenilənərkən xəta baş verdi' })
  }
}

// Satış qaiməsini sil (soft delete)
export const deleteOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.sale_invoices.findUnique({
        where: { id: parseInt(id) },
        include: {
          sale_invoice_items: true,
        },
      })

      if (!invoice) {
        throw new Error('NOT_FOUND')
      }

      // Yalnız təsdiqlənmiş qaimələr üçün anbar qalığını artır (satış qaiməsi silinir)
      if (invoice.is_active) {
        for (const item of invoice.sale_invoice_items) {
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

            // Log yaz
            await logWarehouseChange(
              req.userId,
              item.product_id,
              warehouse.products?.name || `ID ${item.product_id}`,
              warehouse.products?.code || null,
              oldQuantity,
              newQuantity,
              Number(item.quantity),
              invoice.invoice_number,
              'sale',
              'deleted'
            )
          } else {
            const newWarehouse = await tx.warehouse.create({
              data: {
                product_id: item.product_id,
                quantity: Number(item.quantity),
              },
              include: { products: true },
            })

            // Log yaz
            await logWarehouseChange(
              req.userId,
              item.product_id,
              newWarehouse.products?.name || `ID ${item.product_id}`,
              newWarehouse.products?.code || null,
              0,
              Number(item.quantity),
              Number(item.quantity),
              invoice.invoice_number,
              'sale',
              'deleted'
            )
          }
        }

        // Müştərinin balansını azalt (onların borcu azalır)
        if (invoice.customer_id) {
          const customer = await tx.customers.findUnique({
            where: { id: invoice.customer_id },
          })
          if (customer) {
            const totalAmount = Number(invoice.total_amount || 0)
            const currentBalance = Number(customer.balance || 0)
            const newBalance = Math.max(0, currentBalance - totalAmount)
            await tx.customers.update({
              where: { id: invoice.customer_id },
              data: {
                balance: newBalance,
              },
            })
            
            // Log yaz
            await logCustomerBalanceChange(
              req.userId ? parseInt(req.userId as string, 10) : null,
              invoice.customer_id,
              customer.name,
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
      await tx.sale_invoices.update({
        where: { id: parseInt(id) },
        data: {
          is_deleted: true,
          is_active: false,
        },
      })
    })

    // Qaimə silindi log
    const invoice = await prisma.sale_invoices.findUnique({
      where: { id: parseInt(id) },
    })
    if (invoice) {
      await logInvoiceDeleted(req.userId, invoice.id, invoice.invoice_number, 'sale')
    }

    res.json({ message: 'Satış qaiməsi silindi' })
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }
    console.error('Delete order error:', error)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    res.status(500).json({ 
      message: 'Satış qaiməsi silinərkən xəta baş verdi',
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// Silinmiş satış qaiməsini geri qaytar (təsdiqsiz olaraq)
export const restoreOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const restoredInvoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.sale_invoices.findUnique({
        where: { id: parseInt(id) },
      })

      if (!invoice) {
        throw new Error('NOT_FOUND')
      }

      if (!invoice.is_deleted) {
        throw new Error('ALREADY_ACTIVE')
      }

      // Qaiməni geri qaytar, amma təsdiqsiz olaraq saxla
      return tx.sale_invoices.update({
        where: { id: parseInt(id) },
        data: {
          is_deleted: false,
          is_active: false, // Təsdiqsiz olaraq saxla
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

    // Qaimə geri qaytarıldı log
    await logInvoiceRestored(req.userId, restoredInvoice.id, restoredInvoice.invoice_number, 'sale')

    res.json(restoredInvoice)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Qaimə tapılmadı' })
    }
    if (error.message === 'ALREADY_ACTIVE') {
      return res.status(400).json({ message: 'Qaimə artıq aktivdir' })
    }
    console.error('Restore order error:', error)
    res.status(500).json({ message: 'Qaimə geri qaytarılarkən xəta baş verdi' })
  }
}

// Məhsulların anbar qalığını yoxla
export const checkWarehouseStock = async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body // items: [{ product_id, quantity }]

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Məhsullar siyahısı tələb olunur' })
    }

    const stockChecks = await Promise.all(
      items.map(async (item: { product_id: number; quantity: number }) => {
        const warehouse = await prisma.warehouse.findFirst({
          where: { product_id: item.product_id },
          include: { products: true },
        })
        const currentQuantity = Number(warehouse?.quantity ?? 0)
        const requiredQuantity = Number(item.quantity)

        return {
          product_id: item.product_id,
          product_name: warehouse?.products?.name || `ID ${item.product_id}`,
          available_quantity: currentQuantity,
          required_quantity: requiredQuantity,
          is_sufficient: currentQuantity >= requiredQuantity,
          will_be_negative: currentQuantity < requiredQuantity,
        }
      })
    )

    const insufficientItems = stockChecks.filter(check => !check.is_sufficient)

    res.json({
      checks: stockChecks,
      has_insufficient_stock: insufficientItems.length > 0,
      insufficient_items: insufficientItems,
    })
  } catch (error: any) {
    console.error('Check warehouse stock error:', error)
    res.status(500).json({ message: 'Anbar qalığı yoxlanılarkən xəta baş verdi' })
  }
}
