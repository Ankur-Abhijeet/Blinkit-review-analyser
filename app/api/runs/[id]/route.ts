import { NextRequest, NextResponse } from 'next/server'
import { loadRun, deleteRun } from '../../../../lib/db/runs'

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params
    const result = await loadRun(id)

    if (!result) {
      return NextResponse.json({ error: `Run with ID ${id} not found` }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const error = err as Error
    console.error('[API RUNS POINT] Failed to load run:', error)
    return NextResponse.json({ error: error.message || 'Failed to load run' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params
    await deleteRun(id)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const error = err as Error
    console.error('[API RUNS POINT] Failed to delete run:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete run' }, { status: 500 })
  }
}
