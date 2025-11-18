// Tarix fərqini dəqiq hesabla (il, ay, gün)
export const calculateDateDifference = (startDate: Date, endDate: Date): { years: number; months: number; days: number } => {
  let years = endDate.getFullYear() - startDate.getFullYear()
  let months = endDate.getMonth() - startDate.getMonth()
  let days = endDate.getDate() - startDate.getDate()
  
  // Günlər mənfi olarsa, əvvəlki ayın son günlərindən götür
  if (days < 0) {
    const lastDayOfPrevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate()
    days += lastDayOfPrevMonth
    months--
  }
  
  // Aylar mənfi olarsa, əvvəlki ildən götür
  if (months < 0) {
    months += 12
    years--
  }
  
  return { years, months, days }
}

// Tarix fərqini formatla (il, ay, gün)
export const formatDateDifference = (startDate: Date, endDate: Date): string => {
  const { years, months, days } = calculateDateDifference(startDate, endDate)
  const parts = []
  if (years > 0) parts.push(`${years} il`)
  if (months > 0) parts.push(`${months} ay`)
  if (days > 0) parts.push(`${days} gün`)
  
  if (parts.length === 0) {
    return '0 gün'
  }
  
  return parts.join(' ')
}

// Günlər arasındakı fərqi hesabla
export const calculateDaysDifference = (startDate: Date, endDate: Date): number => {
  const diffTime = endDate.getTime() - startDate.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

