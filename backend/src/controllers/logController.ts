import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

// Bütün logları götür
export const getAllLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 100, action_type, entity_type, start_date, end_date, user_id, entity_id } = req.query

    const pageNum = parseInt(page as string, 10) || 1
    const limitNum = parseInt(limit as string, 10) || 100
    const skip = (pageNum - 1) * limitNum

    const where: any = {}

    if (action_type) {
      where.action_type = action_type
    }

    if (entity_type) {
      where.entity_type = entity_type
    }

    if (user_id) {
      where.user_id = parseInt(user_id as string, 10)
    }

    if (entity_id) {
      where.entity_id = parseInt(entity_id as string, 10)
    }

    if (start_date || end_date) {
      where.created_at = {}
      if (start_date) {
        where.created_at.gte = new Date(start_date as string)
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date as string)
      }
    }

    console.log('🔍 [LOGS] Query parametrləri:', { page: pageNum, limit: limitNum, where })
    
    const [logs, total] = await Promise.all([
      prisma.activity_logs.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.activity_logs.count({ where }),
    ])
    
    console.log(`✅ [LOGS] ${logs.length} log tapıldı, cəmi: ${total}`)

    res.json({
      logs: logs.map(log => {
        let parsedDetails = null
        if (log.details) {
          try {
            // Əgər details artıq object-dirsə, parse etmə
            if (typeof log.details === 'string') {
              parsedDetails = JSON.parse(log.details)
            } else {
              parsedDetails = log.details
            }
          } catch (e) {
            // Parse xətası olsa, original string-i saxla
            parsedDetails = log.details
          }
        }
        return {
          ...log,
          details: parsedDetails,
        }
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (error: any) {
    console.error('Get logs error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ 
      message: 'Loglar yüklənərkən xəta baş verdi',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// Qaimə nömrələrini gətir (entity type-a görə)
export const getInvoiceNumbers = async (req: AuthRequest, res: Response) => {
  try {
    const { entity_type } = req.query

    if (!entity_type) {
      return res.status(400).json({ message: 'Entity type tələb olunur' })
    }

    let invoices: Array<{ id: number; invoice_number: string }> = []

    if (entity_type === 'purchase_invoice') {
      invoices = await prisma.purchase_invoices.findMany({
        select: {
          id: true,
          invoice_number: true,
        },
        orderBy: {
          invoice_number: 'desc',
        },
      })
    } else if (entity_type === 'sale_invoice') {
      invoices = await prisma.sale_invoices.findMany({
        select: {
          id: true,
          invoice_number: true,
        },
        orderBy: {
          invoice_number: 'desc',
        },
      })
    } else {
      return res.status(400).json({ message: 'Dəstəklənən entity type: purchase_invoice, sale_invoice' })
    }

    res.json({ invoices })
  } catch (error: any) {
    console.error('Get invoice numbers error:', error)
    res.status(500).json({ 
      message: 'Qaimə nömrələri yüklənərkən xəta baş verdi',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// Logları sil
export const deleteLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { days } = req.body // Neçə günlük logları silmək

    if (!days || days < 1) {
      return res.status(400).json({ message: 'Gün sayı düzgün deyil' })
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const result = await prisma.activity_logs.deleteMany({
      where: {
        created_at: {
          lt: cutoffDate,
        },
      },
    })

    res.json({
      message: `${result.count} log silindi`,
      deleted_count: result.count,
    })
  } catch (error: any) {
    console.error('Delete logs error:', error)
    res.status(500).json({ message: 'Loglar silinərkən xəta baş verdi' })
  }
}
