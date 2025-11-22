import prisma from '../config/database'

export interface LogData {
  user_id?: number | string | null
  action_type: string
  entity_type: string
  entity_id?: number | null
  description: string
  details?: any
}

export const createLog = async (data: LogData) => {
  try {
    // user_id-ni integer-ə çevir
    let userId: number | null = null
    if (data.user_id) {
      if (typeof data.user_id === 'string') {
        userId = parseInt(data.user_id, 10)
        if (isNaN(userId)) {
          userId = null
        }
      } else {
        userId = data.user_id
      }
    }

    await prisma.activity_logs.create({
      data: {
        user_id: userId,
        action_type: data.action_type,
        entity_type: data.entity_type,
        entity_id: data.entity_id || null,
        description: data.description,
        details: data.details ? JSON.stringify(data.details) : null,
      },
    })

    // Əgər user_id varsa, log faylına da yaz (sinxronizasiya zamanı yazılacaq, burada yazmırıq)
    // Çünki hər log yazılanda fayla yazmaq performans problemləri yarada bilər
    // Bunun əvəzinə sinxronizasiya zamanı bütün loglar bir dəfə yazılır
  } catch (error) {
    console.error('Log yazılarkən xəta:', error)
    // Log yazıla bilməsə belə, əsas funksionallığa təsir etməməlidir
  }
}

// Qaimə təsdiqlənəndə anbar qalığı dəyişikliyi üçün log
export const logWarehouseChange = async (
  userId: number | null | undefined,
  productId: number,
  productName: string,
  productCode: string | null,
  oldQuantity: number,
  newQuantity: number,
  changeQuantity: number,
  invoiceNumber: string,
  invoiceType: 'purchase' | 'sale',
  action: 'confirmed' | 'unconfirmed' | 'deleted' | 'restored'
) => {
  const actionText = action === 'confirmed' 
    ? (invoiceType === 'purchase' ? 'təsdiqləndi' : 'təsdiqləndi və satıldı')
    : action === 'unconfirmed'
    ? 'təsdiqsiz edildi'
    : action === 'deleted'
    ? 'silindi'
    : 'geri qaytarıldı'

  const productIdentifier = productCode || `ID ${productId}`
  const description = `${productIdentifier} kodlu "${productName}" məhsulundan ${oldQuantity} ədəd var idi, ${Math.abs(changeQuantity)} ədədi ${invoiceNumber} ${invoiceType === 'purchase' ? 'alış' : 'satış'} qaiməsində ${actionText}, qaldı ${newQuantity} ədəd`

  await createLog({
    user_id: userId || null,
    action_type: `warehouse_${action}`,
    entity_type: 'warehouse',
    entity_id: productId,
    description,
    details: {
      product_id: productId,
      product_name: productName,
      product_code: productCode,
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
      change_quantity: changeQuantity,
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
      action,
    },
  })
}

// Təchizatçı balansı dəyişikliyi üçün log
export const logSupplierBalanceChange = async (
  userId: number | null | undefined,
  supplierId: number,
  supplierName: string,
  oldBalance: number,
  newBalance: number,
  changeAmount: number,
  invoiceNumber: string | null,
  reason: 'invoice_confirmed' | 'invoice_unconfirmed' | 'invoice_deleted' | 'payment_created' | 'payment_deleted'
) => {
  const reasonText = reason === 'invoice_confirmed'
    ? 'alış qaiməsi təsdiqləndi'
    : reason === 'invoice_unconfirmed'
    ? 'alış qaiməsi təsdiqsiz edildi'
    : reason === 'invoice_deleted'
    ? 'alış qaiməsi silindi'
    : reason === 'payment_created'
    ? 'ödəniş edildi'
    : 'ödəniş geri qaytarıldı'

  const invoiceText = invoiceNumber ? ` ${invoiceNumber} qaiməsi` : ''
  const description = `${supplierName} təchizatçısının borcu${invoiceText} səbəbindən dəyişdi. Köhnə borc: ${oldBalance.toFixed(2)} AZN, Yeni borc: ${newBalance.toFixed(2)} AZN (${changeAmount >= 0 ? '+' : ''}${changeAmount.toFixed(2)} AZN) - ${reasonText}`

  await createLog({
    user_id: userId || null,
    action_type: 'supplier_balance_changed',
    entity_type: 'supplier',
    entity_id: supplierId,
    description,
    details: {
      supplier_id: supplierId,
      supplier_name: supplierName,
      old_balance: oldBalance,
      new_balance: newBalance,
      change_amount: changeAmount,
      invoice_number: invoiceNumber,
      reason,
    },
  })
}

