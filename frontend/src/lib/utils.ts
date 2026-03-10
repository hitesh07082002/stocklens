export function formatCurrency(value: number | string | null, options?: Intl.NumberFormatOptions) {
  if (value === null) {
    return "N/A"
  }

  const numericValue = typeof value === "string" ? Number.parseFloat(value) : value
  if (Number.isNaN(numericValue)) {
    return "N/A"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    ...options,
  }).format(numericValue)
}

export function formatLargeNumber(value: number | null) {
  if (value === null) {
    return "N/A"
  }

  const absoluteValue = Math.abs(value)
  if (absoluteValue >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(1)}T`
  }
  if (absoluteValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (absoluteValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }

  return formatCurrency(value, { maximumFractionDigits: 0 })
}

export function formatPercent(value: string | number | null, maximumFractionDigits = 2) {
  if (value === null) {
    return "N/A"
  }

  const numericValue = typeof value === "string" ? Number.parseFloat(value) : value
  if (Number.isNaN(numericValue)) {
    return "N/A"
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? 1 : 0,
  }).format(numericValue)
}

export function formatSignedCurrency(value: string | number | null) {
  if (value === null) {
    return "N/A"
  }

  const numericValue = typeof value === "string" ? Number.parseFloat(value) : value
  if (Number.isNaN(numericValue)) {
    return "N/A"
  }

  const prefix = numericValue > 0 ? "+" : ""
  return `${prefix}${formatCurrency(numericValue)}`
}
