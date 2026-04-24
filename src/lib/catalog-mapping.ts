export const MIRAKL_TAXONOMY_FIELDS = [
  'product_sku',
  'product_title',
  'brand',
  'category_code',
  'description',
  'price_eur',
  'quantity',
  'ean',
  'image_url',
  'color',
  'material',
] as const

export type MiraklTaxonomyField = (typeof MIRAKL_TAXONOMY_FIELDS)[number]

export type CatalogCsv = {
  headers: string[]
  rows: string[][]
  delimiter: string
}

export type CatalogMappingProposal = {
  sku: string
  row_index: number
  source_column: string | null
  target_field: MiraklTaxonomyField
  raw_value: string
  proposed_value: string
  reasoning: string
  confidence: number
  simulated: boolean
  raw_row: Record<string, string>
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s-]+/g, ' ')
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/)[0] || ''
  const candidates = [',', ';', '\t']
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: (firstLine.match(new RegExp(delimiter === '\t' ? '\\t' : delimiter, 'g')) || [])
        .length,
    }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ','
}

function parseCsvLine(line: string, delimiter: string) {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index++) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

export function parseCatalogCsv(csv: string): CatalogCsv {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [], delimiter: ',' }

  const delimiter = detectDelimiter(csv)
  const headers = parseCsvLine(lines[0], delimiter)
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter))

  return { headers, rows, delimiter }
}

const FIELD_HEADER_HINTS: Record<MiraklTaxonomyField, string[]> = {
  product_sku: ['sku', 'reference', 'ref', 'product sku', 'seller sku', 'code'],
  product_title: ['name', 'nom', 'title', 'product', 'produit', 'designation', 'libelle'],
  brand: ['brand', 'marque', 'manufacturer', 'fabricant'],
  category_code: ['category', 'categorie', 'cat', 'famille', 'type'],
  description: ['description', 'desc', 'details', 'detail'],
  price_eur: ['price', 'prix', 'selling price', 'prix vente', 'tarif'],
  quantity: ['quantity', 'quantite', 'qte', 'qty', 'stock'],
  ean: ['ean', 'gtin', 'barcode', 'code barres', 'code barre'],
  image_url: ['image', 'image url', 'photo', 'picture', 'url image'],
  color: ['color', 'couleur'],
  material: ['material', 'matiere', 'materiau'],
}

const CATEGORY_CODES: Array<[RegExp, string]> = [
  [/chair|chaise|fauteuil/i, 'CHAIRS'],
  [/table|desk|bureau/i, 'TABLES'],
  [/sofa|canape|couch/i, 'SOFAS'],
  [/lamp|luminaire|light/i, 'LIGHTING'],
  [/shelf|etagere|bookcase/i, 'STORAGE'],
]

function columnForField(headers: string[], field: MiraklTaxonomyField) {
  const normalizedHeaders = headers.map(normalizeHeader)
  const hints = FIELD_HEADER_HINTS[field]
  const exact = normalizedHeaders.findIndex((header) => hints.includes(header))
  if (exact >= 0) return exact

  return normalizedHeaders.findIndex((header) =>
    hints.some((hint) => header.includes(hint) || hint.includes(header))
  )
}

function valueFor(row: string[], headers: string[], field: MiraklTaxonomyField) {
  const index = columnForField(headers, field)
  return {
    index,
    sourceColumn: index >= 0 ? headers[index] : null,
    value: index >= 0 ? (row[index] ?? '').trim() : '',
  }
}

function proposedValueFor(field: MiraklTaxonomyField, rawValue: string) {
  if (field === 'category_code') {
    const mapped = CATEGORY_CODES.find(([pattern]) => pattern.test(rawValue))
    return mapped?.[1] ?? (rawValue ? rawValue.toUpperCase().replace(/[^A-Z0-9]+/g, '_') : '')
  }

  if (field === 'price_eur') {
    const normalized = rawValue.replace(',', '.').replace(/[^0-9.]/g, '')
    return normalized || ''
  }

  if (field === 'quantity') {
    const normalized = rawValue.replace(/[^0-9-]/g, '')
    return normalized || ''
  }

  return rawValue
}

function confidenceFor(rawValue: string, sourceColumn: string | null, field: MiraklTaxonomyField) {
  if (!sourceColumn || !rawValue) return 0.35
  if (field === 'category_code') return CATEGORY_CODES.some(([pattern]) => pattern.test(rawValue)) ? 0.92 : 0.78
  return 0.9
}

function rowObject(headers: string[], row: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
}

export function analyzeCatalogCsv(args: { fileName: string; csv: string }) {
  const parsed = parseCatalogCsv(args.csv)

  return parsed.rows.flatMap((row, rowIndex) => {
    const rawRow = rowObject(parsed.headers, row)
    const skuValue = valueFor(row, parsed.headers, 'product_sku').value || `ROW-${rowIndex + 1}`

    return MIRAKL_TAXONOMY_FIELDS.map((field) => {
      const value = valueFor(row, parsed.headers, field)
      const proposedValue = proposedValueFor(field, value.value)
      const confidence = confidenceFor(value.value, value.sourceColumn, field)

      return {
        sku: skuValue,
        row_index: rowIndex,
        source_column: value.sourceColumn,
        target_field: field,
        raw_value: value.value,
        proposed_value: proposedValue,
        reasoning: value.sourceColumn
          ? `Mapped from CSV column "${value.sourceColumn}" to Mirakl field "${field}".`
          : `No matching CSV column found for Mirakl field "${field}".`,
        confidence,
        simulated: true,
        raw_row: rawRow,
      } satisfies CatalogMappingProposal
    })
  })
}
