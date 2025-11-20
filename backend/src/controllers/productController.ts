import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

export const getAllProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { category_id } = req.query
    const where: Record<string, any> = {}

    if (category_id) {
      where.category_id = parseInt(category_id as string, 10)
    }

    const products = await prisma.products.findMany({
      where,
      include: {
        warehouse: true,
        category: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    res.json(products)
  } catch (error: any) {
    console.error('❌ [ERROR] Get products error:', error)
    res.status(500).json({
      message: 'Məhsullar yüklənərkən xəta baş verdi',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    })
  }
}

export const getProductById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const product = await prisma.products.findUnique({
      where: { id: parseInt(id) },
      include: {
        warehouse: true,
      },
    })

    if (!product) {
      return res.status(404).json({ message: 'Məhsul tapılmadı' })
    }

    res.json(product)
  } catch (error) {
    console.error('Get product error:', error)
    res.status(500).json({ message: 'Məhsul yüklənərkən xəta baş verdi' })
  }
}

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      barcode,
      description,
      unit,
      purchase_price,
      sale_price,
      code,
      article,
      category_id,
      type,
      brand,
      model,
      color,
      size,
      weight,
      country,
      manufacturer,
      warranty_period,
      production_date,
      expiry_date,
      min_stock,
      max_stock,
      tax_rate,
      is_active,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Məhsul adı məcburidir' })
    }

    const productData = {
      name: name.trim(),
      barcode: barcode?.trim() || null,
      description: description?.trim() || null,
      unit: unit?.trim() || 'ədəd',
      purchase_price: purchase_price !== undefined ? Number(purchase_price) : 0,
      sale_price: sale_price !== undefined ? Number(sale_price) : 0,
      code: code?.trim() || null,
      article: article?.trim() || null,
      category_id: category_id !== undefined && category_id !== null ? Number(category_id) : null,
      type: type?.trim() || null,
      brand: brand?.trim() || null,
      model: model?.trim() || null,
      color: color?.trim() || null,
      size: size?.trim() || null,
      weight: weight !== undefined && weight !== null ? Number(weight) : null,
      country: country?.trim() || null,
      manufacturer: manufacturer?.trim() || null,
      warranty_period: warranty_period !== undefined && warranty_period !== null ? Number(warranty_period) : null,
      production_date: production_date ? new Date(production_date) : null,
      expiry_date: expiry_date ? new Date(expiry_date) : null,
      min_stock: min_stock !== undefined && min_stock !== null ? Number(min_stock) : 0,
      max_stock: max_stock !== undefined && max_stock !== null ? Number(max_stock) : null,
      tax_rate: tax_rate !== undefined && tax_rate !== null ? Number(tax_rate) : 0,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    }

    const product = await prisma.products.create({
      data: productData,
    })

    await prisma.warehouse.create({
      data: {
        product_id: product.id,
        quantity: 0,
      },
    })

    res.status(201).json(product)
  } catch (error) {
    console.error('Create product error:', error)
    res.status(500).json({ message: 'Məhsul yaradılarkən xəta baş verdi' })
  }
}

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const {
      name,
      barcode,
      description,
      unit,
      purchase_price,
      sale_price,
      code,
      article,
      category_id,
      type,
      brand,
      model,
      color,
      size,
      weight,
      country,
      manufacturer,
      warranty_period,
      production_date,
      expiry_date,
      min_stock,
      max_stock,
      tax_rate,
      is_active,
    } = req.body

    const product = await prisma.products.findUnique({
      where: { id: parseInt(id, 10) },
    })

    if (!product) {
      return res.status(404).json({ message: 'Məhsul tapılmadı' })
    }

    const updateData: Record<string, any> = {}

    if (name !== undefined) updateData.name = name
    if (barcode !== undefined) updateData.barcode = barcode
    if (description !== undefined) updateData.description = description
    if (unit !== undefined) updateData.unit = unit
    if (purchase_price !== undefined) updateData.purchase_price = Number(purchase_price)
    if (sale_price !== undefined) updateData.sale_price = Number(sale_price)
    if (code !== undefined) updateData.code = code
    if (article !== undefined) updateData.article = article
    if (category_id !== undefined) updateData.category_id = category_id ? Number(category_id) : null
    if (type !== undefined) updateData.type = type
    if (brand !== undefined) updateData.brand = brand
    if (model !== undefined) updateData.model = model
    if (color !== undefined) updateData.color = color
    if (size !== undefined) updateData.size = size
    if (weight !== undefined) updateData.weight = weight !== null ? Number(weight) : null
    if (country !== undefined) updateData.country = country
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer
    if (warranty_period !== undefined)
      updateData.warranty_period = warranty_period !== null ? Number(warranty_period) : null
    if (production_date !== undefined)
      updateData.production_date = production_date ? new Date(production_date) : null
    if (expiry_date !== undefined) updateData.expiry_date = expiry_date ? new Date(expiry_date) : null
    if (min_stock !== undefined) updateData.min_stock = Number(min_stock)
    if (max_stock !== undefined) updateData.max_stock = max_stock !== null ? Number(max_stock) : null
    if (tax_rate !== undefined) updateData.tax_rate = Number(tax_rate)
    if (is_active !== undefined) updateData.is_active = Boolean(is_active)

    const updatedProduct = await prisma.products.update({
      where: { id: parseInt(id, 10) },
      data: updateData,
    })

    res.json(updatedProduct)
  } catch (error) {
    console.error('Update product error:', error)
    res.status(500).json({ message: 'Məhsul yenilənərkən xəta baş verdi' })
  }
}

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const product = await prisma.products.findUnique({
      where: { id: parseInt(id) },
    })

    if (!product) {
      return res.status(404).json({ message: 'Məhsul tapılmadı' })
    }

    await prisma.products.delete({
      where: { id: parseInt(id) },
    })

    res.json({ message: 'Məhsul silindi' })
  } catch (error) {
    console.error('Delete product error:', error)
    res.status(500).json({ message: 'Məhsul silinərkən xəta baş verdi' })
  }
}