// Müştəri balansı dəyişikliyi üçün log
export const logCustomerBalanceChange = async (
  userId: number | null | undefined,
  customerId: number,
  customerName: string,
  oldBalance: number,
  newBalance: number,
  changeAmount: number,
  invoiceNumber: string | null,
  reason: 'invoice_confirmed' | 'invoice_unconfirmed' | 'invoice_deleted' | 'payment_created' | 'payment_deleted'
) => {
  const reasonText = reason === 'invoice_confirmed'
    ? 'satış qaiməsi təsdiqləndi'
    : reason === 'invoice_unconfirmed'
    ? 'satış qaiməsi təsdiqsiz edildi'
    : reason === 'invoice_deleted'
    ? 'satış qaiməsi silindi'
    : reason === 'payment_created'
    ? 'ödəniş alındı'
    : 'ödəniş geri qaytarıldı'

  const invoiceText = invoiceNumber ? ` ${invoiceNumber} qaiməsi` : ''
  const description = `${customerName} müştərisinin borcu${invoiceText} səbəbindən dəyişdi. Köhnə borc: ${oldBalance.toFixed(2)} AZN, Yeni borc: ${newBalance.toFixed(2)} AZN (${changeAmount >= 0 ? '+' : ''}${changeAmount.toFixed(2)} AZN) - ${reasonText}`

  await createLog({
    user_id: userId || null,
    action_type: 'customer_balance_changed',
    entity_type: 'customer',
    entity_id: customerId,
    description,
    details: {
      customer_id: customerId,
      customer_name: customerName,
      old_balance: oldBalance,
      new_balance: newBalance,
      change_amount: changeAmount,
      invoice_number: invoiceNumber,
      reason,
    },
  })
}

// Qaimə yaradılanda log
export const logInvoiceCreated = async (
  userId: number | null | undefined,
  invoiceId: number,
  invoiceNumber: string,
  invoiceType: 'purchase' | 'sale',
  customerOrSupplierName: string | null
) => {
  const typeText = invoiceType === 'purchase' ? 'alış' : 'satış'
  const partyName = customerOrSupplierName || 'Naməlum'
  const description = `${invoiceNumber} nömrəli ${typeText} qaiməsi yaradıldı. ${invoiceType === 'purchase' ? 'Təchizatçı' : 'Müştəri'}: ${partyName}`

  await createLog({
    user_id: userId || null,
    action_type: 'invoice_created',
    entity_type: invoiceType === 'purchase' ? 'purchase_invoice' : 'sale_invoice',
    entity_id: invoiceId,
    description,
    details: {
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
      customer_or_supplier_name: customerOrSupplierName,
    },
  })
}

// Qaimə silinəndə log
export const logInvoiceDeleted = async (
  userId: number | null | undefined,
  invoiceId: number,
  invoiceNumber: string,
  invoiceType: 'purchase' | 'sale'
) => {
  const typeText = invoiceType === 'purchase' ? 'alış' : 'satış'
  const description = `${invoiceNumber} nömrəli ${typeText} qaiməsi silindi`

  await createLog({
    user_id: userId || null,
    action_type: 'invoice_deleted',
    entity_type: invoiceType === 'purchase' ? 'purchase_invoice' : 'sale_invoice',
    entity_id: invoiceId,
    description,
    details: {
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
    },
  })
}

// Qaimə geri qaytarılanda log
export const logInvoiceRestored = async (
  userId: number | null | undefined,
  invoiceId: number,
  invoiceNumber: string,
  invoiceType: 'purchase' | 'sale'
) => {
  const typeText = invoiceType === 'purchase' ? 'alış' : 'satış'
  const description = `${invoiceNumber} nömrəli ${typeText} qaiməsi geri qaytarıldı (təsdiqsiz olaraq)`

  await createLog({
    user_id: userId || null,
    action_type: 'invoice_restored',
    entity_type: invoiceType === 'purchase' ? 'purchase_invoice' : 'sale_invoice',
    entity_id: invoiceId,
    description,
    details: {
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
    },
  })
}

