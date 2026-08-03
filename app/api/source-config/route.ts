import { NextResponse } from 'next/server'
import { SOURCE_DEFAULTS } from '../../../lib/collectors/types'

// Runs external HTTP fetches and libSQL queries — must be the Node.js runtime,
// and never statically rendered at build time.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel Hobby caps functions at 60s; raise this if the project is on Pro.
export const maxDuration = 60


export async function GET() {
  return NextResponse.json(SOURCE_DEFAULTS)
}
