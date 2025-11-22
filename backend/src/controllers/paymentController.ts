import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { createLog } from '../utils/logger'

// Bütün ödənişləri gətir
export const getAllPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { payment_type, supplier_id, customer_id, start_date, end_date } = req.query

    const where: any = {}

    if (payment_type) {
      where.payment_type = payment_type
    }

    if (supplier_id) {
      where.supplier_id = parseInt(supplier_id as string, 10)
    }

    if (customer_id) {
      where.customer_id = parseInt(customer_id as string, 10)
    }

    if (start_date || end_date) {
      where.payment_date = {}
      if (start_date) {
        where.payment_date.gte = new Date(start_date as string)
      }
      if (end_date) {
        where.payment_date.lte = new Date(end_date as string)
      }
    }

    const payments = await prisma.payments.findMany({
      where,
      include: {
        suppliers: true,
        customers: true,
        users: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
      },
      orderBy: {
        payment_date: 'desc',
      },
    })

    res.json(payments)
  } catch (error) {
    console.error('Get all payments error:', error)
    res.status(500).json({ message: 'Ödənişlər yüklənərkən xəta baş verdi' })
  }
}

// Təchizatçıya ödəniş yarat
export const createSupplierPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { supplier_id, amount, payment_date, notes } = req.body

    if (!supplier_id) {
      return res.status(400).json({ message: 'Təchizatçı seçilməlidir' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Ödəniş məbləği müsbət olmalıdır' })
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Təchizatçını yoxla
      const supplier = await tx.suppliers.findUnique({
        where: { id: parseInt(supplier_id, 10) },
      })

      if (!supplier) {
        throw new Error('NOT_FOUND')
      }

      // Ödənişi yarat
      const newPayment = await tx.payments.create({
        data: {
          payment_type: 'supplier',
          supplier_id: parseInt(supplier_id, 10),
          amount: parseFloat(amount),
          payment_date: payment_date ? new Date(payment_date) : new Date(),
          notes: notes || null,
          created_by: req.userId ? parseInt(req.userId as string, 10) : null,
        },
      })

      // Təchizatçının balansını azalt (bizim borcumuz azalır)
      // Əgər ödəniş borcdan çoxdursa, balans mənfi olur (təchizatçı bizə borclu olur)
      const currentBalance = Number(supplier.balance || 0)
      const paymentAmount = parseFloat(amount)
      const newBalance = currentBalance - paymentAmount // Mənfi ola bilər

      await tx.suppliers.update({
        where: { id: parseInt(supplier_id, 10) },
        data: {
          balance: newBalance,
        },
      })

      // Log yaz
      await createLog({
        user_id: req.userId,
        action_type: 'payment_created',
        entity_type: 'payment',
        entity_id: newPayment.id,
        description: `${supplier.name} təchizatçısına ${paymentAmount} AZN ödəniş edildi. Köhnə balans: ${currentBalance} AZN, Yeni balans: ${newBalance} AZN${newBalance < 0 ? ' (təchizatçı bizə borclu)' : ''}`,
        details: {
          payment_type: 'supplier',
          supplier_id: parseInt(supplier_id, 10),
          supplier_name: supplier.name,
          amount: paymentAmount,
          old_balance: currentBalance,
          new_balance: newBalance,
        },
      })

      return tx.payments.findUnique({
        where: { id: newPayment.id },
        include: {
          suppliers: true,
          users: {
            select: {
              id: true,
              email: true,
              full_name: true,
            },
          },
        },
      })
    })

    res.status(201).json(payment)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Təchizatçı tapılmadı' })
    }
    console.error('Create supplier payment error:', error)
    res.status(500).json({ message: 'Təchizatçıya ödəniş yaradılarkən xəta baş verdi' })
  }
}

// Müştəridən ödəniş yarat
export const createCustomerPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { customer_id, amount, payment_date, notes } = req.body

    if (!customer_id) {
      return res.status(400).json({ message: 'Müştəri seçilməlidir' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Ödəniş məbləği müsbət olmalıdır' })
    }

    const payment = await prisma.$transaction(async (tx) => {
      // Müştərini yoxla
      const customer = await tx.customers.findUnique({
        where: { id: parseInt(customer_id, 10) },
      })

      if (!customer) {
        throw new Error('NOT_FOUND')
      }

      // Ödənişi yarat
      const newPayment = await tx.payments.create({
        data: {
          payment_type: 'customer',
          customer_id: parseInt(customer_id, 10),
          amount: parseFloat(amount),
          payment_date: payment_date ? new Date(payment_date) : new Date(),
          notes: notes || null,
          created_by: req.userId ? parseInt(req.userId as string, 10) : null,
        },
      })

      // Müştərinin balansını azalt (onların borcu azalır)
      // Əgər ödəniş borcdan çoxdursa, balans mənfi olur (biz müştəriyə borclu oluruq)
      const currentBalance = Number(customer.balance || 0)
      const paymentAmount = parseFloat(amount)
      const newBalance = currentBalance - paymentAmount // Mənfi ola bilər

      await tx.customers.update({
        where: { id: parseInt(customer_id, 10) },
        data: {
          balance: newBalance,
        },
      })

      // Log yaz
      await createLog({
        user_id: req.userId,
        action_type: 'payment_created',
        entity_type: 'payment',
        entity_id: newPayment.id,
        description: `${customer.name} müştərisindən ${paymentAmount} AZN ödəniş alındı. Köhnə balans: ${currentBalance} AZN, Yeni balans: ${newBalance} AZN${newBalance < 0 ? ' (biz müştəriyə borcluyuq)' : ''}`,
        details: {
          payment_type: 'customer',
          customer_id: parseInt(customer_id, 10),
          customer_name: customer.name,
          amount: paymentAmount,
          old_balance: currentBalance,
          new_balance: newBalance,
        },
      })

      return tx.payments.findUnique({
        where: { id: newPayment.id },
        include: {
          customers: true,
          users: {
            select: {
              id: true,
              email: true,
              full_name: true,
            },
          },
        },
      })
    })

    res.status(201).json(payment)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Müştəri tapılmadı' })
    }
    console.error('Create customer payment error:', error)
    res.status(500).json({ message: 'Müştəridən ödəniş yaradılarkən xəta baş verdi' })
  }
}

