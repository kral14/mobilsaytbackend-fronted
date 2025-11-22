import fs from 'fs/promises'
import path from 'path'
import prisma from '../config/database'

// Log fayllarının saxlanılacağı directory
const LOGS_DIR = path.join(process.cwd(), 'user_logs')

// Logs directory-ni yarat (əgər yoxdursa)
export const ensureLogsDirectory = async () => {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true })
  } catch (error) {
    console.error('Logs directory yaradıla bilmədi:', error)
  }
}

// İstifadəçi üçün log faylının yolu
export const getUserLogFilePath = (userId: number): string => {
  return path.join(LOGS_DIR, `user_${userId}.txt`)
}

// İstifadəçi üçün log faylı yarat (əgər yoxdursa)
export const createUserLogFile = async (userId: number) => {
  try {
    await ensureLogsDirectory()
    const logFilePath = getUserLogFilePath(userId)
    
    // Fayl yoxdursa yarat
    try {
      await fs.access(logFilePath)
    } catch {
      // Fayl yoxdur, yaradırıq
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true, full_name: true },
      })
      
      const header = `=== İstifadəçi Log Faylı ===
İstifadəçi ID: ${userId}
Email: ${user?.email || 'Naməlum'}
Tam ad: ${user?.full_name || 'Naməlum'}
Yaradılma tarixi: ${new Date().toLocaleString('az-AZ')}
===========================================

`
      await fs.writeFile(logFilePath, header, 'utf-8')
    }
  } catch (error) {
    console.error(`İstifadəçi ${userId} üçün log faylı yaradıla bilmədi:`, error)
  }
}

// Log faylına yaz
export const writeToUserLogFile = async (
  userId: number,
  message: string
) => {
  try {
    await ensureLogsDirectory()
    const logFilePath = getUserLogFilePath(userId)
    
    const timestamp = new Date().toLocaleString('az-AZ')
    const logEntry = `[${timestamp}] ${message}\n`
    
    await fs.appendFile(logFilePath, logEntry, 'utf-8')
  } catch (error) {
    console.error(`Log faylına yazıla bilmədi (userId: ${userId}):`, error)
  }
}

