import { clearCache, getTaxonomyHash } from '../lib/db/cache'

async function main() {
  console.log('🧹 Clearing classification cache...')
  try {
    await clearCache()
    console.log('✅ Classification cache cleared successfully.')
    console.log(`📌 Current taxonomy hash: ${getTaxonomyHash()}`)
  } catch (err) {
    console.error('❌ Failed to clear classification cache:', err)
    process.exit(1)
  }
}

main()
