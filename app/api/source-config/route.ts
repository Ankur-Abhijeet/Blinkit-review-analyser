import { NextResponse } from 'next/server'
import { SOURCE_DEFAULTS } from '../../../lib/collectors/types'

export async function GET() {
  return NextResponse.json(SOURCE_DEFAULTS)
}