// Verilənlər bazasından istifadəçinin loglarını fayla yaz (sinxronizasiya)
export const syncUserLogsToFile = async (userId: number) => {
  try {
    await ensureLogsDirectory()
    await createUserLogFile(userId)
    
    // Verilənlər bazasından istifadəçinin loglarını götür
    const logs = await prisma.activity_logs.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
    })
    
    const logFilePath = getUserLogFilePath(userId)
    
    // Faylın mövcud məzmununu oxu
    let existingContent = ''
    try {
      existingContent = await fs.readFile(logFilePath, 'utf-8')
    } catch {
      // Fayl yoxdur, header yaradırıq
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true, full_name: true },
      })
      
      existingContent = `=== İstifadəçi Log Faylı ===
İstifadəçi ID: ${userId}
Email: ${user?.email || 'Naməlum'}
Tam ad: ${user?.full_name || 'Naməlum'}
Yaradılma tarixi: ${new Date().toLocaleString('az-AZ')}
===========================================

`
    }
    
    // Yeni logları əlavə et
    let newLogs = ''
    for (const log of logs) {
      const timestamp = log.created_at 
        ? new Date(log.created_at).toLocaleString('az-AZ')
        : new Date().toLocaleString('az-AZ')
      
      // Action type-ı daha oxunaqlı formata çevir
      const actionLabels: Record<string, string> = {
        'invoice_created': '📝 Qaimə yaradıldı',
        'invoice_confirmed': '✅ Qaimə təsdiqləndi',
        'invoice_unconfirmed': '❌ Qaimə təsdiqsiz edildi',
        'invoice_deleted': '🗑️ Qaimə silindi',
        'invoice_restored': '♻️ Qaimə geri qaytarıldı',
        'warehouse_confirmed': '📦 Anbar qalığı təsdiqləndi',
        'warehouse_unconfirmed': '📦 Anbar qalığı təsdiqsiz edildi',
        'warehouse_deleted': '📦 Anbar qalığı silindi',
        'warehouse_restored': '📦 Anbar qalığı geri qaytarıldı',
      }
      
      const actionLabel = actionLabels[log.action_type] || log.action_type
      
      // Entity type-ı daha oxunaqlı formata çevir
      const entityLabels: Record<string, string> = {
        'purchase_invoice': 'Alış qaiməsi',
        'sale_invoice': 'Satış qaiməsi',
        'warehouse': 'Anbar',
      }
      
      const entityLabel = entityLabels[log.entity_type] || log.entity_type
      
      newLogs += `[${timestamp}] ${actionLabel}\n`
      newLogs += `   Tip: ${entityLabel}${log.entity_id ? ` (ID: ${log.entity_id})` : ''}\n`
      newLogs += `   ${log.description || 'Təsvir yoxdur'}\n`
      
      // Detalları daha qısa və oxunaqlı formada göstər
      if (log.details) {
        try {
          const parsed = typeof log.details === 'string' 
            ? JSON.parse(log.details) 
            : log.details
          
          // Yalnız vacib məlumatları göstər
          if (parsed.invoice_number) {
            newLogs += `   Qaimə nömrəsi: ${parsed.invoice_number}\n`
          }
          if (parsed.product_name) {
            newLogs += `   Məhsul: ${parsed.product_name}${parsed.product_code ? ` (${parsed.product_code})` : ''}\n`
          }
          if (parsed.old_quantity !== undefined && parsed.new_quantity !== undefined) {
            newLogs += `   Qalıq: ${parsed.old_quantity} → ${parsed.new_quantity} ${parsed.change_quantity > 0 ? `(+${parsed.change_quantity})` : `(${parsed.change_quantity})`}\n`
          }
        } catch {
          // Parse olunmazsa, sadəcə təsviri göstər
        }
      }
      
      newLogs += '\n'
    }
    
    // Mövcud məzmunu oxu və yalnız yeni logları əlavə et
    // Əgər fayl artıq varsa, header-dan sonra yeni logları əlavə et
    // Əgər fayl yoxdursa, header + logları yaz
    
    // Header-dan sonraki məzmunu tap
    const headerEnd = existingContent.indexOf('===========================================\n\n')
    if (headerEnd !== -1) {
      // Header var, yalnız yeni logları əlavə et
      const afterHeader = existingContent.substring(headerEnd + '===========================================\n\n'.length)
      // Yeni logların artıq mövcud olub olmadığını yoxla
      if (!afterHeader.includes(newLogs.substring(0, 50))) {
        await fs.writeFile(logFilePath, existingContent + newLogs, 'utf-8')
      }
    } else {
      // Header yoxdur, tam yenidən yaz
      await fs.writeFile(logFilePath, existingContent + newLogs, 'utf-8')
    }
  } catch (error) {
    console.error(`Log sinxronizasiyası xətası (userId: ${userId}):`, error)
  }
}

// İstifadəçinin log faylını oxu
export const readUserLogFile = async (userId: number): Promise<string | null> => {
  try {
    const logFilePath = getUserLogFilePath(userId)
    return await fs.readFile(logFilePath, 'utf-8')
  } catch (error) {
    console.error(`Log faylı oxuna bilmədi (userId: ${userId}):`, error)
    return null
  }
}

// İstifadəçinin log faylını sil
export const deleteUserLogFile = async (userId: number) => {
  try {
    const logFilePath = getUserLogFilePath(userId)
    await fs.unlink(logFilePath)
  } catch (error) {
    // Fayl yoxdursa, xəta vermə
    if ((error as any).code !== 'ENOENT') {
      console.error(`Log faylı silinə bilmədi (userId: ${userId}):`, error)
    }
  }
}

// Bütün istifadəçi log fayllarının siyahısını götür
export const getAllUserLogFiles = async () => {
  try {
    await ensureLogsDirectory()
    const files = await fs.readdir(LOGS_DIR)
    
    const logFiles = []
    for (const file of files) {
      if (file.startsWith('user_') && file.endsWith('.txt')) {
        const userIdMatch = file.match(/user_(\d+)\.txt/)
        if (userIdMatch) {
          const userId = parseInt(userIdMatch[1], 10)
          const filePath = path.join(LOGS_DIR, file)
          const stats = await fs.stat(filePath)
          
          const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { email: true, full_name: true },
          })
          
          logFiles.push({
            userId,
            fileName: file,
            filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            userEmail: user?.email || 'Naməlum',
            userFullName: user?.full_name || 'Naməlum',
          })
        }
      }
    }
    
    return logFiles.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
  } catch (error) {
    console.error('Log faylları siyahısı alına bilmədi:', error)
    return []
  }
}