// Ödənişi sil
export const deletePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payments.findUnique({
        where: { id: parseInt(id, 10) },
      })

      if (!payment) {
        throw new Error('NOT_FOUND')
      }

      // Ödənişi geri qaytar (balansı yenilə)
      if (payment.payment_type === 'supplier' && payment.supplier_id) {
        const supplier = await tx.suppliers.findUnique({
          where: { id: payment.supplier_id },
        })
        if (supplier) {
          const currentBalance = Number(supplier.balance || 0)
          const paymentAmount = Number(payment.amount)
          const newBalance = currentBalance + paymentAmount // Borc artır

          await tx.suppliers.update({
            where: { id: payment.supplier_id },
            data: {
              balance: newBalance,
            },
          })

          // Log yaz
          await createLog({
            user_id: req.userId,
            action_type: 'payment_deleted',
            entity_type: 'payment',
            entity_id: payment.id,
            description: `${supplier.name} təchizatçısına edilən ${paymentAmount} AZN ödəniş geri qaytarıldı. Köhnə balans: ${currentBalance} AZN, Yeni balans: ${newBalance} AZN${newBalance < 0 ? ' (təchizatçı bizə borclu)' : ''}`,
            details: {
              payment_type: 'supplier',
              supplier_id: payment.supplier_id,
              supplier_name: supplier.name,
              amount: paymentAmount,
              old_balance: currentBalance,
              new_balance: newBalance,
            },
          })
        }
      } else if (payment.payment_type === 'customer' && payment.customer_id) {
        const customer = await tx.customers.findUnique({
          where: { id: payment.customer_id },
        })
        if (customer) {
          const currentBalance = Number(customer.balance || 0)
          const paymentAmount = Number(payment.amount)
          const newBalance = currentBalance + paymentAmount // Borc artır

          await tx.customers.update({
            where: { id: payment.customer_id },
            data: {
              balance: newBalance,
            },
          })

          // Log yaz
          await createLog({
            user_id: req.userId,
            action_type: 'payment_deleted',
            entity_type: 'payment',
            entity_id: payment.id,
            description: `${customer.name} müştərisindən alınan ${paymentAmount} AZN ödəniş geri qaytarıldı. Köhnə balans: ${currentBalance} AZN, Yeni balans: ${newBalance} AZN${newBalance < 0 ? ' (biz müştəriyə borcluyuq)' : ''}`,
            details: {
              payment_type: 'customer',
              customer_id: payment.customer_id,
              customer_name: customer.name,
              amount: paymentAmount,
              old_balance: currentBalance,
              new_balance: newBalance,
            },
          })
        }
      }

      // Ödənişi sil
      await tx.payments.delete({
        where: { id: parseInt(id, 10) },
      })
    })

    res.json({ message: 'Ödəniş silindi' })
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Ödəniş tapılmadı' })
    }
    console.error('Delete payment error:', error)
    res.status(500).json({ message: 'Ödəniş silinərkən xəta baş verdi' })
  }
}

// Kassa balansını gətir (ümumi gəlir - ümumi xərc)
export const getCashBalance = async (req: AuthRequest, res: Response) => {
  try {
    const customerPayments = await prisma.payments.aggregate({
      where: {
        payment_type: 'customer',
      },
      _sum: {
        amount: true,
      },
    })

    const supplierPayments = await prisma.payments.aggregate({
      where: {
        payment_type: 'supplier',
      },
      _sum: {
        amount: true,
      },
    })

    const totalIncome = Number(customerPayments._sum.amount || 0) // Müştərilərdən alınan ödənişlər
    const totalExpense = Number(supplierPayments._sum.amount || 0) // Təchizatçılara edilən ödənişlər
    const balance = totalIncome - totalExpense

    res.json({
      total_income: totalIncome,
      total_expense: totalExpense,
      balance: balance,
    })
  } catch (error) {
    console.error('Get cash balance error:', error)
    res.status(500).json({ message: 'Kassa balansı yüklənərkən xəta baş verdi' })
  }
}

