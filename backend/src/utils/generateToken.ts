import jwt from 'jsonwebtoken'

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: '7d',
  })
}

